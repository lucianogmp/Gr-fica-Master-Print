import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Configuracoes } from '../types/configuracoes';
import toast from 'react-hot-toast';

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
