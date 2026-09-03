import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Lancamento, StatusLancamento } from '../types/financeiro';
import { createErrorMessage } from '../utils/errorHandler';
import toast from 'react-hot-toast';

type Payload = Omit<Lancamento, 'id' | 'created_at'>;

export function useLancamentos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['lancamentos'],
    queryFn: async (): Promise<Lancamento[]> => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: Payload) => {
      const { data, error } = await supabase.from('lancamentos').insert(payload).select().single();
      if (error) throw error;
      const lanc = data as Lancamento;

      // Se já nasce marcado como pago (modal permite isso direto), lança o
      // movimento de caixa também — senão o saldo da conta nunca sabe disso.
      if (lanc.status === 'pago' && lanc.conta_id) {
        await supabase.from('caixa_movimentos').insert({
          data:          lanc.data_pagamento || new Date().toISOString().split('T')[0],
          tipo:          lanc.tipo === 'receita' ? 'entrada' : 'saida',
          descricao:     lanc.descricao,
          cliente_nome:  lanc.cliente_nome ?? null,
          valor:         lanc.valor,
          venda_id:      lanc.venda_id ?? null,
          conta_id:      lanc.conta_id,
          lancamento_id: lanc.id,
          origem:        'lancamento',
        });
      }
      return lanc;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      qc.invalidateQueries({ queryKey: ['saldo-contas'] });
      toast.success('Lançamento criado!');
    },
    onError: (e: any) => toast.error(createErrorMessage(e)),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Payload> }) => {
      const { error } = await supabase.from('lancamentos').update(payload).eq('id', id);
      if (error) throw error;

      if ('status' in payload) {
        const { data: movExistente } = await supabase
          .from('caixa_movimentos').select('id').eq('lancamento_id', id).maybeSingle();

        if (payload.status === 'pago' && payload.conta_id) {
          const patchMov: Record<string, any> = {
            valor:      payload.valor,
            conta_id:   payload.conta_id,
            data:       payload.data_pagamento || new Date().toISOString().split('T')[0],
            descricao:  payload.descricao,
            tipo:       payload.tipo === 'receita' ? 'entrada' : 'saida',
          };
          if (movExistente) {
            await supabase.from('caixa_movimentos').update(patchMov).eq('id', movExistente.id);
          } else {
            await supabase.from('caixa_movimentos').insert({
              ...patchMov, lancamento_id: id, origem: 'lancamento',
              cliente_nome: payload.cliente_nome ?? null, venda_id: payload.venda_id ?? null,
            });
          }
        } else if (payload.status !== 'pago' && movExistente) {
          // Voltou pra pendente/atrasado/cancelado — o movimento de caixa não
          // deve mais existir, senão o saldo da conta continua contando um
          // dinheiro que não está mais confirmado.
          await supabase.from('caixa_movimentos').delete().eq('id', movExistente.id);
        }
      } else {
        // Edição comum (sem mexer no status) — só sincroniza o movimento já
        // existente, se houver, com os campos que mudaram.
        const tocaSaldo = 'valor' in payload || 'conta_id' in payload || 'data_pagamento' in payload
          || 'descricao' in payload || 'tipo' in payload;
        if (tocaSaldo) {
          const patchMov: Record<string, any> = {};
          if ('valor' in payload)          patchMov.valor = payload.valor;
          if ('conta_id' in payload)       patchMov.conta_id = payload.conta_id;
          if ('data_pagamento' in payload) patchMov.data = payload.data_pagamento;
          if ('descricao' in payload)      patchMov.descricao = payload.descricao;
          if ('tipo' in payload)           patchMov.tipo = payload.tipo === 'receita' ? 'entrada' : 'saida';
          if (Object.keys(patchMov).length > 0) {
            await supabase.from('caixa_movimentos').update(patchMov).eq('lancamento_id', id);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      qc.invalidateQueries({ queryKey: ['saldo-contas'] });
      toast.success('Atualizado!');
    },
    onError: (e: any) => toast.error(createErrorMessage(e)),
  });

  /** Marca como pago/recebido E lança o movimento na conta financeira escolhida —
   *  antes disso o saldo por conta nunca era atualizado ao pagar um lançamento. */
  const pagarLancamento = useMutation({
    mutationFn: async (params: {
      id: string;
      contaId: string;
      lancamento: Pick<Lancamento, 'tipo' | 'valor' | 'descricao' | 'cliente_nome' | 'venda_id'>;
      forma?: string;
      data?: string;
    }) => {
      const { id, contaId, lancamento, forma, data } = params;
      if (!contaId) throw new Error('Selecione a conta financeira antes de confirmar o pagamento.');

      const dataPagamento = data || new Date().toISOString().split('T')[0];

      const { error: errLanc } = await supabase.from('lancamentos').update({
        status: 'pago',
        data_pagamento: dataPagamento,
        conta_id: contaId,
        ...(forma ? { forma_pagamento: forma } : {}),
      }).eq('id', id);
      if (errLanc) throw errLanc;

      const { error: errMov } = await supabase.from('caixa_movimentos').insert({
        data:          dataPagamento,
        tipo:          lancamento.tipo === 'receita' ? 'entrada' : 'saida',
        descricao:     lancamento.descricao,
        cliente_nome:  lancamento.cliente_nome ?? null,
        valor:         lancamento.valor,
        venda_id:      lancamento.venda_id ?? null,
        conta_id:      contaId,
        lancamento_id: id,
        origem:        'lancamento',
      });
      if (errMov) throw errMov;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      qc.invalidateQueries({ queryKey: ['saldo-contas'] });
      qc.invalidateQueries({ queryKey: ['saldo-caixa-fisico'] });
      toast.success('Marcado como pago!');
    },
    onError: (e: any) => toast.error(createErrorMessage(e)),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      // Remove primeiro o movimento de caixa vinculado (se existir), pra não deixar
      // saldo "fantasma" numa conta depois que o lançamento for excluído.
      await supabase.from('caixa_movimentos').delete().eq('lancamento_id', id);
      const { error } = await supabase.from('lancamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      qc.invalidateQueries({ queryKey: ['saldo-contas'] });
      toast.success('Removido.');
    },
    onError: (e: any) => toast.error(createErrorMessage(e)),
  });

  return {
    ...query,
    criar:    criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    pagar:    pagarLancamento.mutateAsync,
    deletar:  deletar.mutate,
    isSaving: criar.isPending || atualizar.isPending,
    isPagando: pagarLancamento.isPending,
  };
}
