/**
 * GESTÃO DE CUSTOS VIEW — Depreciação de equipamentos e custos fixos mensais.
 */

import { BaseView }         from "./baseView.js";
import { BaseRepository }   from "../../data/repositories/baseRepository.js";
import { supabase }         from "../../supabase/client.js";
import { EventBus }         from "../../core/eventBus.js";
import { esc }              from "../../utils/sanitize.js";
import { fmtBRL, fmtData }  from "../../utils/fmt.js";
import { PageHeader, KpiGrid, Btn, openModal } from "../components/index.js";

// ─── Repositories ─────────────────────────────────────────────────────────────
class DepreciacaoRepository extends BaseRepository {
  constructor() { super("depreciacao", "*"); }
  async findOrdered() { return this.findAll({ order: "nome" }); }
}
class CustosFixosRepository extends BaseRepository {
  constructor() { super("custos_fixos", "*"); }
  async findOrdered() { return this.findAll({ order: "nome" }); }
}
class ConfigKVRepository extends BaseRepository {
  constructor() { super("configuracoes", "*"); }
  async getValue(chave) {
    const { data } = await supabase.from("configuracoes").select("valor").eq("chave", chave).maybeSingle();
    return data?.valor ?? null;
  }
  async setValue(chave, valor) {
    await supabase.from("configuracoes").upsert({ chave, valor: String(valor) }, { onConflict: "chave" });
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────
const CATS_CUSTO = ["Aluguel","Energia Elétrica","Água","Internet","Telefone",
  "Sistema/Software","Contabilidade","Manutenção","Outros"];

class GestaoCustosService {
  #depr   = new DepreciacaoRepository();
  #fixos  = new CustosFixosRepository();
  #config = new ConfigKVRepository();
  _cache  = { equipamentos: [], custos: [], custoOpPct: 0 };

  async loadAll() {
    const [eq, cu, pct] = await Promise.all([
      this.#depr.findOrdered(),
      this.#fixos.findOrdered(),
      this.#config.getValue("custo_operacional_pct"),
    ]);
    this._cache.equipamentos = eq;
    this._cache.custos       = cu;
    this._cache.custoOpPct   = parseFloat(pct||0);
    return this._cache;
  }

  calcDeprMensal(e) {
    const meses = Number(e.vida_util_anos||1) * 12;
    return meses > 0 ? Number(e.valor||0) / meses : 0;
  }
  calcMesesUsados(e) {
    if (!e.data_aquisicao) return 0;
    return Math.floor((Date.now() - new Date(e.data_aquisicao)) / (1000*60*60*24*30.44));
  }
  calcTotais() {
    const totalDepr  = this._cache.equipamentos.reduce((s,e) => s + this.calcDeprMensal(e), 0);
    const ativos     = this._cache.custos.filter(c => c.ativo !== false);
    const totalFixo  = ativos.reduce((s,c) => s + Number(c.valor_mensal||0), 0);
    const total      = totalDepr + totalFixo;
    return { totalDepr, totalFixo, total, totalDia: total/30, totalHora: total/30/8, ativos };
  }

  async criarEquip(p)       { const r = await this.#depr.create(this.#buildEq(p));  this._cache.equipamentos = await this.#depr.findOrdered();  return r; }
  async atualizarEquip(id,p){ const r = await this.#depr.update(id, this.#buildEq(p)); this._cache.equipamentos = await this.#depr.findOrdered(); return r; }
  async deletarEquip(id)    { await this.#depr.delete(id);  this._cache.equipamentos = await this.#depr.findOrdered(); }
  #buildEq(p) { return { nome: p.nome?.trim(), categoria: p.categoria||null, valor: Number(p.valor||0), vida_util_anos: Number(p.vida_util_anos||1), data_aquisicao: p.data_aquisicao||null, observacoes: p.observacoes||null }; }

  async criarCusto(p)       { const r = await this.#fixos.create(this.#buildCu(p)); this._cache.custos = await this.#fixos.findOrdered(); return r; }
  async atualizarCusto(id,p){ const r = await this.#fixos.update(id, this.#buildCu(p)); this._cache.custos = await this.#fixos.findOrdered(); return r; }
  async deletarCusto(id)    { await this.#fixos.delete(id); this._cache.custos = await this.#fixos.findOrdered(); }
  #buildCu(p) { return { nome: p.nome?.trim(), categoria: p.categoria||"Outros", valor_mensal: Number(p.valor_mensal||0), ativo: p.ativo !== false, observacoes: p.observacoes||null }; }

  async salvarPct(pct) { await this.#config.setValue("custo_operacional_pct", pct); this._cache.custoOpPct = pct; }
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW
// ══════════════════════════════════════════════════════════════════════════════
export class GestaoCustosView extends BaseView {
  #svc   = new GestaoCustosService();
  #aba   = "resumo";

  async _init() {
    await this.#svc.loadAll();
  }

  render() {
    const { totalDepr, totalFixo, total, totalHora, ativos } = this.#svc.calcTotais();

    return `
      <style>${gcCSS()}</style>

      ${PageHeader({
        title:    "Gestão de Custos",
        subtitle: "Depreciação de equipamentos e custos fixos mensais",
      })}

      ${KpiGrid([
        { label: "Depreciação mensal", value: fmtBRL(totalDepr), color: "var(--warning)", icon: "🔧" },
        { label: "Custos fixos/mês",   value: fmtBRL(totalFixo), color: "var(--error)",   icon: "💳" },
        { label: "Total mensal",       value: fmtBRL(total),     color: "var(--primary-light)", icon: "📊" },
        { label: "Custo por hora",     value: fmtBRL(totalHora), color: "var(--info)",     icon: "⏱" },
      ])}

      <div class="gc-abas">
        ${[
          { key:"resumo",      icon:"fi-rr-chart-histogram", label:"Resumo"       },
          { key:"depreciacao", icon:"fi-rr-tools",           label:"Depreciação"  },
          { key:"fixos",       icon:"fi-rr-money-bill-wave", label:"Custos Fixos" },
        ].map(a => `
          <button class="gc-aba ${this.#aba===a.key?"active":""}" data-aba="${a.key}">
            <i class="fi ${a.icon}"></i> ${a.label}
          </button>`).join("")}
      </div>

      <div id="gc-body"></div>
    `;
  }

  afterRender() {
    this.$$("[data-aba]").forEach(btn =>
      btn.addEventListener("click", () => { this.#aba = btn.dataset.aba; this.refresh(); })
    );
    const body = this.$("#gc-body");
    if (!body) return;
    const t = this.#svc.calcTotais();
    if      (this.#aba === "resumo")      this.#renderResumo(body, t);
    else if (this.#aba === "depreciacao") this.#renderDepreciacao(body);
    else if (this.#aba === "fixos")       this.#renderFixos(body);
  }

  // ── Resumo ────────────────────────────────────────────────────────────────
  #renderResumo(body, { totalDepr, totalFixo, total, totalDia, totalHora }) {
    const porCat = {};
    this.#svc._cache.custos.filter(c=>c.ativo!==false).forEach(c => {
      const k = c.categoria||"Outros";
      porCat[k] = (porCat[k]||0) + Number(c.valor_mensal||0);
    });
    const catEntries = Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
    const maxCat     = Math.max(...catEntries.map(e=>e[1]),1);
    const topEq      = [...this.#svc._cache.equipamentos]
      .sort((a,b) => this.#svc.calcDeprMensal(b)-this.#svc.calcDeprMensal(a))
      .slice(0,5);

    body.innerHTML = `
      <div class="gc-grid">
        <div class="gc-card">
          <div class="gc-card-title">📊 Composição do custo mensal</div>
          ${[["Depreciação", totalDepr, "var(--warning)"], ["Custos fixos", totalFixo, "var(--error)"]].map(([lbl,val,cor])=>`
            <div class="comp-row">
              <span class="comp-lbl">${lbl}</span>
              <div class="comp-track"><div class="comp-fill" style="width:${total>0?(val/total*100).toFixed(1):0}%;background:${cor}"></div></div>
              <span class="comp-val">${fmtBRL(val)}</span>
            </div>`).join("")}
          <div class="comp-total"><span>Total mensal</span><strong>${fmtBRL(total)}</strong></div>
          <div class="periodos-grid">
            ${[["Por dia",totalDia],["Por hora",totalHora],["Por mês",total],["Por ano",total*12]]
              .map(([l,v])=>`<div class="periodo-item"><div class="periodo-lbl">${l}</div><div class="periodo-val">${fmtBRL(v)}</div></div>`)
              .join("")}
          </div>
        </div>
        <div class="gc-card">
          <div class="gc-card-title">💳 Custos fixos por categoria</div>
          ${catEntries.length===0
            ? `<div class="gc-vazio">Nenhum custo fixo cadastrado.</div>`
            : catEntries.map(([cat,val])=>`
              <div class="comp-row">
                <span class="comp-lbl">${esc(cat)}</span>
                <div class="comp-track"><div class="comp-fill" style="width:${(val/maxCat*100).toFixed(1)}%;background:var(--error)"></div></div>
                <span class="comp-val">${fmtBRL(val)}</span>
              </div>`).join("")}
        </div>
      </div>

      ${topEq.length>0?`
      <div class="gc-card" style="margin-top:14px">
        <div class="gc-card-title">🔧 Maiores depreciações mensais</div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th>Equipamento</th><th style="text-align:right">Valor</th>
              <th style="text-align:center">Vida útil</th>
              <th style="text-align:right">Depr./mês</th>
              <th style="text-align:right">Depr./hora</th>
              <th style="text-align:center;width:120px">Progresso</th>
            </tr></thead>
            <tbody>
              ${topEq.map(e=>{
                const dm   = this.#svc.calcDeprMensal(e);
                const dh   = dm/30/8;
                const m    = this.#svc.calcMesesUsados(e);
                const vida = Number(e.vida_util_anos||1)*12;
                const pct  = Math.min((m/vida)*100,100);
                const st   = pct>=100?"depr":pct>70?"crit":"ok";
                return `<tr>
                  <td><strong>${esc(e.nome)}</strong></td>
                  <td style="text-align:right">${fmtBRL(e.valor||0)}</td>
                  <td style="text-align:center">${e.vida_util_anos}a</td>
                  <td style="text-align:right;color:var(--warning);font-weight:700">${fmtBRL(dm)}</td>
                  <td style="text-align:right;color:var(--muted);font-size:12px">R$ ${Number(dh).toFixed(4)}</td>
                  <td style="text-align:center">
                    <div class="prog-wrap"><div class="prog-bar ${st}" style="width:${pct.toFixed(0)}%"></div></div>
                    <div style="font-size:10px;color:var(--muted)">${pct.toFixed(0)}%</div>
                  </td>
                </tr>`;}).join("")}
            </tbody>
          </table>
        </div>
      </div>`:""}

      <div class="gc-integ-card">
        <div style="font-size:20px">⚙️</div>
        <div style="flex:1">
          <div class="gc-integ-titulo">Repasse de Custo Operacional para Orçamentos</div>
          <div class="gc-integ-desc">Percentual acrescentado nos orçamentos de impressão (m²). Custo/hora atual: <strong style="color:var(--info)">${fmtBRL(totalHora)}</strong></div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
            <div class="pct-input-wrap">
              <input id="custo-op-pct" type="number" min="0" max="100" step="0.1"
                value="${this.#svc._cache.custoOpPct}" placeholder="0" />
              <span>%</span>
            </div>
            ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar', "btn-salvar-pct")}
          </div>
          <div id="pct-exemplos" style="margin-top:8px">${this.#exemplosPct(this.#svc._cache.custoOpPct)}</div>
        </div>
      </div>
    `;

    body.querySelector("#custo-op-pct")?.addEventListener("input", e => {
      const el = body.querySelector("#pct-exemplos");
      if (el) el.innerHTML = this.#exemplosPct(parseFloat(e.target.value)||0);
    });
    body.querySelector("#btn-salvar-pct")?.addEventListener("click", async () => {
      const pct = parseFloat(body.querySelector("#custo-op-pct").value)||0;
      await this.#svc.salvarPct(pct);
      this.toast(`Percentual de ${pct}% salvo!`, "ok");
      this.refresh();
    });
  }

  #exemplosPct(pct) {
    if (!pct||pct<=0) return `<span style="color:var(--muted);font-size:12px">Nenhum acréscimo será aplicado.</span>`;
    return `<div style="font-size:11px;color:var(--muted)">Exemplos com ${pct}%: ${
      [50,100,200].map(v=>{
        const acr = v*(pct/100);
        return `<span class="ex-badge">R$${v} → <strong>${fmtBRL(v+acr)}</strong></span>`;
      }).join("")}</div>`;
  }

  // ── Depreciação ───────────────────────────────────────────────────────────
  #renderDepreciacao(body) {
    const eqs = this.#svc._cache.equipamentos;
    body.innerHTML = `
      <div class="gc-section-header">
        <div class="gc-section-title">🔧 Equipamentos e Depreciação</div>
        ${Btn.primary("+ Novo Equipamento", "btn-novo-eq")}
      </div>
      <div class="gc-hint">Depreciação linear: <strong>Valor ÷ (Vida útil × 12)</strong></div>
      ${eqs.length===0
        ? `<div class="gc-vazio">Nenhum equipamento cadastrado. Adicione impressoras, plotters, computadores...</div>`
        : `<div class="eq-grid">
            ${eqs.map(e=>{
              const dm  = this.#svc.calcDeprMensal(e);
              const dh  = dm/30/8;
              const m   = this.#svc.calcMesesUsados(e);
              const vida= Number(e.vida_util_anos||1)*12;
              const pct = Math.min((m/vida)*100,100);
              const st  = pct>=100?"depr":pct>70?"crit":"ok";
              const res = Math.max(Number(e.valor||0)-(dm*m),0);
              const labels = { depr:"Depreciado", crit:"Crítico", ok:"Em uso" };
              return `
                <div class="eq-card ${st}">
                  <div class="eq-header">
                    <div>
                      <div class="eq-nome">${esc(e.nome)}</div>
                      ${e.categoria?`<div class="eq-cat">${esc(e.categoria)}</div>`:""}
                    </div>
                    <span class="eq-badge ${st}">${labels[st]}</span>
                  </div>
                  <div class="eq-vals">
                    <div class="eq-val-item"><span>Valor compra</span><strong>${fmtBRL(e.valor||0)}</strong></div>
                    <div class="eq-val-item"><span>Vida útil</span><strong>${e.vida_util_anos}a</strong></div>
                    <div class="eq-val-item"><span>Residual</span><strong style="color:var(--muted)">${fmtBRL(res)}</strong></div>
                  </div>
                  <div class="eq-depr-banner">
                    <div><div class="depr-lbl">Depr. mensal</div><div class="depr-val">${fmtBRL(dm)}</div></div>
                    <div style="text-align:right"><div class="depr-lbl">Por hora</div><div class="depr-val" style="font-size:14px;color:var(--info)">R$ ${Number(dh).toFixed(4)}</div></div>
                  </div>
                  <div class="eq-prog-label">
                    <span>Depreciação acumulada</span><span>${pct.toFixed(0)}% · ${m}/${vida}m</span>
                  </div>
                  <div class="prog-wrap"><div class="prog-bar ${st}" style="width:${pct.toFixed(0)}%"></div></div>
                  ${e.data_aquisicao?`<div class="eq-data">Adquirido em: ${fmtData(e.data_aquisicao)}</div>`:""}
                  ${e.observacoes?`<div class="eq-obs">${esc(e.observacoes)}</div>`:""}
                  <div class="eq-acoes">
                    ${Btn.icon('<i class="fi fi-rr-pencil"></i> Editar', `eq-edit-${e.id}`)}
                    ${Btn.icon('<i class="fi fi-rr-trash"></i>', `eq-del-${e.id}`, true)}
                  </div>
                </div>`;
            }).join("")}
           </div>
           <div class="gc-total-bar">
             <span>Total depreciação mensal:</span>
             <strong>${fmtBRL(eqs.reduce((s,e)=>s+this.#svc.calcDeprMensal(e),0))}</strong>
           </div>`}
    `;
    body.querySelector("#btn-novo-eq")?.addEventListener("click", ()=>this.#modalEq(null));
    eqs.forEach(e=>{
      body.querySelector(`#eq-edit-${e.id}`)?.addEventListener("click",()=>this.#modalEq(e));
      body.querySelector(`#eq-del-${e.id}`)?.addEventListener("click", async()=>{
        if(!confirm(`Remover "${e.nome}"?`))return;
        await this.#svc.deletarEquip(e.id);
        this.toast("Equipamento removido.","ok"); this.refresh();
      });
    });
  }

  // ── Custos Fixos ──────────────────────────────────────────────────────────
  #renderFixos(body) {
    const custos  = this.#svc._cache.custos;
    const ativos  = custos.filter(c=>c.ativo!==false);
    const total   = ativos.reduce((s,c)=>s+Number(c.valor_mensal||0),0);

    body.innerHTML = `
      <div class="gc-section-header">
        <div class="gc-section-title">💳 Custos Fixos Mensais</div>
        ${Btn.primary("+ Novo Custo", "btn-novo-custo")}
      </div>
      <div class="gc-hint">Cadastre aluguel, energia, internet, salários e outros custos mensais.</div>
      ${custos.length===0
        ? `<div class="gc-vazio">Nenhum custo fixo cadastrado.</div>`
        : `<div class="table-wrapper">
            <table class="data-table">
              <thead><tr>
                <th>Nome</th><th>Categoria</th>
                <th style="text-align:right">Valor/mês</th>
                <th style="text-align:right">Valor/hora</th>
                <th style="text-align:center">Status</th><th></th>
              </tr></thead>
              <tbody>
                ${custos.map(c=>{
                  const ativo = c.ativo!==false;
                  const hora  = Number(c.valor_mensal||0)/30/8;
                  return `
                    <tr class="${ativo?"":"row-inativo"}">
                      <td><strong>${esc(c.nome)}</strong>${c.observacoes?`<div style="font-size:11px;color:var(--muted)">${esc(c.observacoes)}</div>`:""}</td>
                      <td style="font-size:12px;color:var(--muted)">${esc(c.categoria)||"—"}</td>
                      <td style="text-align:right;font-weight:700;color:${ativo?"var(--error)":"var(--muted)"}">${fmtBRL(c.valor_mensal||0)}</td>
                      <td style="text-align:right;font-size:12px;color:var(--muted)">R$ ${hora.toFixed(4)}</td>
                      <td style="text-align:center">
                        <span class="cu-status ${ativo?"ativo":"inativo"}">${ativo?"● Ativo":"○ Inativo"}</span>
                      </td>
                      <td>
                        <div style="display:flex;gap:4px;justify-content:flex-end">
                          ${Btn.icon('<i class="fi fi-rr-pencil"></i>', `cu-edit-${c.id}`)}
                          ${Btn.icon('<i class="fi fi-rr-trash"></i>', `cu-del-${c.id}`, true)}
                        </div>
                      </td>
                    </tr>`;
                }).join("")}
              </tbody>
            </table>
           </div>
           <div class="gc-total-bar">
             <span>Total custos fixos ativos/mês:</span>
             <strong style="color:var(--error)">${fmtBRL(total)}</strong>
           </div>`}
    `;
    body.querySelector("#btn-novo-custo")?.addEventListener("click",()=>this.#modalCusto(null));
    custos.forEach(c=>{
      body.querySelector(`#cu-edit-${c.id}`)?.addEventListener("click",()=>this.#modalCusto(c));
      body.querySelector(`#cu-del-${c.id}`)?.addEventListener("click",async()=>{
        if(!confirm(`Remover "${c.nome}"?`))return;
        await this.#svc.deletarCusto(c.id);
        this.toast("Custo removido.","ok"); this.refresh();
      });
    });
  }

  // ── Modal Equipamento ─────────────────────────────────────────────────────
  #modalEq(edit=null) {
    const ed = !!edit?.id;
    const modalRef = openModal({
      title: `${ed?"Editar":"Novo"} Equipamento`,
      maxWidth: "520px",
      body: `
        <div class="form-grid">
          <div class="form-field" style="grid-column:1/-1">
            <label>Nome *</label>
            <input id="e-nome" value="${esc(edit?.nome||"")}" placeholder="Ex: Impressora HP Latex 570" autofocus />
          </div>
          <div class="form-field">
            <label>Categoria</label>
            <select id="e-cat">
              <option value="">Selecionar...</option>
              ${["Impressora","Plotter de Recorte","Computador","Monitor","Acabamento","Veículo","Outros"]
                .map(c=>`<option value="${c}" ${edit?.categoria===c?"selected":""}>${c}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Data de aquisição</label>
            <input id="e-data" type="date" value="${edit?.data_aquisicao||""}" />
          </div>
          <div class="form-field">
            <label>Valor de compra (R$) *</label>
            <div class="val-wrap"><span>R$</span><input id="e-valor" type="number" min="0" step="0.01" value="${edit?.valor||""}" placeholder="0,00" /></div>
          </div>
          <div class="form-field">
            <label>Vida útil (anos) *</label>
            <div class="val-wrap"><input id="e-vida" type="number" min="1" max="30" value="${edit?.vida_util_anos||5}" /><span>anos</span></div>
          </div>
          <div class="form-field" style="grid-column:1/-1">
            <label>Observações</label>
            <textarea id="e-obs" rows="2">${esc(edit?.observacoes||"")}</textarea>
          </div>
        </div>
        <div id="depr-preview"></div>`,
      actions: `${Btn.secondary("Cancelar","e-cancel")} ${Btn.primary(`<i class="fi fi-rr-disk"></i> ${ed?"Salvar":"Criar"}`,"e-ok")}`,
    });

    const preview = () => {
      const v = parseFloat(document.getElementById("e-valor")?.value)||0;
      const a = parseFloat(document.getElementById("e-vida")?.value)||1;
      const el = document.getElementById("depr-preview");
      if (!el||!v) return;
      const mes = v/(a*12);
      el.innerHTML = `<div class="depr-prev"><strong>Prévia:</strong> ${fmtBRL(mes)}/mês · R$ ${(mes/30/8).toFixed(4)}/hora</div>`;
    };
    document.getElementById("e-valor")?.addEventListener("input", preview);
    document.getElementById("e-vida")?.addEventListener("input",  preview);
    if (edit?.valor) preview();

    document.getElementById("e-cancel")?.addEventListener("click",()=>modalRef.close());
    document.getElementById("e-ok")?.addEventListener("click", async()=>{
      const nome = document.getElementById("e-nome")?.value.trim();
      if(!nome){ this.toast("Informe o nome.","warn"); return; }
      const payload = {
        nome, categoria: document.getElementById("e-cat")?.value,
        valor:          document.getElementById("e-valor")?.value,
        vida_util_anos: document.getElementById("e-vida")?.value,
        data_aquisicao: document.getElementById("e-data")?.value,
        observacoes:    document.getElementById("e-obs")?.value,
      };
      try {
        ed ? await this.#svc.atualizarEquip(edit.id,payload) : await this.#svc.criarEquip(payload);
        modalRef.close(); this.toast(`Equipamento ${ed?"atualizado":"cadastrado"}!`,"ok"); this.refresh();
      } catch(e){ this.toast(e.message,"erro"); }
    });
  }

  // ── Modal Custo Fixo ──────────────────────────────────────────────────────
  #modalCusto(edit=null) {
    const ed = !!edit?.id;
    const modalRef = openModal({
      title: `${ed?"Editar":"Novo"} Custo Fixo`,
      body: `
        <div class="form-field"><label>Nome *</label>
          <input id="c-nome" value="${esc(edit?.nome||"")}" placeholder="Ex: Aluguel, Energia..." autofocus />
        </div>
        <div class="form-field" style="margin-top:10px"><label>Categoria</label>
          <select id="c-cat">${CATS_CUSTO.map(cat=>
            `<option value="${cat}" ${edit?.categoria===cat?"selected":""}>${cat}</option>`).join("")}
          </select>
        </div>
        <div class="form-field" style="margin-top:10px"><label>Valor mensal (R$) *</label>
          <div class="val-wrap"><span>R$</span><input id="c-valor" type="number" min="0" step="0.01" value="${edit?.valor_mensal||""}" placeholder="0,00" /></div>
        </div>
        <div class="form-field" style="margin-top:10px"><label>Status</label>
          <select id="c-ativo">
            <option value="true"  ${edit?.ativo!==false?"selected":""}>● Ativo</option>
            <option value="false" ${edit?.ativo===false?"selected":""}>○ Inativo</option>
          </select>
        </div>
        <div class="form-field" style="margin-top:10px"><label>Observações</label>
          <textarea id="c-obs" rows="2">${esc(edit?.observacoes||"")}</textarea>
        </div>`,
      actions: `${Btn.secondary("Cancelar","c-cancel")} ${Btn.primary(`<i class="fi fi-rr-disk"></i> ${ed?"Salvar":"Criar"}`,"c-ok")}`,
    });

    document.getElementById("c-cancel")?.addEventListener("click",()=>modalRef.close());
    document.getElementById("c-ok")?.addEventListener("click", async()=>{
      const nome = document.getElementById("c-nome")?.value.trim();
      if(!nome){ this.toast("Informe o nome.","warn"); return; }
      const payload = {
        nome, categoria: document.getElementById("c-cat")?.value,
        valor_mensal: document.getElementById("c-valor")?.value,
        ativo:        document.getElementById("c-ativo")?.value==="true",
        observacoes:  document.getElementById("c-obs")?.value,
      };
      try {
        ed ? await this.#svc.atualizarCusto(edit.id,payload) : await this.#svc.criarCusto(payload);
        modalRef.close(); this.toast(`Custo ${ed?"atualizado":"cadastrado"}!`,"ok"); this.refresh();
      } catch(e){ this.toast(e.message,"erro"); }
    });
  }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function gcCSS() { return `
.gc-abas{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.gc-aba{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:var(--radius-md);border:1px solid var(--border-md);background:transparent;color:var(--muted);cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500;transition:all var(--t)}
.gc-aba:hover{background:var(--panel2);color:var(--text)}
.gc-aba.active{background:var(--primary-bg);border-color:var(--primary-border);color:var(--primary-light);font-weight:700}
.gc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:800px){.gc-grid{grid-template-columns:1fr}}
.gc-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px}
.gc-card-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:14px}
.comp-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px}
.comp-lbl{width:100px;flex-shrink:0;color:var(--muted)}
.comp-track{flex:1;height:8px;background:var(--panel3);border-radius:99px;overflow:hidden}
.comp-fill{height:100%;border-radius:99px;transition:width .5s}
.comp-val{font-weight:600;min-width:88px;text-align:right;white-space:nowrap;font-size:12px}
.comp-total{display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px;margin-top:10px;font-size:13px;color:var(--muted)}
.comp-total strong{font-size:16px;color:var(--text)}
.periodos-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.periodo-item{background:var(--panel);border-radius:var(--radius-md);padding:10px 12px}
.periodo-lbl{font-size:11px;color:var(--muted);margin-bottom:2px}
.periodo-val{font-size:14px;font-weight:700;color:var(--primary-light)}
.gc-vazio{color:var(--muted);font-size:13px;padding:32px;text-align:center;background:var(--panel2);border-radius:var(--radius-lg);border:1px dashed var(--border-md)}
.gc-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.gc-section-title{font-size:16px;font-weight:700}
.gc-hint{font-size:12px;color:var(--muted);background:var(--panel2);border-left:3px solid var(--primary);padding:8px 12px;border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:14px}
.gc-total-bar{display:flex;align-items:center;justify-content:space-between;background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;margin-top:12px;font-size:13px;color:var(--muted)}
.gc-total-bar strong{font-size:16px;color:var(--text)}
.gc-integ-card{display:flex;align-items:flex-start;gap:12px;background:var(--primary-bg);border:1px solid var(--primary-border);border-radius:var(--radius-lg);padding:14px 16px;margin-top:14px}
.gc-integ-titulo{font-size:13px;font-weight:700;margin-bottom:4px}
.gc-integ-desc{font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:8px}
.pct-input-wrap{display:flex;align-items:center;background:var(--panel2);border:1px solid var(--border-md);border-radius:var(--radius-md);overflow:hidden;width:120px}
.pct-input-wrap input{border:none;background:transparent;flex:1;padding:8px 10px;font-size:13px;color:var(--text);width:80px}
.pct-input-wrap input:focus{outline:none}
.pct-input-wrap span{padding:0 10px;font-size:12px;color:var(--muted);background:var(--panel3);border-left:1px solid var(--border);display:flex;align-items:center}
.ex-badge{display:inline-block;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-sm);padding:3px 8px;margin:3px 4px 0 0;font-size:11px;color:var(--muted)}
.ex-badge strong{color:var(--primary-light)}
.eq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.eq-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px}
.eq-card.crit{border-color:rgba(232,160,16,0.4)}
.eq-card.depr{border-color:rgba(171,0,0,0.3);background:rgba(171,0,0,0.03)}
.eq-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px}
.eq-nome{font-size:15px;font-weight:700}
.eq-cat{font-size:11px;color:var(--muted);margin-top:2px}
.eq-badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;flex-shrink:0}
.eq-badge.ok{background:var(--success-bg);color:var(--success)}
.eq-badge.crit{background:var(--warning-bg);color:var(--warning)}
.eq-badge.depr{background:var(--error-bg);color:var(--error)}
.eq-vals{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px}
.eq-val-item{background:var(--panel);border-radius:var(--radius-sm);padding:6px 10px;font-size:11px}
.eq-val-item span{display:block;color:var(--muted);margin-bottom:2px}
.eq-val-item strong{font-size:13px}
.eq-depr-banner{display:flex;justify-content:space-between;background:rgba(232,160,16,0.08);border:1px solid rgba(232,160,16,0.2);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:8px}
.depr-lbl{font-size:11px;color:var(--muted);margin-bottom:2px}
.depr-val{font-size:18px;font-weight:800;color:var(--warning)}
.eq-prog-label{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px}
.prog-wrap{background:var(--panel);border-radius:99px;height:6px;overflow:hidden;margin-bottom:8px}
.prog-bar{height:100%;border-radius:99px;transition:width .4s}
.prog-bar.ok{background:var(--success)}.prog-bar.crit{background:var(--warning)}.prog-bar.depr{background:var(--error)}
.eq-data,.eq-obs{font-size:11px;color:var(--muted);margin-top:4px}
.eq-acoes{display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.cu-status{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
.cu-status.ativo{background:var(--success-bg);color:var(--success)}
.cu-status.inativo{background:var(--panel3);color:var(--muted)}
.row-inativo td{opacity:.55}
.val-wrap{display:flex;align-items:center;background:var(--panel2);border:1px solid var(--border-md);border-radius:var(--radius-md);overflow:hidden}
.val-wrap:focus-within{border-color:var(--primary)}
.val-wrap span{padding:0 10px;font-size:12px;color:var(--muted);background:var(--panel3);border-right:1px solid var(--border);display:flex;align-items:center;flex-shrink:0;white-space:nowrap}
.val-wrap input{border:none;background:transparent;flex:1;padding:9px 10px;font-size:13px;color:var(--text)}
.val-wrap input:focus{outline:none}
.depr-prev{background:rgba(232,160,16,0.08);border:1px solid rgba(232,160,16,0.2);border-radius:var(--radius-sm);padding:8px 12px;margin-top:10px;font-size:12px;color:var(--warning)}
`; }
