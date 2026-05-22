/**
 * APP.JS — Ponto de entrada principal do ERP.
 * Inicializa: auth → layout → router → services → cache invalidation.
 */

import { store }                   from "./core/store.js";
import { EventBus, EVENTS }        from "./core/eventBus.js";
import { router }                  from "./core/router.js";
import { services }                from "./core/services.js";
import { auth, EVENTS_AUTH }       from "./core/auth.js";
import { initCacheInvalidation }   from "./core/cacheInvalidation.js";
import { injectDesignSystemCSS, showToast } from "./ui/components/index.js";
import {
  renderLayout, setActiveNav, setTopbarTitle,
  setNotifBadge, setUserInfo,
} from "./ui/layout.js";
import { renderLogin } from "./ui/login.js";

// ─── Páginas (lazy-loaded via dynamic import) ─────────────────────────────────
const PAGES = {
  dashboard:     () => import("./ui/views/dashboard.js"   ).then(m => m.DashboardView),
  vendas:        () => import("./ui/views/vendas.js"       ).then(m => m.VendasView),
  orcamento:     () => import("./ui/views/orcamentos.js"   ).then(m => m.OrcamentosView),
  clientes:      () => import("./ui/views/clientes.js"     ).then(m => m.ClientesView),
  financeiro:    () => import("./ui/views/financeiro.js"   ).then(m => m.FinanceiroView),
  fluxo_caixa:   () => import("./ui/views/fluxo_caixa.js" ).then(m => m.FluxoCaixaView),
  produtos:      () => import("./ui/views/produtos.js"     ).then(m => m.ProdutosView),
  estoque:       () => import("./ui/views/estoque.js"      ).then(m => m.EstoqueView),
  producao:      () => import("./ui/views/stub_views.js"   ).then(m => m.ProducaoView),
  gestao_custos: () => import("./ui/views/gestao_custos.js").then(m => m.GestaoCustosView),
  configuracoes: () => import("./ui/views/configuracoes.js").then(m => m.ConfiguracoesView),
};

let currentView = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────
export async function initApp() {
  injectDesignSystemCSS();

  // Aguarda o Supabase Auth resolver a sessão antes de qualquer render
  const user = await auth.waitReady();

  if (!user) {
    // Sem sessão → tela de login
    _renderLoginScreen();
  } else {
    // Com sessão → app completo
    await _renderApp(user);
  }

  // Escuta mudanças de auth em tempo real (login/logout em outra aba, expiração)
  EventBus.on(EVENTS_AUTH.SIGNED_IN,  ({ user }) => _renderApp(user));
  EventBus.on(EVENTS_AUTH.SIGNED_OUT, ()         => _renderLoginScreen());
}

// ─── Render login ─────────────────────────────────────────────────────────────
function _renderLoginScreen() {
  if (currentView) { currentView.unmount(); currentView = null; }
  renderLogin();
}

// ─── Render app ───────────────────────────────────────────────────────────────
async function _renderApp(user) {
  // Monta o shell (sidebar + topbar + área de conteúdo)
  renderLayout();

  // Exibe nome/email do usuário logado na topbar
  setUserInfo(user?.email ?? "Usuário");

  // Cache invalidation automático entre módulos
  initCacheInvalidation();

  // Configurações globais em background
  services.config?.carregar?.().catch(e =>
    console.warn("[App] Não foi possível carregar configurações:", e)
  );

  // Toast global via store
  store.subscribe("app", (next, prev) => {
    if (next.toast && next.toast !== prev.toast) {
      showToast(next.toast.msg, next.toast.tipo);
    }
  });

  // Badge de alertas de estoque no sino
  _initEstoqueAlerts();

  // Registrar rotas
  Object.entries(PAGES).forEach(([path, loader]) => {
    router.register(path, async (container) => {
      if (currentView) { currentView.unmount(); currentView = null; }
      container.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Carregando...</span>
        </div>`;
      try {
        const ViewClass = await loader();
        currentView = new ViewClass();
        await currentView.mount(container);
      } catch (e) {
        console.error(`[Router] Erro ao carregar "${path}":`, e);
        container.innerHTML = `
          <div class="empty-state">
            <i class="fi fi-rr-exclamation empty-state-icon" style="color:var(--error)"></i>
            <div class="empty-state-title" style="color:var(--error)">Erro ao carregar página</div>
            <div class="empty-state-subtitle">${e.message}</div>
          </div>`;
      }
    }, { title: path });
  });

  // Sincroniza sidebar + topbar na navegação
  EventBus.on(EVENTS.PAGINA_MUDOU, ({ to }) => {
    setActiveNav(to);
    setTopbarTitle(to);
    const container = document.getElementById("content");
    if (container) router.mount(container);
  });

  // Inicia router (navega para rota padrão)
  router.init();
}

// ─── Badge de alertas de estoque ─────────────────────────────────────────────
async function _initEstoqueAlerts() {
  const _update = async () => {
    try {
      const mats = await services.estoque.listarMateriais();
      const alertas = (mats || []).filter(m =>
        Number(m.saldo) <= 0 ||
        (m.estoque_minimo && Number(m.saldo) <= Number(m.estoque_minimo))
      );
      setNotifBadge(alertas.length);
    } catch { /* silencioso */ }
  };
  await _update();
  EventBus.on(EVENTS.ESTOQUE_ENTRADA, _update);
  EventBus.on(EVENTS.ESTOQUE_SAIDA,   _update);
}
