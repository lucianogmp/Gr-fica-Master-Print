import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Categoria } from '../types/produto';
import toast from 'react-hot-toast';

/** Categorias têm duas listas independentes: 'produto' (catálogo/vendas) e 'material' (matérias-primas do estoque). */
export type TipoCategoria = 'produto' | 'material';

export function useCategorias(tipo: TipoCategoria = 'produto') {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['categorias', tipo],
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('tipo', tipo)
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase
        .from('categorias')
        .insert({ nome: nome.trim(), tipo })
        .select()
        .single();
      if (error) throw error;
      return data as Categoria;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categorias'] }); toast.success('Categoria criada!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, nome, nomeAnterior }: { id: string; nome: string; nomeAnterior?: string }) => {
      const { error } = await supabase.from('categorias').update({ nome }).eq('id', id);
      if (error) throw error;
      // Matéria-prima guarda a categoria pelo NOME: ao renomear, acompanha para não perder o vínculo.
      if (tipo === 'material' && nomeAnterior && nomeAnterior !== nome) {
        const { error: e2 } = await supabase.from('materias_primas').update({ categoria: nome }).eq('categoria', nomeAnterior);
        if (e2) throw e2;
        qc.invalidateQueries({ queryKey: ['materias_primas'] });
        qc.invalidateQueries({ queryKey: ['materias-primas'] });
      }
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
