/**
 * STORE — Gerenciador de estado reativo centralizado
 * Inspirado no padrão Redux/Zustand mas sem dependências externas.
 * Cada slice representa um domínio do ERP.
 */

import { EventBus } from "./eventBus.js";

class Store {
  #state = {};
  #listeners = new Map();
  #middlewares = [];

  constructor(initialState = {}) {
    this.#state = structuredClone(initialState);
  }

  /** Retorna um snapshot imutável do estado (ou de um slice) */
  getState(slice) {
    const s = structuredClone(this.#state);
    return slice ? s[slice] : s;
  }

  /**
   * Atualiza um slice do estado e notifica os ouvintes.
   * @param {string} slice - Nome do domínio (ex: "vendas")
   * @param {object|function} patch - Objeto parcial ou função (state) => patch
   */
  set(slice, patch) {
    const current = this.#state[slice] ?? {};
    const next = typeof patch === "function" ? patch(structuredClone(current)) : { ...current, ...patch };

    // Middlewares (ex: logger, persistência)
    let finalPatch = next;
    for (const mw of this.#middlewares) {
      finalPatch = mw(slice, current, finalPatch) ?? finalPatch;
    }

    this.#state[slice] = finalPatch;

    // Notificar ouvintes do slice específico
    const key = `state:${slice}`;
    if (this.#listeners.has(key)) {
      this.#listeners.get(key).forEach(fn => fn(structuredClone(finalPatch), structuredClone(current)));
    }
    // Notificar ouvintes globais
    if (this.#listeners.has("state:*")) {
      this.#listeners.get("state:*").forEach(fn => fn(slice, structuredClone(finalPatch)));
    }
  }

  /** Subscreve a mudanças em um slice. Retorna função de unsubscribe. */
  subscribe(slice, callback) {
    const key = `state:${slice}`;
    if (!this.#listeners.has(key)) this.#listeners.set(key, new Set());
    this.#listeners.get(key).add(callback);
    return () => this.#listeners.get(key)?.delete(callback);
  }

  /** Subscreve a qualquer mudança de estado */
  subscribeAll(callback) {
    return this.subscribe("*", callback);
  }

  /** Adiciona um middleware (slice, prev, next) => next */
  use(middleware) {
    this.#middlewares.push(middleware);
    return this;
  }

  /** Reset de um slice ou de todo o estado */
  reset(slice) {
    if (slice) {
      this.set(slice, {});
    } else {
      Object.keys(this.#state).forEach(k => this.set(k, {}));
    }
  }
}

// ─── Estado inicial do ERP ─────────────────────────────────────────────────
const initialState = {
  app: {
    loading: false,
    currentPage: "dashboard",
    sidebarCollapsed: localStorage.getItem("sidebar_collapsed") === "true",
    theme: localStorage.getItem("theme") || "dark",
    toast: null,
    modal: null,
  },
  auth: {
    user: null,
    session: null,
    permissions: [],
  },
  vendas: {
    list: [],
    current: null,
    filters: { status: "", search: "", mes: "" },
    pagination: { page: 1, limit: 50, total: 0 },
    loading: false,
    dirty: false,
  },
  clientes: {
    list: [],
    current: null,
    filters: { search: "" },
    loading: false,
  },
  produtos: {
    list: [],
    categorias: [],
    current: null,
    loading: false,
  },
  estoque: {
    materias: [],
    movimentos: [],
    filters: { categoria: "", busca: "" },
    loading: false,
  },
  caixa: {
    movimentos: [],
    loading: false,
  },
  financeiro: {
    lancamentos: [],
    mes: mesAtual(),
    resumo: { receitas: 0, despesas: 0, saldo: 0 },
    loading: false,
  },
  orcamentos: {
    list: [],
    draft: null,
    loading: false,
  },
  producao: {
    itens: [],
    filtroEtapa: "",
    loading: false,
  },
  config: {
    empresa: {},
    formasPagamento: [],
    etapasProducao: [],
    loaded: false,
  },
  // Cache de lookups para evitar re-fetches
  cache: {
    clientes: null,
    produtos: null,
    vendedores: null,
    _ttl: {},
  },
};

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Middleware de persistência (salva preferências no localStorage) ─────────
const persistMiddleware = (slice, prev, next) => {
  if (slice === "app") {
    if (next.theme !== prev.theme) localStorage.setItem("theme", next.theme);
    if (next.sidebarCollapsed !== prev.sidebarCollapsed)
      localStorage.setItem("sidebar_collapsed", next.sidebarCollapsed);
  }
  return next;
};

// ─── Middleware de log em desenvolvimento ────────────────────────────────────
const logMiddleware = (slice, prev, next) => {
  if (import.meta.env?.DEV) {
    console.groupCollapsed(`[Store] ${slice}`);
    console.log("prev →", prev);
    console.log("next →", next);
    console.groupEnd();
  }
  return next;
};

// ─── Instância singleton ──────────────────────────────────────────────────────
export const store = new Store(initialState)
  .use(persistMiddleware);

// Ativar log apenas em dev
if (import.meta.env?.DEV) store.use(logMiddleware);

// ─── Seletores (helpers para leitura do estado) ───────────────────────────────
export const selectors = {
  app:          () => store.getState("app"),
  vendas:       () => store.getState("vendas"),
  vendasList:   () => store.getState("vendas").list,
  vendasFiltros:() => store.getState("vendas").filters,
  clientes:     () => store.getState("clientes"),
  clientesList: () => store.getState("clientes").list,
  produtos:     () => store.getState("produtos"),
  estoque:      () => store.getState("estoque"),
  caixa:        () => store.getState("caixa"),
  financeiro:   () => store.getState("financeiro"),
  config:       () => store.getState("config"),
  auth:         () => store.getState("auth"),
};

// ─── Actions (mutações nomeadas do estado) ────────────────────────────────────
export const actions = {
  // APP
  setLoading:    (v)    => store.set("app", { loading: v }),
  setPage:       (page) => store.set("app", { currentPage: page }),
  toggleSidebar: ()     => store.set("app", s => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed })),
  setTheme:      (t)    => store.set("app", { theme: t }),
  showToast:     (msg, tipo = "ok", duration = 3000) => {
    store.set("app", { toast: { msg, tipo, id: Date.now() } });
    setTimeout(() => store.set("app", { toast: null }), duration);
  },

  // VENDAS
  setVendas:   (list)    => store.set("vendas", { list, loading: false }),
  setVendaAtual:(v)     => store.set("vendas", { current: v }),
  setVendasFiltro:(f)   => store.set("vendas", s => ({ ...s, filters: { ...s.filters, ...f } })),
  setVendasLoading:(v)  => store.set("vendas", { loading: v }),
  markDirty:   ()       => store.set("vendas", { dirty: true }),
  markClean:   ()       => store.set("vendas", { dirty: false }),

  // CLIENTES
  setClientes:    (list) => store.set("clientes", { list, loading: false }),
  setClienteAtual:(c)   => store.set("clientes", { current: c }),

  // PRODUTOS
  setProdutos:    (list) => store.set("produtos", { list, loading: false }),
  setCategorias:  (list) => store.set("produtos", s => ({ ...s, categorias: list })),

  // ESTOQUE
  setMaterias:    (list) => store.set("estoque", { materias: list }),
  setMovimentos:  (list) => store.set("estoque", s => ({ ...s, movimentos: list })),

  // CAIXA
  setCaixaMovimentos: (list) => store.set("caixa", { movimentos: list, loading: false }),

  // FINANCEIRO
  setLancamentos: (list) => store.set("financeiro", { lancamentos: list, loading: false }),
  setMesFinanceiro:(mes) => store.set("financeiro", { mes }),
  setResumo:      (r)   => store.set("financeiro", { resumo: r }),

  // CONFIG
  setConfig:      (cfg) => store.set("config", { ...cfg, loaded: true }),
  setFormasPag:   (list)=> store.set("config", s => ({ ...s, formasPagamento: list })),

  // CACHE
  setCache: (key, data) => {
    store.set("cache", s => ({
      ...s,
      [key]: data,
      _ttl: { ...s._ttl, [key]: Date.now() + 5 * 60 * 1000 }, // 5 min TTL
    }));
  },
  getCache: (key) => {
    const cache = store.getState("cache");
    const ttl = cache._ttl?.[key];
    if (ttl && Date.now() < ttl) return cache[key];
    return null;
  },
};
