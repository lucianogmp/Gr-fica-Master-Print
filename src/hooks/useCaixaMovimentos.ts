// src/hooks/useCaixaMovimentos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface CaixaMovimento {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  data: string;
  descricao?: string | null;
  cliente_nome?: string | null;
  observacoes?: string | null;
  origem?: string | null;
  venda_id?: string | null;
  created_at?: string;
}

type Payload = Omit<CaixaMovimento, 'id' | 'created_at'>;

export function useCaixaMovimentos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['caixa-movimentos'],
    queryFn: async (): Promise<CaixaMovimento[]> => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .order('data', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: Payload) => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as CaixaMovimento;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success('Movimento registrado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Payload> }) => {
      const { error } = await supabase
        .from('caixa_movimentos')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success('Movimento atualizado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('caixa_movimentos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success('Movimento removido.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:    criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar:  deletar.mutate,
    isSaving: criar.isPending || atualizar.isPending,
  };
}
