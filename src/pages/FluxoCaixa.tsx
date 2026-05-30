import { useMemo, useState } from 'react';
import { useCaixaMovimentos } from '../hooks/useCaixaMovimentos';
import { useLancamentos } from '../hooks/useLancamentos';
import { KpiCard } from '../components/ui/KpiCard';

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

export function FluxoCaixa() {
  const { data: movimentos = [], isLoading: loadMov } = useCaixaMovimentos();
  const { data: lancamentos = [], isLoading: loadLanc } = useLancamentos();
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));

  const movDoMes = useMemo(() =>
    movimentos.filter(m => (m.data ?? '').startsWith(mes)),
    [movimentos, mes]
  );

  const entradas  = movDoMes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const saidas    = movDoMes.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const saldo     = entradas - saidas;

  // Projeção: lançamentos futuros pendentes
  const hoje = new Date().toISOString().split('T')[0];
  const receber = lancamentos.filter(l =>
    l.tipo === 'receita' && l.status !== 'pago' && l.status !== 'cancelado' &&
    (l.data_vencimento ?? '') >= hoje
  ).reduce((s, l) => s + Number(l.valor), 0);

  const pagar = lancamentos.filter(l =>
    l.tipo === 'despesa' && l.status !== 'pago' && l.status !== 'cancelado' &&
    (l.data_vencimento ?? '') >= hoje
  ).reduce((s, l) => s + Number(l.valor), 0);

  // Agrupar movimentos por data
  const porData = useMemo(() => {
    const map: Record<string, typeof movDoMes> = {};
    [...movDoMes].sort((a, b) => b.data.localeCompare(a.data)).forEach(m => {
      if (!map[m.data]) map[m.data] = [];
      map[m.data].push(m);
    });
    return map;
  }, [movDoMes]);

  const datas = Object.keys(porData).sort((a, b) => b.localeCompare(a));

  if (loadMov || loadLanc) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Fluxo de Caixa...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">📈 Fluxo de Caixa</h1>
          <p className="text-gray-500 text-sm">Movimentos e projeção financeira</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Entradas no mês"   value={fmtBRL(entradas)} icon="↑" color="text-green-400" />
        <KpiCard label="Saídas no mês"     value={fmtBRL(saidas)}   icon="↓" color="text-red-400" />
        <KpiCard label="Saldo do mês"      value={fmtBRL(saldo)}    icon="💰" color={saldo >= 0 ? 'text-blue-400' : 'text-red-400'} />
        <KpiCard label="Saldo projetado"   value={fmtBRL(saldo + receber - pagar)} icon="🔮" color="text-purple-400" />
      </div>

      {/* Projeção */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1f2937] border border-green-500/20 rounded-xl p-5">
          <p className="text-xs font-bold text-gray-500 uppercase mb-3">📥 A receber (pendente)</p>
          <p className="text-2xl font-black text-green-400">{fmtBRL(receber)}</p>
          <p className="text-xs text-gray-600 mt-1">{lancamentos.filter(l => l.tipo === 'receita' && l.status !== 'pago' && l.status !== 'cancelado').length} lançamentos</p>
        </div>
        <div className="bg-[#1f2937] border border-red-500/20 rounded-xl p-5">
          <p className="text-xs font-bold text-gray-500 uppercase mb-3">📤 A pagar (pendente)</p>
          <p className="text-2xl font-black text-red-400">{fmtBRL(pagar)}</p>
          <p className="text-xs text-gray-600 mt-1">{lancamentos.filter(l => l.tipo === 'despesa' && l.status !== 'pago' && l.status !== 'cancelado').length} lançamentos</p>
        </div>
      </div>

      {/* Timeline de movimentos */}
      <div>
        <h2 className="text-sm font-bold text-gray-400 uppercase mb-4">Movimentos do Mês</h2>

        {datas.length === 0 ? (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center text-gray-600">
            Nenhum movimento registrado no período.
          </div>
        ) : (
          <div className="space-y-4">
            {datas.map(data => {
              const movs   = porData[data];
              const entDia = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
              const saiDia = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);

              return (
                <div key={data} className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
                  {/* Header do dia */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 bg-gray-800/40">
                    <span className="text-sm font-bold text-white">{fmtData(data)}</span>
                    <div className="flex gap-4 text-xs">
                      {entDia > 0 && <span className="text-green-400 font-bold">+{fmtBRL(entDia)}</span>}
                      {saiDia > 0 && <span className="text-red-400 font-bold">-{fmtBRL(saiDia)}</span>}
                      <span className={`font-black ${entDia - saiDia >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        = {fmtBRL(entDia - saiDia)}
                      </span>
                    </div>
                  </div>

                  {/* Movimentos do dia */}
                  {movs.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-5 py-2.5 border-b border-gray-800 last:border-b-0 hover:bg-gray-800/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                          {m.tipo === 'entrada' ? '↑' : '↓'}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-white">{m.descricao}</p>
                          <p className="text-[10px] text-gray-500">
                            {[m.cliente_nome, m.origem, m.observacoes].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                      <span className={`font-black text-sm ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.tipo === 'entrada' ? '+' : '-'}{fmtBRL(Number(m.valor))}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
