// src/pages/Financeiro/ContasReceber.tsx
import { useLancamentos } from '../../hooks/useLancamentos';
import { TabelaLancamentos, fmtBRL, calcStatusLanc } from './TabelaLancamentos';
import { ArrowDownCircle, Clock, AlertCircle, DollarSign } from 'lucide-react';

export function ContasReceber() {
  const { data: lancamentos = [] } = useLancamentos();
  const receitas = lancamentos.filter(l => l.tipo === 'receita');

  const pendentes  = receitas.filter(l => calcStatusLanc(l) === 'pendente').reduce((s, l) => s + Number(l.valor), 0);
  const atrasadas  = receitas.filter(l => calcStatusLanc(l) === 'atrasado').reduce((s, l) => s + Number(l.valor), 0);
  const recebido   = receitas.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const total      = receitas.reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <ArrowDownCircle className="w-6 h-6 text-green-400" /> Contas a Receber
        </h1>
        <p className="text-gray-500 text-sm">{receitas.length} lançamento(s) de receita</p>
      </div>

      <TabelaLancamentos
        fixarTipo="receita"
        kpis={[
          { label: 'Pendente',  value: fmtBRL(pendentes), icon: Clock,         color: 'text-yellow-400' },
          { label: 'Atrasado',  value: fmtBRL(atrasadas), icon: AlertCircle,   color: 'text-red-400' },
          { label: 'Recebido',  value: fmtBRL(recebido),  icon: DollarSign,    color: 'text-green-400' },
          { label: 'Total',     value: fmtBRL(total),     icon: ArrowDownCircle, color: 'text-blue-400' },
        ]}
        mensagemVazio="Nenhuma conta a receber."
      />
    </div>
  );
}
