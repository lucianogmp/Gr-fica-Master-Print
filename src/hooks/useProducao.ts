import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { OrdemProducao, Etapa } from '../types/producao';
import toast from 'react-hot-toast';

type OPPayload = Omit<OrdemProducao, 'id' | 'created_at' | 'updated_at'>;

export function useProducao() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['producao'],
    queryFn: async (): Promise<OrdemProducao[]> => {
      const { data, error } = await supabase
        .from('producao')
        .select('*, vendas(numero, cliente_nome, data_entrega)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: OPPayload) => {
      const { data, error } = await supabase
        .from('producao')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as OrdemProducao;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['producao'] }); toast.success('Ordem criada!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const moverEtapa = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: Etapa }) => {
      const { error } = await supabase
        .from('producao')
        .update({ etapa, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['producao'] }),
    onError:   (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<OPPayload> }) => {
      const { error } = await supabase
        .from('producao')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['producao'] }); toast.success('Salvo!'); },
    onError:   (e: any) => toast.error(e.message),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('producao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['producao'] }); toast.success('Ordem removida.'); },
    onError:   (e: any) => toast.error(e.message),
  });

  return {
    ...query,
    criar:      criar.mutateAsync,
    moverEtapa: moverEtapa.mutate,
    atualizar:  atualizar.mutateAsync,
    deletar:    deletar.mutate,
    isSaving:   criar.isPending || atualizar.isPending,
  };
}
