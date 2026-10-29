// src/hooks/useEquipamentos.ts
// Consumíveis e manutenções por equipamento + o custo calculado de cada máquina.
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useDepreciacao } from './useGestaoBase';
import { calcularCustoEquipamento, CustoEquipamento } from '../lib/custoEquipamento';
import type { Consumivel, Manutencao } from '../types/equipamento';

const KEY_CONS  = ['equip-consumiveis'];
const KEY_MANUT = ['equip-manutencoes'];

function useCrud<T extends { id: string }>(tabela: string, key: string[], ordem: { col: string; asc: boolean }, msg: string) {
  const qc = useQueryClient();
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['gestao-custos-resumo'] });
  };

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase.from(tabela).select('*').order(ordem.col, { ascending: ordem.asc });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });

  const criar = useMutation({
    mutationFn: async (p: Partial<T>) => {
      const { error } = await supabase.from(tabela).insert(p as any);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success(`${msg} adicionado!`); },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<T> }) => {
      const { error } = await supabase.from(tabela).update({ ...dados, updated_at: new Date().toISOString() } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success('Atualizado!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tabela).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success('Removido.'); },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar: criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    deletar: deletar.mutateAsync,
    isSaving: criar.isPending || atualizar.isPending,
  };
}

export function useConsumiveis() {
  return useCrud<Consumivel>('equipamento_consumiveis', KEY_CONS, { col: 'nome', asc: true }, 'Consumível');
}

export function useManutencoes() {
  return useCrud<Manutencao>('equipamento_manutencoes', KEY_MANUT, { col: 'data', asc: false }, 'Registro');
}

/** Todos os equipamentos já com o custo por hora calculado (chave = id do equipamento). */
export function useCustosEquipamentos() {
  const { data: equipamentos = [], isLoading: l1 } = useDepreciacao();
  const { data: consumiveis = [], isLoading: l2 } = useConsumiveis();
  const { data: manutencoes = [], isLoading: l3 } = useManutencoes();

  const custos = useMemo(() => {
    const mapa: Record<string, CustoEquipamento> = {};
    for (const eq of equipamentos) {
      mapa[eq.id] = calcularCustoEquipamento(
        eq,
        consumiveis.filter(c => c.equipamento_id === eq.id),
        manutencoes.filter(m => m.equipamento_id === eq.id),
      );
    }
    return mapa;
  }, [equipamentos, consumiveis, manutencoes]);

  return { equipamentos, consumiveis, manutencoes, custos, isLoading: l1 || l2 || l3 };
}
