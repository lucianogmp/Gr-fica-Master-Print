// src/pages/Financeiro/ResumoFinanceiro.tsx
import { useLancamentos } from '../../hooks/useLancamentos';
import { useVendas } from '../../hooks/useVendas';
import { useSaldoContas, TIPO_CONTA } from '../../hooks/useContasBancarias';
import { STATUS_VENDA } from '../../types/venda';
import { KpiCard } from '../../components/ui/KpiCard';
import {
  PieChart, ArrowUp, ArrowDown, Wallet, ShoppingCart,
  Check, Clock, CreditCard, Building2, TrendingUp,
} from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ResumoFinanceiro() {
  const { data: lancamentos = [], isLoading: loadLanc } = useLancamentos();
  const { data: vendas = [],      isLoading: loadVendas } = useVendas();
  const { saldos, totalGeral,     isLoading: loadContas } = useSaldoContas();

  const aReceber      = lancamentos.filter(l => l.tipo === 'receita' && !['pago','cancelado'].includes(l.status)).reduce((s, l) => s + Number(l.valor), 0);
  const aPagar        = lancamentos.filter(l => l.tipo === 'despesa' && !['pago','cancelado'].includes(l.status)).reduce((s, l) => s + Number(l.valor), 0);
  const totalVendas   = vendas.filter(v => v.status !== 'cancelado').reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0);
  const totalRecebido = vendas.filter(v => v.status !== 'cancelado').reduce((s, v) => s + Number(v.valor_pago ?? 0), 0);
  const totalRest     = Math.max(0, totalVendas - totalRecebido);

  if (loadLanc || loadVendas || loadContas) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <PieChart className="w-6 h-6 text-blue-400" /> Resumo Financeiro
        </h1>
        <p className="text-gray-500 text-sm">Visão consolidada do financeiro</p>
      </div>

      {/* ── Painel de Saldos por Conta ── */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="font-black text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" /> Saldo por Conta
          </h2>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Total consolidado</p>
            <p className={`text-xl font-black ${totalGeral >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmtBRL(totalGeral)}
            </p>
          </div>
        </div>

        {saldos.length === 0 ? (
          <div className="p-8 text-center text-gray-600 text-sm">
            Nenhuma conta cadastrada. Adicione em Configurações → Formas de Pagamento.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {saldos.map(c => {
              const info = TIPO_CONTA[c.tipo] ?? TIPO_CONTA.outro;
              const pct  = totalGeral !== 0 ? Math.abs(c.saldo / totalGeral) * 100 : 0;
              return (
                <div key={c.id} className="px-5 py-4 hover:bg-gray-800/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${info.bg} ${info.cor}`}>
                        {info.label}
                      </span>
                      <div>
                        <p className="font-bold text-white text-sm">{c.nome}</p>
                        {c.banco && <p className="text-[10px] text-gray-500">{c.banco}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${c.saldo >= 0 ? 'text-white' : 'text-red-400'}`}>
                        {fmtBRL(c.saldo)}
                      </p>
                      <div className="flex gap-3 text-[10px] justify-end mt-0.5">
                        <span className="text-green-400">+{fmtBRL(c.entradas)}</span>
                        <span className="text-red-400">-{fmtBRL(c.saidas)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Barra de proporção */}
                  {totalGeral > 0 && c.saldo > 0 && (
                    <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500/60 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── KPIs consolidados ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Receitas pendentes"  value={fmtBRL(aReceber)}          icon={ArrowUp}      color="text-green-400" />
        <KpiCard label="Despesas pendentes"  value={fmtBRL(aPagar)}            icon={ArrowDown}    color="text-red-400" />
        <KpiCard label="Saldo projetado"     value={fmtBRL(aReceber - aPagar)} icon={Wallet}       color={aReceber - aPagar >= 0 ? 'text-blue-400' : 'text-red-400'} />
        <KpiCard label="Total vendas"        value={fmtBRL(totalVendas)}       icon={ShoppingCart} color="text-purple-400" />
        <KpiCard label="Recebido (vendas)"   value={fmtBRL(totalRecebido)}     icon={Check}        color="text-green-400" />
        <KpiCard label="A receber (vendas)"  value={fmtBRL(totalRest)}         icon={Clock}        color="text-yellow-400" />
      </div>

      {/* ── Formas de pagamento mais usadas ── */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Formas de Pagamento Mais Usadas
        </h3>
        {(() => {
          const mapa: Record<string, { count: number; total: number }> = {};
          vendas.filter(v => v.forma_pagamento && v.status !== 'cancelado').forEach(v => {
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
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Vendas por Status
        </h3>
        <div className="space-y-2">
          {Object.entries(STATUS_VENDA).map(([k, v]) => {
            const count = vendas.filter(x => x.status === k).length;
            const val   = vendas.filter(x => x.status === k).reduce((s, x) => s + Number(x.valor_total ?? x.total ?? 0), 0);
            if (count === 0) return null;
            return (
              <div key={k} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${v.cor}`}>{v.label}</span>
                  <span className="text-xs text-gray-500">{count} venda(s)</span>
                </div>
                <span className="font-bold text-white">{fmtBRL(val)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
