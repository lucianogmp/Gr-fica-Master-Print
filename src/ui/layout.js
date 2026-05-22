/**
 * LAYOUT.JS — Shell principal: sidebar, topbar e área de conteúdo.
 * Usa esc() centralizado. Inclui botão de logout e exibição do usuário logado.
 */

import { router }            from "../core/router.js";
import { EventBus, EVENTS }  from "../core/eventBus.js";
import { auth }              from "../core/auth.js";
import { esc }               from "../utils/sanitize.js";

// ─── Navegação ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: "dashboard",     icon: "fi-rr-chart-histogram",  label: "Dashboard"        },
  { key: "vendas",        icon: "fi-rr-shopping-cart",     label: "Vendas"           },
  { key: "orcamento",     icon: "fi-rr-document",          label: "Orçamentos"       },
  { key: "clientes",      icon: "fi-rr-users",             label: "Clientes"         },
  { key: "financeiro",    icon: "fi-rr-coins",             label: "Financeiro"       },
  { key: "fluxo_caixa",   icon: "fi-rr-money-bill-wave",   label: "Fluxo de Caixa"  },
  { key: "produtos",      icon: "fi-rr-box-open",          label: "Produtos"         },
  { key: "estoque",       icon: "fi-rr-shelves",           label: "Estoque"          },
  { key: "producao",      icon: "fi-rr-print",             label: "Produção"         },
  { key: "gestao_custos", icon: "fi-rr-chart-pie-alt",     label: "Gestão de Custos" },
  { key: "configuracoes", icon: "fi-rr-settings",          label: "Configurações"    },
];

// ─── Render ───────────────────────────────────────────────────────────────────
export function renderLayout() {
  document.body.innerHTML = `
    <div class="app-shell">

      <!-- SIDEBAR -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <div class="logo-mark">
            <i class="fi fi-rr-print"></i>
          </div>
          <div class="logo-text">
            <span class="logo-name">Master Print</span>
            <span class="logo-sub">ERP Gráfica</span>
          </div>
        </div>

        <nav class="sidebar-nav" id="sidebar-nav">
          ${NAV_ITEMS.map(item => `
            <button
              class="nav-btn"
              data-key="${esc(item.key)}"
              title="${esc(item.label)}"
              aria-label="${esc(item.label)}"
            >
              <i class="fi ${esc(item.icon)} nav-icon"></i>
              <span class="nav-label">${esc(item.label)}</span>
            </button>`).join("")}
        </nav>

        <div class="sidebar-footer">
          <button class="nav-btn theme-btn" id="btn-theme" title="Alternar tema" aria-label="Alternar tema">
            <i class="fi fi-rr-moon nav-icon"></i>
            <span class="nav-label">Tema</span>
          </button>
          <button class="nav-btn logout-btn" id="btn-logout" title="Sair" aria-label="Sair do sistema">
            <i class="fi fi-rr-sign-out nav-icon"></i>
            <span class="nav-label">Sair</span>
          </button>
        </div>
      </aside>

      <!-- OVERLAY mobile -->
      <div class="sidebar-overlay" id="sidebar-overlay"></div>

      <!-- MAIN -->
      <div class="main-wrap">

        <!-- TOPBAR -->
        <header class="topbar" id="topbar">
          <div class="topbar-left">
            <button class="btn-hamburger" id="btn-hamburger" aria-label="Menu">
              <i class="fi fi-rr-menu-burger"></i>
            </button>
            <div class="topbar-title" id="topbar-title">
              <i class="fi fi-rr-chart-histogram"></i>
              <span>Dashboard</span>
            </div>
          </div>
          <div class="topbar-right" id="topbar-right">
            <button class="topbar-icon-btn" id="btn-notif" title="Alertas de estoque" aria-label="Alertas">
              <i class="fi fi-rr-bell"></i>
              <span class="notif-badge" id="notif-badge" style="display:none">0</span>
            </button>
            <div class="topbar-user" id="topbar-user" title="Usuário logado">
              <div class="user-avatar" id="user-avatar" aria-hidden="true">G</div>
              <span class="user-name" id="user-name">Gráfica</span>
            </div>
          </div>
        </header>

        <!-- CONTENT -->
        <main class="content-area" id="content" role="main">
          <div class="loading-state">
            <div class="spinner"></div>
            <span>Inicializando...</span>
          </div>
        </main>

      </div>
    </div>`;

  _bindNav();
  _bindTheme();
  _bindMobile();
  _bindLogout();
  _initTheme();
}

// ─── Helpers públicos ─────────────────────────────────────────────────────────

/** Atualiza nav ativa. */
export function setActiveNav(key) {
  document.querySelectorAll(".nav-btn[data-key]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.key === key);
    btn.setAttribute("aria-current", btn.dataset.key === key ? "page" : "false");
  });
}

/** Atualiza título na topbar. */
export function setTopbarTitle(key) {
  const item  = NAV_ITEMS.find(n => n.key === key);
  const icon  = item?.icon  || "fi-rr-apps";
  const label = item?.label || esc(key);
  const el    = document.getElementById("topbar-title");
  if (el) el.innerHTML = `<i class="fi ${esc(icon)}"></i><span>${esc(label)}</span>`;
}

/** Exibe badge de notificação no sino. */
export function setNotifBadge(count) {
  const badge = document.getElementById("notif-badge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent  = count > 99 ? "99+" : String(count);
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

/**
 * Atualiza avatar e nome do usuário logado na topbar e no footer da sidebar.
 * @param {string} emailOrNome — e-mail ou nome do usuário
 */
export function setUserInfo(emailOrNome) {
  const nome    = emailOrNome?.split("@")[0] ?? "Usuário";
  const inicial = nome.charAt(0).toUpperCase();

  const avatar  = document.getElementById("user-avatar");
  const nameEl  = document.getElementById("user-name");
  if (avatar) avatar.textContent = inicial;
  if (nameEl)  nameEl.textContent = nome;
}

// ─── Navegação ────────────────────────────────────────────────────────────────
function _bindNav() {
  document.getElementById("sidebar-nav")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-key]");
    if (!btn) return;
    router.navigate(btn.dataset.key);
    _closeMobileSidebar();
    EventBus.emit(EVENTS.PAGINA_MUDOU, { to: btn.dataset.key });
  });
}

// ─── Logout ───────────────────────────────────────────────────────────────────
function _bindLogout() {
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-logout");
    if (btn) btn.style.opacity = "0.5";
    try {
      await auth.signOut();
      // EVENTS_AUTH.SIGNED_OUT → app.js vai chamar renderLogin()
    } catch (e) {
      console.error("[Layout] Erro ao sair:", e);
      if (btn) btn.style.opacity = "";
    }
  });
}

// ─── Tema ─────────────────────────────────────────────────────────────────────
function _initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  _applyTheme(saved);
}

function _bindTheme() {
  document.getElementById("btn-theme")?.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "dark";
    const next    = current === "dark" ? "light" : "dark";
    _applyTheme(next);
    localStorage.setItem("theme", next);
  });
}

function _applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn  = document.getElementById("btn-theme");
  const icon = btn?.querySelector("i");
  const lbl  = btn?.querySelector(".nav-label");
  if (icon) icon.className = `fi ${theme === "dark" ? "fi-rr-sun" : "fi-rr-moon"} nav-icon`;
  if (lbl)  lbl.textContent = theme === "dark" ? "Claro" : "Escuro";
}

// ─── Mobile ───────────────────────────────────────────────────────────────────
function _bindMobile() {
  document.getElementById("btn-hamburger")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("open");
    document.getElementById("sidebar-overlay")?.classList.toggle("show");
  });
  document.getElementById("sidebar-overlay")?.addEventListener("click", _closeMobileSidebar);
}

function _closeMobileSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.remove("show");
}
