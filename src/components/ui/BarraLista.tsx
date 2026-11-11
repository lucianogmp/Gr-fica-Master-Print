// src/components/ui/BarraLista.tsx
//
// Linha padrão de toda lista do sistema: busca + "Ordenar" + "Filtros" (janela completa).
// É a mesma de Vendas, Lançamentos e Orçamentos.

import { ReactNode } from 'react';
import { OrdenarMenu, CampoOrdenacao, Ordenacao } from './OrdenarMenu';
import { FiltroModal, CampoFiltro, FiltroValor } from './FiltroModal';

interface Props {
  busca: string;
  onBusca: (v: string) => void;
  placeholder: string;
  camposOrdem?: CampoOrdenacao[];
  ordenacao?: Ordenacao | null;
  onOrdenar?: (o: Ordenacao | null) => void;
  camposFiltro?: CampoFiltro[];
  filtros?: FiltroValor;
  onFiltros?: (v: FiltroValor) => void;
  titulo?: string;
  /** Botões/seletores extras à direita (ex.: abas de status) */
  extra?: ReactNode;
}

export function BarraLista({ busca, onBusca, placeholder, camposOrdem, ordenacao = null, onOrdenar, camposFiltro, filtros = {}, onFiltros, titulo, extra }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        value={busca}
        onChange={e => onBusca(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-48 bg-[#111827] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
      />
      {extra}
      {camposOrdem && onOrdenar && <OrdenarMenu campos={camposOrdem} valor={ordenacao} onChange={onOrdenar} />}
      {camposFiltro && onFiltros && <FiltroModal campos={camposFiltro} valor={filtros} onChange={onFiltros} titulo={titulo} />}
    </div>
  );
}
