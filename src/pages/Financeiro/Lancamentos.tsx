// src/pages/Financeiro/Lancamentos.tsx
import { useState } from 'react';
import { useLancamentos } from '../../hooks/useLancamentos';
import { TabelaLancamentos, fmtBRL } from './TabelaLancamentos';
import { Landmark, TrendingUp, TrendingDown, Clock, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthInput } from '../../components/ui/MonthInput';

export function Lancamentos() {
  const { data: lancamentos = [] } = useLancamentos();
  const [mesKpi, setMesKpi] = useState(() => new Date().toISOString().slice(0, 7));

  function deslocarMesKpi(delta: number) {
    const [y, m] = mesKpi.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesKpi(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const doMes        = lancamentos.filter(l => (l.data_vencimento ?? l.created_at ?? '').startsWith(mesKpi));
  const totalReceitas = doMes.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas = doMes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
  const aReceber      = lancamentos.filter(l => l.tipo === 'receita' && !['pago','cancelado'].includes(l.status)).reduce((s, l) => s + Number(l.valor), 0);
  const aPagar        = lancamentos.filter(l => l.tipo === 'despesa' && !['pago','cancelado'].includes(l.status)).reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-blue-400" /> Lançamentos
          </h1>
          <p className="text-gray-500 text-sm">{lancamentos.length} lançamento(s)</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
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
          <span className="text-gray-600 text-xs whitespace-nowrap">KPIs do mês</span>
        </div>
      </div>

      <TabelaLancamentos
        kpis={[
          { label: 'Receitas do mês',   value: fmtBRL(totalReceitas), icon: TrendingUp,   color: 'text-green-400' },
          { label: 'Despesas do mês',   value: fmtBRL(totalDespesas), icon: TrendingDown, color: 'text-red-400' },
          { label: 'A receber (total)', value: fmtBRL(aReceber),      icon: Clock,        color: 'text-blue-400' },
          { label: 'A pagar (total)',   value: fmtBRL(aPagar),        icon: Banknote,     color: 'text-yellow-400' },
        ]}
        mensagemVazio="Nenhum lançamento encontrado."
      />
    </div>
  );
}
