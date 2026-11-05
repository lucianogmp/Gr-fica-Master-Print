// src/components/ui/PainelFlutuante.tsx
//
// Painel suspenso padrão (menus de Ordenar/Filtros etc.): vai para o <body> com
// position:fixed, fundo 100% opaco (.floating-panel) e z-index alto — assim não
// fica transparente, não é cortado por tabelas/cards com overflow e acompanha a
// rolagem da página. Fecha ao clicar fora ou com Esc.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** Elemento âncora (o botão que abre o painel). */
  ancora: RefObject<HTMLElement | null>;
  aberto: boolean;
  onFechar: () => void;
  /** Largura desejada em px (limitada à largura da tela). */
  largura?: number;
  /** Lado da âncora em que o painel se alinha. */
  alinhar?: 'left' | 'right';
  className?: string;
  children: ReactNode;
}

export function PainelFlutuante({ ancora, aberto, onFechar, largura = 288, alinhar = 'right', className = '', children }: Props) {
  const painelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (aberto && ancora.current) setRect(ancora.current.getBoundingClientRect());
  }, [aberto, ancora]);

  useEffect(() => {
    if (!aberto) return;
    const reposicionar = (e?: Event) => {
      if (e && painelRef.current && e.target instanceof Node && painelRef.current.contains(e.target)) return;
      if (ancora.current) setRect(ancora.current.getBoundingClientRect());
    };
    const fora = (e: MouseEvent) => {
      const t = e.target as Node;
      if (painelRef.current?.contains(t) || ancora.current?.contains(t)) return;
      // cliques dentro de popovers de data/seleção (também em portais) não fecham o painel
      if ((t as HTMLElement).closest?.('.floating-panel')) return;
      onFechar();
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('scroll', reposicionar, true);
    window.addEventListener('resize', reposicionar);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('scroll', reposicionar, true);
      window.removeEventListener('resize', reposicionar);
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto, ancora, onFechar]);

  if (!aberto || !rect) return null;

  const margem = 8;
  const w = Math.min(largura, window.innerWidth - margem * 2);
  let left = alinhar === 'right' ? rect.right - w : rect.left;
  left = Math.max(margem, Math.min(left, window.innerWidth - w - margem));
  // abre pra cima se não couber embaixo
  const espacoBaixo = window.innerHeight - rect.bottom - margem;
  const abrePraCima = espacoBaixo < 260 && rect.top > espacoBaixo;
  const posVertical = abrePraCima
    ? { bottom: window.innerHeight - rect.top + 6, maxHeight: Math.max(160, rect.top - margem - 6) }
    : { top: rect.bottom + 6, maxHeight: Math.max(160, espacoBaixo - 6) };

  return createPortal(
    <div ref={painelRef} className={`floating-panel ${className}`}
      style={{ position: 'fixed', left, width: w, zIndex: 9990, overflowY: 'auto', ...posVertical }}>
      {children}
    </div>,
    document.body,
  );
}
