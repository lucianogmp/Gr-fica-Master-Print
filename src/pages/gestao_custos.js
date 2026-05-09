import { supabase } from "../supabase/client.js";
import { fmtBRL } from "../format/brl.js";

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  aba: "resumo",
  equipamentos: [],
  custos: [],
  custoOpPct: 0, // % repassado para orçamentos
  salvando: false,
  msg: null,
};

const CATEGORIAS_CUSTO = [
  "Aluguel", "Energia Elétrica", "Água", "Internet", "Telefone",
  "Sistema/Software", "Contabilidade", "Manutenção", "Outros",
];

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function GestaoCustos(container) {
  container.innerHTML = `<div class="loading">Carregando gestão de custos...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const [{ data: equip }, { data: custos }, { data: config }] = await Promise.all([
    supabase.from("depreciacao").select("*").order("nome"),
    supabase.from("custos_fixos").select("*").order("nome"),
    supabase.from("configuracoes").select("valor").eq("chave", "custo_operacional_pct").maybeSingle(),
  ]);
  state.equipamentos = equip || [];
  state.custos       = custos || [];
  state.custoOpPct   = parseFloat(config?.valor || 0);
}

// ─── Render principal ─────────────────────────────────────────────────────────
function render(container) {
  // ── Cálculos globais ──────────────────────────────────────────────────────
  const totalDeprMensal = state.equipamentos.reduce((s, e) => {
    return s + calcDeprMensal(e);
  }, 0);

  const custosAtivos = state.custos.filter(c => c.ativo !== false);
  const totalCustoFixo = custosAtivos.reduce((s, c) => s + Number(c.valor_mensal || 0), 0);

  const totalMensal = totalDeprMensal + totalCustoFixo;
  const totalDiario = totalMensal / 30;
  const totalHora   = totalDiario / 8; // jornada 8h

  container.innerHTML = `
    <style>${css()}</style>

    <div class="gc-header">
      <div>
        <h2>Gestão de Custos</h2>
        <span style="font-size:12px;color:var(--muted)">Depreciação de equipamentos e custos fixos mensais</span>
      </div>
      <button class="btn-primary" id="btn-novo" style="display:none"></button>
    </div>

    <!-- KPIs globais -->
    <div class="gc-kpis">
      <div class="kpi-card">
        <div class="kpi-label">Depreciação mensal</div>
        <div class="kpi-val" style="color:var(--warning)">${fmtBRL(totalDeprMensal)}</div>
        <div class="kpi-sub">${state.equipamentos.length} equipamento${state.equipamentos.length !== 1 ? "s" : ""}</div>
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

    <!-- Abas -->
    <div class="gc-abas">
      ${[
        { key: "resumo",      icon: "fi-rr-chart-histogram", label: "Resumo"        },
        { key: "depreciacao", icon: "fi-rr-tools",           label: "Depreciação"   },
        { key: "fixos",       icon: "fi-rr-money-bill-wave", label: "Custos Fixos"  },
      ].map(a => `
        <button class="gc-aba ${state.aba === a.key ? "active" : ""}" data-aba="${a.key}">
          <i class="fi ${a.icon}"></i> ${a.label}
        </button>`).join("")}
    </div>

    ${state.msg ? `
      <div class="gc-toast ${state.msg.tipo}">
        ${state.msg.tipo === "ok" ? "✅" : "❌"} ${state.msg.texto}
      </div>` : ""}

    <div id="gc-body"></div>
    <div id="modal-area"></div>
  `;

  container.querySelectorAll("[data-aba]").forEach(btn =>
    btn.addEventListener("click", () => {
      state.aba = btn.dataset.aba;
      render(container);
    })
  );

  const body = container.querySelector("#gc-body");
  if      (state.aba === "resumo")      renderResumo(body, container, totalDeprMensal, totalCustoFixo, totalMensal);
  else if (state.aba === "depreciacao") renderDepreciacao(body, container);
  else if (state.aba === "fixos")       renderFixos(body, container);

  if (state.msg) {
    setTimeout(() => { state.msg = null; render(container); }, 3000);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: RESUMO
// ══════════════════════════════════════════════════════════════════════════════
function renderResumo(body, container, totalDepr, totalFixo, totalMensal) {
  const fmt = fmtBRL;

  // Custos fixos por categoria
  const porCat = {};
  state.custos.filter(c => c.ativo !== false).forEach(c => {
    const cat = c.categoria || "Outros";
    porCat[cat] = (porCat[cat] || 0) + Number(c.valor_mensal || 0);
  });
  const catEntries = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...catEntries.map(e => e[1]), 1);

  // Top 5 equipamentos por depreciação
  const topEquip = [...state.equipamentos]
    .sort((a, b) => calcDeprMensal(b) - calcDeprMensal(a))
    .slice(0, 5);

  body.innerHTML = `
    <div class="resumo-grid">

      <!-- Breakdown de custos -->
      <div class="res-card">
        <div class="res-card-title">📊 Composição do custo mensal</div>
        <div class="composicao-bars">
          <div class="comp-row">
            <span class="comp-label">Depreciação</span>
            <div class="comp-bar-wrap">
              <div class="comp-bar" style="width:${totalMensal > 0 ? (totalDepr/totalMensal*100).toFixed(1) : 0}%;background:var(--warning)"></div>
            </div>
            <span class="comp-val">${fmt(totalDepr)}</span>
          </div>
          <div class="comp-row">
            <span class="comp-label">Custos fixos</span>
            <div class="comp-bar-wrap">
              <div class="comp-bar" style="width:${totalMensal > 0 ? (totalFixo/totalMensal*100).toFixed(1) : 0}%;background:var(--error)"></div>
            </div>
            <span class="comp-val">${fmt(totalFixo)}</span>
          </div>
        </div>
        <div class="comp-total">
          <span>Total mensal</span>
          <strong>${fmtBRL(totalMensal)}</strong>
        </div>

        <!-- Custo por período -->
        <div class="periodos-grid">
          ${[
            { label: "Por dia",   val: totalMensal / 30 },
            { label: "Por hora",  val: totalMensal / 30 / 8 },
            { label: "Por mês",   val: totalMensal },
            { label: "Por ano",   val: totalMensal * 12 },
          ].map(p => `
            <div class="periodo-item">
              <div class="periodo-label">${p.label}</div>
              <div class="periodo-val">${fmtBRL(p.val)}</div>
            </div>`).join("")}
        </div>
      </div>

      <!-- Custos fixos por categoria -->
      <div class="res-card">
        <div class="res-card-title">💳 Custos fixos por categoria</div>
        ${catEntries.length === 0
          ? `<div class="res-vazio">Nenhum custo fixo cadastrado ainda.</div>`
          : catEntries.map(([cat, val]) => `
            <div class="comp-row">
              <span class="comp-label">${cat}</span>
              <div class="comp-bar-wrap">
                <div class="comp-bar" style="width:${(val/maxCat*100).toFixed(1)}%;background:var(--error)"></div>
              </div>
              <span class="comp-val">${fmt(val)}</span>
            </div>`).join("")}
      </div>

    </div>

    <!-- Top equipamentos -->
    ${topEquip.length > 0 ? `
    <div class="res-card" style="margin-top:14px">
      <div class="res-card-title">🔧 Maiores depreciações mensais</div>
      <table class="gc-table">
        <thead><tr>
          <th>Equipamento</th>
          <th style="text-align:right">Valor</th>
          <th style="text-align:center">Vida útil</th>
          <th style="text-align:right">Depr./mês</th>
          <th style="text-align:right">Depr./hora</th>
          <th style="text-align:center">Progresso</th>
        </tr></thead>
        <tbody>
          ${topEquip.map(e => {
            const deprMes = calcDeprMensal(e);
            const deprHora = deprMes / 30 / 8;
            const mesesUsados = calcMesesUsados(e);
            const vidaTotal = Number(e.vida_util_anos || 1) * 12;
            const pct = Math.min((mesesUsados / vidaTotal) * 100, 100);
            const status = pct >= 100 ? "depreciado" : pct > 70 ? "critico" : "ok";
            return `
              <tr>
                <td><strong>${esc(e.nome)}</strong></td>
                <td style="text-align:right">${fmtBRL(e.valor || 0)}</td>
                <td style="text-align:center">${e.vida_util_anos} ano${e.vida_util_anos != 1 ? "s" : ""}</td>
                <td style="text-align:right;font-weight:700;color:var(--warning)">${fmtBRL(deprMes)}</td>
                <td style="text-align:right;color:var(--muted);font-size:12px">${fmtBRL(deprHora, 4)}</td>
                <td style="text-align:center">
                  <div class="prog-wrap">
                    <div class="prog-bar ${status}" style="width:${pct.toFixed(0)}%"></div>
                  </div>
                  <div style="font-size:10px;color:var(--muted);margin-top:2px">${pct.toFixed(0)}%</div>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : ""}

    <!-- ── INTEGRAÇÃO COM ORÇAMENTOS ── -->
    <div class="integracao-card" style="margin-top:14px">
      <div class="integracao-icon">⚙️</div>
      <div style="flex:1">
        <div class="integracao-titulo">Repasse de Custo Operacional para Orçamentos</div>
        <div class="integracao-desc" style="margin-bottom:12px">
          Define o percentual dos custos operacionais que será automaticamente acrescentado
          no subtotal de impressão (m²) em todos os orçamentos.
          Custo por hora atual: <strong style="color:var(--info)">${fmtBRL(totalMensal / 30 / 8, 4)}</strong>
        </div>
        <div class="custo-op-config">
          <div class="custo-op-input-wrap">
            <label>Percentual de acréscimo nos orçamentos</label>
            <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
              <div class="input-suffix-wrap" style="width:140px">
                <input id="custo-op-pct" type="number" min="0" max="100" step="0.1"
                  value="${state.custoOpPct}" placeholder="0" />
                <span>%</span>
              </div>
              <button class="btn-primary" id="btn-salvar-pct">
                <i class="fi fi-rr-disk"></i> Salvar
              </button>
            </div>
            <div class="custo-op-exemplos" id="custo-op-exemplos">
              ${renderExemplosCustoOp(state.custoOpPct)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Preview em tempo real ao digitar
  body.querySelector("#custo-op-pct")?.addEventListener("input", e => {
    const pct = parseFloat(e.target.value) || 0;
    const el = body.querySelector("#custo-op-exemplos");
    if (el) el.innerHTML = renderExemplosCustoOp(pct);
  });

  // Salvar percentual
  body.querySelector("#btn-salvar-pct")?.addEventListener("click", async () => {
    const pct = parseFloat(body.querySelector("#custo-op-pct").value) || 0;
    await supabase.from("configuracoes").upsert(
      { chave: "custo_operacional_pct", valor: String(pct) },
      { onConflict: "chave" }
    );
    state.custoOpPct = pct;
    state.msg = { tipo: "ok", texto: `Percentual de ${pct}% salvo! Será aplicado automaticamente nos orçamentos.` };
    render(container);
  });
}

function renderExemplosCustoOp(pct) {
  if (!pct || pct <= 0) return `<span style="color:var(--muted);font-size:12px">Nenhum acréscimo será aplicado.</span>`;
  const exemplos = [50, 100, 200];
  return `
    <div style="font-size:11px;color:var(--muted);margin-top:8px">
      Exemplos com ${pct}% de acréscimo:
      ${exemplos.map(v => {
        const acr = v * (pct / 100);
        return `<span class="custo-op-ex">${fmtBRL(v)} → <strong>${fmtBRL(v + acr)}</strong></span>`;
      }).join("")}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: DEPRECIAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
function renderDepreciacao(body, container) {
  body.innerHTML = `
    <div class="gc-section-header">
      <div class="gc-section-title">🔧 Equipamentos e Depreciação</div>
      <button class="btn-primary" id="btn-novo-equip">+ Novo Equipamento</button>
    </div>

    <div class="gc-hint">
      A depreciação mensal é calculada pelo método linear: <strong>Valor ÷ (Vida útil em anos × 12)</strong>
    </div>

    ${state.equipamentos.length === 0
      ? `<div class="gc-vazio">Nenhum equipamento cadastrado ainda. Adicione sua plota de recorte, impressoras, computadores...</div>`
      : `<div class="equip-grid">
          ${state.equipamentos.map(e => {
            const deprMes  = calcDeprMensal(e);
            const deprAno  = deprMes * 12;
            const deprDia  = deprMes / 30;
            const deprHora = deprDia / 8;
            const mesesUsados = calcMesesUsados(e);
            const vidaTotal   = Number(e.vida_util_anos || 1) * 12;
            const pct         = Math.min((mesesUsados / vidaTotal) * 100, 100);
            const status      = pct >= 100 ? "depreciado" : pct > 70 ? "critico" : "ok";
            const statusLabel = pct >= 100 ? "Depreciado" : pct > 70 ? "Crítico" : "Em uso";
            const valorResidual = Math.max(Number(e.valor || 0) - (deprMes * mesesUsados), 0);

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
                  <div class="equip-val-item">
                    <span>Valor de compra</span>
                    <strong>${fmtBRL(e.valor || 0)}</strong>
                  </div>
                  <div class="equip-val-item">
                    <span>Vida útil</span>
                    <strong>${e.vida_util_anos} ano${e.vida_util_anos != 1 ? "s" : ""}</strong>
                  </div>
                  <div class="equip-val-item">
                    <span>Valor residual</span>
                    <strong style="color:var(--muted)">${fmtBRL(valorResidual)}</strong>
                  </div>
                </div>

                <div class="equip-depr-destaque">
                  <div>
                    <div class="depr-label">Depreciação mensal</div>
                    <div class="depr-valor">${fmtBRL(deprMes)}</div>
                  </div>
                  <div style="text-align:right">
                    <div class="depr-label">Por hora (8h)</div>
                    <div class="depr-valor" style="font-size:14px;color:var(--info)">${fmtBRL(deprHora, 4)}</div>
                  </div>
                </div>

                <div class="equip-secundarios">
                  <span>Diária: ${fmtBRL(deprDia, 4)}</span>
                  <span>Anual: ${fmtBRL(deprAno)}</span>
                </div>

                <div class="equip-prog-label">
                  <span>Depreciação acumulada</span>
                  <span>${pct.toFixed(0)}% · ${mesesUsados}/${vidaTotal} meses</span>
                </div>
                <div class="prog-wrap">
                  <div class="prog-bar ${status}" style="width:${pct.toFixed(0)}%"></div>
                </div>

                ${e.data_aquisicao ? `<div class="equip-data">Adquirido em: ${fmtData(e.data_aquisicao)}</div>` : ""}
                ${e.observacoes ? `<div class="equip-obs">${esc(e.observacoes)}</div>` : ""}

                <div class="equip-acoes">
                  <button class="btn-icon" data-edit-equip="${e.id}">✏️ Editar</button>
                  <button class="btn-icon danger" data-del-equip="${e.id}" data-del-nome="${esc(e.nome)}">🗑</button>
                </div>
              </div>`;
          }).join("")}
        </div>`}

    ${state.equipamentos.length > 0 ? `
    <div class="gc-total-bar">
      <span>Total de depreciação mensal:</span>
      <strong>${fmtBRL(state.equipamentos.reduce((s, e) => s + calcDeprMensal(e), 0))}</strong>
    </div>` : ""}
  `;

  body.querySelector("#btn-novo-equip").addEventListener("click", () =>
    abrirModalEquip(container, null)
  );

  body.querySelectorAll("[data-edit-equip]").forEach(btn => {
    const equip = state.equipamentos.find(e => e.id === btn.dataset.editEquip);
    btn.addEventListener("click", () => abrirModalEquip(container, equip));
  });

  body.querySelectorAll("[data-del-equip]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm(`Remover "${btn.dataset.delNome}"?`)) return;
      await supabase.from("depreciacao").delete().eq("id", btn.dataset.delEquip);
      state.msg = { tipo: "ok", texto: "Equipamento removido." };
      await recarregar(container);
    })
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: CUSTOS FIXOS
// ══════════════════════════════════════════════════════════════════════════════
function renderFixos(body, container) {
  const ativos   = state.custos.filter(c => c.ativo !== false);
  const inativos = state.custos.filter(c => c.ativo === false);
  const totalAtivo = ativos.reduce((s, c) => s + Number(c.valor_mensal || 0), 0);

  body.innerHTML = `
    <div class="gc-section-header">
      <div class="gc-section-title">💳 Custos Fixos Mensais</div>
      <button class="btn-primary" id="btn-novo-custo">+ Novo Custo</button>
    </div>

    <div class="gc-hint">
      Cadastre todos os seus custos mensais fixos: aluguel, energia, água, internet, sistemas, etc.
    </div>

    ${state.custos.length === 0
      ? `<div class="gc-vazio">Nenhum custo fixo cadastrado. Adicione seus custos mensais.</div>`
      : `<div style="overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border)">
          <table class="gc-table">
            <thead><tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th style="text-align:right">Valor/mês</th>
              <th style="text-align:right">Valor/dia</th>
              <th style="text-align:right">Valor/hora</th>
              <th style="text-align:center">Status</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${state.custos.map(c => {
                const dia  = Number(c.valor_mensal || 0) / 30;
                const hora = dia / 8;
                const ativo = c.ativo !== false;
                return `
                  <tr class="${ativo ? "" : "row-inativo"}">
                    <td><strong>${esc(c.nome)}</strong>${c.observacoes ? `<div style="font-size:11px;color:var(--muted)">${esc(c.observacoes)}</div>` : ""}</td>
                    <td style="font-size:12px;color:var(--muted)">${esc(c.categoria) || "—"}</td>
                    <td style="text-align:right;font-weight:700;color:${ativo ? "var(--error)" : "var(--muted)"}">${fmtBRL(c.valor_mensal || 0)}</td>
                    <td style="text-align:right;font-size:12px;color:var(--muted)">${fmtBRL(dia, 4)}</td>
                    <td style="text-align:right;font-size:12px;color:var(--muted)">${fmtBRL(hora, 4)}</td>
                    <td style="text-align:center">
                      <span class="tag-status ${ativo ? "ativo" : "inativo"}">${ativo ? "● Ativo" : "○ Inativo"}</span>
                    </td>
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
        </div>`}

    ${state.custos.length > 0 ? `
    <div class="gc-total-bar">
      <span>Total de custos fixos ativos/mês:</span>
      <strong style="color:var(--error)">${fmtBRL(totalAtivo)}</strong>
      ${inativos.length > 0 ? `<span style="font-size:12px;color:var(--muted);margin-left:12px">(${inativos.length} inativo${inativos.length > 1 ? "s" : ""})</span>` : ""}
    </div>` : ""}
  `;

  body.querySelector("#btn-novo-custo").addEventListener("click", () =>
    abrirModalCusto(container, null)
  );

  body.querySelectorAll("[data-edit-custo]").forEach(btn => {
    const custo = state.custos.find(c => c.id === btn.dataset.editCusto);
    btn.addEventListener("click", () => abrirModalCusto(container, custo));
  });

  body.querySelectorAll("[data-del-custo]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm(`Remover "${btn.dataset.delNome}"?`)) return;
      await supabase.from("custos_fixos").delete().eq("id", btn.dataset.delCusto);
      state.msg = { tipo: "ok", texto: "Custo removido." };
      await recarregar(container);
    })
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: EQUIPAMENTO
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalEquip(container, equip) {
  const area = container.querySelector("#modal-area");
  const editando = !!equip?.id;
  const e = equip || {};

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:500px">
        <h3>🔧 ${editando ? "Editar" : "Novo"} Equipamento</h3>

        <div class="modal-grid">
          <div class="modal-field full">
            <label>Nome do equipamento *</label>
            <input id="eq-nome" value="${esc(e.nome)}" placeholder="Ex: Plota de Recorte, Impressora A3, Computador..." autofocus />
          </div>
          <div class="modal-field">
            <label>Categoria</label>
            <input id="eq-cat" value="${esc(e.categoria)}" placeholder="Ex: Impressão, Informática, Móveis..." />
          </div>
          <div class="modal-field">
            <label>Data de aquisição</label>
            <input id="eq-data" type="date" value="${e.data_aquisicao || ""}" />
          </div>
          <div class="modal-field">
            <label>Valor de compra (R$) *</label>
            <div class="input-prefix-wrap">
              <span>R$</span>
              <input id="eq-valor" type="number" min="0" step="0.01" value="${e.valor || ""}" placeholder="0,00" />
            </div>
          </div>
          <div class="modal-field">
            <label>Vida útil estimada (anos) *</label>
            <div class="input-suffix-wrap">
              <input id="eq-vida" type="number" min="1" max="50" step="1" value="${e.vida_util_anos || 5}" />
              <span>anos</span>
            </div>
          </div>
        </div>

        <div class="depr-preview" id="depr-preview">
          <div class="depr-preview-title">📊 Prévia da depreciação</div>
          <div id="depr-preview-valores"></div>
        </div>

        <div class="modal-field" style="margin-top:10px">
          <label>Observações</label>
          <textarea id="eq-obs" rows="2" placeholder="Número de série, marca, modelo...">${esc(e.observacoes)}</textarea>
        </div>

        <div class="modal-btns">
          <button class="btn-secondary" id="eq-cancel">Cancelar</button>
          <button class="btn-primary" id="eq-ok">💾 Salvar</button>
        </div>
      </div>
    </div>`;

  const atualizarPreview = () => {
    const valor = parseFloat(area.querySelector("#eq-valor").value) || 0;
    const anos  = parseFloat(area.querySelector("#eq-vida").value)  || 0;
    const el    = area.querySelector("#depr-preview-valores");
    if (valor > 0 && anos > 0) {
      const mes  = valor / (anos * 12);
      const dia  = mes / 30;
      const hora = dia / 8;
      const ano  = mes * 12;
      el.innerHTML = `
        <div class="depr-prev-grid">
          <div><span>Por mês</span><strong>${fmtBRL(mes)}</strong></div>
          <div><span>Por dia</span><strong>${fmtBRL(dia, 4)}</strong></div>
          <div><span>Por hora (8h)</span><strong>${fmtBRL(hora, 4)}</strong></div>
          <div><span>Por ano</span><strong>${fmtBRL(ano)}</strong></div>
        </div>`;
    } else {
      el.innerHTML = `<div style="color:var(--muted);font-size:12px">Preencha valor e vida útil para ver o cálculo.</div>`;
    }
  };

  area.querySelector("#eq-valor").addEventListener("input", atualizarPreview);
  area.querySelector("#eq-vida").addEventListener("input", atualizarPreview);
  atualizarPreview();

  area.querySelector("#eq-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", ev => { if (ev.target.id === "modal-bg") area.innerHTML = ""; });

  area.querySelector("#eq-ok").addEventListener("click", async () => {
    const nome  = area.querySelector("#eq-nome").value.trim();
    const valor = parseFloat(area.querySelector("#eq-valor").value);
    const vida  = parseFloat(area.querySelector("#eq-vida").value);

    if (!nome)  { alert("Informe o nome do equipamento."); return; }
    if (!valor || valor <= 0) { alert("Informe o valor de compra."); return; }
    if (!vida  || vida  <= 0) { alert("Informe a vida útil."); return; }

    const payload = {
      nome,
      categoria:       area.querySelector("#eq-cat").value.trim()   || null,
      data_aquisicao:  area.querySelector("#eq-data").value          || null,
      valor,
      vida_util_anos:  vida,
      observacoes:     area.querySelector("#eq-obs").value.trim()    || null,
      updated_at:      new Date(),
    };

    if (editando) {
      await supabase.from("depreciacao").update(payload).eq("id", equip.id);
    } else {
      await supabase.from("depreciacao").insert(payload);
    }

    area.innerHTML = "";
    state.msg = { tipo: "ok", texto: editando ? "Equipamento atualizado!" : "Equipamento cadastrado!" };
    await recarregar(container);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: CUSTO FIXO
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalCusto(container, custo) {
  const area = container.querySelector("#modal-area");
  const editando = !!custo?.id;
  const c = custo || {};

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:460px">
        <h3>💳 ${editando ? "Editar" : "Novo"} Custo Fixo</h3>

        <label>Nome *</label>
        <input id="cf-nome" value="${esc(c.nome)}" placeholder="Ex: Aluguel, Energia, Água..." autofocus />

        <label>Categoria</label>
        <select id="cf-cat">
          ${CATEGORIAS_CUSTO.map(cat =>
            `<option value="${cat}" ${c.categoria === cat ? "selected" : ""}>${cat}</option>`
          ).join("")}
        </select>

        <label>Valor mensal (R$) *</label>
        <div class="input-prefix-wrap">
          <span>R$</span>
          <input id="cf-valor" type="number" min="0" step="0.01" value="${c.valor_mensal || ""}" placeholder="0,00" />
        </div>

        <label>Status</label>
        <select id="cf-ativo">
          <option value="true"  ${c.ativo !== false ? "selected" : ""}>● Ativo</option>
          <option value="false" ${c.ativo === false  ? "selected" : ""}>○ Inativo</option>
        </select>

        <label>Observações</label>
        <textarea id="cf-obs" rows="2" placeholder="Fornecedor, contrato, vencimento...">${esc(c.observacoes)}</textarea>

        <div class="modal-btns">
          <button class="btn-secondary" id="cf-cancel">Cancelar</button>
          <button class="btn-primary" id="cf-ok">💾 Salvar</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#cf-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", ev => { if (ev.target.id === "modal-bg") area.innerHTML = ""; });

  area.querySelector("#cf-ok").addEventListener("click", async () => {
    const nome  = area.querySelector("#cf-nome").value.trim();
    const valor = parseFloat(area.querySelector("#cf-valor").value);

    if (!nome)  { alert("Informe o nome."); return; }
    if (!valor || valor < 0) { alert("Informe o valor mensal."); return; }

    const payload = {
      nome,
      categoria:    area.querySelector("#cf-cat").value,
      valor_mensal: valor,
      ativo:        area.querySelector("#cf-ativo").value === "true",
      observacoes:  area.querySelector("#cf-obs").value.trim() || null,
      updated_at:   new Date(),
    };

    if (editando) {
      await supabase.from("custos_fixos").update(payload).eq("id", custo.id);
    } else {
      await supabase.from("custos_fixos").insert(payload);
    }

    area.innerHTML = "";
    state.msg = { tipo: "ok", texto: editando ? "Custo atualizado!" : "Custo cadastrado!" };
    await recarregar(container);
  });
}

// ─── Helpers de cálculo ───────────────────────────────────────────────────────
function calcDeprMensal(equip) {
  const valor = Number(equip.valor || 0);
  const anos  = Number(equip.vida_util_anos || 1);
  return valor / (anos * 12);
}

function calcMesesUsados(equip) {
  if (!equip.data_aquisicao) return 0;
  const aquisicao = new Date(equip.data_aquisicao);
  const agora     = new Date();
  const diff = (agora.getFullYear() - aquisicao.getFullYear()) * 12 +
               (agora.getMonth() - aquisicao.getMonth());
  return Math.max(0, diff);
}

// ─── Utilitários ──────────────────────────────────────────────────────────────
function fmtData(d) {
  if (!d) return "—";
  const [y, m, dia] = d.split("-");
  return `${dia}/${m}/${y}`;
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function recarregar(container) {
  await carregar();
  render(container);
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO EXPORTADA: retorna custos totais para uso externo (orçamentos etc.)
// ══════════════════════════════════════════════════════════════════════════════
export async function getCustoOperacional() {
  const [{ data: equip }, { data: custos }] = await Promise.all([
    supabase.from("depreciacao").select("valor, vida_util_anos"),
    supabase.from("custos_fixos").select("valor_mensal, ativo"),
  ]);
  const depr  = (equip  || []).reduce((s, e) => s + Number(e.valor || 0) / (Number(e.vida_util_anos || 1) * 12), 0);
  const fixo  = (custos || []).filter(c => c.ativo !== false).reduce((s, c) => s + Number(c.valor_mensal || 0), 0);
  const total = depr + fixo;
  return {
    mensal: total,
    diario: total / 30,
    hora:   total / 30 / 8,
    deprMensal:  depr,
    fixoMensal:  fixo,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════════════════════════════
function css() { return `
/* ── Header ── */
.gc-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px; }
.gc-header h2 { margin:0; }

/* ── KPIs ── */
.gc-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px; }
@media(max-width:900px){ .gc-kpis { grid-template-columns:1fr 1fr; } }
.kpi-card { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px; }
.kpi-card.kpi-destaque { border-top:3px solid var(--primary); }
.kpi-label { font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
.kpi-val   { font-size:22px; font-weight:800; line-height:1.1; margin:4px 0 2px; }
.kpi-sub   { font-size:11px; color:var(--muted); }

/* ── Abas ── */
.gc-abas { display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap; }
.gc-aba {
  display:inline-flex; align-items:center; gap:7px;
  padding:8px 14px; border-radius:var(--radius-md);
  border:1px solid var(--border-md); background:transparent;
  color:var(--muted); cursor:pointer; font-family:var(--font);
  font-size:13px; font-weight:500; transition:all var(--t);
}
.gc-aba:hover { background:var(--panel2); color:var(--text); }
.gc-aba.active { background:var(--primary-bg); border-color:var(--primary-border); color:var(--primary-light); font-weight:700; }

/* ── Toast ── */
.gc-toast { border-radius:10px; padding:10px 16px; font-size:13px; margin-bottom:14px; }
.gc-toast.ok   { background:rgba(0,172,23,0.12); border:1px solid rgba(0,172,23,0.3); color:var(--info); }
.gc-toast.erro { background:var(--error-bg); border:1px solid var(--error-border); color:var(--error); }

/* ── Seção ── */
.gc-section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.gc-section-title  { font-size:16px; font-weight:700; }
.gc-hint { font-size:12px; color:var(--muted); background:var(--panel); border-left:3px solid var(--primary); padding:8px 12px; border-radius:0 var(--radius-sm) var(--radius-sm) 0; margin-bottom:14px; }
.gc-vazio { color:var(--muted); font-size:13px; padding:32px; text-align:center; background:var(--panel2); border-radius:var(--radius-lg); border:1px dashed var(--border-md); }
.gc-total-bar { display:flex; align-items:center; justify-content:space-between; background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 16px; margin-top:12px; font-size:13px; color:var(--muted); }
.gc-total-bar strong { font-size:16px; color:var(--text); }

/* ── Tabela ── */
.gc-table { width:100%; border-collapse:collapse; font-size:13px; }
.gc-table th { text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); padding:10px 14px; background:var(--panel2); border-bottom:1px solid var(--border); }
.gc-table td { padding:10px 14px; border-bottom:1px solid var(--border); vertical-align:middle; }
.gc-table tr:last-child td { border-bottom:none; }
.gc-table tr:hover td { background:rgba(0,124,190,0.04); }
.row-inativo td { opacity:.55; }
.tag-status { font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; }
.tag-status.ativo   { background:rgba(0,172,23,0.12); color:var(--info); }
.tag-status.inativo { background:var(--panel3); color:var(--muted); }

/* ── Equipamentos grid ── */
.equip-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
.equip-card { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:16px; }
.equip-card.critico   { border-color:rgba(232,160,16,0.4); }
.equip-card.depreciado{ border-color:rgba(171,0,0,0.3); background:rgba(171,0,0,0.03); }

.equip-card-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; }
.equip-nome  { font-size:15px; font-weight:700; }
.equip-cat   { font-size:11px; color:var(--muted); margin-top:2px; }
.equip-status { font-size:10px; font-weight:700; padding:3px 9px; border-radius:999px; flex-shrink:0; }
.equip-status.ok        { background:rgba(0,172,23,0.12); color:var(--info); }
.equip-status.critico   { background:var(--warning-bg); color:var(--warning); }
.equip-status.depreciado{ background:var(--error-bg); color:var(--error); }

.equip-valores { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:12px; }
.equip-val-item { background:var(--panel); border-radius:var(--radius-sm); padding:6px 10px; font-size:11px; }
.equip-val-item span   { display:block; color:var(--muted); margin-bottom:2px; }
.equip-val-item strong { font-size:13px; }

.equip-depr-destaque {
  display:flex; justify-content:space-between; align-items:center;
  background:rgba(232,160,16,0.08); border:1px solid rgba(232,160,16,0.2);
  border-radius:var(--radius-md); padding:10px 14px; margin-bottom:8px;
}
.depr-label { font-size:11px; color:var(--muted); margin-bottom:2px; }
.depr-valor { font-size:18px; font-weight:800; color:var(--warning); }

.equip-secundarios { display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-bottom:10px; }

.equip-prog-label { display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-bottom:4px; }
.prog-wrap { background:var(--panel); border-radius:99px; height:6px; overflow:hidden; margin-bottom:8px; }
.prog-bar  { height:100%; border-radius:99px; transition:width .4s; }
.prog-bar.ok        { background:var(--info); }
.prog-bar.critico   { background:var(--warning); }
.prog-bar.depreciado{ background:var(--error); }

.equip-data { font-size:11px; color:var(--muted); margin-top:4px; }
.equip-obs  { font-size:11px; color:var(--muted); font-style:italic; margin-top:4px; }
.equip-acoes { display:flex; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid var(--border); }

/* ── Resumo ── */
.resumo-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media(max-width:800px){ .resumo-grid { grid-template-columns:1fr; } }
.res-card { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:16px; }
.res-card-title { font-size:13px; font-weight:700; margin-bottom:14px; }
.res-vazio { color:var(--muted); font-size:13px; }

.composicao-bars { display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
.comp-row { display:flex; align-items:center; gap:8px; }
.comp-label { font-size:12px; width:90px; flex-shrink:0; color:var(--muted); }
.comp-bar-wrap { flex:1; height:8px; background:var(--panel); border-radius:99px; overflow:hidden; }
.comp-bar { height:100%; border-radius:99px; transition:width .5s; }
.comp-val { font-size:12px; font-weight:600; width:90px; text-align:right; white-space:nowrap; }
.comp-total { display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:10px; margin-top:10px; font-size:13px; color:var(--muted); }
.comp-total strong { font-size:16px; color:var(--text); }

.periodos-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; }
.periodo-item { background:var(--panel); border-radius:var(--radius-md); padding:10px 12px; }
.periodo-label { font-size:11px; color:var(--muted); margin-bottom:2px; }
.periodo-val   { font-size:14px; font-weight:700; color:var(--primary-light); }

/* ── Integração com orçamentos ── */
.integracao-card { display:flex; align-items:flex-start; gap:12px; background:rgba(0,124,190,0.08); border:1px solid var(--primary-border); border-radius:var(--radius-lg); padding:14px 16px; }
.integracao-icon { font-size:20px; flex-shrink:0; }
.integracao-titulo { font-size:13px; font-weight:700; margin-bottom:4px; }
.integracao-desc { font-size:12px; color:var(--muted); line-height:1.6; }
.custo-op-config { margin-top:4px; }
.custo-op-ex {
  display:inline-block; background:var(--panel); border:1px solid var(--border);
  border-radius:var(--radius-sm); padding:3px 8px; margin:3px 4px 0 0;
  font-size:11px; color:var(--muted);
}
.custo-op-ex strong { color:var(--primary-light); }

/* ── Modal ── */
.modal-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.modal-field { display:flex; flex-direction:column; gap:5px; }
.modal-field.full { grid-column:1/-1; }
.modal-field label { font-size:12px; color:var(--muted); font-weight:500; }
.modal-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; padding-top:14px; border-top:1px solid var(--border); }

.input-prefix-wrap, .input-suffix-wrap {
  display:flex; align-items:center;
  background:var(--panel2); border:1px solid var(--border-md);
  border-radius:var(--radius-md); overflow:hidden;
  transition:border-color var(--t);
}
.input-prefix-wrap:focus-within, .input-suffix-wrap:focus-within {
  border-color:var(--primary); box-shadow:0 0 0 3px rgba(0,124,190,0.10);
}
.input-prefix-wrap span, .input-suffix-wrap span {
  padding:0 10px; font-size:12px; font-weight:600; color:var(--muted);
  background:var(--panel3); border-right:1px solid var(--border);
  display:flex; align-items:center; white-space:nowrap; flex-shrink:0;
}
.input-suffix-wrap span { border-right:none; border-left:1px solid var(--border); }
.input-prefix-wrap input, .input-suffix-wrap input {
  border:none; background:transparent; flex:1;
  padding:9px 10px; font-size:13px; color:var(--text);
}
.input-prefix-wrap input:focus, .input-suffix-wrap input:focus {
  outline:none; box-shadow:none;
}

/* ── Prévia depreciação no modal ── */
.depr-preview { background:rgba(232,160,16,0.08); border:1px solid rgba(232,160,16,0.25); border-radius:var(--radius-md); padding:12px; margin-top:12px; }
.depr-preview-title { font-size:11px; font-weight:700; color:var(--warning); text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px; }
.depr-prev-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.depr-prev-grid > div { display:flex; flex-direction:column; gap:2px; }
.depr-prev-grid span  { font-size:11px; color:var(--muted); }
.depr-prev-grid strong { font-size:14px; color:var(--warning); }

/* ── Botões ── */
.btn-primary { background:var(--primary); color:#fff; border:none; border-radius:var(--radius-md); padding:8px 16px; cursor:pointer; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; transition:all var(--t); }
.btn-primary:hover { opacity:.88; }
.btn-secondary { background:transparent; border:1px solid var(--border-md); color:var(--text); border-radius:var(--radius-md); padding:8px 16px; cursor:pointer; font-size:13px; }
.btn-icon { background:transparent; border:1px solid var(--border); color:var(--muted); border-radius:var(--radius-sm); padding:5px 9px; cursor:pointer; font-size:12px; transition:all var(--t); }
.btn-icon:hover { border-color:var(--primary); color:var(--primary-light); }
.btn-icon.danger:hover { border-color:var(--error-border); color:var(--error); }
`; }