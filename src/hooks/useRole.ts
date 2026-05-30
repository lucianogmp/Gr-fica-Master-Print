import { useAuth } from './useAuth';
import { Role, temPermissao } from '../types/roles';

export function useRole() {
  const { user } = useAuth();
  const role = (user?.user_metadata?.role ?? null) as Role | null;

  return {
    role,
    isDono:      role === 'dono',
    isAdmin:     role === 'admin' || role === 'dono',
    isVendedor:  role === 'vendedor',
    isFinanceiro:role === 'financeiro',
    isProducao:  role === 'producao',
    pode: (rota: string) => temPermissao(role, rota),
    semRole: !role,
  };
}
