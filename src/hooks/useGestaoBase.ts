// src/hooks/useGestaoBase.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CustoFixo, Depreciacao } from '../types/financeiro';
import toast from 'react-hot-toast';

// ── Custos Fixos ─────────────────────────────────────────────────────────────
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custos-fixos'] });
      qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] });
      toast.success('Custo criado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<CustoFixo> }) => {
      const { error } = await supabase
        .from('custos_fixos')
        .update({ ...dados, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custos-fixos'] });
      qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] });
      toast.success('Atualizado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custos_fixos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custos-fixos'] });
      qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] });
      toast.success('Removido.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:    criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar:  deletar.mutate,
  };
}

// ── Depreciação ───────────────────────────────────────────────────────────────
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depreciacao'] });
      qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] });
      toast.success('Depreciação criada!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<Depreciacao> }) => {
      const { error } = await supabase
        .from('depreciacao')
        .update({ ...dados, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depreciacao'] });
      qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] });
      toast.success('Atualizado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('depreciacao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depreciacao'] });
      qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] });
      toast.success('Removido.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:    criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar:  deletar.mutate,
  };
}

// ── Custos Variáveis ─────────────────────────────────────────────────────────
export interface CustoVariavel {
  id: string;
  nome: string;
  categoria?: string | null;
  valor: number;
  mes_referencia: string; // 'YYYY-MM'
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function useCustosVariaveis(mes?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['custos-variaveis', mes],
    queryFn: async (): Promise<CustoVariavel[]> => {
      let q = supabase.from('custos_variaveis').select('*').order('nome');
      if (mes) q = q.eq('mes_referencia', mes);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (p: Omit<CustoVariavel, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('custos_variaveis').insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custos-variaveis'] });
      toast.success('Custo variável criado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<CustoVariavel> }) => {
      const { error } = await supabase
        .from('custos_variaveis')
        .update({ ...dados, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custos-variaveis'] });
      toast.success('Atualizado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custos_variaveis').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custos-variaveis'] });
      toast.success('Removido.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:    criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar:  deletar.mutate,
    isSaving: criar.isPending || atualizar.isPending,
  };
}
