// src/routes/index.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Layout }         from '../components/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth }        from '../hooks/useAuth';
import { Login }          from '../pages/Login';

// Lazy loaded pages
const Dashboard     = lazy(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Vendas        = lazy(() => import('../pages/Vendas').then(m => ({ default: m.Vendas })));
const Clientes      = lazy(() => import('../pages/Clientes').then(m => ({ default: m.Clientes })));
const Orcamentos    = lazy(() => import('../pages/Orcamentos').then(m => ({ default: m.Orcamentos })));
const Financeiro    = lazy(() => import('../pages/Financeiro').then(m => ({ default: m.Financeiro })));
const FluxoCaixa    = lazy(() => import('../pages/FluxoCaixa').then(m => ({ default: m.FluxoCaixa })));
const Produtos      = lazy(() => import('../pages/Produtos').then(m => ({ default: m.Produtos })));
const Estoque       = lazy(() => import('../pages/Estoque').then(m => ({ default: m.Estoque })));
const Producao      = lazy(() => import('../pages/Producao').then(m => ({ default: m.Producao })));
const GestaoCustos  = lazy(() => import('../pages/GestaoCustos').then(m => ({ default: m.GestaoCustos })));
const Configuracoes = lazy(() => import('../pages/Configuracoes').then(m => ({ default: m.Configuracoes })));
const Relatorios    = lazy(() => import('../pages/Relatorios').then(m => ({ default: m.Relatorios })));
const AuditLog      = lazy(() => import('../pages/AuditLog').then(m => ({ default: m.AuditLog })));

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

const ROTAS = [
  { path: '/',              Page: Dashboard,    rota: '/'              },
  { path: '/vendas',        Page: Vendas,       rota: '/vendas'        },
  { path: '/orcamentos',    Page: Orcamentos,   rota: '/orcamentos'    },
  { path: '/clientes',      Page: Clientes,     rota: '/clientes'      },
  { path: '/financeiro',    Page: Financeiro,   rota: '/financeiro'    },
  { path: '/fluxo-caixa',   Page: FluxoCaixa,   rota: '/fluxo-caixa'   },
  { path: '/produtos',      Page: Produtos,     rota: '/produtos'      },
  { path: '/estoque',       Page: Estoque,      rota: '/estoque'       },
  { path: '/producao',      Page: Producao,     rota: '/producao'      },
  { path: '/custos',        Page: GestaoCustos, rota: '/custos'        },
  { path: '/relatorios',    Page: Relatorios,   rota: '/relatorios'    },
  { path: '/audit-log',     Page: AuditLog,     rota: '/audit-log'     },
  { path: '/configuracoes', Page: Configuracoes,rota: '/configuracoes' },
];

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

        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
          {ROTAS.map(({ path, Page, rota }) => (
            <Route
              key={path}
              path={path === '/' ? undefined : path}
              index={path === '/'}
              element={
                <ProtectedRoute rota={rota}>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Page />
                  </Suspense>
                </ProtectedRoute>
              }
            />
          ))}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
