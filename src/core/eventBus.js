/**
 * EVENT BUS — Sistema de eventos pub/sub para comunicação desacoplada entre módulos.
 * Permite que qualquer parte do sistema publique/consuma eventos sem referências diretas.
 */

class EventBusClass {
  #handlers = new Map();
  #onceHandlers = new Map();
  #history = [];
  #maxHistory = 50;

  /**
   * Subscreve a um evento. Retorna função de unsubscribe.
   * @param {string} event - Nome do evento (ex: "venda:criada")
   * @param {function} handler
   */
  on(event, handler) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
    this.#handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /** Subscreve a um evento apenas uma vez */
  once(event, handler) {
    const wrapper = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /** Remove um handler específico */
  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }

  /**
   * Publica um evento com payload.
   * @param {string} event
   * @param {any} data
   */
  emit(event, data) {
    // Registra no histórico
    const entry = { event, data, ts: Date.now() };
    this.#history.unshift(entry);
    if (this.#history.length > this.#maxHistory) this.#history.pop();

    // Handlers diretos
    this.#handlers.get(event)?.forEach(fn => {
      try { fn(data); }
      catch (e) { console.error(`[EventBus] Erro no handler de "${event}":`, e); }
    });

    // Wildcard handlers (ex: "*" ou "venda:*")
    const [namespace] = event.split(":");
    const wildcardNs = `${namespace}:*`;
    if (wildcardNs !== event) {
      this.#handlers.get(wildcardNs)?.forEach(fn => {
        try { fn({ event, data }); }
        catch (e) { console.error(`[EventBus] Erro no wildcard handler "${wildcardNs}":`, e); }
      });
    }
    this.#handlers.get("*")?.forEach(fn => {
      try { fn({ event, data }); }
      catch (e) { console.error(`[EventBus] Erro no wildcard global:`, e); }
    });
  }

  /** Retorna o histórico de eventos */
  getHistory() { return [...this.#history]; }

  /** Remove todos os handlers de um evento */
  clear(event) {
    if (event) this.#handlers.delete(event);
    else this.#handlers.clear();
  }
}

export const EventBus = new EventBusClass();

// ─── Catálogo de eventos do ERP ───────────────────────────────────────────────
// Nomenclatura: domínio:ação
export const EVENTS = {
  // Vendas
  VENDA_CRIADA:         "venda:criada",
  VENDA_ATUALIZADA:     "venda:atualizada",
  VENDA_DELETADA:       "venda:deletada",
  VENDA_STATUS_MUDOU:   "venda:status_mudou",
  VENDA_CONVERTIDA:     "venda:convertida_orcamento",

  // Clientes
  CLIENTE_CRIADO:       "cliente:criado",
  CLIENTE_ATUALIZADO:   "cliente:atualizado",
  CLIENTE_DELETADO:     "cliente:deletado",

  // Estoque
  ESTOQUE_ENTRADA:      "estoque:entrada",
  ESTOQUE_SAIDA:        "estoque:saida",
  ESTOQUE_ALERTA_BAIXO: "estoque:alerta_baixo",
  ESTOQUE_ZERADO:       "estoque:zerado",

  // Financeiro
  LANCAMENTO_CRIADO:    "financeiro:lancamento_criado",
  LANCAMENTO_PAGO:      "financeiro:lancamento_pago",
  LANCAMENTO_VENCIDO:   "financeiro:lancamento_vencido",

  // Produção
  PRODUCAO_ETAPA_MUDOU: "producao:etapa_mudou",
  PRODUCAO_CONCLUIDA:   "producao:concluida",

  // App
  PAGINA_MUDOU:         "app:pagina_mudou",
  MODAL_ABERTO:         "app:modal_aberto",
  MODAL_FECHADO:        "app:modal_fechado",
  TOAST:                "app:toast",
  CONFIG_CARREGADA:     "app:config_carregada",
};
