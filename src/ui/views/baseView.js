/**
 * BASE VIEW — Classe base para todas as views do ERP.
 * Fornece ciclo de vida (mount/unmount), reatividade ao store,
 * e helpers para evitar memory leaks.
 */

import { store } from "../../core/store.js";
import { EventBus } from "../../core/eventBus.js";
import { showToast } from "../components/index.js";

export class BaseView {
  #container = null;
  #subscriptions = [];
  #eventListeners = [];
  #mounted = false;

  /** Subclasses implementam este método para retornar o HTML inicial */
  render() { return ""; }

  /** Chamado após o DOM ser inserido. Subclasses adicionam event listeners aqui. */
  afterRender() {}

  /** Chamado quando a view é desmontada (troca de página) */
  onUnmount() {}

  /** Monta a view no container */
  async mount(container) {
    this.#container = container;
    this.#mounted = true;

    try {
      container.innerHTML = this._loading();
      await this._init();
      this._renderToDOM();
    } catch (e) {
      console.error(`[${this.constructor.name}] Erro ao montar:`, e);
      container.innerHTML = this._errorState(e.message);
    }
  }

  /** Hook de inicialização assíncrona (buscar dados, etc.) */
  async _init() {}

  /** Renderiza o HTML atual no container */
  _renderToDOM() {
    if (!this.#mounted || !this.#container) return;
    this.#container.innerHTML = this.render();
    this.afterRender();
  }

  /** Re-renderiza sem limpar subscriptions */
  refresh() { this._renderToDOM(); }

  /** Acesso ao container */
  get el() { return this.#container; }

  /** Acesso ao container (alias) */
  get container() { return this.#container; }

  get mounted() { return this.#mounted; }

  /** querySelector com escopo no container */
  $(selector) { return this.#container?.querySelector(selector); }
  $$(selector) { return this.#container ? [...this.#container.querySelectorAll(selector)] : []; }

  /** Adiciona event listener com cleanup automático */
  on(element, event, handler) {
    if (!element) return;
    element.addEventListener(event, handler);
    this.#eventListeners.push({ element, event, handler });
  }

  /** Subscreve ao store com cleanup automático */
  subscribe(slice, callback) {
    const unsub = store.subscribe(slice, (next, prev) => {
      if (!this.#mounted) return;
      callback(next, prev);
    });
    this.#subscriptions.push(unsub);
    return unsub;
  }

  /** Subscreve ao EventBus com cleanup automático */
  listenTo(event, handler) {
    const off = EventBus.on(event, (data) => {
      if (!this.#mounted) return;
      handler(data);
    });
    this.#subscriptions.push(off);
    return off;
  }

  /** Desmonta a view e limpa todos os listeners */
  unmount() {
    this.#mounted = false;
    this.#subscriptions.forEach(unsub => unsub());
    this.#subscriptions = [];
    this.#eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.#eventListeners = [];
    this.onUnmount();
  }

  /** Toast via design system */
  toast(msg, tipo = "ok") { showToast(msg, tipo); }

  /** Estado de loading */
  _loading(text = "Carregando...") {
    return `<div class="loading-state">
      <div class="spinner"></div>
      <span>${text}</span>
    </div>`;
  }

  /** Estado de erro */
  _errorState(msg) {
    return `<div class="empty-state">
      <i class="fi fi-rr-exclamation empty-state-icon" style="color:var(--error)"></i>
      <div class="empty-state-title" style="color:var(--error)">Erro ao carregar</div>
      <div class="empty-state-subtitle">${msg}</div>
      <button class="btn btn-secondary" onclick="location.reload()">↺ Recarregar</button>
    </div>`;
  }
}

/**
 * VIEW COM MODAL — Mixin para views que precisam abrir modais.
 * Centraliza o gerenciamento do modal overlay.
 */
export class ModalView extends BaseView {
  #modal = null;

  openModal({ title, body, actions, maxWidth, onClose }) {
    const { openModal } = require("../components/index.js");
    this.#modal = openModal({ title, body, actions, maxWidth, onClose: () => {
      this.#modal = null;
      onClose?.();
    }});
    return this.#modal;
  }

  closeModal() { this.#modal?.close(); }
}

/**
 * VIEW DE LISTA — Base para telas do tipo listagem + CRUD
 */
export class ListViewBase extends BaseView {
  _state = {
    list: [],
    search: "",
    loading: false,
    currentItem: null,
    page: 1,
  };

  get list() { return this._state.list; }
  get filteredList() {
    const q = this._state.search.toLowerCase();
    if (!q) return this._state.list;
    return this._state.list.filter(item =>
      Object.values(item).some(v =>
        String(v).toLowerCase().includes(q)
      )
    );
  }

  setSearch(term) {
    this._state.search = term;
    this.refresh();
  }

  setList(list) {
    this._state.list = list;
    this._state.loading = false;
    this.refresh();
  }

  setLoading(v) {
    this._state.loading = v;
    this.refresh();
  }

  openItem(item) {
    this._state.currentItem = item;
    this.refresh();
  }

  closeItem() {
    this._state.currentItem = null;
    this.refresh();
  }
}
