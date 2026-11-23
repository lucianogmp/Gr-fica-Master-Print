import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface ItemCompra {
  id: string;
  materia_prima_id: string | null;
  nome: string;
  unidade: string | null;
  quantidade: number | null;
  observacao: string | null;
  comprar_ate: string | null;
  comprado: boolean;
  comprado_em: string | null;
  created_at: string;
}

const KEY = ['lista-compras'];

export function useListaCompras() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ItemCompra[]> => {
      const { data, error } = await supabase.from('lista_compras').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ItemCompra[];
    },
  });
  const inv = () => qc.invalidateQueries({ queryKey: KEY });
  const onError = (e: any) => toast.error(e.message ?? 'Erro ao salvar');

  const adicionar = useMutation({
    mutationFn: async (itens: Partial<ItemCompra>[]) => {
      const { error } = await supabase.from('lista_compras').insert(itens);
      if (error) throw error;
    },
    onSuccess: inv, onError,
  });
  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<ItemCompra> }) => {
      const { error } = await supabase.from('lista_compras').update(dados).eq('id', id);
      if (error) throw error;
    },
    // atualização otimista: a marcação aparece na hora
    onMutate: async ({ id, dados }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const antes = qc.getQueryData<ItemCompra[]>(KEY);
      qc.setQueryData<ItemCompra[]>(KEY, old => (old ?? []).map(i => i.id === id ? { ...i, ...dados } : i));
      return { antes };
    },
    onError: (e: any, _v, ctx) => { if (ctx?.antes) qc.setQueryData(KEY, ctx.antes); onError(e); },
    onSettled: inv,
  });
  const remover = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('lista_compras').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: inv, onError,
  });

  return { ...query, adicionar: adicionar.mutateAsync, atualizar: atualizar.mutate, remover: remover.mutateAsync };
}
