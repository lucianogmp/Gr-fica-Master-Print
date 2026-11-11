import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// Título de coluna que vira filtro: botão com setinha que abre a lista de opções
// (mesmo painel opaco dos outros seletores). Fica destacado quando há filtro ativo.
export function CabecalhoFiltro({ label, valor, opcoes, onChange, align = 'left' }: {
  label: string; valor: string; opcoes: { value: string; label: string }[];
  onChange: (v: string) => void; align?: 'left' | 'center';
}) {
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listaRef.current?.contains(t)) setAberto(false);
    };
    const reposicionar = (e?: Event) => {
      if (e && listaRef.current && e.target instanceof Node && listaRef.current.contains(e.target)) return;
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    };
    document.addEventListener('mousedown', fora);
    window.addEventListener('scroll', reposicionar, true);
    window.addEventListener('resize', reposicionar);
    return () => {
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('scroll', reposicionar, true);
      window.removeEventListener('resize', reposicionar);
    };
  }, [aberto]);
  const ativo = !!valor;
  const atual = opcoes.find(o => o.value === valor);
  return (
    <>
      <button ref={btnRef} type="button"
        onClick={() => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()); setAberto(a => !a); }}
        title={ativo ? `Filtrando: ${atual?.label}` : `Filtrar por ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 uppercase font-bold transition-colors ${ativo ? 'text-blue-400' : 'text-gray-400 hover:text-white'} ${align === 'center' ? 'mx-auto' : ''}`}>
        {label}
        {ativo && <span className="normal-case font-semibold text-[10px] bg-blue-500/20 border border-blue-500/30 rounded px-1 max-w-[90px] truncate">{atual?.label}</span>}
        <ChevronDown className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && rect && createPortal(
        <div ref={listaRef} className="floating-panel"
          style={{ position: 'fixed', top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)), width: 'max-content', minWidth: 170, maxWidth: 260, maxHeight: 280, overflowY: 'auto', zIndex: 99999, padding: 4 }}>
          {[{ value: '', label: 'Todas' }, ...opcoes].map(o => (
            <button key={o.value || 'todas'} type="button"
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setAberto(false); }}
              className={`w-full flex items-center justify-between gap-3 text-left px-2.5 py-1.5 rounded-md text-xs normal-case font-semibold whitespace-nowrap transition-colors ${
                o.value === valor ? 'bg-blue-600/25 text-blue-300' : 'text-gray-200 hover:bg-white/10'}`}>
              {o.label}
              {o.value === valor && <span className="text-blue-400">✓</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

