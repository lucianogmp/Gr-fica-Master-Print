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
    mutationFn: async (cliente: Omit<Cliente, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('clientes').insert(cliente);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente criado!');
    },
    onError: () => toast.error('Erro ao criar cliente.'),
  });

  return {
    ...query,
    deleteCliente: deleteMutation.mutate,
    createCliente: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
