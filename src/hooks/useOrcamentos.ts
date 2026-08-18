// src/hooks/useOrcamentos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Orcamento, OrcamentoItem, StatusOrcamento } from '../types/orcamento';
import toast from 'react-hot-toast';

type OrcPayload = Omit<Orcamento, 'id' | 'created_at' | 'updated_at'>;

function serializarItens(itens: OrcamentoItem[]) {
  return itens.map(i => ({
    descricao:             i.descricao,
    tipo_calculo:          i.tipo_calculo,
    quantidade:            i.quantidade,
    preco_unitario:        i.preco_unitario,
    total:                 i.total,
    largura_cm:            i.largura_cm            ?? null,
    altura_cm:             i.altura_cm             ?? null,
    preco_por_m2:          i.preco_por_m2          ?? null,
    material_id:           i.material_id           ?? null,
    folha_tipo:            i.folha_tipo            ?? null,
    itens_por_folha:       i.itens_por_folha       ?? null,
    preco_por_folha:       i.preco_por_folha       ?? null,
    acabamento_id:         i.acabamento_id         ?? null,
    acabamento_nome:       i.acabamento_nome       ?? null,
    acabamento_custo:      i.acabamento_custo      ?? null,
    acabamentos_por_folha: i.acabamentos_por_folha ?? null,
    arte_inclusa:          i.arte_inclusa          ?? false,
    // Colunas que já existiam no banco mas nunca eram preenchidas — agora
    // o custo do item (matéria-prima/produto por m², visível só pra
    // admin/dono na tela) fica salvo de verdade, não só calculado na hora.
    produto_id:            (i as any).produto_id   ?? null,
    custo_unitario:        (i as any).custo_unitario ?? null,
    area_m2:               (i as any).area_m2      ?? null,
  }));
}

export function useOrcamentos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['orcamentos'],
    queryFn: async (): Promise<Orcamento[]> => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async ({ orc, itens }: { orc: OrcPayload; itens: OrcamentoItem[] }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .insert(orc)
        .select()
        .single();
      if (error) throw error;

      const id = (data as Orcamento).id;

      const { error: iErr } = await supabase.rpc('salvar_itens_orcamento', {
        p_orcamento_id: id,
        p_itens: serializarItens(itens),
      });
      if (iErr) throw iErr;

      return data as Orcamento;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamentos'] }); toast.success('Orçamento salvo!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({
      id,
      orc,
      itens,
    }: {
      id: string;
      orc: Partial<OrcPayload>;
      itens?: OrcamentoItem[];
    }) => {
      const { error } = await supabase
        .from('orcamentos')
        .update({ ...orc, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      if (itens !== undefined) {
        const { error: iErr } = await supabase.rpc('salvar_itens_orcamento', {
          p_orcamento_id: id,
          p_itens: serializarItens(itens),
        });
        if (iErr) throw iErr;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamentos'] }); toast.success('Orçamento atualizado!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusOrcamento }) => {
      const { error } = await supabase.from('orcamentos').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
    onError:   (e: any) => toast.error(e.message),
  });

  const converterEmVenda = useMutation({
    mutationFn: async ({ orc, itens }: { orc: Orcamento; itens: OrcamentoItem[] }) => {
      // 1. Cria a venda
      const { data: venda, error: vErr } = await supabase
        .from('vendas')
        .insert({
          cliente_nome: orc.cliente_nome,
          cliente_id:   orc.cliente_id ?? null,
          status:       'aprovado',
          desconto:     orc.desconto ?? 0,
          observacoes:  orc.observacoes,
          valor_total:  orc.total ?? 0,
          data_venda:   new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
      if (vErr) throw vErr;

      const vendaId = (venda as any).id;

      // 2. Salva itens da venda — propaga produto_id vindo do item do orçamento
      const itensMapeados = itens.map(i => ({
        produto_id:     i.produto_id     ?? null,
        descricao:      i.descricao,
        quantidade:     i.quantidade,
        preco_unitario: i.preco_unitario,
        desconto:       0,
        obs:            null,
        unidade:        'un',
        total:          i.total,
      }));

      const { error: iErr } = await supabase.rpc('salvar_itens_venda', {
        p_venda_id: vendaId,
        p_itens: itensMapeados,
      });
      if (iErr) throw iErr;

      // 3. Marca orçamento como convertido
      // (a ordem de produção na fila é criada automaticamente por um
      // gatilho no banco assim que a venda é inserida — funciona pra
      // qualquer caminho de criação de venda, não só esse aqui)
      const { error: uErr } = await supabase
        .from('orcamentos')
        .update({ status: 'convertido', venda_id: vendaId })
        .eq('id', orc.id);
      if (uErr) throw uErr;

      return vendaId;
    },
    onSuccess: (vendaId) => {
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
      qc.invalidateQueries({ queryKey: ['vendas'] });
      qc.invalidateQueries({ queryKey: ['venda-itens', vendaId] });
      qc.invalidateQueries({ queryKey: ['producao'] });
      toast.success('Orçamento convertido em venda e enviado pra fila de produção!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('orcamento_itens').delete().eq('orcamento_id', id);
      const { error } = await supabase.from('orcamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamentos'] }); toast.success('Orçamento removido.'); },
    onError:   (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:            criar.mutateAsync,
    atualizar:        atualizar.mutateAsync,
    atualizarStatus:  atualizarStatus.mutate,
    converterEmVenda: converterEmVenda.mutateAsync,
    deletar:          deletar.mutate,
    isSaving:         criar.isPending || atualizar.isPending,
    isConvertendo:    converterEmVenda.isPending,
  };
}

export function useOrcamentoItens(orcId: string | null) {
  return useQuery({
    queryKey: ['orcamento-itens', orcId],
    enabled: !!orcId,
    queryFn: async (): Promise<OrcamentoItem[]> => {
      const { data, error } = await supabase
        .from('orcamento_itens')
        .select('*')
        .eq('orcamento_id', orcId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}
