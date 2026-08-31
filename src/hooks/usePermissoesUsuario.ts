import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Permissões EFETIVAS do usuário logado (override individual > padrão do
 * cargo), já resolvidas pelo banco via minhas_permissoes(). Usado pelo
 * useRole() pra decidir o que mostrar no menu/telas.
 */
export function useMinhasPermissoesEfetivas() {
  return useQuery({
    queryKey: ['minhas-permissoes'],
    queryFn: async (): Promise<Record<string, boolean>> => {
      const { data, error } = await supabase.rpc('minhas_permissoes');
      if (error) throw error;
      const mapa: Record<string, boolean> = {};
      (data ?? []).forEach((r: { rota: string; permitido: boolean }) => { mapa[r.rota] = r.permitido; });
      return mapa;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface OverridePermissao {
  usuario_id: string;
  rota: string;
  permitido: boolean;
}

/** Gerencia os overrides individuais de UM usuário (tela de Configurações). */
export function usePermissoesDoUsuario(usuarioId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['permissoes-usuario', usuarioId],
    queryFn: async (): Promise<OverridePermissao[]> => {
      if (!usuarioId) return [];
      const { data, error } = await supabase
        .from('permissoes_usuario')
        .select('usuario_id, rota, permitido')
        .eq('usuario_id', usuarioId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!usuarioId,
  });

  const definir = useMutation({
    mutationFn: async ({ rota, permitido }: { rota: string; permitido: boolean }) => {
      if (!usuarioId) return;
      const { error } = await supabase
        .from('permissoes_usuario')
        .upsert({ usuario_id: usuarioId, rota, permitido }, { onConflict: 'usuario_id,rota' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissoes-usuario', usuarioId] });
      qc.invalidateQueries({ queryKey: ['minhas-permissoes'] });
    },
  });

  // Remove o override — volta a seguir o padrão do cargo pra essa rota.
  const remover = useMutation({
    mutationFn: async (rota: string) => {
      if (!usuarioId) return;
      const { error } = await supabase
        .from('permissoes_usuario')
        .delete()
        .eq('usuario_id', usuarioId)
        .eq('rota', rota);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissoes-usuario', usuarioId] });
      qc.invalidateQueries({ queryKey: ['minhas-permissoes'] });
    },
  });

  return {
    ...query,
    definir: definir.mutateAsync,
    remover: remover.mutateAsync,
  };
}
