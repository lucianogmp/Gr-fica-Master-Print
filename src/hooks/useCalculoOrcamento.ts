import { useMemo } from 'react';
import { MATERIAIS } from '../types/orcamento';

interface CalcParams {
  largura: string;
  altura: string;
  quantidade: number;
  materialId: string;
  temArte: boolean;
  custoOperacionalPct: number;
  arredondar: boolean;
  itensAdicionais: any[];
}

export function useCalculoOrcamento(p: CalcParams) {
  return useMemo(() => {
    const larg = parseFloat(p.largura) / 100 || 0;
    const alt = parseFloat(p.altura) / 100 || 0;
    const qtd = p.quantidade || 1;
    const mat = MATERIAIS.find(m => m.id === p.materialId) || MATERIAIS[0];

    const area = larg * alt;
    let unitario = area * mat.preco;
    
    if (!p.temArte) unitario *= 1.20; // Acréscimo de 20% sem arte

    const totalImpressao = unitario * qtd;
    const totalItensAdicionais = p.itensAdicionais.reduce((sum, i) => sum + (i.preco * i.qtd), 0);
    
    const acrescimoCustoOp = totalImpressao * (p.custoOperacionalPct / 100);
    
    const grandTotal = totalImpressao + acrescimoCustoOp + totalItensAdicionais;
    const grandArredondado = Math.ceil(grandTotal / 5) * 5;

    return {
      area,
      unitario,
      totalImpressao,
      acrescimoCustoOp,
      totalItensAdicionais,
      grandTotal,
      grandArredondado,
      valorFinal: p.arredondar ? grandArredondado : grandTotal
    };
  }, [p]);
}