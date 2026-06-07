import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createErrorMessage } from '../utils/errorHandler';

interface AccountBalance {
  total_receita: number;
  total_despesa: number;
  saldo_liquido: number;
  receita_paga: number;
  despesa_paga: number;
  receita_pendente: number;
  despesa_pendente: number;
}

export function useAccountBalance(mes?: string) {
  return useQuery({
    queryKey: ['account-balance', mes],
    queryFn: async (): Promise<AccountBalance> => {
      const { data, error } = await supabase.rpc('calculate_account_balance', {
        p_mes: mes || null,
      });

      if (error) {
        console.error('Erro ao calcular saldo:', createErrorMessage(error));
        throw error;
      }

      return data?.[0] || {
        total_receita: 0,
        total_despesa: 0,
        saldo_liquido: 0,
        receita_paga: 0,
        despesa_paga: 0,
        receita_pendente: 0,
        despesa_pendente: 0,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    retry: 2,
  });
}

export function useMonthlySummary() {
  return useQuery({
    queryKey: ['monthly-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vw_monthly_balance').select('*').limit(12);

      if (error) {
        console.error('Erro ao buscar sumário mensal:', createErrorMessage(error));
        throw error;
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
    retry: 2,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vw_dashboard_summary').select('*').single();

      if (error) {
        console.error('Erro ao buscar sumário do dashboard:', createErrorMessage(error));
        throw error;
      }

      return data || {};
    },
    staleTime: 1000 * 60, // 1 minuto
    retry: 2,
  });
}
