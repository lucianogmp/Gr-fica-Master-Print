// src/types/cliente.ts
export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  cpf_cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  situacao_cadastral?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  cnae_principal?: string;
  observacoes?: string;
  como_conheceu?: string;
  produto_interesse?: string;
  data_nascimento?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const COMO_CONHECEU_OPCOES = [
  'WhatsApp',
  'Instagram',
  'Facebook',
  'Indicação',
  'Google',
  'Loja física',
  'Outro',
] as const;
