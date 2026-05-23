/**
 * DASHBOARD VIEW — Painel principal corrigido.
 * - Gráfico de barras: tendência 6 meses
 * - Gráfico de linha: lucro mensal
 * - Donut: vendas por status
 * - Ponto de equilíbrio: ANEL (ring) estilo barra circular — NÃO pizza
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
  const pad = { top: 20, right: 16, bottom: 32, left: 58 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const n = dados.length;
  const barW  = Math.max(Math.floor(W / n / 3), 6);
  const gap   = Math.floor(W / n);
  const maxVal = Math.max(...dados.flatMap(d => [d.a, d.b]), 1);
  const toY = v => H - (v / maxVal) * H;

  const bars = dados.map((d, i) => {
    const x  = pad.left + i * gap + gap / 2 - barW;
    const hA = Math.max((d.a / maxVal) * H, 1);
    const hB = Math.max((d.b / maxVal) * H, 1);
    return `
      <rect x="${x}" y="${pad.top + toY(d.a)}" width="${barW}" height="${hA}"
            fill="${corA}" rx="3" opacity="0.88">
        <title>${labelA}: ${fmtBRL(d.a)}</title>
      </rect>
      <rect x="${x + barW + 2}" y="${pad.top + toY(d.b)}" width="${barW}" height="${hB}"
            fill="${corB}" rx="3" opacity="0.88">
        <title>${labelB}: ${fmtBRL(d.b)}</title>
      </rect>
      <text x="${x + barW}" y="${height - 8}" text-anchor="middle"
            font-size="10" fill="var(--muted)" font-family="var(--font)">${d.label}</text>
    `;
  }).join("");

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y   = pad.top + H * (1 - pct);
    const val = maxVal * pct;
    const fmt = val >= 1000 ? `${(val/1000).toFixed(0)}k` : val.toFixed(0);
    return `
      <line x1="${pad.left}" y1="${y}" x2="${pad.left + W}" y2="${y}"
            stroke="var(--border)" stroke-width="1"/>
      <text x="${pad.left - 5}" y="${y + 4}" text-anchor="end"
            font-size="9" fill="var(--muted)" font-family="var(--font)">${fmt}</text>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet"
         style="overflow:visible;display:block">
      ${gridLines}
      ${bars}
    </svg>`;
}

// ─── Gráfico de linha SVG ─────────────────────────────────────────────────────
function lineChart({ dados, width = 560, height = 120, cor = "#00c49a" }) {
  const pad = { top: 16, right: 16, bottom: 28, left: 58 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const n = dados.length;
  if (n < 2) return `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Dados insuficientes</div>`;

  const maxVal = Math.max(...dados.map(d => d.v), 1);
  const minVal = Math.min(...dados.map(d => d.v), 0);
  const range  = maxVal - minVal || 1;

  const toX = i => pad.left + (i / (n - 1)) * W;
  const toY = v => pad.top + H - ((v - minVal) / range) * H;

  const points = dados.map((d, i) => `${toX(i)},${toY(d.v)}`).join(" ");
  const area   = `${toX(0)},${pad.top + H} ${points} ${toX(n - 1)},${pad.top + H}`;

  const dots = dados.map((d, i) => `
    <circle cx="${toX(i)}" cy="${toY(d.v)}" r="4"
            fill="${cor}" stroke="var(--panel2)" stroke-width="2">
      <title>${d.label}: ${fmtBRL(d.v)}</title>
    </circle>
  `).join("");

  const labels = dados.map((d, i) => `
    <text x="${toX(i)}" y="${height - 6}" text-anchor="middle"
          font-size="10" fill="var(--muted)" font-family="var(--font)">${d.label}</text>
  `).join("");

  const gridLines = [0, 0.5, 1].map(pct => {
    const y   = pad.top + H * (1 - pct);
    const val = minVal + range * pct;
    const fmt = Math.abs(val) >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toFixed(0);
    return `
      <line x1="${pad.left}" y1="${y}" x2="${pad.left + W}" y2="${y}"
            stroke="var(--border)" stroke-width="1"/>
      <text x="${pad.left - 5}" y="${y + 4}" text-anchor="end"
            font-size="9" fill="var(--muted)" font-family="var(--font)">${fmt}</text>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet"
         style="overflow:visible;display:block">
      ${gridLines}
      <defs>
        <linearGradient id="lg-line" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${cor}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="${cor}" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#lg-line)"/>
      <polyline points="${points}" fill="none" stroke="${cor}" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${labels}
    </svg>`;
}

// ─── Gráfico de donut SVG ─────────────────────────────────────────────────────
function donutChart({ fatias, size = 120 }) {
  const r     = 44;
  const cx    = size / 2;
  const cy    = size / 2;
  const inner = r * 0.56;
  const total = fatias.reduce((s, f) => s + f.v, 0) || 1;
  let angle   = -Math.PI / 2;

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
    this.listenTo(EVENTS.VENDA_CRIADA,       () => this.#recarregar());
    this.listenTo(EVENTS.VENDA_ATUALIZADA,   () => this.#recarregar());
    this.listenTo(EVENTS.VENDA_STATUS_MUDOU, () => this.#recarregar());
    this.listenTo(EVENTS.LANCAMENTO_CRIADO,  () => this.#recarregar());
    this.listenTo(EVENTS.LANCAMENTO_PAGO,    () => this.#recarregar());
    this.listenTo(EVENTS.ESTOQUE_ENTRADA,    () => this.#recarregar());
    this.listenTo(EVENTS.ESTOQUE_SAIDA,      () => this.#recarregar());
    this.listenTo(EVENTS.PRODUCAO_CONCLUIDA, () => this.#recarregar());
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

    const r    = this.#resumo;
    const fin  = r.financeiro;
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
          <span class="dash-sub">${this.#mes.split("-").reverse().join("/")} · atualizado agora</span>
        </div>
        <div class="dash-header-actions">
          <input type="month" id="filtro-mes" value="${this.#mes}" class="month-input" />
          <button class="btn-secondary" id="btn-refresh" title="Atualizar" style="padding:7px 12px">
            <i class="fi fi-rr-refresh"></i>
          </button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-row">
        ${this.#kpi("Faturamento",   fmtBRL(r.faturamento),      `${r.vendas.total} venda${r.vendas.total!==1?"s":""}`, "var(--primary-light)", "fi-rr-money-bill-wave")}
        ${this.#kpi("Receitas",      fmtBRL(fin.receitas),        `Recebido: ${fmtBRL(fin.recebido||0)}`,               "var(--success)",       "fi-rr-trending-up")}
        ${this.#kpi("Despesas",      fmtBRL(fin.despesas),        `A pagar: ${fmtBRL(fin.aPagar||0)}`,                  "var(--error)",         "fi-rr-trending-down")}
        ${this.#kpi("Lucro Líquido", fmtBRL(fin.lucro),           `Margem: ${fin.margem}%`,                             fin.lucro>=0?"var(--success)":"var(--error)", fin.lucro>=0?"fi-rr-check-circle":"fi-rr-exclamation")}
      </div>

      <!-- Banner de vencidos -->
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
            <span class="card-title"><i class="fi fi-rr-file-invoice"></i> Resultado do mês</span>
          </div>
          ${this.#renderResultado(fin)}
        </div>

        <!-- Lucro (linha) -->
        <div class="dash-card">
          <div class="card-header">
            <span class="card-title"><i class="fi fi-rr-trending-up"></i> Lucro mensal</span>
          </div>
          ${this.#renderLinha(r.tendencia)}
        </div>

        <!-- Ponto de equilíbrio — ANEL (ring chart) -->
        <div class="dash-card">
          <div class="card-header">
            <span class="card-title"><i class="fi fi-rr-target"></i> Ponto de equilíbrio</span>
          </div>
          ${this.#renderEquilibrio(fin)}
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
        <div class="kpi-icon-wrap"><i class="fi ${icon}"></i></div>
        <div class="kpi-body">
          <div class="kpi-value-dash">${value}</div>
          <div class="kpi-label-dash">${label}</div>
          <div class="kpi-sub-dash">${sub}</div>
        </div>
      </div>`;
  }

  // ─── Tendência 6 meses ────────────────────────────────────────────────────
  #renderTendencia(tendencia) {
    if (!tendencia?.length) return `<div class="chart-empty">Sem dados de tendência.</div>`;
    const dados = tendencia.map(t => ({ label: nomeMes(t.mes), a: t.receitas, b: t.despesas }));
    return `<div class="chart-wrap">${barChart({ dados })}</div>`;
  }

  // ─── Lucro mensal (linha) ─────────────────────────────────────────────────
  #renderLinha(tendencia) {
    if (!tendencia?.length) return `<div class="chart-empty">Sem dados.</div>`;
    const dados = tendencia.map(t => ({ label: nomeMes(t.mes), v: t.lucro }));
    const cor   = tendencia.every(t => t.lucro >= 0) ? "var(--success)" : "var(--primary-light)";
    return `<div class="chart-wrap">${lineChart({ dados, cor, height: 120 })}</div>`;
  }

  // ─── Vendas por status ────────────────────────────────────────────────────
  #renderVendasStatus(lista) {
    const STATUS = [
      { id: "pendente",    label: "Pendente",    cor: "#F79009" },
      { id: "em_execucao", label: "Em execução", cor: "#007CBE" },
      { id: "pronto",      label: "Pronto",      cor: "#6B48FF" },
      { id: "entregue",    label: "Entregue",    cor: "#00AC17" },
      { id: "cancelado",   label: "Cancelado",   cor: "#AB0000" },
    ];
    const total  = lista.length || 1;
    const fatias = STATUS.map(s => ({
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
          ${fatias.length ? donutChart({ fatias }) : `<div class="chart-empty" style="padding:10px">Sem vendas</div>`}
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
      { label: "+ Receita bruta",    val: fin.receitas, cor: "var(--success)" },
      { label: "− Despesas",         val: fin.despesas, cor: "var(--error)", neg: true },
      { label: "= Resultado",        val: fin.lucro,    cor: fin.lucro>=0?"var(--success)":"var(--error)", bold: true },
    ];
    const linhas = itens.map(it => `
      <div class="dre-row ${it.bold?"dre-total":""}">
        <span class="dre-label">${it.label}</span>
        <span class="dre-val" style="color:${it.cor}">${it.neg?"−":""}${fmtBRL(Math.abs(it.val))}</span>
      </div>`).join("");

    const extras = [
      { label: "A receber", val: fin.aReceber||0, cor: "var(--success)" },
      { label: "A pagar",   val: fin.aPagar||0,   cor: "var(--error)"   },
    ];
    const extrasHTML = extras.map(e => `
      <div class="dre-extra">
        <span>${e.label}</span>
        <span style="color:${e.cor};font-weight:600">${fmtBRL(e.val)}</span>
      </div>`).join("");

    const margem = Number(fin.margem);
    return `
      <div class="dre-table">${linhas}</div>
      <div class="dre-extras">${extrasHTML}</div>
      <div class="margem-bar-wrap">
        <div class="margem-bar-label">
          <span>Margem de lucro</span>
          <strong style="color:${margem>=20?"var(--success)":"var(--error)"}">${fin.margem}%</strong>
        </div>
        <div class="margem-track">
          <div class="margem-fill" style="width:${Math.min(Math.max(margem,0),100)}%;background:${margem>=20?"var(--success)":"var(--error)"}"></div>
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
          <div class="venc-tipo-dot" style="background:${isRec?"var(--success)":"var(--error)"}"></div>
          <div class="venc-info">
            <div class="venc-desc">${esc(l.descricao)}</div>
            <div class="venc-data ${atrasado?"atrasado":""}">${atrasado?"⚠ ":""}${fmtData(l.data_vencimento)}</div>
          </div>
          <div class="venc-val" style="color:${isRec?"var(--success)":"var(--error)"}">${fmtBRL(l.valor)}</div>
        </div>`;
    }).join("");
  }

  // ─── Alertas de estoque ───────────────────────────────────────────────────
  #renderEstoque({ alertas, zerados }) {
    const todos = [...zerados.slice(0,4), ...alertas.slice(0,4)];
    return todos.map(m => {
      const isZero = Number(m.saldo) <= 0;
      return `
        <div class="estoque-row">
          <div class="estoque-status-dot" style="background:${isZero?"var(--error)":"var(--warning)"}"></div>
          <div class="estoque-info">
            <div class="estoque-nome">${esc(m.nome)}</div>
            <div class="estoque-cat">${esc(m.categoria||"")}</div>
          </div>
          <div class="estoque-saldo ${isZero?"zero":"baixo"}">
            ${isZero?"Zerado":`${Number(m.saldo).toFixed(2)} ${esc(m.unidade||"un")}`}
          </div>
        </div>`;
    }).join("");
  }

  // ─── Ponto de equilíbrio — RING CHART (anel estilo barra circular) ────────
  #renderEquilibrio(fin) {
    const meta      = Math.max(Number(fin.despesas || 0), 0);
    const receita   = Number(fin.receitas || 0);
    const pctReal   = meta > 0 ? (receita / meta) * 100 : (receita > 0 ? 100 : 0);
    const pctClamp  = Math.min(pctReal, 100);
    const atingido  = receita >= meta && meta > 0;
    const falta     = Math.max(meta - receita, 0);

    // Parâmetros do anel SVG
    const SIZE    = 130;
    const cx      = SIZE / 2;
    const cy      = SIZE / 2;
    const raio    = 48;
    const stroke  = 11;
    const circunf = 2 * Math.PI * raio;

    // Arco tracejado começa no topo (−90°) e vai no sentido horário
    const dashOffset = circunf - (pctClamp / 100) * circunf;
    const corArco    = atingido ? "var(--success)" : pctClamp > 60 ? "var(--primary-light)" : "var(--warning)";

    return `
      <div class="equil-wrap">
        <!-- Anel -->
        <div class="equil-ring-container">
          <svg class="equil-svg" viewBox="0 0 ${SIZE} ${SIZE}"
               width="${SIZE}" height="${SIZE}" aria-label="${pctReal.toFixed(0)}% do ponto de equilíbrio">
            <!-- Trilha de fundo -->
            <circle
              cx="${cx}" cy="${cy}" r="${raio}"
              fill="none"
              stroke="var(--panel3)"
              stroke-width="${stroke}"
            />
            <!-- Arco de progresso -->
            <circle
              cx="${cx}" cy="${cy}" r="${raio}"
              fill="none"
              stroke="${corArco}"
              stroke-width="${stroke}"
              stroke-linecap="round"
              stroke-dasharray="${circunf.toFixed(2)}"
              stroke-dashoffset="${dashOffset.toFixed(2)}"
              transform="rotate(-90 ${cx} ${cy})"
              style="transition:stroke-dashoffset .6s ease, stroke .3s ease"
            />
          </svg>
          <!-- Texto central -->
          <div class="equil-center-text">
            <strong class="equil-pct" style="color:${corArco}">${pctReal.toFixed(0)}%</strong>
            <span class="equil-pct-label">atingido</span>
          </div>
        </div>

        <!-- Números -->
        <div class="equil-info">
          <div class="equil-info-item">
            <span class="equil-info-label">Receita atual</span>
            <span class="equil-info-val" style="color:var(--success)">${fmtBRL(receita)}</span>
          </div>
          <div class="equil-info-divider"></div>
          <div class="equil-info-item">
            <span class="equil-info-label">Meta (despesas)</span>
            <span class="equil-info-val" style="color:var(--muted)">${fmtBRL(meta)}</span>
          </div>
        </div>

        <!-- Status -->
        <div class="equil-status-msg ${atingido?"ok":"nok"}">
          ${atingido
            ? `<i class="fi fi-rr-check-circle"></i> Ponto de equilíbrio atingido neste mês!`
            : meta > 0
              ? `<i class="fi fi-rr-exclamation"></i> Faltam <strong>${fmtBRL(falta)}</strong> para cobrir as despesas.`
              : `<i class="fi fi-rr-info"></i> Nenhuma despesa registrada ainda.`}
        </div>
      </div>`;
  }
}

// ─── CSS do Dashboard ──────────────────────────────────────────────────────────
function dashCSS() { return `
/* Header */
.dash-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px}
.dash-title{font-size:19px;font-weight:800;margin:0}
.dash-sub{font-size:11px;color:var(--muted)}
.dash-header-actions{display:flex;align-items:center;gap:8px}
.month-input{background:var(--panel2);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:7px 11px;font-size:12px;font-family:var(--font);outline:none}
.month-input:focus{border-color:var(--primary)}
[data-theme="light"] .month-input{background:#fff}

/* KPI row */
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
@media(max-width:900px){.kpi-row{grid-template-columns:1fr 1fr}}
@media(max-width:480px){.kpi-row{grid-template-columns:1fr}}
.kpi-card-dash{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;display:flex;align-items:center;gap:12px;border-left:3px solid var(--kpi-cor);transition:transform var(--t),box-shadow var(--t);box-shadow:var(--shadow-xs)}
[data-theme="light"] .kpi-card-dash{box-shadow:var(--shadow-sm)}
.kpi-card-dash:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
.kpi-icon-wrap{width:40px;height:40px;border-radius:var(--radius-md);background:color-mix(in srgb,var(--kpi-cor) 14%,transparent);display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--kpi-cor);flex-shrink:0}
.kpi-value-dash{font-size:18px;font-weight:800;color:var(--kpi-cor);line-height:1.1}
.kpi-label-dash{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px}
.kpi-sub-dash{font-size:10.5px;color:var(--muted);margin-top:2px}

/* Alert */
.alert-banner{background:var(--error-bg);border:1px solid var(--error-border);border-radius:var(--radius-md);padding:9px 14px;font-size:12.5px;color:var(--error);margin-bottom:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}

/* Grid */
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:860px){.dash-grid{grid-template-columns:1fr}}
.span-2{grid-column:1/-1}

/* Cards */
.dash-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:15px;box-shadow:var(--shadow-xs)}
[data-theme="light"] .dash-card{box-shadow:var(--shadow-sm)}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.card-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:flex;align-items:center;gap:6px}
.chart-legend{display:flex;gap:10px}
.leg-item{display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--muted)}
.leg-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.chart-wrap{width:100%;overflow-x:auto}
.chart-empty{color:var(--muted);font-size:11px;padding:20px 0;text-align:center}
.badge-count{font-size:10.5px;font-weight:700;background:var(--error-bg);color:var(--error);border:1px solid var(--error-border);border-radius:999px;padding:1px 7px}

/* Vendas por status */
.status-layout{display:flex;align-items:center;gap:14px}
.donut-wrap{position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.donut-total{position:absolute;text-align:center;pointer-events:none}
.donut-total-val{font-size:17px;font-weight:800;line-height:1}
.donut-total-lbl{font-size:9.5px;color:var(--muted)}
.status-bars{flex:1;display:flex;flex-direction:column;gap:7px}
.status-bar-row{display:flex;align-items:center;gap:7px;font-size:11.5px}
.status-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.status-label{width:86px;flex-shrink:0;color:var(--muted)}
.status-bar-track{flex:1;height:5px;background:var(--panel3);border-radius:99px;overflow:hidden}
.status-bar-fill{height:100%;border-radius:99px;transition:width .5s}
.status-count{font-weight:700;min-width:18px;text-align:right;font-size:11px}

/* DRE */
.dre-table{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}
.dre-row{display:flex;justify-content:space-between;font-size:12.5px;padding:5px 9px;border-radius:var(--radius-sm)}
.dre-row:not(.dre-total){background:var(--panel)}
[data-theme="light"] .dre-row:not(.dre-total){background:#f8f9fc}
.dre-row.dre-total{background:var(--panel3);font-weight:700;font-size:13.5px;border-radius:var(--radius-md)}
.dre-label{color:var(--text-sub)}
.dre-val{font-weight:700}
.dre-extras{display:flex;justify-content:space-between;margin:7px 0;padding:0 2px}
.dre-extra{font-size:11.5px;color:var(--muted);display:flex;gap:8px}
.margem-bar-wrap{margin-top:10px}
.margem-bar-label{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:5px}
.margem-track{background:var(--panel3);border-radius:99px;height:7px;overflow:hidden}
.margem-fill{height:100%;border-radius:99px;transition:width .6s}

/* Vencimentos */
.venc-empty{color:var(--muted);font-size:11.5px;padding:12px 0;text-align:center}
.venc-row{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:.5px solid var(--border)}
.venc-row:last-child{border-bottom:none}
.venc-tipo-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.venc-info{flex:1;min-width:0}
.venc-desc{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.venc-data{font-size:10.5px;color:var(--muted)}
.venc-data.atrasado{color:var(--error);font-weight:700}
.venc-val{font-size:12.5px;font-weight:700;white-space:nowrap}

/* Estoque */
.estoque-row{display:flex;align-items:center;gap:9px;padding:6px 0;border-bottom:.5px solid var(--border)}
.estoque-row:last-child{border-bottom:none}
.estoque-status-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.estoque-info{flex:1;min-width:0}
.estoque-nome{font-size:12.5px;font-weight:600}
.estoque-cat{font-size:10.5px;color:var(--muted)}
.estoque-saldo{font-size:11.5px;font-weight:700;white-space:nowrap}
.estoque-saldo.zero{color:var(--error)}
.estoque-saldo.baixo{color:var(--warning)}

/* ═══════════════════════════════════════════════════════
   PONTO DE EQUILÍBRIO — Ring Chart (Anel circular)
   ═══════════════════════════════════════════════════════ */
.equil-wrap{display:flex;flex-direction:column;gap:12px}

.equil-ring-container{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  width:130px;
  height:130px;
  margin:0 auto;
}

.equil-svg{display:block;overflow:visible}

.equil-center-text{
  position:absolute;
  inset:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  pointer-events:none;
  gap:2px;
}

.equil-pct{
  font-size:24px;
  font-weight:800;
  line-height:1;
  display:block;
}

.equil-pct-label{
  font-size:9.5px;
  color:var(--muted);
  text-transform:uppercase;
  letter-spacing:.06em;
  display:block;
}

.equil-info{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:14px;
  background:var(--panel);
  border:1px solid var(--border);
  border-radius:var(--radius-md);
  padding:10px 14px;
}
[data-theme="light"] .equil-info{background:#f8f9fc}

.equil-info-item{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1}
.equil-info-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.equil-info-val{font-size:13.5px;font-weight:800;line-height:1.1}
.equil-info-divider{width:1px;height:32px;background:var(--border-md)}

.equil-status-msg{
  font-size:11.5px;
  padding:8px 12px;
  border-radius:var(--radius-md);
  text-align:center;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px;
}
.equil-status-msg.ok{background:var(--success-bg);color:var(--success);border:1px solid var(--success-border)}
.equil-status-msg.nok{background:var(--warning-bg);color:var(--warning);border:1px solid rgba(255,179,0,.22)}
.equil-status-msg strong{font-weight:700}

@media(max-width:500px){
  .equil-info{flex-direction:column;gap:8px}
  .equil-info-divider{width:100%;height:1px}
}
`; }
