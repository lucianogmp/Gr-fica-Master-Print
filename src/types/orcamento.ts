export interface Material {
  id: string;
  label: string;
  preco: number;
}

export const MATERIAIS: Material[] = [
  { id: "papel_comum",   label: "Papel Comum 75g",  preco: 30 },
  { id: "papel_matte",   label: "Papel Matte 108g", preco: 50 },
  { id: "adesivo_vinil", label: "Adesivo Vinil",    preco: 90 },
  { id: "adesivo_papel", label: "Adesivo de Papel", preco: 75 },
  { id: "lona",          label: "Lona",             preco: 90 },
];

export interface ItemOrcamento {
  descricao: string;
  preco: number;
  qtd: number;
  produtoId?: string | null;
}