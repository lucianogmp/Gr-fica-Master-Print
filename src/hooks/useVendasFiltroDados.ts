// Dados auxiliares para os filtros de Vendas: itens (produto/serviço) e pagamentos (forma/conta).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useVendasFiltroDados() {
  const itens = useQuery({
    queryKey: ['vendas-filtro-itens'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('venda_itens').select('venda_id,descricao').limit(20000);
      if (error) throw error;
      return (data ?? []) as { venda_id: string; descricao: string | null }[];
    },
  });
  const pagamentos = useQuery({
    queryKey: ['vendas-filtro-pagamentos'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pagamentos_venda').select('venda_id,conta_id,forma_pagamento').limit(20000);
      if (error) throw error;
      return (data ?? []) as { venda_id: string; conta_id: string | null; forma_pagamento: string | null }[];
    },
  });
  return { itens: itens.data ?? [], pagamentos: pagamentos.data ?? [] };
}

export function useOrcamentosFiltroItens() {
  const q = useQuery({
    queryKey: ['orcamentos-filtro-itens'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('orcamento_itens').select('orcamento_id,descricao').limit(20000);
      if (error) throw error;
      return (data ?? []) as { orcamento_id: string; descricao: string | null }[];
    },
  });
  return q.data ?? [];
}
