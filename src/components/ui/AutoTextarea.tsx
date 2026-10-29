// src/components/ui/AutoTextarea.tsx
// Caixa de texto que cresce e encolhe sozinha conforme o texto — sem barra de
// rolagem escondendo o conteúdo.
import { useLayoutEffect, useRef } from 'react';

export function AutoTextarea({
  value, onChange, className, placeholder, minRows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={`${className ?? ''} resize-none overflow-hidden`}
    />
  );
}
