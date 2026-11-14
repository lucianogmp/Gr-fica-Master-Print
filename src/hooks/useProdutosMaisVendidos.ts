import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/** Janela (em dias) usada para decidir quais itens são "os mais vendidos". */
export const DIAS_MAIS_VENDIDOS = 30;

/**
 * Ranking dos produtos mais vendidos nos últimos dias: produto_id → posição de popularidade
 * (nº de linhas de venda e, no empate, quantidade). Só serve para ORDENAR as sugestões —
 * não filtra nada. Vendas canceladas não contam.
 */
export function useProdutosMaisVendidos() {
  return useQuery({
    queryKey: ['venda-itens', 'mais-vendidos', DIAS_MAIS_VENDIDOS],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const desde = new Date(Date.now() - DIAS_MAIS_VENDIDOS * 86400000).toISOString();
      const { data, error } = await supabase
        .from('venda_itens')
        .select('produto_id, quantidade, vendas!inner(status, data_venda)')
        .not('produto_id', 'is', null)
        .neq('vendas.status', 'cancelado')
        .gte('vendas.data_venda', desde.slice(0, 10))
        .limit(5000);
      if (error) throw error;
      const acc = new Map<string, { vendas: number; qtd: number }>();
      for (const r of (data ?? []) as any[]) {
        const a = acc.get(r.produto_id) ?? { vendas: 0, qtd: 0 };
        a.vendas += 1;
        a.qtd += Number(r.quantidade) || 0;
        acc.set(r.produto_id, a);
      }
      const ordenados = [...acc.entries()].sort((a, b) => b[1].vendas - a[1].vendas || b[1].qtd - a[1].qtd);
      return new Map(ordenados.map(([id], i) => [id, i] as [string, number]));
    },
  });
}
