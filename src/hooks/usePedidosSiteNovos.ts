import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Quantos pedidos do site ninguém abriu ainda (só a contagem — usado no balão vermelho do menu lateral).
 * Conta também o pedido pago que virou venda sozinho; não conta recusado nem venda já entregue (pedidos antigos).
 */
export function usePedidosSiteNovos(ativo: boolean) {
  return useQuery({
    queryKey: ['pedidos-site', 'novos-contagem'],
    enabled: ativo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('id,venda_id')
        .eq('origem', 'loja')
        .is('loja_visto_em', null)
        .neq('status', 'recusado');
      if (error) throw error;
      const lista = (data ?? []) as { id: string; venda_id: string | null }[];
      const vendaIds = lista.map(o => o.venda_id).filter(Boolean) as string[];
      if (vendaIds.length === 0) return lista.length;
      const { data: vendas, error: e2 } = await supabase.from('vendas').select('id,status').in('id', vendaIds);
      if (e2) throw e2;
      const entregues = new Set((vendas ?? []).filter((v: any) => v.status === 'entregue').map((v: any) => v.id));
      return lista.filter(o => !(o.venda_id && entregues.has(o.venda_id))).length;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
}
