/**
 * CLIENTES VIEW — CRUD completo com busca reativa.
 */

import { ListViewBase } from "./baseView.js";
import { services } from "../../core/services.js";
import { selectors } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import { PageHeader, Btn, openModal, SearchBar, DataTable, EmptyState, esc, fmtData } from "../components/index.js";

export class ClientesView extends ListViewBase {
  #subView = "lista";
  #clienteAberto = null;

  async _init() {
    await services.cliente.listar();
    this.setList(selectors.clientes().list);

    this.subscribe("clientes", next => this.setList(next.list));
    this.listenTo(EVENTS.CLIENTE_CRIADO,    () => {});
    this.listenTo(EVENTS.CLIENTE_ATUALIZADO,() => {});
  }

  render() {
    return this.#subView === "form" ? this.#renderForm() : this.#renderLista();
  }

  afterRender() {
    if (this.#subView === "lista") this.#bindLista();
    else this.#bindForm();
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  #renderLista() {
    const filtrados = this.filteredList;
    return `
      ${PageHeader({
        title: "Clientes",
        subtitle: `${this.list.length} cliente${this.list.length !== 1 ? "s" : ""} cadastrados`,
        actions: Btn.primary('<i class="fi fi-rr-user-add"></i> Novo Cliente', "btn-novo-cliente"),
      })}

      <div style="margin-bottom:14px;max-width:360px">
        ${SearchBar({ id: "busca-cli", placeholder: "Buscar nome, telefone, CPF/CNPJ...", value: this._state.search })}
      </div>

      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
        ${filtrados.length} cliente${filtrados.length !== 1 ? "s" : ""}${this._state.search ? " encontrado" + (filtrados.length !== 1 ? "s" : "") : " cadastrado" + (filtrados.length !== 1 ? "s" : "")}
      </div>

      ${filtrados.length === 0
        ? EmptyState({
            icon: "fi-rr-users",
            title: this._state.search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado",
            subtitle: this._state.search ? "Tente outros termos de busca." : "Clique em \"Novo Cliente\" para começar.",
            action: !this._state.search ? Btn.primary('<i class="fi fi-rr-user-add"></i> Novo Cliente', "btn-novo-empty") : "",
          })
        : `<div class="cli-grid">
            ${filtrados.map(c => this.#renderCard(c)).join("")}
           </div>`}
      <style>
        .cli-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
        .cli-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;cursor:pointer;transition:border-color .15s}
        .cli-card:hover{border-color:rgba(0,196,154,0.35)}
        .cli-avatar{width:40px;height:40px;border-radius:50%;background:var(--primary-bg);color:var(--primary-light);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;margin-bottom:10px}
        .cli-nome{font-weight:700;font-size:14px;margin-bottom:4px}
        .cli-info{font-size:12px;color:var(--muted);display:flex;flex-direction:column;gap:2px}
      </style>
    `;
  }

  #renderCard(c) {
    const inicial = (c.nome || "?")[0].toUpperCase();
    return `
      <div class="cli-card" data-id="${c.id}">
        <div class="cli-avatar">${inicial}</div>
        <div class="cli-nome">${esc(c.nome)}</div>
        <div class="cli-info">
          ${c.telefone ? `<span>📞 ${esc(c.telefone)}</span>` : ""}
          ${c.email    ? `<span>✉️ ${esc(c.email)}</span>`    : ""}
          ${c.cidade   ? `<span>📍 ${esc(c.cidade)}${c.estado ? ` — ${esc(c.estado)}` : ""}</span>` : ""}
          ${c.cpf_cnpj ? `<span>📄 ${esc(c.cpf_cnpj)}</span>` : ""}
        </div>
      </div>`;
  }

  #bindLista() {
    this.$("#busca-cli")?.addEventListener("input", e => this.setSearch(e.target.value));

    const abrirNovo = () => {
      this.#clienteAberto = {};
      this.#subView = "form";
      this.refresh();
    };
    this.$("#btn-novo-cliente")?.addEventListener("click", abrirNovo);
    this.$("#btn-novo-empty")?.addEventListener("click", abrirNovo);

    this.$$("[data-id]").forEach(card => {
      card.addEventListener("click", () => {
        this.#clienteAberto = this.list.find(c => c.id === card.dataset.id);
        this.#subView = "form";
        this.refresh();
      });
    });
  }

  // ── Formulário ─────────────────────────────────────────────────────────────
  #renderForm() {
    const c = this.#clienteAberto || {};
    const editando = !!c.id;

    return `
      ${PageHeader({
        title: editando ? "Editar Cliente" : "Novo Cliente",
        actions: Btn.secondary("← Voltar", "btn-voltar"),
      })}

      <div class="ds-card">
        <div class="ds-card-title">📋 Dados Principais</div>
        <div class="form-grid">
          <div class="form-field full">
            <label>Nome *</label>
            <input id="f-nome" value="${esc(c.nome)}" placeholder="Nome completo ou razão social" autofocus />
          </div>
          <div class="form-field">
            <label>Telefone / WhatsApp</label>
            <input id="f-tel" value="${esc(c.telefone)}" placeholder="(11) 99999-9999" />
          </div>
          <div class="form-field">
            <label>E-mail</label>
            <input id="f-email" type="email" value="${esc(c.email)}" placeholder="email@exemplo.com" />
          </div>
          <div class="form-field full">
            <label>CPF / CNPJ</label>
            <input id="f-doc" value="${esc(c.cpf_cnpj)}" placeholder="000.000.000-00 ou 00.000.000/0000-00" />
          </div>
        </div>
      </div>

      <div class="ds-card">
        <div class="ds-card-title">📍 Endereço</div>
        <div class="form-grid">
          <div class="form-field full">
            <label>Endereço</label>
            <input id="f-end" value="${esc(c.endereco)}" placeholder="Rua, número, bairro" />
          </div>
          <div class="form-field">
            <label>Cidade</label>
            <input id="f-cidade" value="${esc(c.cidade)}" placeholder="São Paulo" />
          </div>
          <div class="form-field">
            <label>Estado</label>
            <input id="f-estado" value="${esc(c.estado)}" placeholder="SP" maxlength="2" />
          </div>
          <div class="form-field">
            <label>CEP</label>
            <input id="f-cep" value="${esc(c.cep)}" placeholder="00000-000" />
          </div>
        </div>
      </div>

      <div class="ds-card">
        <div class="ds-card-title">📝 Observações</div>
        <textarea id="f-obs" rows="3" placeholder="Preferências, prazo de pagamento...">${esc(c.observacoes)}</textarea>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px">
        ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar', "btn-salvar")}
        ${editando ? Btn.danger('<i class="fi fi-rr-trash"></i> Deletar', "btn-deletar") : ""}
      </div>
    `;
  }

  #bindForm() {
    this.$("#btn-voltar")?.addEventListener("click", () => {
      this.#subView = "lista";
      this.refresh();
    });

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
        if (c?.id) {
          await services.cliente.atualizar(c.id, dados);
        } else {
          await services.cliente.criar(dados);
        }
        this.#subView = "lista";
        this.refresh();
      } catch (e) {
        this.toast(e.message || "Erro ao salvar.", "erro");
      }
    });

    this.$("#btn-deletar")?.addEventListener("click", async () => {
      const c = this.#clienteAberto;
      if (!confirm(`Deletar o cliente "${c.nome}"?`)) return;
      try {
        await services.cliente.deletar(c.id);
        this.#subView = "lista";
        this.refresh();
      } catch (e) {
        this.toast(e.message || "Erro ao deletar.", "erro");
      }
    });
  }
}
