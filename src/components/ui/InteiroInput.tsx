// src/components/ui/InteiroInput.tsx
//
// Campo de número INTEIRO (sem casas decimais) no mesmo estilo "calculadora
// de caixa registradora" do MoneyInput/MedidaInput/QtdInput — mas sem dividir
// por 100. Serve pra quantidades que não fazem sentido com decimais: horas,
// minutos, unidades inteiras.
//
// Por que não reaproveitar o QtdInput aqui: ele sempre formata como "X,XX"
// (2 casas decimais fixas), então digitar "3" horas mostrava "0,03" —
// exatamente o motivo do bug de horas/minutos no cadastro de produto.
import { useState, useRef, useEffect } from 'react';

const IN_BASE =
  'bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full';

interface InteiroInputProps {
  /** Valor atual (ex: 3, "3", "" pra vazio/zero). */
  value: number | string | null | undefined;
  onChange: (v: number) => void;
  /** Valor máximo permitido (ex: 59 pra minutos). Sem limite se omitido. */
  max?: number;
  className?: string;
  placeholder?: string;
  center?: boolean;
  autoFocus?: boolean;
  style?: React.CSSProperties;
}

export function InteiroInput({
  value, onChange, max, className, placeholder, center = true, autoFocus, style,
}: InteiroInputProps) {
  function paraNumero(v: number | string | null | undefined): number {
    const n = typeof v === 'string' ? parseInt(v, 10) : (v ?? 0);
    return isFinite(n) && !isNaN(n) ? Math.max(0, n) : 0;
  }

  const [num, setNum] = useState<number>(() => paraNumero(value));
  const ultimoValorEmitido = useRef<number>(paraNumero(value));

  useEffect(() => {
    const novo = paraNumero(value);
    if (novo !== ultimoValorEmitido.current) {
      setNum(novo);
      ultimoValorEmitido.current = novo;
    }
  }, [value]);

  function emitir(novoNum: number) {
    const limitado = max != null ? Math.min(novoNum, max) : novoNum;
    setNum(limitado);
    ultimoValorEmitido.current = limitado;
    onChange(limitado);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const tudoSelecionado = el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0;

    if (e.ctrlKey || e.metaKey) return;

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      emitir(tudoSelecionado ? Number(e.key) : num * 10 + Number(e.key));
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      emitir(tudoSelecionado ? 0 : Math.floor(num / 10));
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
      value={num > 0 ? String(num) : ''}
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
