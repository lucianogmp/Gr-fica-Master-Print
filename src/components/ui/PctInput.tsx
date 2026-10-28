// src/components/ui/PctInput.tsx
//
// Mesma mecânica do QtdInput (dígitos entram da direita pra esquerda,
// Ctrl+A/duplo-clique selecionam tudo, colar só aceita dígitos — sem os
// bugs clássicos de <input type="number">), só que pra porcentagem:
// travado em 0-100 e sem separador de milhar.
import { useState, useRef, useEffect } from 'react';

const IN_BASE =
  'bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full';

export function PctInput({
  value, onChange, className, placeholder, center = true, autoFocus, style, casasDecimais = 2,
}: {
  /** Porcentagem como número (0 a 100). */
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
  center?: boolean;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  /** Casas decimais (padrão 2, igual a antes). Taxas de maquininha usam 4. */
  casasDecimais?: number;
}) {
  const FATOR = Math.pow(10, casasDecimais);
  const LIMITE_CENTESIMOS = 100 * FATOR; // 100%

  function paraTexto(centesimos: number): string {
    const c = Math.max(0, centesimos);
    const inteiro = Math.floor(c / FATOR);
    const frac = c % FATOR;
    // Comportamento original (2 casas): esconde os zeros à direita.
    if (casasDecimais === 2) {
      if (frac === 0) return String(inteiro);
      const fracTxt = frac % 10 === 0 ? String(frac / 10) : String(frac).padStart(2, '0');
      return `${inteiro},${fracTxt}`;
    }
    // Mais casas: mostra sempre todas, pra máscara ficar previsível (ex: 1,3700).
    if (casasDecimais <= 0) return String(inteiro);
    return `${inteiro},${String(frac).padStart(casasDecimais, '0')}`;
  }
  function paraCentesimos(n: number): number {
    if (!isFinite(n) || isNaN(n)) return 0;
    return Math.round(n * FATOR);
  }

  const [centesimos, setCentesimos] = useState<number>(() => paraCentesimos(value));
  const ultimoValorEmitido = useRef<number>(paraCentesimos(value));

  useEffect(() => {
    const novo = paraCentesimos(value);
    if (novo !== ultimoValorEmitido.current) {
      setCentesimos(novo);
      ultimoValorEmitido.current = novo;
    }
  }, [value]);

  function emitir(novoCentesimos: number) {
    const limitado = Math.min(Math.max(0, novoCentesimos), LIMITE_CENTESIMOS);
    setCentesimos(limitado);
    ultimoValorEmitido.current = limitado;
    onChange(Number((limitado / FATOR).toFixed(casasDecimais)));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const tudoSelecionado = el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0;

    if (e.ctrlKey || e.metaKey) return;

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      emitir(tudoSelecionado ? Number(e.key) : centesimos * 10 + Number(e.key));
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      emitir(tudoSelecionado ? 0 : Math.floor(centesimos / 10));
      return;
    }
    const permitido = ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'];
    if (!permitido.includes(e.key)) e.preventDefault();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const digitos = e.clipboardData.getData('text').replace(/\D/g, '');
    if (digitos) emitir(parseInt(digitos, 10));
  }

  function irParaOFinalSeNaoHouverSelecao(el: HTMLInputElement) {
    if (el.selectionStart !== el.selectionEnd) return;
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      value={paraTexto(centesimos)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={e => irParaOFinalSeNaoHouverSelecao(e.target)}
      onClick={e => irParaOFinalSeNaoHouverSelecao(e.currentTarget)}
      onChange={() => {/* controlado via onKeyDown/onPaste */}}
      placeholder={placeholder}
      style={style}
      className={[className ?? IN_BASE, center ? 'text-center' : ''].join(' ')}
      autoComplete="off"
    />
  );
}
