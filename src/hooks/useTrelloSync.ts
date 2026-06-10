// src/hooks/useTrelloSync.ts
//
// Sincroniza ordens de produção com o Trello.
// Credenciais são buscadas via RPC segura (Vault) — nunca expostas no cliente.
// Cada OrdemProducao tem um campo trello_card_id para rastrear o card.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  criarTrelloCard, moverTrelloCard, arquivarTrelloCard,
  etapaParaListaId, TrelloCredenciais, TrelloListMap,
} from '../lib/trello';
import { OrdemProducao } from '../types/producao';
import toast from 'react-hot-toast';

// ── Buscar credenciais do Vault via RPC ─────────────────────────────────────
async function buscarCredenciaisTrello(): Promise<{
  creds: TrelloCredenciais;
  boardId: string;
  listMap: TrelloListMap;
}> {
  // Busca tokens do Vault (RPC segura — não expõe em SELECT)
  const { data: keyData, error: keyErr } = await supabase
    .rpc('ler_token', { p_nome: 'trello_api_key' });
  const { data: tokenData, error: tokenErr } = await supabase
    .rpc('ler_token', { p_nome: 'trello_token' });

  if (keyErr || tokenErr || !keyData || !tokenData) {
    throw new Error(
      'Credenciais do Trello não configuradas. ' +
      'Acesse Configurações → Integrações → Trello para configurar.'
    );
  }

  // Busca IDs de listas e board das configurações normais
  const { data: cfg, error: cfgErr } = await supabase
    .from('configuracoes')
    .select('trello_board_id, trello_list_fila, trello_list_imprimindo, trello_list_acabamento, trello_list_pronto')
    .limit(1)
    .single();

  if (cfgErr || !cfg?.trello_board_id) {
    throw new Error(
      'Board ID do Trello não configurado. ' +
      'Acesse Configurações → Integrações → Trello.'
    );
  }

  return {
    creds: { api_key: keyData, token: tokenData },
    boardId: cfg.trello_board_id,
    listMap: {
      fila:       cfg.trello_list_fila       ?? null,
      impressao:  cfg.trello_list_imprimindo ?? null,
      acabamento: cfg.trello_list_acabamento ?? null,
      pronto:     cfg.trello_list_pronto     ?? null,
    },
  };
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useTrelloSync() {
  const qc = useQueryClient();

  // Sincroniza uma ordem específica (cria ou move o card)
  const sincronizarOrdem = useMutation({
    mutationFn: async (ordem: OrdemProducao) => {
      const { creds, listMap } = await buscarCredenciaisTrello();

      const listaId = etapaParaListaId(ordem.etapa, listMap);
      if (!listaId) {
        throw new Error(`Lista Trello não mapeada para etapa "${ordem.etapa}".`);
      }

      const descricao = [
        ordem.descricao ?? '',
        ordem.responsavel ? `\nResponsável: ${ordem.responsavel}` : '',
        ordem.data_entrega ? `\nEntrega: ${new Date(ordem.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}` : '',
      ].join('').trim();

      if (ordem.trello_card_id) {
        // Card já existe — move para a lista correta e atualiza
        if (ordem.etapa === 'entregue') {
          await arquivarTrelloCard(ordem.trello_card_id, creds);
        } else {
          await moverTrelloCard(ordem.trello_card_id, listaId, creds);
        }
        return { cardId: ordem.trello_card_id, acao: 'movido' as const };
      } else {
        // Card novo
        const card = await criarTrelloCard(
          listaId,
          {
            name: ordem.titulo,
            desc: descricao || undefined,
            due:  ordem.data_entrega ? new Date(ordem.data_entrega).toISOString() : null,
          },
          creds
        );

        // Grava o ID do card na ordem de produção
        const { error } = await supabase
          .from('producao')
          .update({ trello_card_id: card.id })
          .eq('id', ordem.id);

        if (error) throw error;
        return { cardId: card.id, acao: 'criado' as const };
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['producao'] });
      toast.success(
        result.acao === 'criado'
          ? 'Card criado no Trello!'
          : 'Card atualizado no Trello!'
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Sincroniza TODAS as ordens abertas de uma vez
  const sincronizarTudo = useMutation({
    mutationFn: async (ordens: OrdemProducao[]) => {
      const { creds, listMap } = await buscarCredenciaisTrello();

      let criados  = 0;
      let movidos  = 0;
      let erros    = 0;
      const falhas: string[] = [];

      for (const ordem of ordens) {
        try {
          const listaId = etapaParaListaId(ordem.etapa, listMap);
          if (!listaId) continue; // etapa sem lista mapeada — pula

          const descricao = [
            ordem.descricao ?? '',
            ordem.responsavel ? `\nResponsável: ${ordem.responsavel}` : '',
            ordem.data_entrega
              ? `\nEntrega: ${new Date(ordem.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}`
              : '',
          ].join('').trim();

          if (ordem.trello_card_id) {
            if (ordem.etapa === 'entregue') {
              await arquivarTrelloCard(ordem.trello_card_id, creds);
            } else {
              await moverTrelloCard(ordem.trello_card_id, listaId, creds);
            }
            movidos++;
          } else {
            const card = await criarTrelloCard(
              listaId,
              {
                name: ordem.titulo,
                desc: descricao || undefined,
                due:  ordem.data_entrega
                  ? new Date(ordem.data_entrega).toISOString()
                  : null,
              },
              creds
            );

            await supabase
              .from('producao')
              .update({ trello_card_id: card.id })
              .eq('id', ordem.id);

            criados++;
          }

          // Pequena pausa para não estourar rate limit da API do Trello (300 req/10s)
          await new Promise(r => setTimeout(r, 50));
        } catch (err: any) {
          erros++;
          falhas.push(`"${ordem.titulo}": ${err.message}`);
        }
      }

      return { criados, movidos, erros, falhas };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['producao'] });

      const partes = [];
      if (result.criados > 0) partes.push(`${result.criados} criado(s)`);
      if (result.movidos > 0) partes.push(`${result.movidos} atualizado(s)`);

      if (result.erros > 0) {
        toast.error(
          `Sincronizado com erros: ${partes.join(', ')}. ` +
          `${result.erros} falha(s): ${result.falhas.slice(0, 2).join('; ')}`
        );
      } else {
        toast.success(`Trello sincronizado: ${partes.join(', ') || 'nada a fazer'}.`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    sincronizarOrdem:  sincronizarOrdem.mutate,
    sincronizarTudo:   sincronizarTudo.mutate,
    isSincronizando:   sincronizarOrdem.isPending || sincronizarTudo.isPending,
  };
}
