import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/** Quantos pedidos do site ninguém abriu ainda (só a contagem — usado no ponto vermelho do menu lateral). */
export function usePedidosSiteNovos(ativo: boolean) {
  return useQuery({
    queryKey: ['pedidos-site', 'novos-contagem'],
    enabled: ativo,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .eq('origem', 'loja')
        .is('loja_visto_em', null)
        .not('status', 'in', '(convertido,recusado)');
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
}
