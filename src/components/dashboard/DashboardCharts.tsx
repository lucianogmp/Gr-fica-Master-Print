import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useContainerReady } from '../../hooks/useContainerReady';

import { moeda as fmtBRL, useOcultarValores } from '../../lib/privacidade';

interface ChartData {
  chart6: any[];
  custoFixoTotal: number;
  despesaMes: number;
  margemContrib: number;
  pontoEq: number;
  receitaMes: number;
  lucroMes: number;
}

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl self-stretch flex flex-col";

// Rosca de progresso: receita do mês ÷ ponto de equilíbrio.
//  • até 100%: anel azul que vai enchendo;
//  • passou de 100%: anel cheio verde e o número continua crescendo (130%, 250%...).
function RoscaEquilibrio({ receita, meta }: { receita: number; meta: number }) {
  useOcultarValores();
  const pct = meta > 0 ? (receita / meta) * 100 : 0;
  const bateu = meta > 0 && pct > 100;
  const cor = bateu ? '#10b981' : '#3b82f6';
  const R = 44, C = 2 * Math.PI * R;
  const preenchido = Math.min(Math.max(pct, 0), 100) / 100 * C;
  const diff = receita - meta;
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="16" />
          <circle cx="60" cy="60" r={R} fill="none" stroke={cor} strokeWidth="16"
            strokeDasharray={`${preenchido} ${C}`}
            style={{ transition: 'stroke-dasharray 700ms ease, stroke 300ms ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black leading-none" style={{ color: cor }}>
            {pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </span>
          <span className="text-[9px] text-gray-500 uppercase mt-1">da meta</span>
        </div>
      </div>
      <p className={`text-[10px] mt-1.5 font-bold text-center ${bateu ? 'text-green-400' : 'text-gray-500'}`}>
        {meta <= 0 ? 'Sem custos fixos cadastrados'
          : pct >= 100 && diff < 0.005 ? 'Meta batida!'
          : bateu ? `Meta batida — ${fmtBRL(diff)} acima`
          : `Faltam ${fmtBRL(-diff)} para a meta`}
      </p>
    </div>
  );
}


export function DashboardCharts({ data }: { data: ChartData | undefined }) {
  const oculto = useOcultarValores();
  const { ref: chart1Ref, pronto: chart1Pronto } = useContainerReady<HTMLDivElement>();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      {/* Gráfico 6 meses */}
      <div className={`${CARD_BASE} lg:col-span-5 p-3`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vendas x Despesas — Últimos 6 Meses</h3>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Vendas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Despesa</span>
          </div>
        </div>
        <div className="relative flex-1 min-h-[10rem]" ref={chart1Ref}>
          {chart1Pronto && (
          <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.chart6 ?? []} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#4b5563" fontSize={10} tickLine={false} />
              <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false}
                tickFormatter={v => oculto ? '' : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => fmtBRL(v)} />
              <Bar dataKey="vendas" fill="#10b981" radius={[3,3,0,0]} maxBarSize={28} />
              <Bar dataKey="despesa" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
          </div>
          )}
        </div>
      </div>

      {/* Ponto de Equilíbrio */}
      <div className={`${CARD_BASE} lg:col-span-4 p-3`}>
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Ponto de Equilíbrio</h3>
        <div className="grid grid-cols-2 gap-3 flex-1 items-stretch">
          <div className="flex flex-col justify-between gap-2">
            {[
              { label: 'Receita Necessária (mês)', value: fmtBRL(data?.custoFixoTotal) },
              { label: 'Custo Fixo Total',          value: fmtBRL(data?.custoFixoTotal) },
              { label: 'Custo Variável Total',       value: fmtBRL(data?.despesaMes) },
              { label: 'Margem de Contribuição',     value: `${(data?.margemContrib ?? 0).toFixed(1)}%`, cor: 'text-green-400' },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center text-xs border-b border-gray-800 pb-1.5 last:border-0">
                <span className="text-gray-500">{r.label}</span>
                <span className={`font-bold ${r.cor ?? 'text-white'}`}>{r.value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs font-bold text-gray-400">Ponto de Equilíbrio</span>
              <span className="text-sm font-black text-white">{fmtBRL(data?.pontoEq)}</span>
            </div>
          </div>
          <RoscaEquilibrio receita={data?.receitaMes ?? 0} meta={data?.pontoEq ?? 0} />
        </div>
      </div>

      {/* DRE */}
      <div className={`${CARD_BASE} lg:col-span-3 p-3`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">DRE — Demonstrativo de Resultado</h3>
        </div>
        <div className="flex flex-1 flex-col justify-between gap-1.5">
          {[
            { label: 'Receita Bruta',       valor: data?.receitaMes ?? 0,  cor: 'text-green-400' },
            { label: '(-) Impostos',         valor: 0,                      cor: 'text-red-400' },
            { label: '(-) Custos Variáveis', valor: 0,                      cor: 'text-red-400' },
            { label: '(-) Despesas Fixas',   valor: data?.despesaMes ?? 0,  cor: 'text-red-400' },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-xs border-b border-gray-800 pb-1.5">
              <span className="text-gray-400">{r.label}</span>
              <span className={`font-bold ${r.cor}`}>{fmtBRL(r.valor)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-1">
            <span className="text-xs font-bold text-white">Lucro Operacional</span>
            <span className={`text-sm font-black ${(data?.lucroMes ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtBRL(data?.lucroMes)}</span>
          </div>
          <div className="flex justify-between text-xs border-t border-gray-700 pt-2">
            <span className="font-bold text-white">Lucro Líquido</span>
            <span className={`font-black ${(data?.lucroMes ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtBRL(data?.lucroMes)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Margem Líquida</span>
            <span className={`font-bold ${(data?.margemContrib ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(data?.margemContrib ?? 0).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
