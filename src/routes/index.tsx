import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

// Páginas
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

export function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
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
  }

  return (
    <BrowserRouter basename="/Gr-fica-Master-Print">
      <Routes>
        {/* Rota pública */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

        {/* Rotas protegidas */}
        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index                element={<Dashboard />} />
          <Route path="vendas"        element={<Vendas />} />
          <Route path="orcamentos"    element={<Orcamentos />} />
          <Route path="clientes"      element={<Clientes />} />
          <Route path="financeiro"    element={<Financeiro />} />
          <Route path="fluxo-caixa"   element={<FluxoCaixa />} />
          <Route path="produtos"      element={<Produtos />} />
          <Route path="estoque"       element={<Estoque />} />
          <Route path="producao"      element={<Producao />} />
          <Route path="custos"        element={<GestaoCustos />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
