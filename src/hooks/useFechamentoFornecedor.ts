import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { createErrorMessage } from '../utils/errorHandler';
import { tamanhoDoItem } from '../lib/fechamentoFornecedor';

export interface LinhaFechamento {
  id: string;            // id do venda_itens
  venda_id: string;
  data: string;          // yyyy-mm-dd
  produto_id: string;
  tipo: string;          // nome do produto
  cliente: string;
  numero: number | null;
  nome_arquivo: string;
  quantidade: number;
  tamanho: string;
  area_total: number | null;
  preco_m2: number | null;   // custo por m² (produtos por m²)
  custo_unit: number;        // custo do produto
  por_m2: boolean;
  total: number;
}

export interface Fechamento {
  id: string;
  fornecedor_id: string | null;
  fornecedor_nome: string;
  data: string;
  total: number;
  status: 'aberto' | 'pago';
  itens: LinhaFechamento[];
  lancamento_id: string | null;
  observacoes?: string | null;
  created_at: string;
}

export function usePendentesFornecedor() {
  return useQuery({
    queryKey: ['fechamento-pendentes'],
    queryFn: async (): Promise<LinhaFechamento[]> => {
      const { data, error } = await supabase
        .from('venda_itens')
        .select('id, venda_id, produto_id, descricao, quantidade, unidade, obs, area_m2, custo_unitario, detalhe_placa, nome_arquivo, created_at, produtos!inner(id, nome, unidade_medida, terceirizado), vendas!inner(numero, cliente_nome, data_venda, status)')
        .eq('produtos.terceirizado', true)
        .is('fechamento_id', null)
        .neq('vendas.status', 'cancelada')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const rows = (data ?? []) as any[];

      // Custo atual do produto (o mesmo que o cadastro mostra)
      const ids = Array.from(new Set(rows.map(r => r.produto_id)));
      const custos = new Map<string, number>();
      await Promise.all(ids.map(async id => {
        const { data: c } = await supabase.rpc('custo_total_produto', { p_produto_id: id });
        if (c != null) custos.set(id, Number(c));
      }));

      return rows.map(r => {
        const por_m2 = r.produtos?.unidade_medida === 'm2';
        const tam = tamanhoDoItem(r);
        const custo = custos.get(r.produto_id) ?? Number(r.custo_unitario ?? 0);
        const qtd = Number(r.quantidade) || 0;
        const total = por_m2 ? custo * (tam.areaTotal ?? qtd) : custo * qtd;
        return {
          id: r.id, venda_id: r.venda_id, produto_id: r.produto_id,
          data: (r.vendas?.data_venda ?? r.created_at ?? '').slice(0, 10),
          tipo: r.produtos?.nome ?? r.descricao, cliente: r.vendas?.cliente_nome ?? '',
          numero: r.vendas?.numero ?? null, nome_arquivo: r.nome_arquivo ?? '',
          quantidade: qtd, tamanho: tam.texto, area_total: tam.areaTotal,
          preco_m2: por_m2 ? custo : (tam.areaTotal ? custo * qtd / tam.areaTotal : null),
          custo_unit: custo, por_m2, total: Math.round(total * 100) / 100,
        } as LinhaFechamento;
      });
    },
  });
}

export function useFechamentos() {
  return useQuery({
    queryKey: ['fechamentos-fornecedor'],
    queryFn: async (): Promise<Fechamento[]> => {
      const { data, error } = await supabase.from('fechamentos_fornecedor').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Fechamento[];
    },
  });
}

export function useFechamentoAcoes() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['fechamento-pendentes'] });
    qc.invalidateQueries({ queryKey: ['fechamentos-fornecedor'] });
    qc.invalidateQueries({ queryKey: ['lancamentos'] });
    qc.invalidateQueries({ queryKey: ['caixa-movimentos'] });
    qc.invalidateQueries({ queryKey: ['saldo-contas'] });
    qc.invalidateQueries({ queryKey: ['venda-itens'] });
  };
  const onError = (e: any) => toast.error(createErrorMessage(e));

  const salvarNomeArquivo = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from('venda_itens').update({ nome_arquivo: nome.trim() || null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fechamento-pendentes'] }),
    onError,
  });

  const criar = useMutation({
    mutationFn: async ({ fornecedor_id, fornecedor_nome, linhas }: { fornecedor_id: string; fornecedor_nome: string; linhas: LinhaFechamento[] }) => {
      const total = Math.round(linhas.reduce((s, l) => s + l.total, 0) * 100) / 100;
      const { data, error } = await supabase.from('fechamentos_fornecedor')
        .insert({ fornecedor_id, fornecedor_nome, total, itens: linhas, status: 'aberto' }).select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from('venda_itens').update({ fechamento_id: data.id }).in('id', linhas.map(l => l.id));
      if (e2) {
        await supabase.from('fechamentos_fornecedor').delete().eq('id', data.id);
        throw e2;
      }
      return data;
    },
    onSuccess: () => { refresh(); toast.success('Itens separados para o fornecedor!'); },
    onError,
  });

  const pagar = useMutation({
    mutationFn: async ({ f, conta_id, data_pagamento }: { f: Fechamento; conta_id: string; data_pagamento: string }) => {
      const { data: l, error } = await supabase.from('lancamentos').insert({
        tipo: 'despesa', descricao: `Fornecedor ${f.fornecedor_nome} — fechamento de ${f.itens.length} item(ns)`,
        valor: f.total, status: 'pago', categoria: 'Fornecedor',
        data_vencimento: data_pagamento, data_pagamento, conta_id, origem: 'fechamento_fornecedor',
      }).select().single();
      if (error) throw error;
      await supabase.from('caixa_movimentos').insert({
        data: data_pagamento, tipo: 'saida', descricao: l.descricao, valor: f.total,
        conta_id, lancamento_id: l.id, origem: 'lancamento',
      });
      const { error: e2 } = await supabase.from('fechamentos_fornecedor').update({ status: 'pago', lancamento_id: l.id }).eq('id', f.id);
      if (e2) throw e2;
    },
    onSuccess: () => { refresh(); toast.success('Pago! Despesa lançada no financeiro.'); },
    onError,
  });

  const desfazer = useMutation({
    mutationFn: async (f: Fechamento) => {
      await supabase.from('venda_itens').update({ fechamento_id: null }).eq('fechamento_id', f.id);
      const { error } = await supabase.from('fechamentos_fornecedor').delete().eq('id', f.id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success('Fechamento desfeito — itens voltaram para pendentes.'); },
    onError,
  });

  return { salvarNomeArquivo, criar, pagar, desfazer };
}
