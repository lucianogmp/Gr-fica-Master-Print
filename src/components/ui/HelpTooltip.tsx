// src/components/ui/HelpTooltip.tsx
//
// Ícone "?" pequeno que mostra uma explicação ao passar o mouse (ou tocar,
// no celular). Usa portal + position fixed, mesmo esquema anti-sobreposição
// do DarkSelect/DateInput/MonthInput — nunca fica cortado ou escondido atrás
// de outro elemento, mesmo dentro de modais com scroll.

import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface HelpTooltipProps {
  /** Texto explicativo mostrado no balão. Curto e direto funciona melhor. */
  texto: string;
  className?: string;
}

export function HelpTooltip({ texto, className }: HelpTooltipProps) {
  const [aberto, setAberto] = useState(false);
  const iconRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; align: 'left' | 'center' | 'right' } | null>(null);

  useLayoutEffect(() => {
    if (!aberto || !iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    const largura = 240;
    let left = r.left + r.width / 2 - largura / 2;
    let align: 'left' | 'center' | 'right' = 'center';
    if (left < 8) { left = 8; align = 'left'; }
    if (left + largura > window.innerWidth - 8) { left = window.innerWidth - largura - 8; align = 'right'; }
    setPos({ top: r.bottom + 8, left, align });
  }, [aberto]);

  return (
    <span className={`relative inline-flex ${className ?? ''}`}>
      <button
        type="button"
        ref={iconRef}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setAberto(a => !a); }}
        tabIndex={-1}
        className="w-3.5 h-3.5 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0 cursor-help transition-colors"
      >
        ?
      </button>

      {aberto && pos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: 240,
            zIndex: 9999,
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 8,
            padding: '8px 10px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
          className="text-[11px] text-gray-300 leading-relaxed pointer-events-none"
        >
          {texto}
        </div>,
        document.body
      )}
    </span>
  );
}
