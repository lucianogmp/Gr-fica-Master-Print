/**
 * PRODUTOS VIEW — Listagem, cadastro, edição e exclusão de produtos.
 * Arquitetura: class-based view consumindo services.produto.
 */

import { services }  from "../../core/services.js";
import { store, selectors, actions } from "../../core/store.js";
import { fmtBRL }    from "../../utils/fmt.js";
import { Btn, StatusBadge, EmptyState, SearchBar } from "../components/index.js";

export class ProdutosView {
  constructor() {
    this._container = null;
    this._state = {
      busca: "",
      categoriaFiltro: "",
      statusFiltro: "",
      loading: true,
    };
  }

  async mount(container) {
    this._container = container;
    container.innerHTML = `<div class="loading-view"><i class="fi fi-rr-box-open"></i><span>Carregando produtos…</span></div>`;
    await Promise.all([
      services.produto.listar(),
      services.categorias ? services.categorias.listar().catch(() => {}) : Promise.resolve(),
    ]);
    this._state.loading = false;
    this._render();
  }

  unmount() { this._container = null; }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  _render() {
    const c = this._container;
    if (!c) return;
    const produtos   = selectors.produtos().list || [];
    const categorias = selectors.produtos().categorias || [];
    const s = this._state;

    const filtrados = produtos.filter(p => {
      const ok_busca = !s.busca || p.nome.toLowerCase().includes(s.busca.toLowerCase());
      const ok_cat   = !s.categoriaFiltro || p.categoria_id === s.categoriaFiltro;
      const ok_st    = !s.statusFiltro || (p.status || "ativo") === s.statusFiltro;
      return ok_busca && ok_cat && ok_st;
    });

    c.innerHTML = `
      <style>${this._css()}</style>

      <div class="prod-topbar">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Produtos</h2>
          <span style="font-size:12px;color:var(--muted)">${produtos.length} produto${produtos.length !== 1 ? "s" : ""} cadastrados</span>
        </div>
        <button class="btn-novo-prod" id="btn-novo">
          <i class="fi fi-rr-add"></i> Novo Produto
        </button>
      </div>

      <div class="prod-filtros">
        <div class="prod-search-wrap">
          <i class="fi fi-rr-search prod-search-icon"></i>
          <input id="prod-busca" class="prod-search" placeholder="Buscar produto..." value="${esc(s.busca)}" />
        </div>
        <select id="prod-cat-filtro" class="prod-select">
          <option value="">Todas as categorias</option>
          ${categorias.map(cat => `<option value="${esc(cat.id)}" ${s.categoriaFiltro === cat.id ? "selected" : ""}>${esc(cat.nome)}</option>`).join("")}
        </select>
        <select id="prod-st-filtro" class="prod-select">
          <option value="">Todos os status</option>
          <option value="ativo"    ${s.statusFiltro === "ativo"    ? "selected" : ""}>Ativo</option>
          <option value="inativo"  ${s.statusFiltro === "inativo"  ? "selected" : ""}>Inativo</option>
          <option value="rascunho" ${s.statusFiltro === "rascunho" ? "selected" : ""}>Rascunho</option>
        </select>
      </div>

      ${filtrados.length === 0 ? `
        <div class="prod-vazio">
          <i class="fi fi-rr-box-open"></i>
          <p>${produtos.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado com esses filtros."}</p>
          ${produtos.length === 0 ? `<button class="btn-novo-prod" id="btn-novo-vazio"><i class="fi fi-rr-add"></i> Cadastrar primeiro produto</button>` : ""}
        </div>
      ` : `
        <div class="prod-grid">
          ${filtrados.map(p => this._renderCard(p)).join("")}
        </div>
      `}

      <div id="modal-area"></div>
    `;

    this._bindEvents();
  }

  _renderCard(p) {
    const status = p.status || "ativo";
    const statusLabel = { ativo: "Ativo", inativo: "Inativo", rascunho: "Rascunho" }[status] || status;
    const statusClass = { ativo: "st-ativo", inativo: "st-inativo", rascunho: "st-rascunho" }[status] || "";
    const preco = Number(p.preco_venda || 0);

    // Ícone: se for SVG completo, renderiza em miniatura contida; senão usa tag fi
    const icone = p.icone_svg
      ? `<div class="prod-icone-svg">${p.icone_svg}</div>`
      : `<div class="prod-icone-fi"><i class="fi fi-rr-box-open"></i></div>`;

    return `
      <div class="prod-card">
        <div class="prod-card-header">
          ${icone}
          <span class="prod-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="prod-nome">${esc(p.nome)}</div>
        ${p.sku ? `<div class="prod-sku">SKU: ${esc(p.sku)}</div>` : ""}
        ${p.descricao ? `<div class="prod-desc">${esc(p.descricao)}</div>` : ""}
        <div class="prod-preco">${preco > 0 ? fmtBRL(preco) : "—"}</div>
        <div class="prod-acoes">
          ${Btn.icon('<i class="fi fi-rr-pencil"></i>', `edit-${p.id}`)}
          ${Btn.icon('<i class="fi fi-rr-trash"></i>', `del-${p.id}`, true)}
        </div>
      </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EVENTOS
  // ══════════════════════════════════════════════════════════════════════════
  _bindEvents() {
    const c = this._container;
    if (!c) return;

    c.querySelector("#btn-novo")?.addEventListener("click", () => this._abrirModal(null));
    c.querySelector("#btn-novo-vazio")?.addEventListener("click", () => this._abrirModal(null));

    c.querySelector("#prod-busca")?.addEventListener("input", e => {
      this._state.busca = e.target.value;
      this._render();
    });
    c.querySelector("#prod-cat-filtro")?.addEventListener("change", e => {
      this._state.categoriaFiltro = e.target.value;
      this._render();
    });
    c.querySelector("#prod-st-filtro")?.addEventListener("change", e => {
      this._state.statusFiltro = e.target.value;
      this._render();
    });

    const produtos = selectors.produtos().list || [];
    produtos.forEach(p => {
      c.querySelector(`#edit-${p.id}`)?.addEventListener("click", () => this._abrirModal(p));
      c.querySelector(`#del-${p.id}`)?.addEventListener("click",  () => this._deletar(p));
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL CADASTRO / EDIÇÃO
  // ══════════════════════════════════════════════════════════════════════════
  _abrirModal(produto) {
    const area = this._container?.querySelector("#modal-area");
    if (!area) return;
    const categorias = selectors.produtos().categorias || [];
    const editando   = !!produto;
    const p          = produto || {};

    area.innerHTML = `
      <div class="modal-bg" id="modal-bg">
        <div class="modal">
          <h3><i class="fi fi-rr-box-open" style="color:var(--primary)"></i> ${editando ? "Editar Produto" : "Novo Produto"}</h3>

          <div class="modal-grid">
            <div class="modal-field full"><label>Nome *</label><input id="mp-nome" value="${esc(p.nome)}" placeholder="Nome do produto" /></div>
            <div class="modal-field"><label>SKU</label><input id="mp-sku" value="${esc(p.sku)}" placeholder="Ex: ADES-A4-001" /></div>
            <div class="modal-field"><label>Preço de venda (R$)</label><input id="mp-preco" type="number" min="0" step="0.01" value="${p.preco_venda || ""}" placeholder="0,00" /></div>
            <div class="modal-field"><label>Categoria</label>
              <select id="mp-cat">
                <option value="">Sem categoria</option>
                ${categorias.map(cat => `<option value="${esc(cat.id)}" ${p.categoria_id === cat.id ? "selected" : ""}>${esc(cat.nome)}</option>`).join("")}
              </select>
            </div>
            <div class="modal-field"><label>Status</label>
              <select id="mp-status">
                <option value="ativo"    ${(p.status||"ativo") === "ativo"    ? "selected" : ""}>Ativo</option>
                <option value="inativo"  ${p.status === "inativo"  ? "selected" : ""}>Inativo</option>
                <option value="rascunho" ${p.status === "rascunho" ? "selected" : ""}>Rascunho</option>
              </select>
            </div>
            <div class="modal-field full"><label>Descrição</label><textarea id="mp-desc" rows="2" placeholder="Descrição opcional...">${esc(p.descricao)}</textarea></div>
          </div>

          <div class="modal-btns">
            <button class="btn-secondary" id="mp-cancel">Cancelar</button>
            <button class="btn-primary"   id="mp-ok"><i class="fi fi-rr-check"></i> ${editando ? "Salvar" : "Cadastrar"}</button>
          </div>
        </div>
      </div>`;

    area.querySelector("#mp-cancel").addEventListener("click", () => { area.innerHTML = ""; });
    area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });

    area.querySelector("#mp-ok").addEventListener("click", async () => {
      const nome  = area.querySelector("#mp-nome").value.trim();
      if (!nome) { area.querySelector("#mp-nome").style.borderColor = "var(--error)"; return; }

      const dados = {
        nome,
        sku:         area.querySelector("#mp-sku").value.trim()      || null,
        preco_venda: parseFloat(area.querySelector("#mp-preco").value) || 0,
        categoria_id:area.querySelector("#mp-cat").value              || null,
        status:      area.querySelector("#mp-status").value,
        descricao:   area.querySelector("#mp-desc").value.trim()      || null,
      };

      const btn = area.querySelector("#mp-ok");
      btn.disabled = true;
      btn.textContent = "Salvando…";

      try {
        if (editando) await services.produto.atualizar(produto.id, dados);
        else          await services.produto.criar(dados);
        area.innerHTML = "";
        this._render();
      } catch (e) {
        alert("Erro ao salvar: " + e.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fi fi-rr-check"></i> Salvar';
      }
    });
  }

  async _deletar(produto) {
    if (!confirm(`Excluir o produto "${produto.nome}"?`)) return;
    try {
      await services.produto.deletar(produto.id);
      this._render();
    } catch (e) {
      alert("Erro ao excluir: " + e.message);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CSS
  // ══════════════════════════════════════════════════════════════════════════
  _css() { return `
.prod-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:10px; }
.btn-novo-prod { display:inline-flex; align-items:center; gap:7px; background:var(--primary); color:#fff; border:none; border-radius:var(--radius-md); padding:9px 16px; font-size:13px; font-weight:600; cursor:pointer; transition:all var(--t); }
.btn-novo-prod:hover { opacity:.88; }
.prod-filtros { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
.prod-search-wrap { position:relative; flex:1; min-width:200px; }
.prod-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:13px; pointer-events:none; }
.prod-search { width:100%; padding:8px 10px 8px 32px; border:1px solid var(--border-md); border-radius:var(--radius-md); background:var(--panel); color:var(--text); font-size:13px; box-sizing:border-box; }
.prod-select { padding:8px 12px; border:1px solid var(--border-md); border-radius:var(--radius-md); background:var(--panel); color:var(--text); font-size:13px; cursor:pointer; }
.prod-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
.prod-card { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:16px; display:flex; flex-direction:column; gap:6px; transition:border-color var(--t); }
.prod-card:hover { border-color:var(--primary-border); }
.prod-card-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:8px; gap:8px; }
.prod-icone-fi { font-size:22px; flex-shrink:0; }
.prod-icone-svg { width:40px; height:40px; flex-shrink:0; overflow:hidden; border-radius:var(--radius-sm); background:var(--panel3); display:flex; align-items:center; justify-content:center; }
.prod-icone-svg svg { width:32px !important; height:32px !important; max-width:32px; max-height:32px; display:block; }
.prod-status { font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; }
.st-ativo    { background:rgba(0,196,154,0.12); color:var(--success); }
.st-inativo  { background:var(--panel3); color:var(--muted); }
.st-rascunho { background:rgba(232,160,16,0.12); color:var(--warning); }
.prod-nome { font-size:14px; font-weight:700; }
.prod-sku  { font-size:11px; color:var(--muted); }
.prod-desc { font-size:12px; color:var(--text-sub); line-height:1.4; max-height:36px; overflow:hidden; text-overflow:ellipsis; }
.prod-preco { font-size:16px; font-weight:800; color:var(--primary-light); margin-top:4px; }
.prod-acoes { display:flex; gap:6px; margin-top:6px; padding-top:10px; border-top:1px solid var(--border); }
.prod-vazio { display:flex; flex-direction:column; align-items:center; gap:12px; padding:60px 20px; color:var(--muted); text-align:center; }
.prod-vazio i { font-size:36px; opacity:.3; }
.modal-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.modal-field { display:flex; flex-direction:column; gap:4px; }
.modal-field.full { grid-column:1/-1; }
.modal-field label { font-size:12px; color:var(--muted); font-weight:500; }
.modal-field input, .modal-field select, .modal-field textarea { padding:8px 10px; border:1px solid var(--border-md); border-radius:var(--radius-md); background:var(--panel); color:var(--text); font-size:13px; }
.modal-field textarea { resize:vertical; font-family:var(--font); }
.modal-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; padding-top:14px; border-top:1px solid var(--border); }
.btn-primary  { display:inline-flex; align-items:center; gap:6px; background:var(--primary); color:#fff; border:none; border-radius:var(--radius-md); padding:9px 18px; font-size:13px; font-weight:600; cursor:pointer; transition:all var(--t); }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-secondary { background:transparent; border:1px solid var(--border-md); color:var(--text); border-radius:var(--radius-md); padding:9px 16px; font-size:13px; cursor:pointer; }
`; }
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
