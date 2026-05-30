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
      if (error) {
        // fallback: só mostra o usuário atual se não tiver a função RPC
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        return [{
          id: user.id,
          email: user.email ?? '',
          nome: user.user_metadata?.nome ?? user.user_metadata?.name ?? user.email ?? '',
          role: user.user_metadata?.role ?? null,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
        }];
      }
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
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  return { ...query, definirRole: definirRole.mutateAsync };
}
