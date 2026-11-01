// "Ocultar valores" do Dashboard: esconde dinheiro e variações, mantém a % do ponto de equilíbrio.
import { useSyncExternalStore } from 'react';

const CHAVE = 'mp-ocultar-valores';
let oculto = false;
try { oculto = localStorage.getItem(CHAVE) === '1'; } catch { /* ignora */ }
const ouvintes = new Set<() => void>();

export function alternarOcultar() {
  oculto = !oculto;
  try { localStorage.setItem(CHAVE, oculto ? '1' : '0'); } catch { /* ignora */ }
  ouvintes.forEach(f => f());
}

export function useOcultarValores() {
  return useSyncExternalStore(
    cb => { ouvintes.add(cb); return () => { ouvintes.delete(cb); }; },
    () => oculto,
  );
}

export const MASCARA = '••••';

/** Moeda em R$, ou "R$ ••••" quando os valores estão ocultos. */
export const moeda = (v: number | null | undefined) =>
  oculto ? `R$ ${MASCARA}` : Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
