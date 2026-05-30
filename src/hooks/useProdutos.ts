import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Produto } from '../types/produto';
import toast from 'react-hot-toast';

type ProdutoPayload = Omit<Produto, 'id' | 'created_at' | 'updated_at' | 'empresa_id'>;

export function useProdutos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['produtos'],
    queryFn: async (): Promise<Produto[]> => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*, categorias(id, nome)')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: ProdutoPayload) => {
      const { data, error } = await supabase
        .from('produtos')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Produto;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['produtos'] }); toast.success('Produto salvo!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ProdutoPayload> }) => {
      const { error } = await supabase.from('produtos').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['produtos'] }); toast.success('Produto atualizado!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('produto_materias').delete().eq('produto_id', id);
      const { error } = await supabase.from('produtos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['produtos'] }); toast.success('Produto removido.'); },
    onError:   (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:    criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar:  deletar.mutateAsync,
    isSaving: criar.isPending || atualizar.isPending,
  };
}
