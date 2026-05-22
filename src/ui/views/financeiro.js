/**
 * FINANCEIRO VIEW — Gestão financeira com lançamentos, gráfico SVG e fluxo ERP.
 */

import { BaseView }          from "./baseView.js";
import { services }          from "../../core/services.js";
import { selectors, actions } from "../../core/store.js";
import { EventBus, EVENTS }  from "../../core/eventBus.js";
import { esc }               from "../../utils/sanitize.js";
import { fmtBRL, fmtData }   from "../../utils/fmt.js";
import {
  PageHeader, KpiGrid, Tabs, DataTable, Btn, openModal,
} from "../components/index.js";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Mini bar chart SVG para o fluxo ──────────────────────────────────────────
function miniBarChart(dados) {
  const W = 520, H = 140;
  const padL = 52, padB = 26, padT = 12, padR = 12;
  const w = W - padL - padR;
  const h = H - padB - padT;
  const n = dados.length;
  const maxVal = Math.max(...dados.flatMap(d => [d.rec, d.desp]), 1);
  const bw  = Math.floor(w / n / 3.2);
  const gap = w / n;

  const bars = dados.map((d, i) => {
    const x  = padL + i * gap + gap / 2 - bw;
    const hR = (d.rec  / maxVal) * h;
    const hD = (d.desp / maxVal) * h;
    return `
      <rect x="${x}"       y="${padT + h - hR}" width="${bw}" height="${hR}"
            fill="var(--success)" rx="3" opacity="0.85">
        <title>Receita ${d.label}: ${fmtBRL(d.rec)}</title></rect>
      <rect x="${x+bw+2}"  y="${padT + h - hD}" width="${bw}" height="${hD}"
            fill="var(--error)"   rx="3" opacity="0.85">
        <title>Despesa ${d.label}: ${fmtBRL(d.desp)}</title></rect>
      <text x="${x + bw}" y="${H - 6}" text-anchor="middle"
            font-size="10" fill="var(--muted)" font-family="var(--font)">${d.label}</text>`;
  }).join("");

  const gridY = [0, 0.5, 1].map(pct => {
    const y   = padT + h * (1 - pct);
    const val = maxVal * pct;
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
            stroke="var(--border)" stroke-width="1"/>
      <text x="${padL - 6}" y="${y + 4}" text-anchor="end"
            font-size="9" fill="var(--muted)" font-family="var(--font)">${
              fmtBRL(val).replace("R$\u00a0","")}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="overflow:visible">
    ${gridY}${bars}
  </svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW
// ══════════════════════════════════════════════════════════════════════════════
export class FinanceiroView extends BaseView {
  #aba          = "resumo";
  #filtroStatus = "";

  async _init() {
    const mes = selectors.financeiro().mes || mesAtual();
    await services.lancamento.listar(mes);
    this.subscribe("financeiro", () => this.refresh());
    this.listenTo(EVENTS.LANCAMENTO_CRIADO, () => {});
    this.listenTo(EVENTS.LANCAMENTO_PAGO,   () => {});
    this.listenTo(EVENTS.VENDA_CRIADA,      () => services.lancamento.listar(selectors.financeiro().mes));
  }

  render() {
    const state   = selectors.financeiro();
    const mes     = state.mes || mesAtual();
    const lancs   = state.lancamentos || [];
    const resumo  = state.resumo || {};
    const hoje    = new Date().toISOString().split("T")[0];
    const vencidos = lancs.filter(l =>
      l.status === "pendente" && l.data_vencimento && l.data_vencimento < hoje
    );

    return `
      <style>${finCSS()}</style>

      ${PageHeader({
        title: "Financeiro",
        subtitle: "Lançamentos e resumo financeiro",
        actions: `
          <input type="month" id="filtro-mes" value="${mes}" class="month-input" />
          <button class="btn-success" id="btn-nova-rec"><i class="fi fi-rr-trending-up"></i> Receita</button>
          <button class="btn-danger"  id="btn-nova-dep"><i class="fi fi-rr-trending-down"></i> Despesa</button>
        `,
      })}

      ${vencidos.length ? `
      <div class="fin-alert">
        <i class="fi fi-rr-exclamation"></i>
        <strong>${vencidos.length} lançamento${vencidos.length>1?"s":""} vencido${vencidos.length>1?"s":""}</strong>
        — ${vencidos.slice(0,2).map(l=>`${esc(l.descricao)} (${fmtBRL(l.valor)})`).join(", ")}
        ${vencidos.length>2 ? ` e mais ${vencidos.length-2}...` : ""}
      </div>` : ""}

      ${KpiGrid([
        { label: "Receitas do mês",  value: fmtBRL(resumo.receitas||0),  sub: `Recebido: ${fmtBRL(resumo.recebido||0)}`,  color: "var(--success)", icon: "📈" },
        { label: "Despesas do mês",  value: fmtBRL(resumo.despesas||0),  sub: `A pagar: ${fmtBRL(resumo.aPagar||0)}`,     color: "var(--error)",   icon: "📉" },
        { label: "Saldo do mês",     value: fmtBRL(resumo.saldo||0),     sub: `A receber: ${fmtBRL(resumo.aReceber||0)}`, color: (resumo.saldo||0)>=0 ? "var(--success)" : "var(--error)", icon: "💰" },
      ])}

      ${Tabs({ tabs: [
        { key: "resumo",   label: "📊 Resumo"   },
        { key: "receitas", label: "📈 Receitas"  },
        { key: "despesas", label: "📉 Despesas"  },
        { key: "fluxo",    label: "💧 Fluxo"    },
      ], active: this.#aba })}

      <div id="fin-body">${this.#renderAba(lancs, mes, resumo, hoje)}</div>
    `;
  }

  #renderAba(lancs, mes, resumo, hoje) {
    const rec  = lancs.filter(l => l.tipo === "receita");
    const desp = lancs.filter(l => l.tipo === "despesa");
    switch (this.#aba) {
      case "resumo":   return this.#renderResumo(rec, desp, lancs, hoje, resumo);
      case "receitas": return this.#renderTabela(rec, "receita", hoje);
      case "despesas": return this.#renderTabela(desp, "despesa", hoje);
      case "fluxo":    return this.#renderFluxo(mes);
      default:         return "";
    }
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────
  #renderResumo(rec, desp, lancs, hoje, resumo) {
    const porCat = lista => {
      const map = {};
      lista.forEach(l => { const c = l.categoria||"Outros"; map[c] = (map[c]||0) + Number(l.valor); });
      return Object.entries(map).sort((a,b) => b[1]-a[1]);
    };
    const catRec   = porCat(rec);
    const catDesp  = porCat(desp);
    const maxRec   = Math.max(...catRec.map(c=>c[1]),1);
    const maxDesp  = Math.max(...catDesp.map(c=>c[1]),1);

    const barras = (lista, max, cor) => lista.length === 0
      ? `<div class="fin-vazio">Nenhum lançamento.</div>`
      : lista.map(([cat, val]) => `
          <div class="cat-bar-row">
            <span class="cat-bar-lbl">${esc(cat)}</span>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width:${(val/max*100).toFixed(1)}%;background:${cor}"></div>
            </div>
            <span class="cat-bar-val">${fmtBRL(val)}</span>
          </div>`).join("");

    const proximos = lancs
      .filter(l => l.status==="pendente" && l.data_vencimento)
      .sort((a,b) => a.data_vencimento.localeCompare(b.data_vencimento))
      .slice(0, 6);

    return `
      <div class="fin-resumo-grid">
        <div class="fin-card">
          <div class="fin-card-title">📈 Receitas por categoria</div>
          ${barras(catRec, maxRec, "var(--success)")}
        </div>
        <div class="fin-card">
          <div class="fin-card-title">📉 Despesas por categoria</div>
          ${barras(catDesp, maxDesp, "var(--error)")}
        </div>
      </div>
      <div class="fin-card" style="margin-top:14px">
        <div class="fin-card-title">📅 Próximos vencimentos</div>
        ${proximos.length === 0
          ? `<div class="fin-vazio">Nenhum vencimento pendente.</div>`
          : proximos.map(l => {
              const atrasado = l.data_vencimento < hoje;
              return `
                <div class="prox-row">
                  <span class="prox-tipo" style="color:${l.tipo==="receita"?"var(--success)":"var(--error)"}">
                    ${l.tipo==="receita" ? "▲" : "▼"}
                  </span>
                  <span class="prox-desc">${esc(l.descricao)}</span>
                  <span class="prox-data ${atrasado?"atrasado":""}">${fmtData(l.data_vencimento)}</span>
                  <span class="prox-val">${fmtBRL(l.valor)}</span>
                </div>`;
            }).join("")}
      </div>
    `;
  }

  // ─── Tabela ───────────────────────────────────────────────────────────────
  #renderTabela(lista, tipo, hoje) {
    const filtrados = this.#filtroStatus
      ? lista.filter(l => l.status === this.#filtroStatus)
      : lista;

    const statusCfg = {
      pendente:  { cor: "#F79009", label: "⏳ Pendente"  },
      pago:      { cor: "var(--success)", label: "✅ Pago" },
      cancelado: { cor: "var(--muted)",   label: "❌ Cancelado" },
    };

    return `
      <div class="tab-filter-row">
        ${["","pendente","pago","cancelado"].map(s => `
          <button class="tab-btn ${this.#filtroStatus===s?"active":""}" data-fs="${s}">
            ${s===""?"Todos":statusCfg[s]?.label||s}
            <span class="tab-count">${s===""?lista.length:lista.filter(l=>l.status===s).length}</span>
          </button>`).join("")}
      </div>

      ${DataTable({
        columns: [
          { label: "Descrição"  },
          { label: "Categoria", style: "width:120px" },
          { label: "Vencimento",style: "width:110px" },
          { label: "Valor",     style: "text-align:right;width:130px" },
          { label: "Status",    style: "width:130px" },
          { label: "",          style: "width:130px" },
        ],
        rows: filtrados.length === 0 ? [] : filtrados.map(l => {
          const atrasado = l.status==="pendente" && l.data_vencimento && l.data_vencimento < hoje;
          const stCfg    = statusCfg[l.status] || { cor: "var(--muted)", label: l.status };
          return `
            <tr class="${atrasado?"row-atrasado":""}">
              <td>
                <div class="lanc-desc">${esc(l.descricao)}</div>
                ${l.cliente_nome ? `<div class="lanc-sub">${esc(l.cliente_nome)}</div>` : ""}
                ${l.grupo_recorrencia ? `<div class="lanc-rec">🔁 Parcela ${l.parcela_num||""}${l.total_parcelas?"/"+l.total_parcelas:""}</div>` : ""}
              </td>
              <td class="lanc-cat">${esc(l.categoria)||"—"}</td>
              <td class="${atrasado?"data-atrasada":"data-normal"}">${l.data_vencimento?fmtData(l.data_vencimento):"—"}</td>
              <td style="text-align:right;font-weight:700;color:${tipo==="receita"?"var(--success)":"var(--error)"}">${fmtBRL(l.valor)}</td>
              <td>
                <span class="lanc-status" style="--sc:${stCfg.cor}">${stCfg.label}</span>
              </td>
              <td>
                <div class="lanc-actions">
                  ${l.status==="pendente" ? `
                    <button class="btn-icon" data-pagar="${l.id}" style="color:var(--success);border-color:var(--success-border);font-size:11px;padding:3px 8px">
                      ✔ Baixar
                    </button>` : ""}
                  <button class="btn-icon" data-edit-lanc="${l.id}" style="padding:3px 7px;font-size:11px">✏️</button>
                  <button class="btn-icon danger" data-del-lanc="${l.id}" ${l.grupo_recorrencia?`data-grupo="${l.grupo_recorrencia}"`:""}
                    style="padding:3px 7px;font-size:11px">🗑</button>
                </div>
              </td>
            </tr>`;
        }),
        emptyMessage: `Nenhum lançamento de ${tipo==="receita"?"receita":"despesa"}.`,
      })}`;
  }

  // ─── Fluxo ────────────────────────────────────────────────────────────────
  #renderFluxo(mes) {
    const meses = [];
    const [ano, m] = mes.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      let mo = m - i, y = ano;
      while (mo <= 0) { mo += 12; y--; }
      meses.push(`${y}-${String(mo).padStart(2,"0")}`);
    }
    const lancs = selectors.financeiro().lancamentos || [];
    const nomeMes = m => {
      const [y, mo] = m.split("-");
      return new Date(y, mo-1).toLocaleDateString("pt-BR", { month: "short" }).replace(".","");
    };
    const dados = meses.map(m => {
      const doMes = lancs.filter(l => {
        const ref = l.data_vencimento || l.created_at?.slice(0,10);
        return ref?.startsWith(m);
      });
      const rec  = doMes.filter(l=>l.tipo==="receita").reduce((s,l)=>s+Number(l.valor),0);
      const desp = doMes.filter(l=>l.tipo==="despesa").reduce((s,l)=>s+Number(l.valor),0);
      return { label: nomeMes(m), mes: m, rec, desp, saldo: rec-desp };
    });

    return `
      <div class="fin-card" style="margin-bottom:14px">
        <div class="fin-card-title" style="display:flex;justify-content:space-between">
          <span>💧 Fluxo — últimos 6 meses</span>
          <div style="display:flex;gap:10px">
            <span class="leg-item"><span class="leg-dot" style="background:var(--success)"></span>Receita</span>
            <span class="leg-item"><span class="leg-dot" style="background:var(--error)"></span>Despesa</span>
          </div>
        </div>
        <div class="chart-wrap">${miniBarChart(dados)}</div>
      </div>

      ${DataTable({
        columns: [
          { label: "Mês" },
          { label: "Receitas",  style: "text-align:right" },
          { label: "Despesas",  style: "text-align:right" },
          { label: "Saldo",     style: "text-align:right" },
        ],
        rows: dados.map(d => `
          <tr>
            <td style="font-weight:600">${d.label} ${d.mes === mes ? `<span class="badge-atual">atual</span>` : ""}</td>
            <td style="text-align:right;color:var(--success);font-weight:600">${fmtBRL(d.rec)}</td>
            <td style="text-align:right;color:var(--error);font-weight:600">${fmtBRL(d.desp)}</td>
            <td style="text-align:right;font-weight:700;color:${d.saldo>=0?"var(--success)":"var(--error)"}">
              ${d.saldo>=0?"+":""}${fmtBRL(d.saldo)}
            </td>
          </tr>`),
      })}`;
  }

  afterRender() {
    this.$("#filtro-mes")?.addEventListener("change", async e => {
      actions.setMesFinanceiro(e.target.value);
      await services.lancamento.listar(e.target.value);
    });

    this.$("#btn-nova-rec")?.addEventListener("click", () => this.#abrirModal("receita"));
    this.$("#btn-nova-dep")?.addEventListener("click", () => this.#abrirModal("despesa"));

    // Tabs principais
    this.$$(".tabs .tab-btn").forEach(btn => {
      if (btn.dataset.tab) btn.addEventListener("click", () => { this.#aba = btn.dataset.tab; this.refresh(); });
    });
    // Filtro status
    this.$$("[data-fs]").forEach(btn =>
      btn.addEventListener("click", () => { this.#filtroStatus = btn.dataset.fs; this.refresh(); })
    );
    // Baixar
    this.$$("[data-pagar]").forEach(btn =>
      btn.addEventListener("click", async () => {
        try { await services.lancamento.marcarPago(btn.dataset.pagar); }
        catch (e) { this.toast(e.message, "erro"); }
      })
    );
    // Editar
    this.$$("[data-edit-lanc]").forEach(btn =>
      btn.addEventListener("click", () => {
        const l = (selectors.financeiro().lancamentos||[]).find(x => x.id === btn.dataset.editLanc);
        if (l) this.#abrirModal(l.tipo, l);
      })
    );
    // Deletar
    this.$$("[data-del-lanc]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const grupo = btn.dataset.grupo;
        if (grupo) {
          const del = confirm("Deletar TODOS os futuros desta série? (Cancelar = só este)");
          if (del === null) return;
          await services.lancamento.deletar(btn.dataset.delLanc, del);
        } else {
          if (!confirm("Deletar este lançamento?")) return;
          await services.lancamento.deletar(btn.dataset.delLanc);
        }
      })
    );
  }

  #abrirModal(tipo, dados = {}) {
    const cats = tipo === "receita"
      ? ["Venda","Serviço","Investimento","Outros"]
      : ["Fornecedor","Aluguel","Salário","Material","Imposto","Energia","Outros"];
    const cor     = tipo === "receita" ? "var(--success)" : "var(--error)";
    const editando = !!dados.id;

    const modalRef = openModal({
      title: `<span style="color:${cor}">${editando?"Editar":"Novo"} ${tipo==="receita"?"📈 Receita":"📉 Despesa"}</span>`,
      maxWidth: "460px",
      body: `
        <div class="form-field"><label>Descrição *</label>
          <input id="m-desc" value="${esc(dados.descricao||"")}" placeholder="Ex: Aluguel, Venda..." autofocus />
        </div>
        <div class="form-field" style="margin-top:10px"><label>Valor (R$) *</label>
          <div class="val-input-wrap">
            <span>R$</span>
            <input id="m-valor" type="number" min="0.01" step="0.01" value="${dados.valor||""}" placeholder="0,00" />
          </div>
        </div>
        <div class="form-grid" style="margin-top:10px">
          <div class="form-field"><label>Categoria</label>
            <select id="m-cat">${cats.map(c=>`<option value="${c}" ${dados.categoria===c?"selected":""}>${c}</option>`).join("")}</select>
          </div>
          <div class="form-field"><label>Vencimento</label>
            <input id="m-venc" type="date" value="${dados.data_vencimento||""}" />
          </div>
          <div class="form-field"><label>Status</label>
            <select id="m-status">
              <option value="pendente" ${(!dados.status||dados.status==="pendente")?"selected":""}>⏳ Pendente</option>
              <option value="pago"     ${dados.status==="pago"?"selected":""}>✅ Pago</option>
            </select>
          </div>
          <div class="form-field"><label>Cliente / Fornecedor</label>
            <input id="m-cli" value="${esc(dados.cliente_nome||"")}" placeholder="Nome (opcional)" />
          </div>
        </div>
        ${!editando ? `
        <div class="recorrente-box">
          <label class="recorrente-label">
            <input type="checkbox" id="m-recorrente" />
            <span>🔁 Lançamento recorrente</span>
          </label>
          <div id="rec-opts" style="display:none;margin-top:10px">
            <div class="form-field"><label>Quantidade de parcelas</label>
              <input id="m-parcelas" type="number" min="2" max="360" value="12" />
            </div>
          </div>
        </div>` : ""}`,
      actions: `
        ${Btn.secondary("Cancelar", "m-cancel")}
        <button class="btn-primary" id="m-ok" style="background:${cor};border-color:${cor}">
          <i class="fi fi-rr-disk"></i> Salvar
        </button>`,
    });

    document.getElementById("m-recorrente")?.addEventListener("change", function() {
      document.getElementById("rec-opts").style.display = this.checked ? "block" : "none";
    });
    document.getElementById("m-cancel")?.addEventListener("click", () => modalRef.close());
    document.getElementById("m-ok")?.addEventListener("click", async () => {
      const desc  = document.getElementById("m-desc")?.value.trim();
      const valor = parseFloat(document.getElementById("m-valor")?.value);
      if (!desc)        { this.toast("Informe a descrição.", "warn"); return; }
      if (!valor||valor<=0) { this.toast("Informe um valor válido.", "warn"); return; }
      const payload = {
        tipo,
        descricao:       desc,
        valor,
        categoria:       document.getElementById("m-cat")?.value,
        data_vencimento: document.getElementById("m-venc")?.value || null,
        status:          document.getElementById("m-status")?.value,
        cliente_nome:    document.getElementById("m-cli")?.value.trim() || null,
        isRecorrente:    document.getElementById("m-recorrente")?.checked || false,
        qtdParcelas:     document.getElementById("m-parcelas")?.value || 12,
        tipoParc:        "fixo",
      };
      try {
        if (editando) await services.lancamento.atualizar(dados.id, payload);
        else          await services.lancamento.criar(payload);
        modalRef.close();
      } catch (e) { this.toast(e.message, "erro"); }
    });
  }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function finCSS() { return `
.month-input{background:var(--panel2);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:7px 12px;font-size:13px;font-family:var(--font)}
.month-input:focus{outline:none;border-color:var(--primary)}
.fin-alert{background:var(--error-bg);border:1px solid var(--error-border);border-radius:var(--radius-md);padding:10px 16px;font-size:13px;color:var(--error);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.btn-success{display:inline-flex;align-items:center;gap:6px;background:var(--success);color:#fff;border:none;border-radius:var(--radius-md);padding:8px 14px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all var(--t)}
.btn-success:hover{opacity:.88}
.fin-resumo-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:700px){.fin-resumo-grid{grid-template-columns:1fr}}
.fin-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:4px}
.fin-card-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:14px}
.fin-vazio{color:var(--muted);font-size:13px;padding:12px 0;text-align:center}
.cat-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px}
.cat-bar-lbl{width:110px;flex-shrink:0;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cat-bar-track{flex:1;height:8px;background:var(--panel3);border-radius:99px;overflow:hidden}
.cat-bar-fill{height:100%;border-radius:99px;transition:width .5s}
.cat-bar-val{font-weight:600;min-width:90px;text-align:right;white-space:nowrap}
.prox-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:.5px solid var(--border)}
.prox-row:last-child{border-bottom:none}
.prox-tipo{font-size:14px;font-weight:700;flex-shrink:0}
.prox-desc{flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prox-data{font-size:12px;color:var(--muted);white-space:nowrap}
.prox-data.atrasado{color:var(--error);font-weight:700}
.prox-val{font-weight:700;white-space:nowrap}
.tab-filter-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.lanc-desc{font-weight:600;font-size:13px}
.lanc-sub,.lanc-rec{font-size:11px;color:var(--muted);margin-top:2px}
.lanc-rec{color:#a78bfa}
.lanc-cat{font-size:12px;color:var(--muted)}
.data-normal{font-size:12px}
.data-atrasada{font-size:12px;color:var(--error);font-weight:700}
.row-atrasado td{background:rgba(229,57,53,0.04)}
.lanc-status{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:color-mix(in srgb,var(--sc) 15%,transparent);color:var(--sc);border:1px solid color-mix(in srgb,var(--sc) 30%,transparent)}
.lanc-actions{display:flex;gap:4px;flex-wrap:wrap}
.chart-wrap{width:100%;overflow-x:auto}
.leg-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)}
.leg-dot{width:10px;height:10px;border-radius:50%}
.badge-atual{font-size:10px;background:var(--primary-bg);color:var(--primary);padding:1px 6px;border-radius:999px;margin-left:4px}
.recorrente-box{background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.2);border-radius:var(--radius-md);padding:12px;margin-top:12px}
.recorrente-label{display:flex;align-items:center;gap:8px;font-size:13px;color:#a78bfa;cursor:pointer;font-weight:600}
.val-input-wrap{display:flex;align-items:center;background:var(--panel2);border:1px solid var(--border-md);border-radius:var(--radius-md);overflow:hidden;transition:border-color var(--t)}
.val-input-wrap:focus-within{border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,196,154,.12)}
.val-input-wrap span{padding:0 10px;font-size:12px;font-weight:600;color:var(--muted);background:var(--panel3);border-right:1px solid var(--border);display:flex;align-items:center;flex-shrink:0}
.val-input-wrap input{border:none;background:transparent;flex:1;padding:9px 10px;font-size:13px;color:var(--text)}
.val-input-wrap input:focus{outline:none;box-shadow:none}
`; }
