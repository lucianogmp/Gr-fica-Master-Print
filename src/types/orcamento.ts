export type TipoCalculo = 'metro' | 'metro_manual' | 'folha' | 'livre';
export type StatusOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'convertido';

export interface OrcamentoItem {
  id?: string;
  orcamento_id?: string;
  produto_id?: string | null;
  descricao: string;
  tipo_calculo: TipoCalculo;
  largura_cm?: number | null;
  altura_cm?: number | null;
  preco_por_m2?: number | null;
  material_id?: string | null;
  folha_tipo?: string | null;
  itens_por_folha?: number | null;
  preco_por_folha?: number | null;
  quantidade: number;
  custo_unitario?: number | null;
  preco_unitario: number;
  total: number;
  acabamento_id?: string | null;
  acabamento_nome?: string | null;
  acabamento_custo?: number | null;
  acabamentos_por_folha?: number | null;
  arte_inclusa?: boolean;
}

export interface Orcamento {
  id: string;
  numero?: number | null;
  cliente_nome: string;
  status: StatusOrcamento;
  desconto?: number | null;
  observacoes?: string | null;
  total?: number | null;
  venda_id?: string | null;
  empresa_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const STATUS_ORC: Record<StatusOrcamento, { label: string; cor: string }> = {
  rascunho:   { label: 'Rascunho',   cor: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  enviado:    { label: 'Enviado',    cor: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  aprovado:   { label: 'Aprovado',   cor: 'bg-green-500/20 text-green-400 border-green-500/30' },
  recusado:   { label: 'Recusado',   cor: 'bg-red-500/20 text-red-400 border-red-500/30' },
  convertido: { label: 'Convertido', cor: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

// Arte progressiva: 20% até R$100, -5% a cada R$100, mínimo 5%
export function calcTaxaArte(total: number): number {
  if (total <= 0) return 0;
  const pct = Math.max(5, 20 - Math.floor(total / 100) * 5);
  return pct;
}

export function calcItemTotal(item: Partial<OrcamentoItem>): {
  unitario: number; total: number; area?: number;
} {
  const qtd = Number(item.quantidade ?? 1);

  if (item.tipo_calculo === 'metro' || item.tipo_calculo === 'metro_manual') {
    const w    = Number(item.largura_cm ?? 0) / 100;
    const h    = Number(item.altura_cm ?? 0) / 100;
    const m2   = Number(item.preco_por_m2 ?? 0);
    const area = w * h;
    const unit = area * m2;
    return { unitario: unit, total: unit * qtd, area };
  }

  if (item.tipo_calculo === 'folha') {
    const ppf  = Number(item.preco_por_folha ?? 0);
    const ipf  = Number(item.itens_por_folha ?? 1);
    const unit = ipf > 0 ? ppf / ipf : ppf;
    return { unitario: unit, total: unit * qtd };
  }

  const unit = Number(item.preco_unitario ?? 0);
  return { unitario: unit, total: unit * qtd };
}

// Mantém compatibilidade com código legado
export interface Material {
  id: string;
  label: string;
  preco: number;
}

export const MATERIAIS: Material[] = [];

export interface ItemOrcamento {
  descricao: string;
  preco: number;
  qtd: number;
  produtoId?: string | null;
}
