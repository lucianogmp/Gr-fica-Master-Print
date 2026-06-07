import { DollarSign, ShoppingCart, TrendingUp, Landmark, type LucideIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface KpiData {
  receitaMes: number;
  pctReceita: number;
  sparkReceita: { v: number }[];
  despesaMes: number;
  pctDespesa: number;
  sparkDespesa: { v: number }[];
  lucroMes: number;
  pctLucro: number;
  sparkLucro: { v: number }[];
  fluxoMes: number;
}

function KpiCard({ title, value, pct, icon: Icon, cor, spark, invertPct = false, hideVar = false }: {
  title: string; value: number; pct: number; icon: LucideIcon;
  cor: string; spark: { v: number }[]; invertPct?: boolean; hideVar?: boolean;
}) {
  const isPos = invertPct ? pct <= 0 : pct >= 0;
  return (
    <div className="bg-[#1a2332] border border-gray-700/60 rounded-xl p-4 relative overflow-hidden">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-xl font-black text-white">{fmtBRL(value)}</p>
          {!hideVar && (
            <p className={`text-[10px] font-bold mt-0.5 flex items-center gap-0.5 ${isPos ? 'text-green-400' : 'text-red-400'}`}>
              {isPos ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(pct).toFixed(1)}% vs mês anterior
            </p>
          )}
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: cor + '20' }}>
          <Icon className="w-4 h-4" style={{ color: cor }} />
        </div>
      </div>
      <div className="h-10 -mx-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={spark}>
            <Line type="monotone" dataKey="v" stroke={cor} dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardKpis({ data }: { data: KpiData | undefined }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard title="RECEITA TOTAL"   value={data?.receitaMes ?? 0}  pct={data?.pctReceita ?? 0}  icon={DollarSign}   cor="#10b981" spark={data?.sparkReceita ?? []} />
      <KpiCard title="DESPESAS TOTAIS" value={data?.despesaMes ?? 0}  pct={data?.pctDespesa ?? 0}  icon={ShoppingCart} cor="#ef4444" spark={data?.sparkDespesa ?? []} invertPct />
      <KpiCard title="LUCRO LÍQUIDO"   value={data?.lucroMes ?? 0}    pct={data?.pctLucro ?? 0}    icon={TrendingUp}   cor="#10b981" spark={data?.sparkLucro ?? []} />
      <KpiCard title="FLUXO DE CAIXA"  value={data?.fluxoMes ?? 0}    pct={0}                      icon={Landmark}     cor="#a855f7" spark={data?.sparkReceita ?? []} hideVar />
    </div>
  );
}
