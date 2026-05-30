import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { MateriaPrima, MovimentoEstoque } from '../types/estoque';
import toast from 'react-hot-toast';

export function useMateriasPrimas() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['materias-primas'],
    queryFn: async (): Promise<MateriaPrima[]> => {
      const { data, error } = await supabase
        .from('materias_primas')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (mp: Omit<MateriaPrima, 'id' | 'created_at' | 'empresa_id'> & { saldo_inicial?: number }) => {
      const { saldo_inicial, ...dados } = mp;
      const { data, error } = await supabase
        .from('materias_primas')
        .insert({ ...dados, saldo: saldo_inicial ?? 0 })
        .select()
        .single();
      if (error) throw error;
      return data as MateriaPrima;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materias-primas'] }); toast.success('Matéria-prima criada!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<MateriaPrima> }) => {
      const { error } = await supabase.from('materias_primas').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materias-primas'] }); toast.success('Salvo!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('materias_primas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materias-primas'] }); toast.success('Removida.'); },
    onError:   (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:    criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar:  deletar.mutateAsync,
  };
}

export function useMovimentos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['estoque-movimentos'],
    queryFn: async (): Promise<MovimentoEstoque[]> => {
      const { data, error } = await supabase
        .from('estoque_movimentos')
        .select('*, materias_primas(nome, unidade)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const registrar = useMutation({
    mutationFn: async ({
      materiaId, tipo, quantidade, motivo,
    }: {
      materiaId: string;
      tipo: 'entrada' | 'saida';
      quantidade: number;
      motivo?: string;
    }) => {
      const { data: mp, error: mpErr } = await supabase
        .from('materias_primas')
        .select('saldo')
        .eq('id', materiaId)
        .single();
      if (mpErr) throw mpErr;

      const saldoAtual = Number(mp.saldo ?? 0);
      const novoSaldo  = tipo === 'entrada' ? saldoAtual + quantidade : saldoAtual - quantidade;

      const { error: upErr } = await supabase
        .from('materias_primas')
        .update({ saldo: novoSaldo })
        .eq('id', materiaId);
      if (upErr) throw upErr;

      const { error: movErr } = await supabase
        .from('estoque_movimentos')
        .insert({
          materia_prima_id: materiaId,
          tipo,
          quantidade,
          motivo: motivo || null,
        });
      if (movErr) throw movErr;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['materias-primas'] });
      qc.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      toast.success(`${vars.tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada!`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, registrar: registrar.mutateAsync, isRegistrando: registrar.isPending };
}
