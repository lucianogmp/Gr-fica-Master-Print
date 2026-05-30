import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Categoria } from '../types/produto';
import toast from 'react-hot-toast';

export function useCategorias() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['categorias'],
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase
        .from('categorias')
        .insert({ nome: nome.trim() })
        .select()
        .single();
      if (error) throw error;
      return data as Categoria;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categorias'] }); toast.success('Categoria criada!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from('categorias').update({ nome }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categorias'] }); toast.success('Categoria salva!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categorias'] }); },
    onError:   (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar: criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar: deletar.mutateAsync,
  };
}
