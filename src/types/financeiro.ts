export type TipoLancamento  = 'receita' | 'despesa';
export type StatusLancamento = 'pendente' | 'pago' | 'atrasado' | 'cancelado';

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  status: StatusLancamento;
  categoria?: string | null;
  venda_id?: string | null;
  cliente_nome?: string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  observacoes?: string | null;
  forma_pagamento?: string | null;
  /** Conta financeira (banco/caixa) onde o dinheiro entrou ou saiu. Obrigatória a partir de agora
   *  pra marcar como pago/recebido — lançamentos antigos ficam null até serem revisados manualmente. */
  conta_id?: string | null;
  grupo_recorrencia?: string | null;
  parcela_num?: number | null;
  total_parcelas?: number | null;
  origem?: string | null;
  created_at?: string;
}

export interface CaixaMovimento {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  descricao: string;
  cliente_nome?: string | null;
  valor: number;
  venda_id?: string | null;
  origem?: string | null;
  observacoes?: string | null;
  lancamento_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CustoFixo {
  id: string;
  nome: string;
  categoria?: string | null;
  valor_mensal: number;
  ativo: boolean;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Depreciacao {
  id: string;
  nome: string;
  categoria?: string | null;
  valor: number;
  vida_util_anos: number;
  data_aquisicao?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const CATEGORIAS_RECEITA = ['Venda', 'Serviço', 'Outros'];
export const CATEGORIAS_DESPESA = ['Fornecedor', 'Aluguel', 'Salário', 'Impostos', 'Manutenção', 'Marketing', 'Outros'];
export const FORMAS_PAGAMENTO   = ['Dinheiro', 'Pix', 'Cartão Débito', 'Cartão Crédito', 'Boleto', 'Transferência'];
