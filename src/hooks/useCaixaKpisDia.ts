// src/hooks/useCaixaKpisDia.ts
//
// Busca só o agregado do dia (entradas, saídas, saldo) via função do banco
// que nunca expõe linhas cruas — segura para qualquer papel, inclusive vendedor.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface CaixaKpisDia {
  entradas_hoje: number;
  saidas_hoje: number;
  saldo_hoje: number;
}

export function useCaixaKpisDia() {
  return useQuery({
    queryKey: ['caixa-kpis-dia'],
    queryFn: async (): Promise<CaixaKpisDia> => {
      const { data, error } = await supabase.rpc('get_caixa_kpis_dia').single();
      if (error) throw error;
      return data as CaixaKpisDia;
    },
  });
}
