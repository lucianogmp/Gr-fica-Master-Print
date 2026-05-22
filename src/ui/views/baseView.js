/**
 * BASE VIEW — Classe base para todas as views do ERP.
 *
 * Fornece:
 *  - mount(container) / unmount()        lifecycle
 *  - refresh()                           re-renderiza a view no container
 *  - $(sel) / $$(sel)                    query helpers (escopo da view)
 *  - toast(msg, tipo)                    notificação inline
 *  - listenTo(event, handler)            EventBus com cleanup automático
 *  - _loading(msg) / _error(msg)         estados padrão
 *
 * Contrato para subclasses:
 *  - render()        → retorna HTML string (obrigatório)
 *  - afterRender()   → chamado após injetar o HTML (opcional)
 *  - _init()         → async, chamado uma vez em mount() (opcional)
 *  - unmount()       → pode ser sobrescrito (chame super.unmount())
 */

import { EventBus } from "../core/eventBus.js";

export class BaseView {
  /** @type {HTMLElement|null} */
  _container = null;

  /** @private listeners do EventBus para cleanup */
  _busListeners = [];

  /** @private listeners do DOM para cleanup */
  _domListeners = [];

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Monta a view num container DOM.
   * @param {HTMLElement} container
   */
  async mount(container) {
    this._container = container;
    if (this._init) await this._init();
    this.refresh();
  }

  /** Desmonta a view, removendo todos os listeners. */
  unmount() {
    this._busListeners.forEach(({ event, handler }) =>
      EventBus.off(event, handler)
    );
    this._busListeners = [];

    this._domListeners.forEach(({ el, event, handler }) =>
      el.removeEventListener(event, handler)
    );
    this._domListeners = [];

    this._container = null;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  /**
   * Re-renderiza a view injetando render() no container.
   * Chama afterRender() após injetar.
   */
  refresh() {
    if (!this._container) return;
    this._container.innerHTML = this.render?.() ?? "";
    this.afterRender?.();
  }

  // ── Query helpers ───────────────────────────────────────────────────────────

  /**
   * querySelector com escopo no container da view.
   * @param {string} selector
   * @returns {Element|null}
   */
  $(selector) {
    return this._container?.querySelector(selector) ?? null;
  }

  /**
   * querySelectorAll com escopo no container da view.
   * @param {string} selector
   * @returns {Element[]}
   */
  $$(selector) {
    return this._container
      ? [...this._container.querySelectorAll(selector)]
      : [];
  }

  // ── EventBus ────────────────────────────────────────────────────────────────

  /**
   * Escuta um evento do EventBus e registra para cleanup automático.
   * @param {string} event
   * @param {Function} handler
   */
  listenTo(event, handler) {
    EventBus.on(event, handler);
    this._busListeners.push({ event, handler });
  }

  // ── Toast ───────────────────────────────────────────────────────────────────

  /**
   * Exibe uma mensagem temporária no topo do container.
   * @param {string} msg
   * @param {"ok"|"erro"|"info"|"warn"} tipo
   * @param {number} [duration=3500] ms
   */
  toast(msg, tipo = "ok", duration = 3500) {
    if (!this._container) return;

    const old = this._container.querySelector(".base-toast");
    old?.remove();

    const icons = { ok: "✅", erro: "❌", info: "ℹ️", warn: "⚠️" };
    const div   = document.createElement("div");
    div.className = `base-toast base-toast--${tipo}`;
    div.setAttribute("role", "status");
    div.setAttribute("aria-live", "polite");
    div.innerHTML = `<span class="base-toast__icon">${icons[tipo] ?? "ℹ️"}</span><span>${msg}</span>`;
    this._container.prepend(div);

    setTimeout(() => div.remove(), duration);
  }

  // ── Estados padrão ──────────────────────────────────────────────────────────

  /**
   * HTML de estado de loading.
   * @param {string} [msg]
   */
  _loading(msg = "Carregando...") {
    return `
      <div class="loading-state" role="status" aria-label="${msg}">
        <div class="spinner"></div>
        <span>${msg}</span>
      </div>`;
  }

  /**
   * HTML de estado de erro.
   * @param {string} [msg]
   */
  _error(msg = "Erro ao carregar dados.") {
    return `
      <div class="empty-state">
        <i class="fi fi-rr-exclamation empty-state-icon" style="color:var(--error)" aria-hidden="true"></i>
        <div class="empty-state-title" style="color:var(--error)">Ops, algo deu errado</div>
        <div class="empty-state-subtitle">${msg}</div>
      </div>`;
  }

  /**
   * HTML de estado vazio.
   * @param {string} title
   * @param {string} [sub]
   * @param {string} [icon]
   */
  _empty(title, sub = "", icon = "fi-rr-inbox") {
    return `
      <div class="empty-state">
        <i class="fi ${icon} empty-state-icon" aria-hidden="true"></i>
        <div class="empty-state-title">${title}</div>
        ${sub ? `<div class="empty-state-subtitle">${sub}</div>` : ""}
      </div>`;
  }
}
