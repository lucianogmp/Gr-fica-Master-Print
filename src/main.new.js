/**
 * MAIN.NEW.JS — Entry point do ERP refatorado.
 *
 * Para ativar: no index.html, trocar
 *   <script type="module" src="src/main.js">
 * por
 *   <script type="module" src="src/main.new.js">
 *
 * Todos os módulos agora usam a arquitetura em 4 camadas:
 *   Store + EventBus → Repositories → Services → Views (BaseView)
 *
 * Módulos migrados nesta versão:
 *   ✅ Dashboard, Vendas, Clientes, Estoque, Financeiro, Produção, Orçamento
 *   ✅ Produtos      → ProdutosView       (src/views/ProdutosView.js)
 *   ✅ FluxoCaixa    → FluxoCaixaView     (src/views/FluxoCaixaView.js)
 *   ✅ GestaoCustos  → GestaoCustosView   (src/views/GestaoCustosView.js)
 *   ✅ Configuracoes → ConfiguracoesView  (src/views/ConfiguracoesView.js)
 *
 * A pasta pages/ pode ser completamente removida após verificação.
 */

import "./styles.css";
import { Store }    from "./core/Store.js";
import { EventBus } from "./core/EventBus.js";

// ─── Módulos já migrados anteriormente ───────────────────────────────────────
import { DashboardView }  from "./views/DashboardView.js";
import { VendasView }     from "./views/VendasView.js";
import { ClientesView }   from "./views/ClientesView.js";
import { EstoqueView }    from "./views/EstoqueView.js";
import { FinanceiroView } from "./views/FinanceiroView.js";
import { ProducaoView }   from "./views/ProducaoView.js";
import { OrcamentoView }  from "./views/OrcamentoView.js";

// ─── Módulos migrados agora ───────────────────────────────────────────────────
import { ProdutosView }      from "./views/ProdutosView.js";
import { FluxoCaixaView }    from "./views/FluxoCaixaView.js";
import { GestaoCustosView }  from "./views/GestaoCustosView.js";
import { ConfiguracoesView } from "./views/ConfiguracoesView.js";

// ─── Mapa de rotas: chave da nav → classe View ────────────────────────────────
const ROUTES = {
  dashboard:    DashboardView,
  vendas:       VendasView,
  clientes:     ClientesView,
  estoque:      EstoqueView,
  financeiro:   FinanceiroView,
  producao:     ProducaoView,
  orcamento:    OrcamentoView,
  produtos:     ProdutosView,
  fluxo_caixa:  FluxoCaixaView,
  custos:       GestaoCustosView,
  configuracoes: ConfiguracoesView,
};

// ─── Estado do router ─────────────────────────────────────────────────────────
let _currentView = null;
let _currentRoute = null;

// ─── Inicialização ────────────────────────────────────────────────────────────
export function initApp() {
  const container = document.getElementById("app-content")
    || document.querySelector(".main-content")
    || document.querySelector("#content")
    || document.body;

  // Rota inicial: lê o hash ou usa dashboard
  const initialRoute = (location.hash.replace("#", "") || "dashboard");
  navigate(initialRoute, container);

  // Escuta cliques na nav (data-route)
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-route]");
    if (!btn) return;
    e.preventDefault();
    const route = btn.dataset.route;
    navigate(route, container);
    // Atualiza classe active na nav
    document.querySelectorAll("[data-route]").forEach(el => el.classList.remove("active"));
    btn.classList.add("active");
  });

  // Escuta mudanças de hash (botão voltar do browser)
  window.addEventListener("hashchange", () => {
    const route = location.hash.replace("#", "") || "dashboard";
    if (route !== _currentRoute) navigate(route, container);
  });

  // Escuta eventos de navegação interna emitidos via EventBus
  EventBus.on("navigate", ({ route }) => navigate(route, container));

  // Marca nav inicial como active
  document.querySelectorAll("[data-route]").forEach(el => {
    el.classList.toggle("active", el.dataset.route === initialRoute);
  });
}

// ─── Router principal ─────────────────────────────────────────────────────────
async function navigate(route, container) {
  if (route === _currentRoute) return;

  // Desmonta view atual (cleanup de listeners)
  if (_currentView && typeof _currentView.unmount === "function") {
    _currentView.unmount();
  }
  _currentView  = null;
  _currentRoute = route;

  // Atualiza hash sem disparar hashchange de novo
  history.replaceState(null, "", "#" + route);

  // Resolve a classe da view
  const ViewClass = ROUTES[route];
  if (!ViewClass) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:60vh;gap:12px;color:var(--muted)">
        <i class="fi fi-rr-exclamation" style="font-size:32px;opacity:.4"></i>
        <div style="font-size:15px;font-weight:600">Módulo "<strong>${route}</strong>" não encontrado.</div>
        <button onclick="navigate('dashboard',document.getElementById('app-content'))"
          style="margin-top:8px;padding:8px 20px;border-radius:8px;border:1px solid var(--border-md);
                 background:transparent;color:var(--text);cursor:pointer;font-size:13px">
          ← Voltar ao Dashboard
        </button>
      </div>`;
    return;
  }

  // Emite evento antes de montar (útil para mostrar loading global)
  EventBus.emit("route:change", { from: _currentRoute, to: route });

  // Monta a nova view
  try {
    const view = new ViewClass(container);
    _currentView = view;
    await view.mount();
  } catch (err) {
    console.error(`[Router] Erro ao montar "${route}":`, err);
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:60vh;gap:12px;color:var(--muted)">
        <i class="fi fi-rr-bug" style="font-size:32px;color:var(--error);opacity:.6"></i>
        <div style="font-size:15px;font-weight:600;color:var(--error)">Erro ao carregar o módulo</div>
        <div style="font-size:12px;max-width:400px;text-align:center;line-height:1.5">${err.message}</div>
      </div>`;
  }
}

// Inicia automaticamente
initApp();
