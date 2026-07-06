// src/hooks/useAtendimentos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Atendimento } from '../types/atendimento';
import toast from 'react-hot-toast';

type AtendimentoPayload = Omit<Atendimento, 'id' | 'created_at' | 'updated_at'>;

/** Todos os atendimentos do sistema, com nome do cliente/lead — usado em CRM > Histórico de Atendimento */
export function useAtendimentos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['atendimentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*, clientes(id, nome), leads(id, nome), contatos(id, nome)')
        .order('data_atendimento', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Atendimento & {
        clientes: { id: string; nome: string } | null;
        leads: { id: string; nome: string } | null;
        contatos: { id: string; nome: string } | null;
      })[];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: AtendimentoPayload) => {
      const { error } = await supabase.from('atendimentos').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atendimentos'] });
      toast.success('Atendimento registrado!');
    },
    onError: () => toast.error('Erro ao registrar atendimento.'),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<AtendimentoPayload> }) => {
      const { error } = await supabase
        .from('atendimentos')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atendimentos'] });
      toast.success('Atendimento atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar atendimento.'),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('atendimentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atendimentos'] });
      toast.success('Atendimento removido.');
    },
    onError: () => toast.error('Erro ao remover atendimento.'),
  });

  return {
    ...query,
    criar:     criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar:   deletar.mutate,
    isSaving:  criar.isPending || atualizar.isPending,
  };
}
