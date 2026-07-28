// src/components/ui/MedidaInput.tsx
//
// Campo de medida em metros no mesmo estilo "calculadora de caixa
// registradora" do MoneyInput: o usuário só digita números e eles vão
// entrando da direita pra esquerda, empurrando as casas decimais. Não
// precisa apagar o "0,00" antes de digitar — é só começar a digitar por cima.
//
// Exemplos: digitar 1 → 0,01 m | digitar 150 → 1,50 m | digitar 200 → 2,00 m

import { useEffect, useRef, useState } from 'react';

const LIMITE_CENTESIMOS = 99_999_999; // até 999.999,99 m — mais que suficiente pra qualquer peça

function centesimosParaTexto(centesimos: number): string {
  const v = (Math.max(0, centesimos) / 100).toFixed(2);
  const [intPart, decPart] = v.split('.');
  const intFormatado = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatado},${decPart}`;
}

function metrosParaCentesimos(valor: number | string | null | undefined): number {
  const n = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : (valor ?? 0);
  if (!isFinite(n) || isNaN(n)) return 0;
  return Math.round(n * 100);
}

interface MedidaInputProps {
  /** Valor atual em metros (ex: 1.5 para 1,50 m). */
  value: number | string | null | undefined;
  /** Disparado a cada dígito com o novo valor em metros (ex: 1.5). */
  onChange: (valorEmMetros: number) => void;
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

export function MedidaInput({
  value, onChange, onBlur, className, style, placeholder, autoFocus, disabled, required, id, name,
}: MedidaInputProps) {
  const [centesimos, setCentesimos] = useState<number>(() => metrosParaCentesimos(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const ultimoValorEmitido = useRef<number>(metrosParaCentesimos(value));

  // Sincroniza quando o valor muda por fora (ex: carregar item para edição, trocar de aba, limpar formulário).
  useEffect(() => {
    const novo = metrosParaCentesimos(value);
    if (novo !== ultimoValorEmitido.current) {
      setCentesimos(novo);
      ultimoValorEmitido.current = novo;
    }
  }, [value]);

  function emitir(novoCentesimos: number) {
    const limitado = Math.min(novoCentesimos, LIMITE_CENTESIMOS);
    setCentesimos(limitado);
    ultimoValorEmitido.current = limitado;
    onChange(limitado / 100);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      emitir(centesimos * 10 + Number(e.key));
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      emitir(Math.floor(centesimos / 10));
      return;
    }
    // Navegação e atalhos continuam funcionando; qualquer outra tecla (letras, vírgula, ponto, símbolos)
    // é ignorada — quem controla o formato é o próprio componente, então vírgula/ponto digitados manualmente
    // nem fazem falta (o separador decimal já entra sozinho conforme os dígitos empurram as casas).
    const permitido = ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'];
    if (!permitido.includes(e.key)) {
      e.preventDefault();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    if (disabled) return;
    const texto = e.clipboardData.getData('text');
    // Aceita colar tanto "1,50" quanto "1.50" — qualquer separador some,
    // sobrando só os dígitos, que viram os centésimos (mesma lógica do digitar).
    const digitos = texto.replace(/\D/g, '');
    if (!digitos) return;
    emitir(parseInt(digitos, 10));
  }

  // O cursor sempre fica no fim — quem "edita" é o dígito que entra pela direita, não uma posição no meio do texto.
  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [centesimos]);

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      value={centesimosParaTexto(centesimos)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={e => { const len = e.target.value.length; e.target.setSelectionRange(len, len); }}
      onClick={e => { const len = e.currentTarget.value.length; e.currentTarget.setSelectionRange(len, len); }}
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
