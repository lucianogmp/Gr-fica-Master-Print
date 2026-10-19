// src/hooks/useRealtimeSync.ts
//
// Atualização AUTOMÁTICA das telas, sem precisar dar F5.
//
// Escuta o Realtime do Supabase (postgres_changes) nas tabelas do sistema e, quando
// alguém altera algo (você em outra aba, outro computador, outro usuário), marca como
// "desatualizadas" só as consultas do React Query que dependem daquela tabela. As telas
// abertas se refazem sozinhas; as que não estão abertas buscam de novo quando forem abertas.
//
// Requer a tabela na publicação supabase_realtime (ver supabase/migrations/024_realtime_tabelas.sql).
// Se o Realtime cair e voltar, tudo é revalidado (eventos perdidos durante a queda).

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/** tabela → prefixos de queryKey (do React Query) que precisam ser refeitos quando ela muda */
const TABELA_PARA_QUERIES: Record<string, string[]> = {
  // financeiro / caixa
  lancamentos:        ['lancamentos', 'relatorio-financeiro', 'saldo-contas', 'saldo-caixa-fisico', 'caixa-kpis-dia', 'dashboard-metrics', 'dashboard-summary', 'monthly-summary', 'account-balance'],
  caixa_movimentos:   ['caixa-movimentos', 'saldo-contas', 'saldo-caixa-fisico', 'caixa-kpis-dia', 'dashboard-metrics', 'dashboard-summary', 'monthly-summary', 'account-balance', 'contas-bancarias'],
  contas_bancarias:   ['contas-bancarias', 'ids-contas-caixa', 'saldo-contas', 'saldo-caixa-fisico', 'dashboard-metrics'],

  // vendas / produção
  vendas:             ['vendas', 'relatorio-vendas', 'producao', 'dashboard-metrics'],
  venda_itens:        ['venda-itens', 'vendas'],
  pagamentos_venda:   ['pagamentos-venda', 'vendas', 'dashboard-metrics'],
  producao:           ['producao', 'dashboard-metrics'],

  // orçamentos
  orcamentos:         ['orcamentos'],
  orcamento_itens:    ['orcamento-itens', 'orcamentos'],

  // cadastros
  clientes:           ['clientes', 'cliente'],
  fornecedores:       ['fornecedores'],
  contatos:           ['contatos', 'contatos-todos'],
  leads:              ['leads'],
  atendimentos:       ['atendimentos'],
  categorias:         ['categorias'],

  // produtos / custos / estoque
  produtos:           ['produtos', 'materiais-orcamento', 'bom-item-orc', 'bom-item-placa'],
  produto_materias:   ['produtos', 'bom-item-orc', 'bom-item-placa'],
  acabamentos:        ['acabamentos'],
  metalon_tipos:      ['metalon-tipos'],
  materiais_impressao:['materiais-impressao'],
  materias_primas:    ['materias-primas', 'estoque-alerts', 'bom-item-orc', 'bom-item-placa'],
  estoque_movimentos: ['estoque-movimentos', 'materias-primas', 'estoque-alerts'],
  custos_fixos:       ['custos-fixos', 'gestao-custos-resumo', 'dashboard-metrics'],
  custos_variaveis:   ['custos-variaveis', 'gestao-custos-resumo'],
  depreciacao:        ['depreciacao', 'gestao-custos-resumo', 'dashboard-metrics'],

  // sistema
  configuracoes:      ['configuracoes', 'config-serralheria', 'gestao-custos-resumo'],
  permissoes_usuario: ['permissoes-usuario', 'minhas-permissoes'],
};

/** Junta rajadas de eventos (ex.: uma venda grava em 4 tabelas) num único refresh. */
const ESPERA_MS = 350;

export function useRealtimeSync(ativo: boolean = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ativo) return;

    const pendentes = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let jaConectou = false;
    let caiu = false;

    const agendar = (chaves: string[]) => {
      chaves.forEach(c => pendentes.add(c));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        pendentes.forEach(chave => queryClient.invalidateQueries({ queryKey: [chave] }));
        pendentes.clear();
        timer = null;
      }, ESPERA_MS);
    };

    // nome único por montagem: evita colidir com o canal de outra montagem (StrictMode monta 2x em dev)
    const canal = supabase.channel(`sync-geral-${Math.random().toString(36).slice(2)}`);

    for (const [tabela, chaves] of Object.entries(TABELA_PARA_QUERIES)) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, () => agendar(chaves));
    }

    canal.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        // voltou depois de uma queda: pode ter perdido eventos — revalida tudo
        if (jaConectou && caiu) queryClient.invalidateQueries();
        jaConectou = true;
        caiu = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (jaConectou) caiu = true;
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(canal);
    };
  }, [ativo, queryClient]);
}
