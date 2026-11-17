// Leitura do tamanho de um item vendido (mesma fonte que o PDF de custos usa):
// placas → detalhe_placa; itens por m² → medidas em `obs` ("30 × 30 cm") ou no nome ("1,00×0,60m").
import type { DetalhePlaca } from './placaCalc';

export interface TamanhoItem {
  texto: string;
  /** Área total em m² (já multiplicada pela quantidade). null = não deu pra descobrir. */
  areaTotal: number | null;
}

const num = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
const numSimples = (s: string) => parseFloat(s.replace(',', '.')) || 0;
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export function tamanhoDoItem(i: {
  detalhe_placa?: DetalhePlaca | null; obs?: string | null; descricao?: string | null;
  unidade?: string | null; quantidade: number; area_m2?: number | null;
}): TamanhoItem {
  const qtd = Number(i.quantidade) || 0;
  const d = i.detalhe_placa;
  if (d && d.largura && d.altura) {
    return { texto: `${fmt(d.largura)} × ${fmt(d.altura)} m`, areaTotal: Number(d.area_total_m2) || d.largura * d.altura * (d.quantidade || qtd) };
  }
  if (i.area_m2) return { texto: `${fmt(Number(i.area_m2))} m²`, areaTotal: Number(i.area_m2) * qtd };
  const cm = (i.obs ?? '').match(/([\d.,]+)\s*[×x]\s*([\d.,]+)\s*cm/i);
  if (cm) {
    const w = numSimples(cm[1]), h = numSimples(cm[2]);
    return { texto: `${fmt(w)} × ${fmt(h)} cm`, areaTotal: (w / 100) * (h / 100) * qtd };
  }
  const m = `${i.descricao ?? ''} ${i.obs ?? ''}`.match(/(\d+[.,]?\d*)\s*[×x]\s*(\d+[.,]?\d*)\s*m\b/i);
  if (m) {
    const w = num(m[1]), h = num(m[2]);
    return { texto: `${fmt(w)} × ${fmt(h)} m`, areaTotal: w * h * qtd };
  }
  if ((i.unidade ?? '').toLowerCase().startsWith('m')) return { texto: `${fmt(qtd)} m²`, areaTotal: qtd };
  return { texto: '—', areaTotal: null };
}
