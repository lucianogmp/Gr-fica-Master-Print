import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useEstoqueAlerts() {
  return useQuery({
    queryKey: ['estoque-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materias_primas')
        .select('nome, saldo, estoque_minimo')
        .gt('estoque_minimo', 0);

      if (error) throw error;

      return (data ?? []).filter(
        m => Number(m.saldo) <= Number(m.estoque_minimo)
      );
    },
    refetchInterval: 1000 * 60 * 5,
  });
}
