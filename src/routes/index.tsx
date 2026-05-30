import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout }          from '../components/Layout';
import { ProtectedRoute }  from '../components/ProtectedRoute';
import { useAuth }         from '../hooks/useAuth';

import { Login }         from '../pages/Login';
import { Dashboard }     from '../pages/Dashboard';
import { Vendas }        from '../pages/Vendas';
import { Clientes }      from '../pages/Clientes';
import { Orcamentos }    from '../pages/Orcamentos';
import { Financeiro }    from '../pages/Financeiro';
import { FluxoCaixa }    from '../pages/FluxoCaixa';
import { Produtos }      from '../pages/Produtos';
import { Estoque }       from '../pages/Estoque';
import { Producao }      from '../pages/Producao';
import { GestaoCustos }  from '../pages/GestaoCustos';
import { Configuracoes } from '../pages/Configuracoes';

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
                  <Page />
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
