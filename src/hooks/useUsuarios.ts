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
      // 1. Cria o usuário via Admin API (invite)
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { nome, role },
      });
      if (error) {
        // Se já existe, só atualiza o role
        const { error: rpcErr } = await supabase.rpc('convidar_usuario', {
          p_email: email,
          p_nome: nome,
          p_role: role,
        });
        if (rpcErr) throw rpcErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios-admin'] });
      toast.success('Usuário convidado! Ele receberá um e-mail para definir a senha.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    definirRole:     definirRole.mutateAsync,
    convidarUsuario: convidarUsuario.mutateAsync,
    isConvidando:    convidarUsuario.isPending,
  };
}
