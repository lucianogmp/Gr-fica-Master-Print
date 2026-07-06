// src/pages/Financeiro/Lancamentos.tsx
import { useState } from 'react';
import { useLancamentos } from '../../hooks/useLancamentos';
import { TabelaLancamentos, fmtBRL } from './TabelaLancamentos';
import { Landmark, TrendingUp, TrendingDown, Clock, Banknote } from 'lucide-react';

export function Lancamentos() {
  const { data: lancamentos = [] } = useLancamentos();
  const [mesKpi, setMesKpi] = useState(() => new Date().toISOString().slice(0, 7));

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
        <div className="flex items-center gap-2">
          <input type="month" value={mesKpi} onChange={e => setMesKpi(e.target.value)}
            className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          <span className="text-gray-600 text-xs">KPIs do mês</span>
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
