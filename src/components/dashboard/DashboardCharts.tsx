import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useContainerReady } from '../../hooks/useContainerReady';

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ChartData {
  chart6: any[];
  custoFixoTotal: number;
  despesaMes: number;
  margemContrib: number;
  pontoEq: number;
  receitaMes: number;
  lucroMes: number;
}

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl";

export function DashboardCharts({ data }: { data: ChartData | undefined }) {
  const { ref: chart1Ref, pronto: chart1Pronto } = useContainerReady<HTMLDivElement>();
  const { ref: chart2Ref, pronto: chart2Pronto } = useContainerReady<HTMLDivElement>();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
      {/* Gráfico 6 meses */}
      <div className={`${CARD_BASE} lg:col-span-2 p-3`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vendas x Despesas — Últimos 6 Meses</h3>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Vendas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Despesa</span>
          </div>
        </div>
        <div className="h-36" ref={chart1Ref}>
          {chart1Pronto && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.chart6 ?? []} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#4b5563" fontSize={10} tickLine={false} />
              <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => fmtBRL(v)} />
              <Bar dataKey="vendas" fill="#10b981" radius={[3,3,0,0]} maxBarSize={28} />
              <Bar dataKey="despesa" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Ponto de Equilíbrio */}
      <div className={`${CARD_BASE} lg:col-span-2 p-3`}>
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Ponto de Equilíbrio</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
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
          {/* Mini gráfico PE */}
          <div className="h-24" ref={chart2Ref}>
            {chart2Pronto && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.chart6?.map((c, i) => ({ x: i, receita: c.receita, custo: (data?.custoFixoTotal ?? 0) })) ?? []}>
                <Line type="monotone" dataKey="receita" stroke="#10b981" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="custo"   stroke="#ef4444" dot={false} strokeWidth={1} strokeDasharray="3 3" />
                <XAxis dataKey="x" hide />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 10 }}
                  formatter={(v: any) => fmtBRL(v)} />
              </LineChart>
            </ResponsiveContainer>
            )}
            <p className="text-[9px] text-gray-600 text-center mt-1">Receita Total ● Custo Total — Custo Fixo</p>
          </div>
        </div>
      </div>

      {/* DRE */}
      <div className={`${CARD_BASE} lg:col-span-1 p-3`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">DRE — Demonstrativo de Resultado</h3>
        </div>
        <div className="space-y-1.5">
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
