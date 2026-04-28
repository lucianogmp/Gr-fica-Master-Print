export function renderLayout(pages) {
  const root = document.getElementById("app");

  // ── Estado persistido ────────────────────────────────────────────────────────
  let sidebarCollapsed = localStorage.getItem("sidebar_collapsed") === "true";
  let isDark = localStorage.getItem("theme") !== "light";

  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

  // ── Metadados das páginas (com ícones Flaticon Uicons) ───────────────────────
  const PAGE_META = {
    dashboard:     { icon: "fi-rr-chart-histogram",  label: "Dashboard"     },
    financeiro:    { icon: "fi-rr-coins",             label: "Financeiro"    },
    orcamento:     { icon: "fi-rr-document",          label: "Orçamentos"    },
    vendas:        { icon: "fi-rr-shopping-cart",     label: "Vendas"        },
    clientes:      { icon: "fi-rr-users",             label: "Clientes"      },
    produtos:      { icon: "fi-rr-box-open",          label: "Produtos"      },
    estoque:       { icon: "fi-rr-warehouse",         label: "Estoque"       },
    producao:      { icon: "fi-rr-print",             label: "Produção"      },
    configuracoes: { icon: "fi-rr-settings",          label: "Configurações" },
  };

  // ── Grupos de navegação ──────────────────────────────────────────────────────
  const NAV_GROUPS = [
    { label: "Visão Geral",  items: ["dashboard"]                       },
    { label: "Comercial",    items: ["orcamento", "vendas", "clientes"] },
    { label: "Operacional",  items: ["producao", "estoque"]             },
    { label: "Gestão",       items: ["financeiro", "produtos"]          },
    { label: "Sistema",      items: ["configuracoes"]                   },
  ];

  // ── HTML do toggle compacto (topo direito) ───────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────────────
  root.innerHTML = `
    <div class="app-shell">

      <!-- Sidebar -->
      <aside class="sidebar ${sidebarCollapsed ? "collapsed" : ""}" id="sidebar">

        <!-- Brand -->
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">
            <i class="fi fi-rr-print"></i>
          </div>
          <div class="sidebar-brand-text">
            <div class="sidebar-brand-name">Master Print</div>
            <div class="sidebar-brand-sub">Gráfica</div>
          </div>
        </div>

        <!-- Nav -->
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

        <!-- Collapse toggle -->
        <div class="sidebar-footer">
          <button class="sidebar-toggle" id="sidebar-toggle">
            <i class="fi ${sidebarCollapsed ? "fi-rr-arrow-right" : "fi-rr-arrow-left"}"></i>
            <span class="sidebar-toggle-label">${sidebarCollapsed ? "" : "Recolher"}</span>
          </button>
        </div>
      </aside>

      <!-- Main -->
      <div class="main">

        <!-- Topbar — só título da página atual -->
        <header class="topbar">
          <div class="topbar-page-title" id="topbar-title">
            <i class="fi fi-rr-chart-histogram"></i>
            <span>Dashboard</span>
          </div>
        </header>

        <!-- Conteúdo -->
        <section class="content" id="content"></section>
      </div>
    </div>

    ${toggleHTML}
  `;

  // ── Referências ──────────────────────────────────────────────────────────────
  const sidebar    = root.querySelector("#sidebar");
  const toggleBtn  = root.querySelector("#sidebar-toggle");
  const themeChk   = root.querySelector("#toggle");
  const content    = root.querySelector("#content");
  const topbarTitle = root.querySelector("#topbar-title");

  // ── Sidebar collapse ─────────────────────────────────────────────────────────
  toggleBtn.addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle("collapsed", sidebarCollapsed);

    const icon = toggleBtn.querySelector("i");
    icon.className = `fi ${sidebarCollapsed ? "fi-rr-arrow-right" : "fi-rr-arrow-left"}`;
    toggleBtn.querySelector(".sidebar-toggle-label").textContent =
      sidebarCollapsed ? "" : "Recolher";

    localStorage.setItem("sidebar_collapsed", sidebarCollapsed);
  });

  // ── Theme toggle ─────────────────────────────────────────────────────────────
  themeChk.addEventListener("change", () => {
    isDark = themeChk.checked;
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  // ── Monta página ─────────────────────────────────────────────────────────────
  function mountPage(key) {
    if (!pages[key]) key = "dashboard";
    const m = PAGE_META[key] || { icon: "fi-rr-apps", label: key };

    content.innerHTML = `<div class="loading">Carregando...</div>`;
    pages[key].mount(content);

    // Atualiza título do topbar
    topbarTitle.innerHTML = `<i class="fi ${m.icon}"></i><span>${m.label}</span>`;

    // Atualiza nav ativo
    root.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.key === key);
    });
  }

  // ── Roteamento por hash ──────────────────────────────────────────────────────
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-key]");
    if (!btn) return;
    window.location.hash = btn.dataset.key;
  });

  const getHash = () => window.location.hash.replace("#", "") || "dashboard";
  mountPage(getHash());
  window.addEventListener("hashchange", () => mountPage(getHash()));
}