import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRole } from '../hooks/useRole';
import { ROLES, ROUTE_PERMISSIONS, Role } from '../types/roles';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const ALL_MENU = [
  { path: '/',             label: 'Dashboard',      icon: '📊' },
  { path: '/vendas',       label: 'Vendas',          icon: '💰' },
  { path: '/orcamentos',   label: 'Orçamentos',      icon: '📝' },
  { path: '/clientes',     label: 'Clientes',        icon: '👥' },
  { path: '/financeiro',   label: 'Financeiro',      icon: '🏦' },
  { path: '/fluxo-caixa',  label: 'Fluxo de Caixa',  icon: '📈' },
  { path: '/produtos',     label: 'Produtos',        icon: '📦' },
  { path: '/estoque',      label: 'Estoque',         icon: '🏭' },
  { path: '/producao',     label: 'Produção',        icon: '⚙️' },
  { path: '/custos',       label: 'Gestão de Custos', icon: '📉' },
  { path: '/configuracoes',label: 'Configurações',   icon: '🔧' },
];

export function Layout() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { role, pode } = useRole();

  // Filtra o menu pelo role do usuário
  const menuItems = ALL_MENU.filter(item => pode(item.path));

  const currentPage = ALL_MENU.find(i => i.path === location.pathname);
  const initials    = (user?.name ?? 'U').slice(0, 1).toUpperCase();
  const roleInfo    = role ? ROLES[role as Role] : null;

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success('Até logo!');
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-[#111827] text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1f2937] border-r border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-black tracking-tighter text-blue-500">
            MASTER <span className="text-white">PRINT</span>
          </h1>
          <p className="text-[10px] text-gray-600 mt-0.5">Sistema de Gestão</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Usuário + Role + Sair */}
        <div className="p-4 border-t border-gray-700 bg-[#1a222f]">
          <div className="flex items-center gap-3 px-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-white">{user?.name ?? 'Usuário'}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          {roleInfo && (
            <div className="px-2 mb-2">
              <span className={`text-[10px] font-bold ${roleInfo.cor}`}>
                ● {roleInfo.label}
              </span>
            </div>
          )}
          <button onClick={handleLogout}
            className="w-full text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 py-2 rounded-lg transition-all font-medium">
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-[#1f2937] border-b border-gray-700 flex items-center justify-between px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">ERP</span>
            <span className="text-gray-700">/</span>
            <span className="text-gray-200 font-medium">
              {currentPage?.icon} {currentPage?.label ?? 'Dashboard'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer">
              <span className="text-xl">🔔</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#111827]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
