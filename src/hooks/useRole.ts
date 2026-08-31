// src/hooks/useRole.ts
//
// SEGURANÇA: role é lido EXCLUSIVAMENTE de app_metadata, que é controlado
// pelo servidor (service role) e NÃO pode ser editado pelo cliente.
//
// user_metadata é editável pelo próprio usuário via supabase.auth.updateUser()
// — nunca usar para decisões de autorização.

import { useAuth } from './useAuth';
import { Role, temPermissao } from '../types/roles';
import { useMinhasPermissoesEfetivas } from './usePermissoesUsuario';

export function useRole() {
  const { user } = useAuth();

  // app_metadata vem no JWT e só pode ser alterado via service role key.
  // Nunca ler de user_metadata como fallback — seria bypassável pelo cliente.
  const role = (user?.app_metadata?.role ?? null) as Role | null;

  // Permissões efetivas (override individual > padrão do cargo), vindas do
  // banco. Enquanto não carregam (ou pra rota sem override), cai no mapa
  // estático de cargo — o mesmo que o banco usa como padrão, então o
  // resultado bate. A segurança de verdade mora nas policies do banco;
  // isso aqui só decide o que aparece na tela.
  const { data: permissoesEfetivas } = useMinhasPermissoesEfetivas();

  function pode(rota: string): boolean {
    if (permissoesEfetivas && rota in permissoesEfetivas) return permissoesEfetivas[rota];
    return temPermissao(role, rota);
  }

  return {
    role,
    isDono:       role === 'dono',
    isAdmin:      role === 'admin' || role === 'dono',
    isVendedor:   role === 'vendedor',
    isFinanceiro: role === 'financeiro',
    isProducao:   role === 'producao',
    pode,
    // semRole: true significa que o usuário está autenticado mas sem perfil
    // configurado — vai mostrar aviso em ProtectedRoute
    semRole: !role,
  };
}
