// src/hooks/useClientes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Cliente } from '../types/cliente';
import toast from 'react-hot-toast';

export function useClientes() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['clientes'],
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente removido.');
    },
    onError: () => toast.error('Erro ao remover cliente.'),
  });

  const createMutation = useMutation({
    mutationFn: async (cliente: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('clientes').insert(cliente).select().single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente criado!');
    },
    onError: () => toast.error('Erro ao criar cliente.'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Cliente> }) => {
      const { error } = await supabase
        .from('clientes')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar cliente.'),
  });

  return {
    ...query,
    deleteCliente: deleteMutation.mutate,
    createCliente: createMutation.mutateAsync,
    updateCliente: updateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}

export function useCliente(id: string | null) {
  return useQuery({
    queryKey: ['cliente', id],
    enabled: !!id,
    queryFn: async (): Promise<Cliente | null> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
