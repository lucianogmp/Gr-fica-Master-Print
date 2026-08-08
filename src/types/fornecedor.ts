// src/types/fornecedor.ts
export interface Fornecedor {
  id: string;
  nome: string;
  razao_social?: string;
  nome_fantasia?: string;
  cpf_cnpj?: string;
  inscricao_estadual?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  categoria?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const CATEGORIA_FORNECEDOR_OPCOES = [
  'Papel',
  'Tinta',
  'Acabamento',
  'Equipamento',
  'Manutenção',
  'Outros',
];
