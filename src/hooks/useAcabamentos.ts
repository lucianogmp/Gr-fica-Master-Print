import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface Acabamento {
  id: string;
  nome: string;
  custo: number;
  ativo: boolean;
}

export function useAcabamentos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['acabamentos'],
    queryFn: async (): Promise<Acabamento[]> => {
      const { data, error } = await supabase
        .from('acabamentos')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (p: Omit<Acabamento, 'id'>) => {
      const { error } = await supabase.from('acabamentos').insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['acabamentos'] }); toast.success('Acabamento criado!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<Acabamento> }) => {
      const { error } = await supabase.from('acabamentos').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['acabamentos'] }); toast.success('Salvo!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('acabamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acabamentos'] }),
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, criar: criar.mutateAsync, atualizar: atualizar.mutateAsync, deletar: deletar.mutate };
}
