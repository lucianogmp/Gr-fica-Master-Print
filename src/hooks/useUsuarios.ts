import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Role } from '../types/roles';
import toast from 'react-hot-toast';

export interface UsuarioAdmin {
  id: string;
  email: string;
  nome: string;
  role: Role | null;
  created_at: string;
  last_sign_in_at?: string;
}

export function useUsuarios() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['usuarios-admin'],
    queryFn: async (): Promise<UsuarioAdmin[]> => {
      const { data, error } = await supabase.rpc('listar_usuarios');
      if (error) throw error;
      return data ?? [];
    },
  });

  const definirRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error } = await supabase.rpc('definir_role_usuario', {
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios-admin'] });
      toast.success('Perfil atualizado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const convidarUsuario = useMutation({
    mutationFn: async ({ email, nome, role }: { email: string; nome: string; role: Role }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada.')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/convidar-usuario`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, nome, role }),
        }
      )

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao convidar usuário.')
      return json
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios-admin'] })
      toast.success('Convite enviado! O usuário receberá um e-mail.')
    },
    onError: (e: any) => toast.error(e.message),
  })

  // NOVO — exclusão de usuário
  const excluirUsuario = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada.')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/excluir-usuario`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId }),
        }
      )

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao excluir usuário.')
      return json
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios-admin'] })
      toast.success('Usuário excluído.')
    },
    onError: (e: any) => toast.error(e.message),
  })

  return {
    ...query,
    definirRole:     definirRole.mutateAsync,
    convidarUsuario: convidarUsuario.mutateAsync,
    isConvidando:    convidarUsuario.isPending,
    excluirUsuario:  excluirUsuario.mutateAsync,
    isExcluindo:     excluirUsuario.isPending,
  };
}
