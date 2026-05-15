// ════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ════════════════════════════════════════════════════════════════════════════
import { BaseRepository } from "../repositories/BaseRepository.js";
import { supabase } from "../supabase/client.js";
import { BaseView } from "../core/BaseView.js";
import { EventBus } from "../core/EventBus.js";
import { fmtBRL, fmtBRL4 } from "../utils/fmt.js";

class DepreciacaoRepository extends BaseRepository {
  constructor() { super("depreciacao", "*"); }
  async findOrdered() { return this.findAll({ order: "nome" }); }
}

class CustosFixosRepository extends BaseRepository {
  constructor() { super("custos_fixos", "*"); }
  async findOrdered() { return this.findAll({ order: "nome" }); }
}

class ConfiguracoesKVRepository extends BaseRepository {
  constructor() { super("configuracoes", "*"); }

  async getValue(chave) {
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", chave)
      .maybeSingle();
    return data?.valor ?? null;
  }

  async setValue(chave, valor) {
    await supabase
      .from("configuracoes")
      .upsert({ chave, valor: String(valor) }, { onConflict: "chave" });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SERVICE
// ════════════════════════════════════════════════════════════════════════════
const CATEGORIAS_CUSTO = [
  "Aluguel","Energia Elétrica","Água","Internet","Telefone",
  "Sistema/Software","Contabilidade","Manutenção","Outros",
];

class GestaoCustosService {
  #depreciacao  = new DepreciacaoRepository();
  #custosFixos  = new CustosFixosRepository();
  #config       = new ConfiguracoesKVRepository();

  _cache = { equipamentos: [], custos: [], custoOpPct: 0 };
  CATEGORIAS = CATEGORIAS_CUSTO;

  async loadAll() {
    const [equip, custos, pct] = await Promise.all([
      this.#depreciacao.findOrdered(),
      this.#custosFixos.findOrdered(),
      this.#config.getValue("custo_operacional_pct"),
    ]);
    this._cache.equipamentos = equip;
    this._cache.custos       = custos;
    this._cache.custoOpPct   = parseFloat(pct || 0);
    return this._cache;
  }

  // ─── Cálculos ─────────────────────────────────────────────────────────────
  calcDeprMensal(e) {
    const valor    = Number(e.valor || 0);
    const vidaMeses = Number(e.vida_util_anos || 1) * 12;
    return vidaMeses > 0 ? valor / vidaMeses : 0;
  }

  calcMesesUsados(e) {
    if (!e.data_aquisicao) return 0;
    const inicio = new Date(e.data_aquisicao);
    const agora  = new Date();
    return Math.floor((agora - inicio) / (1000 * 60 * 60 * 24 * 30.44));
  }

  calcTotais() {
    const totalDeprMensal = this._cache.equipamentos.reduce((s, e) => s + this.calcDeprMensal(e), 0);
    const custosAtivos    = this._cache.custos.filter(c => c.ativo !== false);
    const totalCustoFixo  = custosAtivos.reduce((s, c) => s + Number(c.valor_mensal || 0), 0);
    const totalMensal     = totalDeprMensal + totalCustoFixo;
    return {
      totalDeprMensal,
      totalCustoFixo,
      totalMensal,
      totalDiario: totalMensal / 30,
      totalHora:   totalMensal / 30 / 8,
      custosAtivos,
    };
  }

  // ─── Equipamento CRUD ─────────────────────────────────────────────────────
  async criarEquipamento(payload) {
    const novo = await this.#depreciacao.create(this._buildEquipPayload(payload));
    this._cache.equipamentos = await this.#depreciacao.findOrdered();
    EventBus.emit("custos:equipamento_criado", novo);
    return novo;
  }

  async atualizarEquipamento(id, payload) {
    const atualizado = await this.#depreciacao.update(id, this._buildEquipPayload(payload));
    this._cache.equipamentos = await this.#depreciacao.findOrdered();
    EventBus.emit("custos:equipamento_atualizado", atualizado);
    return atualizado;
  }

  async deletarEquipamento(id) {
    await this.#depreciacao.delete(id);
    this._cache.equipamentos = await this.#depreciacao.findOrdered();
    EventBus.emit("custos:equipamento_deletado", { id });
  }

  _buildEquipPayload(p) {
    return {
      nome:           p.nome?.trim(),
      categoria:      p.categoria    || null,
      valor:          Number(p.valor || 0),
      vida_util_anos: Number(p.vida_util_anos || 1),
      data_aquisicao: p.data_aquisicao || null,
      observacoes:    p.observacoes   || null,
    };
  }

  // ─── Custo Fixo CRUD ──────────────────────────────────────────────────────
  async criarCusto(payload) {
    const novo = await this.#custosFixos.create(this._buildCustoPayload(payload));
    this._cache.custos = await this.#custosFixos.findOrdered();
    return novo;
  }

  async atualizarCusto(id, payload) {
    const atualizado = await this.#custosFixos.update(id, this._buildCustoPayload(payload));
    this._cache.custos = await this.#custosFixos.findOrdered();
    return atualizado;
  }

  async deletarCusto(id) {
    await this.#custosFixos.delete(id);
    this._cache.custos = await this.#custosFixos.findOrdered();
  }

  _buildCustoPayload(p) {
    return {
      nome:        p.nome?.trim(),
      categoria:   p.categoria   || "Outros",
      valor_mensal: Number(p.valor_mensal || 0),
      ativo:       p.ativo !== false,
      observacoes: p.observacoes || null,
    };
  }

  // ─── Configuração % operacional ───────────────────────────────────────────
  async salvarCustoOpPct(pct) {
    await this.#config.setValue("custo_operacional_pct", pct);
    this._cache.custoOpPct = pct;
    EventBus.emit("custos:pct_atualizado", { pct });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// VIEW
// ════════════════════════════════════════════════════════════════════════════
export class GestaoCustosView extends BaseView {
  #svc;
  #state = { aba: "resumo" };

  constructor(container) {
    super(container);
    this.#svc = new GestaoCustosService();
  }

  async mount() {
    this._container.innerHTML = `<div class="loading">Carregando gestão de custos...</div>`;
    await this.#svc.loadAll();
    this._render();
  }

  // ─── Render principal ─────────────────────────────────────────────────────
  _render() {
    this.cleanup();
    const { totalDeprMensal, totalCustoFixo, totalMensal, totalHora, custosAtivos } = this.#svc.calcTotais();

    this._container.innerHTML = `
      <style>${gcCss()}</style>

      <div class="gc-header">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Gestão de Custos</h2>
          <span style="font-size:12px;color:var(--muted)">Depreciação de equipamentos e custos fixos mensais</span>
        </div>
      </div>

      <div class="gc-kpis">
        <div class="kpi-card">
          <div class="kpi-label">Depreciação mensal</div>
          <div class="kpi-val" style="color:var(--warning)">${fmtBRL(totalDeprMensal)}</div>
          <div class="kpi-sub">${this.#svc._cache.equipamentos.length} equipamento${this.#svc._cache.equipamentos.length !== 1 ? "s" : ""}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Custos fixos/mês</div>
          <div class="kpi-val" style="color:var(--error)">${fmtBRL(totalCustoFixo)}</div>
          <div class="kpi-sub">${custosAtivos.length} item${custosAtivos.length !== 1 ? "s" : ""} ativo${custosAtivos.length !== 1 ? "s" : ""}</div>
        </div>
        <div class="kpi-card kpi-destaque">
          <div class="kpi-label">Total mensal</div>
          <div class="kpi-val" style="color:var(--primary-light)">${fmtBRL(totalMensal)}</div>
          <div class="kpi-sub">Custo operacional total</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Custo por hora</div>
          <div class="kpi-val" style="color:var(--info)">${fmtBRL(totalHora)}</div>
          <div class="kpi-sub">Base: 8h/dia · 30 dias</div>
        </div>
      </div>

      <div class="gc-abas">
        ${[
          { key: "resumo",      icon: "fi-rr-chart-histogram", label: "Resumo"       },
          { key: "depreciacao", icon: "fi-rr-tools",           label: "Depreciação"  },
          { key: "fixos",       icon: "fi-rr-money-bill-wave", label: "Custos Fixos" },
        ].map(a => `
          <button class="gc-aba ${this.#state.aba === a.key ? "active" : ""}" data-aba="${a.key}">
            <i class="fi ${a.icon}"></i> ${a.label}
          </button>`).join("")}
      </div>

      <div id="gc-body"></div>
      <div id="modal-area"></div>
    `;

    this._container.querySelectorAll("[data-aba]").forEach(btn =>
      this._on(btn, "click", () => {
        this.#state.aba = btn.dataset.aba;
        this._render();
      })
    );

    const body = this._container.querySelector("#gc-body");
    const totais = { totalDeprMensal, totalCustoFixo, totalMensal, totalHora };
    if      (this.#state.aba === "resumo")      this._renderResumo(body, totais);
    else if (this.#state.aba === "depreciacao") this._renderDepreciacao(body);
    else if (this.#state.aba === "fixos")       this._renderFixos(body);
  }

  // ─── ABA RESUMO ───────────────────────────────────────────────────────────
  _renderResumo(body, { totalDeprMensal: totalDepr, totalCustoFixo: totalFixo, totalMensal, totalHora }) {
    const porCat = {};
    this.#svc._cache.custos.filter(c => c.ativo !== false).forEach(c => {
      const cat = c.categoria || "Outros";
      porCat[cat] = (porCat[cat] || 0) + Number(c.valor_mensal || 0);
    });
    const catEntries = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    const maxCat     = Math.max(...catEntries.map(e => e[1]), 1);
    const topEquip   = [...this.#svc._cache.equipamentos]
      .sort((a, b) => this.#svc.calcDeprMensal(b) - this.#svc.calcDeprMensal(a))
      .slice(0, 5);

    body.innerHTML = `
      <div class="resumo-grid">
        <div class="res-card">
          <div class="res-card-title">📊 Composição do custo mensal</div>
          <div class="composicao-bars">
            <div class="comp-row">
              <span class="comp-label">Depreciação</span>
              <div class="comp-bar-wrap"><div class="comp-bar" style="width:${totalMensal > 0 ? (totalDepr/totalMensal*100).toFixed(1) : 0}%;background:var(--warning)"></div></div>
              <span class="comp-val">${fmtBRL(totalDepr)}</span>
            </div>
            <div class="comp-row">
              <span class="comp-label">Custos fixos</span>
              <div class="comp-bar-wrap"><div class="comp-bar" style="width:${totalMensal > 0 ? (totalFixo/totalMensal*100).toFixed(1) : 0}%;background:var(--error)"></div></div>
              <span class="comp-val">${fmtBRL(totalFixo)}</span>
            </div>
          </div>
          <div class="comp-total"><span>Total mensal</span><strong>${fmtBRL(totalMensal)}</strong></div>
          <div class="periodos-grid">
            ${[["Por dia", totalMensal/30], ["Por hora", totalHora], ["Por mês", totalMensal], ["Por ano", totalMensal*12]]
              .map(([label, val]) => `<div class="periodo-item"><div class="periodo-label">${label}</div><div class="periodo-val">${fmtBRL(val)}</div></div>`)
              .join("")}
          </div>
        </div>
        <div class="res-card">
          <div class="res-card-title">💳 Custos fixos por categoria</div>
          ${catEntries.length === 0
            ? `<div class="res-vazio">Nenhum custo fixo cadastrado ainda.</div>`
            : catEntries.map(([cat, val]) => `
              <div class="comp-row">
                <span class="comp-label">${cat}</span>
                <div class="comp-bar-wrap"><div class="comp-bar" style="width:${(val/maxCat*100).toFixed(1)}%;background:var(--error)"></div></div>
                <span class="comp-val">${fmtBRL(val)}</span>
              </div>`).join("")}
        </div>
      </div>

      ${topEquip.length > 0 ? `
      <div class="res-card" style="margin-top:14px">
        <div class="res-card-title">🔧 Maiores depreciações mensais</div>
        <table class="gc-table">
          <thead><tr>
            <th>Equipamento</th><th style="text-align:right">Valor</th>
            <th style="text-align:center">Vida útil</th><th style="text-align:right">Depr./mês</th>
            <th style="text-align:right">Depr./hora</th><th style="text-align:center">Progresso</th>
          </tr></thead>
          <tbody>
            ${topEquip.map(e => {
              const deprMes  = this.#svc.calcDeprMensal(e);
              const deprHora = deprMes / 30 / 8;
              const meses    = this.#svc.calcMesesUsados(e);
              const vida     = Number(e.vida_util_anos || 1) * 12;
              const pct      = Math.min((meses / vida) * 100, 100);
              const status   = pct >= 100 ? "depreciado" : pct > 70 ? "critico" : "ok";
              return `<tr>
                <td><strong>${esc(e.nome)}</strong></td>
                <td style="text-align:right">${fmtBRL(e.valor||0)}</td>
                <td style="text-align:center">${e.vida_util_anos} ano${e.vida_util_anos != 1 ? "s" : ""}</td>
                <td style="text-align:right;font-weight:700;color:var(--warning)">${fmtBRL(deprMes)}</td>
                <td style="text-align:right;color:var(--muted);font-size:12px">${fmtBRL4(deprHora)}</td>
                <td style="text-align:center">
                  <div class="prog-wrap"><div class="prog-bar ${status}" style="width:${pct.toFixed(0)}%"></div></div>
                  <div style="font-size:10px;color:var(--muted);margin-top:2px">${pct.toFixed(0)}%</div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>` : ""}

      <div class="integracao-card" style="margin-top:14px">
        <div class="integracao-icon">⚙️</div>
        <div style="flex:1">
          <div class="integracao-titulo">Repasse de Custo Operacional para Orçamentos</div>
          <div class="integracao-desc" style="margin-bottom:12px">
            Define o percentual dos custos operacionais acrescentado no subtotal de impressão (m²) em todos os orçamentos.
            Custo por hora atual: <strong style="color:var(--info)">${fmtBRL4(totalHora)}</strong>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
            <label style="font-size:12px;color:var(--muted)">Percentual de acréscimo nos orçamentos</label>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
            <div class="input-suffix-wrap" style="width:140px">
              <input id="custo-op-pct" type="number" min="0" max="100" step="0.1"
                value="${this.#svc._cache.custoOpPct}" placeholder="0" />
              <span>%</span>
            </div>
            <button class="btn-primary" id="btn-salvar-pct"><i class="fi fi-rr-disk"></i> Salvar</button>
          </div>
          <div id="custo-op-exemplos" style="margin-top:8px">
            ${this._renderExemplosCustoOp(this.#svc._cache.custoOpPct)}
          </div>
        </div>
      </div>
    `;

    body.querySelector("#custo-op-pct")?.addEventListener("input", e => {
      const el = body.querySelector("#custo-op-exemplos");
      if (el) el.innerHTML = this._renderExemplosCustoOp(parseFloat(e.target.value) || 0);
    });
    body.querySelector("#btn-salvar-pct")?.addEventListener("click", async () => {
      const pct = parseFloat(body.querySelector("#custo-op-pct").value) || 0;
      await this.#svc.salvarCustoOpPct(pct);
      this._toast(`✅ Percentual de ${pct}% salvo!`);
      this._render();
    });
  }

  _renderExemplosCustoOp(pct) {
    if (!pct || pct <= 0) return `<span style="color:var(--muted);font-size:12px">Nenhum acréscimo será aplicado.</span>`;
    return `<div style="font-size:11px;color:var(--muted);margin-top:4px">Exemplos com ${pct}%:
      ${[50,100,200].map(v => {
        const acr = v * (pct / 100);
        return `<span class="custo-op-ex">R$&nbsp;${v},00 → <strong>${fmtBRL(v + acr)}</strong></span>`;
      }).join("")}
    </div>`;
  }

  // ─── ABA DEPRECIAÇÃO ──────────────────────────────────────────────────────
  _renderDepreciacao(body) {
    body.innerHTML = `
      <div class="gc-section-header">
        <div class="gc-section-title">🔧 Equipamentos e Depreciação</div>
        <button class="btn-primary" id="btn-novo-equip">+ Novo Equipamento</button>
      </div>
      <div class="gc-hint">
        Depreciação mensal calculada pelo método linear: <strong>Valor ÷ (Vida útil em anos × 12)</strong>
      </div>
      ${this.#svc._cache.equipamentos.length === 0
        ? `<div class="gc-vazio">Nenhum equipamento cadastrado ainda. Adicione suas impressoras, plotters, computadores...</div>`
        : `<div class="equip-grid">
            ${this.#svc._cache.equipamentos.map(e => {
              const deprMes  = this.#svc.calcDeprMensal(e);
              const deprDia  = deprMes / 30;
              const deprAno  = deprMes * 12;
              const deprHora = deprDia / 8;
              const meses    = this.#svc.calcMesesUsados(e);
              const vida     = Number(e.vida_util_anos || 1) * 12;
              const pct      = Math.min((meses / vida) * 100, 100);
              const status   = pct >= 100 ? "depreciado" : pct > 70 ? "critico" : "ok";
              const statusLabel = pct >= 100 ? "Depreciado" : pct > 70 ? "Crítico" : "Em uso";
              const residual = Math.max(Number(e.valor||0) - (deprMes * meses), 0);
              return `
                <div class="equip-card ${status}">
                  <div class="equip-card-header">
                    <div>
                      <div class="equip-nome">${esc(e.nome)}</div>
                      ${e.categoria ? `<div class="equip-cat">${esc(e.categoria)}</div>` : ""}
                    </div>
                    <span class="equip-status ${status}">${statusLabel}</span>
                  </div>
                  <div class="equip-valores">
                    <div class="equip-val-item"><span>Valor de compra</span><strong>${fmtBRL(e.valor||0)}</strong></div>
                    <div class="equip-val-item"><span>Vida útil</span><strong>${e.vida_util_anos} ano${e.vida_util_anos != 1 ? "s" : ""}</strong></div>
                    <div class="equip-val-item"><span>Valor residual</span><strong style="color:var(--muted)">${fmtBRL(residual)}</strong></div>
                  </div>
                  <div class="equip-depr-destaque">
                    <div><div class="depr-label">Depreciação mensal</div><div class="depr-valor">${fmtBRL(deprMes)}</div></div>
                    <div style="text-align:right"><div class="depr-label">Por hora (8h)</div><div class="depr-valor" style="font-size:14px;color:var(--info)">${fmtBRL4(deprHora)}</div></div>
                  </div>
                  <div class="equip-secundarios">
                    <span>Diária: ${fmtBRL4(deprDia)}</span>
                    <span>Anual: ${fmtBRL(deprAno)}</span>
                  </div>
                  <div class="equip-prog-label">
                    <span>Depreciação acumulada</span>
                    <span>${pct.toFixed(0)}% · ${meses}/${vida} meses</span>
                  </div>
                  <div class="prog-wrap"><div class="prog-bar ${status}" style="width:${pct.toFixed(0)}%"></div></div>
                  ${e.data_aquisicao ? `<div class="equip-data">Adquirido em: ${fmtData(e.data_aquisicao)}</div>` : ""}
                  ${e.observacoes    ? `<div class="equip-obs">${esc(e.observacoes)}</div>` : ""}
                  <div class="equip-acoes">
                    <button class="btn-icon" data-edit-equip="${e.id}">✏️ Editar</button>
                    <button class="btn-icon danger" data-del-equip="${e.id}" data-del-nome="${esc(e.nome)}">🗑</button>
                  </div>
                </div>`;
            }).join("")}
           </div>
           <div class="gc-total-bar">
             <span>Total de depreciação mensal:</span>
             <strong>${fmtBRL(this.#svc._cache.equipamentos.reduce((s, e) => s + this.#svc.calcDeprMensal(e), 0))}</strong>
           </div>`}
    `;

    body.querySelector("#btn-novo-equip").addEventListener("click", () => this._modalEquip(null));
    body.querySelectorAll("[data-edit-equip]").forEach(btn => {
      const equip = this.#svc._cache.equipamentos.find(e => e.id === btn.dataset.editEquip);
      btn.addEventListener("click", () => this._modalEquip(equip));
    });
    body.querySelectorAll("[data-del-equip]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm(`Remover "${btn.dataset.delNome}"?`)) return;
        await this.#svc.deletarEquipamento(btn.dataset.delEquip);
        this._render();
        this._toast("✅ Equipamento removido.");
      })
    );
  }

  // ─── ABA CUSTOS FIXOS ─────────────────────────────────────────────────────
  _renderFixos(body) {
    const ativos   = this.#svc._cache.custos.filter(c => c.ativo !== false);
    const inativos = this.#svc._cache.custos.filter(c => c.ativo === false);
    const total    = ativos.reduce((s, c) => s + Number(c.valor_mensal || 0), 0);

    body.innerHTML = `
      <div class="gc-section-header">
        <div class="gc-section-title">💳 Custos Fixos Mensais</div>
        <button class="btn-primary" id="btn-novo-custo">+ Novo Custo</button>
      </div>
      <div class="gc-hint">Cadastre todos os custos mensais fixos: aluguel, energia, água, internet, sistemas, etc.</div>
      ${this.#svc._cache.custos.length === 0
        ? `<div class="gc-vazio">Nenhum custo fixo cadastrado. Adicione seus custos mensais.</div>`
        : `<div style="overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border)">
            <table class="gc-table">
              <thead><tr>
                <th>Nome</th><th>Categoria</th>
                <th style="text-align:right">Valor/mês</th><th style="text-align:right">Valor/dia</th>
                <th style="text-align:right">Valor/hora</th><th style="text-align:center">Status</th><th></th>
              </tr></thead>
              <tbody>
                ${this.#svc._cache.custos.map(c => {
                  const dia  = Number(c.valor_mensal||0) / 30;
                  const hora = dia / 8;
                  const ativo = c.ativo !== false;
                  return `
                    <tr class="${ativo ? "" : "row-inativo"}">
                      <td><strong>${esc(c.nome)}</strong>${c.observacoes ? `<div style="font-size:11px;color:var(--muted)">${esc(c.observacoes)}</div>` : ""}</td>
                      <td style="font-size:12px;color:var(--muted)">${esc(c.categoria)||"—"}</td>
                      <td style="text-align:right;font-weight:700;color:${ativo ? "var(--error)" : "var(--muted)"}">${fmtBRL(c.valor_mensal||0)}</td>
                      <td style="text-align:right;font-size:12px;color:var(--muted)">${fmtBRL4(dia)}</td>
                      <td style="text-align:right;font-size:12px;color:var(--muted)">${fmtBRL4(hora)}</td>
                      <td style="text-align:center"><span class="tag-status ${ativo ? "ativo" : "inativo"}">${ativo ? "● Ativo" : "○ Inativo"}</span></td>
                      <td>
                        <div style="display:flex;gap:4px;justify-content:flex-end">
                          <button class="btn-icon" data-edit-custo="${c.id}">✏️</button>
                          <button class="btn-icon danger" data-del-custo="${c.id}" data-del-nome="${esc(c.nome)}">🗑</button>
                        </div>
                      </td>
                    </tr>`;
                }).join("")}
              </tbody>
            </table>
           </div>
           <div class="gc-total-bar">
             <span>Total de custos fixos ativos/mês:</span>
             <strong style="color:var(--error)">${fmtBRL(total)}</strong>
             ${inativos.length > 0 ? `<span style="font-size:12px;color:var(--muted);margin-left:12px">(${inativos.length} inativo${inativos.length > 1 ? "s" : ""})</span>` : ""}
           </div>`}
    `;

    body.querySelector("#btn-novo-custo").addEventListener("click",   () => this._modalCusto(null));
    body.querySelectorAll("[data-edit-custo]").forEach(btn => {
      const custo = this.#svc._cache.custos.find(c => c.id === btn.dataset.editCusto);
      btn.addEventListener("click", () => this._modalCusto(custo));
    });
    body.querySelectorAll("[data-del-custo]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm(`Remover "${btn.dataset.delNome}"?`)) return;
        await this.#svc.deletarCusto(btn.dataset.delCusto);
        this._render();
        this._toast("✅ Custo removido.");
      })
    );
  }

  // ─── Modal Equipamento ────────────────────────────────────────────────────
  _modalEquip(edit = null) {
    const area     = this._container.querySelector("#modal-area");
    const editando = !!edit?.id;
    area.innerHTML = `
      <div class="modal-bg" id="modal-bg">
        <div class="modal" style="max-width:540px">
          <h3>${editando ? "Editar" : "Novo"} Equipamento</h3>
          <div class="modal-grid">
            <div class="modal-field full"><label>Nome *</label><input id="e-nome" value="${esc(edit?.nome||"")}" placeholder="Ex: Impressora HP Latex 570" autofocus /></div>
            <div class="modal-field"><label>Categoria</label>
              <select id="e-cat">
                <option value="">Selecionar...</option>
                ${["Impressora","Plotter de Recorte","Computador","Monitor","Acabamento","Veículo","Outros"].map(c =>
                  `<option value="${c}" ${edit?.categoria === c ? "selected" : ""}>${c}</option>`
                ).join("")}
              </select>
            </div>
            <div class="modal-field"><label>Data de aquisição</label><input id="e-data" type="date" value="${edit?.data_aquisicao||""}" /></div>
            <div class="modal-field">
              <label>Valor de compra (R$) *</label>
              <div class="input-prefix-wrap"><span>R$</span><input id="e-valor" type="number" min="0" step="0.01" value="${edit?.valor||""}" placeholder="0,00" /></div>
            </div>
            <div class="modal-field">
              <label>Vida útil (anos) *</label>
              <div class="input-suffix-wrap"><input id="e-vida" type="number" min="1" max="30" step="1" value="${edit?.vida_util_anos||5}" /><span>anos</span></div>
            </div>
            <div class="modal-field full"><label>Observações</label><textarea id="e-obs" rows="2" placeholder="Número de série, modelo, etc.">${esc(edit?.observacoes||"")}</textarea></div>
          </div>
          <div id="depr-preview-area"></div>
          <div class="modal-btns">
            <button class="btn-secondary" id="e-cancel">Cancelar</button>
            <button class="btn-primary"   id="e-ok"><i class="fi fi-rr-disk"></i> ${editando ? "Salvar" : "Criar"}</button>
          </div>
        </div>
      </div>`;

    const updatePreview = () => {
      const valor = parseFloat(area.querySelector("#e-valor")?.value) || 0;
      const vida  = parseFloat(area.querySelector("#e-vida")?.value)  || 1;
      if (!valor) { area.querySelector("#depr-preview-area").innerHTML = ""; return; }
      const mes  = valor / (vida * 12);
      const hora = mes / 30 / 8;
      area.querySelector("#depr-preview-area").innerHTML = `
        <div class="depr-preview">
          <div class="depr-preview-title">📊 Prévia da depreciação</div>
          <div class="depr-prev-grid">
            <div><span>Por mês</span><strong>${fmtBRL(mes)}</strong></div>
            <div><span>Por hora (8h)</span><strong>${fmtBRL4(hora)}</strong></div>
            <div><span>Por dia</span><strong>${fmtBRL(mes/30)}</strong></div>
            <div><span>Por ano</span><strong>${fmtBRL(mes*12)}</strong></div>
          </div>
        </div>`;
    };
    area.querySelector("#e-valor").addEventListener("input", updatePreview);
    area.querySelector("#e-vida").addEventListener("input",  updatePreview);
    if (edit?.valor) updatePreview();

    area.querySelector("#e-cancel").addEventListener("click", () => area.innerHTML = "");
    area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });
    area.querySelector("#e-ok").addEventListener("click", async () => {
      const payload = {
        nome:           area.querySelector("#e-nome").value,
        categoria:      area.querySelector("#e-cat").value,
        valor:          area.querySelector("#e-valor").value,
        vida_util_anos: area.querySelector("#e-vida").value,
        data_aquisicao: area.querySelector("#e-data").value,
        observacoes:    area.querySelector("#e-obs").value,
      };
      if (!payload.nome?.trim()) { flashInput(area.querySelector("#e-nome")); return; }
      if (!payload.valor)        { flashInput(area.querySelector("#e-valor")); return; }
      try {
        editando
          ? await this.#svc.atualizarEquipamento(edit.id, payload)
          : await this.#svc.criarEquipamento(payload);
        area.innerHTML = "";
        this._render();
        this._toast(`✅ Equipamento ${editando ? "atualizado" : "cadastrado"}!`);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ─── Modal Custo Fixo ─────────────────────────────────────────────────────
  _modalCusto(edit = null) {
    const area     = this._container.querySelector("#modal-area");
    const editando = !!edit?.id;
    area.innerHTML = `
      <div class="modal-bg" id="modal-bg">
        <div class="modal" style="max-width:480px">
          <h3>${editando ? "Editar" : "Novo"} Custo Fixo</h3>
          <label>Nome *</label>
          <input id="c-nome" value="${esc(edit?.nome||"")}" placeholder="Ex: Aluguel, Energia Elétrica..." autofocus />
          <label>Categoria</label>
          <select id="c-cat">
            ${this.#svc.CATEGORIAS.map(cat =>
              `<option value="${cat}" ${edit?.categoria === cat ? "selected" : ""}>${cat}</option>`
            ).join("")}
          </select>
          <label>Valor mensal (R$) *</label>
          <div class="input-prefix-wrap"><span>R$</span><input id="c-valor" type="number" min="0" step="0.01" value="${edit?.valor_mensal||""}" placeholder="0,00" /></div>
          <label>Status</label>
          <select id="c-ativo">
            <option value="true"  ${edit?.ativo !== false ? "selected" : ""}>● Ativo</option>
            <option value="false" ${edit?.ativo === false ? "selected" : ""}>○ Inativo</option>
          </select>
          <label>Observações</label>
          <textarea id="c-obs" rows="2" placeholder="Detalhes adicionais...">${esc(edit?.observacoes||"")}</textarea>
          <div class="modal-btns">
            <button class="btn-secondary" id="c-cancel">Cancelar</button>
            <button class="btn-primary"   id="c-ok"><i class="fi fi-rr-disk"></i> ${editando ? "Salvar" : "Criar"}</button>
          </div>
        </div>
      </div>`;

    area.querySelector("#c-cancel").addEventListener("click", () => area.innerHTML = "");
    area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });
    area.querySelector("#c-ok").addEventListener("click", async () => {
      const payload = {
        nome:        area.querySelector("#c-nome").value,
        categoria:   area.querySelector("#c-cat").value,
        valor_mensal: area.querySelector("#c-valor").value,
        ativo:       area.querySelector("#c-ativo").value === "true",
        observacoes: area.querySelector("#c-obs").value,
      };
      if (!payload.nome?.trim()) { flashInput(area.querySelector("#c-nome")); return; }
      try {
        editando
          ? await this.#svc.atualizarCusto(edit.id, payload)
          : await this.#svc.criarCusto(payload);
        area.innerHTML = "";
        this._render();
        this._toast(`✅ Custo ${editando ? "atualizado" : "cadastrado"}!`);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  _toast(msg) {
    const t = document.createElement("div");
    t.className = "gc-toast ok";
    t.textContent = msg;
    this._container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────
export async function GestaoCustos(container) {
  const view = new GestaoCustosView(container);
  await view.mount();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function flashInput(el) {
  if (!el) return;
  el.style.borderColor = "var(--error)";
  el.focus();
  setTimeout(() => el.style.borderColor = "", 1500);
}
function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function gcCss() { return `
.gc-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.gc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
@media(max-width:800px){.gc-kpis{grid-template-columns:1fr 1fr}}
.kpi-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px}
.kpi-card.kpi-destaque{border-top:3px solid var(--primary)}
.kpi-label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.kpi-val{font-size:22px;font-weight:800;line-height:1.1;margin:4px 0 2px}
.kpi-sub{font-size:11px;color:var(--muted)}
.gc-abas{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.gc-aba{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:var(--radius-md);border:1px solid var(--border-md);background:transparent;color:var(--muted);cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500;transition:all var(--t)}
.gc-aba:hover{background:var(--panel2);color:var(--text)}
.gc-aba.active{background:var(--primary-bg);border-color:var(--primary-border);color:var(--primary-light);font-weight:700}
.gc-toast{border-radius:10px;padding:10px 16px;font-size:13px;margin-bottom:14px;position:fixed;bottom:80px;left:50%;transform:translateX(-50%);box-shadow:var(--shadow-lg);z-index:999}
.gc-toast.ok{background:rgba(0,172,23,0.12);border:1px solid rgba(0,172,23,0.3);color:var(--info)}
.gc-toast.erro{background:var(--error-bg);border:1px solid var(--error-border);color:var(--error)}
.gc-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.gc-section-title{font-size:16px;font-weight:700}
.gc-hint{font-size:12px;color:var(--muted);background:var(--panel);border-left:3px solid var(--primary);padding:8px 12px;border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:14px}
.gc-vazio{color:var(--muted);font-size:13px;padding:32px;text-align:center;background:var(--panel2);border-radius:var(--radius-lg);border:1px dashed var(--border-md)}
.gc-total-bar{display:flex;align-items:center;justify-content:space-between;background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;margin-top:12px;font-size:13px;color:var(--muted)}
.gc-total-bar strong{font-size:16px;color:var(--text)}
.gc-table{width:100%;border-collapse:collapse;font-size:13px}
.gc-table th{text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:10px 14px;background:var(--panel2);border-bottom:1px solid var(--border)}
.gc-table td{padding:10px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
.gc-table tr:last-child td{border-bottom:none}
.gc-table tr:hover td{background:rgba(0,124,190,0.04)}
.row-inativo td{opacity:.55}
.tag-status{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
.tag-status.ativo{background:rgba(0,172,23,0.12);color:var(--info)}
.tag-status.inativo{background:var(--panel3);color:var(--muted)}
.equip-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.equip-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px}
.equip-card.critico{border-color:rgba(232,160,16,0.4)}
.equip-card.depreciado{border-color:rgba(171,0,0,0.3);background:rgba(171,0,0,0.03)}
.equip-card-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px}
.equip-nome{font-size:15px;font-weight:700}.equip-cat{font-size:11px;color:var(--muted);margin-top:2px}
.equip-status{font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;flex-shrink:0}
.equip-status.ok{background:rgba(0,172,23,0.12);color:var(--info)}
.equip-status.critico{background:var(--warning-bg);color:var(--warning)}
.equip-status.depreciado{background:var(--error-bg);color:var(--error)}
.equip-valores{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px}
.equip-val-item{background:var(--panel);border-radius:var(--radius-sm);padding:6px 10px;font-size:11px}
.equip-val-item span{display:block;color:var(--muted);margin-bottom:2px}
.equip-val-item strong{font-size:13px}
.equip-depr-destaque{display:flex;justify-content:space-between;align-items:center;background:rgba(232,160,16,0.08);border:1px solid rgba(232,160,16,0.2);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:8px}
.depr-label{font-size:11px;color:var(--muted);margin-bottom:2px}
.depr-valor{font-size:18px;font-weight:800;color:var(--warning)}
.equip-secundarios{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:10px}
.equip-prog-label{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px}
.prog-wrap{background:var(--panel);border-radius:99px;height:6px;overflow:hidden;margin-bottom:8px}
.prog-bar{height:100%;border-radius:99px;transition:width .4s}
.prog-bar.ok{background:var(--info)}.prog-bar.critico{background:var(--warning)}.prog-bar.depreciado{background:var(--error)}
.equip-data{font-size:11px;color:var(--muted);margin-top:4px}
.equip-obs{font-size:11px;color:var(--muted);font-style:italic;margin-top:4px}
.equip-acoes{display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.resumo-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:800px){.resumo-grid{grid-template-columns:1fr}}
.res-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px}
.res-card-title{font-size:13px;font-weight:700;margin-bottom:14px}
.res-vazio{color:var(--muted);font-size:13px}
.composicao-bars{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.comp-row{display:flex;align-items:center;gap:8px}
.comp-label{font-size:12px;width:90px;flex-shrink:0;color:var(--muted)}
.comp-bar-wrap{flex:1;height:8px;background:var(--panel);border-radius:99px;overflow:hidden}
.comp-bar{height:100%;border-radius:99px;transition:width .5s}
.comp-val{font-size:12px;font-weight:600;width:90px;text-align:right;white-space:nowrap}
.comp-total{display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px;margin-top:10px;font-size:13px;color:var(--muted)}
.comp-total strong{font-size:16px;color:var(--text)}
.periodos-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.periodo-item{background:var(--panel);border-radius:var(--radius-md);padding:10px 12px}
.periodo-label{font-size:11px;color:var(--muted);margin-bottom:2px}
.periodo-val{font-size:14px;font-weight:700;color:var(--primary-light)}
.integracao-card{display:flex;align-items:flex-start;gap:12px;background:rgba(0,124,190,0.08);border:1px solid var(--primary-border);border-radius:var(--radius-lg);padding:14px 16px}
.integracao-icon{font-size:20px;flex-shrink:0}
.integracao-titulo{font-size:13px;font-weight:700;margin-bottom:4px}
.integracao-desc{font-size:12px;color:var(--muted);line-height:1.6}
.custo-op-ex{display:inline-block;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-sm);padding:3px 8px;margin:3px 4px 0 0;font-size:11px;color:var(--muted)}
.custo-op-ex strong{color:var(--primary-light)}
.modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.modal-field{display:flex;flex-direction:column;gap:5px}
.modal-field.full{grid-column:1/-1}
.modal-field label{font-size:12px;color:var(--muted);font-weight:500}
.modal-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}
.input-prefix-wrap,.input-suffix-wrap{display:flex;align-items:center;background:var(--panel2);border:1px solid var(--border-md);border-radius:var(--radius-md);overflow:hidden;transition:border-color var(--t)}
.input-prefix-wrap:focus-within,.input-suffix-wrap:focus-within{border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,124,190,0.10)}
.input-prefix-wrap span,.input-suffix-wrap span{padding:0 10px;font-size:12px;font-weight:600;color:var(--muted);background:var(--panel3);border-right:1px solid var(--border);display:flex;align-items:center;white-space:nowrap;flex-shrink:0}
.input-suffix-wrap span{border-right:none;border-left:1px solid var(--border)}
.input-prefix-wrap input,.input-suffix-wrap input{border:none;background:transparent;flex:1;padding:9px 10px;font-size:13px;color:var(--text)}
.input-prefix-wrap input:focus,.input-suffix-wrap input:focus{outline:none;box-shadow:none}
.depr-preview{background:rgba(232,160,16,0.08);border:1px solid rgba(232,160,16,0.25);border-radius:var(--radius-md);padding:12px;margin-top:12px}
.depr-preview-title{font-size:11px;font-weight:700;color:var(--warning);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
.depr-prev-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.depr-prev-grid>div{display:flex;flex-direction:column;gap:2px}
.depr-prev-grid span{font-size:11px;color:var(--muted)}
.depr-prev-grid strong{font-size:14px;color:var(--warning)}
.btn-primary{background:var(--primary);color:#fff;border:none;border-radius:var(--radius-md);padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;transition:all var(--t)}
.btn-primary:hover{opacity:.88}
.btn-secondary{background:transparent;border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:8px 16px;cursor:pointer;font-size:13px}
.btn-icon{background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:var(--radius-sm);padding:5px 9px;cursor:pointer;font-size:12px;transition:all var(--t)}
.btn-icon:hover{border-color:var(--primary);color:var(--primary-light)}
.btn-icon.danger:hover{border-color:var(--error-border);color:var(--error)}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:var(--panel);border:1px solid var(--border-md);border-radius:var(--radius-xl);padding:24px;min-width:320px;max-width:540px;width:92%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg)}
.modal h3{font-size:16px;font-weight:700;margin-bottom:16px}
.modal label{display:block;font-size:12px;font-weight:500;color:var(--muted);margin-bottom:5px;margin-top:12px}
.modal label:first-of-type{margin-top:0}
`; }
