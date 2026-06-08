// src/hooks/useRole.ts
//
// SEGURANÇA: role é lido EXCLUSIVAMENTE de app_metadata, que é controlado
// pelo servidor (service role) e NÃO pode ser editado pelo cliente.
//
// user_metadata é editável pelo próprio usuário via supabase.auth.updateUser()
// — nunca usar para decisões de autorização.

import { useAuth } from './useAuth';
import { Role, temPermissao } from '../types/roles';

export function useRole() {
  const { user } = useAuth();

  // app_metadata vem no JWT e só pode ser alterado via service role key.
  // Nunca ler de user_metadata como fallback — seria bypassável pelo cliente.
  const role = (user?.app_metadata?.role ?? null) as Role | null;

  return {
    role,
    isDono:       role === 'dono',
    isAdmin:      role === 'admin' || role === 'dono',
    isVendedor:   role === 'vendedor',
    isFinanceiro: role === 'financeiro',
    isProducao:   role === 'producao',
    pode: (rota: string) => temPermissao(role, rota),
    // semRole: true significa que o usuário está autenticado mas sem perfil
    // configurado — vai mostrar aviso em ProtectedRoute
    semRole: !role,
  };
}
