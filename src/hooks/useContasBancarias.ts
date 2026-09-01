// src/hooks/useContasBancarias.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export type TipoConta = 'caixa' | 'corrente' | 'poupanca' | 'cartao' | 'pix' | 'outro';

export interface ContaBancaria {
  id: string;
  nome: string;
  tipo: TipoConta;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  saldo_inicial: number;
  ativo: boolean;
  ordem: number;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const TIPO_CONTA: Record<TipoConta, { label: string; cor: string; bg: string }> = {
  caixa:    { label: 'Caixa',         cor: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30' },
  corrente: { label: 'Conta Corrente', cor: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30' },
  poupanca: { label: 'Poupança',       cor: 'text-teal-400',   bg: 'bg-teal-500/15 border-teal-500/30' },
  cartao:   { label: 'Cartão',         cor: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
  pix:      { label: 'PIX',            cor: 'text-cyan-400',   bg: 'bg-cyan-500/15 border-cyan-500/30' },
  outro:    { label: 'Outro',          cor: 'text-gray-400',   bg: 'bg-gray-500/15 border-gray-500/30' },
};

type Payload = Omit<ContaBancaria, 'id' | 'created_at' | 'updated_at'>;

export function useContasBancarias() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['contas-bancarias'],
    queryFn: async (): Promise<ContaBancaria[]> => {
      const { data, error } = await supabase
        .from('contas_bancarias')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: Payload) => {
      const { data, error } = await supabase
        .from('contas_bancarias')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as ContaBancaria;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] });
      toast.success('Conta criada!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Payload> }) => {
      const { error } = await supabase
        .from('contas_bancarias')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] });
      toast.success('Conta atualizada!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contas_bancarias')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] });
      toast.success('Conta removida.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:     criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar:   deletar.mutate,
    isSaving:  criar.isPending || atualizar.isPending,
  };
}

/** Calcula saldo atual de uma conta: saldo_inicial + entradas - saídas */
export function useSaldoContas() {
  const { data: contas = [] } = useContasBancarias();

  const query = useQuery({
    queryKey: ['saldo-contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('conta_id, tipo, valor');
      if (error) throw error;
      return data ?? [];
    },
  });

  const movimentos = query.data ?? [];

  const saldos = contas
    .filter(c => c.ativo)
    .map(c => {
      const movsConta = movimentos.filter(m => m.conta_id === c.id);
      const entradas  = movsConta.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
      const saidas    = movsConta.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
      const saldo     = Number(c.saldo_inicial) + entradas - saidas;
      return { ...c, entradas, saidas, saldo };
    });

  const totalGeral = saldos.reduce((s, c) => s + c.saldo, 0);

  return { saldos, totalGeral, isLoading: query.isLoading || !contas.length };
}

/**
 * Saldo do CAIXA FÍSICO especificamente (não soma banco/pix/cartão). Usa
 * só as contas do tipo 'caixa' como ponto de partida, mais os movimentos
 * de caixa_movimentos sem conta vinculada (o padrão hoje) ou vinculados
 * explicitamente a uma conta do tipo 'caixa'.
 */
export function useSaldoCaixaFisico() {
  const { data: contas = [] } = useContasBancarias();

  const query = useQuery({
    queryKey: ['saldo-caixa-fisico'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('conta_id, tipo, valor');
      if (error) throw error;
      return data ?? [];
    },
  });

  const contasCaixa = contas.filter(c => c.ativo && c.tipo === 'caixa');
  const idsContasCaixa = new Set(contasCaixa.map(c => c.id));
  const saldoInicial = contasCaixa.reduce((s, c) => s + Number(c.saldo_inicial ?? 0), 0);

  const movimentos = (query.data ?? []).filter(m => !m.conta_id || idsContasCaixa.has(m.conta_id));
  const entradas = movimentos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const saidas   = movimentos.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const saldo    = saldoInicial + entradas - saidas;

  return { saldo, isLoading: query.isLoading || !contas.length };
}
