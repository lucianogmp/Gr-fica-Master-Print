// src/hooks/useListaTeclado.ts
//
// Navegação por teclado compartilhada pelos campos de seleção com lista
// suspensa (cliente, vendedor, produto...):
//   ↓ / ↑   abre a lista (se fechada) e move o destaque, dando a volta nas pontas
//   Enter   escolhe o item destacado (só com a lista aberta)
//   Esc     fecha a lista (sem fechar o modal/tela que estiver por trás)
//   Tab     fecha a lista e segue o fluxo normal
// O item destacado sempre rola para dentro da área visível da lista.
//
// Uso: no painel da lista ponha `ref={listaRef}`; em cada opção `data-nav={idx}`,
// `onMouseEnter={() => setIndice(idx)}` e destaque quando `idx === indice`.

import { useCallback, useEffect, useRef, useState } from 'react';

// Marca a hora da última tecla: o destaque só "puxa" a rolagem quando veio do
// teclado. Com o mouse (roda do mouse passando itens sob o cursor) puxar a
// rolagem brigava com o usuário e travava a lista.
let ultimaTecla = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', () => { ultimaTecla = Date.now(); }, true);
}

/** Rola SÓ o container da lista (nunca a página) pra mostrar o item. */
function mostrarItemNaLista(lista: HTMLElement | null | undefined, item: HTMLElement | null | undefined) {
  if (!lista || !item || Date.now() - ultimaTecla > 400) return;
  const l = lista.getBoundingClientRect();
  const i = item.getBoundingClientRect();
  if (i.top < l.top) lista.scrollTop -= l.top - i.top;
  else if (i.bottom > l.bottom) lista.scrollTop += i.bottom - l.bottom;
}

interface Opcoes<T> {
  itens: T[];
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
  onSelecionar: (item: T) => void;
  /** Muda quando o conjunto de opções muda de verdade (ex.: texto da busca). */
  chave?: string;
}

export function useListaTeclado<T>({ itens, aberto, abrir, fechar, onSelecionar, chave }: Opcoes<T>) {
  const [indice, setIndice] = useState(0);
  const listaRef = useRef<HTMLDivElement | null>(null);

  // Nova lista (ou lista reaberta): volta o destaque pro primeiro item.
  useEffect(() => { setIndice(0); }, [itens.length, aberto, chave]);

  // Mantém o destaque visível ao andar pela lista.
  useEffect(() => {
    if (!aberto) return;
    mostrarItemNaLista(listaRef.current, listaRef.current?.querySelector<HTMLElement>(`[data-nav="${indice}"]`));
  }, [indice, aberto, itens.length]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    const n = itens.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!aberto) { abrir(); return; }
        if (n > 0) setIndice(i => (i + 1) % n);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!aberto) { abrir(); return; }
        if (n > 0) setIndice(i => (i - 1 + n) % n);
        break;
      case 'Enter':
        if (aberto && n > 0 && itens[indice] !== undefined) {
          e.preventDefault();
          onSelecionar(itens[indice]);
        }
        break;
      case 'Escape':
        if (aberto) { e.preventDefault(); e.stopPropagation(); fechar(); }
        break;
      case 'Tab':
        if (aberto) fechar();
        break;
    }
  }, [itens, aberto, indice, abrir, fechar, onSelecionar]);

  return { indice, setIndice, onKeyDown, listaRef };
}

/** Para listas que já têm a própria navegação por setas: só garante que o item
 *  destacado (`data-nav={idx}`) role para dentro da área visível. */
export function useRolarItemAtivo(
  containerRef: React.RefObject<HTMLElement | null>,
  indice: number,
  ativo: boolean,
) {
  useEffect(() => {
    if (!ativo) return;
    mostrarItemNaLista(containerRef.current, containerRef.current?.querySelector<HTMLElement>(`[data-nav="${indice}"]`));
  }, [containerRef, indice, ativo]);
}
