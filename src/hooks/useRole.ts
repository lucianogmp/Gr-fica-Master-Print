// src/hooks/useRole.ts
import { useAuth } from './useAuth';
import { Role, temPermissao } from '../types/roles';

export function useRole() {
  const { user } = useAuth();

  // app_metadata tem precedência — user_metadata como fallback de migração
  const role = (
    user?.user_metadata?.app_metadata?.role ??  // quando Supabase expõe via JWT
    user?.user_metadata?.role ??                 // legado user_metadata
    null
  ) as Role | null;

  return {
    role,
    isDono:       role === 'dono',
    isAdmin:      role === 'admin' || role === 'dono',
    isVendedor:   role === 'vendedor',
    isFinanceiro: role === 'financeiro',
    isProducao:   role === 'producao',
    pode: (rota: string) => temPermissao(role, rota),
    semRole: !role,
  };
}