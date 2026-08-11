import { useState, useRef, useEffect, useMemo } from 'react';
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
}

const TRIGGER_MD =
  'w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors text-left flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const TRIGGER_SM =
  'w-full bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors text-left flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const DROPDOWN: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 4,
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
  backgroundColor: 'transparent',
  border: 'none',
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
}: {
  option: DarkSelectOption;
  selected: boolean;
  isLast: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => {
        e.preventDefault();
        onSelect(option.value);
      }}
      style={{
        ...ITEM,
        borderBottom: isLast ? 'none' : '1px solid #1f2937',
        backgroundColor: selected ? '#1a2535' : 'transparent',
      }}
      className="hover:bg-[#1a2535] transition-colors"
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
}: Props) {
  const [aberto, setAberto] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const flatOptions = useMemo(() => {
    if (groups?.length) return groups.flatMap(g => g.options);
    return normalizeOptions(options ?? []);
  }, [groups, options]);

  const label = flatOptions.find(o => o.value === value)?.label ?? placeholder;
  const defaultTrigger = size === 'sm' ? TRIGGER_SM : TRIGGER_MD;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selecionar(next: string) {
    onChange(next);
    setAberto(false);
  }

  function renderOptions() {
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

    return flatOptions.map((o, idx) => (
      <OptionButton
        key={o.value}
        option={o}
        selected={value === o.value}
        isLast={idx === flatOptions.length - 1}
        onSelect={selecionar}
      />
    ));
  }

  return (
    <div ref={wrapRef} className={className ? `relative ${className}` : 'relative'}>
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

      {aberto && !disabled && (
        <div style={DROPDOWN}>
          {allowEmpty && (
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                selecionar('');
              }}
              style={{ ...ITEM, borderBottom: '1px solid #1f2937' }}
              className="hover:bg-[#1a2535] transition-colors"
            >
              <span style={{ color: '#9ca3af', fontSize: 14 }}>{placeholder}</span>
            </button>
          )}
          {renderOptions()}
        </div>
      )}
    </div>
  );
}
