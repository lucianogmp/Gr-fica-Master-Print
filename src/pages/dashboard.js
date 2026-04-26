import { supabase } from "../supabase/client.js";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

let state = { filtroMes: mesAtual(), dados: null };

export async function Dashboard(container) {
  container.innerHTML = `<div class="loading">Carregando dashboard...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const mes = state.filtroMes;

  const [
    { data: vendas },
    { data: orcamentos },
    { data: lancamentos },
    { data: materias },
    { data: movimentos },
    { data: clientes },
  ] = await Promise.all([
    supabase.from("vendas").select("*, venda_itens(total)"),
    supabase.from("orcamentos").select("id, status, total, created_at"),
    supabase.from("lancamentos").select("tipo, valor, status, data_vencimento, created_at"),
    supabase.from("materias_primas").select("id, nome, estoque_minimo, custo_unitario"),
    supabase.from("estoque_movimentos").select("materia_prima_id, tipo, quantidade"),
    supabase.from("clientes").select("id, created_at"),
  ]);

  // ── Vendas do mês ──────────────────────────────────────────────────────────
  const vendasMes = (vendas||[]).filter(v => v.created_at?.startsWith(mes));
  const faturamento = vendasMes.reduce((s,v) => s + Number(v.total||0), 0);
  const vendasPorStatus = {};
  const STATUS_VENDAS = ["pendente","em_producao","pronto","entregue","pago"];
  STATUS_VENDAS.forEach(s => {
    vendasPorStatus[s] = vendasMes.filter(v => v.status === s).length;
  });

  // ── Financeiro do mês ──────────────────────────────────────────────────────
  const lancMes = (lancamentos||[]).filter(l => {
    const ref = l.data_vencimento || l.created_at?.slice(0,10);
    return ref?.startsWith(mes);
  });
  const receitasMes  = lancMes.filter(l=>l.tipo==="receita").reduce((s,l)=>s+Number(l.valor),0);
  const despesasMes  = lancMes.filter(l=>l.tipo==="despesa").reduce((s,l)=>s+Number(l.valor),0);
  const lucroMes     = receitasMes - despesasMes;
  const margem       = receitasMes > 0 ? (lucroMes / receitasMes * 100).toFixed(1) : 0;
  const recebidoMes  = lancMes.filter(l=>l.tipo==="receita"&&l.status==="pago").reduce((s,l)=>s+Number(l.valor),0);
  const aReceberMes  = lancMes.filter(l=>l.tipo==="receita"&&l.status==="pendente").reduce((s,l)=>s+Number(l.valor),0);

  // ── Orçamentos do mês ──────────────────────────────────────────────────────
  const orcMes = (orcamentos||[]).filter(o => o.created_at?.startsWith(mes));
  const taxaConversao = orcMes.length > 0
    ? ((orcMes.filter(o=>o.status==="aprovado").length / orcMes.length)*100).toFixed(0)
    : 0;

  // ── Estoque ────────────────────────────────────────────────────────────────
  const saldos = (materias||[]).map(mp => {
    const movsMp = (movimentos||[]).filter(m => m.materia_prima_id === mp.id);
    const ent = movsMp.filter(m=>m.tipo==="entrada").reduce((s,m)=>s+Number(m.quantidade),0);
    const sai = movsMp.filter(m=>m.tipo==="saida").reduce((s,m)=>s+Number(m.quantidade),0);
    return { ...mp, saldo: ent - sai };
  });
  const estoqueAlertas = saldos.filter(m => m.saldo > 0 && m.saldo <= Number(m.estoque_minimo||0));
  const estoqueZerado  = saldos.filter(m => m.saldo <= 0);

  // ── Gráfico últimos 6 meses ────────────────────────────────────────────────
  const ultimos6 = [];
  for (let i=5; i>=0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth()-i);
    const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const vMes = (vendas||[]).filter(v=>v.created_at?.startsWith(m));
    const lMes = (lancamentos||[]).filter(l=>{
      const ref = l.data_vencimento||l.created_at?.slice(0,10);
      return ref?.startsWith(m);
    });
    ultimos6.push({
      mes: m,
      faturamento: vMes.reduce((s,v)=>s+Number(v.total||0),0),
      receitas: lMes.filter(l=>l.tipo==="receita").reduce((s,l)=>s+Number(l.valor),0),
      despesas: lMes.filter(l=>l.tipo==="despesa").reduce((s,l)=>s+Number(l.valor),0),
    });
  }

  // ── Clientes novos ─────────────────────────────────────────────────────────
  const clientesNovos = (clientes||[]).filter(c => c.created_at?.startsWith(mes)).length;

  state.dados = {
    faturamento, vendasMes, vendasPorStatus,
    receitasMes, despesasMes, lucroMes, margem, recebidoMes, aReceberMes,
    orcMes, taxaConversao,
    estoqueAlertas, estoqueZerado, saldos,
    ultimos6, clientesNovos,
    totalVendas: (vendas||[]).length,
    totalClientes: (clientes||[]).length,
  };
}

function render(container) {
  const d = state.dados;
  if (!d) return;

  const nomeMes = m => {
    const [y,mo] = m.split("-");
    return new Date(y,mo-1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  };

  const maxGrafico = Math.max(...d.ultimos6.flatMap(m=>[m.faturamento, m.receitas, m.despesas]), 1);
  const nomeMesAbrev = m => {
    const [y,mo] = m.split("-");
    return new Date(y,mo-1).toLocaleDateString("pt-BR",{month:"short"});
  };

  const STATUS_CONFIG = {
    pendente:    { label:"Pendente",     cor:"#ffa94d", emoji:"🕐" },
    em_producao: { label:"Em produção",  cor:"#74c0fc", emoji:"⚙️" },
    pronto:      { label:"Pronto",       cor:"#a9e34b", emoji:"✅" },
    entregue:    { label:"Entregue",     cor:"#69db7c", emoji:"🚚" },
    pago:        { label:"Pago",         cor:"#b197fc", emoji:"💰" },
  };

  container.innerHTML = `
    <style>
      .dash-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px; }
      .dash-header h2 { margin:0; }
      .dash-header input[type=month] { background:var(--panel2);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:8px;padding:7px 12px;font-size:13px; }

      .kpi-row { display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px; }
      @media(max-width:900px){.kpi-row{grid-template-columns:repeat(2,1fr);}}
      @media(max-width:500px){.kpi-row{grid-template-columns:1fr;}}
      .kpi { background:var(--panel2);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px; }
      .kpi .k { font-size:12px;color:var(--muted); }
      .kpi .v { font-size:22px;font-weight:700;margin:4px 0 2px; }
      .kpi .sub { font-size:11px;color:var(--muted); }

      .dash-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px; }
      @media(max-width:720px){.dash-grid{grid-template-columns:1fr;}}
      .bloco { background:var(--panel2);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px; }
      .bloco h4 { margin:0 0 12px;font-size:13px;color:var(--muted); }

      /* Gráfico */
      .grafico { display:flex;gap:6px;align-items:flex-end;height:120px;margin-bottom:6px; }
      .g-col { display:flex;flex-direction:column;align-items:center;flex:1;gap:3px; }
      .g-barras { display:flex;gap:2px;align-items:flex-end;height:100px; }
      .g-b { width:12px;border-radius:3px 3px 0 0;min-height:2px;transition:height .4s; }
      .g-label { font-size:10px;color:var(--muted); }
      .g-legenda { display:flex;gap:14px;font-size:11px;color:var(--muted);margin-top:6px; }
      .g-dot { display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px; }

      /* Status vendas */
      .status-row { display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px; }
      .status-row:last-child{border-bottom:none;}
      .status-bar-wrap { flex:1;background:rgba(255,255,255,0.04);border-radius:4px;height:6px; }
      .status-bar-fill { height:100%;border-radius:4px; }
      .status-num { font-weight:700;min-width:20px;text-align:right; }

      /* Estoque alertas */
      .alert-row { display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04); }
      .alert-row:last-child{border-bottom:none;}
      .alert-saldo { font-weight:700;margin-left:auto; }

      /* Métricas extras */
      .metricas { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px; }
      @media(max-width:600px){.metricas{grid-template-columns:1fr;}}
      .met { background:var(--panel2);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 14px;text-align:center; }
      .met .mv { font-size:28px;font-weight:700; }
      .met .mk { font-size:11px;color:var(--muted);margin-top:2px; }
    </style>

    <div class="dash-header">
      <h2>📊 Dashboard</h2>
      <input type="month" id="filtro-mes" value="${state.filtroMes}" />
    </div>

    <!-- KPIs principais -->
    <div class="kpi-row">
      <div class="kpi">
        <div class="k">Faturamento (vendas)</div>
        <div class="v" style="color:var(--accent)">R$ ${d.faturamento.toFixed(2)}</div>
        <div class="sub">${d.vendasMes.length} venda${d.vendasMes.length!==1?"s":""} no mês</div>
      </div>
      <div class="kpi">
        <div class="k">Receitas financeiras</div>
        <div class="v" style="color:#69db7c">R$ ${d.receitasMes.toFixed(2)}</div>
        <div class="sub">Recebido: R$ ${d.recebidoMes.toFixed(2)}</div>
      </div>
      <div class="kpi">
        <div class="k">Despesas</div>
        <div class="v" style="color:#ff6b6b">R$ ${d.despesasMes.toFixed(2)}</div>
        <div class="sub">Lucro: R$ ${d.lucroMes.toFixed(2)}</div>
      </div>
      <div class="kpi">
        <div class="k">Margem líquida</div>
        <div class="v" style="color:${d.margem>=30?"#69db7c":d.margem>=15?"#ffa94d":"#ff6b6b"}">${d.margem}%</div>
        <div class="sub">A receber: R$ ${d.aReceberMes.toFixed(2)}</div>
      </div>
    </div>

    <!-- Métricas -->
    <div class="metricas">
      <div class="met">
        <div class="mv" style="color:#74c0fc">${d.taxaConversao}%</div>
        <div class="mk">Taxa de conversão orçamentos</div>
      </div>
      <div class="met">
        <div class="mv" style="color:${d.estoqueZerado.length>0?"#ff6b6b":d.estoqueAlertas.length>0?"#ffa94d":"#69db7c"}">${d.estoqueZerado.length + d.estoqueAlertas.length}</div>
        <div class="mk">Itens com estoque baixo/zerado</div>
      </div>
      <div class="met">
        <div class="mv" style="color:#b197fc">${d.clientesNovos}</div>
        <div class="mk">Clientes novos no mês</div>
      </div>
    </div>

    <!-- Gráfico + Status vendas -->
    <div class="dash-grid">
      <div class="bloco">
        <h4>📈 Últimos 6 meses</h4>
        <div class="grafico">
          ${d.ultimos6.map(m => `
            <div class="g-col">
              <div class="g-barras">
                <div class="g-b" style="height:${(m.faturamento/maxGrafico*100).toFixed(0)}px;background:var(--accent)" title="Faturamento R$ ${m.faturamento.toFixed(2)}"></div>
                <div class="g-b" style="height:${(m.receitas/maxGrafico*100).toFixed(0)}px;background:#69db7c" title="Receitas R$ ${m.receitas.toFixed(2)}"></div>
                <div class="g-b" style="height:${(m.despesas/maxGrafico*100).toFixed(0)}px;background:#ff6b6b" title="Despesas R$ ${m.despesas.toFixed(2)}"></div>
              </div>
              <div class="g-label">${nomeMesAbrev(m.mes)}</div>
            </div>`).join("")}
        </div>
        <div class="g-legenda">
          <span><span class="g-dot" style="background:var(--accent)"></span>Faturamento</span>
          <span><span class="g-dot" style="background:#69db7c"></span>Receitas</span>
          <span><span class="g-dot" style="background:#ff6b6b"></span>Despesas</span>
        </div>
      </div>

      <div class="bloco">
        <h4>🛒 Vendas por status — ${nomeMes(state.filtroMes)}</h4>
        ${d.vendasMes.length === 0
          ? `<div style="color:var(--muted);font-size:13px">Nenhuma venda no período.</div>`
          : Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const qtd = d.vendasPorStatus[key]||0;
              const pct = d.vendasMes.length > 0 ? (qtd/d.vendasMes.length*100).toFixed(0) : 0;
              return `
                <div class="status-row">
                  <span style="width:90px;font-size:12px">${cfg.emoji} ${cfg.label}</span>
                  <div class="status-bar-wrap">
                    <div class="status-bar-fill" style="width:${pct}%;background:${cfg.cor}"></div>
                  </div>
                  <span class="status-num" style="color:${cfg.cor}">${qtd}</span>
                </div>`;
            }).join("")
        }
        <div style="margin-top:10px;font-size:12px;color:var(--muted);text-align:right">
          Total: ${d.vendasMes.length} vendas · R$ ${d.faturamento.toFixed(2)}
        </div>
      </div>
    </div>

    <!-- Estoque alertas -->
    ${(d.estoqueAlertas.length + d.estoqueZerado.length) > 0 ? `
      <div class="bloco">
        <h4>⚠️ Estoque em alerta</h4>
        ${[...d.estoqueZerado, ...d.estoqueAlertas].slice(0,8).map(m => `
          <div class="alert-row">
            <span style="color:${m.saldo<=0?"#ff6b6b":"#ffa94d"}">${m.saldo<=0?"🔴":"🟡"}</span>
            <span>${m.nome}</span>
            <span style="font-size:11px;color:var(--muted)">mín: ${m.estoque_minimo}</span>
            <span class="alert-saldo" style="color:${m.saldo<=0?"#ff6b6b":"#ffa94d"}">${Number(m.saldo).toFixed(2)}</span>
          </div>`).join("")}
      </div>` : ""
    }
  `;

  container.querySelector("#filtro-mes").addEventListener("change", async e => {
    state.filtroMes = e.target.value;
    container.innerHTML = `<div class="loading">Atualizando...</div>`;
    await carregar();
    render(container);
  });
}