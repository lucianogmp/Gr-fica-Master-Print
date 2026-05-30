import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Orcamento, OrcamentoItem, StatusOrcamento } from '../types/orcamento';
import toast from 'react-hot-toast';

type OrcPayload = Omit<Orcamento, 'id' | 'created_at' | 'updated_at'>;

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
      if (itens.length > 0) {
        const { error: iErr } = await supabase
          .from('orcamento_itens')
          .insert(itens.map(i => ({ ...i, orcamento_id: id })));
        if (iErr) throw iErr;
      }
      return data as Orcamento;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamentos'] }); toast.success('Orçamento salvo!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, orc, itens }: { id: string; orc: Partial<OrcPayload>; itens?: OrcamentoItem[] }) => {
      const { error } = await supabase
        .from('orcamentos')
        .update({ ...orc, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      if (itens !== undefined) {
        await supabase.from('orcamento_itens').delete().eq('orcamento_id', id);
        if (itens.length > 0) {
          await supabase.from('orcamento_itens').insert(itens.map(i => ({ ...i, orcamento_id: id })));
        }
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
          status:       'aprovado',
          desconto:     orc.desconto ?? 0,
          observacoes:  orc.observacoes,
          valor_total:  orc.total ?? 0,
          total:        orc.total ?? 0,
          data_venda:   new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
      if (vErr) throw vErr;
      const vendaId = (venda as any).id;

      // 2. Cria os itens da venda
      if (itens.length > 0) {
        const { error: iErr } = await supabase.from('venda_itens').insert(
          itens.map(i => ({
            venda_id:       vendaId,
            descricao:      i.descricao,
            quantidade:     i.quantidade,
            preco_unitario: i.preco_unitario,
            total:          i.total,
            unidade:        'un',
          }))
        );
        if (iErr) throw iErr;
      }

      // 3. Vincula orçamento à venda e marca como convertido
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
      toast.success('Orçamento convertido em venda!');
      return vendaId;
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
    criar:           criar.mutateAsync,
    atualizar:       atualizar.mutateAsync,
    atualizarStatus: atualizarStatus.mutate,
    converterEmVenda: converterEmVenda.mutateAsync,
    deletar:         deletar.mutate,
    isSaving:        criar.isPending || atualizar.isPending,
    isConvertendo:   converterEmVenda.isPending,
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
