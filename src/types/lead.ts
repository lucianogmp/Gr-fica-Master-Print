// src/types/lead.ts
export type StatusLead = 'novo' | 'negociacao' | 'aguardando' | 'perdido';

export interface Lead {
  id: string;
  nome: string;
  telefone?: string | null;
  empresa?: string | null;
  como_conheceu?: string | null;
  produto_interesse?: string | null;
  status: StatusLead;
  observacoes?: string | null;
  cliente_id?: string | null;     // preenchido quando convertido
  convertido_em?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const STATUS_LEAD: Record<StatusLead, { label: string; cor: string }> = {
  novo:        { label: 'Novo',              cor: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  negociacao:  { label: 'Em Negociação',     cor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  aguardando:  { label: 'Aguardando Retorno', cor: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  perdido:     { label: 'Perdido',           cor: 'bg-red-500/20 text-red-400 border-red-500/30' },
};
