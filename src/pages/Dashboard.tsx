import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDashboardData } from '../hooks/useDashboardData';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const fmtData = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const mesLabel = (mes: string) => {
  const [y, m] = mes.split('-');
  const nomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${nomes[parseInt(m) - 1]} de ${y}`;
};

const STATUS_COR: Record<string, string> = {
  pendente:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  atrasado:  'bg-red-500/20 text-red-400 border-red-500/30',
  pago:      'bg-green-500/20 text-green-400 border-green-500/30',
};

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const { data, isLoading } = useDashboardData(mes);

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="text-blue-500 animate-pulse font-bold text-lg mb-2">Carregando Dashboard...</div>
        <div className="text-gray-600 text-sm">Processando dados da empresa</div>
      </div>
    </div>
  );

  const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl";

  return (
    <div className="p-5 space-y-4 min-h-screen">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Olá, {user?.name?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 text-sm">Aqui está o resumo geral da sua empresa.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm">{mesLabel(mes)}</span>
          <button onClick={() => {
            const [y, m] = mes.split('-').map(Number);
            const d = new Date(y, m - 2, 1);
            setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          }} className="text-gray-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all">◀</button>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" />
          <button onClick={() => {
            const [y, m] = mes.split('-').map(Number);
            const d = new Date(y, m, 1);
            setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          }} className="text-gray-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all">▶</button>
        </div>
      </div>

      {/* ── ROW 1: 4 KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="RECEITA TOTAL"   value={data?.receitaMes ?? 0}  pct={data?.pctReceita ?? 0}  icon="💰" cor="#10b981" spark={data?.sparkReceita ?? []} />
        <KpiCard title="DESPESAS TOTAIS" value={data?.despesaMes ?? 0}  pct={data?.pctDespesa ?? 0}  icon="🛒" cor="#ef4444" spark={data?.sparkDespesa ?? []} invertPct />
        <KpiCard title="LUCRO LÍQUIDO"   value={data?.lucroMes ?? 0}    pct={data?.pctLucro ?? 0}    icon="📈" cor="#10b981" spark={data?.sparkLucro ?? []} />
        <KpiCard title="FLUXO DE CAIXA"  value={data?.fluxoMes ?? 0}    pct={0}                      icon="🏦" cor="#a855f7" spark={data?.sparkReceita ?? []} hideVar />
      </div>

      {/* ── ROW 2: GRÁFICO + PONTO EQ + DRE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* Gráfico 6 meses */}
        <div className={`${CARD_BASE} lg:col-span-2 p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vendas x Despesas — Últimos 6 Meses</h3>
            <div className="flex gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Receita</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Despesa</span>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.chart6 ?? []} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                <XAxis dataKey="name" stroke="#4b5563" fontSize={10} tickLine={false} />
                <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: any) => fmtBRL(v)} />
                <Bar dataKey="receita" fill="#10b981" radius={[3,3,0,0]} maxBarSize={28} />
                <Bar dataKey="despesa" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ponto de Equilíbrio */}
        <div className={`${CARD_BASE} lg:col-span-2 p-4`}>
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">Ponto de Equilíbrio</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              {[
                { label: 'Receita Necessária (mês)', value: fmtBRL(data?.custoFixoTotal) },
                { label: 'Custo Fixo Total',          value: fmtBRL(data?.custoFixoTotal) },
                { label: 'Custo Variável Total',       value: fmtBRL(data?.despesaMes) },
                { label: 'Margem de Contribuição',     value: `${(data?.margemContrib ?? 0).toFixed(1)}%`, cor: 'text-green-400' },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center text-xs border-b border-gray-800 pb-2 last:border-0">
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
            <div className="h-32">
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
              <p className="text-[9px] text-gray-600 text-center mt-1">Receita Total ● Custo Total — Custo Fixo</p>
            </div>
          </div>
        </div>

        {/* DRE */}
        <div className={`${CARD_BASE} lg:col-span-1 p-4`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">DRE — Demonstrativo de Resultado</h3>
            <span className="text-[9px] text-gray-600">{mesLabel(mes)}</span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Receita Bruta',       valor: data?.receitaMes ?? 0,  cor: 'text-green-400' },
              { label: '(-) Impostos',         valor: 0,                      cor: 'text-red-400' },
              { label: '(-) Custos Variáveis', valor: 0,                      cor: 'text-red-400' },
              { label: '(-) Despesas Fixas',   valor: data?.despesaMes ?? 0,  cor: 'text-red-400' },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-xs border-b border-gray-800 pb-2">
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

      {/* ── ROW 3: CONTAS + AVISOS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* Contas a Receber */}
        <div className={`${CARD_BASE} lg:col-span-2 p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Contas a Receber</h3>
            <button onClick={() => navigate('/financeiro')} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-colors">Ver todas →</button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600 uppercase text-[9px] border-b border-gray-800">
                <th className="pb-2 text-left font-bold">Cliente</th>
                <th className="pb-2 text-left font-bold">Vencimento</th>
                <th className="pb-2 text-right font-bold">Valor</th>
                <th className="pb-2 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.contasReceber ?? []).length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-gray-600">Nenhuma conta a receber</td></tr>
              )}
              {(data?.contasReceber ?? []).map((c: any) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-2 text-gray-300 max-w-24 truncate">{c.cliente_nome || c.descricao}</td>
                  <td className="py-2 text-gray-400">{fmtData(c.data_vencimento)}</td>
                  <td className="py-2 text-right font-bold text-green-400">{fmtBRL(c.valor)}</td>
                  <td className="py-2 text-center">
                    <StatusBadge status={c.status} venc={c.data_vencimento} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Contas a Pagar */}
        <div className={`${CARD_BASE} lg:col-span-2 p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Contas a Pagar</h3>
            <button onClick={() => navigate('/financeiro')} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-colors">Ver todas →</button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600 uppercase text-[9px] border-b border-gray-800">
                <th className="pb-2 text-left font-bold">Fornecedor</th>
                <th className="pb-2 text-left font-bold">Vencimento</th>
                <th className="pb-2 text-right font-bold">Valor</th>
                <th className="pb-2 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.contasPagar ?? []).length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-gray-600">Nenhuma conta a pagar</td></tr>
              )}
              {(data?.contasPagar ?? []).map((c: any) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-2 text-gray-300 max-w-24 truncate">{c.cliente_nome || c.descricao}</td>
                  <td className="py-2 text-gray-400">{fmtData(c.data_vencimento)}</td>
                  <td className="py-2 text-right font-bold text-red-400">{fmtBRL(c.valor)}</td>
                  <td className="py-2 text-center">
                    <StatusBadge status={c.status} venc={c.data_vencimento} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Avisos */}
        <div className={`${CARD_BASE} lg:col-span-1 p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avisos e Notificações</h3>
            {((data?.contasReceber?.length ?? 0) + (data?.contasPagar?.length ?? 0)) > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {(data?.contasReceber?.length ?? 0) + (data?.contasPagar?.length ?? 0)}
              </span>
            )}
          </div>
          {(data?.contasReceber?.length ?? 0) === 0 && (data?.contasPagar?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2">
              <div className="text-green-500 text-3xl">✓</div>
              <p className="text-xs text-gray-500 text-center">Tudo em dia! Sem avisos pendentes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.contasPagar ?? []).slice(0, 3).map((c: any) => (
                <div key={c.id} className="text-[10px] flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <span>💸</span>
                  <div>
                    <p className="font-bold text-red-300">{c.descricao}</p>
                    <p className="text-gray-500">{fmtData(c.data_vencimento)} · {fmtBRL(c.valor)}</p>
                  </div>
                </div>
              ))}
              {(data?.contasReceber ?? []).slice(0, 2).map((c: any) => (
                <div key={c.id} className="text-[10px] flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <span>💰</span>
                  <div>
                    <p className="font-bold text-green-300">{c.descricao}</p>
                    <p className="text-gray-500">{fmtData(c.data_vencimento)} · {fmtBRL(c.valor)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 4: SITUAÇÃO + TOP5 + INDICADORES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">

        {/* Vendas por Situação */}
        <div className={`${CARD_BASE} p-4`}>
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">Vendas por Situação</h3>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-black text-white">{data?.totalVendas ?? 0}</p>
              <p className="text-[9px] text-gray-600">Total</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {[
                { label: 'Pendente',    key: 'pendente',    cor: '#f59e0b' },
                { label: 'Em execução', key: 'em_execucao', cor: '#3b82f6' },
                { label: 'Pronto',      key: 'pronto',      cor: '#a855f7' },
                { label: 'Entregue',    key: 'entregue',    cor: '#10b981' },
                { label: 'Cancelado',   key: 'cancelado',   cor: '#ef4444' },
              ].map(s => {
                const val = (data?.situacao as any)?.[s.key] ?? 0;
                const tot = data?.totalVendas ?? 0;
                const pct = tot > 0 ? Math.round((val / tot) * 100) : 0;
                return (
                  <div key={s.key} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.cor }} />
                      <span className="text-gray-400">{s.label}</span>
                    </div>
                    <span className="font-bold text-white">{val} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top 5 Produtos */}
        <div className={`${CARD_BASE} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Top 5 Produtos</h3>
            <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">Este mês</span>
          </div>
          <div className="space-y-2">
            {(data?.top5Produtos ?? []).length === 0 && (
              <p className="text-xs text-gray-600 py-4 text-center">Sem dados de produtos</p>
            )}
            {(data?.top5Produtos ?? []).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-600 w-4">{i + 1}</span>
                  <span className="text-gray-300 truncate max-w-28">{p.nome || '—'}</span>
                </div>
                <span className="font-bold text-white">{fmtBRL(p.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Clientes */}
        <div className={`${CARD_BASE} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Top 5 Clientes</h3>
            <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">Este mês</span>
          </div>
          <div className="space-y-2">
            {(data?.top5Clientes ?? []).length === 0 && (
              <p className="text-xs text-gray-600 py-4 text-center">Sem dados de clientes</p>
            )}
            {(data?.top5Clientes ?? []).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-600 w-4">{i + 1}</span>
                  <span className="text-gray-300 truncate max-w-28">{c.nome}</span>
                </div>
                <span className="font-bold text-white">{fmtBRL(c.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Indicadores Financeiros */}
        <div className={`${CARD_BASE} p-4`}>
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>📊</span> Indicadores Financeiros
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Ticket Médio',       valor: fmtBRL(data?.ticketMedio), sub: `${(data?.top5Clientes?.length ?? 0)} clientes`, cor: '#3b82f6', icon: '🎫' },
              { label: 'Margem de Lucro',    valor: `${(data?.margemContrib ?? 0).toFixed(1)}%`, sub: '', cor: '#10b981', icon: '📈' },
              { label: 'Inadimplência',      valor: `${(data?.inadimplencia ?? 0).toFixed(1)}%`, sub: '', cor: '#ef4444', icon: '⚠️' },
              { label: 'Crescimento Mensal', valor: fmtPct(data?.pctReceita ?? 0), sub: '', cor: data?.pctReceita && data.pctReceita >= 0 ? '#10b981' : '#ef4444', icon: '📉' },
            ].map(ind => (
              <div key={ind.label} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs">{ind.icon}</span>
                  <span className="text-[9px] text-gray-500 font-bold uppercase">{ind.label}</span>
                </div>
                <p className="text-sm font-black" style={{ color: ind.cor }}>{ind.valor}</p>
                {ind.sub && <p className="text-[9px] text-gray-600">{ind.sub}</p>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={() => navigate('/financeiro')}
              className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 text-left hover:bg-gray-700/30 transition-all">
              <div className="flex items-center gap-1 mb-1"><span>🛒</span><span className="text-[9px] text-gray-500 font-bold uppercase">Pedidos em Aberto</span></div>
              <p className="text-sm font-black text-white">{data?.situacao.pendente ?? 0}</p>
              <p className="text-[9px] text-blue-400">Ver pedidos</p>
            </button>
            <button onClick={() => navigate('/producao')}
              className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 text-left hover:bg-gray-700/30 transition-all">
              <div className="flex items-center gap-1 mb-1"><span>⚙️</span><span className="text-[9px] text-gray-500 font-bold uppercase">Prod. em Andamento</span></div>
              <p className="text-sm font-black text-white">{data?.prodEmAnd ?? 0}</p>
              <p className="text-[9px] text-blue-400">Acompanhar</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ──

function KpiCard({ title, value, pct, icon, cor, spark, invertPct = false, hideVar = false }: {
  title: string; value: number; pct: number; icon: string;
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
            <p className={`text-[10px] font-bold mt-0.5 ${isPos ? 'text-green-400' : 'text-red-400'}`}>
              {isPos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% vs mês anterior
            </p>
          )}
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
          style={{ backgroundColor: cor + '20' }}>
          {icon}
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

function StatusBadge({ status, venc }: { status: string; venc?: string | null }) {
  const hoje = new Date().toISOString().split('T')[0];
  const real = status === 'pendente' && venc && venc < hoje ? 'atrasado' : status;
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_COR[real] ?? STATUS_COR.pendente}`}>
      {real}
    </span>
  );
}
