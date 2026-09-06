// src/pages/Financeiro/ContasPagar.tsx
import { useLancamentos } from '../../hooks/useLancamentos';
import { TabelaLancamentos, fmtBRL, calcStatusLanc } from './TabelaLancamentos';
import { ArrowUpCircle, Clock, AlertCircle, DollarSign } from 'lucide-react';
import { KpiCard } from '../../components/ui/KpiCard';

export function ContasPagar() {
  const { data: lancamentos = [] } = useLancamentos();
  const despesas = lancamentos.filter(l => l.tipo === 'despesa');

  const pendentes = despesas.filter(l => calcStatusLanc(l) === 'pendente').reduce((s, l) => s + Number(l.valor), 0);
  const atrasadas = despesas.filter(l => calcStatusLanc(l) === 'atrasado').reduce((s, l) => s + Number(l.valor), 0);
  const pago      = despesas.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const total     = despesas.reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ArrowUpCircle className="w-6 h-6 text-red-400" /> Contas a Pagar
          </h1>
          <p className="text-gray-500 text-sm">{despesas.length} lançamento(s) de despesa</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* KPIs — encaixados na mesma linha do título, compactos */}
          <KpiCard compact label="Pendente" value={fmtBRL(pendentes)} icon={Clock}         color="text-yellow-400" />
          <KpiCard compact label="Atrasado"  value={fmtBRL(atrasadas)} icon={AlertCircle}   color="text-red-400" />
          <KpiCard compact label="Pago"      value={fmtBRL(pago)}      icon={DollarSign}    color="text-green-400" />
          <KpiCard compact label="Total"     value={fmtBRL(total)}     icon={ArrowUpCircle} color="text-blue-400" />
        </div>
      </div>

      <TabelaLancamentos
        fixarTipo="despesa"
        mensagemVazio="Nenhuma conta a pagar."
      />
    </div>
  );
}
