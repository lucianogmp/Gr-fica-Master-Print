// src/hooks/useAuditLog.ts
// Atualizado para usar os nomes reais de colunas do banco:
//   usuario_id (não user_id), created_at (não criado_em), user_email (adicionada via migration)

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AuditEntry {
  id: string;
  tabela: string;
  operacao: 'INSERT' | 'UPDATE' | 'DELETE';
  usuario_id: string | null;
  user_email: string | null;
  dados_antes: Record<string, any> | null;
  dados_depois: Record<string, any> | null;
  ip: string | null;
  created_at: string;
}

export interface AuditFiltros {
  tabela?: string;
  operacao?: string;
  user_email?: string;
  data_inicio?: string;
  data_fim?: string;
  page?: number;
  per_page?: number;
}

const PER_PAGE = 50;

export function useAuditLog(filtros: AuditFiltros = {}) {
  const page    = filtros.page ?? 1;
  const perPage = filtros.per_page ?? PER_PAGE;
  const from    = (page - 1) * perPage;
  const to      = from + perPage - 1;

  return useQuery({
    queryKey: ['audit-log', filtros],
    queryFn: async (): Promise<{ data: AuditEntry[]; count: number }> => {
      let q = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filtros.tabela)      q = q.eq('tabela', filtros.tabela);
      if (filtros.operacao)    q = q.eq('operacao', filtros.operacao);
      if (filtros.user_email)  q = q.ilike('user_email', `%${filtros.user_email}%`);
      if (filtros.data_inicio) q = q.gte('created_at', filtros.data_inicio);
      if (filtros.data_fim)    q = q.lte('created_at', filtros.data_fim + 'T23:59:59');

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: (data ?? []) as AuditEntry[], count: count ?? 0 };
    },
    staleTime: 1000 * 30,
  });
}

export const AUDIT_TABELAS = [
  'vendas', 'lancamentos', 'estoque_movimentos', 'configuracoes',
  'produtos', 'orcamentos', 'clientes', 'producao',
  'materias_primas', 'custos_fixos', 'depreciacao',
];
