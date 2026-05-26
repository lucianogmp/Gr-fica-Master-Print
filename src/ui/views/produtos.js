/**
 * PRODUTOS VIEW — Listagem, cadastro, edição e exclusão de produtos.
 * Corrigido: modal estável, categoria funciona, sem fechamento inesperado.
 */

import { services }         from "../../core/services.js";
import { selectors, actions } from "../../core/store.js";
import { fmtBRL }            from "../../utils/fmt.js";
import { esc }               from "../../utils/sanitize.js";
import { Btn, StatusBadge, EmptyState, SearchBar, openModal } from "../components/index.js";

export class ProdutosView {
  constructor() {
    this._container = null;
    this._state = {
      busca:          "",
      categoriaFiltro:"",
      statusFiltro:   "",
      loading:        true,
    };
  }

  async mount(container) {
    this._container = container;
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Carregando produtos…</span>
      </div>`;
    await services.produto.listar();
    // Tenta carregar categorias se o service existir
    if (services.categorias) {
      await services.categorias.listar().catch(() => {});
    }
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

    const produtos   = selectors.produtos().list       || [];
    const categorias = selectors.produtos().categorias || [];
    const s = this._state;

    const filtrados = produtos.filter(p => {
      const okBusca = !s.busca         || p.nome?.toLowerCase().includes(s.busca.toLowerCase());
      const okCat   = !s.categoriaFiltro || p.categoria_id === s.categoriaFiltro;
      const okSt    = !s.statusFiltro  || (p.status || "ativo") === s.statusFiltro;
      return okBusca && okCat && okSt;
    });

    c.innerHTML = `
      <style>${this._css()}</style>

      <div class="prod-topbar">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Produtos</h2>
          <span style="font-size:11px;color:var(--muted)">
            ${produtos.length} produto${produtos.length!==1?"s":""} cadastrados
          </span>
        </div>
        <button class="btn-novo-prod" id="btn-novo">
          <i class="fi fi-rr-add"></i> Novo Produto
        </button>
      </div>

      <div class="prod-filtros">
        <div class="prod-search-wrap">
          <i class="fi fi-rr-search prod-search-icon"></i>
          <input id="prod-busca" class="prod-search"
                 placeholder="Buscar produto..." value="${esc(s.busca)}" />
        </div>
        <select id="prod-cat-filtro" class="prod-select">
          <option value="">Todas as categorias</option>
          ${categorias.map(cat =>
            `<option value="${esc(cat.id)}" ${s.categoriaFiltro===cat.id?"selected":""}>${esc(cat.nome)}</option>`
          ).join("")}
        </select>
        <select id="prod-st-filtro" class="prod-select">
          <option value="">Todos os status</option>
          <option value="ativo"    ${s.statusFiltro==="ativo"   ?"selected":""}>Ativo</option>
          <option value="inativo"  ${s.statusFiltro==="inativo" ?"selected":""}>Inativo</option>
          <option value="rascunho" ${s.statusFiltro==="rascunho"?"selected":""}>Rascunho</option>
        </select>
      </div>

      ${filtrados.length === 0
        ? `<div class="prod-vazio">
             <i class="fi fi-rr-box-open"></i>
             <p>${produtos.length===0
               ? "Nenhum produto cadastrado ainda."
               : "Nenhum produto encontrado com esses filtros."}</p>
             ${produtos.length===0
               ? `<button class="btn-novo-prod" id="btn-novo-vazio">
                    <i class="fi fi-rr-add"></i> Cadastrar primeiro produto
                  </button>`
               : ""}
           </div>`
        : `<div class="prod-list-wrap">
             <div class="prod-list-head">
               <span>Produto</span>
               <span>Categoria</span>
               <span>Status</span>
               <span>Pre&ccedil;o</span>
               <span>A&ccedil;&otilde;es</span>
             </div>
             <div class="prod-list">
               ${filtrados.map(p => this._renderRow(p, categorias)).join("")}
             </div>
           </div>`}
    `;

    this._bindEvents(produtos);
  }

  _renderRow(p, categorias = []) {
    const status      = p.status || "ativo";
    const statusLabel = { ativo:"Ativo", inativo:"Inativo", rascunho:"Rascunho" }[status] || status;
    const statusClass = { ativo:"st-ativo", inativo:"st-inativo", rascunho:"st-rascunho" }[status] || "";
    const preco       = Number(p.preco_venda || 0);
    const categoria   = categorias.find(cat => String(cat.id) === String(p.categoria_id))?.nome || "Sem categoria";

    const icone = p.icone_svg
      ? `<div class="prod-row-icon prod-icone-svg">${p.icone_svg}</div>`
      : `<div class="prod-row-icon prod-icone-fi"><i class="fi fi-rr-box-open"></i></div>`;

    return `
      <div class="prod-row">
        <div class="prod-info">
          ${icone}
          <div class="prod-main">
            <div class="prod-nome">${esc(p.nome)}</div>
            <div class="prod-meta">
              ${p.sku ? `<span>SKU: ${esc(p.sku)}</span>` : `<span>Sem SKU</span>`}
              ${p.descricao ? `<span>${esc(p.descricao)}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="prod-categoria">${esc(categoria)}</div>
        <div><span class="prod-status ${statusClass}">${statusLabel}</span></div>
        <div class="prod-preco">${preco > 0 ? fmtBRL(preco) : "—"}</div>
        <div class="prod-acoes">
          <button class="btn-icon" data-edit="${esc(p.id)}" title="Editar produto">
            <i class="fi fi-rr-pencil"></i>
          </button>
          <button class="btn-icon danger" data-del="${esc(p.id)}" data-nome="${esc(p.nome)}" title="Excluir produto">
            <i class="fi fi-rr-trash"></i>
          </button>
        </div>
      </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EVENTOS
  // ══════════════════════════════════════════════════════════════════════════
  _bindEvents(produtos) {
    const c = this._container;
    if (!c) return;

    // Novo produto
    c.querySelector("#btn-novo")?.addEventListener("click",      () => this._abrirModal(null));
    c.querySelector("#btn-novo-vazio")?.addEventListener("click", () => this._abrirModal(null));

    // Filtros
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

    // Editar / Deletar por card
    c.querySelectorAll("[data-edit]").forEach(btn =>
      btn.addEventListener("click", () => {
        const p = produtos.find(x => x.id === btn.dataset.edit);
        if (p) this._abrirModal(p);
      })
    );
    c.querySelectorAll("[data-del]").forEach(btn =>
      btn.addEventListener("click", () => this._deletar(btn.dataset.del, btn.dataset.nome))
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL CADASTRO / EDIÇÃO
  // ══════════════════════════════════════════════════════════════════════════
  _abrirModal(produto) {
    const categorias = selectors.produtos().categorias || [];
    const editando   = !!produto?.id;
    const p          = produto || {};

    const modalPanel = openModal({
      title:    `<i class="fi fi-rr-box-open" style="color:var(--primary)"></i> ${editando ? "Editar Produto" : "Novo Produto"}`,
      maxWidth: "500px",
      body: `
        <div class="modal-grid">
          <div class="modal-field full">
            <label>Nome *</label>
            <input id="mp-nome" value="${esc(p.nome||"")}"
                   placeholder="Nome do produto ou serviço" autofocus />
          </div>
          <div class="modal-field">
            <label>SKU / Código</label>
            <input id="mp-sku" value="${esc(p.sku||"")}" placeholder="Ex: ADES-A4-001" />
          </div>
          <div class="modal-field">
            <label>Preço de venda (R$)</label>
            <input id="mp-preco" type="number" min="0" step="0.01"
                   value="${p.preco_venda||""}" placeholder="0,00" />
          </div>
          <div class="modal-field">
            <label>Categoria</label>
            <select id="mp-cat">
              <option value="">Sem categoria</option>
              ${categorias.map(cat =>
                `<option value="${esc(cat.id)}" ${p.categoria_id===cat.id?"selected":""}>${esc(cat.nome)}</option>`
              ).join("")}
            </select>
          </div>
          <div class="modal-field">
            <label>Status</label>
            <select id="mp-status">
              <option value="ativo"    ${(p.status||"ativo")==="ativo"   ?"selected":""}>Ativo</option>
              <option value="inativo"  ${p.status==="inativo"            ?"selected":""}>Inativo</option>
              <option value="rascunho" ${p.status==="rascunho"           ?"selected":""}>Rascunho</option>
            </select>
          </div>
          <div class="modal-field full">
            <label>Descrição</label>
            <textarea id="mp-desc" rows="2"
                      placeholder="Descrição opcional...">${esc(p.descricao||"")}</textarea>
          </div>
        </div>`,
      actions: `
        <button class="btn-secondary" id="mp-cancel">Cancelar</button>
        <button class="btn-primary"   id="mp-ok">
          <i class="fi fi-rr-check"></i> ${editando ? "Salvar" : "Cadastrar"}
        </button>`,
    });

    // Cancelar
    modalPanel.querySelector("#mp-cancel")
      ?.addEventListener("click", () => modalPanel.close());

    // Salvar
    modalPanel.querySelector("#mp-ok")
      ?.addEventListener("click", async () => {
        const nome = modalPanel.querySelector("#mp-nome")?.value.trim();
        if (!nome) {
          const inp = modalPanel.querySelector("#mp-nome");
          if (inp) { inp.style.borderColor = "var(--error)"; inp.focus(); }
          return;
        }

        const dados = {
          nome,
          sku:          modalPanel.querySelector("#mp-sku")?.value.trim()       || null,
          preco_venda:  parseFloat(modalPanel.querySelector("#mp-preco")?.value) || 0,
          categoria_id: modalPanel.querySelector("#mp-cat")?.value               || null,
          status:       modalPanel.querySelector("#mp-status")?.value,
          descricao:    modalPanel.querySelector("#mp-desc")?.value.trim()       || null,
        };

        const okBtn = modalPanel.querySelector("#mp-ok");
        if (okBtn) { okBtn.disabled = true; okBtn.textContent = "Salvando…"; }

        try {
          if (editando) await services.produto.atualizar(produto.id, dados);
          else          await services.produto.criar(dados);
          modalPanel.close();
          this._render();
        } catch (e) {
          alert("Erro ao salvar: " + e.message);
          if (okBtn) {
            okBtn.disabled = false;
            okBtn.innerHTML = `<i class="fi fi-rr-check"></i> ${editando?"Salvar":"Cadastrar"}`;
          }
        }
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETAR
  // ══════════════════════════════════════════════════════════════════════════
  async _deletar(id, nome) {
    if (!confirm(`Excluir o produto "${nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await services.produto.deletar(id);
      this._render();
    } catch (e) {
      alert("Erro ao excluir: " + e.message);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CSS
  // ══════════════════════════════════════════════════════════════════════════
  _css() { return `
.prod-topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.btn-novo-prod{display:inline-flex;align-items:center;gap:7px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius-md);padding:9px 16px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all var(--t);font-family:var(--font)}
.btn-novo-prod:hover{opacity:.88;box-shadow:var(--shadow-sm)}

.prod-filtros{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.prod-search-wrap{position:relative;flex:1;min-width:200px}
.prod-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;pointer-events:none}
.prod-search{width:100%;padding:8px 10px 8px 32px;border:1px solid var(--border-md);border-radius:var(--radius-md);background:var(--panel2);color:var(--text);font-size:12.5px;font-family:var(--font);box-sizing:border-box;outline:none;transition:border-color var(--t)}
.prod-search:focus{border-color:var(--primary)}
[data-theme="light"] .prod-search{background:#fff}
.prod-select{padding:8px 12px;border:1px solid var(--border-md);border-radius:var(--radius-md);background:var(--panel2);color:var(--text);font-size:12.5px;font-family:var(--font);cursor:pointer;outline:none}
[data-theme="light"] .prod-select{background:#fff}

.prod-list-wrap{border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;background:var(--panel2);box-shadow:var(--shadow-xs)}
[data-theme="light"] .prod-list-wrap{box-shadow:var(--shadow-sm)}
.prod-list-head{display:grid;grid-template-columns:minmax(260px,1fr) 150px 110px 120px 82px;gap:12px;align-items:center;padding:10px 14px;background:var(--panel3);border-bottom:1px solid var(--border);color:var(--muted);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.prod-list-head span:nth-child(4){text-align:right}
.prod-list-head span:nth-child(5){text-align:right}
.prod-list{display:flex;flex-direction:column}
.prod-row{display:grid;grid-template-columns:minmax(260px,1fr) 150px 110px 120px 82px;gap:12px;align-items:center;padding:12px 14px;border-top:1px solid var(--border);transition:background var(--t)}
.prod-row:first-child{border-top:none}
.prod-row:hover{background:var(--panel3)}
.prod-info{display:flex;align-items:center;gap:11px;min-width:0}
.prod-main{min-width:0}
.prod-row-icon{width:34px;height:34px;flex-shrink:0;border-radius:var(--radius-sm);background:var(--panel3);display:flex;align-items:center;justify-content:center}
.prod-row:hover .prod-row-icon{background:var(--panel2)}
.prod-icone-fi{font-size:18px;color:var(--muted)}
.prod-icone-svg{overflow:hidden}
.prod-icone-svg svg{width:26px !important;height:26px !important;max-width:26px;max-height:26px;display:block}
.prod-status{font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:99px}
.st-ativo   {background:rgba(0,196,154,.12);color:var(--success)}
.st-inativo {background:var(--panel3);color:var(--muted)}
.st-rascunho{background:rgba(255,179,0,.12);color:var(--warning)}
.prod-nome{font-size:13.5px;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prod-meta{display:flex;gap:8px;color:var(--muted);font-size:10.5px;line-height:1.35;min-width:0}
.prod-meta span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}
.prod-meta span+span{color:var(--text-sub)}
.prod-categoria{font-size:12px;color:var(--text-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prod-preco{font-size:13px;font-weight:800;color:var(--primary-light);text-align:right;white-space:nowrap}
.prod-acoes{display:flex;justify-content:flex-end;gap:6px}
.prod-acoes .btn-icon{width:30px;height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.prod-vazio{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px 20px;color:var(--muted);text-align:center}
.prod-vazio i{font-size:36px;opacity:.3}

@media (max-width: 820px){
  .prod-list-head{display:none}
  .prod-list-wrap{border-radius:var(--radius-md)}
  .prod-row{grid-template-columns:1fr auto;gap:10px;padding:12px}
  .prod-info{grid-column:1/-1}
  .prod-categoria{grid-column:1/2}
  .prod-preco{text-align:left}
  .prod-acoes{grid-column:2/3;grid-row:2/4;align-self:center}
}

/* Modal fields */
.modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.modal-field{display:flex;flex-direction:column;gap:5px}
.modal-field.full{grid-column:1/-1}
.modal-field label{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
`; }
}
