// src/hooks/useRelatorios.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface RelatorioVendasFiltros {
  data_inicio: string;
  data_fim: string;
  status?: string;
  cliente?: string;
}

export interface RelatorioFinanceiroFiltros {
  data_inicio: string;
  data_fim: string;
  tipo?: 'receita' | 'despesa';
  categoria?: string;
  status?: string;
}

function valorVenda(v: { valor_total?: number | null; total?: number | null }) {
  return Number(v.valor_total ?? v.total ?? 0);
}

// ── Relatório de Vendas ─────────────────────────────────────────────────────

export interface VendaRelatorio {
  id: string;
  numero: number | null;
  cliente_nome: string;
  status: string;
  data_venda: string | null;
  data_entrega: string | null;
  valor_total: number | null;
  total: number | null;
  desconto: number;
  vendedor: string | null;
  created_at?: string | null;
}

export interface ResumoVendas {
  total_vendas: number;
  valor_total: number;
  ticket_medio: number;
  por_status: Record<string, { count: number; valor: number }>;
  por_cliente: { nome: string; total: number; count: number }[];
  por_dia: { data: string; total: number; count: number }[];
}

export function useRelatorioVendas(filtros: RelatorioVendasFiltros) {
  return useQuery({
    queryKey: ['relatorio-vendas', filtros],
    enabled: !!filtros.data_inicio && !!filtros.data_fim,
    queryFn: async () => {
      let q = supabase
        .from('vendas')
        .select(`
          id, numero, cliente_nome, status, data_venda,
          data_entrega, valor_total, total, desconto, vendedor, created_at
        `)
        .order('created_at', { ascending: true });

      if (filtros.status)  q = q.eq('status', filtros.status);
      if (filtros.cliente) q = q.ilike('cliente_nome', `%${filtros.cliente}%`);

      const { data, error } = await q;
      if (error) throw error;

      const vendas = ((data ?? []) as VendaRelatorio[]).filter(v => {
        const ref = v.data_venda?.slice(0, 10) ?? v.created_at?.slice(0, 10);
        if (!ref) return false;
        return ref >= filtros.data_inicio && ref <= filtros.data_fim;
      });

      const resumo: ResumoVendas = {
        total_vendas: vendas.length,
        valor_total:  vendas.reduce((s, v) => s + valorVenda(v), 0),
        ticket_medio: 0,
        por_status:   {},
        por_cliente:  [],
        por_dia:      [],
      };

      resumo.ticket_medio = resumo.total_vendas > 0
        ? resumo.valor_total / resumo.total_vendas : 0;

      vendas.forEach(v => {
        if (!resumo.por_status[v.status]) {
          resumo.por_status[v.status] = { count: 0, valor: 0 };
        }
        resumo.por_status[v.status].count++;
        resumo.por_status[v.status].valor += valorVenda(v);
      });

      const clienteMap: Record<string, { total: number; count: number }> = {};
      vendas.forEach(v => {
        const nome = v.cliente_nome || 'Sem cliente';
        if (!clienteMap[nome]) clienteMap[nome] = { total: 0, count: 0 };
        clienteMap[nome].total += valorVenda(v);
        clienteMap[nome].count++;
      });
      resumo.por_cliente = Object.entries(clienteMap)
        .map(([nome, d]) => ({ nome, ...d }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const diaMap: Record<string, { total: number; count: number }> = {};
      vendas.forEach(v => {
        const d = v.data_venda?.slice(0, 10) ?? v.created_at?.slice(0, 10) ?? 'sem data';
        if (!diaMap[d]) diaMap[d] = { total: 0, count: 0 };
        diaMap[d].total += valorVenda(v);
        diaMap[d].count++;
      });
      resumo.por_dia = Object.entries(diaMap)
        .map(([data, d]) => ({ data, ...d }))
        .sort((a, b) => a.data.localeCompare(b.data));

      return { vendas, resumo };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Relatório Financeiro ────────────────────────────────────────────────────

export interface LancamentoRelatorio {
  id: string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  status: string;
  categoria: string | null;
  cliente_nome: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  forma_pagamento: string | null;
}

export interface ResumoFinanceiro {
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  receitas_pagas: number;
  despesas_pagas: number;
  a_receber: number;
  a_pagar: number;
  por_categoria: { categoria: string; tipo: string; total: number }[];
  por_mes: { mes: string; receita: number; despesa: number; saldo: number }[];
}

export function useRelatorioFinanceiro(filtros: RelatorioFinanceiroFiltros) {
  return useQuery({
    queryKey: ['relatorio-financeiro', filtros],
    enabled: !!filtros.data_inicio && !!filtros.data_fim,
    queryFn: async () => {
      let q = supabase
        .from('lancamentos')
        .select('*')
        .gte('data_vencimento', filtros.data_inicio)
        .lte('data_vencimento', filtros.data_fim)
        .order('data_vencimento', { ascending: true });

      if (filtros.tipo)      q = q.eq('tipo', filtros.tipo);
      if (filtros.categoria) q = q.eq('categoria', filtros.categoria);
      if (filtros.status)    q = q.eq('status', filtros.status);

      const { data, error } = await q;
      if (error) throw error;

      const lancamentos = (data ?? []) as LancamentoRelatorio[];

      const resumo: ResumoFinanceiro = {
        total_receitas: 0, total_despesas: 0, saldo: 0,
        receitas_pagas: 0, despesas_pagas: 0,
        a_receber: 0, a_pagar: 0,
        por_categoria: [], por_mes: [],
      };

      lancamentos.forEach(l => {
        const v = Number(l.valor);
        if (l.tipo === 'receita') {
          resumo.total_receitas += v;
          if (l.status === 'pago') resumo.receitas_pagas += v;
          else if (l.status !== 'cancelado') resumo.a_receber += v;
        } else {
          resumo.total_despesas += v;
          if (l.status === 'pago') resumo.despesas_pagas += v;
          else if (l.status !== 'cancelado') resumo.a_pagar += v;
        }
      });
      resumo.saldo = resumo.total_receitas - resumo.total_despesas;

      const catMap: Record<string, { tipo: string; total: number }> = {};
      lancamentos.forEach(l => {
        const key = `${l.tipo}__${l.categoria ?? 'Sem categoria'}`;
        if (!catMap[key]) catMap[key] = { tipo: l.tipo, total: 0 };
        catMap[key].total += Number(l.valor);
      });
      resumo.por_categoria = Object.entries(catMap)
        .map(([key, d]) => ({
          categoria: key.split('__')[1],
          tipo: d.tipo,
          total: d.total,
        }))
        .sort((a, b) => b.total - a.total);

      const mesMap: Record<string, { receita: number; despesa: number }> = {};
      lancamentos.forEach(l => {
        const mes = l.data_vencimento?.slice(0, 7) ?? 'sem data';
        if (!mesMap[mes]) mesMap[mes] = { receita: 0, despesa: 0 };
        if (l.tipo === 'receita') mesMap[mes].receita += Number(l.valor);
        else mesMap[mes].despesa += Number(l.valor);
      });
      resumo.por_mes = Object.entries(mesMap)
        .map(([mes, d]) => ({ mes, ...d, saldo: d.receita - d.despesa }))
        .sort((a, b) => a.mes.localeCompare(b.mes));

      return { lancamentos, resumo };
    },
    staleTime: 1000 * 60 * 5,
  });
}
