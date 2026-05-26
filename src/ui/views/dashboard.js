/**
 * DASHBOARD VIEW — Layout completo igual à imagem de referência
 * Seções:
 *  - Saudação + seletor de mês
 *  - 4 KPI cards com sparklines
 *  - Vendas x Despesas | Ponto de Equilíbrio | DRE
 *  - Contas a Receber | Contas a Pagar | Avisos
 *  - Vendas por Situação | Top 5 Produtos | Top 5 Clientes | Indicadores
 */

import { BaseView } from "./baseView.js";
import { services } from "../../core/services.js";
import { selectors, actions, store } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import { esc } from "../../utils/sanitize.js";
import { fmtBRL, fmtData } from "../../utils/fmt.js";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function nomeMes(m) {
  const [y,mo] = m.split("-");
  return new Date(y,mo-1).toLocaleDateString("pt-BR",{month:"short"}).replace(".","");
}
function nomeMesLong(m) {
  const [y,mo] = m.split("-");
  return new Date(y,mo-1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
}

/* ── Sparkline SVG (mini linha) ─────────────────────────────────────────── */
function sparkline(dados, cor="#00c49a", w=120, h=36) {
  if(!dados?.length || dados.length < 2) return "";
  const mx=Math.max(...dados,1), mn=Math.min(...dados,0), rng=mx-mn||1;
  const toX=i=>(i/(dados.length-1))*w;
  const toY=v=>h-((v-mn)/rng)*h*0.85-h*0.05;
  const pts=dados.map((v,i)=>`${toX(i)},${toY(v)}`).join(" ");
  const area=`0,${h} ${pts} ${w},${h}`;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;overflow:visible">
    <defs><linearGradient id="sg${cor.replace(/[^a-z0-9]/gi,'')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${cor}" stop-opacity=".25"/>
      <stop offset="100%" stop-color="${cor}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${area}" fill="url(#sg${cor.replace(/[^a-z0-9]/gi,'')})"/>
    <polyline points="${pts}" fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ── Barras SVG (tendência) ─────────────────────────────────────────────── */
function barChart(dados, w=460, h=190) {
  const pad={t:12,r:10,b:28,l:46};
  const W=w-pad.l-pad.r, H=h-pad.t-pad.b;
  const n=dados.length, bw=Math.max(Math.floor(W/n/3.2),5), gap=Math.floor(W/n);
  const mx=Math.max(...dados.flatMap(d=>[d.a,d.b]),1);
  const toY=v=>H-(v/mx)*H;
  const bars=dados.map((d,i)=>{
    const x=pad.l+i*gap+gap/2-bw;
    return `<rect x="${x}" y="${pad.t+toY(d.a)}" width="${bw}" height="${Math.max((d.a/mx)*H,1)}" fill="#00c49a" rx="3" opacity=".9"><title>${d.label}: ${fmtBRL(d.a)}</title></rect>
<rect x="${x+bw+2}" y="${pad.t+toY(d.b)}" width="${bw}" height="${Math.max((d.b/mx)*H,1)}" fill="#e53935" rx="3" opacity=".9"><title>Desp: ${fmtBRL(d.b)}</title></rect>
<text x="${x+bw}" y="${h-6}" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="var(--font)">${d.label}</text>`;
  }).join("");
  const grid=[0,.25,.5,.75,1].map(p=>{
    const y=pad.t+H*(1-p), v=mx*p;
    const f=v>=1000?`${(v/1000).toFixed(0)}k`:v.toFixed(0);
    return `<line x1="${pad.l}" y1="${y}" x2="${pad.l+W}" y2="${y}" stroke="var(--border)" stroke-width="1"/>
<text x="${pad.l-4}" y="${y+3}" text-anchor="end" font-size="8" fill="var(--muted)" font-family="var(--font)">${f}</text>`;
  }).join("");
  return `<svg class="dash-chart-svg dash-bar-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">${grid}${bars}</svg>`;
}

/* ── Ponto de Equilíbrio — gráfico de linhas ────────────────────────────── */
function breakEvenChart(custoFixo, custoVar, receitaTotal, w=260, h=168) {
  const pad={t:10,r:10,b:24,l:34};
  const W=w-pad.l-pad.r, H=h-pad.t-pad.b;
  const maxX=receitaTotal*1.15||1, maxY=receitaTotal*1.15||1;
  const toX=v=>(v/maxX)*W+pad.l;
  const toY=v=>H-((v/maxY)*H)+pad.t;

  // Pontos ao longo do eixo X (vendas)
  const pts=5;
  const recPts=Array.from({length:pts},(_,i)=>{const x=maxX*(i/(pts-1));return{x,y:x};});
  const ctPts=Array.from({length:pts},(_,i)=>{const x=maxX*(i/(pts-1));return{x,y:custoFixo+custoVar*(x/maxX)};});
  const cfPts=[{x:0,y:custoFixo},{x:maxX,y:custoFixo}];

  // Ponto de equilíbrio: receita = custoFixo + custoVar*(x/maxX)*maxX => x*(1 - custoVar/maxX) = custoFixo
  const varPct = receitaTotal > 0 ? (custoVar/receitaTotal) : 0.5;
  const peX = varPct < 1 ? custoFixo/(1-varPct) : 0;
  const peXpx = toX(Math.min(peX, maxX));
  const peYpx = toY(Math.min(peX, maxY));

  const linePts=(pts,fn)=>pts.map(p=>`${toX(p.x)},${toY(fn?fn(p.x):p.y)}`).join(" ");

  const grid=[0,.25,.5,.75,1].map(p=>{
    const y=pad.t+H*(1-p), v=maxX*p;
    const f=v>=1000?`${(v/1000).toFixed(0)}k`:v.toFixed(0);
    return `<line x1="${pad.l}" y1="${y}" x2="${pad.l+W}" y2="${y}" stroke="var(--border)" stroke-width=".7"/>
<text x="${pad.l-3}" y="${y+3}" text-anchor="end" font-size="7" fill="var(--muted)" font-family="var(--font)">${f}</text>
<text x="${toX(maxX*p)}" y="${h-4}" text-anchor="middle" font-size="7" fill="var(--muted)" font-family="var(--font)">${f}</text>`;
  }).join("");

  return `<svg class="dash-chart-svg pe-chart-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">
    ${grid}
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+H}" stroke="var(--border-md)" stroke-width="1"/>
    <line x1="${pad.l}" y1="${pad.t+H}" x2="${pad.l+W}" y2="${pad.t+H}" stroke="var(--border-md)" stroke-width="1"/>
    <!-- Custo Fixo (vermelho tracejado horizontal) -->
    <polyline points="${toX(0)},${toY(custoFixo)} ${toX(maxX)},${toY(custoFixo)}"
      fill="none" stroke="#e53935" stroke-width="1.5" stroke-dasharray="4,3" opacity=".8"/>
    <!-- Custo Total (azul) -->
    <polyline points="${toX(0)},${toY(custoFixo)} ${toX(maxX)},${toY(custoFixo+custoVar)}"
      fill="none" stroke="#74c0fc" stroke-width="2"/>
    <!-- Receita Total (verde) -->
    <polyline points="${toX(0)},${toY(0)} ${toX(maxX)},${toY(receitaTotal)}"
      fill="none" stroke="#00c49a" stroke-width="2"/>
    <!-- P.E. linha vertical tracejada -->
    ${peX>0&&peX<maxX?`
    <line x1="${peXpx}" y1="${pad.t}" x2="${peXpx}" y2="${pad.t+H}"
      stroke="var(--muted)" stroke-width="1" stroke-dasharray="3,2"/>
    <circle cx="${peXpx}" cy="${peYpx}" r="3.5" fill="var(--primary)" stroke="var(--panel2)" stroke-width="1.5"/>
    <text x="${peXpx+5}" y="${peYpx-5}" font-size="8" fill="var(--text)" font-family="var(--font)" font-weight="700">P.E.</text>`:""}
  </svg>`;
}

/* ── Donut SVG ──────────────────────────────────────────────────────────── */
function donutChart(fatias, size=130) {
  const r=54,cx=size/2,cy=size/2,inner=r*.6;
  const total=fatias.reduce((s,f)=>s+f.v,0)||1;
  let angle=-Math.PI/2;
  const arcos=fatias.map(f=>{
    const sw=(f.v/total)*2*Math.PI;
    const x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle);
    angle+=sw;
    const x2=cx+r*Math.cos(angle),y2=cy+r*Math.sin(angle);
    return `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${sw>Math.PI?1:0},1 ${x2},${y2} Z"
      fill="${f.cor}" opacity=".92"><title>${esc(f.label)}: ${f.v}</title></path>`;
  }).join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    ${arcos}
    <circle cx="${cx}" cy="${cy}" r="${inner}" fill="var(--panel2)"/>
    <text x="${cx}" y="${cy-8}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="var(--font)">Total</text>
    <text x="${cx}" y="${cy+12}" text-anchor="middle" font-size="22" font-weight="800" fill="var(--text)" font-family="var(--font)">${fatias.reduce((s,f)=>s+f.v,0)}</text>
  </svg>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   VIEW
══════════════════════════════════════════════════════════════════════════ */
export class DashboardView extends BaseView {
  #mes      = mesAtual();
  #resumo   = null;
  #loading  = true;
  #userName = "Luciano";
  #ocultarDados = localStorage.getItem("dashboard_ocultar_dados") === "true";

  async _init() {
    await this.#load();
  }

  async #load() {
    this.#loading = true;
    try {
      this.#resumo = await services.dashboard.getResumo(this.#mes);
      // Carrega caixa para fluxo
      await services.caixa.listar().catch(()=>{});
    } catch(e) { console.error("[Dashboard]",e); }
    finally { this.#loading = false; this.refresh(); }
  }

  async #reload() {
    actions.setCache(`dashboard_${this.#mes}`, null);
    await this.#load();
  }

  render() {
    if (this.#loading || !this.#resumo) return this._loading("Carregando dashboard...");
    const r   = this.#resumo;
    const fin = r.financeiro;
    const hoje = new Date().toISOString().split("T")[0];

    // Fluxo de caixa (soma do mês)
    const caixaMov = selectors.caixa().movimentos || [];
    const fluxo    = caixaMov
      .filter(m => m.data?.startsWith(this.#mes))
      .reduce((s,m) => s + (m.tipo==="entrada" ? Number(m.valor) : -Number(m.valor)), 0);

    // Tendência sparklines (últimos 6 meses)
    const spkRec   = r.tendencia?.map(t=>t.receitas)||[];
    const spkDesp  = r.tendencia?.map(t=>t.despesas)||[];
    const spkLucro = r.tendencia?.map(t=>t.lucro)||[];
    const spkCaixa = r.tendencia?.map(t=>t.receitas*0.7)||[]; // approx

    // Contas a receber e pagar
    const aReceber = r.lancamentos.filter(l=>l.tipo==="receita"&&l.status==="pendente")
      .sort((a,b)=>a.data_vencimento?.localeCompare(b.data_vencimento||"")||0).slice(0,5);
    const aPagar   = r.lancamentos.filter(l=>l.tipo==="despesa"&&l.status==="pendente")
      .sort((a,b)=>a.data_vencimento?.localeCompare(b.data_vencimento||"")||0).slice(0,5);

    // Alertas/avisos
    const vencidos  = r.lancamentos.filter(l=>l.status==="pendente"&&l.data_vencimento<hoje);
    const estAlerts = [...(r.estoque?.zerados||[]),...(r.estoque?.alertas||[])];
    const emProd    = store.getState("producao")?.itens?.length || 0;

    // Top 5 clientes (por valor de vendas)
    const clienteMap = {};
    r.vendas.lista.forEach(v=>{
      const k = v.cliente_nome || "Sem cliente";
      clienteMap[k] = (clienteMap[k]||0) + Number(v.total||0);
    });
    const top5Clientes = Object.entries(clienteMap)
      .sort((a,b)=>b[1]-a[1]).slice(0,5);

    // Top 5 produtos (de venda_itens)
    const prodMap = {};
    r.vendas.lista.forEach(v=>{
      (v.venda_itens||[]).forEach(it=>{
        const k = it.descricao||"Sem descrição";
        prodMap[k] = (prodMap[k]||0) + Number(it.preco_unitario||0)*Number(it.quantidade||1);
      });
    });
    const top5Produtos = Object.entries(prodMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

    // Vendas por status
    const STATUS = [
      {id:"pendente",    label:"Pendente",    cor:"#F79009"},
      {id:"em_execucao", label:"Em execução", cor:"#74c0fc"},
      {id:"pronto",      label:"Pronto",      cor:"#69db7c"},
      {id:"entregue",    label:"Entregue",    cor:"#00AC17"},
      {id:"cancelado",   label:"Cancelado",   cor:"#e53935"},
    ];
    const fatias = STATUS.map(s=>({
      label:s.label, cor:s.cor,
      v:r.vendas.lista.filter(v=>v.status===s.id).length
    })).filter(f=>f.v>0);

    // Ponto de equilíbrio
    const custoFixoTotal = store.getState("config")?.custosFixos?.reduce((s,c)=>s+Number(c.valor||0),0)||0;
    const receita        = fin.receitas||0;
    const despesas       = fin.despesas||0;
    const custoVar       = Math.max(despesas - custoFixoTotal, 0);
    const margContrib    = receita > 0 ? ((receita-custoVar)/receita*100) : 0;
    const pontoEq        = margContrib > 0 ? (custoFixoTotal/(margContrib/100)) : 0;
    const recNecessaria  = pontoEq;
    const margSeguranca  = receita - pontoEq;

    // DRE aproximado
    const impostos  = receita * 0.095;
    const lucroOp   = receita - impostos - custoVar - custoFixoTotal;
    const outrasDesp= Math.max(despesas - custoVar - custoFixoTotal - impostos, 0);
    const lucroLiq  = fin.lucro;
    const margLiq   = receita > 0 ? (lucroLiq/receita*100) : 0;

    // Indicadores
    const totalVendas = r.vendas.total||1;
    const ticketMedio = totalVendas > 0 ? r.faturamento/totalVendas : 0;
    const inadimp     = fin.receitas > 0 ? ((fin.aReceber||0)/fin.receitas*100) : 0;
    const pedAberto   = r.vendas.lista.filter(v=>["pendente","em_execucao"].includes(v.status)).length;

return `
<style>${dashCSS()}</style>
<div class="dash-page ${this.#ocultarDados ? "dash-hidden" : ""}">

<!-- SAUDAÇÃO -->
<div class="dash-greeting-row">
  <div>
    <h2 class="dash-greeting">Olá, ${esc(this.#userName.split("@")[0])}! 👋</h2>
    <p class="dash-greeting-sub">Aqui está o resumo geral da sua empresa.</p>
  </div>
  <div class="dash-header-actions">
    <span class="dash-mes-label">${nomeMesLong(this.#mes)}</span>
    <button class="btn-refresh-icon btn-toggle-values" id="btn-toggle-values" title="${this.#ocultarDados ? "Mostrar dados" : "Ocultar dados"}" aria-label="${this.#ocultarDados ? "Mostrar dados" : "Ocultar dados"}">
      <i class="fi ${this.#ocultarDados ? "fi-rr-eye" : "fi-rr-eye-crossed"}"></i>
    </button>
    <input type="month" id="filtro-mes" value="${this.#mes}" class="month-input" title="Selecionar mês"/>
    <button class="btn-refresh-icon" id="btn-refresh" title="Atualizar">
      <i class="fi fi-rr-refresh"></i>
    </button>
  </div>
</div>

<!-- ① KPI CARDS -->
<div class="kpi4-grid">
  ${this.#kpi4("Receita Total",   fmtBRL(receita),  spkRec,  "#00c49a", "fi-rr-money-bill-wave", r.tendencia)}
  ${this.#kpi4("Despesas Totais", fmtBRL(despesas), spkDesp, "#e53935", "fi-rr-shopping-cart",   r.tendencia, true)}
  ${this.#kpi4("Lucro Líquido",   fmtBRL(fin.lucro),spkLucro, fin.lucro>=0?"#00c49a":"#e53935","fi-rr-chart-line-up", r.tendencia)}
  ${this.#kpi4("Fluxo de Caixa",  fmtBRL(fluxo),    spkCaixa,"#a78bfa", "fi-rr-coins",          r.tendencia)}
</div>

<!-- ② VENDAS x DESPESAS | PONTO DE EQUILÍBRIO | DRE -->
<div class="dash-row3">

  <!-- Vendas x Despesas -->
  <div class="dash-panel">
    <div class="panel-header">
      <span class="panel-title">VENDAS X DESPESAS — ÚLTIMOS 6 MESES</span>
      <div class="chart-legend">
        <span class="leg-item"><span class="leg-dot" style="background:#00c49a"></span>Receita</span>
        <span class="leg-item"><span class="leg-dot" style="background:#e53935"></span>Despesa</span>
      </div>
    </div>
    <div class="dash-chart-scroll">
      ${r.tendencia?.length
        ? barChart(r.tendencia.map(t=>({label:nomeMes(t.mes),a:t.receitas,b:t.despesas})))
        : `<div class="chart-empty">Sem dados de tendência</div>`}
    </div>
  </div>

  <!-- Ponto de Equilíbrio -->
  <div class="dash-panel">
    <div class="panel-header">
      <span class="panel-title">PONTO DE EQUILÍBRIO</span>
    </div>
    <div class="pe-layout">
      <div class="pe-nums">
        <div class="pe-item"><span>Receita Necessária (mês)</span><strong>${fmtBRL(recNecessaria)}</strong></div>
        <div class="pe-item"><span>Custo Fixo Total</span><strong>${fmtBRL(custoFixoTotal)}</strong></div>
        <div class="pe-item"><span>Custo Variável Total</span><strong>${fmtBRL(custoVar)}</strong></div>
        <div class="pe-item"><span>Margem de Contribuição</span><strong style="color:var(--success)">${margContrib.toFixed(1)}%</strong></div>
        <div class="pe-item pe-item-total"><span>Ponto de Equilíbrio</span><strong style="color:var(--primary)">${fmtBRL(pontoEq)}</strong></div>
        ${margSeguranca>0?`<div class="pe-item"><span>Margem de Segurança</span><strong style="color:var(--success)">${fmtBRL(margSeguranca)} (${receita>0?(margSeguranca/receita*100).toFixed(1):0}%)</strong></div>`:""}
      </div>
      <div class="pe-chart-wrap">
        <div class="pe-chart-title" style="font-size:9px;color:var(--muted);margin-bottom:4px;font-weight:600">Gráfico do Ponto de Equilíbrio</div>
        <div class="pe-chart-legend">
          <span class="leg-item"><span class="leg-dot" style="background:#00c49a"></span>Receita Total</span>
          <span class="leg-item"><span class="leg-dot" style="background:#74c0fc"></span>Custo Total</span>
          <span class="leg-item"><span class="leg-dot" style="background:#e53935;width:12px;height:2px;border-radius:0"></span>Custo Fixo</span>
        </div>
        ${breakEvenChart(custoFixoTotal, custoVar, receita)}
      </div>
    </div>
  </div>

  <!-- DRE -->
  <div class="dash-panel">
    <div class="panel-header">
      <span class="panel-title">DRE — DEMONSTRATIVO DE RESULTADO</span>
      <span class="dre-mes">${nomeMesLong(this.#mes).split(" de ")[1]?nomeMesLong(this.#mes).replace(" de "," "):nomeMesLong(this.#mes)}</span>
    </div>
    <div class="dre-lista">
      ${this.#dreRow("Receita Bruta",          receita,    "var(--success)", false, false)}
      ${this.#dreRow("(-) Impostos",            impostos,   "var(--error)",   true,  false)}
      ${this.#dreRow("(-) Custos Variáveis",    custoVar,   "var(--error)",   true,  false)}
      ${this.#dreRow("(-) Despesas Fixas",      custoFixoTotal,"var(--error)",true,  false)}
      <div class="dre-sep"></div>
      ${this.#dreRow("Lucro Operacional",       lucroOp,    lucroOp>=0?"var(--success)":"var(--error)", false, true)}
      ${outrasDesp>0?this.#dreRow("(-) Outras Despesas",outrasDesp,"var(--error)",true,false):""}
      <div class="dre-sep"></div>
      ${this.#dreRow("Lucro Líquido",           lucroLiq,   lucroLiq>=0?"var(--success)":"var(--error)", false, true)}
      <div class="dre-row-margem">
        <span>Margem Líquida</span>
        <strong style="color:${margLiq>=15?"var(--success)":"var(--warning)"}">${margLiq.toFixed(1)}%</strong>
      </div>
    </div>
  </div>

</div>

<!-- ③ CONTAS A RECEBER | CONTAS A PAGAR | AVISOS -->
<div class="dash-row3">

  <!-- Contas a Receber -->
  <div class="dash-panel">
    <div class="panel-header">
      <span class="panel-title">CONTAS A RECEBER</span>
      <button class="btn-ver-todas" onclick="window.location.hash='financeiro'">Ver todas</button>
    </div>
    <table class="mini-table">
      <thead><tr><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
      <tbody>
        ${aReceber.length ? aReceber.map(l=>{
          const at = l.data_vencimento < hoje;
          return `<tr>
            <td style="font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.cliente_nome||l.descricao||"—")}</td>
            <td style="color:${at?"var(--error)":"var(--muted)"};">${l.data_vencimento?fmtData(l.data_vencimento):"—"}</td>
            <td style="color:var(--success);font-weight:700">${fmtBRL(l.valor)}</td>
            <td><span class="status-mini ${at?"atrasado":"pendente"}">${at?"Em atraso":"Pendente"}</span></td>
          </tr>`;
        }).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:14px;font-size:11px">Nenhuma conta a receber</td></tr>`}
      </tbody>
    </table>
    ${aReceber.length ? `<div class="mini-table-total">
      <span>Total a receber</span>
      <strong style="color:var(--success)">${fmtBRL(aReceber.reduce((s,l)=>s+Number(l.valor),0))}</strong>
    </div>` : ""}
  </div>

  <!-- Contas a Pagar -->
  <div class="dash-panel">
    <div class="panel-header">
      <span class="panel-title">CONTAS A PAGAR</span>
      <button class="btn-ver-todas" onclick="window.location.hash='financeiro'">Ver todas</button>
    </div>
    <table class="mini-table">
      <thead><tr><th>Fornecedor</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
      <tbody>
        ${aPagar.length ? aPagar.map(l=>{
          const at = l.data_vencimento < hoje;
          return `<tr>
            <td style="font-weight:600;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.cliente_nome||l.descricao||"—")}</td>
            <td style="color:${at?"var(--error)":"var(--muted)"}">${l.data_vencimento?fmtData(l.data_vencimento):"—"}</td>
            <td style="color:var(--error);font-weight:700">${fmtBRL(l.valor)}</td>
            <td><span class="status-mini ${at?"atrasado":"pendente"}">${at?"Em atraso":"Pendente"}</span></td>
          </tr>`;
        }).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:14px;font-size:11px">Nenhuma conta a pagar</td></tr>`}
      </tbody>
    </table>
    ${aPagar.length ? `<div class="mini-table-total">
      <span>Total a pagar</span>
      <strong style="color:var(--error)">${fmtBRL(aPagar.reduce((s,l)=>s+Number(l.valor),0))}</strong>
    </div>` : ""}
  </div>

  <!-- Avisos e Notificações -->
  <div class="dash-panel">
    <div class="panel-header">
      <span class="panel-title">AVISOS E NOTIFICAÇÕES</span>
      <span class="badge-notif-count">${vencidos.length + estAlerts.length + (emProd>0?1:0)}</span>
    </div>
    <div class="avisos-lista">
      ${vencidos.length ? `
      <div class="aviso-item error">
        <div class="aviso-icon"><i class="fi fi-rr-exclamation"></i></div>
        <div class="aviso-body">
          <div class="aviso-titulo">${vencidos.length} conta${vencidos.length>1?"s":""} a receber vencida${vencidos.length>1?"s":""}</div>
          <div class="aviso-sub">Total: ${fmtBRL(vencidos.reduce((s,l)=>s+Number(l.valor),0))}</div>
        </div>
        <div class="aviso-tempo">Hoje</div>
      </div>` : ""}
      ${emProd > 0 ? `
      <div class="aviso-item warn">
        <div class="aviso-icon"><i class="fi fi-rr-print"></i></div>
        <div class="aviso-body">
          <div class="aviso-titulo">${emProd} pedido${emProd>1?"s":""} em produção</div>
          <div class="aviso-sub">Acompanhe o andamento</div>
        </div>
        <div class="aviso-tempo">Agora</div>
      </div>` : ""}
      ${estAlerts.slice(0,2).map(m=>`
      <div class="aviso-item warn">
        <div class="aviso-icon"><i class="fi fi-rr-box"></i></div>
        <div class="aviso-body">
          <div class="aviso-titulo">Estoque de ${esc(m.nome)} ${Number(m.saldo)<=0?"zerado":"baixo"}</div>
          <div class="aviso-sub">Reabasteca o quanto antes</div>
        </div>
        <div class="aviso-tempo">Hoje</div>
      </div>`).join("")}
      ${(vencidos.length + estAlerts.length + emProd) === 0 ? `
      <div style="text-align:center;padding:24px;color:var(--muted);font-size:12px">
        <i class="fi fi-rr-check-circle" style="font-size:22px;color:var(--success);display:block;margin-bottom:8px"></i>
        Tudo em dia! Sem avisos pendentes.
      </div>` : ""}
    </div>
  </div>

</div>

<!-- ④ VENDAS POR SITUAÇÃO | TOP 5 PRODUTOS | TOP 5 CLIENTES | INDICADORES -->
<div class="dash-row4">

  <!-- Vendas por Situação -->
  <div class="dash-panel">
    <div class="panel-header"><span class="panel-title">VENDAS POR SITUAÇÃO</span></div>
    <div style="display:flex;gap:14px;align-items:center">
      <div style="flex-shrink:0">
        ${fatias.length
          ? donutChart(fatias)
          : `<div style="width:130px;height:130px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px">Sem vendas</div>`}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:5px">
        ${STATUS.map(s=>{
          const count=r.vendas.lista.filter(v=>v.status===s.id).length;
          const pct=r.vendas.total>0?((count/r.vendas.total)*100).toFixed(0):0;
          return `<div style="display:flex;align-items:center;gap:6px;font-size:11px">
            <div style="width:8px;height:8px;border-radius:50%;background:${s.cor};flex-shrink:0"></div>
            <span style="flex:1;color:var(--muted)">${s.label}</span>
            <span style="font-weight:700">${count} (${pct}%)</span>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>

  <!-- Top 5 Produtos -->
  <div class="dash-panel">
    <div class="panel-header">
      <span class="panel-title">TOP 5 PRODUTOS</span>
      <span class="panel-tag">Este mês</span>
    </div>
    <div class="top5-lista">
      ${top5Produtos.length
        ? top5Produtos.map(([nome,val],i)=>`
          <div class="top5-item">
            <span class="top5-rank">${i+1}</span>
            <span class="top5-nome">${esc(nome)}</span>
            <span class="top5-val">${fmtBRL(val)}</span>
          </div>`).join("")
        : Array.from({length:5},(_,i)=>`
          <div class="top5-item">
            <span class="top5-rank">${i+1}</span>
            <span class="top5-nome" style="color:var(--muted)">—</span>
            <span class="top5-val">R$ 0,00</span>
          </div>`).join("")}
    </div>
  </div>

  <!-- Top 5 Clientes -->
  <div class="dash-panel">
    <div class="panel-header">
      <span class="panel-title">TOP 5 CLIENTES</span>
      <span class="panel-tag">Este mês</span>
    </div>
    <div class="top5-lista">
      ${top5Clientes.length
        ? top5Clientes.map(([nome,val],i)=>`
          <div class="top5-item">
            <span class="top5-rank">${i+1}</span>
            <span class="top5-nome">${esc(nome)}</span>
            <span class="top5-val">${fmtBRL(val)}</span>
          </div>`).join("")
        : Array.from({length:5},(_,i)=>`
          <div class="top5-item">
            <span class="top5-rank">${i+1}</span>
            <span class="top5-nome" style="color:var(--muted)">—</span>
            <span class="top5-val">R$ 0,00</span>
          </div>`).join("")}
    </div>
  </div>

  <!-- Indicadores Financeiros -->
  <div class="dash-panel">
    <div class="panel-header">
      <span class="panel-title" style="display:flex;align-items:center;gap:5px">
        <i class="fi fi-rr-chart-pie-alt" style="color:var(--primary)"></i> INDICADORES FINANCEIROS
      </span>
    </div>
    <div class="indicadores-grid">
      <div class="indicador-item">
        <div class="ind-icon" style="background:rgba(0,196,154,.12);color:#00c49a"><i class="fi fi-rr-ticket"></i></div>
        <div>
          <div class="ind-label">Ticket Médio</div>
          <div class="ind-val">${fmtBRL(ticketMedio)}</div>
          <div class="ind-delta pos">↑ ${r.vendas.total} vendas</div>
        </div>
      </div>
      <div class="indicador-item">
        <div class="ind-icon" style="background:rgba(167,139,250,.12);color:#a78bfa"><i class="fi fi-rr-chart-line-up"></i></div>
        <div>
          <div class="ind-label">Margem de Lucro</div>
          <div class="ind-val">${fin.margem}%</div>
          <div class="ind-delta ${Number(fin.margem)>=0?"pos":"neg"}">↑ ${fin.margem}%</div>
        </div>
      </div>
      <div class="indicador-item">
        <div class="ind-icon" style="background:rgba(229,57,53,.10);color:#e53935"><i class="fi fi-rr-hand-holding-usd"></i></div>
        <div>
          <div class="ind-label">Inadimplência</div>
          <div class="ind-val">${inadimp.toFixed(1)}%</div>
          <div class="ind-delta ${inadimp>5?"neg":"pos"}">↓ ${inadimp.toFixed(1)}%</div>
        </div>
      </div>
      <div class="indicador-item">
        <div class="ind-icon" style="background:rgba(116,192,252,.12);color:#74c0fc"><i class="fi fi-rr-stats"></i></div>
        <div>
          <div class="ind-label">Crescimento Mensal</div>
          <div class="ind-val">${fin.margem}%</div>
          <div class="ind-delta pos">↑ ${fin.margem}%</div>
        </div>
      </div>
      <div class="indicador-item">
        <div class="ind-icon" style="background:rgba(255,179,0,.10);color:#ffb300"><i class="fi fi-rr-shopping-cart"></i></div>
        <div>
          <div class="ind-label">Pedidos em Aberto</div>
          <div class="ind-val">${pedAberto}</div>
          <button class="ind-link" onclick="window.location.hash='vendas'">Ver pedidos</button>
        </div>
      </div>
      <div class="indicador-item">
        <div class="ind-icon" style="background:rgba(105,219,124,.12);color:#69db7c"><i class="fi fi-rr-print"></i></div>
        <div>
          <div class="ind-label">Produção em Andamento</div>
          <div class="ind-val">${emProd}</div>
          <button class="ind-link" onclick="window.location.hash='producao'">Acompanhar</button>
        </div>
      </div>
    </div>
  </div>

</div></div>`;
  }

  afterRender() {
    this.$("#filtro-mes")?.addEventListener("change", async e => {
      this.#mes = e.target.value;
      actions.setCache(`dashboard_${this.#mes}`, null);
      await this.#load();
    });
    this.$("#btn-toggle-values")?.addEventListener("click", () => {
      this.#ocultarDados = !this.#ocultarDados;
      localStorage.setItem("dashboard_ocultar_dados", String(this.#ocultarDados));
      this.refresh();
    });
    this.$("#btn-refresh")?.addEventListener("click", () => this.#reload());
  }

  #kpi4(label, value, spkData, cor, icon, tendencia) {
    // Calcula % vs mês anterior
    const len = tendencia?.length || 0;
    let pct = 0;
    if (len >= 2) {
      const curr = tendencia[len-1]?.receitas || 0;
      const prev = tendencia[len-2]?.receitas || 0;
      pct = prev > 0 ? ((curr-prev)/prev*100) : 0;
    }
    const pos = pct >= 0;
    return `
<div class="kpi4-card" style="--kc:${cor}">
  <div class="kpi4-top">
    <div class="kpi4-icon"><i class="fi ${icon}"></i></div>
    <div class="kpi4-info">
      <div class="kpi4-label">${label.toUpperCase()}</div>
      <div class="kpi4-value">${value}</div>
      <div class="kpi4-delta ${pos?"pos":"neg"}">
        ${pos?"↑":"↓"} ${Math.abs(pct).toFixed(1)}% vs mês anterior
      </div>
    </div>
  </div>
  <div class="kpi4-spark">${sparkline(spkData, cor)}</div>
</div>`;
  }

  #dreRow(label, val, cor, negativo, bold) {
    const v = negativo ? -Math.abs(val) : val;
    const fs = bold ? "13px" : "12px";
    const fw = bold ? "700" : "500";
    return `<div class="dre-row" style="font-size:${fs};font-weight:${fw}">
  <span>${label}</span>
  <span style="color:${cor};font-weight:700">${negativo&&val>0?"- ":""}${fmtBRL(Math.abs(val))}</span>
</div>`;
  }
}

/* ── CSS ────────────────────────────────────────────────────────────────── */
function dashCSS(){return`
/* Saudação */
.dash-greeting-row{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px}
h2.dash-greeting{font-size:20px;font-weight:800;margin:0 0 4px!important;line-height:1.15}
.dash-greeting-sub{font-size:12px;color:var(--muted);margin:0}
.dash-header-actions{display:flex;align-items:center;gap:8px}
.dash-mes-label{font-size:12.5px;font-weight:600;color:var(--text-sub)}
.month-input{background:var(--panel2);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:6px 10px;font-size:12px;font-family:var(--font);outline:none}
.month-input:focus{border-color:var(--primary)}
[data-theme="light"] .month-input{background:#fff}
.btn-refresh-icon{display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:transparent;border:1px solid var(--border-md);border-radius:var(--radius-md);color:var(--muted);cursor:pointer;font-size:14px;transition:all var(--t)}
.btn-refresh-icon:hover{background:var(--panel3);color:var(--text)}
.btn-toggle-values{color:var(--primary-light)}
.dash-hidden .kpi4-value,
.dash-hidden .pe-item strong,
.dash-hidden .dre-row span:last-child,
.dash-hidden .dre-row-margem strong,
.dash-hidden .mini-table td:nth-child(3),
.dash-hidden .mini-table-total strong,
.dash-hidden .aviso-sub,
.dash-hidden .top5-val,
.dash-hidden .ind-val,
.dash-hidden .ind-delta,
.dash-hidden .dash-chart-svg,
.dash-hidden .kpi4-spark svg{filter:blur(5px);user-select:none;pointer-events:none}

/* KPI 4 cards */
.kpi4-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
@media(max-width:900px){.kpi4-grid{grid-template-columns:1fr 1fr}}
@media(max-width:480px){.kpi4-grid{grid-template-columns:1fr}}
.kpi4-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--shadow-xs);transition:transform .15s,box-shadow .15s}
[data-theme="light"] .kpi4-card{box-shadow:var(--shadow-sm)}
.kpi4-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
.kpi4-top{display:flex;align-items:flex-start;gap:10px}
.kpi4-icon{width:36px;height:36px;border-radius:var(--radius-md);background:color-mix(in srgb,var(--kc) 14%,transparent);display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--kc);flex-shrink:0}
.kpi4-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.kpi4-value{font-size:17px;font-weight:800;color:var(--text);line-height:1.1;margin:2px 0}
.kpi4-delta{font-size:10px;font-weight:600}
.kpi4-delta.pos{color:var(--success)}.kpi4-delta.neg{color:var(--error)}
.kpi4-spark{line-height:0}

/* Row 3 colunas */
.dash-row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px;align-items:stretch}
@media(max-width:1100px){.dash-row3{grid-template-columns:1fr 1fr}}
@media(max-width:720px){.dash-row3{grid-template-columns:1fr}}

/* Row 4 colunas */
.dash-row4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px}
@media(max-width:1100px){.dash-row4{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.dash-row4{grid-template-columns:1fr}}

/* Panel */
.dash-panel{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;box-shadow:var(--shadow-xs);min-width:0;overflow:hidden}
[data-theme="light"] .dash-panel{box-shadow:var(--shadow-sm)}
.panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px}
.panel-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);line-height:1.3}
.panel-tag{font-size:9.5px;font-weight:600;color:var(--primary);background:var(--primary-bg);border:1px solid var(--primary-border);border-radius:999px;padding:2px 7px;white-space:nowrap}
.chart-legend{display:flex;gap:8px;flex-wrap:wrap}
.leg-item{display:flex;align-items:center;gap:4px;font-size:9.5px;color:var(--muted)}
.leg-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.chart-empty{color:var(--muted);font-size:11px;padding:12px 0;text-align:center}
.dash-chart-scroll{width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;padding:4px 0 2px}
.dash-chart-svg{display:block;width:100%;height:auto;max-width:100%;overflow:hidden}
.dash-bar-svg{min-width:360px}
.pe-chart-svg{max-width:260px;margin:0 auto}
.dre-mes{font-size:9.5px;font-weight:600;color:var(--muted);white-space:nowrap}
.btn-ver-todas{background:transparent;border:none;color:var(--primary);font-size:10.5px;font-weight:600;cursor:pointer;font-family:var(--font);padding:0;text-decoration:underline;text-underline-offset:2px}
.btn-ver-todas:hover{color:var(--primary-light)}
.badge-notif-count{background:var(--error);color:#fff;font-size:9.5px;font-weight:800;border-radius:99px;padding:2px 7px;min-width:20px;text-align:center}

/* Ponto de equilíbrio */
.pe-layout{display:grid;grid-template-columns:minmax(0,.9fr) minmax(220px,1.1fr);gap:14px;align-items:start}
.pe-nums{display:flex;flex-direction:column;gap:5px;padding-top:4px}
.pe-item{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:11.5px;padding:5px 0;border-bottom:.5px solid var(--border)}
.pe-item:last-child{border-bottom:none}
.pe-item span{color:var(--muted);line-height:1.2}
.pe-item strong{font-weight:700;white-space:nowrap}
.pe-item-total{background:var(--panel3);border-radius:var(--radius-sm);padding:7px 8px;margin:3px 0}
.pe-item-total strong{color:var(--primary)!important}
.pe-chart-wrap{margin-top:0;min-width:0}
.pe-chart-title{font-size:9.5px!important;margin-bottom:6px!important}
.pe-chart-legend{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}
@media(max-width:900px){.pe-layout{grid-template-columns:minmax(0,1fr) 210px}.pe-chart-svg{max-width:210px}.pe-item{font-size:11px;padding:4px 0}}
@media(max-width:720px){.pe-layout{grid-template-columns:1fr}.pe-chart-svg{max-width:260px}}

/* DRE */
.dre-lista{display:flex;flex-direction:column;gap:0}
.dre-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:.5px solid var(--border)}
.dre-row:last-child{border-bottom:none}
.dre-sep{height:1px;background:var(--border-md);margin:4px 0}
.dre-row-margem{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--panel3);border-radius:var(--radius-sm);margin-top:4px;font-size:12.5px;font-weight:600}

/* Mini table */
.mini-table{width:100%;border-collapse:collapse;font-size:11.5px}
.mini-table th{text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:0 0 7px;border-bottom:1px solid var(--border)}
.mini-table td{padding:6px 0;border-bottom:.5px solid var(--border);vertical-align:middle}
.mini-table tr:last-child td{border-bottom:none}
.status-mini{font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px;white-space:nowrap}
.status-mini.pendente{background:rgba(247,144,9,.12);color:#F79009}
.status-mini.atrasado{background:var(--error-bg);color:var(--error)}
.mini-table-total{display:flex;justify-content:space-between;align-items:center;padding:8px 0 0;font-size:12px;font-weight:600;border-top:1px solid var(--border-md);margin-top:4px}

/* Avisos */
.avisos-lista{display:flex;flex-direction:column;gap:8px}
.aviso-item{display:flex;align-items:flex-start;gap:10px;padding:8px;border-radius:var(--radius-md)}
.aviso-item.error{background:rgba(229,57,53,.07);border-left:3px solid var(--error)}
.aviso-item.warn{background:rgba(255,179,0,.07);border-left:3px solid var(--warning)}
.aviso-item.ok{background:var(--success-bg);border-left:3px solid var(--success)}
.aviso-icon{font-size:15px;flex-shrink:0;margin-top:1px}
.aviso-item.error .aviso-icon{color:var(--error)}
.aviso-item.warn .aviso-icon{color:var(--warning)}
.aviso-item.ok .aviso-icon{color:var(--success)}
.aviso-body{flex:1;min-width:0}
.aviso-titulo{font-size:12px;font-weight:700;line-height:1.3}
.aviso-sub{font-size:10.5px;color:var(--muted);margin-top:1px}
.aviso-tempo{font-size:9.5px;color:var(--muted);white-space:nowrap;flex-shrink:0}

/* Top 5 */
.top5-lista{display:flex;flex-direction:column;gap:6px}
.top5-item{display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;border-bottom:.5px solid var(--border)}
.top5-item:last-child{border-bottom:none}
.top5-rank{width:16px;height:16px;border-radius:50%;background:var(--primary-bg);color:var(--primary-light);font-size:9.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.top5-nome{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.top5-val{font-weight:700;color:var(--primary-light);white-space:nowrap;font-size:11.5px}

/* Indicadores */
.indicadores-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.indicador-item{display:flex;align-items:flex-start;gap:8px}
.ind-icon{width:28px;height:28px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.ind-label{font-size:9.5px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.ind-val{font-size:14px;font-weight:800;line-height:1.2;color:var(--text)}
.ind-delta{font-size:9.5px;font-weight:600}
.ind-delta.pos{color:var(--success)}.ind-delta.neg{color:var(--error)}
.ind-link{background:transparent;border:none;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font);padding:0;text-decoration:underline;text-underline-offset:2px}
`;}
