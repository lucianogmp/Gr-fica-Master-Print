// src/components/ui/HelpTooltip.tsx
//
// Ícone "?" pequeno que mostra uma explicação ao passar o mouse (ou tocar,
// no celular). Usa portal + position fixed, mesmo esquema anti-sobreposição
// do DarkSelect/DateInput/MonthInput — nunca fica cortado ou escondido atrás
// de outro elemento, mesmo dentro de modais com scroll.

import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface HelpTooltipProps {
  /** Texto explicativo mostrado no balão. Curto e direto funciona melhor. */
  texto: string;
  className?: string;
}

// Guarda global de "hover fantasma": em celular, um tap em QUALQUER lugar da
// tela pode disparar mouseenter/mouseover sintéticos logo em seguida, como
// parte da simulação de mouse que os navegadores mobile mantêm por
// compatibilidade com sites antigos feitos só pra desktop. Se esse
// mouseenter cair sobre um ícone de ajuda que esteja por perto (ex: ao lado
// de um switch que acabou de ser tocado), o balão abre sozinho sem ninguém
// ter pedido. Guardamos o instante do último toque em qualquer lugar da
// página e ignoramos qualquer mouseenter que aconteça logo depois — módulo
// compartilhado entre todas as instâncias do componente, então protege o
// app inteiro, não só este campo específico.
let ultimoToqueEm = 0;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'touchstart',
    () => { ultimoToqueEm = Date.now(); },
    { passive: true, capture: true },
  );
}
const TOQUE_RECENTE_MS = 500;

export function HelpTooltip({ texto, className }: HelpTooltipProps) {
  const [aberto, setAberto] = useState(false);
  const iconRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!aberto || !iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    const largura = 240;
    let left = r.left + r.width / 2 - largura / 2;
    left = Math.min(Math.max(left, 8), window.innerWidth - largura - 8);
    setPos({ top: r.bottom + 8, left });
  }, [aberto]);

  // Trava de segurança: fecha em QUALQUER clique fora do ícone/painel — não
  // depende só do mouse "sair" do ícone. Isso resolve dois problemas de uma
  // vez: (1) quando um toggle próximo muda o layout (ex: ligar "Arte
  // Inclusa" empurra conteúdo pra baixo), o mouse pode ficar parado mas
  // "por baixo" do ícone sem ter se movido — dispara um hover fantasma que
  // nunca recebe o mouseleave correspondente, e o tooltip fica grudado na
  // tela. (2) no toque (celular), não existe hover de verdade — precisa
  // fechar ao tocar em qualquer outro lugar, não só ao "tirar o dedo".
  useEffect(() => {
    if (!aberto) return;
    function fecharSeClicouFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (iconRef.current?.contains(alvo)) return;
      if (painelRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener('mousedown', fecharSeClicouFora);
    document.addEventListener('touchstart', fecharSeClicouFora);
    return () => {
      document.removeEventListener('mousedown', fecharSeClicouFora);
      document.removeEventListener('touchstart', fecharSeClicouFora);
    };
  }, [aberto]);

  return (
    <span className={`relative inline-flex ${className ?? ''}`}>
      <button
        type="button"
        ref={iconRef}
        onMouseEnter={() => {
          if (Date.now() - ultimoToqueEm < TOQUE_RECENTE_MS) return;
          setAberto(true);
        }}
        onMouseLeave={() => setAberto(false)}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setAberto(a => !a); }}
        tabIndex={-1}
        className="w-3.5 h-3.5 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0 cursor-help"
      >
        ?
      </button>

      {aberto && pos && createPortal(
        <div
          ref={painelRef}
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
          className="text-[11px] text-gray-300 leading-relaxed"
        >
          {texto}
        </div>,
        document.body
      )}
    </span>
  );
}
