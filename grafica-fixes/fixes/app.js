/**
 * APP.JS — Ponto de entrada principal do ERP.
 * Corrigido: carrega logo e nome da empresa ao inicializar.
 */

import { store }                      from "./core/store.js";
import { EventBus, EVENTS }           from "./core/eventBus.js";
import { router }                     from "./core/router.js";
import { services }                   from "./core/services.js";
import { auth, EVENTS_AUTH }          from "./core/auth.js";
import { initCacheInvalidation }      from "./core/cacheInvalidation.js";
import { injectDesignSystemCSS, showToast } from "./ui/components/index.js";
import {
  renderLayout, setActiveNav, setTopbarTitle,
  setNotifBadge, setUserInfo, updateSidebarLogo,
} from "./ui/layout.js";
import { renderLogin } from "./ui/login.js";

// ─── Páginas (lazy-loaded via dynamic import) ─────────────────────────────────
const PAGES = {
  dashboard:     () => import("./ui/views/dashboard.js"    ).then(m => m.DashboardView),
  vendas:        () => import("./ui/views/vendas.js"        ).then(m => m.VendasView),
  orcamento:     () => import("./ui/views/orcamentos.js"    ).then(m => m.OrcamentosView),
  clientes:      () => import("./ui/views/clientes.js"      ).then(m => m.ClientesView),
  financeiro:    () => import("./ui/views/financeiro.js"    ).then(m => m.FinanceiroView),
  fluxo_caixa:   () => import("./ui/views/fluxo_caixa.js"  ).then(m => m.FluxoCaixaView),
  produtos:      () => import("./ui/views/produtos.js"      ).then(m => m.ProdutosView),
  estoque:       () => import("./ui/views/estoque.js"       ).then(m => m.EstoqueView),
  producao:      () => import("./ui/views/stub_views.js"    ).then(m => m.ProducaoView),
  gestao_custos: () => import("./ui/views/gestao_custos.js" ).then(m => m.GestaoCustosView),
  configuracoes: () => import("./ui/views/configuracoes.js" ).then(m => m.ConfiguracoesView),
};

let currentView = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────
export async function initApp() {
  // Aplica tema salvo ANTES de qualquer render (evita flash)
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = savedTheme;

  injectDesignSystemCSS();

  const user = await auth.waitReady();

  if (!user) {
    _renderLoginScreen();
  } else {
    await _renderApp(user);
  }

  EventBus.on(EVENTS_AUTH.SIGNED_IN,  ({ user }) => _renderApp(user));
  EventBus.on(EVENTS_AUTH.SIGNED_OUT, ()         => _renderLoginScreen());
}

// ─── Render login ─────────────────────────────────────────────────────────────
function _renderLoginScreen() {
  if (currentView) { currentView.unmount?.(); currentView = null; }
  renderLogin();
}

// ─── Render app ───────────────────────────────────────────────────────────────
async function _renderApp(user) {
  // 1. Monta o shell (sidebar + topbar + área de conteúdo)
  renderLayout();

  // 2. Exibe nome/email do usuário logado
  setUserInfo(user?.email ?? "Usuário");

  // 3. Carrega configurações da empresa em background
  //    e atualiza sidebar logo + nome se houver dados no Supabase
  _carregarConfigEmpresa();

  // 4. Cache invalidation automático entre módulos
  initCacheInvalidation();

  // 5. Toast global via store
  store.subscribe("app", (next, prev) => {
    if (next.toast && next.toast !== prev.toast) {
      showToast(next.toast.msg, next.toast.tipo);
    }
  });

  // 6. Badge de alertas de estoque no sino
  _initEstoqueAlerts();

  // 7. Registrar rotas
  Object.entries(PAGES).forEach(([path, loader]) => {
    router.register(path, async (container) => {
      if (currentView) { currentView.unmount?.(); currentView = null; }
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

  // 8. Sincroniza sidebar + topbar na navegação
  EventBus.on(EVENTS.PAGINA_MUDOU, ({ to }) => {
    setActiveNav(to);
    setTopbarTitle(to);
    const container = document.getElementById("content");
    if (container) router.mount(container);
  });

  // 9. Inicia router
  router.init();
}

// ─── Carregar configurações da empresa ───────────────────────────────────────
async function _carregarConfigEmpresa() {
  try {
    const cfg = await services.config?.carregar?.();
    if (!cfg) return;

    const empresa = cfg.empresa || {};

    // Atualiza nome da empresa na sidebar (se veio do banco e não está no localStorage)
    const nomeLocal = localStorage.getItem("empresa_nome");
    const nomeBanco = empresa.empresa_nome;
    if (nomeBanco && !nomeLocal) {
      localStorage.setItem("empresa_nome", nomeBanco);
      const nomeEl = document.getElementById("sidebar-empresa-nome");
      if (nomeEl) nomeEl.textContent = nomeBanco;
    } else if (nomeLocal) {
      const nomeEl = document.getElementById("sidebar-empresa-nome");
      if (nomeEl) nomeEl.textContent = nomeLocal;
    }

    // Atualiza logo (prioridade: localStorage > banco)
    const logoLocal = localStorage.getItem("empresa_logo_url");
    const logoBanco = empresa.empresa_logo_url;
    if (!logoLocal && logoBanco) {
      // Salva no localStorage e aplica
      localStorage.setItem("empresa_logo_url", logoBanco);
      updateSidebarLogo(logoBanco, nomeBanco || nomeLocal);
    } else if (logoLocal) {
      updateSidebarLogo(logoLocal, nomeBanco || nomeLocal);
    }
  } catch (e) {
    // Silencioso — não bloqueia o app se a config falhar
    console.warn("[App] Não foi possível carregar configurações:", e);
  }
}

// ─── Badge de alertas de estoque ─────────────────────────────────────────────
async function _initEstoqueAlerts() {
  const _update = async () => {
    try {
      const mats   = await services.estoque.listarMateriais?.() || [];
      const alertas = mats.filter(m =>
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
