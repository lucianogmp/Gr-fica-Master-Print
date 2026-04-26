import { supabase } from "../supabase/client.js";

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  materias: [],      // matérias-primas com saldo calculado
  movimentos: [],    // histórico completo
  filtroMp: "",      // filtro de matéria-prima no histórico
  aba: "saldo",      // "saldo" | "historico"
};

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function Estoque(container) {
  container.innerHTML = `<div class="loading">Carregando estoque...</div>`;
  await carregar();
  render(container);
}

// ─── Carrega dados ────────────────────────────────────────────────────────────
async function carregar() {
  const [{ data: mps }, { data: movs }] = await Promise.all([
    supabase.from("materias_primas").select("*").order("nome"),
    supabase.from("estoque_movimentos")
      .select("*, materias_primas(nome, unidade)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const movimentos = movs || [];

  state.materias = (mps || []).map(mp => {
    const movsMp = movimentos.filter(m => m.materia_prima_id === mp.id);
    const entradas = movsMp.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.quantidade), 0);
    const saidas   = movsMp.filter(m => m.tipo === "saida").reduce((s, m) => s + Number(m.quantidade), 0);
    const saldo    = entradas - saidas;
    return { ...mp, saldo, entradas, saidas };
  });

  state.movimentos = movimentos;
}

// ─── Render principal ─────────────────────────────────────────────────────────
function render(container) {
  container.innerHTML = `
    <style>
      .est-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px; }
      .est-header h2 { margin:0; }
      .est-abas { display:flex; gap:6px; }
      .aba-btn { padding:7px 14px; border-radius:999px; border:1px solid rgba(255,255,255,0.1); background:var(--panel2); color:var(--text); cursor:pointer; font-size:13px; }
      .aba-btn.active { border-color:var(--accent); background:rgba(106,166,255,0.12); color:var(--accent); }

      /* Cards de saldo */
      .est-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:10px; }
      .mp-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; }
      .mp-card.alerta { border-color:#ff6b6b44; background:rgba(255,107,107,0.06); }
      .mp-card.zerado { border-color:#ff6b6b88; background:rgba(255,107,107,0.12); }
      .mp-nome { font-size:14px; font-weight:600; margin-bottom:6px; }
      .mp-saldo { font-size:26px; font-weight:700; }
      .mp-saldo.negativo { color:#ff6b6b; }
      .mp-saldo.baixo    { color:#ffa94d; }
      .mp-saldo.ok       { color:#69db7c; }
      .mp-unidade { font-size:12px; color:var(--muted); margin-left:4px; }
      .mp-minimo { font-size:11px; color:var(--muted); margin-top:2px; }
      .mp-alerta-badge { font-size:10px; color:#ff6b6b; font-weight:700; }
      .mp-card-btns { display:flex; gap:6px; margin-top:10px; }

      /* Botões */
      .btn-entrada { background:rgba(105,219,124,0.15); border:1px solid #69db7c55; color:#69db7c; border-radius:7px; padding:5px 10px; cursor:pointer; font-size:12px; }
      .btn-entrada:hover { background:rgba(105,219,124,0.25); }
      .btn-saida { background:rgba(255,107,107,0.15); border:1px solid #ff6b6b55; color:#ff6b6b; border-radius:7px; padding:5px 10px; cursor:pointer; font-size:12px; }
      .btn-saida:hover { background:rgba(255,107,107,0.25); }
      .btn-config { background:transparent; border:1px solid rgba(255,255,255,0.1); color:var(--muted); border-radius:7px; padding:5px 8px; cursor:pointer; font-size:12px; }
      .btn-config:hover { border-color:var(--accent); color:var(--accent); }
      .btn-primary { background:var(--accent); color:#000; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; font-weight:600; }
      .btn-secondary { background:transparent; border:1px solid rgba(255,255,255,0.15); color:var(--text); border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; }

      /* Resumo topo */
      .est-resumo { display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
      .resumo-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 16px; }
      .resumo-card .k { font-size:11px; color:var(--muted); }
      .resumo-card .v { font-size:20px; font-weight:700; margin-top:2px; }
      .resumo-card .v.warn { color:#ffa94d; }
      .resumo-card .v.danger { color:#ff6b6b; }

      /* Histórico */
      .hist-filtro { margin-bottom:12px; display:flex; gap:8px; }
      .hist-filtro select { background:var(--panel2); border:1px solid rgba(255,255,255,0.1); color:var(--text); border-radius:8px; padding:8px 12px; font-size:13px; }
      .hist-table { width:100%; border-collapse:collapse; font-size:13px; }
      .hist-table th { text-align:left; color:var(--muted); font-weight:500; padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.06); }
      .hist-table td { padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.04); }
      .hist-table tr:hover td { background:rgba(255,255,255,0.02); }
      .tag-entrada { color:#69db7c; font-size:11px; font-weight:700; }
      .tag-saida { color:#ff6b6b; font-size:11px; font-weight:700; }
      .tag-manual { color:var(--muted); font-size:11px; }
      .tag-venda { color:var(--accent); font-size:11px; }
      .hist-vazio { color:var(--muted); text-align:center; padding:24px; }

      /* Modal */
      .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:100; }
      .modal { background:var(--panel); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:24px; min-width:320px; max-width:400px; width:90%; }
      .modal h3 { margin:0 0 4px; }
      .modal .sub { color:var(--muted); font-size:13px; margin-bottom:16px; }
      .modal label { font-size:12px; color:var(--muted); display:block; margin-bottom:4px; }
      .modal input, .modal select, .modal textarea { width:100%; background:var(--panel2); border:1px solid rgba(255,255,255,0.1); color:var(--text); border-radius:8px; padding:10px 12px; font-size:14px; box-sizing:border-box; margin-bottom:12px; }
      .modal textarea { resize:vertical; min-height:60px; }
      .modal-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }
      .saldo-atual { font-size:13px; color:var(--muted); margin-bottom:14px; }
      .saldo-atual span { color:var(--text); font-weight:600; }
    </style>

    <div class="est-header">
      <h2>Estoque</h2>
      <div class="est-abas">
        <button class="aba-btn ${state.aba === "saldo" ? "active" : ""}" data-aba="saldo">📦 Saldo Atual</button>
        <button class="aba-btn ${state.aba === "historico" ? "active" : ""}" data-aba="historico">📋 Histórico</button>
      </div>
    </div>

    <div id="est-body"></div>
    <div id="modal-area"></div>
  `;

  container.querySelectorAll("[data-aba]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.aba = btn.dataset.aba;
      render(container);
    });
  });

  if (state.aba === "saldo") renderSaldo(container);
  else renderHistorico(container);
}

// ─── Aba Saldo ────────────────────────────────────────────────────────────────
function renderSaldo(container) {
  const body = container.querySelector("#est-body");

  const alertas  = state.materias.filter(m => m.saldo > 0 && m.saldo <= m.estoque_minimo).length;
  const zerados  = state.materias.filter(m => m.saldo <= 0).length;
  const custoTotal = state.materias.reduce((s, m) => s + (m.saldo * Number(m.custo_unitario || 0)), 0);

  const cardsHtml = state.materias.map(mp => {
    const saldo = Number(mp.saldo);
    const min   = Number(mp.estoque_minimo || 0);
    const zerado = saldo <= 0;
    const baixo  = !zerado && min > 0 && saldo <= min;
    const cls    = zerado ? "zerado" : baixo ? "alerta" : "";
    const saldoCls = zerado ? "negativo" : baixo ? "baixo" : "ok";

    return `
      <div class="mp-card ${cls}">
        <div class="mp-nome">${mp.nome}</div>
        ${zerado ? `<div class="mp-alerta-badge">⚠️ SEM ESTOQUE</div>` : ""}
        ${baixo  ? `<div class="mp-alerta-badge">⚠️ ESTOQUE BAIXO</div>` : ""}
        <div class="mp-saldo ${saldoCls}">${saldo.toFixed(2)}<span class="mp-unidade">${mp.unidade}</span></div>
        <div class="mp-minimo">Mínimo: ${min} ${mp.unidade} · R$ ${Number(mp.custo_unitario||0).toFixed(2)}/un</div>
        <div class="mp-card-btns">
          <button class="btn-entrada" data-mov="entrada" data-id="${mp.id}" data-nome="${mp.nome}" data-un="${mp.unidade}" data-saldo="${saldo}">+ Entrada</button>
          <button class="btn-saida"   data-mov="saida"   data-id="${mp.id}" data-nome="${mp.nome}" data-un="${mp.unidade}" data-saldo="${saldo}">− Saída</button>
          <button class="btn-config" data-config="${mp.id}" data-nome="${mp.nome}" data-min="${min}" data-custo="${mp.custo_unitario}">⚙</button>
        </div>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    <div class="est-resumo">
      <div class="resumo-card"><div class="k">Itens cadastrados</div><div class="v">${state.materias.length}</div></div>
      <div class="resumo-card"><div class="k">Estoque baixo</div><div class="v warn">${alertas}</div></div>
      <div class="resumo-card"><div class="k">Sem estoque</div><div class="v danger">${zerados}</div></div>
      <div class="resumo-card"><div class="k">Custo total em estoque</div><div class="v">R$ ${custoTotal.toFixed(2)}</div></div>
    </div>
    <div class="est-grid">${cardsHtml || `<div class="muted">Nenhuma matéria-prima cadastrada. Adicione em Produtos → + Matéria-Prima.</div>`}</div>
  `;

  body.addEventListener("click", (e) => {
    const mov = e.target.closest("[data-mov]");
    if (mov) {
      abrirModalMov(container, mov.dataset.mov, {
        id: mov.dataset.id, nome: mov.dataset.nome,
        unidade: mov.dataset.un, saldo: parseFloat(mov.dataset.saldo),
      });
      return;
    }
    const cfg = e.target.closest("[data-config]");
    if (cfg) {
      abrirModalConfig(container, {
        id: cfg.dataset.config, nome: cfg.dataset.nome,
        min: cfg.dataset.min, custo: cfg.dataset.custo,
      });
    }
  });
}

// ─── Aba Histórico ────────────────────────────────────────────────────────────
function renderHistorico(container) {
  const body = container.querySelector("#est-body");

  const mpOptions = state.materias
    .map(mp => `<option value="${mp.id}" ${state.filtroMp === mp.id ? "selected" : ""}>${mp.nome}</option>`)
    .join("");

  const movsFiltrados = state.filtroMp
    ? state.movimentos.filter(m => m.materia_prima_id === state.filtroMp)
    : state.movimentos;

  const linhas = movsFiltrados.map(m => {
    const data = new Date(m.created_at).toLocaleString("pt-BR");
    const sinal = m.tipo === "entrada" ? "+" : "−";
    const tagTipo = m.tipo === "entrada"
      ? `<span class="tag-entrada">▲ ENTRADA</span>`
      : `<span class="tag-saida">▼ SAÍDA</span>`;
    const tagOrigem = m.origem === "venda"
      ? `<span class="tag-venda">venda</span>`
      : `<span class="tag-manual">manual</span>`;

    return `
      <tr>
        <td>${tagTipo}</td>
        <td>${m.materias_primas?.nome ?? "—"}</td>
        <td style="font-weight:600">${sinal}${Number(m.quantidade).toFixed(2)} ${m.materias_primas?.unidade ?? ""}</td>
        <td>${m.motivo || "—"}</td>
        <td>${tagOrigem}</td>
        <td style="color:var(--muted);font-size:12px">${data}</td>
      </tr>
    `;
  }).join("");

  body.innerHTML = `
    <div class="hist-filtro">
      <select id="filtro-mp">
        <option value="">Todas as matérias-primas</option>
        ${mpOptions}
      </select>
    </div>
    ${movsFiltrados.length === 0
      ? `<div class="hist-vazio">Nenhum movimento registrado ainda.</div>`
      : `<table class="hist-table">
          <thead><tr>
            <th>Tipo</th><th>Matéria-Prima</th><th>Quantidade</th><th>Motivo</th><th>Origem</th><th>Data</th>
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>`
    }
  `;

  body.querySelector("#filtro-mp")?.addEventListener("change", (e) => {
    state.filtroMp = e.target.value;
    renderHistorico(container);
  });
}

// ─── Modal lançamento ─────────────────────────────────────────────────────────
function abrirModalMov(container, tipo, mp) {
  const area = container.querySelector("#modal-area");
  const cor  = tipo === "entrada" ? "#69db7c" : "#ff6b6b";
  const label = tipo === "entrada" ? "Entrada" : "Saída";

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3 style="color:${cor}">${label === "Entrada" ? "▲" : "▼"} ${label}</h3>
        <div class="sub">${mp.nome}</div>
        <div class="saldo-atual">Saldo atual: <span>${mp.saldo.toFixed(2)} ${mp.unidade}</span></div>
        <label>Quantidade (${mp.unidade})</label>
        <input id="m-qtd" type="number" min="0.001" step="0.001" placeholder="0" autofocus />
        <label>Motivo (opcional)</label>
        <textarea id="m-motivo" placeholder="Ex: Compra NF 123, Ajuste de inventário..."></textarea>
        <div class="modal-btns">
          <button class="btn-secondary" id="m-cancel">Cancelar</button>
          <button class="btn-primary" id="m-ok" style="background:${cor}">Confirmar ${label}</button>
        </div>
      </div>
    </div>
  `;

  area.querySelector("#m-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });
  area.querySelector("#m-ok").addEventListener("click", async () => {
    const qtd = parseFloat(area.querySelector("#m-qtd").value);
    if (!qtd || qtd <= 0) { alert("Informe uma quantidade válida."); return; }
    const motivo = area.querySelector("#m-motivo").value.trim();

    if (tipo === "saida" && qtd > mp.saldo) {
      if (!confirm(`Saldo insuficiente (${mp.saldo.toFixed(2)} ${mp.unidade}). Lançar mesmo assim?`)) return;
    }

    await supabase.from("estoque_movimentos").insert({
      materia_prima_id: mp.id, tipo, quantidade: qtd,
      motivo: motivo || null, origem: "manual",
    });

    area.innerHTML = "";
    await recarregar(container);
  });
}

// ─── Modal configuração (mínimo + custo) ─────────────────────────────────────
function abrirModalConfig(container, mp) {
  const area = container.querySelector("#modal-area");

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>⚙ Configurar</h3>
        <div class="sub">${mp.nome}</div>
        <label>Estoque mínimo</label>
        <input id="m-min" type="number" min="0" step="0.001" value="${mp.min}" />
        <label>Custo unitário (R$)</label>
        <input id="m-custo" type="number" min="0" step="0.01" value="${mp.custo}" />
        <div class="modal-btns">
          <button class="btn-secondary" id="m-cancel">Cancelar</button>
          <button class="btn-primary" id="m-ok">Salvar</button>
        </div>
      </div>
    </div>
  `;

  area.querySelector("#m-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });
  area.querySelector("#m-ok").addEventListener("click", async () => {
    const min   = parseFloat(area.querySelector("#m-min").value)   || 0;
    const custo = parseFloat(area.querySelector("#m-custo").value) || 0;
    await supabase.from("materias_primas").update({ estoque_minimo: min, custo_unitario: custo }).eq("id", mp.id);
    area.innerHTML = "";
    await recarregar(container);
  });
}

// ─── Recarrega ────────────────────────────────────────────────────────────────
async function recarregar(container) {
  await carregar();
  render(container);
}