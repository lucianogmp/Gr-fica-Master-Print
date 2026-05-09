import { supabase } from "../supabase/client.js";

// ─── Estado ───────────────────────────────────────────────────────────────
let state = {
  categorias: [],
  materias_primas: [],
  expandido: {},        // { [id]: true } - controla abertura na árvore
};

// ─── Entry Point ───────────────────────────────────────────────────────────
export async function Produtos(container) {
  container.innerHTML = `<div class="loading">Carregando produtos...</div>`;
  await carregarTudo();
  render(container);
}

// ─── Carregamento de Dados ─────────────────────────────────────────────────
async function carregarTudo() {
  const [{ data: cats }, { data: prods }, { data: mps }, { data: bom }] = await Promise.all([
    supabase.from("categorias").select("*").order("nome"),
    supabase.from("produtos").select("*").order("nome"),
    supabase.from("materias_primas").select("*").order("nome"),
    supabase.from("produto_materias").select("*, materias_primas(id, nome, unidade, custo_unitario)").order("created_at"),
  ]);

  state.materias_primas = mps || [];

  state.categorias = (cats || []).map(cat => ({
    ...cat,
    produtos: (prods || [])
      .filter(p => p.categoria_id === cat.id)
      .map(prod => ({
        ...prod,
        materias: (bom || []).filter(b => b.produto_id === prod.id)
      }))
  }));
}

// ─── Render Principal ──────────────────────────────────────────────────────
function render(container) {
  container.innerHTML = `
    <style>${getCSS()}</style>
    <div class="prod-header">
      <h2>Produtos</h2>
      <div class="prod-actions">
        <button class="btn-secondary" id="btn-nova-mp">+ Matéria-Prima</button>
        <button class="btn-primary" id="btn-nova-cat">+ Categoria</button>
      </div>
    </div>

    <div id="tree-container" class="tree"></div>
    <div id="modal-area"></div>
  `;

  renderTree(container);
  bindGlobalEvents(container);
}

// ─── Render da Árvore ──────────────────────────────────────────────────────
function renderTree(container) {
  const tree = container.querySelector("#tree-container");
  
  if (state.categorias.length === 0) {
    tree.innerHTML = `<div class="empty-state">Nenhuma categoria cadastrada ainda.</div>`;
    return;
  }

  let html = state.categorias.map(cat => {
    const catOpen = !!state.expandido[cat.id];
    const prodCount = cat.produtos.length;

    let produtosHTML = cat.produtos.map(prod => {
      const prodOpen = !!state.expandido[prod.id];
      return createProdutoHTML(prod, prodOpen);
    }).join("");

    return `
      <div class="cat-block">
        <div class="cat-row" data-toggle-cat="${cat.id}">
          <span class="cat-chevron ${catOpen ? 'open' : ''}">▶</span>
          <span class="cat-name">${cat.nome}</span>
          <span class="cat-badge">${prodCount} produto${prodCount !== 1 ? 's' : ''}</span>
          <div class="cat-btns">
            <button class="btn-icon" data-edit-cat="${cat.id}" data-nome="${cat.nome}">✏️</button>
            <button class="btn-icon danger" data-del-cat="${cat.id}">🗑</button>
          </div>
        </div>
        ${catOpen ? `
        <div class="cat-body">
          ${produtosHTML}
          <button class="btn-add-prod" data-add-prod="${cat.id}">+ Novo Produto</button>
        </div>` : ''}
      </div>`;
  }).join("");

  tree.innerHTML = html;
  bindTreeEvents(container);
}

function createProdutoHTML(prod, isOpen) {
  const bomHTML = prod.materias.map(item => `
    <div class="bom-row">
      <span class="bom-nome">${item.materias_primas?.nome || '—'}</span>
      <span class="bom-qtd">${item.quantidade} ${item.materias_primas?.unidade || ''}</span>
      <span class="bom-del" data-del-bom="${item.id}">✕</span>
    </div>
  `).join("");

  const mpOptions = state.materias_primas.map(mp => 
    `<option value="${mp.id}">${mp.nome} (${mp.unidade})</option>`
  ).join("");

  return `
    <div class="prod-block">
      <div class="prod-row" data-toggle-prod="${prod.id}">
        <span class="prod-chevron ${isOpen ? 'open' : ''}">▶</span>
        <span class="prod-name">${prod.nome}</span>
        <div class="prod-btns">
          <button class="btn-icon" data-edit-prod="${prod.id}" data-nome="${prod.nome}" data-cat="${prod.categoria_id}">✏️</button>
          <button class="btn-icon danger" data-del-prod="${prod.id}">🗑</button>
        </div>
      </div>
      ${isOpen ? `
      <div class="bom-body">
        ${bomHTML || '<div class="empty-bom">Nenhuma matéria-prima adicionada.</div>'}
        <div class="bom-add">
          <select id="mp-select-${prod.id}">
            <option value="">Selecionar matéria-prima...</option>
            ${mpOptions}
          </select>
          <input type="number" id="mp-qtd-${prod.id}" value="1" min="0.001" step="0.001" style="width:85px;">
          <button class="btn-icon" data-add-bom="${prod.id}">+ Add</button>
        </div>
      </div>` : ''}
    </div>`;
}

// ─── Eventos Globais ───────────────────────────────────────────────────────
function bindGlobalEvents(container) {
  container.querySelector("#btn-nova-cat").addEventListener("click", () => abrirModalCategoria(container));
  container.querySelector("#btn-nova-mp").addEventListener("click", () => abrirModalMateriaPrima(container));
}

function bindTreeEvents(container) {
  const tree = container.querySelector("#tree-container");

  tree.addEventListener("click", async (e) => {
    // Toggle Categoria
    if (e.target.closest("[data-toggle-cat]")) {
      const el = e.target.closest("[data-toggle-cat]");
      const id = el.dataset.toggleCat;
      state.expandido[id] = !state.expandido[id];
      renderTree(container);
      return;
    }

    // Toggle Produto
    if (e.target.closest("[data-toggle-prod]")) {
      const el = e.target.closest("[data-toggle-prod]");
      const id = el.dataset.toggleProd;
      state.expandido[id] = !state.expandido[id];
      renderTree(container);
      return;
    }

    // Adicionar Produto
    if (e.target.closest("[data-add-prod]")) {
      const catId = e.target.closest("[data-add-prod]").dataset.addProd;
      abrirModalProduto(container, catId);
      return;
    }

    // Editar / Deletar Categoria
    if (e.target.closest("[data-edit-cat]")) {
      const btn = e.target.closest("[data-edit-cat]");
      abrirModalCategoria(container, { id: btn.dataset.editCat, nome: btn.dataset.nome });
      return;
    }
    if (e.target.closest("[data-del-cat]")) {
      const id = e.target.closest("[data-del-cat]").dataset.delCat;
      if (confirm("Excluir categoria e todos os produtos?")) {
        await supabase.from("categorias").delete().eq("id", id);
        await recarregar(container);
      }
      return;
    }

    // Editar / Deletar Produto
    if (e.target.closest("[data-edit-prod]")) {
      const btn = e.target.closest("[data-edit-prod]");
      abrirModalProduto(container, btn.dataset.cat, {
        id: btn.dataset.editProd,
        nome: btn.dataset.nome
      });
      return;
    }
    if (e.target.closest("[data-del-prod]")) {
      const id = e.target.closest("[data-del-prod]").dataset.delProd;
      if (confirm("Excluir este produto?")) {
        await supabase.from("produtos").delete().eq("id", id);
        await recarregar(container);
      }
      return;
    }

    // Adicionar Matéria-Prima no Produto
    if (e.target.closest("[data-add-bom]")) {
      const prodId = e.target.closest("[data-add-bom]").dataset.addBom;
      const mpId = container.querySelector(`#mp-select-${prodId}`)?.value;
      const qtd = parseFloat(container.querySelector(`#mp-qtd-${prodId}`)?.value) || 1;

      if (!mpId) return alert("Selecione uma matéria-prima");

      await supabase.from("produto_materias").insert({
        produto_id: prodId,
        materia_prima_id: mpId,
        quantidade: qtd
      });
      await recarregar(container);
      return;
    }

    // Remover Matéria-Prima
    if (e.target.closest("[data-del-bom]")) {
      const id = e.target.closest("[data-del-bom]").dataset.delBom;
      if (confirm("Remover esta matéria-prima?")) {
        await supabase.from("produto_materias").delete().eq("id", id);
        await recarregar(container);
      }
    }
  });
}

// ─── Modais ────────────────────────────────────────────────────────────────
async function abrirModalCategoria(container, edit = null) {
  const area = container.querySelector("#modal-area");
  const titulo = edit ? "Editar Categoria" : "Nova Categoria";
  const nome = edit ? edit.nome : "";

  area.innerHTML = `
    <div class="modal-bg">
      <div class="modal">
        <h3>${titulo}</h3>
        <input id="cat-nome" value="${nome}" placeholder="Nome da categoria" autofocus>
        <div class="modal-btns">
          <button class="btn-secondary" id="modal-cancel">Cancelar</button>
          <button class="btn-primary" id="modal-ok">${edit ? 'Salvar' : 'Criar'}</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#modal-cancel").onclick = () => area.innerHTML = "";
  area.querySelector("#modal-ok").onclick = async () => {
    const nome = area.querySelector("#cat-nome").value.trim();
    if (!nome) return alert("Digite o nome da categoria");

    if (edit) {
      await supabase.from("categorias").update({ nome }).eq("id", edit.id);
    } else {
      await supabase.from("categorias").insert({ nome });
    }
    area.innerHTML = "";
    await recarregar(container);
  };
}

async function abrirModalProduto(container, categoriaId, edit = null) {
  const area = container.querySelector("#modal-area");
  const titulo = edit ? "Editar Produto" : "Novo Produto";
  const nome = edit ? edit.nome : "";

  area.innerHTML = `
    <div class="modal-bg">
      <div class="modal">
        <h3>${titulo}</h3>
        <input id="prod-nome" value="${nome}" placeholder="Nome do produto" autofocus>
        <div class="modal-btns">
          <button class="btn-secondary" id="modal-cancel">Cancelar</button>
          <button class="btn-primary" id="modal-ok">${edit ? 'Salvar' : 'Criar'}</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#modal-cancel").onclick = () => area.innerHTML = "";
  area.querySelector("#modal-ok").onclick = async () => {
    const nome = area.querySelector("#prod-nome").value.trim();
    if (!nome) return alert("Digite o nome do produto");

    if (edit) {
      await supabase.from("produtos").update({ nome }).eq("id", edit.id);
    } else {
      await supabase.from("produtos").insert({ nome, categoria_id: categoriaId });
      state.expandido[categoriaId] = true;
    }
    area.innerHTML = "";
    await recarregar(container);
  };
}

async function abrirModalMateriaPrima(container) {
  const area = container.querySelector("#modal-area");

  area.innerHTML = `
    <div class="modal-bg">
      <div class="modal">
        <h3>Nova Matéria-Prima</h3>
        <input id="mp-nome" placeholder="Nome da matéria-prima" autofocus>
        <input id="mp-unidade" placeholder="Unidade (ex: un, m², kg, folha)">
        <input id="mp-custo" type="number" placeholder="Custo unitário (R$)" step="0.01">
        <div class="modal-btns">
          <button class="btn-secondary" id="modal-cancel">Cancelar</button>
          <button class="btn-primary" id="modal-ok">Criar</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#modal-cancel").onclick = () => area.innerHTML = "";
  area.querySelector("#modal-ok").onclick = async () => {
    const nome = area.querySelector("#mp-nome").value.trim();
    const unidade = area.querySelector("#mp-unidade").value.trim() || "un";
    const custo = parseFloat(area.querySelector("#mp-custo").value) || 0;

    if (!nome) return alert("Digite o nome da matéria-prima");

    await supabase.from("materias_primas").insert({ nome, unidade, custo_unitario: custo });
    area.innerHTML = "";
    await recarregar(container);
  };
}

// ─── Recarregar ─────────────────────────────────────────────────────────────
async function recarregar(container) {
  await carregarTudo();
  renderTree(container);
}

// ─── CSS ───────────────────────────────────────────────────────────────────
function getCSS() {
  return `
    .prod-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
    .tree { display:flex; flex-direction:column; gap:10px; }
    .cat-block, .prod-block { background:var(--panel); border:1px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden; }
    .cat-row, .prod-row { padding:12px 14px; display:flex; align-items:center; gap:10px; cursor:pointer; }
    .cat-row:hover, .prod-row:hover { background:rgba(255,255,255,0.04); }
    .cat-chevron, .prod-chevron { font-size:13px; transition:transform .2s; }
    .cat-chevron.open, .prod-chevron.open { transform:rotate(90deg); }
    .cat-name, .prod-name { flex:1; font-weight:600; }
    .cat-badge { font-size:12px; background:rgba(100,180,255,0.15); color:#6eb3ff; padding:2px 9px; border-radius:999px; }
    .bom-body { padding:8px 14px 12px 42px; background:var(--panel2); }
    .bom-row { display:flex; align-items:center; gap:10px; padding:6px 0; font-size:13.5px; }
    .bom-del { margin-left:auto; color:#ff6b6b; cursor:pointer; opacity:0; }
    .bom-row:hover .bom-del { opacity:1; }
    .bom-add { display:flex; gap:6px; margin-top:8px; align-items:center; }
    .btn-icon { background:transparent; border:1px solid rgba(255,255,255,0.12); color:var(--muted); padding:4px 8px; border-radius:6px; cursor:pointer; font-size:13px; }
    .btn-icon:hover { border-color:var(--accent); color:var(--accent); }
    .btn-icon.danger:hover { border-color:#ff6b6b; color:#ff6b6b; }
    .btn-add-prod, .btn-secondary, .btn-primary { padding:8px 14px; border-radius:8px; cursor:pointer; }
    .empty-state, .empty-bom { color:var(--muted); text-align:center; padding:16px; }
    .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .modal { background:var(--panel); padding:24px; border-radius:16px; width:90%; max-width:420px; }
    .modal input { width:100%; padding:12px; margin-bottom:12px; background:var(--panel2); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:var(--text); }
    .modal-btns { display:flex; gap:10px; justify-content:flex-end; margin-top:10px; }
  `;
}