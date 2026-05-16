/**
 * LAYOUT — Renderiza o shell da aplicação (sidebar + topbar + content).
 * O roteamento é gerenciado pelo router em app.js.
 */

export function renderLayout() {
  const root = document.getElementById("app");

  if (!document.getElementById("app-modal-root")) {
    const mr = document.createElement("div");
    mr.id = "app-modal-root";
    document.body.appendChild(mr);
  }

  let sidebarCollapsed = localStorage.getItem("sidebar_collapsed") === "true";
  let isDark = localStorage.getItem("theme") !== "light";

  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

  const PAGE_META = {
    dashboard:     { icon: "fi-rr-chart-histogram",  label: "Dashboard"        },
    orcamento:     { icon: "fi-rr-document",          label: "Orçamentos"       },
    vendas:        { icon: "fi-rr-shopping-cart",     label: "Vendas"           },
    clientes:      { icon: "fi-rr-users",             label: "Clientes"         },
    financeiro:    { icon: "fi-rr-coins",             label: "Financeiro"       },
    fluxo_caixa:   { icon: "fi-rr-money-bill-wave",   label: "Fluxo de Caixa"  },
    producao:      { icon: "fi-rr-print",             label: "Produção"         },
    estoque:       { icon: "fi-rr-shelves",           label: "Estoque"          },
    produtos:      { icon: "fi-rr-box-open",          label: "Produtos"         },
    gestao_custos: { icon: "fi-rr-chart-pie-alt",     label: "Gestão de Custos" },
    configuracoes: { icon: "fi-rr-settings",          label: "Configurações"    },
  };

  const NAV_GROUPS = [
    { label: "Visão Geral",  items: ["dashboard"]                           },
    { label: "Comercial",    items: ["orcamento", "vendas", "clientes"]     },
    { label: "Gestão",       items: ["financeiro", "fluxo_caixa"]           },
    { label: "Operacional",  items: ["producao", "estoque", "produtos"]     },
    { label: "Sistema",      items: ["gestao_custos", "configuracoes"]      },
  ];

  const toggleHTML = `
    <div id="theme-toggle-wrapper" title="Alternar tema claro/escuro">
      <label id="theme-toggle-button">
        <input type="checkbox" id="toggle" ${isDark ? "checked" : ""} />
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 69.667 31.333">
          <g>
            <rect id="container" width="69.667" height="31.333" rx="15.667" fill="#87CEEB"/>
            <g id="stars">
              <circle cx="21"  cy="9.5" r="1.5" fill="white" opacity="0.8"/>
              <circle cx="32"  cy="5"   r="1"   fill="white" opacity="0.6"/>
              <circle cx="14"  cy="15"  r="1"   fill="white" opacity="0.7"/>
              <circle cx="44"  cy="8"   r="1.5" fill="white" opacity="0.5"/>
              <circle cx="55"  cy="14"  r="1"   fill="white" opacity="0.8"/>
            </g>
            <g id="patches">
              <circle cx="48" cy="11" r="3.5" fill="#F3D76B"/>
              <circle cx="57" cy="16" r="2.5" fill="#F3D76B"/>
            </g>
            <g id="cloud" transform="translate(28,5)">
              <ellipse cx="14" cy="10" rx="14" ry="8"  fill="white"/>
              <ellipse cx="6"  cy="12" rx="6"  ry="5"  fill="white"/>
              <ellipse cx="22" cy="12" rx="6"  ry="5"  fill="white"/>
            </g>
            <g id="button" transform="translate(2.333,2.333)">
              <circle id="sun" cx="13.333" cy="13.333" r="13.333" fill="#F6C94E"/>
              <g id="sun-rays" fill="#F6C94E" opacity="0.7">
                <rect x="12.333" y="-3"     width="2" height="5" rx="1"/>
                <rect x="12.333" y="24.667" width="2" height="5" rx="1" transform="rotate(180 13.333 13.333)"/>
                <rect x="24.667" y="12.333" width="5" height="2" rx="1"/>
                <rect x="-3"     y="12.333" width="5" height="2" rx="1"/>
              </g>
              <g id="moon">
                <circle cx="13.333" cy="13.333" r="13.333" fill="#BDC3C7"/>
                <circle cx="9"  cy="8"  r="4"   fill="#95A5A6" opacity="0.6"/>
                <circle cx="18" cy="16" r="2.5" fill="#95A5A6" opacity="0.4"/>
                <circle cx="11" cy="18" r="2"   fill="#95A5A6" opacity="0.5"/>
              </g>
            </g>
          </g>
        </svg>
      </label>
    </div>
  `;

  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar ${sidebarCollapsed ? "collapsed" : ""}" id="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon"><i class="fi fi-rr-print"></i></div>
          <div class="sidebar-brand-text">
            <div class="sidebar-brand-name">Master Print</div>
            <div class="sidebar-brand-sub">Gráfica</div>
          </div>
        </div>

        <nav class="sidebar-nav" id="sidebar-nav">
          ${NAV_GROUPS.map(group => `
            <div class="nav-section-label">${group.label}</div>
            ${group.items.map(key => {
              const m = PAGE_META[key] || { icon: "fi-rr-apps", label: key };
              return `
                <button class="nav-btn" data-key="${key}" title="${m.label}">
                  <span class="nav-btn-icon"><i class="fi ${m.icon}"></i></span>
                  <span class="nav-btn-label">${m.label}</span>
                </button>`;
            }).join("")}
          `).join("")}
        </nav>

        <div class="sidebar-footer">
          <button class="sidebar-toggle" id="sidebar-toggle">
            <i class="fi ${sidebarCollapsed ? "fi-rr-arrow-right" : "fi-rr-arrow-left"}"></i>
            <span class="sidebar-toggle-label">${sidebarCollapsed ? "" : "Recolher"}</span>
          </button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="topbar-page-title" id="topbar-title">
            <i class="fi fi-rr-chart-histogram"></i>
            <span>Dashboard</span>
          </div>
        </header>
        <section class="content" id="content"></section>
      </div>
    </div>
    ${toggleHTML}
  `;

  // Sidebar toggle
  const sidebar   = root.querySelector("#sidebar");
  const toggleBtn = root.querySelector("#sidebar-toggle");
  toggleBtn.addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle("collapsed", sidebarCollapsed);
    toggleBtn.querySelector("i").className =
      `fi ${sidebarCollapsed ? "fi-rr-arrow-right" : "fi-rr-arrow-left"}`;
    toggleBtn.querySelector(".sidebar-toggle-label").textContent =
      sidebarCollapsed ? "" : "Recolher";
    localStorage.setItem("sidebar_collapsed", sidebarCollapsed);
  });

  // Theme toggle
  const themeChk = root.querySelector("#toggle");
  themeChk.addEventListener("change", () => {
    isDark = themeChk.checked;
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  // Navegação pela sidebar → delega ao router via hash
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-key]");
    if (!btn) return;
    window.location.hash = btn.dataset.key;
  });
}
