// src/types/atendimento.ts
export type TipoAtendimento = 'whatsapp' | 'ligacao' | 'email' | 'visita' | 'outro';

export interface Atendimento {
  id: string;
  cliente_id?: string | null;
  lead_id?: string | null;
  contato_id?: string | null;
  tipo: TipoAtendimento;
  data_atendimento: string;
  descricao: string;
  usuario_id?: string | null;
  usuario_nome?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const TIPO_ATENDIMENTO: Record<TipoAtendimento, { label: string; cor: string }> = {
  whatsapp: { label: 'WhatsApp', cor: 'bg-green-500/20 text-green-400 border-green-500/30' },
  ligacao:  { label: 'Ligação',  cor: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  email:    { label: 'E-mail',   cor: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  visita:   { label: 'Visita',   cor: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  outro:    { label: 'Outro',    cor: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};
