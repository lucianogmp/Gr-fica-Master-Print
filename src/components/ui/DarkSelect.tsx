import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { correspondeABusca } from '../../lib/buscaFlexivel';
import { useListaTeclado } from '../../hooks/useListaTeclado';

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

// Posição/estrutura ficam inline (valores dinâmicos calculados por
// recalcularPosicao). Cor, fundo e borda SEMPRE em classe CSS — nunca
// inline — porque o menu vive num portal (document.body) e as sobrescritas
// de tema claro só interceptam classes CSS, nunca `style` inline. Um
// dropdown colorido via style fica escuro pra sempre, mesmo com o resto
// do sistema em tema claro.
const DROPDOWN_BASE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  overflow: 'hidden',
  maxHeight: 280,
  overflowY: 'auto',
};

// `.floating-panel` (index.css) dá fundo 100% opaco que acompanha o tema —
// NUNCA reaproveitar bg-[#1a2332]/bg-[#1f2937] aqui: são as mesmas classes
// dos cards comuns, que têm glassmorphism translúcido (bonito num card
// sobre o fundo da página, ilegível num menu flutuando sobre uma tabela).
const DROPDOWN_CLASSNAME = 'floating-panel';

const ITEM: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  cursor: 'pointer',
  textAlign: 'left',
  border: 'none',
};

const GROUP_LABEL_CLASSNAME = 'text-gray-500';
const GROUP_LABEL: React.CSSProperties = {
  padding: '8px 16px 4px',
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
  navIdx,
}: {
  option: DarkSelectOption;
  selected: boolean;
  isLast: boolean;
  onSelect: (value: string) => void;
  ativoPorTeclado?: boolean;
  onHover?: () => void;
  navIdx?: number;
}) {
  const destacado = selected || ativoPorTeclado;
  return (
    <button
      type="button"
      data-nav={navIdx}
      onMouseDown={e => {
        e.preventDefault();
        onSelect(option.value);
      }}
      onMouseEnter={onHover}
      style={{ ...ITEM, borderBottom: isLast ? 'none' : undefined }}
      className={`transition-colors duration-150 ${isLast ? '' : 'border-b border-gray-700/50'} ${
        destacado ? 'bg-gray-700' : 'bg-transparent hover:bg-gray-700'
      }`}
    >
      <span
        className="text-white"
        style={{
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
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  // Só usado no modo searchable: texto digitado.
  const [busca, setBusca] = useState('');

  function recalcularPosicao() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 4;
    const margin = 12;
    const itemHeight = 45; // ~altura real de cada OptionButton (padding 12px + texto)
    const lista = searchable ? opcoesExibidas : flatOptions;
    const qtdItens = (allowEmpty ? 1 : 0) + (groups?.length
      ? groups.reduce((s, g) => s + g.options.length, 0)
      : lista.length);
    // Altura que o menu realmente precisa (não um valor fixo) — evita reservar
    // espaço de sobra e, com isso, abrir pra cima muito além do necessário
    // quando o campo está perto do fim da tela mas tem poucas opções.
    const alturaNecessaria = Math.max(itemHeight, qtdItens * itemHeight + 8);
    const preferredHeight = Math.min(280, alturaNecessaria);
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const openUp = below < preferredHeight && above > below;
    const maxHeight = Math.max(Math.min(itemHeight + 8, preferredHeight), Math.min(preferredHeight, openUp ? above - gap : below - gap));

    setCoords({
      top: openUp ? rect.top - gap - maxHeight : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }

  const flatOptions = useMemo(() => {
    if (groups?.length) return groups.flatMap(g => g.options);
    return normalizeOptions(options ?? []);
  }, [groups, options]);

  // No modo searchable, filtra pelas opções que contém o texto digitado em
  // qualquer parte do nome (não só no começo) — igual já fizemos nos outros
  // campos de busca do sistema (Catálogo, BOM, Vendedor).
  const opcoesExibidas = searchable && busca
    ? flatOptions.filter(o => correspondeABusca(o.label, busca))
    : flatOptions;

  // Lista navegável por teclado, na mesma ordem em que aparece na tela
  // (item "vazio" primeiro, se existir; depois as opções, inclusive as de grupos).
  const navValores = useMemo(
    () => [...(allowEmpty ? [''] : []), ...(searchable ? opcoesExibidas : flatOptions).map(o => o.value)],
    [allowEmpty, searchable, opcoesExibidas, flatOptions],
  );

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
    setAberto(true);
  }

  const abrirLista = () => { if (!disabled) { setBusca(''); setAberto(true); } };
  const fecharLista = () => { setAberto(false); setBusca(''); };

  const { indice, setIndice, onKeyDown: onKeyDownLista, listaRef } = useListaTeclado<string>({
    itens: navValores,
    aberto,
    abrir: abrirLista,
    fechar: fecharLista,
    onSelecionar: selecionar,
    chave: busca,
  });

  // Ao abrir, o destaque começa no item já selecionado (se houver).
  useEffect(() => {
    if (!aberto) return;
    const i = navValores.indexOf(value);
    setIndice(i >= 0 ? i : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Campo sem busca (botão): Espaço escolhe o item destacado e digitar uma letra
  // pula pra primeira opção que começa com ela (como num select nativo).
  function onKeyDownBotao(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' && aberto) {
      e.preventDefault();
      const v = navValores[indice];
      if (v !== undefined) selecionar(v);
      return;
    }
    if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const letra = e.key.toLowerCase();
      const rotulos = [...(allowEmpty ? [placeholder] : []), ...flatOptions.map(o => o.label)];
      const n = rotulos.length;
      for (let k = 1; k <= n; k++) {
        const j = (indice + k) % n;
        if (rotulos[j].toLowerCase().startsWith(letra)) {
          if (!aberto) abrirLista();
          setIndice(j);
          break;
        }
      }
      return;
    }
    onKeyDownLista(e);
  }

  function renderOptions() {
    // Grupos não combinam com busca por enquanto (uso raro) — mantém como já era.
    if (groups?.length) {
      return groups.map((group, gi) => (
        <div key={group.label}>
          <div style={GROUP_LABEL} className={GROUP_LABEL_CLASSNAME}>{group.label}</div>
          {group.options.map((o, idx) => (
            <OptionButton
              key={o.value}
              option={o}
              selected={value === o.value}
              isLast={gi === groups.length - 1 && idx === group.options.length - 1}
              onSelect={selecionar}
              navIdx={navValores.indexOf(o.value)}
              ativoPorTeclado={navValores.indexOf(o.value) === indice}
              onHover={() => setIndice(navValores.indexOf(o.value))}
            />
          ))}
        </div>
      ));
    }

    const lista = searchable ? opcoesExibidas : flatOptions;
    const offset = allowEmpty ? 1 : 0;

    if (searchable && lista.length === 0) {
      return <p className="px-4 py-3 text-xs text-gray-500">Nenhuma opção encontrada.</p>;
    }

    return lista.map((o, idx) => (
      <OptionButton
        key={o.value}
        option={o}
        selected={value === o.value}
        navIdx={idx + offset}
        ativoPorTeclado={idx + offset === indice}
        isLast={idx === lista.length - 1}
        onSelect={selecionar}
        onHover={() => setIndice(idx + offset)}
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
            onChange={e => { setBusca(e.target.value); if (!aberto) setAberto(true); }}
            onKeyDown={onKeyDownLista}
            className={(triggerClassName ?? defaultTrigger) + ' pr-8'}
            placeholder={placeholder}
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setAberto(a => !a)}
            onKeyDown={onKeyDownBotao}
            aria-haspopup="listbox"
            aria-expanded={aberto}
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
        <div
          ref={el => { (dropdownRef as any).current = el; listaRef.current = el; }}
          style={{ ...DROPDOWN_BASE, top: coords.top, left: coords.left, width: coords.width, maxHeight: coords.maxHeight }}
          className={DROPDOWN_CLASSNAME}
        >
          {allowEmpty && (
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                selecionar('');
              }}
              data-nav={0}
              onMouseEnter={() => setIndice(0)}
              style={ITEM}
              className={`transition-colors duration-150 border-b border-gray-700/50 ${
                indice === 0 ? 'bg-gray-700' : 'bg-transparent hover:bg-gray-700'
              }`}
            >
              <span className="text-gray-400" style={{ fontSize: 14 }}>{placeholder}</span>
            </button>
          )}
          {renderOptions()}
        </div>,
        document.body
      )}
    </div>
  );
}
