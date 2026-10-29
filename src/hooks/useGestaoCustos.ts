import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface GcData {
  depr: number;
  fixos: number;
  total: number;
  /** Rateio por hora de TUDO (depreciação das máquinas + custos fixos) — usado nos KPIs da Gestão de Custos. */
  porHora: number;
  /** Rateio por hora só dos CUSTOS FIXOS (aluguel, salários...). É o que entra no custo do produto: a
   * depreciação entra à parte, só das máquinas que o produto usa (evita contar a depreciação em dobro). */
  porHoraFixos: number;
}

export function useGestaoCustos() {
  return useQuery({
    queryKey: ['gestao-custos-resumo'],
    queryFn: async (): Promise<GcData> => {
      const [deprRes, fixosRes] = await Promise.all([
        supabase.from('depreciacao').select('valor, vida_util_anos, valor_residual, ativo'),
        supabase.from('custos_fixos').select('valor_mensal, ativo'),
      ]);

      // Depreciação = (valor − valor residual) ÷ meses de vida útil. Equipamento
      // inativo (vendido/parado) deixa de depreciar. Sem residual cadastrado
      // (padrão 0) o resultado é exatamente o de antes.
      const totalDepr = (deprRes.data ?? [])
        .filter(e => e.ativo !== false)
        .reduce((s, e) => {
          const meses = Number(e.vida_util_anos || 1) * 12;
          const base = Math.max(0, Number(e.valor || 0) - Number(e.valor_residual || 0));
          return s + (meses > 0 ? base / meses : 0);
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
        porHoraFixos: totalFixos > 0 ? totalFixos / 30 / 8 : 0,
      };
    },
    staleTime: 1000 * 60 * 10,
  });
}
