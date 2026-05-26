/**
 * CLIENTES VIEW — CRUD completo com busca reativa e cards melhorados.
 */

import { ListViewBase }      from "./baseView.js";
import { services }          from "../../core/services.js";
import { selectors }         from "../../core/store.js";
import { EventBus, EVENTS }  from "../../core/eventBus.js";
import { esc }               from "../../utils/sanitize.js";
import {
  PageHeader, Btn, SearchBar, EmptyState,
} from "../components/index.js";

export class ClientesView extends ListViewBase {
  #subView       = "lista";
  #clienteAberto = null;

  async _init() {
    await services.cliente.listar();
    this.setList(selectors.clientes().list);
    this.subscribe("clientes", next => this.setList(next.list));
  }

  render()      { return this.#subView === "form" ? this.#renderForm() : this.#renderLista(); }
  afterRender() { if (this.#subView === "lista") this.#bindLista(); else this.#bindForm(); }

  // ══════════════════════════════════════════════════════════════════════════
  // LISTA
  // ══════════════════════════════════════════════════════════════════════════
  #renderLista() {
    const filtrados = this.filteredList;

    return `
      <style>${cliCSS()}</style>

      ${PageHeader({
        title:    "Clientes",
        subtitle: `${this.list.length} cliente${this.list.length!==1?"s":""} cadastrados`,
        actions:  Btn.primary('<i class="fi fi-rr-user-add"></i> Novo Cliente', "btn-novo-cliente"),
      })}

      <div class="cli-toolbar">
        <div style="flex:1;max-width:360px">
          ${SearchBar({ id: "busca-cli", placeholder: "Buscar nome, telefone, CPF/CNPJ...", value: this._state.search })}
        </div>
        <span class="result-count">
          ${filtrados.length} cliente${filtrados.length!==1?"s":""}
          ${this._state.search ? " encontrado" + (filtrados.length!==1?"s":"") : ""}
        </span>
      </div>

      ${filtrados.length === 0
        ? EmptyState({
            icon:     "fi-rr-users",
            title:    this._state.search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado",
            subtitle: this._state.search ? "Tente outros termos de busca." : "Clique em \"Novo Cliente\" para começar.",
            action:   !this._state.search ? Btn.primary('<i class="fi fi-rr-user-add"></i> Novo Cliente', "btn-novo-empty") : "",
          })
        : `<div class="cli-list-wrap">
             <div class="cli-list-head">
               <span>Cliente</span>
               <span>Telefone</span>
               <span>Documento</span>
               <span>Cidade</span>
               <span>A&ccedil;&otilde;es</span>
             </div>
             <div class="cli-list">
               ${filtrados.map(c => this.#row(c)).join("")}
             </div>
           </div>`}
    `;
  }

  #row(c) {
    const inicial = (c.nome || "?")[0].toUpperCase();
    // Cor do avatar baseada no nome (pseudo-aleatória mas estável)
    const cores = ["#00c49a","#6B48FF","#007CBE","#F79009","#e53935","#43a047"];
    const corIdx = c.nome?.charCodeAt(0) % cores.length || 0;
    const cor    = cores[corIdx];
    const local  = [c.cidade, c.estado].filter(Boolean).join(" / ") || "Sem cidade";

    return `
      <div class="cli-row" data-id="${c.id}" role="button" tabindex="0">
        <div class="cli-info">
          <div class="cli-avatar" style="--av-cor:${cor}">${inicial}</div>
          <div class="cli-main">
            <div class="cli-nome">${esc(c.nome)}</div>
            <div class="cli-meta">
              ${c.email ? `<span><i class="fi fi-rr-envelope"></i> ${esc(c.email)}</span>` : `<span>Sem e-mail</span>`}
              ${c.observacoes ? `<span>${esc(c.observacoes.slice(0,60))}${c.observacoes.length>60?"...":""}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="cli-cell">${c.telefone ? esc(c.telefone) : "Sem telefone"}</div>
        <div class="cli-cell">${c.cpf_cnpj ? esc(c.cpf_cnpj) : "Sem documento"}</div>
        <div class="cli-cell">${esc(local)}</div>
        <div class="cli-actions">
          <button class="cli-edit-btn btn-icon" data-edit="${c.id}" title="Editar cliente">
            <i class="fi fi-rr-pencil"></i>
          </button>
        </div>
      </div>`;

  }

  #bindLista() {
    this.$("#busca-cli")?.addEventListener("input", e => this.setSearch(e.target.value));

    const abrirNovo = () => { this.#clienteAberto = {}; this.#subView = "form"; this.refresh(); };
    this.$("#btn-novo-cliente")?.addEventListener("click", abrirNovo);
    this.$("#btn-novo-empty")?.addEventListener("click",   abrirNovo);

    this.$$("[data-id]").forEach(card => {
      card.addEventListener("click", e => {
        if (e.target.closest("[data-edit]")) return;
        const c = this.list.find(x => x.id === card.dataset.id);
        if (c) { this.#clienteAberto = c; this.#subView = "form"; this.refresh(); }
      });
      card.addEventListener("keydown", e => {
        if (e.key === "Enter") card.click();
      });
    });

    this.$$("[data-edit]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const c = this.list.find(x => x.id === btn.dataset.edit);
        if (c) { this.#clienteAberto = c; this.#subView = "form"; this.refresh(); }
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FORMULÁRIO
  // ══════════════════════════════════════════════════════════════════════════
  #renderForm() {
    const c       = this.#clienteAberto || {};
    const editando = !!c.id;

    return `
      <style>${cliCSS()}</style>

      ${PageHeader({
        title:   editando ? "Editar Cliente" : "Novo Cliente",
        actions: Btn.secondary('<i class="fi fi-rr-arrow-left"></i> Voltar', "btn-voltar"),
      })}

      <div class="ds-card">
        <div class="ds-card-title"><i class="fi fi-rr-user"></i> Dados Principais</div>
        <div class="form-grid">
          <div class="form-field" style="grid-column:1/-1">
            <label>Nome *</label>
            <input id="f-nome" value="${esc(c.nome||"")}" placeholder="Nome completo ou razão social" autofocus />
          </div>
          <div class="form-field">
            <label>Telefone / WhatsApp</label>
            <input id="f-tel" value="${esc(c.telefone||"")}" placeholder="(11) 99999-9999" />
          </div>
          <div class="form-field">
            <label>E-mail</label>
            <input id="f-email" type="email" value="${esc(c.email||"")}" placeholder="email@exemplo.com" />
          </div>
          <div class="form-field" style="grid-column:1/-1">
            <label>CPF / CNPJ</label>
            <input id="f-doc" value="${esc(c.cpf_cnpj||"")}" placeholder="000.000.000-00 ou 00.000.000/0000-00" />
          </div>
        </div>
      </div>

      <div class="ds-card">
        <div class="ds-card-title"><i class="fi fi-rr-marker"></i> Endereço</div>
        <div class="form-grid">
          <div class="form-field" style="grid-column:1/-1">
            <label>Endereço</label>
            <input id="f-end" value="${esc(c.endereco||"")}" placeholder="Rua, número, bairro" />
          </div>
          <div class="form-field">
            <label>Cidade</label>
            <input id="f-cidade" value="${esc(c.cidade||"")}" placeholder="São Paulo" />
          </div>
          <div class="form-field">
            <label>Estado</label>
            <input id="f-estado" value="${esc(c.estado||"")}" placeholder="SP" maxlength="2" style="text-transform:uppercase" />
          </div>
          <div class="form-field">
            <label>CEP</label>
            <input id="f-cep" value="${esc(c.cep||"")}" placeholder="00000-000" />
          </div>
        </div>
      </div>

      <div class="ds-card">
        <div class="ds-card-title"><i class="fi fi-rr-comment"></i> Observações</div>
        <textarea id="f-obs" rows="3" placeholder="Preferências, prazo de pagamento, histórico...">${esc(c.observacoes||"")}</textarea>
      </div>

      <div class="form-actions">
        ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar', "btn-salvar")}
        ${editando ? Btn.danger('<i class="fi fi-rr-trash"></i> Excluir', "btn-deletar") : ""}
        ${Btn.secondary("Cancelar", "btn-cancelar")}
      </div>
    `;
  }

  #bindForm() {
    const voltar = () => { this.#subView = "lista"; this.refresh(); };
    this.$("#btn-voltar")?.addEventListener("click",   voltar);
    this.$("#btn-cancelar")?.addEventListener("click", voltar);

    this.$("#btn-salvar")?.addEventListener("click", async () => {
      const nome = this.$("#f-nome")?.value.trim();
      if (!nome) { this.toast("O nome é obrigatório.", "warn"); return; }

      const dados = {
        nome,
        telefone:    this.$("#f-tel")?.value.trim()    || null,
        email:       this.$("#f-email")?.value.trim()   || null,
        cpf_cnpj:    this.$("#f-doc")?.value.trim()     || null,
        endereco:    this.$("#f-end")?.value.trim()     || null,
        cidade:      this.$("#f-cidade")?.value.trim()  || null,
        estado:      this.$("#f-estado")?.value.trim().toUpperCase() || null,
        cep:         this.$("#f-cep")?.value.trim()     || null,
        observacoes: this.$("#f-obs")?.value.trim()     || null,
      };

      try {
        const c = this.#clienteAberto;
        if (c?.id) await services.cliente.atualizar(c.id, dados);
        else       await services.cliente.criar(dados);
        this.#subView = "lista";
        this.refresh();
      } catch (e) {
        this.toast(e.message || "Erro ao salvar.", "erro");
      }
    });

    this.$("#btn-deletar")?.addEventListener("click", async () => {
      const c = this.#clienteAberto;
      if (!confirm(`Excluir o cliente "${c.nome}"? Esta ação não pode ser desfeita.`)) return;
      try {
        await services.cliente.deletar(c.id);
        this.#subView = "lista";
        this.refresh();
      } catch (e) {
        this.toast(e.message || "Erro ao excluir.", "erro");
      }
    });
  }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function cliCSS() { return `
.page-header{margin-bottom:12px!important}
.page-title{line-height:1.12!important}
.page-subtitle{margin:1px 0 0!important;line-height:1.2!important}
.cli-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.result-count{font-size:12px;color:var(--muted)}
.cli-list-wrap{border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;background:var(--panel2);box-shadow:var(--shadow-xs)}
[data-theme="light"] .cli-list-wrap{box-shadow:var(--shadow-sm)}
.cli-list-head{display:grid;grid-template-columns:minmax(260px,1fr) 145px 155px 130px 72px;gap:12px;align-items:center;padding:10px 14px;background:var(--panel3);border-bottom:1px solid var(--border);color:var(--muted);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.cli-list-head span:last-child{text-align:right}
.cli-list{display:flex;flex-direction:column}
.cli-row{display:grid;grid-template-columns:minmax(260px,1fr) 145px 155px 130px 72px;gap:12px;align-items:center;padding:12px 14px;border-top:1px solid var(--border);cursor:pointer;transition:background var(--t),box-shadow var(--t)}
.cli-row:first-child{border-top:none}
.cli-row:hover{background:var(--panel3)}
.cli-row:focus{outline:2px solid var(--primary);outline-offset:-2px}
.cli-info{display:flex;align-items:center;gap:11px;min-width:0}
.cli-main{min-width:0}
.cli-cell{font-size:12px;color:var(--text-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cli-meta{display:flex;gap:8px;color:var(--muted);font-size:10.5px;line-height:1.35;min-width:0}
.cli-meta span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px}
.cli-meta span+span{color:var(--text-sub)}
.cli-actions{display:flex;justify-content:flex-end}
.cli-actions .btn-icon{width:30px;height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.cli-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.cli-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;cursor:pointer;transition:border-color var(--t),transform var(--t),box-shadow var(--t)}
.cli-card:hover{border-color:var(--primary-border);transform:translateY(-2px);box-shadow:var(--shadow-md)}
.cli-card:focus{outline:2px solid var(--primary);outline-offset:2px}
.cli-card-header{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
.cli-avatar{width:40px;height:40px;border-radius:50%;background:color-mix(in srgb,var(--av-cor) 20%,var(--panel3));color:var(--av-cor);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex-shrink:0;border:2px solid color-mix(in srgb,var(--av-cor) 30%,transparent)}
.cli-card-info{flex:1;min-width:0}
.cli-nome{font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cli-obs{font-size:11px;color:var(--muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cli-edit-btn{opacity:1;transition:opacity var(--t);flex-shrink:0}
.cli-card .cli-edit-btn{opacity:0}
.cli-card:hover .cli-edit-btn{opacity:1}
.cli-tags{display:flex;flex-direction:column;gap:5px}
.cli-tag{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px}
.cli-tag i{font-size:11px;color:var(--muted2)}
.form-actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:4px;margin-top:4px}
@media (max-width: 860px){
  .cli-list-head{display:none}
  .cli-list-wrap{border-radius:var(--radius-md)}
  .cli-row{grid-template-columns:1fr auto;gap:9px;padding:12px}
  .cli-info{grid-column:1/-1}
  .cli-cell{grid-column:1/2}
  .cli-actions{grid-column:2/3;grid-row:2/5;align-self:center}
}
`; }
