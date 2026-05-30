import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CustoFixo, Depreciacao } from '../types/financeiro';
import toast from 'react-hot-toast';

export function useCustosFixos() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['custos-fixos'],
    queryFn: async (): Promise<CustoFixo[]> => {
      const { data, error } = await supabase.from('custos_fixos').select('*').order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
  const criar = useMutation({
    mutationFn: async (p: Omit<CustoFixo, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('custos_fixos').insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custos-fixos'] }); qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] }); toast.success('Custo criado!'); },
    onError: (e: any) => toast.error(e.message),
  });
  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<CustoFixo> }) => {
      const { error } = await supabase.from('custos_fixos').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custos-fixos'] }); qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custos_fixos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custos-fixos'] }); qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return { ...query, criar: criar.mutateAsync, atualizar: atualizar.mutateAsync, deletar: deletar.mutate };
}

export function useDepreciacao() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['depreciacao'],
    queryFn: async (): Promise<Depreciacao[]> => {
      const { data, error } = await supabase.from('depreciacao').select('*').order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
  const criar = useMutation({
    mutationFn: async (p: Omit<Depreciacao, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('depreciacao').insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['depreciacao'] }); qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] }); toast.success('Depreciação criada!'); },
    onError: (e: any) => toast.error(e.message),
  });
  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('depreciacao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['depreciacao'] }); qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return { ...query, criar: criar.mutateAsync, deletar: deletar.mutate };
}
