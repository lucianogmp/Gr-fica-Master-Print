// src/routes/index.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Layout }         from '../components/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth }        from '../hooks/useAuth';
import { useRole }        from '../hooks/useRole';
import { Login }          from '../pages/Login';
import { AceitarConvite } from '../pages/AceitarConvite';

// ─── Pages existentes ────────────────────────────────────────────────────────
const Dashboard     = lazy(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Orcamentos    = lazy(() => import('../pages/Orcamentos').then(m => ({ default: m.Orcamentos })));
const Producao      = lazy(() => import('../pages/Producao').then(m => ({ default: m.Producao })));
const AuditLog      = lazy(() => import('../pages/AuditLog').then(m => ({ default: m.AuditLog })));

// ─── Vendas (sub-rotas) ──────────────────────────────────────────────────────
const VendasNova      = lazy(() => import('../pages/Vendas/Nova').then(m => ({ default: m.Vendas })));
const VendasPedidos   = lazy(() => import('../pages/Vendas/Pedidos').then(m => ({ default: m.Pedidos })));
const VendasHistorico = lazy(() => import('../pages/Vendas/Historico').then(m => ({ default: m.Historico })));
const VendasProducao  = lazy(() => import('../pages/Vendas/EmProducao').then(m => ({ default: m.EmProducao })));
const VendasEntregues = lazy(() => import('../pages/Vendas/Entregues').then(m => ({ default: m.Entregues })));

// ─── CRM (sub-rotas) ─────────────────────────────────────────────────────────
const CrmClientes             = lazy(() => import('../pages/CRM/Clientes').then(m => ({ default: m.Clientes })));
const CrmLeads                = lazy(() => import('../pages/CRM/Leads').then(m => ({ default: m.Leads })));
const CrmContatos             = lazy(() => import('../pages/CRM/Contatos').then(m => ({ default: m.Contatos })));
const CrmAniversariantes      = lazy(() => import('../pages/CRM/Aniversariantes').then(m => ({ default: m.Aniversariantes })));
const CrmHistoricoAtendimento = lazy(() => import('../pages/CRM/HistoricoAtendimento').then(m => ({ default: m.HistoricoAtendimento })));

// ─── Financeiro (sub-rotas) ──────────────────────────────────────────────────
const FinanceiroLancamentos = lazy(() => import('../pages/Financeiro/Lancamentos').then(m => ({ default: m.Lancamentos })));
const FinanceiroReceber     = lazy(() => import('../pages/Financeiro/ContasReceber').then(m => ({ default: m.ContasReceber })));
const FinanceiroPagar       = lazy(() => import('../pages/Financeiro/ContasPagar').then(m => ({ default: m.ContasPagar })));
const FinanceiroFluxo       = lazy(() => import('../pages/Financeiro/FluxoCaixa').then(m => ({ default: m.FluxoCaixa })));
const FinanceiroConciliacao = lazy(() => import('../pages/Financeiro/ConciliacaoBancaria').then(m => ({ default: m.ConciliacaoBancaria })));
const FinanceiroResumo      = lazy(() => import('../pages/Financeiro/ResumoFinanceiro').then(m => ({ default: m.ResumoFinanceiro })));

// ─── Produtos (sub-rotas) ────────────────────────────────────────────────────
const ProdutosCatalogo   = lazy(() => import('../pages/Produtos').then(m => ({ default: m.Produtos })));
const ProdutosCategorias = lazy(() => import('../pages/Produtos/Categorias').then(m => ({ default: m.Categorias })));
const ProdutosPrecos     = lazy(() => import('../pages/Produtos/TabelaPrecos').then(m => ({ default: m.TabelaPrecos })));
const ProdutosKits       = lazy(() => import('../pages/Produtos/Kits').then(m => ({ default: m.Kits })));
const ProdutosServicos   = lazy(() => import('../pages/Produtos/Servicos').then(m => ({ default: m.Servicos })));

// ─── Estoque (sub-rotas) ─────────────────────────────────────────────────────
const EstoqueAtual     = lazy(() => import('../pages/Estoque/EstoqueAtual').then(m => ({ default: m.EstoqueAtual })));
const EstoqueGerenciar = lazy(() => import('../pages/Estoque/Gerenciar').then(m => ({ default: m.Gerenciar })));
const EstoqueHistorico = lazy(() => import('../pages/Estoque/Historico').then(m => ({ default: m.Historico })));

// ─── Gestão de Custos (sub-rotas) ────────────────────────────────────────────
const CustosFixos      = lazy(() => import('../pages/GestaoCustos/CustosFixos').then(m => ({ default: m.CustosFixos })));
const CustosVariaveis  = lazy(() => import('../pages/GestaoCustos/CustosVariaveis').then(m => ({ default: m.CustosVariaveis })));
const DepreciacaoPage  = lazy(() => import('../pages/GestaoCustos/Depreciacao').then(m => ({ default: m.Depreciacao })));
const CustosResumo     = lazy(() => import('../pages/GestaoCustos/Resumo').then(m => ({ default: m.Resumo })));

// ─── Relatórios (sub-rotas) ──────────────────────────────────────────────────
const RelatoriosVendas     = lazy(() => import('../pages/Relatorios/RelatorioVendas').then(m => ({ default: m.RelatorioVendas })));
const RelatoriosFinanceiro = lazy(() => import('../pages/Relatorios/RelatorioFinanceiro').then(m => ({ default: m.RelatorioFinanceiro })));
const RelatoriosProducao   = lazy(() => import('../pages/Relatorios/RelatorioProducao').then(m => ({ default: m.RelatorioProducao })));
const RelatoriosClientes   = lazy(() => import('../pages/Relatorios/RelatorioClientes').then(m => ({ default: m.RelatorioClientes })));
const RelatoriosProdutos   = lazy(() => import('../pages/Relatorios/RelatorioProdutos').then(m => ({ default: m.RelatorioProdutos })));

// ─── Configurações (sub-rotas) ───────────────────────────────────────────────
const ConfigEmpresa         = lazy(() => import('../pages/Configuracoes/Empresa').then(m => ({ default: m.Empresa })));
const ConfigUsuarios        = lazy(() => import('../pages/Configuracoes/Usuarios').then(m => ({ default: m.Usuarios })));
const ConfigFormasPagamento = lazy(() => import('../pages/Configuracoes/FormasPagamento').then(m => ({ default: m.FormasPagamento })));
const ConfigImpressao       = lazy(() => import('../pages/Configuracoes/Impressao').then(m => ({ default: m.Impressao })));
const ConfigIntegracoes     = lazy(() => import('../pages/Configuracoes/Integracoes').then(m => ({ default: m.Integracoes })));
const ConfigBackup          = lazy(() => import('../pages/Configuracoes/Backup').then(m => ({ default: m.Backup })));
const ConfigSistema         = lazy(() => import('../pages/Configuracoes/Sistema').then(m => ({ default: m.Sistema })));

// ─── Loading Fallback ────────────────────────────────────────────────────────
function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl font-black mb-2">
          <span className="text-blue-500">MASTER</span>
          <span className="text-white"> PRINT</span>
        </div>
        <p className="text-gray-500 text-sm animate-pulse">Carregando página...</p>
      </div>
    </div>
  );
}

// ─── Wrapper de rota protegida ───────────────────────────────────────────────
function PR({ rota, children }: { rota: string; children: React.ReactNode }) {
  return (
    <ProtectedRoute rota={rota}>
      <Suspense fallback={<PageLoadingFallback />}>
        {children}
      </Suspense>
    </ProtectedRoute>
  );
}

// ─── Rota inicial ("/") ──────────────────────────────────────────────────────
// vendedor não tem Dashboard: em vez de bater na tela de "Acesso negado",
// manda ele direto para a área que ele de fato usa (Pedidos de venda).
function IndexRoute() {
  const { role } = useRole();

  if (role === 'vendedor') {
    return <Navigate to="/vendas/pedidos" replace />;
  }

  return (
    <PR rota="/">
      <Dashboard />
    </PR>
  );
}

// ─── AppRoutes ───────────────────────────────────────────────────────────────
export function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl font-black mb-2">
          <span className="text-blue-500">MASTER</span>
          <span className="text-white"> PRINT</span>
        </div>
        <p className="text-gray-500 text-sm animate-pulse">Carregando...</p>
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/aceitar-convite" element={<AceitarConvite />} />

        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>

          {/* Dashboard */}
          <Route index element={<IndexRoute />} />

          {/* ── Orçamentos ── */}
          <Route path="orcamentos" element={<PR rota="/orcamentos"><Orcamentos /></PR>} />

          {/* ── Vendas ── */}
          <Route path="vendas" element={<Navigate to="/vendas/pedidos" replace />} />
          <Route path="vendas/nova"      element={<PR rota="/vendas/nova"><VendasNova /></PR>} />
          <Route path="vendas/nova/:id"  element={<PR rota="/vendas/nova"><VendasNova /></PR>} />
          <Route path="vendas/pedidos"   element={<PR rota="/vendas/pedidos"><VendasPedidos /></PR>} />
          <Route path="vendas/historico" element={<PR rota="/vendas/historico"><VendasHistorico /></PR>} />
          <Route path="vendas/producao"  element={<PR rota="/vendas/producao"><VendasProducao /></PR>} />
          <Route path="vendas/entregues" element={<PR rota="/vendas/entregues"><VendasEntregues /></PR>} />

          {/* ── CRM ── */}
          <Route path="crm" element={<Navigate to="/crm/clientes" replace />} />
          <Route path="crm/clientes"              element={<PR rota="/crm/clientes"><CrmClientes /></PR>} />
          <Route path="crm/leads"                 element={<PR rota="/crm/leads"><CrmLeads /></PR>} />
          <Route path="crm/contatos"              element={<PR rota="/crm/contatos"><CrmContatos /></PR>} />
          <Route path="crm/aniversariantes"       element={<PR rota="/crm/aniversariantes"><CrmAniversariantes /></PR>} />
          <Route path="crm/historico-atendimento" element={<PR rota="/crm/historico-atendimento"><CrmHistoricoAtendimento /></PR>} />

          {/* ── Financeiro ── */}
          <Route path="financeiro" element={<Navigate to="/financeiro/lancamentos" replace />} />
          <Route path="financeiro/lancamentos" element={<PR rota="/financeiro/lancamentos"><FinanceiroLancamentos /></PR>} />
          <Route path="financeiro/receber"     element={<PR rota="/financeiro/receber"><FinanceiroReceber /></PR>} />
          <Route path="financeiro/pagar"       element={<PR rota="/financeiro/pagar"><FinanceiroPagar /></PR>} />
          <Route path="financeiro/fluxo-caixa" element={<PR rota="/financeiro/fluxo-caixa"><FinanceiroFluxo /></PR>} />
          <Route path="financeiro/conciliacao" element={<PR rota="/financeiro/conciliacao"><FinanceiroConciliacao /></PR>} />
          <Route path="financeiro/resumo"      element={<PR rota="/financeiro/resumo"><FinanceiroResumo /></PR>} />

          {/* ── Produtos ── */}
          <Route path="produtos" element={<Navigate to="/produtos/catalogo" replace />} />
          <Route path="produtos/catalogo"   element={<PR rota="/produtos/catalogo"><ProdutosCatalogo /></PR>} />
          <Route path="produtos/categorias" element={<PR rota="/produtos/categorias"><ProdutosCategorias /></PR>} />
          <Route path="produtos/precos"     element={<PR rota="/produtos/precos"><ProdutosPrecos /></PR>} />
          <Route path="produtos/kits"       element={<PR rota="/produtos/kits"><ProdutosKits /></PR>} />
          <Route path="produtos/servicos"   element={<PR rota="/produtos/servicos"><ProdutosServicos /></PR>} />

          {/* ── Estoque ── */}
          <Route path="estoque" element={<Navigate to="/estoque/atual" replace />} />
          <Route path="estoque/atual"     element={<PR rota="/estoque/atual"><EstoqueAtual /></PR>} />
          <Route path="estoque/gerenciar" element={<PR rota="/estoque/gerenciar"><EstoqueGerenciar /></PR>} />
          <Route path="estoque/historico" element={<PR rota="/estoque/historico"><EstoqueHistorico /></PR>} />

          {/* ── Produção ── */}
          <Route path="producao" element={<PR rota="/producao"><Producao /></PR>} />

          {/* ── Gestão de Custos ── */}
          <Route path="custos" element={<Navigate to="/custos/fixos" replace />} />
          <Route path="custos/fixos"       element={<PR rota="/custos/fixos"><CustosFixos /></PR>} />
          <Route path="custos/variaveis"   element={<PR rota="/custos/variaveis"><CustosVariaveis /></PR>} />
          <Route path="custos/depreciacao" element={<PR rota="/custos/depreciacao"><DepreciacaoPage /></PR>} />
          <Route path="custos/resumo"      element={<PR rota="/custos/resumo"><CustosResumo /></PR>} />

          {/* ── Relatórios ── */}
          <Route path="relatorios" element={<Navigate to="/relatorios/vendas" replace />} />
          <Route path="relatorios/vendas"     element={<PR rota="/relatorios/vendas"><RelatoriosVendas /></PR>} />
          <Route path="relatorios/financeiro" element={<PR rota="/relatorios/financeiro"><RelatoriosFinanceiro /></PR>} />
          <Route path="relatorios/producao"   element={<PR rota="/relatorios/producao"><RelatoriosProducao /></PR>} />
          <Route path="relatorios/clientes"   element={<PR rota="/relatorios/clientes"><RelatoriosClientes /></PR>} />
          <Route path="relatorios/produtos"   element={<PR rota="/relatorios/produtos"><RelatoriosProdutos /></PR>} />

          {/* ── Audit Log ── */}
          <Route path="audit-log" element={<PR rota="/audit-log"><AuditLog /></PR>} />

          {/* ── Configurações ── */}
          <Route path="configuracoes" element={<Navigate to="/configuracoes/empresa" replace />} />
          <Route path="configuracoes/empresa"          element={<PR rota="/configuracoes/empresa"><ConfigEmpresa /></PR>} />
          <Route path="configuracoes/usuarios"         element={<PR rota="/configuracoes/usuarios"><ConfigUsuarios /></PR>} />
          <Route path="configuracoes/formas-pagamento" element={<PR rota="/configuracoes/formas-pagamento"><ConfigFormasPagamento /></PR>} />
          <Route path="configuracoes/impressao"        element={<PR rota="/configuracoes/impressao"><ConfigImpressao /></PR>} />
          <Route path="configuracoes/integracoes"      element={<PR rota="/configuracoes/integracoes"><ConfigIntegracoes /></PR>} />
          <Route path="configuracoes/backup"           element={<PR rota="/configuracoes/backup"><ConfigBackup /></PR>} />
          <Route path="configuracoes/sistema"          element={<PR rota="/configuracoes/sistema"><ConfigSistema /></PR>} />

          {/* ── Redirects legados ── */}
          <Route path="clientes"    element={<Navigate to="/crm/clientes" replace />} />
          <Route path="fluxo-caixa" element={<Navigate to="/financeiro/fluxo-caixa" replace />} />
          <Route path="vendas/:id"  element={<Navigate to="/vendas/pedidos" replace />} />

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
