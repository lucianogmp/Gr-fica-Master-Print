// src/components/ui/MoneyInput.tsx
//
// Campo de valor em reais no estilo "calculadora de caixa registradora":
// o usuário só digita números e eles vão entrando da direita para a
// esquerda, empurrando as casas decimais. Não precisa apagar o "0,00"
// antes de digitar — é só começar a digitar por cima.
//
// Também respeita seleção de texto: se tudo estiver selecionado (Ctrl+A ou
// duplo-clique), o próximo dígito digitado substitui o valor inteiro em vez
// de ser empurrado pro final por cima do que já estava lá.
//
// Exemplos: digitar 1 → 0,01 | digitar 1000 → 10,00 | digitar 100000 → 1.000,00

import { useEffect, useRef, useState } from 'react';

const LIMITE_CENTAVOS = 999_999_999_999; // até R$ 9.999.999.999,99

function centavosParaTexto(centavos: number): string {
  const v = (Math.max(0, centavos) / 100).toFixed(2);
  const [intPart, decPart] = v.split('.');
  const intFormatado = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatado},${decPart}`;
}

function reaisParaCentavos(valor: number | string | null | undefined): number {
  const n = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : (valor ?? 0);
  if (!isFinite(n) || isNaN(n)) return 0;
  return Math.round(n * 100);
}

interface MoneyInputProps {
  /** Valor atual em reais (ex: 45.9 para R$ 45,90). */
  value: number | string | null | undefined;
  /** Disparado a cada dígito com o novo valor em reais (ex: 45.9). */
  onChange: (valorEmReais: number) => void;
  onBlur?: () => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
}

export function MoneyInput({
  value, onChange, onBlur, className, style, placeholder, autoFocus, disabled, required, id, name,
}: MoneyInputProps) {
  const [centavos, setCentavos] = useState<number>(() => reaisParaCentavos(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const ultimoValorEmitido = useRef<number>(reaisParaCentavos(value));

  // Sincroniza quando o valor muda por fora (ex: carregar registro para edição, resetar formulário).
  useEffect(() => {
    const novo = reaisParaCentavos(value);
    if (novo !== ultimoValorEmitido.current) {
      setCentavos(novo);
      ultimoValorEmitido.current = novo;
    }
  }, [value]);

  function emitir(novoCentavos: number) {
    const limitado = Math.min(novoCentavos, LIMITE_CENTAVOS);
    setCentavos(limitado);
    ultimoValorEmitido.current = limitado;
    onChange(limitado / 100);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    const el = e.currentTarget;
    // Tudo selecionado (Ctrl+A, duplo-clique, etc): o próximo dígito começa
    // um valor novo do zero, em vez de ser empurrado por cima do que já tinha.
    const tudoSelecionado = el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0;

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      emitir(tudoSelecionado ? Number(e.key) : centavos * 10 + Number(e.key));
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      emitir(tudoSelecionado ? 0 : Math.floor(centavos / 10));
      return;
    }
    // Navegação e atalhos continuam funcionando; qualquer outra tecla (letras, símbolos) é ignorada
    // porque quem controla o formato é o próprio componente.
    const permitido = ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'];
    if (!permitido.includes(e.key)) {
      e.preventDefault();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    if (disabled) return;
    const texto = e.clipboardData.getData('text');
    const digitos = texto.replace(/\D/g, '');
    if (!digitos) return;
    emitir(parseInt(digitos, 10));
  }

  // Só força o cursor pro final quando NÃO existe uma seleção em andamento —
  // assim um duplo-clique (que seleciona o conteúdo inteiro) não é desfeito
  // por este mesmo handler logo em seguida.
  function irParaOFinalSeNaoHouverSelecao(el: HTMLInputElement) {
    if (el.selectionStart !== el.selectionEnd) return;
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      value={centavosParaTexto(centavos)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={e => irParaOFinalSeNaoHouverSelecao(e.target)}
      onClick={e => irParaOFinalSeNaoHouverSelecao(e.currentTarget)}
      onChange={() => {/* controlado inteiramente via onKeyDown/onPaste */}}
      onBlur={onBlur}
      className={className}
      style={style}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
      required={required}
      autoComplete="off"
    />
  );
}
