// src/types/cliente.ts
export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  cpf_cnpj?: string;
  empresa_id: string;
  created_at?: string;
}