import { useEffect, useRef, useState } from 'react';

/**
 * O Recharts (ResponsiveContainer) mede o tamanho do container assim que
 * monta. Dentro de grids CSS aninhados (grid dentro de grid, como no
 * Dashboard), às vezes o layout ainda não terminou de calcular as colunas
 * nesse instante, e a primeira medição vem 0 — o Recharts solta um aviso
 * no console, mesmo o gráfico renderizando certinho um instante depois.
 *
 * Em vez de adivinhar quanto tempo esperar (um `setTimeout` ou alguns
 * `requestAnimationFrame` podem não ser suficientes em grids aninhados
 * mais lentos pra assentar), esse hook observa o próprio elemento com
 * ResizeObserver e só libera a renderização do gráfico quando ele
 * realmente já tem largura e altura maiores que zero. Determinístico,
 * não depende de quanto tempo o layout demora.
 */
export function useContainerReady<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      setPronto(true);
      return;
    }

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setPronto(true);
          ro.disconnect();
          return;
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, pronto };
}
