import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface GcData {
  depr: number;
  fixos: number;
  total: number;
  porHora: number;
}

export function useGestaoCustos() {
  return useQuery({
    queryKey: ['gestao-custos-resumo'],
    queryFn: async (): Promise<GcData> => {
      const [deprRes, fixosRes] = await Promise.all([
        supabase.from('depreciacao').select('valor, vida_util_anos'),
        supabase.from('custos_fixos').select('valor_mensal, ativo'),
      ]);

      const totalDepr = (deprRes.data ?? []).reduce((s, e) => {
        const meses = Number(e.vida_util_anos || 1) * 12;
        return s + (meses > 0 ? Number(e.valor || 0) / meses : 0);
      }, 0);

      const totalFixos = (fixosRes.data ?? [])
        .filter(c => c.ativo !== false)
        .reduce((s, c) => s + Number(c.valor_mensal || 0), 0);

      const total = totalDepr + totalFixos;
      return {
        depr:    totalDepr,
        fixos:   totalFixos,
        total,
        porHora: total > 0 ? total / 30 / 8 : 0,
      };
    },
    staleTime: 1000 * 60 * 10,
  });
}
