/**
 * LAYOUT (views/layout.js) — CSS extra do layout + shell alternativo.
 * Não conflita com ui/layout.js.
 * injectLayoutCSS() injeta apenas o que falta no styles.css.
 */

import { store, actions, selectors } from "../../core/store.js";
import { router } from "../../core/router.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";

const NAV_GROUPS = [
  {
    label: "Visão Geral",
    items: [
      { key: "dashboard",   icon: "fi-rr-chart-histogram", label: "Dashboard" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { key: "orcamento",   icon: "fi-rr-document",        label: "Orçamentos"     },
      { key: "vendas",      icon: "fi-rr-shopping-cart",   label: "Vendas"         },
      { key: "clientes",    icon: "fi-rr-users",           label: "Clientes"       },
    ],
  },
  {
    label: "Gestão",
    items: [
      { key: "financeiro",  icon: "fi-rr-coins",           label: "Financeiro"     },
      { key: "fluxo_caixa", icon: "fi-rr-money-bill-wave", label: "Fluxo de Caixa" },
    ],
  },
  {
    label: "Operacional",
    items: [
      { key: "producao",    icon: "fi-rr-print",           label: "Produção"       },
      { key: "estoque",     icon: "fi-rr-shelves",         label: "Estoque"        },
      { key: "produtos",    icon: "fi-rr-box-open",        label: "Produtos"       },
    ],
  },
  {
    label: "Sistema",
    items: [
      { key: "gestao_custos", icon: "fi-rr-chart-pie-alt", label: "Gestão de Custos" },
      { key: "configuracoes", icon: "fi-rr-settings",      label: "Configurações"    },
    ],
  },
];

/**
 * renderLayout() usado pelo app.js via ui/layout.js principal.
 * Esta versão apenas expõe injectLayoutCSS() para o main.js.
 */
export function renderLayout() {
  // Não faz nada — o render real é feito pelo ui/layout.js
  // Mantido para compatibilidade com imports existentes
}

/**
 * Injeta apenas CSS auxiliar que complementa styles.css.
 * Não duplica variáveis nem redefine componentes já existentes.
 */
export function injectLayoutCSS() {
  if (document.getElementById("layout-extra-css")) return;
  const s = document.createElement("style");
  s.id = "layout-extra-css";
  s.textContent = `
    /* Utilitários extras que complementam styles.css */
    .clickable { cursor: pointer; }
    .clickable:hover td { background: var(--primary-bg) !important; }

    /* Sort icons na tabela */
    .data-table th.sort-asc  .sort-icon::before { content: "↑"; }
    .data-table th.sort-desc .sort-icon::before { content: "↓"; }

    /* Loading view (páginas) */
    .loading-view {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      gap: 14px;
      color: var(--muted);
      font-size: 13px;
    }
    .loading-view i {
      font-size: 32px;
      opacity: .3;
    }

    /* Row alt em tabelas com striped */
    .row-alt td { background: rgba(255,255,255,0.015); }
    [data-theme="light"] .row-alt td { background: rgba(0,0,0,0.015); }

    /* Btn ghost */
    .btn-ghost,
    .btn.btn-ghost {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid var(--border-md);
      color: var(--text-sub);
      border-radius: var(--radius-md);
      padding: 7px 13px;
      font-family: var(--font);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--t);
      white-space: nowrap;
    }
    .btn-ghost:hover,
    .btn.btn-ghost:hover {
      background: var(--panel3);
      color: var(--text);
    }

    /* Topbar claro — borda e sombra */
    [data-theme="light"] #topbar {
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
  `;
  document.head.appendChild(s);
}
