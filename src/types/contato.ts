// src/types/contato.ts
export interface Contato {
  id: string;
  cliente_id: string;
  nome: string;
  cargo?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  data_nascimento?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}
