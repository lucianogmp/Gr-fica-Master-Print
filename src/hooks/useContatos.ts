// src/hooks/useContatos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Contato } from '../types/contato';
import toast from 'react-hot-toast';

type ContatoPayload = Omit<Contato, 'id' | 'created_at' | 'updated_at'>;

/** Contatos de um cliente específico — usado dentro da ficha do cliente */
export function useContatos(clienteId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['contatos', clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<Contato[]> => {
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('cliente_id', clienteId!)
        .order('nome', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: ContatoPayload) => {
      const { error } = await supabase.from('contatos').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contatos', clienteId] });
      qc.invalidateQueries({ queryKey: ['contatos-todos'] });
      toast.success('Contato adicionado!');
    },
    onError: () => toast.error('Erro ao adicionar contato.'),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ContatoPayload> }) => {
      const { error } = await supabase
        .from('contatos')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contatos', clienteId] });
      qc.invalidateQueries({ queryKey: ['contatos-todos'] });
      toast.success('Contato atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar contato.'),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contatos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contatos', clienteId] });
      qc.invalidateQueries({ queryKey: ['contatos-todos'] });
      toast.success('Contato removido.');
    },
    onError: () => toast.error('Erro ao remover contato.'),
  });

  return {
    ...query,
    criar:     criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar:   deletar.mutate,
    isSaving:  criar.isPending || atualizar.isPending,
  };
}

/** Todos os contatos do sistema, com dados do cliente — usado na tela CRM > Contatos */
export function useContatosTodos() {
  return useQuery({
    queryKey: ['contatos-todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contatos')
        .select('*, clientes(id, nome)')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []) as (Contato & { clientes: { id: string; nome: string } | null })[];
    },
  });
}
