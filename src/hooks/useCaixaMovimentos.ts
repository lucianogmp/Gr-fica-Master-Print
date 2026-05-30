import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CaixaMovimento } from '../types/financeiro';

export function useCaixaMovimentos() {
  return useQuery({
    queryKey: ['caixa-movimentos'],
    queryFn: async (): Promise<CaixaMovimento[]> => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .order('data', { ascending: false })
        .limit(365);
      if (error) throw error;
      return data ?? [];
    },
  });
}
