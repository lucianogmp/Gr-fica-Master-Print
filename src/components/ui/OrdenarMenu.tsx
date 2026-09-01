// src/components/ui/OrdenarMenu.tsx
//
// Botão "Ordenar" padrão pra toda lista do sistema — abre um menu com os
// campos ordenáveis daquela tela, cada um com A→Z/1→9 (crescente) e
// Z→A/9→1 (decrescente). Mesmo componente em todo lugar, só muda a lista
// de campos que cada tela passa.

import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react';

export interface CampoOrdenacao {
  key: string;
  label: string;
  /** Ícone/rótulo do sentido "crescente" pra esse campo — data mais antiga
   *  primeiro, menor valor primeiro, A→Z. Se omitido, usa "Crescente". */
  labelAsc?: string;
  /** Idem pro sentido "decrescente" — mais recente primeiro, maior valor
   *  primeiro, Z→A. Se omitido, usa "Decrescente". */
  labelDesc?: string;
}

export interface Ordenacao {
  campo: string;
  direcao: 'asc' | 'desc';
}

interface Props {
  campos: CampoOrdenacao[];
  valor: Ordenacao | null;
  onChange: (v: Ordenacao | null) => void;
}

export function OrdenarMenu({ campos, valor, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onClickFora);
    return () => document.removeEventListener('mousedown', onClickFora);
  }, []);

  const campoAtual = campos.find(c => c.key === valor?.campo);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto(a => !a)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
          valor ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40' : 'bg-gray-700/60 text-gray-300 border border-gray-700 hover:bg-gray-700'
        }`}
      >
        {valor?.direcao === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : valor?.direcao === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5" />}
        {campoAtual ? campoAtual.label : 'Ordenar'}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-1.5 w-56 bg-[#1f2937] border border-gray-700 rounded-xl shadow-2xl z-30 py-1.5 overflow-hidden">
          {valor && (
            <button
              onClick={() => { onChange(null); setAberto(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:text-white hover:bg-gray-800/60 transition-colors"
            >
              Limpar ordenação
            </button>
          )}
          {campos.map(c => (
            <div key={c.key} className="px-1.5">
              <p className="px-2 pt-2 pb-1 text-[10px] font-bold text-gray-500 uppercase">{c.label}</p>
              <button
                onClick={() => { onChange({ campo: c.key, direcao: 'asc' }); setAberto(false); }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-gray-800/80 transition-colors"
              >
                <span className="flex items-center gap-1.5"><ArrowUp className="w-3 h-3" /> {c.labelAsc ?? 'Crescente'}</span>
                {valor?.campo === c.key && valor.direcao === 'asc' && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </button>
              <button
                onClick={() => { onChange({ campo: c.key, direcao: 'desc' }); setAberto(false); }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-gray-800/80 transition-colors"
              >
                <span className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3" /> {c.labelDesc ?? 'Decrescente'}</span>
                {valor?.campo === c.key && valor.direcao === 'desc' && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Aplica uma Ordenacao numa lista. `getters` mapeia cada `key` de campo pra
 * uma função que extrai o valor comparável (string, number ou data ISO)
 * daquele item — assim o componente não precisa saber a forma dos dados de
 * cada tela.
 */
export function aplicarOrdenacao<T>(
  itens: T[],
  ordenacao: Ordenacao | null,
  getters: Record<string, (item: T) => string | number | null | undefined>,
): T[] {
  if (!ordenacao) return itens;
  const getter = getters[ordenacao.campo];
  if (!getter) return itens;

  const copia = [...itens];
  copia.sort((a, b) => {
    const va = getter(a);
    const vb = getter(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    let cmp: number;
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb), 'pt-BR');
    return ordenacao.direcao === 'asc' ? cmp : -cmp;
  });
  return copia;
}
