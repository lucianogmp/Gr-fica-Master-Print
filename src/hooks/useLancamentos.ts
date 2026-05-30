import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Lancamento, StatusLancamento } from '../types/financeiro';
import toast from 'react-hot-toast';

type Payload = Omit<Lancamento, 'id' | 'created_at'>;

export function useLancamentos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['lancamentos'],
    queryFn: async (): Promise<Lancamento[]> => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: Payload) => {
      const { data, error } = await supabase.from('lancamentos').insert(payload).select().single();
      if (error) throw error;
      return data as Lancamento;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lancamentos'] }); toast.success('Lançamento criado!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Payload> }) => {
      const { error } = await supabase.from('lancamentos').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lancamentos'] }); toast.success('Atualizado!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const pagarLancamento = useMutation({
    mutationFn: async ({ id, forma }: { id: string; forma?: string }) => {
      const { error } = await supabase.from('lancamentos').update({
        status: 'pago',
        data_pagamento: new Date().toISOString().split('T')[0],
        ...(forma ? { forma_pagamento: forma } : {}),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lancamentos'] }); toast.success('Marcado como pago!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lancamentos'] }); toast.success('Removido.'); },
    onError:   (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:    criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    pagar:    pagarLancamento.mutate,
    deletar:  deletar.mutate,
    isSaving: criar.isPending || atualizar.isPending,
  };
}
