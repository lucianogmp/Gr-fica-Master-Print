// src/pages/Financeiro/Lancamentos.tsx
import { useState } from 'react';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useCaixaMovimentos } from '../../hooks/useCaixaMovimentos';
import { TabelaLancamentos, fmtBRL } from './TabelaLancamentos';
import { Landmark, TrendingUp, TrendingDown, Clock, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthInput } from '../../components/ui/MonthInput';
import { totaisDoMes, movimentoManual } from '../../lib/financeiroMes';
import { KpiCard } from '../../components/ui/KpiCard';

export function Lancamentos() {
  const { data: lancamentos = [] } = useLancamentos();
  const { data: movsCaixa = [] } = useCaixaMovimentos();
  const [mesKpi, setMesKpi] = useState(() => new Date().toISOString().slice(0, 7));

  function deslocarMesKpi(delta: number) {
    const [y, m] = mesKpi.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesKpi(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const { receitas: totalReceitas, despesas: totalDespesas, aReceber, aPagar } = totaisDoMes(lancamentos as any, movsCaixa as any, mesKpi);
  const qtdMes = lancamentos.filter(l => (l.data_vencimento ?? l.created_at ?? '').startsWith(mesKpi)).length
    + movsCaixa.filter(m => movimentoManual(m as any) && !(m as any).venda_id && (m.data ?? '').startsWith(mesKpi)).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-blue-400" /> Lançamentos
          </h1>
          <p className="text-gray-500 text-sm">{qtdMes} lançamento(s) no mês</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* KPIs — encaixados na mesma linha do título, compactos */}
          <KpiCard compact label="Recebido no mês"   value={fmtBRL(totalReceitas)} icon={TrendingUp}   color="text-green-400" />
          <KpiCard compact label="Pago no mês"       value={fmtBRL(totalDespesas)} icon={TrendingDown} color="text-red-400" />
          <KpiCard compact label="A receber (mês)" value={fmtBRL(aReceber)}      icon={Clock}        color="text-blue-400" />
          <KpiCard compact label="A pagar (mês)"     value={fmtBRL(aPagar)}        icon={Banknote}     color="text-yellow-400" />

          <div className="flex items-center gap-1 bg-[#1f2937] border border-gray-700 rounded-xl px-1.5 py-1.5">
            <button onClick={() => deslocarMesKpi(-1)} title="Mês anterior"
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <MonthInput
              value={mesKpi}
              onChange={v => v && setMesKpi(v)}
              className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm font-bold capitalize min-w-[150px]"
            />
            <button onClick={() => deslocarMesKpi(1)} title="Próximo mês"
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <TabelaLancamentos
        mes={mesKpi}
        mensagemVazio="Nenhum lançamento encontrado."
      />
    </div>
  );
}
