// src/types/roles.ts
export type Role = 'dono' | 'admin' | 'vendedor' | 'financeiro' | 'producao';

export const ROLES: Record<Role, { label: string; cor: string; descricao: string }> = {
  dono:       { label: 'Dono',       cor: 'text-yellow-400', descricao: 'Acesso total ao sistema' },
  admin:      { label: 'Admin',      cor: 'text-blue-400',   descricao: 'Acesso total exceto configurações críticas' },
  vendedor:   { label: 'Vendedor',   cor: 'text-green-400',  descricao: 'Vendas, orçamentos e clientes' },
  financeiro: { label: 'Financeiro', cor: 'text-purple-400', descricao: 'Financeiro, fluxo de caixa e custos' },
  producao:   { label: 'Produção',   cor: 'text-orange-400', descricao: 'Produção e estoque' },
};

export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  // ── Dashboard ──
  '/': ['dono', 'admin', 'vendedor', 'financeiro', 'producao'],

  // ── Vendas ──
  '/vendas':           ['dono', 'admin', 'vendedor'],
  '/vendas/nova':      ['dono', 'admin', 'vendedor'],
  '/vendas/pedidos':   ['dono', 'admin', 'vendedor'],
  '/vendas/historico': ['dono', 'admin', 'vendedor'],
  '/vendas/producao':  ['dono', 'admin', 'vendedor', 'producao'],
  '/vendas/entregues': ['dono', 'admin', 'vendedor'],

  // ── CRM ──
  '/crm':                        ['dono', 'admin', 'vendedor'],
  '/crm/clientes':               ['dono', 'admin', 'vendedor'],
  '/crm/leads':                  ['dono', 'admin', 'vendedor'],
  '/crm/contatos':               ['dono', 'admin', 'vendedor'],
  '/crm/aniversariantes':        ['dono', 'admin', 'vendedor'],
  '/crm/historico-atendimento':  ['dono', 'admin', 'vendedor'],

  // ── Financeiro ──
  '/financeiro':               ['dono', 'admin', 'financeiro'],
  '/financeiro/lancamentos':   ['dono', 'admin', 'financeiro'],
  '/financeiro/receber':       ['dono', 'admin', 'financeiro'],
  '/financeiro/pagar':         ['dono', 'admin', 'financeiro'],
  '/financeiro/fluxo-caixa':   ['dono', 'admin', 'financeiro'],
  '/financeiro/conciliacao':   ['dono', 'admin', 'financeiro'],
  '/financeiro/resumo':        ['dono', 'admin', 'financeiro'],

  // ── Produtos ──
  '/produtos':            ['dono', 'admin', 'producao'],
  '/produtos/catalogo':   ['dono', 'admin', 'producao', 'vendedor'],
  '/produtos/categorias': ['dono', 'admin', 'producao'],
  '/produtos/precos':     ['dono', 'admin', 'producao', 'vendedor'],
  '/produtos/kits':       ['dono', 'admin', 'producao', 'vendedor'],
  '/produtos/servicos':   ['dono', 'admin', 'producao', 'vendedor'],

  // ── Estoque ──
  '/estoque':           ['dono', 'admin', 'producao'],
  '/estoque/atual':     ['dono', 'admin', 'producao'],
  '/estoque/gerenciar': ['dono', 'admin', 'producao'],
  '/estoque/historico': ['dono', 'admin', 'producao'],

  // ── Produção ──
  '/producao': ['dono', 'admin', 'producao', 'vendedor'],

  // ── Gestão de Custos ──
  '/custos':              ['dono', 'admin', 'financeiro'],
  '/custos/fixos':        ['dono', 'admin', 'financeiro'],
  '/custos/variaveis':    ['dono', 'admin', 'financeiro'],
  '/custos/depreciacao':  ['dono', 'admin', 'financeiro'],
  '/custos/resumo':       ['dono', 'admin', 'financeiro'],

  // ── Relatórios ──
  '/relatorios':            ['dono', 'admin', 'financeiro'],
  '/relatorios/vendas':     ['dono', 'admin', 'financeiro', 'vendedor'],
  '/relatorios/financeiro': ['dono', 'admin', 'financeiro'],
  '/relatorios/producao':   ['dono', 'admin', 'producao'],
  '/relatorios/clientes':   ['dono', 'admin', 'vendedor', 'financeiro'],
  '/relatorios/produtos':   ['dono', 'admin', 'producao'],

  // ── Audit Log ──
  '/audit-log': ['dono'],

  // ── Configurações ──
  '/configuracoes':                    ['dono'],
  '/configuracoes/empresa':            ['dono'],
  '/configuracoes/usuarios':           ['dono'],
  '/configuracoes/formas-pagamento':   ['dono', 'admin'],
  '/configuracoes/impressao':          ['dono', 'admin'],
  '/configuracoes/integracoes':        ['dono'],
  '/configuracoes/backup':             ['dono'],
  '/configuracoes/sistema':            ['dono'],

  // ── Legado (mantém compatibilidade) ──
  '/orcamentos':  ['dono', 'admin', 'vendedor'],
  '/clientes':    ['dono', 'admin', 'vendedor'],   // redirect → /crm/clientes
  '/fluxo-caixa': ['dono', 'admin', 'financeiro'], // redirect → /financeiro/fluxo-caixa
};

export function temPermissao(role: Role | null | undefined, rota: string): boolean {
  if (!role) return false;
  const permitidos = ROUTE_PERMISSIONS[rota] ?? ['dono'];
  return permitidos.includes(role);
}
