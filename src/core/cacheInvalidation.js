/**
 * CACHE INVALIDATION — Mapa de dependências entre eventos e caches.
 * Quando um evento de domínio é emitido, os caches relacionados
 * são limpos automaticamente, garantindo dados frescos entre módulos.
 */

import { EventBus, EVENTS } from "./eventBus.js";
import { actions } from "./store.js";

// Mapa: evento → lista de chaves de cache a invalidar
const CACHE_DEPS = {
  [EVENTS.VENDA_CRIADA]:         ["vendas_resumo", "dashboard"],
  [EVENTS.VENDA_ATUALIZADA]:     ["vendas_resumo", "dashboard"],
  [EVENTS.VENDA_DELETADA]:       ["vendas_resumo", "dashboard"],
  [EVENTS.VENDA_STATUS_MUDOU]:   ["vendas_resumo", "dashboard"],
  [EVENTS.CLIENTE_CRIADO]:       ["clientes", "dashboard"],
  [EVENTS.CLIENTE_ATUALIZADO]:   ["clientes"],
  [EVENTS.CLIENTE_DELETADO]:     ["clientes", "dashboard"],
  [EVENTS.PRODUTO_CRIADO]:       ["produtos"],
  [EVENTS.PRODUTO_ATUALIZADO]:   ["produtos"],
  [EVENTS.PRODUTO_DELETADO]:     ["produtos"],
  [EVENTS.ESTOQUE_ENTRADA]:      ["materiais", "dashboard"],
  [EVENTS.ESTOQUE_SAIDA]:        ["materiais", "dashboard"],
  [EVENTS.ESTOQUE_ZERADO]:       ["materiais", "dashboard"],
  [EVENTS.ESTOQUE_ALERTA_BAIXO]: ["materiais"],
  [EVENTS.LANCAMENTO_CRIADO]:    ["financeiro", "dashboard"],
  [EVENTS.LANCAMENTO_PAGO]:      ["financeiro", "dashboard"],
  [EVENTS.PRODUCAO_CONCLUIDA]:   ["dashboard"],
};

let _initialized = false;

export function initCacheInvalidation() {
  if (_initialized) return;
  _initialized = true;

  // Invalida mês atual e anteriores para o dashboard
  const invalidateDashboard = () => {
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1 - i).padStart(2, "0")}`;
      actions.setCache(`dashboard_${mes}`, null);
    }
  };

  Object.entries(CACHE_DEPS).forEach(([event, cacheKeys]) => {
    EventBus.on(event, () => {
      cacheKeys.forEach(key => {
        if (key === "dashboard") {
          invalidateDashboard();
        } else {
          actions.setCache(key, null);
          // Invalidar chaves com prefixo (ex: vendas_resumo_2025-01)
          actions.setCache(`${key}_*`, null);
        }
      });
    });
  });
}
