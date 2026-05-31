import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRole } from '../hooks/useRole';
import { ROLES, ROUTE_PERMISSIONS, Role } from '../types/roles';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, ShoppingCart, FileText, Users, Landmark, TrendingUp,
  Package, Warehouse, Factory, TrendingDown, Settings, Bell, Menu, X,
} from 'lucide-react';

const ALL_MENU = [
  { path: '/',             label: 'Dashboard',       icon: LayoutDashboard },
  { path: '/vendas',       label: 'Vendas',          icon: ShoppingCart },
  { path: '/orcamentos',   label: 'Orçamentos',      icon: FileText },
  { path: '/clientes',     label: 'Clientes',        icon: Users },
  { path: '/financeiro',   label: 'Financeiro',      icon: Landmark },
  { path: '/fluxo-caixa',  label: 'Fluxo de Caixa',  icon: TrendingUp },
  { path: '/produtos',     label: 'Produtos',        icon: Package },
  { path: '/estoque',      label: 'Estoque',         icon: Warehouse },
  { path: '/producao',     label: 'Produção',        icon: Factory },
  { path: '/custos',       label: 'Gestão de Custos', icon: TrendingDown },
  { path: '/configuracoes',label: 'Configurações',   icon: Settings },
];

export function Layout() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { role, pode } = useRole();
  const [menuOpen, setMenuOpen] = useState(false);

  // Filtra o menu pelo role do usuário
  const menuItems = ALL_MENU.filter(item => pode(item.path));

  const currentPage = ALL_MENU.find(i => i.path === location.pathname);
  const initials    = (user?.name ?? 'U').slice(0, 1).toUpperCase();
  const roleInfo    = role ? ROLES[role as Role] : null;

  // Fecha o drawer ao trocar de rota (mobile)
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success('Até logo!');
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-[#111827] text-gray-100 overflow-hidden">
      {/* Backdrop (mobile) */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#1f2937] border-r border-gray-700 flex flex-col
          transition-transform duration-300 ease-out
          md:static md:translate-x-0
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tighter text-blue-500">
              MASTER <span className="text-white">PRINT</span>
            </h1>
            <p className="text-[10px] text-gray-400 mt-0.5">Sistema de Gestão</p>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden text-gray-400 hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map(item => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}>
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
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
              <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
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
            className="w-full text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 py-2 rounded-lg transition-all font-medium">
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 bg-[#1f2937] border-b border-gray-700 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3 text-sm min-w-0">
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden text-gray-300 hover:text-white -ml-1"
              aria-label="Abrir menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 truncate">
              <span className="text-gray-400 hidden sm:inline">ERP</span>
              <span className="text-gray-600 hidden sm:inline">/</span>
              <span className="text-gray-100 font-medium truncate flex items-center gap-1.5">
                {currentPage?.icon && <currentPage.icon className="w-4 h-4 text-gray-400" />}
                {currentPage?.label ?? 'Dashboard'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative text-gray-300 hover:text-white transition-colors" aria-label="Notificações">
              <Bell className="w-5 h-5" />
            </button>
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
