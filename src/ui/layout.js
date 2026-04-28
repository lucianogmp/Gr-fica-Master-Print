export function renderLayout(pages) {
  const root = document.getElementById("app");

  // Recupera estado do sidebar do localStorage
  let sidebarCollapsed = localStorage.getItem("sidebar_collapsed") === "true";

  const NAV_GROUPS = [
    {
      label: "Visão Geral",
      items: ["dashboard"],
    },
    {
      label: "Comercial",
      items: ["orcamento", "vendas", "clientes"],
    },
    {
      label: "Operacional",
      items: ["producao", "estoque"],
    },
    {
      label: "Gestão",
      items: ["financeiro", "produtos"],
    },
    {
      label: "Sistema",
      items: ["configuracoes"],
    },
  ];

  const PAGE_META = {
    dashboard:     { icon: "📊", label: "Dashboard"     },
    financeiro:    { icon: "💰", label: "Financeiro"     },
    orcamento:     { icon: "📋", label: "Orçamentos"     },
    vendas:        { icon: "🛒", label: "Vendas"         },
    clientes:      { icon: "👥", label: "Clientes"       },
    produtos:      { icon: "📦", label: "Produtos"       },
    estoque:       { icon: "🗄️", label: "Estoque"        },
    producao:      { icon: "🖨️", label: "Produção"       },
    configuracoes: { icon: "⚙️", label: "Configurações"  },
  };

  root.innerHTML = `
    <div class="app-shell">
      <!-- Sidebar -->
      <aside class="sidebar ${sidebarCollapsed ? "collapsed" : ""}" id="sidebar">

        <!-- Brand -->
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">🖨️</div>
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
              const meta = PAGE_META[key] || { icon: "•", label: key };
              return `
                <button class="nav-btn" data-key="${key}" title="${meta.label}">
                  <span class="nav-btn-icon">${meta.icon}</span>
                  <span class="nav-btn-label">${meta.label}</span>
                </button>
              `;
            }).join("")}
          `).join("")}
        </nav>

        <!-- Footer / Toggle -->
        <div class="sidebar-footer">
          <button class="sidebar-toggle" id="sidebar-toggle">
            <span id="toggle-icon">${sidebarCollapsed ? "→" : "←"}</span>
            <span class="sidebar-toggle-label">${sidebarCollapsed ? "" : "Recolher"}</span>
          </button>
        </div>
      </aside>

      <!-- Main -->
      <div class="main">
        <!-- Topbar com tabs -->
        <header class="topbar">
          <div class="topbar-tabs" id="tabs">
            ${Object.entries(PAGE_META).map(([key, meta]) => `
              <button class="tab-btn" data-key="${key}">${meta.icon} ${meta.label}</button>
            `).join("")}
          </div>
        </header>

        <!-- Page content -->
        <section class="content" id="content"></section>
      </div>
    </div>
  `;

  const sidebar     = root.querySelector("#sidebar");
  const toggleBtn   = root.querySelector("#sidebar-toggle");
  const toggleIcon  = root.querySelector("#toggle-icon");
  const content     = root.querySelector("#content");

  // ── Toggle sidebar ──────────────────────────────────────────────────────────
  toggleBtn.addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle("collapsed", sidebarCollapsed);
    toggleIcon.textContent = sidebarCollapsed ? "→" : "←";
    toggleBtn.querySelector(".sidebar-toggle-label").textContent = sidebarCollapsed ? "" : "Recolher";
    localStorage.setItem("sidebar_collapsed", sidebarCollapsed);
  });

  // ── Monta página ────────────────────────────────────────────────────────────
  function mountPage(key) {
    if (!pages[key]) key = "dashboard";

    content.innerHTML = `<div class="loading">Carregando...</div>`;
    pages[key].mount(content);

    // Atualiza nav buttons ativos
    root.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.key === key);
    });

    // Atualiza tabs ativos
    root.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.key === key);
    });
  }

  // ── Click em qualquer [data-key] ────────────────────────────────────────────
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-key]");
    if (!btn) return;
    window.location.hash = btn.dataset.key;
  });

  // ── Roteamento por hash ─────────────────────────────────────────────────────
  const getHash = () => window.location.hash.replace("#", "") || "dashboard";

  mountPage(getHash());

  window.addEventListener("hashchange", () => mountPage(getHash()));
}