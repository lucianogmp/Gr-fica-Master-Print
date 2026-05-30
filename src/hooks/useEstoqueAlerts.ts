import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useEstoqueAlerts() {
  return useQuery({
    queryKey: ['estoque-alerts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('materiais')
        .select('nome, saldo, estoque_minimo');
      
      return data?.filter(m => Number(m.saldo) <= Number(m.estoque_minimo)) || [];
    },
    refetchInterval: 1000 * 60 * 5, // Atualiza a cada 5 min automaticamente
  });
}