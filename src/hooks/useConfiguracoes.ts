import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Configuracoes } from '../types/configuracoes';
import toast from 'react-hot-toast';

export function useSalvarToken() {
  return useMutation({
    mutationFn: async ({ nome, valor }: { nome: string; valor: string }) => {
      const { error } = await supabase.rpc('salvar_token', {
        p_nome: nome,
        p_valor: valor,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Token salvo com segurança no Vault!'),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useConfiguracoes() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['configuracoes'],
    queryFn: async (): Promise<Configuracoes | null> => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const salvar = useMutation({
    mutationFn: async (payload: Partial<Configuracoes>) => {
      const id = query.data?.id;
      if (id) {
        const { error } = await supabase
          .from('configuracoes')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracoes')
          .insert({ ...payload, id: 'default' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuracoes'] });
      qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] });
      toast.success('Configurações salvas!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    salvar: salvar.mutateAsync,
    isSaving: salvar.isPending,
  };
}

/**
 * `configuracoes` só é legível por dono/admin (guarda tokens sensíveis).
 * O Orçamento de Placa também é usado por vendedor, que só precisa desses
 * 4 valores — por isso passa pela RPC `obter_config_serralheria`, em vez
 * de ler a tabela inteira via useConfiguracoes().
 */
export interface ConfigSerralheria {
  mao_obra_serralheria_pct: number;
  mao_obra_instalacao_esticar: number;
  mao_obra_instalacao_completa: number;
  espacamento_travessa_padrao_m: number;
}

const CONFIG_SERRALHERIA_PADRAO: ConfigSerralheria = {
  mao_obra_serralheria_pct: 30,
  mao_obra_instalacao_esticar: 50,
  mao_obra_instalacao_completa: 100,
  espacamento_travessa_padrao_m: 1.0,
};

export function useConfigSerralheria() {
  return useQuery({
    queryKey: ['config-serralheria'],
    queryFn: async (): Promise<ConfigSerralheria> => {
      const { data, error } = await supabase.rpc('obter_config_serralheria').single();
      if (error) throw error;
      return (data as ConfigSerralheria) ?? CONFIG_SERRALHERIA_PADRAO;
    },
    staleTime: 1000 * 60 * 5,
  });
}
