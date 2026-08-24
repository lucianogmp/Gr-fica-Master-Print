import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface DarkSelectOption {
  value: string;
  label: string;
}

export interface DarkSelectGroup {
  label: string;
  options: DarkSelectOption[];
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options?: readonly string[] | DarkSelectOption[];
  groups?: DarkSelectGroup[];
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: 'sm' | 'md';
  showChevron?: boolean;
  disabled?: boolean;
  /** Digitar livre pra filtrar as opções em vez de só abrir a lista fixa —
   * útil quando tem muitas opções (ex: Categoria) e a pessoa quer só
   * digitar parte do nome em vez de rolar a lista procurando. */
  searchable?: boolean;
}

const TRIGGER_MD =
  'w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors text-left flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const TRIGGER_SM =
  'w-full bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors text-left flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const DROPDOWN_BASE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  backgroundColor: '#0f1824',
  border: '1px solid #374151',
  borderRadius: 12,
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
  overflow: 'hidden',
  maxHeight: 280,
  overflowY: 'auto',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
};

const ITEM: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  cursor: 'pointer',
  textAlign: 'left',
  border: 'none',
  // backgroundColor de propósito NÃO fica aqui — precisa ficar livre pra
  // classe hover:bg-[...] funcionar (estilo inline sempre vence classe CSS
  // normal, então backgroundColor fixo aqui travava o hover em qualquer
  // botão que usasse ...ITEM, mesmo os sem seleção).
};

const GROUP_LABEL: React.CSSProperties = {
  padding: '8px 16px 4px',
  color: '#6b7280',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

function normalizeOptions(options: readonly string[] | DarkSelectOption[]): DarkSelectOption[] {
  return options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
}

function OptionButton({
  option,
  selected,
  isLast,
  onSelect,
  ativoPorTeclado,
  onHover,
}: {
  option: DarkSelectOption;
  selected: boolean;
  isLast: boolean;
  onSelect: (value: string) => void;
  ativoPorTeclado?: boolean;
  onHover?: () => void;
}) {
  const destacado = selected || ativoPorTeclado;
  return (
    <button
      type="button"
      onMouseDown={e => {
        e.preventDefault();
        onSelect(option.value);
      }}
      onMouseEnter={onHover}
      style={{
        ...ITEM,
        borderBottom: isLast ? 'none' : '1px solid #1f2937',
        // Só fixa a cor via inline quando SELECIONADO/ATIVO — senão o estilo
        // inline (sempre presente) vence a classe hover:bg-[...] do
        // Tailwind, e o hover nunca aparece visualmente ao passar o mouse.
        ...(destacado ? { backgroundColor: '#1a2535' } : {}),
      }}
      className={`transition-colors duration-150 ${destacado ? '' : 'bg-transparent hover:bg-[#1a2535]'}`}
    >
      <span
        style={{
          color: '#ffffff',
          fontSize: 14,
          fontWeight: selected ? 600 : 400,
        }}
      >
        {option.label}
      </span>
    </button>
  );
}

export function DarkSelect({
  value,
  onChange,
  options,
  groups,
  placeholder = 'Selecione...',
  allowEmpty = true,
  className,
  triggerClassName,
  size = 'md',
  showChevron = true,
  disabled = false,
  searchable = false,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  // Só usados no modo searchable: texto digitado e item destacado por teclado.
  const [busca, setBusca] = useState('');
  const [indiceAtivo, setIndiceAtivo] = useState(0);

  function recalcularPosicao() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  const flatOptions = useMemo(() => {
    if (groups?.length) return groups.flatMap(g => g.options);
    return normalizeOptions(options ?? []);
  }, [groups, options]);

  // No modo searchable, filtra pelas opções que contém o texto digitado em
  // qualquer parte do nome (não só no começo) — igual já fizemos nos outros
  // campos de busca do sistema (Catálogo, BOM, Vendedor).
  const opcoesExibidas = searchable && busca
    ? flatOptions.filter(o => o.label.toLowerCase().includes(busca.toLowerCase()))
    : flatOptions;

  const label = flatOptions.find(o => o.value === value)?.label ?? placeholder;
  const defaultTrigger = size === 'sm' ? TRIGGER_SM : TRIGGER_MD;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const alvo = e.target as Node;
      const dentroDoTrigger  = wrapRef.current?.contains(alvo);
      const dentroDoDropdown = dropdownRef.current?.contains(alvo);
      if (!dentroDoTrigger && !dentroDoDropdown) setAberto(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Recalcula a posição toda vez que abre (o campo pode ter se movido desde a
  // última vez, ex: modal rolou) e mantém atualizada durante scroll/resize —
  // o menu vive num portal fora do container com scroll, então precisa
  // recalcular manualmente em vez de simplesmente flutuar "logo abaixo".
  useEffect(() => {
    if (!aberto) return;
    recalcularPosicao();
    window.addEventListener('scroll', recalcularPosicao, true);
    window.addEventListener('resize', recalcularPosicao);
    return () => {
      window.removeEventListener('scroll', recalcularPosicao, true);
      window.removeEventListener('resize', recalcularPosicao);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  function selecionar(next: string) {
    onChange(next);
    setAberto(false);
    setBusca('');
  }

  function abrirBusca() {
    if (disabled) return;
    setBusca('');
    setIndiceAtivo(0);
    setAberto(true);
  }

  function handleBuscaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!aberto) return;
    const total = opcoesExibidas.length + (allowEmpty ? 1 : 0);
    if (total === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceAtivo(i => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceAtivo(i => (i - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allowEmpty && indiceAtivo === 0) { selecionar(''); return; }
      const opcao = opcoesExibidas[allowEmpty ? indiceAtivo - 1 : indiceAtivo];
      if (opcao) selecionar(opcao.value);
    } else if (e.key === 'Escape') {
      setAberto(false);
      setBusca('');
    }
  }

  function renderOptions() {
    // Grupos não combinam com busca por enquanto (uso raro) — mantém como já era.
    if (groups?.length) {
      return groups.map((group, gi) => (
        <div key={group.label}>
          <div style={GROUP_LABEL}>{group.label}</div>
          {group.options.map((o, idx) => (
            <OptionButton
              key={o.value}
              option={o}
              selected={value === o.value}
              isLast={gi === groups.length - 1 && idx === group.options.length - 1}
              onSelect={selecionar}
            />
          ))}
        </div>
      ));
    }

    const lista = searchable ? opcoesExibidas : flatOptions;
    const offset = allowEmpty ? 1 : 0;

    if (searchable && lista.length === 0) {
      return <p className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>Nenhuma opção encontrada.</p>;
    }

    return lista.map((o, idx) => (
      <OptionButton
        key={o.value}
        option={o}
        selected={value === o.value}
        ativoPorTeclado={searchable && idx + offset === indiceAtivo}
        isLast={idx === lista.length - 1}
        onSelect={selecionar}
        onHover={searchable ? () => setIndiceAtivo(idx + offset) : undefined}
      />
    ));
  }

  return (
    <div ref={wrapRef} className={className ? `relative ${className}` : 'relative'}>
      <div ref={triggerRef} className="relative">
        {searchable ? (
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={aberto ? busca : label}
            onFocus={e => { abrirBusca(); e.target.select(); }}
            onChange={e => { setBusca(e.target.value); setIndiceAtivo(0); if (!aberto) setAberto(true); }}
            onKeyDown={handleBuscaKeyDown}
            className={(triggerClassName ?? defaultTrigger) + ' pr-8'}
            placeholder={placeholder}
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setAberto(a => !a)}
            className={triggerClassName ?? defaultTrigger}
          >
            <span className={value ? 'text-white' : 'text-gray-400'}>{label}</span>
            {showChevron && (
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
              />
            )}
          </button>
        )}
        {searchable && showChevron && (
          <ChevronDown
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 flex-shrink-0 pointer-events-none transition-transform ${aberto ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {aberto && !disabled && coords && createPortal(
        <div ref={dropdownRef} style={{ ...DROPDOWN_BASE, top: coords.top, left: coords.left, width: coords.width }}>
          {allowEmpty && (
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                selecionar('');
              }}
              onMouseEnter={() => searchable && setIndiceAtivo(0)}
              style={{
                ...ITEM,
                borderBottom: '1px solid #1f2937',
                ...(searchable && indiceAtivo === 0 ? { backgroundColor: '#1a2535' } : {}),
              }}
              className={`transition-colors duration-150 ${searchable && indiceAtivo === 0 ? '' : 'bg-transparent hover:bg-[#1a2535]'}`}
            >
              <span style={{ color: '#9ca3af', fontSize: 14 }}>{placeholder}</span>
            </button>
          )}
          {renderOptions()}
        </div>,
        document.body
      )}
    </div>
  );
}
