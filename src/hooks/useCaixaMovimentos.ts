// src/hooks/useCaixaMovimentos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface CaixaMovimento {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  data: string;
  descricao?: string | null;
  cliente_nome?: string | null;
  observacoes?: string | null;
  origem?: string | null;
  venda_id?: string | null;
  conta_id?: string | null;   // ← novo: vínculo com conta bancária
  /** Presente só em movimentos gerados por transferência entre contas — liga
   *  a saída (conta origem) com a entrada (conta destino) do mesmo evento. */
  transferencia_id?: string | null;
  // Quem lançou — preenchido automático pelo banco (nunca pelo formulário).
  criado_por_id?: string | null;
  criado_por_email?: string | null;
  created_at?: string;
}

type Payload = Omit<CaixaMovimento, 'id' | 'created_at'>;

export function useCaixaMovimentos() {
  const qc = useQueryClient();

  const KEYS = ['caixa-movimentos'];
  function invalidar() {
    qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
    qc.invalidateQueries({ queryKey: ['saldo-contas'] });
    qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
  }

  const query = useQuery({
    queryKey: KEYS,
    queryFn: async (): Promise<CaixaMovimento[]> => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .order('data', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: Payload) => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as CaixaMovimento;
    },
    onSuccess: () => { invalidar(); toast.success('Movimento registrado!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Payload> }) => {
      const { error } = await supabase
        .from('caixa_movimentos')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success('Movimento atualizado!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      // Se for um dos lados de uma transferência, remove o par inteiro —
      // apagar só um lado deixaria o saldo desbalanceado entre as contas.
      const { data: mov } = await supabase.from('caixa_movimentos').select('transferencia_id').eq('id', id).maybeSingle();
      if (mov?.transferencia_id) {
        const { error } = await supabase.from('caixa_movimentos').delete().eq('transferencia_id', mov.transferencia_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('caixa_movimentos').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidar(); toast.success('Movimento removido.'); },
    onError:   (e: any) => toast.error(e.message),
  });

  /** Transferência entre contas — não é receita nem despesa, só move saldo. */
  const transferir = useMutation({
    mutationFn: async (params: {
      contaOrigemId: string;
      contaDestinoId: string;
      valor: number;
      data: string;
      observacoes?: string | null;
      nomeOrigem: string;
      nomeDestino: string;
    }) => {
      const { contaOrigemId, contaDestinoId, valor, data, observacoes, nomeOrigem, nomeDestino } = params;
      if (!contaOrigemId || !contaDestinoId) throw new Error('Selecione as duas contas.');
      if (contaOrigemId === contaDestinoId) throw new Error('A conta de origem e destino não podem ser a mesma.');
      if (!valor || valor <= 0) throw new Error('Informe um valor válido.');

      const transferenciaId = crypto.randomUUID();
      const descricaoBase = `Transferência: ${nomeOrigem} → ${nomeDestino}`;

      const { error } = await supabase.from('caixa_movimentos').insert([
        {
          tipo: 'saida', valor, data, conta_id: contaOrigemId,
          descricao: descricaoBase, observacoes: observacoes || null,
          origem: 'transferencia', transferencia_id: transferenciaId,
        },
        {
          tipo: 'entrada', valor, data, conta_id: contaDestinoId,
          descricao: descricaoBase, observacoes: observacoes || null,
          origem: 'transferencia', transferencia_id: transferenciaId,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success('Transferência registrada!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:      criar.mutateAsync,
    atualizar:  atualizar.mutateAsync,
    deletar:    deletar.mutate,
    transferir: transferir.mutateAsync,
    isSaving:      criar.isPending || atualizar.isPending,
    isTransferindo: transferir.isPending,
  };
}
