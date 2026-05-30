import { useMemo } from 'react';
import { PAPEIS } from '../types/calculadora';

interface Params {
  papelKey: string;
  larguraItem: number;
  alturaItem: number;
  quantidadeTotal: number;
  tipoMaterial: 'adesivo' | 'tag';
}

export function useCalculoFolhas({ papelKey, larguraItem, alturaItem, quantidadeTotal, tipoMaterial }: Params) {
  return useMemo(() => {
    const papel = PAPEIS[papelKey];
    const esp = tipoMaterial === 'tag' ? 0.30 : 0.15; // Espaçamento entre itens
    
    // Área útil (Descontando as margens da impressora)
    const uw = papel.w - (papel.margem * 2);
    const uh = papel.h - (papel.margem * 2);

    if (larguraItem <= 0 || alturaItem <= 0) return null;

    // Teste 1: Normal
    const c1 = Math.floor((uw + esp) / (larguraItem + esp));
    const r1 = Math.floor((uh + esp) / (alturaItem + esp));
    const total1 = Math.max(0, c1 * r1);

    // Teste 2: Rotacionado (Deitado)
    const c2 = Math.floor((uw + esp) / (alturaItem + esp));
    const r2 = Math.floor((uh + esp) / (larguraItem + esp));
    const total2 = Math.max(0, c2 * r2);

    const melhorRotacionado = total2 > total1;
    const porFolha = melhorRotacionado ? total2 : total1;
    const totalFolhas = porFolha > 0 ? Math.ceil(quantidadeTotal / porFolha) : 0;

    return {
      porFolha,
      totalFolhas,
      cols: melhorRotacionado ? c2 : c1,
      rows: melhorRotacionado ? r2 : r1,
      rotacionado: melhorRotacionado,
      areaUtil: `${uw.toFixed(1)}x${uh.toFixed(1)}cm`
    };
  }, [papelKey, larguraItem, alturaItem, quantidadeTotal, tipoMaterial]);
}