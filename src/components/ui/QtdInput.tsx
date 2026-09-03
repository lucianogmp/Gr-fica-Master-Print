// src/components/ui/QtdInput.tsx
//
// Campo de quantidade no mesmo estilo "calculadora de caixa registradora" do
// MoneyInput/MedidaInput — dígitos entram da direita pra esquerda empurrando
// a vírgula, Ctrl+A/duplo-clique selecionam tudo pra sobrescrever, colar só
// aceita dígitos. Isso evita os bugs clássicos de <input type="number"> em
// React (cursor pulando, dígito comido, scroll do mouse mudando o valor,
// etc.) — usado em Orçamentos desde sempre; extraído aqui pra ficar padrão
// em qualquer lugar do sistema que peça uma quantidade.
import { useState, useRef, useEffect } from 'react';

const IN_BASE =
  'bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full';

export function QtdInput({
  value, onChange, className, placeholder, center, big, autoFocus,
}: {
  /** Quantidade como string (ex: "3", "1.5", "" pra vazio). */
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  center?: boolean;
  big?: boolean;
  autoFocus?: boolean;
}) {
  const LIMITE_CENTESIMOS = 99_999_999;

  function paraTexto(centesimos: number): string {
    const v = (Math.max(0, centesimos) / 100).toFixed(2);
    const [intPart, decPart] = v.split('.');
    const intFormatado = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intFormatado},${decPart}`;
  }
  function paraCentesimos(valor: string): number {
    const n = parseFloat((valor || '0').replace(',', '.'));
    if (!isFinite(n) || isNaN(n)) return 0;
    return Math.round(n * 100);
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
    const limitado = Math.min(novoCentesimos, LIMITE_CENTESIMOS);
    setCentesimos(limitado);
    ultimoValorEmitido.current = limitado;
    onChange(limitado > 0 ? String(limitado / 100) : '');
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
      className={[
        className ?? IN_BASE,
        center ? 'text-center' : '',
        big ? 'text-xl font-black py-3' : '',
      ].join(' ')}
      autoComplete="off"
    />
  );
}
