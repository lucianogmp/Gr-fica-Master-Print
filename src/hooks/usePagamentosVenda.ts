// src/hooks/usePagamentosVenda.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { PagamentoVenda } from '../types/venda';
import toast from 'react-hot-toast';

const origemPagamento = (pagamentoId: string) => `pagamento_venda:${pagamentoId}`;

function totalVenda(venda: any) {
  return Number(venda?.valor_total ?? venda?.total ?? 0);
}

async function recalcularFinanceiroVenda(vendaId: string) {
  const [{ data: venda }, { data: pagamentos }] = await Promise.all([
    supabase
      .from('vendas')
      .select('id,numero,cliente_nome,valor_total,total,data_entrega,forma_pagamento')
      .eq('id', vendaId)
      .single(),
    supabase
      .from('pagamentos_venda')
      .select('valor')
      .eq('venda_id', vendaId),
  ]);

  const totalPago = (pagamentos ?? []).reduce(
    (s, p) => s + Number(p.valor ?? 0),
    0
  );
  const restante = Math.max(0, totalVenda(venda) - totalPago);
  const descricao = `Venda #${venda?.numero ?? 'S/N'} — ${venda?.cliente_nome ?? 'Cliente'}`;

  await supabase
    .from('vendas')
    .update({ valor_pago: totalPago })
    .eq('id', vendaId);

  const { data: pendenteExistente } = await supabase
    .from('lancamentos')
    .select('id')
    .eq('venda_id', vendaId)
    .eq('tipo', 'receita')
    .is('origem', null)
    .maybeSingle();

  if (restante > 0.009) {
    const payload = {
      tipo: 'receita',
      descricao,
      valor: restante,
      status: 'pendente',
      categoria: 'Venda',
      cliente_nome: venda?.cliente_nome ?? null,
      venda_id: vendaId,
      data_vencimento: venda?.data_entrega ?? new Date().toISOString().slice(0, 10),
      data_pagamento: null,
      forma_pagamento: null,
    };

    if (pendenteExistente?.id) {
      await supabase
        .from('lancamentos')
        .update(payload)
        .eq('id', pendenteExistente.id);
    } else {
      await supabase
        .from('lancamentos')
        .insert(payload);
    }
  } else if (pendenteExistente?.id) {
    await supabase
      .from('lancamentos')
      .delete()
      .eq('id', pendenteExistente.id);
  }

  return { venda, totalPago };
}

export function usePagamentosVenda(vendaId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['pagamentos-venda', vendaId],
    enabled: !!vendaId && vendaId !== '__novo__',
    queryFn: async (): Promise<PagamentoVenda[]> => {
      const { data, error } = await supabase
        .from('pagamentos_venda')
        .select('*')
        .eq('venda_id', vendaId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const registrar = useMutation({
    mutationFn: async (pag: Omit<PagamentoVenda, 'id' | 'created_at'>) => {
      const { data: venda } = await supabase
        .from('vendas')
        .select('id,numero,cliente_nome,valor_total,total,data_entrega')
        .eq('id', pag.venda_id)
        .single();

      const { data, error } = await supabase
        .from('pagamentos_venda')
        .insert(pag)
        .select()
        .single();
      if (error) throw error;

      const origem = origemPagamento((data as PagamentoVenda).id);
      const descricao = `Pagamento ref. Venda #${venda?.numero || 'S/N'}`;

      await supabase
        .from('caixa_movimentos')
        .insert({
          tipo: 'entrada',
          valor: pag.valor,
          data: pag.data_pagamento,
          cliente_nome: venda?.cliente_nome || null,
          descricao,
          venda_id: pag.venda_id,
          origem,
        });

      await supabase
        .from('lancamentos')
        .insert({
          tipo: 'receita',
          descricao,
          valor: pag.valor,
          status: 'pago',
          categoria: 'Venda',
          cliente_nome: venda?.cliente_nome || null,
          venda_id: pag.venda_id,
          data_vencimento: pag.data_pagamento,
          data_pagamento: pag.data_pagamento,
          forma_pagamento: pag.forma_pagamento,
          observacoes: pag.observacoes ?? null,
          origem,
        });

      await recalcularFinanceiroVenda(pag.venda_id);

      return data as PagamentoVenda;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pagamentos-venda', vars.venda_id] });
      qc.invalidateQueries({ queryKey: ['vendas'] });
      qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      toast.success('Pagamento registrado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async ({ id, vendaId }: { id: string; vendaId: string }) => {
      const origem = origemPagamento(id);

      const { error } = await supabase
        .from('pagamentos_venda')
        .delete()
        .eq('id', id);
      if (error) throw error;

      await supabase
        .from('lancamentos')
        .delete()
        .eq('origem', origem);

      await supabase
        .from('caixa_movimentos')
        .delete()
        .eq('origem', origem);

      await recalcularFinanceiroVenda(vendaId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pagamentos-venda', vars.vendaId] });
      qc.invalidateQueries({ queryKey: ['vendas'] });
      qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      toast.success('Pagamento removido.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    registrar: async (pag: Omit<PagamentoVenda, 'id' | 'created_at'>) => {
      await registrar.mutateAsync(pag);
    },
    excluir: (id: string, vendaId: string) => {
      excluir.mutate({ id, vendaId });
    },
    isRegistrando: registrar.isPending,
  };
}
