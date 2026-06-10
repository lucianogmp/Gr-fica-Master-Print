// src/types/roles.ts
export type Role = 'dono' | 'admin' | 'vendedor' | 'financeiro' | 'producao';

export const ROLES: Record<Role, { label: string; cor: string; descricao: string }> = {
  dono:      { label: 'Dono',       cor: 'text-yellow-400', descricao: 'Acesso total ao sistema' },
  admin:     { label: 'Admin',      cor: 'text-blue-400',   descricao: 'Acesso total exceto configurações críticas' },
  vendedor:  { label: 'Vendedor',   cor: 'text-green-400',  descricao: 'Vendas, orçamentos e clientes' },
  financeiro:{ label: 'Financeiro', cor: 'text-purple-400', descricao: 'Financeiro, fluxo de caixa e custos' },
  producao:  { label: 'Produção',   cor: 'text-orange-400', descricao: 'Produção e estoque' },
};

export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  '/':              ['dono', 'admin', 'vendedor', 'financeiro', 'producao'],
  '/vendas':        ['dono', 'admin', 'vendedor'],
  '/orcamentos':    ['dono', 'admin', 'vendedor'],
  '/clientes':      ['dono', 'admin', 'vendedor'],
  '/financeiro':    ['dono', 'admin', 'financeiro'],
  '/fluxo-caixa':   ['dono', 'admin', 'financeiro'],
  '/custos':        ['dono', 'admin', 'financeiro'],
  '/producao':      ['dono', 'admin', 'producao', 'vendedor'],
  '/produtos':      ['dono', 'admin', 'producao'],
  '/estoque':       ['dono', 'admin', 'producao'],
  '/relatorios':    ['dono', 'admin', 'financeiro'],
  '/audit-log':     ['dono'],                          // exclusivo do dono
  '/configuracoes': ['dono'],
};

export function temPermissao(role: Role | null | undefined, rota: string): boolean {
  if (!role) return false;
  const permitidos = ROUTE_PERMISSIONS[rota] ?? ['dono'];
  return permitidos.includes(role);
}
