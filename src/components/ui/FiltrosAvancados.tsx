// src/components/ui/FiltrosAvancados.tsx
//
// Painel "Filtros" padrão pra toda lista do sistema — faixa de data e
// faixa de valor, os dois critérios mais úteis em qualquer lista
// financeira/operacional. O botão mostra quantos filtros estão ativos.

import { useState, useRef, useEffect } from 'react';
import { Filter, X } from 'lucide-react';
import { DateInput } from './DateInput';
import { MoneyInput } from './MoneyInput';

export interface FiltrosAvancadosValor {
  dataInicio?: string | null;
  dataFim?: string | null;
  valorMin?: number | null;
  valorMax?: number | null;
}

interface Props {
  valor: FiltrosAvancadosValor;
  onChange: (v: FiltrosAvancadosValor) => void;
  /** Esconde o bloco de data (ex: telas que já têm um filtro de mês
   *  próprio e não precisam de outro filtro de data duplicado). */
  mostrarData?: boolean;
  /** Esconde o bloco de valor, pra telas sem um campo de valor claro. */
  mostrarValor?: boolean;
  labelData?: string;
  labelValor?: string;
}

const VAZIO: FiltrosAvancadosValor = { dataInicio: null, dataFim: null, valorMin: null, valorMax: null };

export function FiltrosAvancados({
  valor, onChange, mostrarData = true, mostrarValor = true,
  labelData = 'Período', labelValor = 'Valor',
}: Props) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onClickFora);
    return () => document.removeEventListener('mousedown', onClickFora);
  }, []);

  const qtdAtivos = Object.values(valor).filter(v => v !== null && v !== undefined && v !== '').length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto(a => !a)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
          qtdAtivos > 0 ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40' : 'bg-gray-700/60 text-gray-300 border border-gray-700 hover:bg-gray-700'
        }`}
      >
        <Filter className="w-3.5 h-3.5" /> Filtros
        {qtdAtivos > 0 && (
          <span className="bg-blue-500 text-white rounded-full text-[10px] font-black w-4 h-4 flex items-center justify-center">{qtdAtivos}</span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-1.5 w-72 bg-[#1f2937] border border-gray-700 rounded-xl shadow-2xl z-30 p-4 space-y-4">
          {mostrarData && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">{labelData}</p>
              <div className="flex items-center gap-2">
                <DateInput value={valor.dataInicio ?? ''} onChange={v => onChange({ ...valor, dataInicio: v || null })}
                  className="bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 w-full" />
                <span className="text-gray-600 text-xs flex-shrink-0">até</span>
                <DateInput value={valor.dataFim ?? ''} onChange={v => onChange({ ...valor, dataFim: v || null })}
                  className="bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 w-full" />
              </div>
            </div>
          )}
          {mostrarValor && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">{labelValor}</p>
              <div className="flex items-center gap-2">
                <MoneyInput value={valor.valorMin ?? 0} onChange={v => onChange({ ...valor, valorMin: v || null })}
                  className="bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 w-full" placeholder="Mín." />
                <span className="text-gray-600 text-xs flex-shrink-0">até</span>
                <MoneyInput value={valor.valorMax ?? 0} onChange={v => onChange({ ...valor, valorMax: v || null })}
                  className="bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 w-full" placeholder="Máx." />
              </div>
            </div>
          )}
          {qtdAtivos > 0 && (
            <button
              onClick={() => { onChange({ ...VAZIO }); }}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800 py-2 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Aplica um FiltrosAvancadosValor numa lista, dado como extrair data (ISO
 *  yyyy-mm-dd) e valor numérico de cada item. */
export function aplicarFiltrosAvancados<T>(
  itens: T[],
  filtros: FiltrosAvancadosValor,
  getData: ((item: T) => string | null | undefined) | null,
  getValor: ((item: T) => number | null | undefined) | null,
): T[] {
  return itens.filter(item => {
    if (getData) {
      const d = getData(item) ?? '';
      if (filtros.dataInicio && d < filtros.dataInicio) return false;
      if (filtros.dataFim && d > filtros.dataFim) return false;
    }
    if (getValor) {
      const v = Number(getValor(item) ?? 0);
      if (filtros.valorMin != null && v < filtros.valorMin) return false;
      if (filtros.valorMax != null && v > filtros.valorMax) return false;
    }
    return true;
  });
}
