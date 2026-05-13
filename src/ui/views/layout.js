/**
 * LAYOUT — Shell da aplicação (sidebar + topbar + content).
 * Reativo ao store: responde a mudanças de tema e sidebar sem re-render completo.
 */

import { store, actions, selectors } from "../../core/store.js";
import { router } from "../../core/router.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";

const NAV_GROUPS = [
  {
    label: "Visão Geral",
    items: [
      { key: "dashboard",   icon: "fi-rr-chart-histogram", label: "Dashboard"       },
    ],
  },
  {
    label: "Comercial",
    items: [
      { key: "orcamento",   icon: "fi-rr-document",         label: "Orçamentos"     },
      { key: "vendas",      icon: "fi-rr-shopping-cart",    label: "Vendas"         },
      { key: "clientes",    icon: "fi-rr-users",            label: "Clientes"       },
    ],
  },
  {
    label: "Gestão",
    items: [
      { key: "financeiro",  icon: "fi-rr-coins",            label: "Financeiro"     },
      { key: "fluxo_caixa", icon: "fi-rr-money-bill-wave",  label: "Fluxo de Caixa"},
    ],
  },
  {
    label: "Operacional",
    items: [
      { key: "producao",    icon: "fi-rr-print",            label: "Produção"       },
      { key: "estoque",     icon: "fi-rr-shelves",          label: "Estoque"        },
      { key: "produtos",    icon: "fi-rr-box-open",         label: "Produtos"       },
    ],
  },
  {
    label: "Sistema",
    items: [
      { key: "gestao_custos", icon: "fi-rr-chart-pie-alt", label: "Gestão de Custos"},
      { key: "configuracoes", icon: "fi-rr-settings",      label: "Configurações"  },
    ],
  },
];

export function renderLayout() {
  const root = document.getElementById("app");
  if (!root) return;

  // Modal root global
  if (!document.getElementById("app-modal-root")) {
    const mr = document.createElement("div");
    mr.id = "app-modal-root";
    document.body.appendChild(mr);
  }

  const appState = selectors.app();
  const collapsed = appState.sidebarCollapsed;
  const isDark    = appState.theme !== "light";

  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

  root.innerHTML = `
    <div class="app-shell">
      <!-- ── SIDEBAR ── -->
      <aside class="sidebar ${collapsed ? "collapsed" : ""}" id="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">
            <i class="fi fi-rr-print"></i>
          </div>
          <div class="sidebar-brand-text">
            <div class="sidebar-brand-name">Master Print</div>
            <div class="sidebar-brand-sub">ERP Gráfica</div>
          </div>
        </div>

        <nav class="sidebar-nav" id="sidebar-nav">
          ${NAV_GROUPS.map(group => `
            <div class="nav-section-label">${group.label}</div>
            ${group.items.map(item => `
              <button class="nav-btn" data-key="${item.key}" title="${item.label}">
                <span class="nav-btn-icon"><i class="fi ${item.icon}"></i></span>
                <span class="nav-btn-label">${item.label}</span>
              </button>
            `).join("")}
          `).join("")}
        </nav>

        <div class="sidebar-footer">
          <button class="sidebar-toggle" id="sidebar-toggle" title="${collapsed ? "Expandir" : "Recolher"} menu">
            <i class="fi ${collapsed ? "fi-rr-arrow-right" : "fi-rr-arrow-left"}"></i>
            <span class="sidebar-toggle-label">${collapsed ? "" : "Recolher"}</span>
          </button>
        </div>
      </aside>

      <!-- ── MAIN ── -->
      <div class="main">
        <header class="topbar">
          <div class="topbar-page-title" id="topbar-title">
            <i class="fi fi-rr-chart-histogram"></i>
            <span>Dashboard</span>
          </div>

          <div class="topbar-right">
            <!-- Theme toggle -->
            <label class="theme-toggle" title="Alternar tema">
              <input type="checkbox" id="theme-toggle-chk" ${isDark ? "checked" : ""} />
              <span class="theme-toggle-track">
                <span class="theme-toggle-thumb"></span>
              </span>
              <span class="theme-toggle-label">${isDark ? "🌙" : "☀️"}</span>
            </label>

            <!-- Alertas rápidos -->
            <button class="topbar-btn" id="btn-alertas" title="Alertas">
              <i class="fi fi-rr-bell"></i>
              <span class="alert-dot" id="alert-dot" style="display:none"></span>
            </button>
          </div>
        </header>

        <section class="content" id="content"></section>
      </div>
    </div>
  `;

  bindLayoutEvents(root);
  watchStoreForAlerts();
}

function bindLayoutEvents(root) {
  // ── Navegação ──
  root.addEventListener("click", e => {
    const btn = e.target.closest("[data-key]");
    if (!btn) return;
    router.navigate(btn.dataset.key);
  });

  // ── Toggle sidebar ──
  const toggleBtn = root.querySelector("#sidebar-toggle");
  toggleBtn?.addEventListener("click", () => {
    actions.toggleSidebar();
    const sidebar  = root.querySelector("#sidebar");
    const appState = selectors.app();
    const collapsed = appState.sidebarCollapsed;
    sidebar.classList.toggle("collapsed", collapsed);
    toggleBtn.querySelector("i").className = `fi ${collapsed ? "fi-rr-arrow-right" : "fi-rr-arrow-left"}`;
    const lbl = toggleBtn.querySelector(".sidebar-toggle-label");
    if (lbl) lbl.textContent = collapsed ? "" : "Recolher";
    toggleBtn.title = collapsed ? "Expandir menu" : "Recolher menu";
  });

  // ── Toggle tema ──
  const themeChk = root.querySelector("#theme-toggle-chk");
  themeChk?.addEventListener("change", () => {
    const isDark = themeChk.checked;
    actions.setTheme(isDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    const lbl = root.querySelector(".theme-toggle-label");
    if (lbl) lbl.textContent = isDark ? "🌙" : "☀️";
  });

  // ── Alertas rápidos ──
  root.querySelector("#btn-alertas")?.addEventListener("click", () => {
    showAlertsPanel();
  });
}

function watchStoreForAlerts() {
  store.subscribe("estoque", (next) => {
    const alertas = next.materias?.filter(m =>
      m.saldo <= 0 || (m.estoque_minimo > 0 && m.saldo <= m.estoque_minimo)
    ) || [];
    const dot = document.getElementById("alert-dot");
    if (dot) dot.style.display = alertas.length ? "block" : "none";
  });
}

function showAlertsPanel() {
  const estoque = selectors.estoque();
  const alertas = estoque.materias?.filter(m =>
    m.saldo <= 0 || (m.estoque_minimo > 0 && m.saldo <= m.estoque_minimo)
  ) || [];

  const lancs = selectors.financeiro().lancamentos || [];
  const hoje = new Date().toISOString().split("T")[0];
  const vencidos = lancs.filter(l => l.status === "pendente" && l.data_vencimento < hoje);

  const root = document.getElementById("app-modal-root");
  if (!root) return;

  root.innerHTML = `
    <div class="modal-overlay" id="alerts-overlay" style="align-items:flex-start;padding-top:60px">
      <div class="modal-panel" style="max-width:400px;margin-right:20px;margin-left:auto">
        <div class="modal-header">
          <h3 class="modal-title">🔔 Alertas</h3>
          <button class="modal-close" id="alerts-close">✕</button>
        </div>
        <div class="modal-body">
          ${vencidos.length === 0 && alertas.length === 0
            ? `<div class="empty-state" style="padding:24px">
                <i class="fi fi-rr-check-circle empty-state-icon" style="color:var(--success)"></i>
                <div class="empty-state-title">Tudo em dia!</div>
               </div>`
            : `
              ${vencidos.length > 0 ? `
                <div style="font-size:12px;font-weight:700;color:var(--error);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">
                  Financeiro Vencido (${vencidos.length})
                </div>
                ${vencidos.slice(0, 4).map(l => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--error-bg);border:1px solid var(--error-border);border-radius:var(--radius-md);margin-bottom:6px;font-size:12px">
                    <span>${l.descricao}</span>
                    <span style="font-weight:700;color:var(--error)">R$ ${Number(l.valor).toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
                  </div>`).join("")}
              ` : ""}
              ${alertas.length > 0 ? `
                <div style="font-size:12px;font-weight:700;color:var(--warning);margin-bottom:8px;margin-top:12px;text-transform:uppercase;letter-spacing:.05em">
                  Estoque em Alerta (${alertas.length})
                </div>
                ${alertas.slice(0, 5).map(m => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--warning-bg);border:1px solid rgba(255,179,0,0.25);border-radius:var(--radius-md);margin-bottom:6px;font-size:12px">
                    <span>${m.nome}</span>
                    <span style="font-weight:700;color:${m.saldo<=0?"var(--error)":"var(--warning)"}">${Number(m.saldo).toFixed(2)} ${m.unidade||"un"}</span>
                  </div>`).join("")}
              ` : ""}
            `}
        </div>
      </div>
    </div>`;

  root.querySelector("#alerts-close")?.addEventListener("click", () => root.innerHTML = "");
  root.querySelector("#alerts-overlay")?.addEventListener("click", e => {
    if (e.target.id === "alerts-overlay") root.innerHTML = "";
  });
}

// ─── CSS extra do layout (complementa styles.css existente) ──────────────────
export function injectLayoutCSS() {
  if (document.getElementById("layout-extra-css")) return;
  const s = document.createElement("style");
  s.id = "layout-extra-css";
  s.textContent = `
  /* Topbar right */
  .topbar-right{display:flex;align-items:center;gap:12px;margin-left:auto}
  .topbar-btn{background:transparent;border:1px solid var(--border);border-radius:var(--radius-md);padding:6px 10px;color:var(--muted);cursor:pointer;font-size:14px;transition:all var(--t);position:relative}
  .topbar-btn:hover{background:var(--panel2);color:var(--text)}
  .alert-dot{position:absolute;top:4px;right:4px;width:8px;height:8px;background:var(--error);border-radius:50%;border:2px solid var(--panel)}

  /* Theme toggle */
  .theme-toggle{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
  .theme-toggle input{display:none}
  .theme-toggle-track{width:38px;height:20px;background:var(--border-md);border-radius:10px;position:relative;transition:background var(--t)}
  .theme-toggle input:checked + .theme-toggle-track{background:var(--primary)}
  .theme-toggle-thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform var(--t);box-shadow:var(--shadow-xs)}
  .theme-toggle input:checked ~ .theme-toggle-track .theme-toggle-thumb,
  .theme-toggle input:checked + .theme-toggle-track .theme-toggle-thumb{transform:translateX(18px)}
  .theme-toggle-label{font-size:14px;line-height:1}
  `;
  document.head.appendChild(s);
}
