// src/types/venda.ts
export type StatusVenda =
  | 'orcamento'
  | 'aprovado'
  | 'producao'
  | 'pronto'
  | 'entregue'
  | 'cancelado';

export interface Venda {
  id: string;
  numero?: number | null;
  cliente_nome: string;
  cliente_id?: string | null;
  status: StatusVenda;
  orcamento_origem_id?: string | null;
  orcamento_origem_numero?: number | null;
  desconto?: number | null;        // % global
  desconto_valor?: number | null;  // R$ calculado
  frete?: number | null;           // R$
  taxa_adicional?: number | null;  // R$ (taxas extras)
  observacoes?: string | null;
  total?: number | null;           // generated column no banco
  valor_total?: number | null;
  consumidor_final?: boolean | null;
  data_entrega?: string | null;
  data_venda?: string | null;
  vendedor?: string | null;
  vendedor_id?: string | null;
  palavra_chave?: string | null;
  tipo?: string | null;
  valor_pago?: number | null;
  forma_pagamento?: string | null;
  parcelas?: number | null;
  juros_parcelas?: number | null;  // % de juros por parcela
  created_at?: string;
  updated_at?: string;
}

export interface VendaItem {
  id?: string;
  venda_id?: string;
  produto_id?: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  desconto?: number | null;
  obs?: string | null;
  unidade?: string | null;
  area_m2?: number | null;
  total: number;
}

export interface PagamentoVenda {
  id: string;
  venda_id: string;
  valor: number;
  forma_pagamento: string;
  parcelas?: number | null;
  juros_pct?: number | null;
  data_pagamento: string;
  observacoes?: string | null;
  usuario_id?: string | null;
  usuario_nome?: string | null;
  created_at?: string;
}

export const STATUS_VENDA: Record<StatusVenda, { label: string; cor: string }> = {
  orcamento: { label: 'Orçamento',  cor: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  aprovado:  { label: 'Aprovado',   cor: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  producao:  { label: 'Produção',   cor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  pronto:    { label: 'Pronto',     cor: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  entregue:  { label: 'Entregue',   cor: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelado: { label: 'Cancelado',  cor: 'bg-red-500/20 text-red-400 border-red-500/30' },
};
