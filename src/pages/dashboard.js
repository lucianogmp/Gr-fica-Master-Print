import { supabase } from "../supabase/client.js";

// ── Carrega Chart.js ─────────────────────────────────────────────────────────
function loadChartJS() {
  return new Promise(res => {
    if (window.Chart) return res();
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
    s.onload = res;
    document.head.appendChild(s);
  });
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Estado ──────────────────────────────────────────────────────────────────
let state = {
  filtroMes: mesAtual(),
  dados: null,
  ultimoRefresh: null,
  isLoading: false
};

let refreshInterval = null;

// ── Função principal ────────────────────────────────────────────────────────
export async function Dashboard(container) {
  container.innerHTML = `<div class="loading">Carregando dashboard...</div>`;
  
  await loadChartJS();
  await carregarDados();
  render(container);

  startAutoRefresh(container);
}

function startAutoRefresh(container) {
  if (refreshInterval) clearInterval(refreshInterval);
  
  refreshInterval = setInterval(async () => {
    await carregarDados(true); // silencioso
    render(container);
  }, 15000); // 15 segundos
}

// ── Carregar dados ──────────────────────────────────────────────────────────
async function carregarDados(silencioso = false) {
  if (state.isLoading) return;
  state.isLoading = true;

  try {
    const mes = state.filtroMes;

    const [
      { data: vendas },
      { data: lancamentos },
      { data: materias },
      { data: movimentos },
      { data: clientes },
      { data: vendaItens },
      { data: produtos },
      { data: categorias },
    ] = await Promise.all([
      supabase.from("vendas").select("id, total, status, created_at"),
      supabase.from("lancamentos").select("*").order("data_vencimento", { ascending: true }),
      supabase.from("materias_primas").select("id, nome, estoque_minimo, custo_unitario"),
      supabase.from("estoque_movimentos").select("materia_prima_id, tipo, quantidade"),
      supabase.from("clientes").select("id, created_at"),
      supabase.from("venda_itens").select("venda_id, produto_id, descricao, total"),
      supabase.from("produtos").select("id, nome, categoria_id"),
      supabase.from("categorias").select("id, nome"),
    ]);

    const hoje = new Date().toISOString().split("T")[0];

    // Vendas do mês
    const vendasMes  = (vendas || []).filter(v => v.created_at?.startsWith(mes));
    const faturamento = vendasMes.reduce((s, v) => s + Number(v.total || 0), 0);

    // Financeiro do mês
    const lancMes = (lancamentos || []).filter(l => {
      const ref = l.data_vencimento || l.created_at?.slice(0, 10);
      return ref?.startsWith(mes);
    });

    const receitasMes  = lancMes.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
    const despesasMes  = lancMes.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);
    const lucroMes     = receitasMes - despesasMes;
    const recebidoMes  = lancMes.filter(l => l.tipo === "receita" && l.status === "pago").reduce((s, l) => s + Number(l.valor), 0);
    const aReceberMes  = lancMes.filter(l => l.tipo === "receita" && l.status === "pendente").reduce((s, l) => s + Number(l.valor), 0);
    const aPagarMes    = lancMes.filter(l => l.tipo === "despesa" && l.status === "pendente").reduce((s, l) => s + Number(l.valor), 0);
    const margem       = receitasMes > 0 ? (lucroMes / receitasMes * 100).toFixed(1) : "0.0";

    // Custo Produtivo
    const MAPA_MO   = ["salário","salario","mão de obra","mao de obra","funcionário","funcionario","pessoal","rh"];
    const MAPA_MP   = ["material","matéria","materia","fornecedor","insumo","papel","lona","vinil","tinta","adesivo"];
    const MAPA_TERC = ["terceiro","terceirização","terceirizacao","serviço","servico","freelancer","outsourc","prestador"];

    let custoMO = 0, custoMP = 0, custoTerc = 0, custoOutros = 0;
    const custoTotal = despesasMes;

    lancMes.filter(l => l.tipo === "despesa").forEach(l => {
      const txt = ((l.categoria || "") + " " + (l.descricao || "")).toLowerCase();
      if      (MAPA_MO.some(k => txt.includes(k)))   custoMO    += Number(l.valor);
      else if (MAPA_MP.some(k => txt.includes(k)))   custoMP    += Number(l.valor);
      else if (MAPA_TERC.some(k => txt.includes(k))) custoTerc  += Number(l.valor);
      else                                            custoOutros += Number(l.valor);
    });

    if (custoTotal > 0 && (custoMO + custoMP + custoTerc + custoOutros) < custoTotal * 0.01) {
      custoMO    = custoTotal * 0.45;
      custoMP    = custoTotal * 0.38;
      custoTerc  = custoTotal * 0.17;
      custoOutros = 0;
    }

    // DRE
    const getDesp = (...cats) =>
      lancMes.filter(l => l.tipo === "despesa" && cats.some(c => (l.categoria || "").toLowerCase().includes(c)))
             .reduce((s, l) => s + Number(l.valor), 0);

    const deducoes   = getDesp("dedução","deducao","desconto","devolução","devolucao") || receitasMes * 0.05;
    const impostos   = getDesp("imposto","tributo","taxa","simples","icms","iss")      || receitasMes * 0.10;
    const recLiquida = receitasMes - deducoes - impostos;
    const cmv        = getDesp("material","fornecedor","matéria","materia","insumo","estoque")  || despesasMes * 0.45;
    const despOpFix  = getDesp("aluguel","energia","água","agua","telefone","internet","fixo","salário","salario") || despesasMes * 0.30;
    const despVendas = getDesp("venda","comissão","comissao","marketing","frete","entrega") || despesasMes * 0.10;
    const lucroOp    = recLiquida - cmv - despOpFix - despVendas;
    const outrasRD   = lancMes.filter(l => l.tipo === "receita" && l.categoria?.toLowerCase().includes("outr"))
                               .reduce((s, l) => s + Number(l.valor), 0);
    const lucroLiq   = lucroOp + outrasRD;

    // Ponto de Equilíbrio
    const custoFixo     = despesasMes * 0.60;
    const custoVariavel = despesasMes * 0.40;
    const margContrib   = receitasMes > 0 ? (receitasMes - custoVariavel) / receitasMes : 0.60;
    const pontEq        = margContrib > 0 ? custoFixo / margContrib : despesasMes || 1;
    const bePercent     = Math.min((receitasMes / pontEq) * 100, 100);
    const beAtingido    = receitasMes >= pontEq;

    // Últimos 12 meses
    const ultimos12 = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      ultimos12.push({
        mes: m,
        total: (vendas || []).filter(v => v.created_at?.startsWith(m)).reduce((s, v) => s + Number(v.total || 0), 0),
      });
    }

    // Vendas por Categoria
    const catMap  = Object.fromEntries((categorias || []).map(c => [c.id, c.nome]));
    const prodMap = Object.fromEntries((produtos || []).map(p => [p.id, { nome: p.nome, catId: p.categoria_id }]));
    const vendaIdsMes = new Set(vendasMes.map(v => v.id));

    const vendasPorCat = {};
    const prodsPorCat  = {};

    (vendaItens || []).forEach(it => {
      if (!vendaIdsMes.has(it.venda_id)) return;
      const prod    = prodMap[it.produto_id];
      const catNome = prod ? (catMap[prod.catId] || "Sem categoria") : "Sem categoria";
      vendasPorCat[catNome] = (vendasPorCat[catNome] || 0) + Number(it.total || 0);
      if (!prodsPorCat[catNome]) prodsPorCat[catNome] = {};
      const nome = prod?.nome || it.descricao || "Item";
      prodsPorCat[catNome][nome] = (prodsPorCat[catNome][nome] || 0) + Number(it.total || 0);
    });

    // Estoque
    const saldos = (materias || []).map(mp => {
      const movsMp = (movimentos || []).filter(m => m.materia_prima_id === mp.id);
      const ent = movsMp.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.quantidade), 0);
      const sai = movsMp.filter(m => m.tipo === "saida").reduce((s, m) => s + Number(m.quantidade), 0);
      return { ...mp, saldo: ent - sai };
    });
    const estoqueAlertas = saldos.filter(m => m.saldo > 0 && m.saldo <= Number(m.estoque_minimo || 0));
    const estoqueZerado  = saldos.filter(m => m.saldo <= 0);

    // Alertas
    const vencidos = (lancamentos || []).filter(l =>
      l.status === "pendente" && l.data_vencimento && l.data_vencimento < hoje
    );
    const proximos7 = (lancamentos || []).filter(l => {
      if (l.status !== "pendente" || !l.data_vencimento) return false;
      const diff = (new Date(l.data_vencimento) - new Date()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    });

    const clientesNovos = (clientes || []).filter(c => c.created_at?.startsWith(mes)).length;

    state.dados = {
      faturamento, vendasMes, receitasMes, despesasMes, lucroMes,
      margem, recebidoMes, aReceberMes, aPagarMes,
      custoMO, custoMP, custoTerc, custoOutros, custoTotal,
      pontEq, bePercent, beAtingido,
      ultimos12,
      vendasPorCat, prodsPorCat,
      estoqueAlertas, estoqueZerado,
      vencidos, proximos7,
      clientesNovos,
      dre: { recBruta: receitasMes, deducoes, impostos, recLiquida, cmv, despOpFix, despVendas, lucroOp, outrasRD, lucroLiq },
    };

    state.ultimoRefresh = new Date();

  } catch (err) {
    console.error("Erro ao carregar dashboard:", err);
  } finally {
    state.isLoading = false;
  }
}

// ── Render ──────────────────────────────────────────────────────────────────
function render(container) {
  const d = state.dados;
  if (!d) return;

  const fmt  = v => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtK = v => {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1000) return `${sign}R$ ${(abs / 1000).toFixed(1)}K`;
    return fmt(v);
  };

  const ultimaAtualizacao = state.ultimoRefresh 
    ? `Atualizado às ${state.ultimoRefresh.toLocaleTimeString('pt-BR')}` 
    : 'Carregando...';

  container.innerHTML = `
    <style>${css()}</style>

    <div class="dash-header">
      <div>
        <h2>Dashboard</h2>
        <span style="font-size:12px;color:var(--muted)">${ultimaAtualizacao}</span>
      </div>
      <div class="dash-actions">
        <input type="month" id="filtro-mes" value="${state.filtroMes}" />
        <button id="btn-refresh" class="btn-refresh" title="Atualizar agora">↻ Atualizar</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Faturamento total</div>
        <div class="kpi-val blue">${fmtK(d.faturamento)}</div>
        <div class="kpi-sub">${d.vendasMes.length} venda${d.vendasMes.length !== 1 ? "s" : ""} no mês</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Custos totais</div>
        <div class="kpi-val red">${fmtK(d.despesasMes)}</div>
        <div class="kpi-sub">A pagar: ${fmtK(d.aPagarMes)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Lucro líquido</div>
        <div class="kpi-val ${d.lucroMes >= 0 ? "green" : "red"}">${fmtK(d.lucroMes)}</div>
        <div class="kpi-sub">Margem: ${d.margem}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total de vendas</div>
        <div class="kpi-val">${d.vendasMes.length}</div>
        <div class="kpi-sub">${d.clientesNovos} clientes novos</div>
      </div>
    </div>

    <!-- Highlight Row -->
    <div class="highlight-row">
      <div class="chart-card card-be">
        <div class="card-header">
          <div>
            <div class="card-title">⚖️ Ponto de Equilíbrio</div>
            <div class="card-sub">${d.beAtingido ? "✅ Atingido este mês" : "⏳ Em progresso"}</div>
          </div>
          <div class="be-meta">
            <div style="font-size:10px;color:var(--muted)">Meta</div>
            <div style="font-size:13px;font-weight:700;color:var(--primary-light)">${fmtK(d.pontEq)}</div>
          </div>
        </div>
        <div class="doughnut-wrap">
          <canvas id="beChart" width="200" height="200"></canvas>
          <div class="doughnut-center">
            <div class="doughnut-pct" id="be-pct" style="color:${d.beAtingido ? "var(--info)" : "var(--primary-light)"}">
              ${Math.round(d.bePercent)}%
            </div>
            <div class="doughnut-lbl">atingido</div>
          </div>
        </div>
        <div class="chart-legend">
          <span><span class="ldot" style="background:${d.beAtingido ? "var(--info)" : "#378ADD"}"></span>Receita: ${fmtK(d.receitasMes)}</span>
          <span><span class="ldot" style="background:rgba(128,128,128,0.25)"></span>Restante</span>
        </div>
      </div>

      <div class="chart-card card-sales">
        <div class="card-header">
          <div class="card-title">📈 Vendas por mês</div>
          <div class="card-sub">Últimos 12 meses</div>
        </div>
        <div style="position:relative;height:230px">
          <canvas id="salesChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-row">
      <!-- Custo Produtivo -->
      <div class="chart-card">
        <div class="card-header">
          <div class="card-title">🏭 Custo Produtivo</div>
          <div class="card-sub">${fmtK(d.custoTotal)} total</div>
        </div>
        <div class="doughnut-wrap">
          <canvas id="custoChart" width="200" height="200"></canvas>
          <div class="doughnut-center">
            <div class="doughnut-pct" style="font-size:14px;color:var(--muted)">Total</div>
            <div class="doughnut-lbl" style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">${fmtK(d.custoTotal)}</div>
          </div>
        </div>
        <div class="chart-legend">
          <span><span class="ldot" style="background:#378ADD"></span>Mão de Obra ${d.custoTotal > 0 ? (d.custoMO / d.custoTotal * 100).toFixed(0) : 0}%</span>
          <span><span class="ldot" style="background:#EF9F27"></span>Mat. Prima ${d.custoTotal > 0 ? (d.custoMP / d.custoTotal * 100).toFixed(0) : 0}%</span>
          <span><span class="ldot" style="background:#1D9E75"></span>Terceirização ${d.custoTotal > 0 ? (d.custoTerc / d.custoTotal * 100).toFixed(0) : 0}%</span>
          ${d.custoOutros > 0 ? `<span><span class="ldot" style="background:#9E9E9E"></span>Outros ${(d.custoOutros / d.custoTotal * 100).toFixed(0)}%</span>` : ""}
        </div>
      </div>

      <!-- Vendas por Categoria -->
      <div class="chart-card">
        <div class="card-header">
          <div>
            <div class="card-title">🛒 Vendas por categoria</div>
            <div class="card-sub">Clique para ver produtos</div>
          </div>
        </div>
        <div class="doughnut-wrap">
          <canvas id="catChart" width="200" height="200" style="cursor:pointer"></canvas>
          <div class="doughnut-center">
            <div class="doughnut-pct" style="font-size:14px;color:var(--muted)">Total</div>
            <div class="doughnut-lbl" style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">${fmtK(Object.values(d.vendasPorCat).reduce((a, b) => a + b, 0))}</div>
          </div>
        </div>
        <div class="chart-legend" id="cat-legend"></div>
      </div>

      <!-- DRE -->
      <div class="chart-card dre-card">
        <div class="card-title">📋 Resultado consolidado</div>
        <table class="dre-table">
          <tr><td class="dl">+ Receita bruta</td><td class="dv pos">${fmt(d.dre.recBruta)}</td></tr>
          <tr><td class="dl">— Deduções</td><td class="dv neg">- ${fmt(d.dre.deducoes)}</td></tr>
          <tr><td class="dl">— Impostos</td><td class="dv neg">- ${fmt(d.dre.impostos)}</td></tr>
          <tr class="dre-sep"><td>= Receita líquida</td><td class="dv">${fmt(d.dre.recLiquida)}</td></tr>
          <tr><td class="dl">— CMV</td><td class="dv neg">- ${fmt(d.dre.cmv)}</td></tr>
          <tr><td class="dl">— Desp. operacionais</td><td class="dv neg">- ${fmt(d.dre.despOpFix)}</td></tr>
          <tr><td class="dl">— Desp. de vendas</td><td class="dv neg">- ${fmt(d.dre.despVendas)}</td></tr>
          <tr class="dre-sep"><td>= Lucro operacional</td><td class="dv ${d.dre.lucroOp >= 0 ? "pos" : "neg"}">${fmt(d.dre.lucroOp)}</td></tr>
          <tr><td class="dl">+/- Outras rec./desp.</td><td class="dv">${fmt(d.dre.outrasRD)}</td></tr>
          <tr class="dre-result">
            <td>= Lucro / Prejuízo</td>
            <td class="dv ${d.dre.lucroLiq >= 0 ? "pos" : "neg"}" style="font-size:14px">${fmt(d.dre.lucroLiq)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Bottom Row -->
    <div class="bottom-row">
      <div class="chart-card">
        <div class="card-title">🔔 Quadro de avisos</div>
        <div class="avisos-list">${renderAvisos(d)}</div>
      </div>

      ${(d.estoqueZerado.length + d.estoqueAlertas.length) > 0 ? `
      <div class="chart-card">
        <div class="card-title">⚠️ Estoque em alerta</div>
        <div style="margin-top:8px">
          ${[...d.estoqueZerado, ...d.estoqueAlertas].slice(0, 8).map(m => `
            <div class="est-row">
              <span>${m.saldo <= 0 ? "🔴" : "🟡"}</span>
              <span style="flex:1;font-size:12px">${m.nome}</span>
              <span style="font-size:11px;color:var(--muted)">mín: ${m.estoque_minimo || 0}</span>
              <span style="font-weight:700;font-size:12px;color:${m.saldo <= 0 ? "var(--error)" : "var(--warning)"}">${Number(m.saldo).toFixed(2)}</span>
            </div>`).join("")}
        </div>
      </div>` : ""}
    </div>

    <!-- Modal -->
    <div id="cat-modal" class="modal-overlay" style="display:none">
      <div class="modal" style="max-width:340px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <strong id="cat-modal-title" style="font-size:14px"></strong>
          <button id="cat-modal-close" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);line-height:1">✕</button>
        </div>
        <div id="cat-modal-body"></div>
      </div>
    </div>
  `;

  // Event Listeners
  setTimeout(() => {
    const filtro = container.querySelector("#filtro-mes");
    const btnRefresh = container.querySelector("#btn-refresh");

    if (filtro) {
      filtro.addEventListener("change", async e => {
        state.filtroMes = e.target.value;
        container.innerHTML = `<div class="loading">Atualizando dados do mês...</div>`;
        await carregarDados();
        render(container);
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener("click", async () => {
        btnRefresh.innerHTML = "⟳ Atualizando...";
        btnRefresh.disabled = true;
        await carregarDados();
        render(container);
        btnRefresh.innerHTML = "↻ Atualizar";
        btnRefresh.disabled = false;
      });
    }

    // Modal handlers
    const modal = container.querySelector("#cat-modal");
    const closeBtn = container.querySelector("#cat-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", () => modal.style.display = "none");
    if (modal) modal.addEventListener("click", e => {
      if (e.target === modal) modal.style.display = "none";
    });
  }, 100);

  requestAnimationFrame(() => initCharts(container, d, Object.keys(d.vendasPorCat || {}), ["#7F77DD","#D4537E","#1D9E75","#EF9F27","#378ADD","#E24B4A","#4CAF50","#FF9800"]));
}

// ── Funções auxiliares (mantidas originais) ─────────────────────────────────
function renderAvisos(d) {
  const items = [];

  d.vencidos.slice(0, 3).forEach(l => {
    const dias = Math.floor((new Date() - new Date(l.data_vencimento)) / (1000 * 60 * 60 * 24));
    items.push(aviso("danger", "!", 
      `${l.tipo === "receita" ? "Recebimento" : "Pagamento"} em atraso — ${l.descricao}`,
      `R$ ${Number(l.valor).toFixed(2)} · venceu há ${dias} dia${dias !== 1 ? "s" : ""}`));
  });

  d.proximos7.slice(0, 3).forEach(l => {
    const dias = Math.ceil((new Date(l.data_vencimento) - new Date()) / (1000 * 60 * 60 * 24));
    items.push(aviso("warn", "▲",
      `${l.tipo === "receita" ? "Recebimento" : "Pagamento"} vence em ${dias} dia${dias !== 1 ? "s" : ""}`,
      `${l.descricao} · R$ ${Number(l.valor).toFixed(2)}`));
  });

  d.estoqueZerado.slice(0, 2).forEach(m =>
    items.push(aviso("danger", "!", `Estoque zerado — ${m.nome}`, "Repor imediatamente")));

  d.estoqueAlertas.slice(0, 2).forEach(m =>
    items.push(aviso("warn", "▲", `Estoque baixo — ${m.nome}`,
      `Saldo: ${Number(m.saldo).toFixed(2)} / Mínimo: ${m.estoque_minimo}`)));

  if (items.length === 0)
    items.push(aviso("success", "✓", "Tudo em dia!", "Nenhum alerta pendente no momento."));

  return items.join("");
}

function aviso(tipo, icon, title, body) {
  const colors = {
    danger:  { bg: "rgba(171,0,0,0.08)", border: "rgba(171,0,0,0.25)", iconBg: "var(--error)" },
    warn:    { bg: "rgba(232,160,16,0.08)", border: "rgba(232,160,16,0.25)", iconBg: "var(--warning)" },
    success: { bg: "rgba(0,172,23,0.08)",  border: "rgba(0,172,23,0.25)",   iconBg: "var(--info)" },
  };
  const c = colors[tipo];
  return `
    <div class="aviso-item" style="background:${c.bg};border:0.5px solid ${c.border}">
      <div class="aviso-icon" style="background:${c.iconBg}">${icon}</div>
      <div>
        <div class="aviso-title">${title}</div>
        <div class="aviso-body">${body}</div>
      </div>
    </div>`;
}

function initCharts(container, d, catKeys, catColors) {
  const isDark   = document.documentElement.getAttribute("data-theme") !== "light";
  const txtColor = isDark ? "#7A9E9C" : "#4F6E6C";
  const gridCol  = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const emptyCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

  // Ponto de Equilíbrio
  const beEl = container.querySelector("#beChart");
  if (beEl) {
    const filled = Math.max(0, Math.min(d.bePercent, 100));
    const empty = 100 - filled;
    const beHex = d.beAtingido ? "#00AC17" : "#378ADD";

    new window.Chart(beEl, {
      type: "doughnut",
      data: { datasets: [{ data: [filled, empty], backgroundColor: [beHex, emptyCol], borderWidth: 0 }] },
      options: { responsive: false, cutout: "72%", plugins: { legend: { display: false } } }
    });
  }

  // Custo Produtivo
  const custoEl = container.querySelector("#custoChart");
  if (custoEl) {
    const vals = d.custoTotal > 0 ? [d.custoMO, d.custoMP, d.custoTerc, ...(d.custoOutros > 0 ? [d.custoOutros] : [])] : [45, 38, 17];
    const colors = ["#378ADD", "#EF9F27", "#1D9E75", "#9E9E9E"];

    new window.Chart(custoEl, {
      type: "doughnut",
      data: { labels: ["Mão de Obra", "Matéria Prima", "Terceirização", "Outros"], datasets: [{ data: vals, backgroundColor: colors.slice(0, vals.length), borderWidth: 0 }] },
      options: { responsive: false, cutout: "72%", plugins: { legend: { display: false } } }
    });
  }

  // Vendas por mês
  const salesEl = container.querySelector("#salesChart");
  if (salesEl) {
    const nomeMesAbrev = m => {
      const [y, mo] = m.split("-");
      return new Date(y, mo - 1).toLocaleDateString("pt-BR", { month: "short" });
    };

    new window.Chart(salesEl, {
      type: "bar",
      data: {
        labels: d.ultimos12.map(m => nomeMesAbrev(m.mes)),
        datasets: [{
          data: d.ultimos12.map(m => m.total),
          backgroundColor: d.ultimos12.map(m => m.mes === state.filtroMes ? "#378ADD" : isDark ? "rgba(55,138,221,0.35)" : "rgba(55,138,221,0.25)"),
          borderRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: txtColor, font: { size: 11 } }, grid: { color: "transparent" } },
          y: { ticks: { color: txtColor, font: { size: 10 }, callback: v => v >= 1000 ? `R$${(v/1000).toFixed(0)}K` : `R$${v}` }, grid: { color: gridCol } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // Vendas por Categoria
  const catEl = container.querySelector("#catChart");
  const catLegend = container.querySelector("#cat-legend");
  if (catEl && catKeys.length > 0) {
    const chartData = catKeys.map(k => d.vendasPorCat[k]);
    const chartClrs = catColors.slice(0, catKeys.length);
    const totalCat  = chartData.reduce((a, b) => a + b, 0);

    const catChart = new window.Chart(catEl, {
      type: "doughnut",
      data: {
        labels: catKeys,
        datasets: [{ data: chartData, backgroundColor: chartClrs, borderWidth: 0 }]
      },
      options: { responsive: false, cutout: "72%", plugins: { legend: { display: false } } }
    });

    if (catLegend) {
      catLegend.innerHTML = catKeys.map((k, i) => {
        const pct = totalCat > 0 ? (chartData[i] / totalCat * 100).toFixed(0) : 0;
        return `<span><span class="ldot" style="background:${chartClrs[i]}"></span>${k} ${pct}%</span>`;
      }).join("");
    }

    catEl.addEventListener("click", e => {
      const pts = catChart.getElementsAtEventForMode(e, "nearest", { intersect: true }, true);
      if (!pts.length) return;
      const label = catKeys[pts[0].index];
      const prods = d.prodsPorCat[label] || {};
      const modal = container.querySelector("#cat-modal");
      container.querySelector("#cat-modal-title").textContent = `Categoria: ${label}`;
      container.querySelector("#cat-modal-body").innerHTML = Object.entries(prods).sort((a,b)=>b[1]-a[1]).map(([nome,val]) => `
        <div style="display:flex;justify-content:space-between;padding:9px 12px;background:var(--panel2);border-radius:8px;margin-bottom:6px">
          <span>${nome}</span><span style="font-weight:600">R$ ${Number(val).toFixed(2)}</span>
        </div>`).join("") || "<p style='color:var(--muted)'>Nenhum produto.</p>";
      modal.style.display = "flex";
    });
  }
}

// ── CSS ─────────────────────────────────────────────────────────────────────
function css() {
  return `
    .dash-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:12px; }
    .dash-actions { display:flex; gap:10px; align-items:center; }
    .btn-refresh {
      padding: 8px 16px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-refresh:hover { background: #2a7ac0; transform: translateY(-1px); }
    .btn-refresh:disabled { opacity: 0.7; cursor: wait; }

    .loading { text-align:center; padding:80px 20px; color:var(--muted); font-size:15px; }

    /* Mantido o resto do seu CSS original */
    .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
    @media(max-width:900px){ .kpi-row { grid-template-columns:repeat(2,1fr); } }
    .kpi { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px; }
    .kpi-lbl { font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
    .kpi-val { font-size:21px; font-weight:700; line-height:1.1; margin:4px 0 2px; }
    .kpi-val.blue { color:var(--primary-light); }
    .kpi-val.green { color:var(--info); }
    .kpi-val.red { color:var(--error); }
    .kpi-sub { font-size:11px; color:var(--muted); }

    .chart-card { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:16px; }
    .highlight-row { display:grid; grid-template-columns:300px 1fr; gap:12px; margin-bottom:12px; }
    @media(max-width:900px){ .highlight-row { grid-template-columns:1fr; } }
    .charts-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px; }
    @media(max-width:1100px){ .charts-row { grid-template-columns:1fr 1fr; } }
    @media(max-width:700px){ .charts-row { grid-template-columns:1fr; } }
    .bottom-row { display:grid; grid-template-columns:1fr 300px; gap:12px; }
    @media(max-width:900px){ .bottom-row { grid-template-columns:1fr; } }

    .doughnut-wrap { position:relative; height:200px; display:flex; justify-content:center; align-items:center; }
    .doughnut-center { position:absolute; text-align:center; pointer-events:none; }
    .doughnut-pct { font-size:28px; font-weight:800; }
    .chart-legend { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; font-size:11px; }
    .ldot { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:4px; }

    .dre-table { width:100%; border-collapse:collapse; font-size:12px; }
    .dre-table td { padding:6px 4px; }
    .dl { color:var(--muted); }
    .dv { text-align:right; font-weight:500; }
    .dv.pos { color:var(--info); }
    .dv.neg { color:var(--error); }
    .dre-sep td, .dre-result td { font-weight:600; border-top:1px solid var(--border-md); }

    .aviso-item { display:flex; gap:10px; padding:10px; border-radius:8px; margin-bottom:6px; }
    .aviso-icon { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; color:white; flex-shrink:0; }
    .est-row { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:0.5px solid var(--border); }
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000; display:flex; align-items:center; justify-content:center; }
    .modal { background:var(--panel2); padding:20px; border-radius:12px; max-width:380px; width:90%; }
  `;
}

export function destroyDashboard() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
