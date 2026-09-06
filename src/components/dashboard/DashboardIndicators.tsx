import { useNavigate } from 'react-router-dom';
import { 
  Ticket, TrendingUp, TrendingDown, AlertTriangle, ShoppingCart, Factory
} from 'lucide-react';

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col";

export function DashboardIndicators({ data, className = '' }: { data: any; className?: string }) {
  const navigate = useNavigate();

  return (
    <div className={`${CARD_BASE} ${className} p-3`}>
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" /> Indicadores Financeiros
      </h3>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
        {[
          { label: 'Ticket Médio',       valor: fmtBRL(data?.ticketMedio), sub: `${(data?.top5Clientes?.length ?? 0)} clientes`, cor: '#3b82f6', icon: Ticket },
          { label: 'Margem de Lucro',    valor: `${(data?.margemContrib ?? 0).toFixed(1)}%`, sub: '', cor: '#10b981', icon: TrendingUp },
          { label: 'Inadimplência',      valor: `${(data?.inadimplencia ?? 0).toFixed(1)}%`, sub: '', cor: '#ef4444', icon: AlertTriangle },
          { label: 'Crescimento Mensal', valor: fmtPct(data?.pctReceita ?? 0), sub: '', cor: data?.pctReceita && data.pctReceita >= 0 ? '#10b981' : '#ef4444', icon: TrendingDown },
        ].map(ind => {
          const Icon = ind.icon;
          return (
          <div key={ind.label} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 min-w-0">
            <div className="flex items-center gap-1 mb-1 min-w-0">
              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: ind.cor }} />
              <span className="text-[9px] text-gray-500 font-bold uppercase truncate">{ind.label}</span>
            </div>
            <p className="text-sm font-black" style={{ color: ind.cor }}>{ind.valor}</p>
            {ind.sub && <p className="text-[9px] text-gray-600">{ind.sub}</p>}
          </div>
        ); })}
        <button onClick={() => navigate('/financeiro')}
          className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 text-left hover:bg-gray-700/30 transition-all min-w-0">
          <div className="flex items-center gap-1 mb-1 min-w-0"><ShoppingCart className="w-3 h-3 text-gray-400 flex-shrink-0" /><span className="text-[9px] text-gray-500 font-bold uppercase truncate">Pedidos em Aberto</span></div>
          <p className="text-sm font-black text-white">{data?.situacao?.pendente ?? 0}</p>
          <p className="text-[9px] text-blue-400">Ver pedidos</p>
        </button>
        <button onClick={() => navigate('/producao')}
          className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 text-left hover:bg-gray-700/30 transition-all min-w-0">
          <div className="flex items-center gap-1 mb-1 min-w-0"><Factory className="w-3 h-3 text-gray-400 flex-shrink-0" /><span className="text-[9px] text-gray-500 font-bold uppercase truncate">Prod. em Andamento</span></div>
          <p className="text-sm font-black text-white">{data?.prodEmAnd ?? 0}</p>
          <p className="text-[9px] text-blue-400">Acompanhar</p>
        </button>
      </div>
    </div>
  );
}
