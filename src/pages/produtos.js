import { supabase } from "../supabase/client.js";

// ─── Estado local ────────────────────────────────────────────────────────────
let state = {
  categorias: [],       // [{ id, nome, produtos: [{ id, nome, materias: [] }] }]
  materias_primas: [],  // lista global de matérias-primas
  expandido: {},        // { [id]: true/false } controla abertura na árvore
  modal: null,          // qual modal está aberto
};

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function Produtos(container) {
  container.innerHTML = `<div class="loading">Carregando produtos...</div>`;
  await carregarTudo();
  render(container);
}

// ─── Carrega dados do Supabase ────────────────────────────────────────────────
async function carregarTudo() {
  const [{ data: cats }, { data: prods }, { data: mps }, { data: bom }] = await Promise.all([
    supabase.from("categorias").select("*").order("nome"),
    supabase.from("produtos").select("*").order("nome"),
    supabase.from("materias_primas").select("*").order("nome"),
    supabase.from("produto_materias").select("*, materias_primas(id, nome, unidade, custo_unitario)"),
  ]);

  state.materias_primas = mps || [];

  state.categorias = (cats || []).map(cat => ({
    ...cat,
    produtos: (prods || [])
      .filter(p => p.categoria_id === cat.id)
      .map(prod => ({
        ...prod,
        materias: (bom || []).filter(b => b.produto_id === prod.id),
      })),
  }));
}

// ─── Render principal ─────────────────────────────────────────────────────────
function render(container) {
  container.innerHTML = `
    <style>
      .prod-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
      .prod-header h2 { margin:0; }
      .prod-actions { display:flex; gap:8px; }
      .tree { display:flex; flex-direction:column; gap:8px; }

      /* Categoria */
      .cat-block { background:var(--panel); border:1px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden; }
      .cat-row { display:flex; align-items:center; gap:8px; padding:12px 14px; cursor:pointer; user-select:none; }
      .cat-row:hover { background:rgba(255,255,255,0.04); }
      .cat-chevron { transition:transform .2s; font-size:11px; color:var(--muted); }
      .cat-chevron.open { transform:rotate(90deg); }
      .cat-name { font-weight:700; font-size:15px; flex:1; }
      .cat-badge { font-size:11px; background:rgba(106,166,255,0.15); color:var(--accent); padding:2px 8px; border-radius:999px; }
      .cat-btns { display:flex; gap:4px; }

      /* Produtos dentro da categoria */
      .cat-body { padding:0 14px 12px 14px; display:flex; flex-direction:column; gap:6px; }
      .prod-block { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:10px; overflow:hidden; }
      .prod-row { display:flex; align-items:center; gap:8px; padding:10px 12px; cursor:pointer; }
      .prod-row:hover { background:rgba(255,255,255,0.03); }
      .prod-chevron { transition:transform .2s; font-size:10px; color:var(--muted); }
      .prod-chevron.open { transform:rotate(90deg); }
      .prod-name { flex:1; font-size:14px; }
      .prod-btns { display:flex; gap:4px; }

      /* BOM */
      .bom-body { padding:0 12px 10px 28px; display:flex; flex-direction:column; gap:4px; }
      .bom-row { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
      .bom-row:last-child { border-bottom:none; }
      .bom-nome { flex:1; }
      .bom-qtd { font-size:12px; color:var(--accent); white-space:nowrap; }
      .bom-del { opacity:0; cursor:pointer; font-size:11px; color:#ff6b6b; }
      .bom-row:hover .bom-del { opacity:1; }
      .bom-add { display:flex; gap:6px; margin-top:6px; }
      .bom-add select, .bom-add input { background:var(--panel); border:1px solid rgba(255,255,255,0.1); color:var(--text); border-radius:6px; padding:5px 8px; font-size:12px; }
      .bom-add select { flex:1; }
      .bom-add input { width:70px; }

      /* Botões pequenos */
      .btn-icon { background:transparent; border:1px solid rgba(255,255,255,0.1); color:var(--muted); border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px; }
      .btn-icon:hover { border-color:var(--accent); color:var(--accent); }
      .btn-icon.danger:hover { border-color:#ff6b6b; color:#ff6b6b; }
      .btn-primary { background:var(--accent); color:#000; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; font-weight:600; }
      .btn-primary:hover { opacity:.85; }
      .btn-secondary { background:transparent; border:1px solid rgba(255,255,255,0.15); color:var(--text); border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; }

      /* Vazio */
      .empty-cat { color:var(--muted); font-size:13px; padding:8px 0; }
      .add-prod-row { margin-top:6px; }

      /* Modal */
      .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:100; }
      .modal { background:var(--panel); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:24px; min-width:320px; max-width:420px; width:90%; }
      .modal h3 { margin:0 0 16px; }
      .modal input, .modal select { width:100%; background:var(--panel2); border:1px solid rgba(255,255,255,0.1); color:var(--text); border-radius:8px; padding:10px 12px; font-size:14px; box-sizing:border-box; margin-bottom:12px; }
      .modal-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }
    </style>

    <div class="prod-header">
      <h2>Produtos</h2>
      <div class="prod-actions">
        <button class="btn-secondary" id="btn-nova-mp">+ Matéria-Prima</button>
        <button class="btn-primary" id="btn-nova-cat">+ Categoria</button>
      </div>
    </div>

    <div class="tree" id="tree"></div>
    <div id="modal-area"></div>
  `;

  renderTree(container);
  bindTopButtons(container);
}

// ─── Renderiza a árvore ───────────────────────────────────────────────────────
function renderTree(container) {
  const tree = container.querySelector("#tree");

  if (state.categorias.length === 0) {
    tree.innerHTML = `<div class="muted">Nenhuma categoria ainda. Clique em "+ Categoria" para começar.</div>`;
    return;
  }

  tree.innerHTML = state.categorias.map(cat => {
    const open = !!state.expandido[cat.id];
    const prodCount = cat.produtos.length;

    const produtosHtml = cat.produtos.map(prod => {
      const prodOpen = !!state.expandido[prod.id];
      const bomHtml = prod.materias.map(b => `
        <div class="bom-row">
          <span class="bom-nome">📦 ${b.materias_primas?.nome ?? "—"}</span>
          <span class="bom-qtd">${b.quantidade} ${b.materias_primas?.unidade ?? "un"}</span>
          <span class="bom-del" data-del-bom="${b.id}">✕</span>
        </div>
      `).join("");

      const mpOptions = state.materias_primas
        .map(mp => `<option value="${mp.id}">${mp.nome} (${mp.unidade})</option>`)
        .join("");

      return `
        <div class="prod-block">
          <div class="prod-row" data-toggle-prod="${prod.id}">
            <span class="prod-chevron ${prodOpen ? "open" : ""}">▶</span>
            <span class="prod-nome">${prod.nome}</span>
            <div class="prod-btns">
              <button class="btn-icon" data-edit-prod="${prod.id}" data-prod-nome="${prod.nome}" data-prod-cat="${prod.categoria_id}">✏️</button>
              <button class="btn-icon danger" data-del-prod="${prod.id}">🗑</button>
            </div>
          </div>
          ${prodOpen ? `
            <div class="bom-body">
              ${bomHtml || `<div class="empty-cat">Sem matérias-primas ainda.</div>`}
              <div class="bom-add">
                <select id="mp-select-${prod.id}">
                  <option value="">Selecionar matéria-prima...</option>
                  ${mpOptions}
                </select>
                <input type="number" id="mp-qtd-${prod.id}" placeholder="Qtd" value="1" min="0.001" step="0.001" />
                <button class="btn-icon" data-add-bom="${prod.id}">+ Add</button>
              </div>
            </div>
          ` : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="cat-block">
        <div class="cat-row" data-toggle-cat="${cat.id}">
          <span class="cat-chevron ${open ? "open" : ""}">▶</span>
          <span class="cat-name">${cat.nome}</span>
          <span class="cat-badge">${prodCount} produto${prodCount !== 1 ? "s" : ""}</span>
          <div class="cat-btns">
            <button class="btn-icon" data-edit-cat="${cat.id}" data-cat-nome="${cat.nome}">✏️</button>
            <button class="btn-icon danger" data-del-cat="${cat.id}">🗑</button>
          </div>
        </div>
        ${open ? `
          <div class="cat-body">
            ${produtosHtml}
            ${produtosHtml === "" ? `<div class="empty-cat">Nenhum produto nessa categoria.</div>` : ""}
            <div class="add-prod-row">
              <button class="btn-icon" data-add-prod="${cat.id}">+ Produto</button>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  bindTreeEvents(container);
}

// ─── Eventos da árvore ────────────────────────────────────────────────────────
function bindTreeEvents(container) {
  container.querySelector("#tree").addEventListener("click", async (e) => {
    // Toggle categoria
    const toggleCat = e.target.closest("[data-toggle-cat]");
    if (toggleCat && !e.target.closest("button")) {
      const id = toggleCat.dataset.toggleCat;
      state.expandido[id] = !state.expandido[id];
      renderTree(container);
      return;
    }

    // Toggle produto
    const toggleProd = e.target.closest("[data-toggle-prod]");
    if (toggleProd && !e.target.closest("button")) {
      const id = toggleProd.dataset.toggleProd;
      state.expandido[id] = !state.expandido[id];
      renderTree(container);
      return;
    }

    // Editar categoria
    const editCat = e.target.closest("[data-edit-cat]");
    if (editCat) {
      abrirModal(container, "edit-cat", { id: editCat.dataset.editCat, nome: editCat.dataset.catNome });
      return;
    }

    // Deletar categoria
    const delCat = e.target.closest("[data-del-cat]");
    if (delCat) {
      if (!confirm("Deletar categoria e todos os produtos nela?")) return;
      await supabase.from("categorias").delete().eq("id", delCat.dataset.delCat);
      await recarregar(container);
      return;
    }

    // Adicionar produto
    const addProd = e.target.closest("[data-add-prod]");
    if (addProd) {
      abrirModal(container, "add-prod", { categoriaId: addProd.dataset.addProd });
      return;
    }

    // Editar produto
    const editProd = e.target.closest("[data-edit-prod]");
    if (editProd) {
      abrirModal(container, "edit-prod", {
        id: editProd.dataset.editProd,
        nome: editProd.dataset.prodNome,
        categoriaId: editProd.dataset.prodCat,
      });
      return;
    }

    // Deletar produto
    const delProd = e.target.closest("[data-del-prod]");
    if (delProd) {
      if (!confirm("Deletar produto e sua composição?")) return;
      await supabase.from("produtos").delete().eq("id", delProd.dataset.delProd);
      await recarregar(container);
      return;
    }

    // Adicionar BOM
    const addBom = e.target.closest("[data-add-bom]");
    if (addBom) {
      const prodId = addBom.dataset.addBom;
      const mpId = container.querySelector(`#mp-select-${prodId}`)?.value;
      const qtd = parseFloat(container.querySelector(`#mp-qtd-${prodId}`)?.value) || 1;
      if (!mpId) { alert("Selecione uma matéria-prima."); return; }
      await supabase.from("produto_materias").insert({ produto_id: prodId, materia_prima_id: mpId, quantidade: qtd });
      await recarregar(container);
      return;
    }

    // Deletar BOM
    const delBom = e.target.closest("[data-del-bom]");
    if (delBom) {
      await supabase.from("produto_materias").delete().eq("id", delBom.dataset.delBom);
      await recarregar(container);
      return;
    }
  });
}

// ─── Botões do topo ───────────────────────────────────────────────────────────
function bindTopButtons(container) {
  container.querySelector("#btn-nova-cat").addEventListener("click", () => {
    abrirModal(container, "add-cat");
  });
  container.querySelector("#btn-nova-mp").addEventListener("click", () => {
    abrirModal(container, "add-mp");
  });
}

// ─── Modais ───────────────────────────────────────────────────────────────────
function abrirModal(container, tipo, dados = {}) {
  const area = container.querySelector("#modal-area");

  const modais = {
    "add-cat": () => `
      <div class="modal-bg" id="modal-bg">
        <div class="modal">
          <h3>Nova Categoria</h3>
          <input id="m-nome" placeholder="Ex: LONA, ADESIVO, PAPEL..." autofocus />
          <div class="modal-btns">
            <button class="btn-secondary" id="m-cancel">Cancelar</button>
            <button class="btn-primary" id="m-ok">Criar</button>
          </div>
        </div>
      </div>`,

    "edit-cat": () => `
      <div class="modal-bg" id="modal-bg">
        <div class="modal">
          <h3>Renomear Categoria</h3>
          <input id="m-nome" value="${dados.nome}" autofocus />
          <div class="modal-btns">
            <button class="btn-secondary" id="m-cancel">Cancelar</button>
            <button class="btn-primary" id="m-ok">Salvar</button>
          </div>
        </div>
      </div>`,

    "add-prod": () => `
      <div class="modal-bg" id="modal-bg">
        <div class="modal">
          <h3>Novo Produto</h3>
          <input id="m-nome" placeholder="Ex: Banner, Cardápio PS, Faixa..." autofocus />
          <div class="modal-btns">
            <button class="btn-secondary" id="m-cancel">Cancelar</button>
            <button class="btn-primary" id="m-ok">Criar</button>
          </div>
        </div>
      </div>`,

    "edit-prod": () => {
      const catOptions = state.categorias
        .map(c => `<option value="${c.id}" ${c.id === dados.categoriaId ? "selected" : ""}>${c.nome}</option>`)
        .join("");
      return `
        <div class="modal-bg" id="modal-bg">
          <div class="modal">
            <h3>Editar Produto</h3>
            <input id="m-nome" value="${dados.nome}" autofocus />
            <select id="m-cat">${catOptions}</select>
            <div class="modal-btns">
              <button class="btn-secondary" id="m-cancel">Cancelar</button>
              <button class="btn-primary" id="m-ok">Salvar</button>
            </div>
          </div>
        </div>`;
    },

    "add-mp": () => `
      <div class="modal-bg" id="modal-bg">
        <div class="modal">
          <h3>Nova Matéria-Prima</h3>
          <input id="m-nome" placeholder="Ex: Adesivo Vinil A4, Laminação..." autofocus />
          <input id="m-unidade" placeholder="Unidade (ex: un, m², folha)" />
          <input id="m-custo" type="number" placeholder="Custo unitário (R$)" min="0" step="0.01" />
          <div class="modal-btns">
            <button class="btn-secondary" id="m-cancel">Cancelar</button>
            <button class="btn-primary" id="m-ok">Criar</button>
          </div>
        </div>
      </div>`,
  };

  area.innerHTML = modais[tipo]?.() ?? "";

  area.querySelector("#m-cancel")?.addEventListener("click", () => { area.innerHTML = ""; });
  area.querySelector("#modal-bg")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-bg") area.innerHTML = "";
  });

  area.querySelector("#m-ok")?.addEventListener("click", async () => {
    const nome = area.querySelector("#m-nome")?.value?.trim();
    if (!nome) { alert("Preencha o nome."); return; }

    if (tipo === "add-cat") {
      await supabase.from("categorias").insert({ nome });
    } else if (tipo === "edit-cat") {
      await supabase.from("categorias").update({ nome }).eq("id", dados.id);
    } else if (tipo === "add-prod") {
      await supabase.from("produtos").insert({ nome, categoria_id: dados.categoriaId });
      state.expandido[dados.categoriaId] = true;
    } else if (tipo === "edit-prod") {
      const categoriaId = area.querySelector("#m-cat")?.value;
      await supabase.from("produtos").update({ nome, categoria_id: categoriaId }).eq("id", dados.id);
    } else if (tipo === "add-mp") {
      const unidade = area.querySelector("#m-unidade")?.value?.trim() || "un";
      const custo = parseFloat(area.querySelector("#m-custo")?.value) || 0;
      await supabase.from("materias_primas").insert({ nome, unidade, custo_unitario: custo });
    }

    area.innerHTML = "";
    await recarregar(container);
  });

  // Enter confirma
  area.querySelector("#m-nome")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") area.querySelector("#m-ok")?.click();
  });
}

// ─── Recarrega dados e re-renderiza ───────────────────────────────────────────
async function recarregar(container) {
  await carregarTudo();
  renderTree(container);
}