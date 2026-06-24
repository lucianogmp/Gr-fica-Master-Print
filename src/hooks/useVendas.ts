// src/hooks/useVendas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Venda, VendaItem, StatusVenda } from '../types/venda';
import toast from 'react-hot-toast';

type VendaPayload = Omit<Venda, 'id' | 'created_at' | 'updated_at' | 'numero'>;

function serializarItens(itens: VendaItem[]) {
  return itens.map(i => ({
    produto_id:     i.produto_id     ?? null,
    descricao:      i.descricao,
    quantidade:     i.quantidade,
    preco_unitario: i.preco_unitario,
    desconto:       i.desconto       ?? 0,
    obs:            i.obs            ?? null,
    unidade:        i.unidade        ?? 'un',
    area_m2:        i.area_m2        ?? null,
    total:          i.total,
  }));
}

export function useVendas() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['vendas'],
    queryFn: async (): Promise<Venda[]> => {
      const { data, error } = await supabase
        .from('vendas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async ({ venda, itens }: { venda: VendaPayload; itens: VendaItem[] }) => {
      const { total: _t, ...vendaSemTotal } = venda as any;
      const { data, error } = await supabase
        .from('vendas')
        .insert(vendaSemTotal)
        .select()
        .single();
      if (error) throw error;

      const vendaId = (data as Venda).id;

      if (itens.length > 0) {
        const { error: iErr } = await supabase.rpc('salvar_itens_venda', {
          p_venda_id: vendaId,
          p_itens: serializarItens(itens),
        });
        if (iErr) throw iErr;
      }

      // Gera lançamento financeiro automaticamente
      await gerarLancamentoReceita(data as Venda);

      return data as Venda;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendas'] });
      qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Venda criada!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({
      id,
      payload,
      itens,
    }: {
      id: string;
      payload: Partial<VendaPayload>;
      itens?: VendaItem[];
    }) => {
      const { total: _t, ...payloadSemTotal } = payload as any;
      const { error } = await supabase
        .from('vendas')
        .update({ ...payloadSemTotal, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      if (itens !== undefined) {
        const { error: iErr } = await supabase.rpc('salvar_itens_venda', {
          p_venda_id: id,
          p_itens: serializarItens(itens),
        });
        if (iErr) throw iErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendas'] });
      qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success('Venda atualizada!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusVenda }) => {
      const { error } = await supabase
        .from('vendas')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['vendas'] });
      qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      // Se foi para produção, criar OP automaticamente é feito na página
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendas'] });
      toast.success('Venda removida.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:           criar.mutateAsync,
    atualizar:       atualizar.mutateAsync,
    atualizarStatus: atualizarStatus.mutate,
    deletar:         deletar.mutate,
    isSaving:        criar.isPending || atualizar.isPending,
  };
}

// Gera lançamento de conta a receber ao criar venda
async function gerarLancamentoReceita(venda: Venda) {
  try {
    const total = Number(venda.valor_total ?? venda.total ?? 0);
    if (total <= 0) return;

    await supabase.from('lancamentos').insert({
      tipo:           'receita',
      descricao:      `Venda #${venda.numero ?? ''} — ${venda.cliente_nome}`,
      valor:          total,
      status:         'pendente',
      categoria:      'Venda',
      cliente_nome:   venda.cliente_nome,
      venda_id:       venda.id,
      data_vencimento: venda.data_entrega ?? new Date().toISOString().slice(0, 10),
    });
  } catch (e) {
    console.warn('Aviso: não foi possível gerar lançamento automático', e);
  }
}

export function useVendaItens(vendaId: string | null) {
  return useQuery({
    queryKey: ['venda-itens', vendaId],
    enabled: !!vendaId,
    queryFn: async (): Promise<VendaItem[]> => {
      const { data, error } = await supabase
        .from('venda_itens')
        .select('*')
        .eq('venda_id', vendaId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}
