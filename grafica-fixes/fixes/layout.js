/**
 * LAYOUT.JS — Shell principal: sidebar, topbar e área de conteúdo.
 * Corrigido: ícones, avatar, badge notificação, tema claro/escuro sem bug,
 * suporte a logo personalizada, mobile hamburger.
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
  // Garante que o tema salvo é aplicado ANTES de renderizar
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = savedTheme;

  // Logo salva pelo usuário
  const savedLogo = localStorage.getItem("empresa_logo_url") || "";
  const logoHtml  = savedLogo
    ? `<img src="${esc(savedLogo)}" class="sidebar-logo-img" id="sidebar-logo-img" alt="Logo" />`
    : `<div class="sidebar-brand-icon" id="sidebar-brand-icon"><i class="fi fi-rr-print"></i></div>`;

  document.body.innerHTML = `
    <div class="app-shell">

      <!-- SIDEBAR -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          ${logoHtml}
          <div class="sidebar-brand-text">
            <span class="sidebar-brand-name" id="sidebar-empresa-nome">Master Print</span>
            <span class="sidebar-brand-sub">ERP Gráfica</span>
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
              <span class="nav-btn-icon"><i class="fi ${esc(item.icon)}"></i></span>
              <span class="nav-btn-label">${esc(item.label)}</span>
            </button>`).join("")}
        </nav>

        <div class="sidebar-footer">
          <button class="nav-btn theme-btn" id="btn-theme" title="Alternar tema">
            <span class="nav-btn-icon"><i class="fi ${savedTheme === "dark" ? "fi-rr-sun" : "fi-rr-moon"}" id="theme-icon"></i></span>
            <span class="nav-btn-label" id="theme-label">${savedTheme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
          </button>
          <button class="nav-btn logout-btn" id="btn-logout" title="Sair" aria-label="Sair do sistema">
            <span class="nav-btn-icon"><i class="fi fi-rr-sign-out"></i></span>
            <span class="nav-btn-label">Sair</span>
          </button>
        </div>
      </aside>

      <!-- OVERLAY mobile -->
      <div class="sidebar-overlay" id="sidebar-overlay"></div>

      <!-- MAIN -->
      <div class="main-wrap">

        <!-- TOPBAR -->
        <header class="topbar" id="topbar">
          <button class="btn-hamburger" id="btn-hamburger" aria-label="Menu">
            <i class="fi fi-rr-menu-burger"></i>
          </button>

          <div class="topbar-page-title" id="topbar-title">
            <i class="fi fi-rr-chart-histogram"></i>
            <span>Dashboard</span>
          </div>

          <div class="topbar-right" id="topbar-right">
            <!-- Sino de alertas -->
            <button class="topbar-icon-btn" id="btn-notif" title="Alertas" aria-label="Alertas de estoque">
              <i class="fi fi-rr-bell"></i>
              <span class="notif-badge" id="notif-badge" style="display:none">0</span>
            </button>

            <!-- Usuário logado -->
            <div class="topbar-user" id="topbar-user" title="Usuário logado">
              <div class="user-avatar" id="user-avatar" aria-hidden="true">
                <span id="user-initial">G</span>
              </div>
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
  _loadSavedConfig();
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
    badge.textContent   = count > 99 ? "99+" : String(count);
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

/**
 * Atualiza avatar e nome do usuário logado na topbar.
 * @param {string} emailOrNome
 */
export function setUserInfo(emailOrNome) {
  const nome    = emailOrNome?.split("@")[0] ?? "Usuário";
  const inicial = nome.charAt(0).toUpperCase();

  const avatarSpan = document.getElementById("user-initial");
  const nameEl     = document.getElementById("user-name");
  if (avatarSpan) avatarSpan.textContent = inicial;
  if (nameEl)     nameEl.textContent     = nome;
}

/**
 * Atualiza a logo da sidebar.
 * Chamada pela aba de configurações ao salvar nova logo.
 */
export function updateSidebarLogo(logoUrl, nomeEmpresa) {
  const iconEl = document.getElementById("sidebar-brand-icon");
  const imgEl  = document.getElementById("sidebar-logo-img");
  const nomeEl = document.getElementById("sidebar-empresa-nome");

  if (nomeEmpresa && nomeEl) nomeEl.textContent = nomeEmpresa;

  if (logoUrl) {
    localStorage.setItem("empresa_logo_url", logoUrl);
    if (iconEl) iconEl.style.display = "none";
    if (imgEl) {
      imgEl.src          = logoUrl;
      imgEl.style.display = "block";
    } else {
      // Cria o elemento de imagem se não existir
      const brand = document.querySelector(".sidebar-brand");
      if (brand) {
        const img = document.createElement("img");
        img.src           = logoUrl;
        img.id            = "sidebar-logo-img";
        img.className     = "sidebar-logo-img";
        img.alt           = "Logo";
        img.style.display = "block";
        brand.insertBefore(img, brand.firstChild);
        if (iconEl) iconEl.style.display = "none";
      }
    }
  } else {
    localStorage.removeItem("empresa_logo_url");
    if (iconEl) iconEl.style.display = "flex";
    if (imgEl)  imgEl.style.display  = "none";
  }
}

// ─── Navegação ────────────────────────────────────────────────────────────────
function _bindNav() {
  document.getElementById("sidebar-nav")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-key]");
    if (!btn) return;
    router.navigate(btn.dataset.key);
    _closeMobileSidebar();
  });
}

// ─── Logout ───────────────────────────────────────────────────────────────────
function _bindLogout() {
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-logout");
    if (btn) btn.style.opacity = "0.5";
    try {
      await auth.signOut();
    } catch (e) {
      console.error("[Layout] Erro ao sair:", e);
      if (btn) btn.style.opacity = "";
    }
  });
}

// ─── Tema ─────────────────────────────────────────────────────────────────────
function _bindTheme() {
  document.getElementById("btn-theme")?.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "dark";
    const next    = current === "dark" ? "light" : "dark";
    _applyTheme(next);
    localStorage.setItem("theme", next);
  });
}

function _applyTheme(theme) {
  // Aplica o atributo no root — sem recarregar HTML
  document.documentElement.dataset.theme = theme;

  const icon = document.getElementById("theme-icon");
  const lbl  = document.getElementById("theme-label");

  if (icon) icon.className = `fi ${theme === "dark" ? "fi-rr-sun" : "fi-rr-moon"}`;
  if (lbl)  lbl.textContent = theme === "dark" ? "Modo Claro" : "Modo Escuro";
}

// ─── Carregar config salva (logo, nome) ───────────────────────────────────────
function _loadSavedConfig() {
  const logo = localStorage.getItem("empresa_logo_url");
  const nome = localStorage.getItem("empresa_nome");

  if (logo) updateSidebarLogo(logo, nome);
  else if (nome) {
    const nomeEl = document.getElementById("sidebar-empresa-nome");
    if (nomeEl) nomeEl.textContent = nome;
  }
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
