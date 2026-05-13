/**
 * ROUTER — Roteamento client-side com histórico e guards.
 * Desacopla a navegação da UI: qualquer módulo pode redirecionar sem
 * importar componentes de layout.
 */

import { EventBus, EVENTS } from "./eventBus.js";
import { store, actions } from "./store.js";

class Router {
  #routes = new Map();
  #guards = [];
  #currentRoute = null;
  #history = [];

  /** Registra uma rota */
  register(path, handler, meta = {}) {
    this.#routes.set(path, { handler, meta });
    return this;
  }

  /** Registra múltiplas rotas de uma vez */
  registerAll(routes) {
    Object.entries(routes).forEach(([path, config]) => {
      this.register(path, config.mount || config, config.meta || {});
    });
    return this;
  }

  /** Adiciona um guard de navegação (fn retorna true = permite, false = bloqueia) */
  guard(fn) {
    this.#guards.push(fn);
    return this;
  }

  /** Navega para uma rota */
  navigate(path, pushHistory = true) {
    const route = this.#routes.get(path);
    if (!route) {
      console.warn(`[Router] Rota não encontrada: ${path}`);
      this.navigate("dashboard");
      return;
    }

    // Executar guards
    for (const guard of this.#guards) {
      if (!guard(path, this.#currentRoute)) {
        console.warn(`[Router] Navegação bloqueada por guard: ${path}`);
        return;
      }
    }

    const prev = this.#currentRoute;
    this.#currentRoute = path;

    if (pushHistory) {
      window.location.hash = path;
      this.#history.push(path);
    }

    actions.setPage(path);
    EventBus.emit(EVENTS.PAGINA_MUDOU, { from: prev, to: path, meta: route.meta });

    return route;
  }

  /** Monta a página no container */
  mount(container) {
    const path = this.#currentRoute;
    const route = this.#routes.get(path);
    if (!route) return;
    route.handler(container);
  }

  /** Inicializa o roteador lendo o hash atual */
  init() {
    const getHash = () => window.location.hash.replace("#", "") || "dashboard";
    const handleChange = () => this.navigate(getHash(), false);
    window.addEventListener("hashchange", handleChange);
    this.navigate(getHash(), false);
    return this;
  }

  get current() { return this.#currentRoute; }
  get previous() { return this.#history[this.#history.length - 2] || null; }
  getHistory() { return [...this.#history]; }
}

export const router = new Router();
