// src/hooks/useLeads.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Lead, StatusLead } from '../types/lead';
import { Cliente } from '../types/cliente';
import toast from 'react-hot-toast';

type LeadPayload = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'cliente_id' | 'convertido_em'>;

export function useLeads() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['leads'],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: LeadPayload) => {
      const { data, error } = await supabase.from('leads').insert(payload).select().single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead cadastrado!');
    },
    onError: () => toast.error('Erro ao cadastrar lead.'),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<LeadPayload> }) => {
      const { error } = await supabase
        .from('leads')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar lead.'),
  });

  // Muda apenas o status (uso rápido nos cards/lista)
  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusLead }) => {
      const { error } = await supabase
        .from('leads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
    onError: () => toast.error('Erro ao mudar status do lead.'),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead removido.');
    },
    onError: () => toast.error('Erro ao remover lead.'),
  });

  // ── Conversão Lead → Cliente ──────────────────────────────────────────────
  // Cria o cliente a partir dos dados do lead, vincula o lead.cliente_id
  // e marca convertido_em. O lead some da lista de Leads automaticamente
  // (a tela de Leads filtra apenas os que têm cliente_id nulo).
  const converter = useMutation({
    mutationFn: async (lead: Lead) => {
      const novoCliente: Omit<Cliente, 'id' | 'created_at' | 'updated_at'> = {
        nome: lead.empresa || lead.nome,
        telefone: lead.telefone ?? undefined,
        como_conheceu: lead.como_conheceu ?? undefined,
        produto_interesse: lead.produto_interesse ?? undefined,
        observacoes: lead.observacoes ?? undefined,
      };

      const { data: clienteCriado, error: errCliente } = await supabase
        .from('clientes')
        .insert(novoCliente)
        .select()
        .single();
      if (errCliente) throw errCliente;

      const { error: errLead } = await supabase
        .from('leads')
        .update({
          cliente_id: (clienteCriado as Cliente).id,
          convertido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);
      if (errLead) throw errLead;

      return clienteCriado as Cliente;
    },
    onSuccess: (cliente) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success(`Lead convertido em cliente: ${cliente.nome}!`);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao converter lead em cliente.'),
  });

  return {
    ...query,
    criar:           criar.mutateAsync,
    atualizar:       atualizar.mutateAsync,
    atualizarStatus: atualizarStatus.mutate,
    deletar:         deletar.mutate,
    converter:       converter.mutateAsync,
    isSaving:        criar.isPending || atualizar.isPending,
    isConvertendo:   converter.isPending,
  };
}
