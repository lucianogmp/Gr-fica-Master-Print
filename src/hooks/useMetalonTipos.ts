import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface MetalonTipo {
  id: string;
  nome: string;
  custo_por_metro: number;
  ativo: boolean;
}

export function useMetalonTipos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['metalon-tipos'],
    queryFn: async (): Promise<MetalonTipo[]> => {
      const { data, error } = await supabase
        .from('metalon_tipos')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (p: Omit<MetalonTipo, 'id'>) => {
      const { error } = await supabase.from('metalon_tipos').insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['metalon-tipos'] }); toast.success('Metalon cadastrado!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<MetalonTipo> }) => {
      const { error } = await supabase.from('metalon_tipos').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['metalon-tipos'] }); toast.success('Salvo!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('metalon_tipos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metalon-tipos'] }),
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, criar: criar.mutateAsync, atualizar: atualizar.mutateAsync, deletar: deletar.mutate };
}
