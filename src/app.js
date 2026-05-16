/**
 * APP.JS — Ponto de entrada principal do ERP.
 * Inicializa: store, router, serviços, design system e layout.
 */

import { store, actions, selectors } from "./core/store.js";
import { EventBus, EVENTS } from "./core/eventBus.js";
import { router } from "./core/router.js";
import { services } from "./core/services.js";
import { injectDesignSystemCSS, showToast } from "./ui/components/index.js";
import { renderLayout } from "./ui/layout.js";

// ─── Páginas (lazy-loaded via dynamic import) ──────────────────────────────
const PAGES = {
  dashboard:     () => import("./ui/views/dashboard.js").then(m => m.DashboardView),
  vendas:        () => import("./ui/views/vendas.js").then(m => m.VendasView),
  orcamento:     () => import("./ui/views/orcamentos.js").then(m => m.OrcamentosView),
  clientes:      () => import("./ui/views/clientes.js").then(m => m.ClientesView),
  financeiro:    () => import("./ui/views/financeiro.js").then(m => m.FinanceiroView),
  fluxo_caixa:   () => import("./ui/views/fluxo_caixa.js").then(m => m.FluxoCaixaView),
  produtos:      () => import("./ui/views/stub_views.js").then(m => m.ProdutosView),
  estoque:       () => import("./ui/views/estoque.js").then(m => m.EstoqueView),
  producao:      () => import("./ui/views/stub_views.js").then(m => m.ProducaoView),
  gestao_custos: () => import("./ui/views/stub_views.js").then(m => m.GestaoCustosView),
  configuracoes: () => import("./ui/views/stub_views.js").then(m => m.ConfiguracoesView),
};

// View ativa no momento
let currentView = null;

export async function initApp() {
  // 1. Design system CSS
  injectDesignSystemCSS();

  // 2. Layout shell (sidebar + topbar)
  renderLayout();

  // 3. Carregar configurações globais em background
  services.config.carregar().catch(e =>
    console.warn("[App] Não foi possível carregar configurações:", e)
  );

  // 4. Toast global via EventBus
  store.subscribe("app", (next, prev) => {
    if (next.toast && next.toast !== prev.toast) {
      showToast(next.toast.msg, next.toast.tipo);
    }
  });

  // 5. Registrar rotas no router
  Object.entries(PAGES).forEach(([path, loader]) => {
    router.register(path, async (container) => {
      // Desmonta view anterior
      if (currentView) {
        currentView.unmount();
        currentView = null;
      }

      // Spinner enquanto carrega o módulo
      container.innerHTML = `<div class="loading-state">
        <div class="spinner"></div>
        <span>Carregando...</span>
      </div>`;

      try {
        const ViewClass = await loader();
        currentView = new ViewClass();
        await currentView.mount(container);
      } catch (e) {
        console.error(`[Router] Erro ao carregar página "${path}":`, e);
        container.innerHTML = `<div class="empty-state">
          <i class="fi fi-rr-exclamation empty-state-icon" style="color:var(--error)"></i>
          <div class="empty-state-title" style="color:var(--error)">Erro ao carregar página</div>
          <div class="empty-state-subtitle">${e.message}</div>
        </div>`;
      }
    }, { title: path });
  });

  // 6. Sincronizar sidebar e topbar com navegação e montar conteúdo
  EventBus.on(EVENTS.PAGINA_MUDOU, ({ to }) => {
    updateNavActive(to);
    updateTopbarTitle(to);
    const container = document.getElementById("content");
    if (container) router.mount(container);
  });

  // 7. Inicializar router (lê hash atual)
  router.init();
}

// ─── Atualiza link ativo na sidebar ──────────────────────────────────────────
function updateNavActive(page) {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.key === page);
  });
}

// ─── Atualiza título no topbar ────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:     { icon: "fi-rr-chart-histogram",  label: "Dashboard"        },
  vendas:        { icon: "fi-rr-shopping-cart",     label: "Vendas"           },
  orcamento:     { icon: "fi-rr-document",          label: "Orçamentos"       },
  clientes:      { icon: "fi-rr-users",             label: "Clientes"         },
  financeiro:    { icon: "fi-rr-coins",             label: "Financeiro"       },
  fluxo_caixa:   { icon: "fi-rr-money-bill-wave",   label: "Fluxo de Caixa"  },
  produtos:      { icon: "fi-rr-box-open",          label: "Produtos"         },
  estoque:       { icon: "fi-rr-shelves",           label: "Estoque"          },
  producao:      { icon: "fi-rr-print",             label: "Produção"         },
  gestao_custos: { icon: "fi-rr-chart-pie-alt",     label: "Gestão de Custos" },
  configuracoes: { icon: "fi-rr-settings",          label: "Configurações"    },
};

function updateTopbarTitle(page) {
  const meta = PAGE_TITLES[page] || { icon: "fi-rr-apps", label: page };
  const el = document.getElementById("topbar-title");
  if (el) {
    el.innerHTML = `<i class="fi ${meta.icon}"></i><span>${meta.label}</span>`;
  }
}
