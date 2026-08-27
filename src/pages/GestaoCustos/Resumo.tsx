// src/pages/GestaoCustos/Resumo.tsx
import { useGestaoCustos } from '../../hooks/useGestaoCustos';
import { useCustosFixos } from '../../hooks/useGestaoBase';
import { useDepreciacao } from '../../hooks/useGestaoBase';
import { KpiCard } from '../../components/ui/KpiCard';
import { PieChart, Building2, TrendingDown, DollarSign, Timer } from 'lucide-react';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function LinhaCusto({ label, valor, total, cor }: { label: string; valor: number; total: number; cor: string }) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-bold text-white">{fmtBRL(valor)}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Resumo() {
  const { data: gc }        = useGestaoCustos();
  const { data: fixos = [] } = useCustosFixos();
  const { data: deprs = [] } = useDepreciacao();

  const gcData = gc ?? { depr: 0, fixos: 0, total: 0, porHora: 0 };

  const isLoading = !gc;
  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <PieChart className="w-6 h-6 text-blue-400" /> Resumo de Custos
        </h1>
        <p className="text-gray-500 text-sm">Visão consolidada do overhead mensal</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Custos fixos/mês"   value={fmtBRL(gcData.fixos)}   icon={Building2}    color="text-blue-400" />
        <KpiCard label="Depreciação/mês"    value={fmtBRL(gcData.depr)}    icon={TrendingDown} color="text-yellow-400" />
        <KpiCard label="Overhead total/mês" value={fmtBRL(gcData.total)}   icon={DollarSign}   color="text-red-400" />
        <KpiCard label="Overhead/hora"      value={fmtBRL(gcData.porHora)} icon={Timer}        color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Composição */}
        <div className="bg-[#1f2937] border-t-2 border-blue-500 border-x border-b border-gray-700 rounded-xl p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-1.5">
            Composição do Overhead Mensal
            <HelpTooltip texto="Só Custos Fixos (os marcados como Ativo) e Depreciação de equipamentos entram nessa conta. Custos Variáveis são acompanhados separadamente e não afetam esse total." />
          </p>
          <div className="space-y-3">
            <LinhaCusto label="Custos Fixos" valor={gcData.fixos} total={gcData.total} cor="bg-blue-500" />
            <LinhaCusto label="Depreciação"  valor={gcData.depr}  total={gcData.total} cor="bg-yellow-500" />
            <div className="pt-3 border-t border-gray-700 flex justify-between">
              <span className="font-bold text-white">Total/mês</span>
              <span className="text-lg font-black text-red-400">{fmtBRL(gcData.total)}</span>
            </div>
          </div>
          {gcData.total === 0 && (
            <p className="text-xs text-gray-600 mt-3">Cadastre custos fixos ou depreciação para calcular.</p>
          )}
        </div>

        {/* Por período */}
        <div className="bg-[#1f2937] border-t-2 border-purple-500 border-x border-b border-gray-700 rounded-xl p-5">
          <p className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-1.5">
            Overhead por Período
            <HelpTooltip texto="Assume um dia de trabalho de 8 horas e semana de 5 dias úteis pra converter o overhead mensal em valores por hora/dia/semana. É a base usada pra calcular o custo do 'Tempo de Produção' de cada produto." />
          </p>
          <div className="space-y-3">
            {[
              { label: 'Por hora (8h/dia)', valor: gcData.porHora },
              { label: 'Por dia (8h)',       valor: gcData.porHora * 8 },
              { label: 'Por semana',         valor: gcData.porHora * 8 * 5 },
              { label: 'Por mês',            valor: gcData.total },
            ].map(({ label, valor }) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-400">{label}</span>
                <span className="font-bold text-purple-400">{fmtBRL(valor)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top custos fixos */}
      {fixos.filter(f => f.ativo).length > 0 && (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Custos Fixos Ativos
          </h3>
          <div className="space-y-2">
            {fixos.filter(f => f.ativo).sort((a, b) => Number(b.valor_mensal) - Number(a.valor_mensal)).map(f => (
              <div key={f.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                <div>
                  <span className="text-sm text-white font-medium">{f.nome}</span>
                  {f.categoria && <span className="ml-2 text-[10px] text-gray-500">{f.categoria}</span>}
                </div>
                <span className="font-bold text-red-400">{fmtBRL(Number(f.valor_mensal))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ativos em depreciação */}
      {deprs.length > 0 && (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" /> Ativos em Depreciação
          </h3>
          <div className="space-y-2">
            {deprs.sort((a, b) => Number(b.valor) - Number(a.valor)).map(d => {
              const deprMes = Number(d.valor) / (Number(d.vida_util_anos) * 12);
              return (
                <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                  <div>
                    <span className="text-sm text-white font-medium">{d.nome}</span>
                    <span className="ml-2 text-[10px] text-gray-500">{d.vida_util_anos} anos · {fmtBRL(Number(d.valor))}</span>
                  </div>
                  <span className="font-bold text-yellow-400">{fmtBRL(deprMes)}/mês</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
