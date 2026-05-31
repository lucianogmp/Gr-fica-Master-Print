import { PAPEIS } from '../types/calculadora';

interface Params {
  papelKey: string;
  larguraItem: number;
  alturaItem: number;
  quantidadeTotal: number;
  tipoMaterial: 'adesivo' | 'tag';
}

interface Resultado {
  cols: number;
  rows: number;
  porFolha: number;
  totalFolhas: number;
  areaUtil: string;
  rotacionado: boolean;
}

// Espaçamento entre itens conforme tipo
const ESPACO: Record<'adesivo' | 'tag', number> = {
  adesivo: 0.15, // 1.5mm
  tag:     0.50, // 5mm
};

function calcEncaixe(
  papelW: number, papelH: number, margem: number,
  itemW: number, itemH: number, esp: number
): { cols: number; rows: number; total: number } {
  const areaW = papelW - margem * 2;
  const areaH = papelH - margem * 2;
  const cols = Math.floor((areaW + esp) / (itemW + esp));
  const rows = Math.floor((areaH + esp) / (itemH + esp));
  return { cols: Math.max(0, cols), rows: Math.max(0, rows), total: Math.max(0, cols) * Math.max(0, rows) };
}

export function useCalculoFolhas(p: Params): Resultado | null {
  const papel = PAPEIS[p.papelKey];
  if (!papel || p.larguraItem <= 0 || p.alturaItem <= 0) return null;

  const esp = ESPACO[p.tipoMaterial];
  const normal   = calcEncaixe(papel.w, papel.h, papel.margem, p.larguraItem, p.alturaItem, esp);
  const rotacion = calcEncaixe(papel.w, papel.h, papel.margem, p.alturaItem, p.larguraItem, esp);

  const melhor   = rotacion.total > normal.total ? rotacion : normal;
  const rotou    = rotacion.total > normal.total;

  if (melhor.total === 0) return null;

  const totalFolhas = Math.ceil(p.quantidadeTotal / melhor.total);
  const areaUsada   = ((melhor.cols * (rotou ? p.alturaItem : p.larguraItem)) *
                       (melhor.rows * (rotou ? p.larguraItem : p.alturaItem))) /
                      ((papel.w - papel.margem * 2) * (papel.h - papel.margem * 2)) * 100;

  return {
    cols:        melhor.cols,
    rows:        melhor.rows,
    porFolha:    melhor.total,
    totalFolhas,
    areaUtil:    `${areaUsada.toFixed(0)}%`,
    rotacionado: rotou,
  };
}
