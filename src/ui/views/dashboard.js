/**
 * DASHBOARD VIEW — Painel principal com gráficos SVG nativos,
 * tendência de 6 meses e dados agregados em tempo real.
 */

import { BaseView } from "./baseView.js";
import { services } from "../../core/services.js";
import { selectors, actions } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import { esc } from "../../utils/sanitize.js";
import { fmtBRL, fmtData } from "../../utils/fmt.js";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nomeMes(m) {
  const [y, mo] = m.split("-");
  return new Date(y, mo - 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

// ─── Gráfico de barras SVG ────────────────────────────────────────────────────
function barChart({ dados, width = 560, height = 160, corA = "#00c49a", corB = "#e53935", labelA = "Receita", labelB = "Despesa" }) {
  const pad = { top: 20, right: 16, bottom: 32, left: 56 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const n = dados.length;
  const barW  = Math.floor(W / n / 3);
  const gap   = Math.floor(W / n);
  const maxVal = Math.max(...dados.flatMap(d => [d.a, d.b]), 1);

  const toY = v => H - (v / maxVal) * H;

  const bars = dados.map((d, i) => {
    const x = pad.left + i * gap + gap / 2 - barW;
    const hA = (d.a / maxVal) * H;
    const hB = (d.b / maxVal) * H;
    return `
      <rect x="${x}" y="${pad.top + toY(d.a)}" width="${barW}" height="${hA}"
            fill="${corA}" rx="3" opacity="0.9">
        <title>${labelA}: ${fmtBRL(d.a)}</title>
      </rect>
      <rect x="${x + barW + 2}" y="${pad.top + toY(d.b)}" width="${barW}" height="${hB}"
            fill="${corB}" rx="3" opacity="0.9">
        <title>${labelB}: ${fmtBRL(d.b)}</title>
      </rect>
      <text x="${x + barW}" y="${height - 8}" text-anchor="middle"
            font-size="10" fill="var(--muted)" font-family="var(--font)">${d.label}</text>
    `;
  }).join("");

  // Linhas de grade
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y = pad.top + H * (1 - pct);
    const val = maxVal * pct;
    return `
      <line x1="${pad.left}" y1="${y}" x2="${pad.left + W}" y2="${y}"
            stroke="var(--border)" stroke-width="1"/>
      <text x="${pad.left - 6}" y="${y + 4}" text-anchor="end"
            font-size="9" fill="var(--muted)" font-family="var(--font)">${fmtBRL(val).replace("R$\u00a0", "")}</text>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet"
         style="overflow:visible">
      ${gridLines}
      ${bars}
    </svg>`;
}

// ─── Gráfico de linha SVG ─────────────────────────────────────────────────────
function lineChart({ dados, width = 560, height = 120, cor = "#00c49a" }) {
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const n = dados.length;
  const maxVal = Math.max(...dados.map(d => d.v), 1);
  const minVal = Math.min(...dados.map(d => d.v), 0);
  const range  = maxVal - minVal || 1;

  const toX = i => pad.left + (i / (n - 1)) * W;
  const toY = v => pad.top + H - ((v - minVal) / range) * H;

  const points = dados.map((d, i) => `${toX(i)},${toY(d.v)}`).join(" ");
  const area   = `${toX(0)},${pad.top + H} ${points} ${toX(n - 1)},${pad.top + H}`;

  const dots = dados.map((d, i) => `
    <circle cx="${toX(i)}" cy="${toY(d.v)}" r="4"
            fill="${cor}" stroke="var(--panel)" stroke-width="2">
      <title>${d.label}: ${fmtBRL(d.v)}</title>
    </circle>
  `).join("");

  const labels = dados.map((d, i) => `
    <text x="${toX(i)}" y="${height - 6}" text-anchor="middle"
          font-size="10" fill="var(--muted)" font-family="var(--font)">${d.label}</text>
  `).join("");

  // Grade Y
  const gridLines = [0, 0.5, 1].map(pct => {
    const y = pad.top + H * (1 - pct);
    const val = minVal + range * pct;
    return `
      <line x1="${pad.left}" y1="${y}" x2="${pad.left + W}" y2="${y}"
            stroke="var(--border)" stroke-width="1"/>
      <text x="${pad.left - 6}" y="${y + 4}" text-anchor="end"
            font-size="9" fill="var(--muted)" font-family="var(--font)">${fmtBRL(val).replace("R$\u00a0","")}</text>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet"
         style="overflow:visible">
      ${gridLines}
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${cor}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${cor}" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#area-grad)"/>
      <polyline points="${points}" fill="none" stroke="${cor}" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${labels}
    </svg>`;
}

// ─── Gráfico de pizza SVG ─────────────────────────────────────────────────────
function donutChart({ fatias, size = 120 }) {
  const r = 42, cx = size / 2, cy = size / 2;
  const inner = r * 0.55;
  const total = fatias.reduce((s, f) => s + f.v, 0) || 1;
  let angle = -Math.PI / 2;

  const arcos = fatias.map(f => {
    const pct   = f.v / total;
    const sweep = pct * 2 * Math.PI;
    const x1    = cx + r * Math.cos(angle);
    const y1    = cy + r * Math.sin(angle);
    angle += sweep;
    const x2    = cx + r * Math.cos(angle);
    const y2    = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return `
      <path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z"
            fill="${f.cor}" opacity="0.9">
        <title>${esc(f.label)}: ${fmtBRL(f.v)}</title>
      </path>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      ${arcos}
      <circle cx="${cx}" cy="${cy}" r="${inner}" fill="var(--panel2)"/>
    </svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW
// ══════════════════════════════════════════════════════════════════════════════
export class DashboardView extends BaseView {
  #mes     = mesAtual();
  #resumo  = null;
  #loading = true;

  async _init() {
    await this.#carregar();
    this.listenTo(EVENTS.VENDA_CRIADA,      () => this.#recarregar());
    this.listenTo(EVENTS.VENDA_ATUALIZADA,  () => this.#recarregar());
    this.listenTo(EVENTS.VENDA_STATUS_MUDOU,() => this.#recarregar());
    this.listenTo(EVENTS.LANCAMENTO_CRIADO, () => this.#recarregar());
    this.listenTo(EVENTS.LANCAMENTO_PAGO,   () => this.#recarregar());
    this.listenTo(EVENTS.ESTOQUE_ENTRADA,   () => this.#recarregar());
    this.listenTo(EVENTS.ESTOQUE_SAIDA,     () => this.#recarregar());
    this.listenTo(EVENTS.PRODUCAO_CONCLUIDA,() => this.#recarregar());
  }

  async #carregar() {
    this.#loading = true;
    try {
      this.#resumo = await services.dashboard.getResumo(this.#mes);
    } catch (e) {
      console.error("[Dashboard] erro:", e);
    } finally {
      this.#loading = false;
      this.refresh();
    }
  }

  async #recarregar() {
    actions.setCache(`dashboard_${this.#mes}`, null);
    await this.#carregar();
  }

  render() {
    if (this.#loading || !this.#resumo) return this._loading("Carregando dashboard...");
    const r   = this.#resumo;
    const fin = r.financeiro;
    const hoje = new Date().toISOString().split("T")[0];
    const vencidos = r.lancamentos.filter(l =>
      l.status === "pendente" && l.data_vencimento && l.data_vencimento < hoje
    );

    return `
      <style>${dashCSS()}</style>

      <!-- Cabeçalho -->
      <div class="dash-header">
        <div>
          <h2 class="dash-title">Dashboard</h2>
          <span class="dash-sub">Visão geral — ${this.#mes.split("-").reverse().join("/")}</span>
        </div>
        <div class="dash-header-actions">
          <input type="month" id="filtro-mes" value="${this.#mes}" class="month-input" />
          <button class="btn-icon" id="btn-refresh" title="Atualizar">
            <i class="fi fi-rr-refresh"></i>
          </button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-row">
        ${this.#kpi("Faturamento",    fmtBRL(r.faturamento),        `${r.vendas.total} venda${r.vendas.total!==1?"s":""}`, "var(--primary-light)", "fi-rr-money-bill-wave")}
        ${this.#kpi("Receitas",       fmtBRL(fin.receitas),         `Recebido: ${fmtBRL(fin.recebido||0)}`, "var(--success)", "fi-rr-trending-up")}
        ${this.#kpi("Despesas",       fmtBRL(fin.despesas),         `A pagar: ${fmtBRL(fin.aPagar||0)}`, "var(--error)", "fi-rr-trending-down")}
        ${this.#kpi("Lucro Líquido",  fmtBRL(fin.lucro),            `Margem: ${fin.margem}%`, fin.lucro>=0?"var(--success)":"var(--error)", fin.lucro>=0?"fi-rr-check-circle":"fi-rr-exclamation")}
      </div>

      ${vencidos.length ? `
      <div class="alert-banner">
        <i class="fi fi-rr-exclamation"></i>
        <strong>${vencidos.length} lançamento${vencidos.length>1?"s":""} vencido${vencidos.length>1?"s":""}</strong>
        — ${vencidos.slice(0,2).map(l=>`${esc(l.descricao)} (${fmtBRL(l.valor)})`).join(", ")}
        ${vencidos.length>2 ? ` e mais ${vencidos.length-2}...` : ""}
      </div>` : ""}

      <!-- Grid principal -->
      <div class="dash-grid">

        <!-- Tendência 6 meses -->
        <div class="dash-card span-2">
          <div class="card-header">
            <span class="card-title"><i class="fi fi-rr-chart-histogram"></i> Tendência — últimos 6 meses</span>
            <div class="chart-legend">
              <span class="leg-item"><span class="leg-dot" style="background:var(--success)"></span>Receita</span>
              <span class="leg-item"><span class="leg-dot" style="background:var(--error)"></span>Despesa</span>
            </div>
          </div>
          ${this.#renderTendencia(r.tendencia)}
        </div>

        <!-- Vendas por status -->
        <div class="dash-card">
          <div class="card-header">
            <span class="card-title"><i class="fi fi-rr-shopping-cart"></i> Vendas por situação</span>
          </div>
          ${this.#renderVendasStatus(r.vendas.lista)}
        </div>

        <!-- Resultado Consolidado -->
        <div class="dash-card">
          <div class="card-header">
            <span class="card-title"><i class="fi fi-rr-file-invoice"></i> Resultado consolidado</span>
          </div>
          ${this.#renderResultado(fin)}
        </div>

        <!-- Gráfico lucro (linha) -->
        <div class="dash-card">
          <div class="card-header">
            <span class="card-title"><i class="fi fi-rr-trending-up"></i> Lucro mensal</span>
          </div>
          ${this.#renderLinha(r.tendencia)}
        </div>

        <!-- Próximos vencimentos -->
        ${r.lancamentos.filter(l=>l.status==="pendente").length ? `
        <div class="dash-card">
          <div class="card-header">
            <span class="card-title"><i class="fi fi-rr-calendar"></i> Próximos vencimentos</span>
          </div>
          ${this.#renderVencimentos(r.lancamentos, hoje)}
        </div>` : ""}

        <!-- Alertas de estoque -->
        ${(r.estoque.alertas.length + r.estoque.zerados.length) > 0 ? `
        <div class="dash-card">
          <div class="card-header">
            <span class="card-title"><i class="fi fi-rr-box"></i> Alertas de estoque</span>
            <span class="badge-count">${r.estoque.zerados.length + r.estoque.alertas.length}</span>
          </div>
          ${this.#renderEstoque(r.estoque)}
        </div>` : ""}

        <!-- Ponto de equilíbrio -->
        <div class="dash-card">
          <div class="card-header">
            <span class="card-title"><i class="fi fi-rr-target"></i> Ponto de equilíbrio</span>
          </div>
          ${this.#renderEquilibrio(fin)}
        </div>

      </div>
    `;
  }

  afterRender() {
    this.$("#filtro-mes")?.addEventListener("change", async e => {
      this.#mes = e.target.value;
      actions.setCache(`dashboard_${this.#mes}`, null);
      await this.#carregar();
    });
    this.$("#btn-refresh")?.addEventListener("click", () => this.#recarregar());
  }

  // ─── KPI Card ─────────────────────────────────────────────────────────────
  #kpi(label, value, sub, cor, icon) {
    return `
      <div class="kpi-card-dash" style="--kpi-cor:${cor}">
        <div class="kpi-icon-wrap">
          <i class="fi ${icon}"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-value-dash">${value}</div>
          <div class="kpi-label-dash">${label}</div>
          <div class="kpi-sub-dash">${sub}</div>
        </div>
      </div>`;
  }

  // ─── Tendência 6 meses (barras) ───────────────────────────────────────────
  #renderTendencia(tendencia) {
    if (!tendencia?.length) return `<div class="chart-empty">Sem dados de tendência.</div>`;
    const dados = tendencia.map(t => ({
      label: nomeMes(t.mes),
      a: t.receitas,
      b: t.despesas,
    }));
    return `<div class="chart-wrap">${barChart({ dados })}</div>`;
  }

  // ─── Lucro mensal (linha) ─────────────────────────────────────────────────
  #renderLinha(tendencia) {
    if (!tendencia?.length) return `<div class="chart-empty">Sem dados.</div>`;
    const dados = tendencia.map(t => ({ label: nomeMes(t.mes), v: t.lucro }));
    const cor = tendencia.every(t => t.lucro >= 0) ? "var(--success)" : "var(--primary)";
    return `<div class="chart-wrap">${lineChart({ dados, cor, height: 120 })}</div>`;
  }

  // ─── Vendas por status (donut + barras) ───────────────────────────────────
  #renderVendasStatus(lista) {
    const STATUS = [
      { id: "pendente",    label: "Pendente",    cor: "#F79009" },
      { id: "em_execucao", label: "Em execução", cor: "#007CBE" },
      { id: "pronto",      label: "Pronto",      cor: "#6B48FF" },
      { id: "entregue",    label: "Entregue",    cor: "#00AC17" },
      { id: "cancelado",   label: "Cancelado",   cor: "#AB0000" },
    ];
    const total   = lista.length || 1;
    const fatias  = STATUS.map(s => ({
      label: s.label, cor: s.cor,
      v: lista.filter(v => v.status === s.id).reduce((sum, v) => sum + Number(v.total || 0), 0),
    })).filter(f => f.v > 0);

    const bars = STATUS.map(s => {
      const count = lista.filter(v => v.status === s.id).length;
      const pct   = ((count / total) * 100).toFixed(0);
      return `
        <div class="status-bar-row">
          <div class="status-dot" style="background:${s.cor}"></div>
          <span class="status-label">${s.label}</span>
          <div class="status-bar-track">
            <div class="status-bar-fill" style="width:${pct}%;background:${s.cor}"></div>
          </div>
          <span class="status-count">${count}</span>
        </div>`;
    }).join("");

    return `
      <div class="status-layout">
        <div class="donut-wrap">
          ${fatias.length ? donutChart({ fatias }) : `<div class="chart-empty">Sem vendas</div>`}
          <div class="donut-total">
            <div class="donut-total-val">${lista.length}</div>
            <div class="donut-total-lbl">vendas</div>
          </div>
        </div>
        <div class="status-bars">${bars}</div>
      </div>`;
  }

  // ─── Resultado consolidado ────────────────────────────────────────────────
  #renderResultado(fin) {
    const itens = [
      { label: "+ Receita bruta",      val: fin.receitas, cor: "var(--success)" },
      { label: "− Despesas",           val: fin.despesas, cor: "var(--error)", neg: true },
      { label: "= Lucro / Prejuízo",   val: fin.lucro,    cor: fin.lucro>=0 ? "var(--success)" : "var(--error)", bold: true },
    ];
    const linhas = itens.map(it => `
      <div class="dre-row ${it.bold ? "dre-total" : ""}">
        <span class="dre-label">${it.label}</span>
        <span class="dre-val" style="color:${it.cor}">${it.neg ? "−" : ""}${fmtBRL(Math.abs(it.val))}</span>
      </div>`).join("");

    const extras = [
      { label: "A receber",  val: fin.aReceber || 0, cor: "var(--success)" },
      { label: "A pagar",    val: fin.aPagar   || 0, cor: "var(--error)"   },
    ];
    const extrasHTML = extras.map(e => `
      <div class="dre-extra">
        <span>${e.label}</span>
        <span style="color:${e.cor};font-weight:600">${fmtBRL(e.val)}</span>
      </div>`).join("");

    return `
      <div class="dre-table">${linhas}</div>
      <div class="dre-extras">${extrasHTML}</div>
      <div class="margem-bar-wrap">
        <div class="margem-bar-label">
          <span>Margem de lucro</span>
          <strong style="color:${Number(fin.margem)>=20?"var(--success)":"var(--error)"}">${fin.margem}%</strong>
        </div>
        <div class="margem-track">
          <div class="margem-fill" style="width:${Math.min(Math.max(Number(fin.margem),0),100)}%;background:${Number(fin.margem)>=20?"var(--success)":"var(--error)"}"></div>
        </div>
      </div>`;
  }

  // ─── Próximos vencimentos ──────────────────────────────────────────────────
  #renderVencimentos(lancamentos, hoje) {
    const proximos = lancamentos
      .filter(l => l.status === "pendente" && l.data_vencimento)
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
      .slice(0, 6);

    if (!proximos.length) return `<div class="venc-empty">Nenhum vencimento pendente.</div>`;

    return proximos.map(l => {
      const atrasado = l.data_vencimento < hoje;
      const isRec    = l.tipo === "receita";
      return `
        <div class="venc-row">
          <div class="venc-tipo-dot" style="background:${isRec ? "var(--success)" : "var(--error)"}"></div>
          <div class="venc-info">
            <div class="venc-desc">${esc(l.descricao)}</div>
            <div class="venc-data ${atrasado ? "atrasado" : ""}">
              ${atrasado ? "⚠ " : ""}${fmtData(l.data_vencimento)}
            </div>
          </div>
          <div class="venc-val" style="color:${isRec ? "var(--success)" : "var(--error)"}">
            ${fmtBRL(l.valor)}
          </div>
        </div>`;
    }).join("");
  }

  // ─── Alertas de estoque ───────────────────────────────────────────────────
  #renderEstoque({ alertas, zerados }) {
    const todos = [...zerados.slice(0, 4), ...alertas.slice(0, 4)];
    return todos.map(m => {
      const isZero = Number(m.saldo) <= 0;
      return `
        <div class="estoque-row">
          <div class="estoque-status-dot" style="background:${isZero ? "var(--error)" : "var(--warning)"}"></div>
          <div class="estoque-info">
            <div class="estoque-nome">${esc(m.nome)}</div>
            <div class="estoque-cat">${esc(m.categoria || "")}</div>
          </div>
          <div class="estoque-saldo ${isZero ? "zero" : "baixo"}">
            ${isZero ? "Zerado" : `${Number(m.saldo).toFixed(2)} ${esc(m.unidade || "un")}`}
          </div>
        </div>`;
    }).join("");
  }

  // ─── Ponto de equilíbrio ──────────────────────────────────────────────────
  #renderEquilibrio(fin) {
    const meta    = Math.max(Number(fin.despesas || 0), 0);
    const pontEq  = meta > 0 ? meta : 0;
    const pctReal = meta > 0 ? (Number(fin.receitas || 0) / meta) * 100 : 100;
    const pct     = Math.min(pctReal, 100);
    const atingido = fin.receitas >= pontEq;
    const raio = 42;
    const circ = 2 * Math.PI * raio;
    const offset = circ - (pct / 100) * circ;

    return `
      <div class="equil-layout">
        <div class="equil-ring-wrap">
          <svg class="equil-ring" viewBox="0 0 120 120" aria-label="${pctReal.toFixed(0)}% atingido">
            <circle class="equil-ring-bg" cx="60" cy="60" r="${raio}"></circle>
            <circle
              class="equil-ring-fill"
              cx="60"
              cy="60"
              r="${raio}"
              stroke-dasharray="${circ.toFixed(2)}"
              stroke-dashoffset="${offset.toFixed(2)}"
              style="stroke:${atingido ? "var(--success)" : "var(--primary)"}"
            ></circle>
          </svg>
          <div class="equil-ring-center">
            <strong>${pctReal.toFixed(0)}%</strong>
            <span>atingido</span>
          </div>
        </div>
        <div class="equil-nums">
          <div class="equil-num">
            <div class="equil-val" style="color:var(--success)">${fmtBRL(fin.receitas)}</div>
            <div class="equil-lbl">Receita atual</div>
          </div>
          <div class="equil-sep">/</div>
          <div class="equil-num">
            <div class="equil-val" style="color:var(--muted)">${fmtBRL(pontEq)}</div>
            <div class="equil-lbl">Meta (despesas)</div>
          </div>
        </div>
      </div>
      <div class="equil-status ${atingido ? "ok" : "nok"}">
        ${atingido
          ? "Ponto de equilíbrio atingido neste mês."
          : `Faltam ${fmtBRL(pontEq - fin.receitas)} para cobrir as despesas.`}
      </div>`;
  }
}

// ─── CSS do Dashboard ──────────────────────────────────────────────────────────
function dashCSS() { return `
/* Header */
.dash-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
.dash-title{font-size:20px;font-weight:800;margin:0}
.dash-sub{font-size:12px;color:var(--muted)}
.dash-header-actions{display:flex;align-items:center;gap:8px}
.month-input{background:var(--panel2);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:7px 12px;font-size:13px;font-family:var(--font)}
.month-input:focus{outline:none;border-color:var(--primary)}

/* KPI row */
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
@media(max-width:900px){.kpi-row{grid-template-columns:1fr 1fr}}
@media(max-width:500px){.kpi-row{grid-template-columns:1fr}}
.kpi-card-dash{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;display:flex;align-items:center;gap:14px;border-left:3px solid var(--kpi-cor);transition:transform var(--t),box-shadow var(--t)}
.kpi-card-dash:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
.kpi-icon-wrap{width:42px;height:42px;border-radius:var(--radius-md);background:color-mix(in srgb,var(--kpi-cor) 15%,transparent);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--kpi-cor);flex-shrink:0}
.kpi-value-dash{font-size:20px;font-weight:800;color:var(--kpi-cor);line-height:1.1}
.kpi-label-dash{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px}
.kpi-sub-dash{font-size:11px;color:var(--muted);margin-top:2px}

/* Alert banner */
.alert-banner{background:var(--error-bg);border:1px solid var(--error-border);border-radius:var(--radius-md);padding:10px 16px;font-size:13px;color:var(--error);margin-bottom:16px;display:flex;align-items:center;gap:8px}

/* Grid */
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:860px){.dash-grid{grid-template-columns:1fr}}
.span-2{grid-column:1/-1}

/* Cards */
.dash-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.card-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:flex;align-items:center;gap:6px}
.chart-legend{display:flex;gap:12px}
.leg-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)}
.leg-dot{width:10px;height:10px;border-radius:50%}
.chart-wrap{width:100%;overflow-x:auto}
.chart-empty{color:var(--muted);font-size:12px;padding:20px 0;text-align:center}
.badge-count{font-size:11px;font-weight:700;background:var(--error-bg);color:var(--error);border:1px solid var(--error-border);border-radius:999px;padding:1px 8px}

/* Vendas status */
.status-layout{display:flex;align-items:center;gap:16px}
.donut-wrap{position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.donut-total{position:absolute;text-align:center;pointer-events:none}
.donut-total-val{font-size:18px;font-weight:800;line-height:1}
.donut-total-lbl{font-size:10px;color:var(--muted)}
.status-bars{flex:1;display:flex;flex-direction:column;gap:8px}
.status-bar-row{display:flex;align-items:center;gap:8px;font-size:12px}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.status-label{width:90px;flex-shrink:0;color:var(--muted)}
.status-bar-track{flex:1;height:6px;background:var(--panel3);border-radius:99px;overflow:hidden}
.status-bar-fill{height:100%;border-radius:99px;transition:width .5s}
.status-count{font-weight:700;min-width:20px;text-align:right}

/* DRE */
.dre-table{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.dre-row{display:flex;justify-content:space-between;font-size:13px;padding:6px 10px;border-radius:var(--radius-sm)}
.dre-row:not(.dre-total){background:var(--panel)}
.dre-row.dre-total{background:var(--panel3);font-weight:700;font-size:14px;border-radius:var(--radius-md)}
.dre-label{color:var(--text-sub)}
.dre-val{font-weight:700}
.dre-extras{display:flex;justify-content:space-between;margin:8px 0;padding:0 2px}
.dre-extra{font-size:12px;color:var(--muted);display:flex;gap:8px}
.margem-bar-wrap{margin-top:10px}
.margem-bar-label{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:5px}
.margem-track{background:var(--panel3);border-radius:99px;height:8px;overflow:hidden}
.margem-fill{height:100%;border-radius:99px;transition:width .6s}

/* Vencimentos */
.venc-empty{color:var(--muted);font-size:12px;padding:12px 0;text-align:center}
.venc-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:.5px solid var(--border)}
.venc-row:last-child{border-bottom:none}
.venc-tipo-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.venc-info{flex:1;min-width:0}
.venc-desc{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.venc-data{font-size:11px;color:var(--muted)}
.venc-data.atrasado{color:var(--error);font-weight:700}
.venc-val{font-size:13px;font-weight:700;white-space:nowrap}

/* Estoque */
.estoque-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:.5px solid var(--border)}
.estoque-row:last-child{border-bottom:none}
.estoque-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.estoque-info{flex:1;min-width:0}
.estoque-nome{font-size:13px;font-weight:600}
.estoque-cat{font-size:11px;color:var(--muted)}
.estoque-saldo{font-size:12px;font-weight:700;white-space:nowrap}
.estoque-saldo.zero{color:var(--error)}
.estoque-saldo.baixo{color:var(--warning)}

/* Equilíbrio */
.equil-layout{display:flex;align-items:center;gap:16px;margin-bottom:14px}
.equil-ring-wrap{width:118px;height:118px;position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.equil-ring{width:118px;height:118px;transform:rotate(-90deg)}
.equil-ring-bg{fill:none;stroke:var(--panel3);stroke-width:10}
.equil-ring-fill{fill:none;stroke-width:10;stroke-linecap:round;transition:stroke-dashoffset .6s}
.equil-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none}
.equil-ring-center strong{font-size:22px;line-height:1;color:var(--text)}
.equil-ring-center span{font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.05em}
.equil-nums{display:flex;align-items:center;gap:10px;flex:1}
.equil-num{flex:1}
.equil-val{font-size:16px;font-weight:800;line-height:1.1}
.equil-lbl{font-size:11px;color:var(--muted);margin-top:2px}
.equil-sep{font-size:20px;color:var(--border-md)}
.equil-status{font-size:12px;padding:8px 12px;border-radius:var(--radius-md);text-align:center}
.equil-status.ok{background:var(--success-bg);color:var(--success);border:1px solid var(--success-border)}
.equil-status.nok{background:var(--error-bg);color:var(--error);border:1px solid var(--error-border)}
@media(max-width:520px){.equil-layout{align-items:flex-start}.equil-ring-wrap{width:96px;height:96px}.equil-ring{width:96px;height:96px}.equil-ring-center strong{font-size:18px}.equil-nums{flex-direction:column;align-items:flex-start}.equil-sep{display:none}}
`; }
