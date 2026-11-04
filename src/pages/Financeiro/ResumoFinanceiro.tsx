// src/pages/Financeiro/ResumoFinanceiro.tsx
import { useState, useMemo } from 'react';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useVendas } from '../../hooks/useVendas';
import { useCaixaMovimentos } from '../../hooks/useCaixaMovimentos';
import { totaisDoMes } from '../../lib/financeiroMes';
import { useSaldoContas, TIPO_CONTA } from '../../hooks/useContasBancarias';
import { STATUS_VENDA } from '../../types/venda';
import { KpiCard } from '../../components/ui/KpiCard';
import { MonthInput } from '../../components/ui/MonthInput';
import {
  PieChart, ArrowUp, ArrowDown, Wallet, ShoppingCart,
  Check, Clock, CreditCard, Building2, TrendingUp, ChevronLeft, ChevronRight, Scale,
} from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ResumoFinanceiro() {
  const { data: lancamentos = [], isLoading: loadLanc } = useLancamentos();
  const { data: vendas = [],      isLoading: loadVendas } = useVendas();
  const { data: movsCaixa = [] } = useCaixaMovimentos();
  const { saldos, totalGeral,     isLoading: loadContas } = useSaldoContas();

  const [mesDre, setMesDre] = useState(() => new Date().toISOString().slice(0, 7));
  function deslocarMesDre(delta: number) {
    const [y, m] = mesDre.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesDre(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Tudo nesta tela (exceto o saldo das contas, que é acumulado) segue o mês escolhido.
  const { receitas: receitasMes, despesas: despesasMes, resultado: resultadoMes, aReceber, aPagar } =
    totaisDoMes(lancamentos as any, movsCaixa as any, mesDre);

  const vendasMes     = vendas.filter(v => v.status !== 'cancelado' && (v.data_venda ?? v.created_at ?? '').startsWith(mesDre));
  const totalVendas   = vendasMes.reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0);
  const totalRecebido = vendasMes.reduce((s, v) => s + Number(v.valor_pago ?? 0), 0);
  const totalRest     = Math.max(0, totalVendas - totalRecebido);

  // Total por tipo de conta (onde o dinheiro está agora).
  const porTipo = ['caixa', 'pix', 'cartao', 'outro'].map(t => ({
    tipo: t, info: TIPO_CONTA[t] ?? TIPO_CONTA.outro,
    total: saldos.filter(c => (TIPO_CONTA[c.tipo] ? c.tipo : 'outro') === t).reduce((s, c) => s + c.saldo, 0),
    qtd: saldos.filter(c => (TIPO_CONTA[c.tipo] ? c.tipo : 'outro') === t).length,
  })).filter(g => g.qtd > 0);

  if (loadLanc || loadVendas || loadContas) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <PieChart className="w-6 h-6 text-blue-400" /> Resumo Financeiro
        </h1>
        <p className="text-gray-500 text-sm">Saldo das contas (acumulado) e, abaixo, tudo do mês escolhido no seletor de Resultado do Mês</p>
      </div>

      {/* ── ONDE ESTÁ O DINHEIRO: saldo atual de cada conta (acumulado, não depende do mês) ── */}
      <div className="bg-[#1f2937] border border-gray-700 border-t-2 border-t-blue-500 rounded-xl p-4 space-y-3">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-black text-white flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-blue-400" /> Saldo por Conta — onde está o dinheiro
            </h2>
            <p className="text-[10px] text-gray-500">Saldo de agora, acumulado — não muda com o mês escolhido.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Total consolidado</p>
            <p className={`text-3xl font-black leading-none ${totalGeral >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtBRL(totalGeral)}</p>
          </div>
        </div>

        {porTipo.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {porTipo.map(g => (
              <div key={g.tipo} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${g.info.bg}`}>
                <span className={`text-[10px] font-bold uppercase ${g.info.cor}`}>{g.info.label}</span>
                <span className="text-sm font-black text-white">{fmtBRL(g.total)}</span>
              </div>
            ))}
          </div>
        )}

        {saldos.length === 0 ? (
          <p className="text-gray-600 text-sm">Nenhuma conta cadastrada. Adicione em Configurações → Formas de Pagamento.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {saldos.map(c => {
              const info = TIPO_CONTA[c.tipo] ?? TIPO_CONTA.outro;
              return (
                <div key={c.id} className="bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 hover:border-gray-600 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.bg} ${info.cor}`}>{info.label}</span>
                    <span className="font-bold text-white text-sm truncate">{c.nome}</span>
                    {c.banco && <span className="text-[10px] text-gray-500">· {c.banco}</span>}
                  </div>
                  <p className={`text-2xl font-black leading-tight ${c.saldo >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtBRL(c.saldo)}</p>
                  <div className="flex gap-3 text-[10px] mt-1">
                    <span className="text-green-400">entrou {fmtBRL(c.entradas)}</span>
                    <span className="text-red-400">saiu {fmtBRL(c.saidas)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DRE / Resultado do mês ── */}
      <div className="bg-[#1f2937] border border-gray-700 border-t-2 border-t-purple-500 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-black text-white flex items-center gap-2 text-sm">
            <Scale className="w-4 h-4 text-purple-400" /> Resultado do Mês (DRE)
          </h2>
          <div className="flex items-center gap-1 bg-[#111827] border border-gray-700 rounded-xl px-1.5 py-1.5">
            <button onClick={() => deslocarMesDre(-1)} title="Mês anterior"
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <MonthInput
              value={mesDre}
              onChange={v => v && setMesDre(v)}
              className="bg-transparent border-0 px-2 py-0.5 text-white text-sm font-bold capitalize min-w-[140px]"
            />
            <button onClick={() => deslocarMesDre(1)} title="Próximo mês"
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-500">
          Tudo abaixo é só do mês escolhido: o que foi efetivamente recebido e pago no período (mais as movimentações manuais do caixa). Não inclui o histórico antigo.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard label="Receitas do mês" value={fmtBRL(receitasMes)} icon={ArrowUp} color="text-green-400" />
          <KpiCard label="Despesas do mês" value={fmtBRL(despesasMes)} icon={ArrowDown} color="text-red-400" />
          <KpiCard label="Resultado do mês" value={fmtBRL(resultadoMes)} icon={Scale}
            color={resultadoMes >= 0 ? 'text-blue-400' : 'text-red-400'} />
        </div>
      </div>

      {/* ── KPIs consolidados ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="A receber no mês"  value={fmtBRL(aReceber)}          icon={ArrowUp}      color="text-green-400" />
        <KpiCard label="A pagar no mês"  value={fmtBRL(aPagar)}            icon={ArrowDown}    color="text-red-400" />
        <KpiCard label="Saldo projetado (mês)" value={fmtBRL(aReceber - aPagar)} icon={Wallet}       color={aReceber - aPagar >= 0 ? 'text-blue-400' : 'text-red-400'} />
        <KpiCard label="Vendas do mês"        value={fmtBRL(totalVendas)}       icon={ShoppingCart} color="text-purple-400" />
        <KpiCard label="Recebido (vendas)"   value={fmtBRL(totalRecebido)}     icon={Check}        color="text-green-400" />
        <KpiCard label="A receber (vendas)"  value={fmtBRL(totalRest)}         icon={Clock}        color="text-yellow-400" />
      </div>

      {/* ── Formas de pagamento mais usadas ── */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Formas de Pagamento Mais Usadas (mês)
        </h3>
        {(() => {
          const mapa: Record<string, { count: number; total: number }> = {};
          vendasMes.filter(v => v.forma_pagamento).forEach(v => {
            const f = v.forma_pagamento!;
            if (!mapa[f]) mapa[f] = { count: 0, total: 0 };
            mapa[f].count++;
            mapa[f].total += Number(v.valor_total ?? v.total ?? 0);
          });
          const arr = Object.entries(mapa).sort((a, b) => b[1].count - a[1].count);
          if (arr.length === 0) return <p className="text-gray-600 text-sm">Nenhuma venda com forma de pagamento definida.</p>;
          return (
            <div className="space-y-2">
              {arr.map(([forma, d]) => (
                <div key={forma} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold text-white">{forma}</span>
                    <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">{d.count} venda(s)</span>
                  </div>
                  <span className="font-black text-green-400">{fmtBRL(d.total)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Vendas por status ── */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Vendas por Status (mês)
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS_VENDA).map(([k, v]) => {
            const vm = vendas.filter(x => (x.data_venda ?? x.created_at ?? '').startsWith(mesDre));
            const count = vm.filter(x => x.status === k).length;
            const val   = vm.filter(x => x.status === k).reduce((s, x) => s + Number(x.valor_total ?? x.total ?? 0), 0);
            if (count === 0) return null;
            return (
              <div key={k} className="flex-1 min-w-[180px] bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${v.cor}`}>{v.label}</span>
                  <span className="text-[10px] text-gray-500">{count} venda(s)</span>
                </div>
                <p className="text-lg font-black text-white">{fmtBRL(val)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
