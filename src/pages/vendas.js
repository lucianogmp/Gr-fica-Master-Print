import { supabase } from "../supabase/client.js";

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  vendas: [],
  produtos: [],
  filtroStatus: "",
  vendaAberta: null, // venda sendo visualizada/editada
};

const STATUS = {
  pendente:     { label: "Pendente",      cor: "#ffa94d", emoji: "🕐" },
  em_producao:  { label: "Em produção",   cor: "#74c0fc", emoji: "⚙️" },
  pronto:       { label: "Pronto",        cor: "#a9e34b", emoji: "✅" },
  entregue:     { label: "Entregue",      cor: "#69db7c", emoji: "🚚" },
  pago:         { label: "Pago",          cor: "#b197fc", emoji: "💰" },
};

const ORDEM_STATUS = ["pendente","em_producao","pronto","entregue","pago"];

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function Vendas(container) {
  container.innerHTML = `<div class="loading">Carregando vendas...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const [{ data: vendas }, { data: prods }] = await Promise.all([
    supabase.from("vendas")
      .select("*, venda_itens(*)")
      .order("created_at", { ascending: false }),
    supabase.from("produtos").select("id, nome, categoria_id"),
  ]);
  state.vendas  = vendas || [];
  state.produtos = prods || [];
}

// ─── Render lista ─────────────────────────────────────────────────────────────
function render(container) {
  if (state.vendaAberta) { renderDetalhe(container); return; }

  container.innerHTML = `
    <style>
      .vnd-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:8px; }
      .vnd-header h2 { margin:0; }
      .filtros { display:flex; gap:6px; flex-wrap:wrap; }
      .filtro-btn { padding:5px 12px; border-radius:999px; border:1px solid rgba(255,255,255,0.1); background:var(--panel2); color:var(--muted); cursor:pointer; font-size:12px; }
      .filtro-btn.active { border-color:var(--accent); color:var(--accent); background:rgba(106,166,255,0.1); }

      /* Kanban / lista */
      .vnd-resumo { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
      .res-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:8px 14px; font-size:12px; }
      .res-card .v { font-size:18px; font-weight:700; margin-top:2px; }

      .vnd-lista { display:flex; flex-direction:column; gap:8px; }
      .vnd-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; cursor:pointer; transition:border-color .15s; }
      .vnd-card:hover { border-color:rgba(106,166,255,0.3); }
      .vnd-card-top { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
      .vnd-num { font-size:12px; color:var(--muted); }
      .vnd-cliente { font-weight:600; flex:1; }
      .vnd-status-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; }
      .vnd-total { font-size:20px; font-weight:700; }
      .vnd-info { display:flex; gap:12px; font-size:12px; color:var(--muted); margin-top:4px; }
      .vnd-vazio { color:var(--muted); text-align:center; padding:32px; }

      /* Botões */
      .btn-primary { background:var(--accent); color:#000; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; font-weight:600; }
      .btn-secondary { background:transparent; border:1px solid rgba(255,255,255,0.15); color:var(--text); border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; }
      .btn-icon { background:transparent; border:1px solid rgba(255,255,255,0.1); color:var(--muted); border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px; }
      .btn-icon:hover { border-color:var(--accent); color:var(--accent); }
      .btn-icon.danger:hover { border-color:#ff6b6b; color:#ff6b6b; }

      /* Modal nova venda */
      .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:100; }
      .modal { background:var(--panel); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:24px; min-width:340px; max-width:480px; width:92%; max-height:90vh; overflow-y:auto; }
      .modal h3 { margin:0 0 16px; }
      .modal label { font-size:12px; color:var(--muted); display:block; margin-bottom:4px; }
      .modal input, .modal select, .modal textarea { width:100%; background:var(--panel2); border:1px solid rgba(255,255,255,0.1); color:var(--text); border-radius:8px; padding:10px 12px; font-size:14px; box-sizing:border-box; margin-bottom:12px; }
      .modal textarea { resize:vertical; min-height:60px; }
      .modal-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }
    </style>

    <div class="vnd-header">
      <h2>Vendas</h2>
      <button class="btn-primary" id="btn-nova">+ Nova Venda</button>
    </div>

    <div class="filtros" id="filtros" style="margin-bottom:12px;">
      <button class="filtro-btn ${!state.filtroStatus ? "active" : ""}" data-f="">Todas</button>
      ${ORDEM_STATUS.map(s => `
        <button class="filtro-btn ${state.filtroStatus === s ? "active" : ""}" data-f="${s}">
          ${STATUS[s].emoji} ${STATUS[s].label}
        </button>
      `).join("")}
    </div>

    <div id="vnd-body"></div>
    <div id="modal-area"></div>
  `;

  container.querySelectorAll("[data-f]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.filtroStatus = btn.dataset.f;
      render(container);
    });
  });

  container.querySelector("#btn-nova").addEventListener("click", () => abrirModalNova(container));

  renderLista(container);
}

function renderLista(container) {
  const body = container.querySelector("#vnd-body");
  const lista = state.filtroStatus
    ? state.vendas.filter(v => v.status === state.filtroStatus)
    : state.vendas;

  const totalGeral = state.vendas.reduce((s, v) => s + Number(v.total || 0), 0);
  const totalFiltro = lista.reduce((s, v) => s + Number(v.total || 0), 0);
  const pagas = state.vendas.filter(v => v.status === "pago").reduce((s, v) => s + Number(v.total || 0), 0);

  body.innerHTML = `
    <div class="vnd-resumo">
      <div class="res-card"><div>Total geral</div><div class="v">R$ ${totalGeral.toFixed(2)}</div></div>
      <div class="res-card"><div>Recebido (pago)</div><div class="v" style="color:#b197fc">R$ ${pagas.toFixed(2)}</div></div>
      <div class="res-card"><div>Filtro atual</div><div class="v" style="color:var(--accent)">${lista.length} vendas · R$ ${totalFiltro.toFixed(2)}</div></div>
    </div>

    <div class="vnd-lista">
      ${lista.length === 0
        ? `<div class="vnd-vazio">Nenhuma venda encontrada.</div>`
        : lista.map(v => {
            const st = STATUS[v.status];
            const data = new Date(v.created_at).toLocaleDateString("pt-BR");
            const itens = v.venda_itens?.length ?? 0;
            return `
              <div class="vnd-card" data-abrir="${v.id}">
                <div class="vnd-card-top">
                  <span class="vnd-num">#${v.numero}</span>
                  <span class="vnd-cliente">${v.cliente_nome || "Cliente não informado"}</span>
                  <span class="vnd-status-badge" style="background:${st.cor}22;color:${st.cor}">${st.emoji} ${st.label}</span>
                </div>
                <div class="vnd-total">R$ ${Number(v.total || 0).toFixed(2)}</div>
                <div class="vnd-info">
                  <span>📦 ${itens} item${itens !== 1 ? "s" : ""}</span>
                  <span>📅 ${data}</span>
                  ${v.observacoes ? `<span>💬 ${v.observacoes.slice(0,40)}${v.observacoes.length > 40 ? "…" : ""}</span>` : ""}
                </div>
              </div>
            `;
          }).join("")
      }
    </div>
  `;

  body.querySelectorAll("[data-abrir]").forEach(card => {
    card.addEventListener("click", () => {
      state.vendaAberta = state.vendas.find(v => v.id === card.dataset.abrir);
      renderDetalhe(container);
    });
  });
}

// ─── Detalhe da venda ─────────────────────────────────────────────────────────
async function renderDetalhe(container) {
  const v = state.vendaAberta;
  if (!v) { render(container); return; }

  // Recarrega itens frescos
  const { data: itens } = await supabase
    .from("venda_itens")
    .select("*, produtos(nome)")
    .eq("venda_id", v.id)
    .order("created_at");

  const st = STATUS[v.status];
  const subtotal = (itens || []).reduce((s, i) => s + Number(i.total || 0), 0);
  const desconto = Number(v.desconto || 0);
  const total    = subtotal - desconto;

  const prodOptions = state.produtos
    .map(p => `<option value="${p.id}">${p.nome}</option>`)
    .join("");

  const statusOptions = ORDEM_STATUS.map(s =>
    `<option value="${s}" ${v.status === s ? "selected" : ""}>${STATUS[s].emoji} ${STATUS[s].label}</option>`
  ).join("");

  container.innerHTML = `
    <style>
      .det-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
      .det-header h2 { margin:0; flex:1; }
      .det-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
      @media(max-width:600px){ .det-grid { grid-template-columns:1fr; } }
      .det-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; }
      .det-card label { font-size:11px; color:var(--muted); display:block; margin-bottom:4px; }
      .det-card input, .det-card select, .det-card textarea {
        width:100%; background:var(--panel); border:1px solid rgba(255,255,255,0.1);
        color:var(--text); border-radius:8px; padding:8px 10px; font-size:13px; box-sizing:border-box;
      }
      .det-card textarea { resize:vertical; min-height:50px; }

      /* Itens */
      .itens-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; margin-bottom:12px; }
      .itens-card h4 { margin:0 0 10px; }
      .item-row { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:13px; }
      .item-row:last-of-type { border-bottom:none; }
      .item-desc { flex:1; }
      .item-qtd { color:var(--muted); white-space:nowrap; }
      .item-total { font-weight:600; white-space:nowrap; min-width:80px; text-align:right; }
      .item-del { color:#ff6b6b; cursor:pointer; opacity:0; }
      .item-row:hover .item-del { opacity:1; }

      /* Add item */
      .add-item-form { background:var(--panel); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; margin-top:10px; }
      .add-item-form h5 { margin:0 0 10px; font-size:13px; color:var(--muted); }
      .add-item-row { display:flex; gap:8px; flex-wrap:wrap; }
      .add-item-row input, .add-item-row select {
        background:var(--panel2); border:1px solid rgba(255,255,255,0.1);
        color:var(--text); border-radius:8px; padding:7px 10px; font-size:13px;
      }
      .add-item-row .f-desc { flex:1; min-width:140px; }
      .add-item-row .f-num  { width:80px; }
      .add-tipo { display:flex; gap:6px; margin-bottom:8px; }
      .tipo-btn { padding:5px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:var(--muted); cursor:pointer; font-size:12px; }
      .tipo-btn.active { border-color:var(--accent); color:var(--accent); }

      /* Totais */
      .totais { text-align:right; padding:10px 0; }
      .totais .linha { display:flex; justify-content:flex-end; gap:16px; font-size:13px; color:var(--muted); margin-bottom:4px; }
      .totais .total-final { font-size:22px; font-weight:700; color:var(--text); }

      .btn-primary { background:var(--accent); color:#000; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; font-weight:600; }
      .btn-secondary { background:transparent; border:1px solid rgba(255,255,255,0.15); color:var(--text); border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; }
      .btn-danger { background:rgba(255,107,107,0.15); border:1px solid #ff6b6b44; color:#ff6b6b; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; }
      .det-acoes { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
    </style>

    <div class="det-header">
      <button class="btn-secondary" id="btn-voltar">← Voltar</button>
      <h2>#${v.numero} — ${v.cliente_nome || "Sem cliente"}</h2>
      <span style="font-size:13px;padding:4px 12px;border-radius:999px;background:${st.cor}22;color:${st.cor};font-weight:700">${st.emoji} ${st.label}</span>
    </div>

    <!-- Info geral -->
    <div class="det-grid">
      <div class="det-card">
        <label>Cliente</label>
        <input id="d-cliente" value="${v.cliente_nome || ""}" placeholder="Nome do cliente (opcional)" />
        <label style="margin-top:8px">Observações</label>
        <textarea id="d-obs">${v.observacoes || ""}</textarea>
      </div>
      <div class="det-card">
        <label>Status</label>
        <select id="d-status">${statusOptions}</select>
        <label style="margin-top:8px">Desconto (R$)</label>
        <input id="d-desconto" type="number" min="0" step="0.01" value="${desconto}" />
        <div style="margin-top:10px">
          <button class="btn-primary" id="btn-salvar-info" style="width:100%">Salvar alterações</button>
        </div>
      </div>
    </div>

    <!-- Itens -->
    <div class="itens-card">
      <h4>Itens da venda</h4>
      ${(itens || []).length === 0
        ? `<div style="color:var(--muted);font-size:13px">Nenhum item ainda.</div>`
        : (itens || []).map(i => `
            <div class="item-row">
              <span class="item-desc">${i.descricao}${i.produtos ? ` <span style="color:var(--muted);font-size:11px">(${i.produtos.nome})</span>` : ""}</span>
              <span class="item-qtd">${Number(i.quantidade)} × R$ ${Number(i.preco_unitario).toFixed(2)}</span>
              <span class="item-total">R$ ${Number(i.total).toFixed(2)}</span>
              <span class="item-del" data-del-item="${i.id}">✕</span>
            </div>
          `).join("")
      }

      <!-- Totais -->
      <div class="totais">
        <div class="linha"><span>Subtotal</span><span>R$ ${subtotal.toFixed(2)}</span></div>
        ${desconto > 0 ? `<div class="linha"><span>Desconto</span><span style="color:#ff6b6b">− R$ ${desconto.toFixed(2)}</span></div>` : ""}
        <div class="total-final">Total: R$ ${total.toFixed(2)}</div>
      </div>

      <!-- Adicionar item -->
      <div class="add-item-form">
        <h5>Adicionar item</h5>
        <div class="add-tipo">
          <button class="tipo-btn active" id="tipo-catalogo">📦 Do catálogo</button>
          <button class="tipo-btn" id="tipo-livre">✏️ Livre</button>
        </div>
        <div id="add-catalogo">
          <div class="add-item-row">
            <select id="ai-produto" class="f-desc">
              <option value="">Selecionar produto...</option>
              ${prodOptions}
            </select>
            <input id="ai-desc-cat" class="f-desc" placeholder="Descrição adicional (opcional)" />
            <input id="ai-qtd-cat" class="f-num" type="number" min="0.001" step="0.001" placeholder="Qtd" value="1" />
            <input id="ai-preco-cat" class="f-num" type="number" min="0" step="0.01" placeholder="R$" />
            <button class="btn-primary" id="btn-add-cat">+ Add</button>
          </div>
        </div>
        <div id="add-livre" style="display:none">
          <div class="add-item-row">
            <input id="ai-desc-liv" class="f-desc" placeholder="Descrição do item" />
            <input id="ai-qtd-liv" class="f-num" type="number" min="0.001" step="0.001" placeholder="Qtd" value="1" />
            <input id="ai-preco-liv" class="f-num" type="number" min="0" step="0.01" placeholder="R$" />
            <button class="btn-primary" id="btn-add-liv">+ Add</button>
          </div>
        </div>
      </div>
    </div>

    <div class="det-acoes">
      <button class="btn-danger" id="btn-deletar">🗑 Deletar venda</button>
    </div>
  `;

  // Voltar
  container.querySelector("#btn-voltar").addEventListener("click", () => {
    state.vendaAberta = null;
    recarregar(container);
  });

  // Salvar info
  container.querySelector("#btn-salvar-info").addEventListener("click", async () => {
    const cliente = container.querySelector("#d-cliente").value.trim();
    const obs     = container.querySelector("#d-obs").value.trim();
    const status  = container.querySelector("#d-status").value;
    const desc    = parseFloat(container.querySelector("#d-desconto").value) || 0;

    await supabase.from("vendas").update({
      cliente_nome: cliente || null,
      observacoes: obs || null,
      status,
      desconto: desc,
      total: subtotal - desc,
      updated_at: new Date(),
    }).eq("id", v.id);

    state.vendaAberta = { ...state.vendaAberta, cliente_nome: cliente, status, desconto: desc, observacoes: obs };
    await recarregar(container);
  });

  // Deletar item
  container.querySelectorAll("[data-del-item]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remover este item?")) return;
      await supabase.from("venda_itens").delete().eq("id", btn.dataset.delItem);
      await atualizarTotal(v.id);
      await recarregar(container);
    });
  });

  // Deletar venda
  container.querySelector("#btn-deletar").addEventListener("click", async () => {
    if (!confirm("Deletar esta venda permanentemente?")) return;
    await supabase.from("vendas").delete().eq("id", v.id);
    state.vendaAberta = null;
    await recarregar(container);
  });

  // Toggle tipo item
  const btnCat = container.querySelector("#tipo-catalogo");
  const btnLiv = container.querySelector("#tipo-livre");
  const divCat = container.querySelector("#add-catalogo");
  const divLiv = container.querySelector("#add-livre");
  btnCat.addEventListener("click", () => {
    btnCat.classList.add("active"); btnLiv.classList.remove("active");
    divCat.style.display = ""; divLiv.style.display = "none";
  });
  btnLiv.addEventListener("click", () => {
    btnLiv.classList.add("active"); btnCat.classList.remove("active");
    divLiv.style.display = ""; divCat.style.display = "none";
  });

  // Add do catálogo
  container.querySelector("#btn-add-cat").addEventListener("click", async () => {
    const prodId = container.querySelector("#ai-produto").value;
    const descExtra = container.querySelector("#ai-desc-cat").value.trim();
    const qtd   = parseFloat(container.querySelector("#ai-qtd-cat").value) || 1;
    const preco = parseFloat(container.querySelector("#ai-preco-cat").value);
    if (!prodId) { alert("Selecione um produto."); return; }
    if (!preco)  { alert("Informe o preço."); return; }
    const prod = state.produtos.find(p => p.id === prodId);
    const desc = descExtra || prod?.nome || "Produto";
    await supabase.from("venda_itens").insert({
      venda_id: v.id, produto_id: prodId, descricao: desc, quantidade: qtd, preco_unitario: preco,
    });
    await atualizarTotal(v.id);
    await recarregar(container);
  });

  // Add livre
  container.querySelector("#btn-add-liv").addEventListener("click", async () => {
    const desc  = container.querySelector("#ai-desc-liv").value.trim();
    const qtd   = parseFloat(container.querySelector("#ai-qtd-liv").value) || 1;
    const preco = parseFloat(container.querySelector("#ai-preco-liv").value);
    if (!desc)  { alert("Informe a descrição."); return; }
    if (!preco) { alert("Informe o preço."); return; }
    await supabase.from("venda_itens").insert({
      venda_id: v.id, produto_id: null, descricao: desc, quantidade: qtd, preco_unitario: preco,
    });
    await atualizarTotal(v.id);
    await recarregar(container);
  });
}

// ─── Atualiza total da venda ──────────────────────────────────────────────────
async function atualizarTotal(vendaId) {
  const { data: itens } = await supabase.from("venda_itens").select("total").eq("venda_id", vendaId);
  const { data: venda } = await supabase.from("vendas").select("desconto").eq("id", vendaId).single();
  const subtotal = (itens || []).reduce((s, i) => s + Number(i.total || 0), 0);
  const total = subtotal - Number(venda?.desconto || 0);
  await supabase.from("vendas").update({ total }).eq("id", vendaId);
}

// ─── Modal nova venda ─────────────────────────────────────────────────────────
function abrirModalNova(container) {
  const area = container.querySelector("#modal-area");
  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>Nova Venda</h3>
        <label>Cliente (opcional)</label>
        <input id="m-cliente" placeholder="Nome do cliente..." autofocus />
        <label>Observações</label>
        <textarea id="m-obs" placeholder="Ex: Entrega urgente, retirada na loja..."></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button class="btn-secondary" id="m-cancel">Cancelar</button>
          <button class="btn-primary" id="m-ok">Criar venda</button>
        </div>
      </div>
    </div>
  `;

  area.querySelector("#m-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });
  area.querySelector("#m-ok").addEventListener("click", async () => {
    const cliente = area.querySelector("#m-cliente").value.trim();
    const obs     = area.querySelector("#m-obs").value.trim();
    const { data } = await supabase.from("vendas").insert({
      cliente_nome: cliente || null,
      observacoes: obs || null,
      status: "pendente",
      total: 0,
    }).select().single();
    area.innerHTML = "";
    await carregar();
    state.vendaAberta = data;
    renderDetalhe(container);
  });
}

// ─── Recarrega ────────────────────────────────────────────────────────────────
async function recarregar(container) {
  await carregar();
  if (state.vendaAberta) {
    state.vendaAberta = state.vendas.find(v => v.id === state.vendaAberta.id) || null;
    renderDetalhe(container);
  } else {
    render(container);
  }
}