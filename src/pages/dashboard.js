import { supabase } from "../supabase/client.js";

export function Dashboard(container) {
  container.innerHTML = `
    <h2>Dashboard</h2>
    <div class="grid-3">
      <div class="card"><div class="k">Custo Produtivo total</div><div class="v" id="k_custo_total">—</div></div>
      <div class="card"><div class="k">Faturamento Total</div><div class="v" id="k_faturamento">—</div></div>
      <div class="card"><div class="k">Lucro Líquido</div><div class="v" id="k_lucro">—</div></div>
    </div>

    <div class="grid-3 mt">
      <div class="card"><div class="k">Mão de Obra</div><div class="v" id="k_mao_obra">—</div></div>
      <div class="card"><div class="k">Matéria Prima</div><div class="v" id="k_materia">—</div></div>
      <div class="card"><div class="k">Terceirização</div><div class="v" id="k_terceiro">—</div></div>
    </div>

    <div class="mt card">
      <div class="k">Total de Vendas</div>
      <div class="v" id="k_total_vendas">—</div>
    </div>

    <div class="mt card">
      <div class="k">Gráfico (placeholder)</div>
      <div class="muted">Assim que você confirmar filtros (mês/status), eu plugo a query e o Chart.js.</div>
      <canvas id="chart_dashboard" height="90"></canvas>
    </div>
  `;

  // placeholder: para não quebrar, sem query por enquanto.
}
