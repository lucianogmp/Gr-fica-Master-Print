import { 
  Ticket, TrendingUp, TrendingDown, AlertTriangle
} from 'lucide-react';

import { moeda as fmtBRL, useOcultarValores, MASCARA } from '../../lib/privacidade';

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col";

export function DashboardIndicators({ data, className = '' }: { data: any; className?: string }) {
  const oculto = useOcultarValores();

  return (
    <div className={`${CARD_BASE} ${className} p-3`}>
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" /> Indicadores Financeiros
      </h3>
      <div className="grid grid-cols-2 gap-2 flex-1 auto-rows-fr">
        {[
          { label: 'Ticket Médio',       valor: fmtBRL(data?.ticketMedio), sub: `${data?.ticketQtd ?? 0} ${(data?.ticketQtd ?? 0) === 1 ? 'venda' : 'vendas'} no mês`, cor: 'var(--chart-blue)', icon: Ticket },
          { label: 'Margem de Lucro',    valor: `${(data?.margemContrib ?? 0).toFixed(1)}%`, sub: '', cor: 'var(--chart-emerald)', icon: TrendingUp },
          { label: 'Inadimplência',      valor: `${(data?.inadimplencia ?? 0).toFixed(1)}%`, sub: '', cor: 'var(--chart-red)', icon: AlertTriangle },
          { label: 'Crescimento Mensal', valor: fmtPct(data?.pctReceita ?? 0), sub: '', cor: data?.pctReceita && data.pctReceita >= 0 ? 'var(--chart-emerald)' : 'var(--chart-red)', icon: TrendingDown },
        ].map(ind => {
          const Icon = ind.icon;
          return (
          <div key={ind.label} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 min-w-0">
            <div className="flex items-center gap-1 mb-1 min-w-0">
              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: ind.cor }} />
              <span className="text-[9px] text-gray-500 font-bold uppercase truncate">{ind.label}</span>
            </div>
            <p className="text-sm font-black" style={{ color: ind.cor }}>{oculto && ind.label !== 'Ticket Médio' ? MASCARA : ind.valor}</p>
            {ind.sub && <p className="text-[9px] text-gray-600">{ind.sub}</p>}
          </div>
        ); })}
      </div>
    </div>
  );
}
