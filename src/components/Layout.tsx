// src/components/Layout.tsx
import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRole } from '../hooks/useRole';
import { ROLES, ROUTE_PERMISSIONS, Role } from '../types/roles';
import { supabase } from '../lib/supabase';
import { EstoqueAlertBanner } from './EstoqueAlertBanner';
import { useTheme } from '../hooks/useTheme';
import { useConfiguracoes } from '../hooks/useConfiguracoes';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, ShoppingCart, Users, Landmark, FileText,
  Package, Warehouse, Factory, TrendingDown, Settings, Bell, Menu, X,
  ShieldCheck, BarChart3, Moon, Sun, ChevronDown, ChevronRight,
  PlusCircle, ClipboardList, History, Truck, CheckCircle2,
  Receipt, CreditCard, ArrowUpCircle, ArrowDownCircle, GitMerge, PieChart,
  BookOpen, Tag, DollarSign, Layers, Wrench,
  BarChart2, Users2, PackageSearch,
  UserPlus, PhoneCall, Cake, MessageSquare,
  Building2, UserCog, Printer, Plug, HardDrive, MonitorCog,
  Boxes, GitCompare, TrendingUp, FileBarChart2,
  DollarSign as DollarSignIcon,
} from 'lucide-react';

// ─── Tipos ──────────────────────────────────────────────────────────────────

type SubItem = {
  path: string;
  label: string;
  icon: React.ElementType;
};

type MenuItem = {
  path?: string;           // se tiver path direto, não tem sub-itens
  label: string;
  icon: React.ElementType;
  children?: SubItem[];    // sub-itens do accordion
  rota?: string;           // rota base para verificar permissão
};

// ─── Estrutura do Menu ───────────────────────────────────────────────────────

const ALL_MENU: MenuItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    rota: '/',
  },

  // ── Orçamentos ──
  {
    path: '/orcamentos',
    label: 'Orçamentos',
    icon: FileText,
    rota: '/orcamentos',
  },

  // ── Vendas ──
  {
    label: 'Vendas',
    icon: ShoppingCart,
    rota: '/vendas',
    children: [
      { path: '/vendas/nova',      label: 'Nova Venda',          icon: PlusCircle },
      { path: '/vendas/pedidos',   label: 'Pedidos',             icon: ClipboardList },
      { path: '/vendas/historico', label: 'Histórico',           icon: History },
      { path: '/vendas/producao',  label: 'Pedidos em Produção', icon: Factory },
      { path: '/vendas/entregues', label: 'Pedidos Entregues',   icon: CheckCircle2 },
    ],
  },

  // ── CRM ──
  {
    label: 'CRM',
    icon: Users,
    rota: '/crm',
    children: [
      { path: '/crm/clientes',            label: 'Clientes',               icon: Users2 },
      { path: '/crm/leads',               label: 'Leads',                  icon: UserPlus },
      { path: '/crm/contatos',            label: 'Contatos',               icon: PhoneCall },
      { path: '/crm/aniversariantes',     label: 'Aniversariantes',        icon: Cake },
      { path: '/crm/historico-atendimento', label: 'Histórico de Atendimento', icon: MessageSquare },
    ],
  },

  // ── Financeiro ──
  {
    label: 'Financeiro',
    icon: Landmark,
    rota: '/financeiro',
    children: [
      { path: '/financeiro/lancamentos',  label: 'Lançamentos',        icon: Receipt },
      { path: '/financeiro/receber',      label: 'Contas a Receber',   icon: ArrowDownCircle },
      { path: '/financeiro/pagar',        label: 'Contas a Pagar',     icon: ArrowUpCircle },
      { path: '/financeiro/fluxo-caixa',  label: 'Fluxo de Caixa',    icon: TrendingUp },
      { path: '/financeiro/conciliacao',  label: 'Conciliação Bancária', icon: GitMerge },
      { path: '/financeiro/resumo',       label: 'Resumo Financeiro',  icon: PieChart },
    ],
  },

  // ── Produtos ──
  {
    label: 'Produtos',
    icon: Package,
    rota: '/produtos',
    children: [
      { path: '/produtos/catalogo',   label: 'Catálogo',        icon: BookOpen },
      { path: '/produtos/categorias', label: 'Categorias',      icon: Tag },
      { path: '/produtos/precos',     label: 'Tabela de Preços', icon: DollarSign },
      { path: '/produtos/kits',       label: 'Kits',            icon: Layers },
      { path: '/produtos/servicos',   label: 'Serviços',        icon: Wrench },
    ],
  },

  // ── Estoque ──
  {
    label: 'Estoque',
    icon: Warehouse,
    rota: '/estoque',
    children: [
      { path: '/estoque/atual',     label: 'Estoque Atual', icon: Boxes },
      { path: '/estoque/gerenciar', label: 'Gerenciar',     icon: PackageSearch },
      { path: '/estoque/historico', label: 'Histórico',     icon: History },
    ],
  },

  // ── Produção ──
  {
    path: '/producao',
    label: 'Produção',
    icon: Factory,
    rota: '/producao',
  },

  // ── Gestão de Custos ──
  {
    label: 'Gestão de Custos',
    icon: TrendingDown,
    rota: '/custos',
    children: [
      { path: '/custos/fixos',      label: 'Custos Fixos',     icon: DollarSignIcon },
      { path: '/custos/variaveis',  label: 'Custos Variáveis', icon: GitCompare },
      { path: '/custos/depreciacao', label: 'Depreciação',     icon: TrendingDown },
      { path: '/custos/resumo',     label: 'Resumo',           icon: PieChart },
    ],
  },

  // ── Relatórios ──
  {
    label: 'Relatórios',
    icon: BarChart3,
    rota: '/relatorios',
    children: [
      { path: '/relatorios/vendas',    label: 'Vendas',    icon: ShoppingCart },
      { path: '/relatorios/financeiro', label: 'Financeiro', icon: FileBarChart2 },
      { path: '/relatorios/producao',  label: 'Produção',  icon: Factory },
      { path: '/relatorios/clientes',  label: 'Clientes',  icon: Users2 },
      { path: '/relatorios/produtos',  label: 'Produtos',  icon: Package },
    ],
  },

  // ── Audit Log (só dono) ──
  {
    path: '/audit-log',
    label: 'Audit Log',
    icon: ShieldCheck,
    rota: '/audit-log',
  },

  // ── Configurações ──
  {
    label: 'Configurações',
    icon: Settings,
    rota: '/configuracoes',
    children: [
      { path: '/configuracoes/empresa',          label: 'Empresa',           icon: Building2 },
      { path: '/configuracoes/usuarios',         label: 'Usuários',          icon: UserCog },
      { path: '/configuracoes/formas-pagamento', label: 'Formas de Pagamento', icon: CreditCard },
      { path: '/configuracoes/impressao',        label: 'Impressão',         icon: Printer },
      { path: '/configuracoes/integracoes',      label: 'Integrações',       icon: Plug },
      { path: '/configuracoes/backup',           label: 'Backup',            icon: HardDrive },
      { path: '/configuracoes/sistema',          label: 'Sistema',           icon: MonitorCog },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Verifica se um caminho está ativo (exato ou sub-rota) */
function isPathActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}

/** Verifica se qualquer filho está ativo */
function hasActiveChild(pathname: string, children: SubItem[]): boolean {
  return children.some(c => isPathActive(pathname, c.path));
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, pode } = useRole();
  const { isDark, toggleTheme } = useTheme();
  const { data: cfg } = useConfiguracoes();
  const [menuOpen, setMenuOpen] = useState(false);

  // Quais accordions estão abertos (por label)
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Abre automaticamente o grupo que contém a rota atual
    const initial = new Set<string>();
    ALL_MENU.forEach(item => {
      if (item.children?.some(c => isPathActive(location.pathname, c.path))) {
        initial.add(item.label);
      }
    });
    return initial;
  });

  const initials = (user?.name ?? 'U').slice(0, 1).toUpperCase();
  const roleInfo = role ? ROLES[role as Role] : null;

  // Fecha menu mobile ao navegar
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Abre o grupo correto ao navegar (ex: deep link)
  useEffect(() => {
    ALL_MENU.forEach(item => {
      if (item.children?.some(c => isPathActive(location.pathname, c.path))) {
        setOpenGroups(prev => new Set([...prev, item.label]));
      }
    });
  }, [location.pathname]);

  function toggleGroup(label: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success('Até logo!');
    navigate('/login');
  }

  // Filtra itens sem permissão
  const menuItems = ALL_MENU.filter(item => {
    const rota = item.rota ?? item.path ?? '/';
    return pode(rota);
  });

  // Label da página atual (para o breadcrumb)
  function getCurrentPageLabel(): string {
    for (const item of ALL_MENU) {
      if (item.path && isPathActive(location.pathname, item.path)) return item.label;
      if (item.children) {
        const child = item.children.find(c => isPathActive(location.pathname, c.path));
        if (child) return `${item.label} › ${child.label}`;
      }
    }
    return 'Dashboard';
  }

  function getCurrentPageIcon(): React.ElementType | null {
    for (const item of ALL_MENU) {
      if (item.path && isPathActive(location.pathname, item.path)) return item.icon;
      if (item.children) {
        const child = item.children.find(c => isPathActive(location.pathname, c.path));
        if (child) return child.icon;
      }
    }
    return LayoutDashboard;
  }

  const CurrentIcon = getCurrentPageIcon();

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#111827] text-gray-100 overflow-hidden">
      {/* Backdrop mobile */}
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
        {/* Logo */}
        <div className="p-6 border-b border-gray-700 flex-shrink-0 relative">
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden absolute top-4 right-4 text-gray-400 hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center gap-1.5">
            {(isDark ? cfg?.sistema_logo_url : cfg?.sistema_logo_url_dark) ? (
              <img
                src={isDark ? cfg!.sistema_logo_url! : cfg!.sistema_logo_url_dark!}
                alt="Master Print"
                className="h-14 w-auto object-contain"
              />
            ) : (
              <h1 className="text-xl font-black tracking-tighter text-blue-500">
                MASTER <span className="text-white">PRINT</span>
              </h1>
            )}
            <p className="text-xs text-gray-400">Sistema de Gestão</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            const hasChildren = !!item.children;
            const isOpen = openGroups.has(item.label);
            const anyChildActive = hasChildren && hasActiveChild(location.pathname, item.children!);

            // Separadores visuais antes de Relatórios e Audit Log
            const showSeparator =
              item.rota === '/relatorios' ||
              item.rota === '/audit-log';

            // Item simples (sem filhos)
            if (!hasChildren) {
              const isActive = isPathActive(location.pathname, item.path ?? '/');
              return (
                <div key={item.path}>
                  {showSeparator && <div className="border-t border-gray-700/50 my-2" />}
                  <Link
                    to={item.path!}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </div>
              );
            }

            // Item com accordion
            return (
              <div key={item.label}>
                {showSeparator && <div className="border-t border-gray-700/50 my-2" />}

                {/* Header do grupo */}
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    anyChildActive && !isOpen
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  }
                </button>

                {/* Sub-itens */}
                {isOpen && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-gray-700/70 space-y-0.5">
                    {item.children!.map(child => {
                      const ChildIcon = child.icon;
                      const isActive = isPathActive(location.pathname, child.path);
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                          }`}
                        >
                          <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Rodapé: usuário */}
        <div className="p-4 border-t border-gray-700 bg-[#1a222f] flex-shrink-0">
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
          <button
            onClick={handleLogout}
            className="w-full text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 py-2 rounded-lg transition-all font-medium"
          >
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-[#1f2937] border-b border-gray-700 flex items-center justify-between px-4 md:px-8 flex-shrink-0">
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
                {CurrentIcon && <CurrentIcon className="w-4 h-4 text-gray-400" />}
                {getCurrentPageLabel()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="theme-toggle relative text-gray-300 hover:text-white transition-colors"
              aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className="relative text-gray-300 hover:text-white transition-colors" aria-label="Notificações">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Banner de alertas de estoque */}
        <EstoqueAlertBanner />

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto bg-[#111827]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
