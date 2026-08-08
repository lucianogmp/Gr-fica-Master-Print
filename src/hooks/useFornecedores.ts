// src/hooks/useFornecedores.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Fornecedor } from '../types/fornecedor';
import toast from 'react-hot-toast';
import { createErrorMessage } from '../utils/errorHandler';

export function useFornecedores() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async (): Promise<Fornecedor[]> => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fornecedores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor removido.');
    },
    onError: (e: any) => toast.error(createErrorMessage(e)),
  });

  const createMutation = useMutation({
    mutationFn: async (fornecedor: Omit<Fornecedor, 'id' | 'created_at' | 'updated_at' | 'ativo'>) => {
      const { data, error } = await supabase.from('fornecedores').insert(fornecedor).select().single();
      if (error) throw error;
      return data as Fornecedor;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor criado!');
    },
    onError: (e: any) => toast.error(createErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Fornecedor> }) => {
      const { error } = await supabase
        .from('fornecedores')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor atualizado!');
    },
    onError: (e: any) => toast.error(createErrorMessage(e)),
  });

  return {
    ...query,
    deleteFornecedor: deleteMutation.mutate,
    createFornecedor: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateFornecedor: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
