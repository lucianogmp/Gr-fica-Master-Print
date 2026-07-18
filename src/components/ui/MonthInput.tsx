// src/components/ui/MonthInput.tsx
//
// Campo de mês/ano com seletor próprio, no mesmo visual do DateInput —
// substitui o <input type="month"> nativo do navegador.
//
// Uso: value/onChange trabalham com string no formato "YYYY-MM"
// (mesmo formato que o type="month" nativo já usava).
//
//   <MonthInput value={mes} onChange={setMes} className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm" />

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_COMPLETO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function parseYM(ym?: string | null): { ano: number; mes: number } | null {
  if (!ym) return null;
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return null;
  return { ano: y, mes: m - 1 };
}

function toYM(ano: number, mes: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}`;
}

interface MonthInputProps {
  /** Valor no formato "YYYY-MM" (mesmo que type="month" nativo). */
  value: string | null | undefined;
  onChange: (valor: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
}

export function MonthInput({ value, onChange, className, placeholder = 'mês/aaaa', disabled, align = 'left' }: MonthInputProps) {
  const [aberto, setAberto] = useState(false);
  const selecionado = parseYM(value);
  const hoje = new Date();
  const [anoVisivel, setAnoVisivel] = useState<number>(selecionado?.ano ?? hoje.getFullYear());
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Mesmo esquema de posicionamento do DateInput: portal em document.body,
  // position fixed calculado pelo campo, z-index altíssimo — nunca fica
  // cortado ou "transparente" atrás de outros elementos.
  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    function calcular() {
      const r = botaoRef.current!.getBoundingClientRect();
      const largura = 240;
      const alturaEstimada = 230;
      const espacoAbaixo = window.innerHeight - r.bottom;
      const abrirParaCima = espacoAbaixo < alturaEstimada && r.top > alturaEstimada;

      let left = align === 'right' ? r.right - largura : r.left;
      left = Math.min(Math.max(left, 8), window.innerWidth - largura - 8);

      setPos({
        top: abrirParaCima ? r.top - alturaEstimada - 6 : r.bottom + 6,
        left,
        width: largura,
      });
    }
    calcular();
    window.addEventListener('scroll', calcular, true);
    window.addEventListener('resize', calcular);
    return () => {
      window.removeEventListener('scroll', calcular, true);
      window.removeEventListener('resize', calcular);
    };
  }, [aberto, align]);

  useEffect(() => {
    if (!aberto) return;
    function onClickFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (botaoRef.current?.contains(alvo)) return;
      if (painelRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', onClickFora);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickFora);
      document.removeEventListener('keydown', onEsc);
    };
  }, [aberto]);

  useEffect(() => {
    if (selecionado) setAnoVisivel(selecionado.ano);
  }, [value]);

  function abrir() {
    if (disabled) return;
    setAnoVisivel(selecionado?.ano ?? hoje.getFullYear());
    setAberto(true);
  }

  function selecionarMes(mes: number) {
    onChange(toYM(anoVisivel, mes));
    setAberto(false);
  }

  const label = selecionado ? `${MESES_COMPLETO[selecionado.mes]} de ${selecionado.ano}` : '';

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={abrir}
        disabled={disabled}
        className={`${className ?? ''} flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed capitalize`}
      >
        <span className={label ? 'text-white' : 'text-gray-500'}>{label || placeholder}</span>
        <CalendarIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
      </button>

      {aberto && pos && createPortal(
        <div
          ref={painelRef}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-[9999] bg-[#1f2937] border border-gray-700 rounded-xl shadow-2xl shadow-black/50 p-3"
        >
          {/* Cabeçalho: navegação de ano */}
          <div className="flex items-center justify-between mb-2">
            <button type="button"
              onClick={() => setAnoVisivel(a => a - 1)}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white">{anoVisivel}</span>
            <button type="button"
              onClick={() => setAnoVisivel(a => a + 1)}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grade de meses */}
          <div className="grid grid-cols-4 gap-1">
            {MESES_ABREV.map((nome, i) => {
              const isSelecionado = selecionado?.ano === anoVisivel && selecionado?.mes === i;
              const isMesAtual = hoje.getFullYear() === anoVisivel && hoje.getMonth() === i;
              return (
                <button
                  type="button"
                  key={nome}
                  onClick={() => selecionarMes(i)}
                  className={[
                    'text-xs py-2 rounded-md transition-colors capitalize',
                    isSelecionado ? 'bg-blue-600 text-white font-bold hover:bg-blue-500'
                      : isMesAtual ? 'bg-gray-700 text-white font-bold hover:bg-gray-600'
                      : 'text-gray-300 hover:bg-gray-700',
                  ].join(' ')}
                >
                  {nome}
                </button>
              );
            })}
          </div>

          {/* Rodapé: Limpar / Este mês */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
            <button type="button" onClick={() => { onChange(''); setAberto(false); }}
              className="text-[11px] font-bold text-gray-400 hover:text-white transition-colors">
              Limpar
            </button>
            <button type="button" onClick={() => { setAnoVisivel(hoje.getFullYear()); onChange(toYM(hoje.getFullYear(), hoje.getMonth())); setAberto(false); }}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors">
              Este mês
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
