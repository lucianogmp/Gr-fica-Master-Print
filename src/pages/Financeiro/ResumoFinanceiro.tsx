// src/pages/Financeiro/ResumoFinanceiro.tsx
import { useState, useMemo } from 'react';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useVendas } from '../../hooks/useVendas';
import { useCaixaMovimentos } from '../../hooks/useCaixaMovimentos';
import { useSaldoContas, TIPO_CONTA } from '../../hooks/useContasBancarias';
import { totaisDoMes } from '../../lib/financeiroMes';
import { STATUS_VENDA } from '../../types/venda';
import { KpiCard } from '../../components/ui/KpiCard';
import { MonthInput } from '../../components/ui/MonthInput';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  PieChart, ArrowUp, ArrowDown, ShoppingCart, Check, Clock, CreditCard,
  Building2, TrendingUp, ChevronLeft, ChevronRight, Scale, Info,
} from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.0', '')}k` : String(Math.round(v)));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function ResumoFinanceiro() {
  const { data: lancamentos = [], isLoading: loadLanc } = useLancamentos();
  const { data: vendas = [],      isLoading: loadVendas } = useVendas();
  const { data: movsCaixa = [] } = useCaixaMovimentos();
  const { saldos, totalGeral,     isLoading: loadContas } = useSaldoContas();

  const [mes, setMes] = useState(() => iso(new Date()).slice(0, 7));
  function deslocarMes(delta: number) {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMes(iso(d).slice(0, 7));
  }

  // Tudo abaixo do saldo segue o mês escolhido. Regras em src/lib/financeiroMes.ts.
  const t = totaisDoMes(lancamentos as any, movsCaixa as any, mes);

  const vendasMes = useMemo(
    () => vendas.filter(v => v.status !== 'cancelado' && (v.data_venda ?? v.created_at ?? '').startsWith(mes)),
    [vendas, mes],
  );
  const totalVendas   = vendasMes.reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0);
  const totalRecebido = vendasMes.reduce((s, v) => s + Number(v.valor_pago ?? 0), 0);
  const totalRest     = Math.max(0, totalVendas - totalRecebido);

  // Últimos 15 dias: terminam hoje (mês atual) ou no último dia do mês escolhido.
  const dias7 = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    const hoje = new Date();
    const fimMes = new Date(y, m, 0);
    const fim = iso(hoje).startsWith(mes) ? hoje : fimMes;
    return Array.from({ length: 15 }, (_, i) => {
      const d = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - (14 - i));
      return d;
    });
  }, [mes]);

  const grafico = useMemo(() => dias7.map(d => {
    const dia = iso(d);
    const x = totaisDoMes(lancamentos as any, movsCaixa as any, dia);
    const vd = vendas.filter(v => v.status !== 'cancelado' && (v.data_venda ?? v.created_at ?? '').startsWith(dia));
    return {
      nome: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      recebido: x.receitas, pago: x.despesas,
      vendas: vd.reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0),
      qtd: vd.length,
    };
  }), [dias7, lancamentos, movsCaixa, vendas]);

  const soma7 = (k: 'recebido' | 'pago' | 'vendas') => grafico.reduce((s, g) => s + g[k], 0);

  if (loadLanc || loadVendas || loadContas) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  const tooltipStyle = { background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <PieChart className="w-6 h-6 text-blue-400" /> Resumo Financeiro
          </h1>
          <p className="text-gray-500 text-xs">Saldo das contas é de agora (acumulado). O resto segue o mês escolhido.</p>
        </div>
        <div className="flex items-center gap-1 bg-[#1f2937] border border-gray-700 rounded-xl px-1.5 py-1.5">
          <button onClick={() => deslocarMes(-1)} title="Mês anterior" className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <MonthInput value={mes} onChange={v => v && setMes(v)}
            className="bg-transparent border-0 px-2 py-0.5 text-white text-sm font-bold capitalize min-w-[140px]" />
          <button onClick={() => deslocarMes(1)} title="Próximo mês" className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Onde está o dinheiro: total + uma linha compacta com cada conta ── */}
      <div className="bg-[#1f2937] border border-gray-700 border-t-2 border-t-blue-500 rounded-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold">Total em contas</p>
            <p className={`text-3xl font-black leading-none ${totalGeral >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtBRL(totalGeral)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 flex-1 min-w-[260px]">
          {saldos.length === 0 && <p className="text-gray-600 text-sm">Nenhuma conta cadastrada.</p>}
          {saldos.map(c => {
            const info = TIPO_CONTA[c.tipo] ?? TIPO_CONTA.outro;
            return (
              <div key={c.id} className="flex-1 min-w-[150px] bg-[#111827] border border-gray-700 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${info.bg} ${info.cor}`}>{info.label}</span>
                  <span className="text-[11px] font-bold text-gray-300 truncate">{c.nome}</span>
                </div>
                <p className={`text-lg font-black leading-tight ${c.saldo >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtBRL(c.saldo)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Resultado do mês ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard compact label="Recebido no mês" value={fmtBRL(t.receitas)}  icon={ArrowUp}      color="text-green-400" />
        <KpiCard compact label="Pago no mês"     value={fmtBRL(t.despesas)}  icon={ArrowDown}    color="text-red-400" />
        <KpiCard compact label="Resultado"       value={fmtBRL(t.resultado)} icon={Scale}        color={t.resultado >= 0 ? 'text-blue-400' : 'text-red-400'} />
        <KpiCard compact label="Vendas do mês"   value={fmtBRL(totalVendas)} icon={ShoppingCart} color="text-purple-400" />
      </div>
      {t.retiradas >= 0.01 && (
        <p className="text-[11px] text-yellow-500/90 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          {fmtBRL(t.retiradas)} em retiradas de sócios (divisão de lucro) saíram do caixa, mas ficam fora de Pago/Resultado porque não são despesa do negócio.
        </p>
      )}
      {Math.abs(t.ajustes) >= 0.01 && (
        <p className="text-[11px] text-yellow-500/90 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          {fmtBRL(t.ajustes)} em "Diferença de conta" (ajustes de saldo) mexeu nos saldos das contas, mas ficou fora de Recebido/Pago/Resultado porque não é receita nem despesa.
        </p>
      )}

      {/* ── Gráficos dos últimos 15 dias ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-3">
          <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recebido x Pago — últimos 15 dias</h3>
            <span className="text-[10px] text-gray-500">
              <span className="text-green-400 font-bold">{fmtBRL(soma7('recebido'))}</span> · <span className="text-red-400 font-bold">{fmtBRL(soma7('pago'))}</span>
            </span>
          </div>
          <div style={{ width: '100%', height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} barGap={2} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="nome" stroke="#4b5563" fontSize={10} tickLine={false} height={20} interval={0} tickFormatter={(v: string) => v.slice(0, 2)} />
                <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} width={30} tickFormatter={fmtK} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [fmtBRL(Number(v)), n === 'recebido' ? 'Recebido' : 'Pago']} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="recebido" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="pago" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-3">
          <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vendas — últimos 15 dias</h3>
            <span className="text-[10px] text-gray-500">
              <span className="text-purple-400 font-bold">{fmtBRL(soma7('vendas'))}</span> · {grafico.reduce((s, g) => s + g.qtd, 0)} venda(s)
            </span>
          </div>
          <div style={{ width: '100%', height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="nome" stroke="#4b5563" fontSize={10} tickLine={false} height={20} interval={0} tickFormatter={(v: string) => v.slice(0, 2)} />
                <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} width={30} tickFormatter={fmtK} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, _n: any, p: any) => [`${fmtBRL(Number(v))} (${p?.payload?.qtd ?? 0} venda(s))`, 'Vendas']} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="vendas" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Pendências e vendas do mês ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard compact label="A receber (vencem no mês)" value={fmtBRL(t.aReceber)} icon={Clock}      color="text-yellow-400" />
        <KpiCard compact label="A pagar (vencem no mês)"   value={fmtBRL(t.aPagar)}   icon={ArrowDown}  color="text-orange-400" />
        <KpiCard compact label="Vendas já recebidas"       value={fmtBRL(totalRecebido)} icon={Check}   color="text-green-400" />
        <KpiCard compact label="Vendas ainda a receber"    value={fmtBRL(totalRest)}  icon={Clock}      color="text-yellow-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-3">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Formas de pagamento (vendas do mês)
          </h3>
          {(() => {
            const mapa: Record<string, { count: number; total: number }> = {};
            vendasMes.filter(v => v.forma_pagamento).forEach(v => {
              const f = v.forma_pagamento!;
              if (!mapa[f]) mapa[f] = { count: 0, total: 0 };
              mapa[f].count++; mapa[f].total += Number(v.valor_total ?? v.total ?? 0);
            });
            const arr = Object.entries(mapa).sort((a, b) => b[1].total - a[1].total);
            if (arr.length === 0) return <p className="text-gray-600 text-xs py-2">Nenhuma venda com forma de pagamento neste mês.</p>;
            const max = Math.max(...arr.map(a => a[1].total), 1);
            return (
              <div className="space-y-1.5">
                {arr.map(([forma, d]) => (
                  <div key={forma}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{forma} <span className="text-[10px] text-gray-500 font-normal">· {d.count} venda(s)</span></span>
                      <span className="font-black text-green-400">{fmtBRL(d.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-800 mt-0.5"><div className="h-full rounded-full bg-blue-500" style={{ width: `${(d.total / max) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-3">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Vendas por status (mês)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(STATUS_VENDA).map(([k, v]) => {
              const lista = vendas.filter(x => x.status === k && (x.data_venda ?? x.created_at ?? '').startsWith(mes));
              if (lista.length === 0) return null;
              const val = lista.reduce((s, x) => s + Number(x.valor_total ?? x.total ?? 0), 0);
              return (
                <div key={k} className="bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${v.cor}`}>{v.label}</span>
                    <span className="text-[10px] text-gray-500">{lista.length}</span>
                  </div>
                  <p className="text-sm font-black text-white">{fmtBRL(val)}</p>
                </div>
              );
            })}
            {vendasMes.length === 0 && <p className="text-gray-600 text-xs py-2 col-span-full">Nenhuma venda neste mês.</p>}
          </div>
        </div>
      </div>

      <details className="bg-[#1f2937] border border-gray-700 rounded-xl p-3 text-xs text-gray-400">
        <summary className="cursor-pointer font-bold text-gray-300">Como estes números são calculados</summary>
        <ul className="mt-2 space-y-1 list-disc pl-5">
          <li><b className="text-gray-300">Total em contas / saldo de cada conta:</b> saldo inicial + tudo que entrou − tudo que saiu naquela conta, desde sempre.</li>
          <li><b className="text-gray-300">Recebido no mês:</b> lançamentos de receita marcados como pagos com data de pagamento no mês + entradas manuais do Fluxo de Caixa.</li>
          <li><b className="text-gray-300">Pago no mês:</b> o mesmo para despesas.</li>
          <li><b className="text-gray-300">Resultado:</b> Recebido − Pago. É o que sobrou de fato no mês, não é lucro contábil.</li>
          <li><b className="text-gray-300">Fora da conta:</b> "Diferença de conta" (ajuste de saldo) e transferências entre contas não são receita nem despesa.</li>
          <li><b className="text-gray-300">A receber / A pagar:</b> lançamentos ainda não pagos que vencem no mês escolhido.</li>
          <li><b className="text-gray-300">Vendas do mês:</b> valor das vendas feitas no mês (não canceladas), mesmo que ainda não pagas.</li>
        </ul>
      </details>
    </div>
  );
}
