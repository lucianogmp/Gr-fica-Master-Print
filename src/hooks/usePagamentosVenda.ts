// src/hooks/usePagamentosVenda.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { PagamentoVenda } from '../types/venda';
import toast from 'react-hot-toast';

const origemPagamento = (pagamentoId: string) => `pagamento_venda:${pagamentoId}`;

// Recalcula o financeiro da venda com base nos pagamentos registrados.
// Regra: taxa da maquininha é desconto definitivo do vendedor, não restante do cliente.
async function recalcularFinanceiroVenda(vendaId: string) {
  // 1. Busca venda (valor original sem alterações de taxa) e todos os pagamentos
  const [{ data: venda }, { data: pagamentos }] = await Promise.all([
    supabase
      .from('vendas')
      .select('id,numero,cliente_nome,valor_original,valor_total,total,data_entrega,forma_pagamento')
      .eq('id', vendaId)
      .single(),
    supabase
      .from('pagamentos_venda')
      .select('valor,juros_pct')
      .eq('venda_id', vendaId),
  ]);

  // valor_original guarda o valor puro da venda sem nenhuma taxa de maquininha
  // Se não existir ainda, usa valor_total atual como base
  const totalOriginal = Number(venda?.valor_original ?? venda?.valor_total ?? venda?.total ?? 0);

  // 2. Calcula taxa total absorvida pela maquininha em todos os pagamentos
  const taxaTotal = (pagamentos ?? []).reduce((s, p) => {
    const taxa = Number(p.juros_pct ?? 0);
    return taxa > 0 ? s + (Number(p.valor) * taxa / 100) : s;
  }, 0);

  // 3. Valor líquido real recebido (bruto de cada pagamento - taxa)
  const totalPagoLiq = (pagamentos ?? []).reduce((s, p) => {
    const taxa = Number(p.juros_pct ?? 0);
    return s + (taxa > 0 ? Number(p.valor) * (1 - taxa / 100) : Number(p.valor));
  }, 0);

  // 4. Valor efetivo = original menos todas as taxas absorvidas
  const totalEfetivo = parseFloat((totalOriginal - taxaTotal).toFixed(2));
  const restante     = parseFloat(Math.max(0, totalEfetivo - totalPagoLiq).toFixed(2));
  const descricao    = `Venda #${venda?.numero ?? 'S/N'} — ${venda?.cliente_nome ?? 'Cliente'}`;
  const hoje         = new Date().toISOString().slice(0, 10);

  // 5. Salva valor_original na primeira vez, e atualiza valor_total efetivo e valor_pago
  await supabase
    .from('vendas')
    .update({
      valor_original: totalOriginal,   // preserva o valor bruto original
      valor_total:    totalEfetivo,    // valor real após descontos de maquininha
      valor_pago:     parseFloat(totalPagoLiq.toFixed(2)),
    })
    .eq('id', vendaId);

  // 6. Gerencia lançamento financeiro pendente/pago
  // Busca qualquer lançamento desta venda que não seja de pagamento individual
  const { data: lancExistente } = await supabase
    .from('lancamentos')
    .select('id,status')
    .eq('venda_id', vendaId)
    .eq('tipo', 'receita')
    .not('status', 'eq', 'cancelado')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (restante > 0.009) {
    // Ainda tem valor a receber — mantém/cria pendente.
    // valor = totalEfetivo (valor real da venda após taxas), não restante.
    // O Dashboard e Financeiro devem mostrar o valor real da venda, não o saldo pendente.
    const payload = {
      tipo:            'receita',
      descricao,
      valor:           totalEfetivo,
      status:          'pendente',
      categoria:       'Venda',
      cliente_nome:    venda?.cliente_nome ?? null,
      venda_id:        vendaId,
      data_vencimento: venda?.data_entrega ?? hoje,
      data_pagamento:  null,
      forma_pagamento: null,
      origem:          null,
    };
    if (lancExistente?.id) {
      await supabase.from('lancamentos').update(payload).eq('id', lancExistente.id);
    } else {
      await supabase.from('lancamentos').insert(payload);
    }
  } else {
    // Quitado — marca o lançamento como pago com o valor efetivo
    if (lancExistente?.id) {
      await supabase
        .from('lancamentos')
        .update({
          status:          'pago',
          valor:           totalEfetivo,
          data_pagamento:  hoje,
        })
        .eq('id', lancExistente.id);
    } else {
      // Não havia lançamento — cria já como pago
      await supabase.from('lancamentos').insert({
        tipo:            'receita',
        descricao,
        valor:           totalEfetivo,
        status:          'pago',
        categoria:       'Venda',
        cliente_nome:    venda?.cliente_nome ?? null,
        venda_id:        vendaId,
        data_vencimento: hoje,
        data_pagamento:  hoje,
        origem:          null,
      });
    }
  }

  return { totalEfetivo, totalPagoLiq, restante };
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
      if (!pag.conta_id) {
        throw new Error('Selecione a conta financeira que recebeu esse pagamento.');
      }
      // Busca dados da venda
      const { data: venda } = await supabase
        .from('vendas')
        .select('id,numero,cliente_nome,valor_original,valor_total,total,data_entrega')
        .eq('id', pag.venda_id)
        .single();

      const taxaPct    = Number(pag.juros_pct ?? 0);
      const valorBruto = Number(pag.valor);
      const valorLiq   = taxaPct > 0
        ? parseFloat((valorBruto * (1 - taxaPct / 100)).toFixed(2))
        : valorBruto;

      // 1. Salva o pagamento
      const { data, error } = await supabase
        .from('pagamentos_venda')
        .insert(pag)
        .select()
        .single();
      if (error) throw error;

      const origem    = origemPagamento((data as PagamentoVenda).id);
      const descricao = `Pagamento ref. Venda #${venda?.numero || 'S/N'}`;
      const obsPartes = [
        pag.observacoes,
        taxaPct > 0 ? `taxa maquininha ${taxaPct}%` : null,
      ].filter(Boolean).join(' · ');

      // 2. Se há taxa da maquininha, aplica como desconto nos itens da venda
      if (taxaPct > 0) {
        const { data: itens } = await supabase
          .from('venda_itens')
          .select('id,desconto,preco_unitario,quantidade')
          .eq('venda_id', pag.venda_id);

        if (itens && itens.length > 0) {
          for (const item of itens) {
            const descontoAtual = Number(item.desconto ?? 0);
            // Combina desconto existente com taxa: D_novo = 1 - (1-D_atual/100)*(1-taxa/100)
            const novoDesconto  = parseFloat(
              (100 - (1 - descontoAtual / 100) * (1 - taxaPct / 100) * 100).toFixed(4)
            );
            const novoTotal = Number(item.preco_unitario) * Number(item.quantidade) * (1 - novoDesconto / 100);
            await supabase
              .from('venda_itens')
              .update({ desconto: novoDesconto, total: parseFloat(novoTotal.toFixed(2)) })
              .eq('id', item.id);
          }
        }
      }

      // 3. Registra entrada na conta financeira escolhida — antes só entrava em
      // dinheiro; agora toda forma de pagamento move o saldo da conta certa.
      await supabase.from('caixa_movimentos').insert({
        tipo:         'entrada',
        valor:        valorLiq,
        data:         pag.data_pagamento,
        cliente_nome: venda?.cliente_nome || null,
        descricao,
        venda_id:     pag.venda_id,
        conta_id:     pag.conta_id,
        origem,
        observacoes:  obsPartes || null,
      });

      // 4. Recalcula financeiro (atualiza valor_total, valor_pago e lançamento)
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

      // 1. Remove o pagamento
      const { error } = await supabase.from('pagamentos_venda').delete().eq('id', id);
      if (error) throw error;

      // 2. Remove movimento de caixa vinculado
      await supabase.from('caixa_movimentos').delete().eq('origem', origem);

      // 3. Recalcula financeiro (restaura valor_total original se necessário)
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
