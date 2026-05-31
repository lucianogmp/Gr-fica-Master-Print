import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface MaterialImpressao {
  id: string;
  nome: string;
  preco_m2: number;
  ativo: boolean;
}

export function useMateriaisImpressao() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['materiais-impressao'],
    queryFn: async (): Promise<MaterialImpressao[]> => {
      const { data, error } = await supabase
        .from('materiais_impressao')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (p: Omit<MaterialImpressao, 'id'>) => {
      const { error } = await supabase.from('materiais_impressao').insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materiais-impressao'] }); toast.success('Material criado!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<MaterialImpressao> }) => {
      const { error } = await supabase.from('materiais_impressao').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materiais-impressao'] }); toast.success('Salvo!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('materiais_impressao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materiais-impressao'] }),
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar: criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar: deletar.mutate,
  };
}
