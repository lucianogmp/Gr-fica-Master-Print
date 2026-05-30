export type StatusProduto = 'ativo' | 'inativo' | 'rascunho';

export interface Categoria {
  id: string;
  nome: string;
}

export interface Produto {
  id: string;
  nome: string;
  sku?: string | null;
  descricao?: string | null;
  categoria_id?: string | null;
  status: StatusProduto;
  preco_venda: number;
  custo_mao_obra: number;
  custo_acabamento: number;
  custo_operacional: number;
  tempo_producao: string | null;   // text no banco
  icone_svg?: string | null;
  maquina?: string | null;
  setor?: string | null;
  acabamento?: string | null;
  checklist?: string | null;
  empresa_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BomItem {
  id?: string;
  produto_id: string;
  materia_id: string;
  quantidade: number;
  materias_primas?: {
    id: string;
    nome: string;
    unidade: string;
    custo_unitario: number;
  };
}

export interface CustosProduto {
  custoBOM: number;
  maoObra: number;
  acabamento: number;
  outros: number;
  overhead: number;
  total: number;
}
