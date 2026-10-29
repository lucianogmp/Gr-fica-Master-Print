// src/pages/GestaoCustos/equipamentos/RelatorioTab.tsx
// Visão resumida de UMA máquina + histórico de despesas por período.
import { useMemo, useState } from 'react';
import { useManutencoes } from '../../../hooks/useEquipamentos';
import { CustoEquipamento } from '../../../lib/custoEquipamento';
import { TIPO_MANUTENCAO_LABEL, Equipamento } from '../../../types/equipamento';
import { DarkSelect } from '../../../components/ui/DarkSelect';
import { fmtBRL, fmtHora, fmtData } from './ui';

export function RelatorioTab({ equipamento, custo }: { equipamento: Equipamento; custo: CustoEquipamento }) {
  const { data: todas = [] } = useManutencoes();
  const itens = todas.filter(m => m.equipamento_id === equipamento.id);
  const anos = useMemo(() => Array.from(new Set(itens.map(m => m.data.slice(0, 4)))).sort().reverse(), [itens]);
  const [ano, setAno] = useState('todos');

  const filtrados = itens.filter(m => ano === 'todos' || m.data.startsWith(ano));
  const porMes = useMemo(() => {
    const mapa: Record<string, { total: number; pecas: number; maoObra: number; qtd: number }> = {};
    for (const m of filtrados) {
      const k = m.data.slice(0, 7);
      mapa[k] ??= { total: 0, pecas: 0, maoObra: 0, qtd: 0 };
      mapa[k].total += Number(m.valor_total);
      mapa[k].pecas += Number(m.valor_peca);
      mapa[k].maoObra += Number(m.valor_mao_obra);
      mapa[k].qtd += 1;
    }
    return Object.entries(mapa).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtrados]);

  const a = custo.acumulado;
  const cards: [string, string, string][] = [
    ['Valor de aquisição', fmtBRL(Number(equipamento.valor)), 'text-gray-200'],
    ['Depreciação acumulada', fmtBRL(a.depreciacao), 'text-yellow-400'],
    ['Custo de manutenção', fmtBRL(a.manutencao), 'text-red-400'],
    ['Custo de peças', fmtBRL(a.pecas), 'text-red-300'],
    ['Consumíveis/mês', fmtBRL(custo.mensal.consumiveis), 'text-purple-300'],
    ['Energia/mês', custo.mensal.energia > 0 ? fmtBRL(custo.mensal.energia) : '—', 'text-blue-300'],
    ['Custo operacional/hora', fmtHora(custo.hora.total), 'text-green-400'],
    ['Horas previstas/mês', `${custo.horasMes} h`, 'text-gray-200'],
    ['Custo estimado/mês', fmtBRL(custo.mensal.total), 'text-green-400'],
    ['Última manutenção', fmtData(custo.ultimaManutencao), 'text-gray-200'],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {cards.map(([rotulo, valor, cor]) => (
          <div key={rotulo} className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-2">
            <p className="text-[9px] text-gray-500 uppercase font-bold">{rotulo}</p>
            <p className={`text-sm font-black ${cor}`}>{valor}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-600">
        “Horas previstas/mês” e “Custo estimado/mês” usam as horas produtivas cadastradas — o sistema ainda não mede as horas realmente usadas em cada venda.
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] font-bold text-gray-400 uppercase">Histórico de despesas por período</p>
        <div style={{ width: 130 }}>
          <DarkSelect size="sm" value={ano} onChange={setAno} allowEmpty={false}
            options={[{ value: 'todos', label: 'Todos os anos' }, ...anos.map(y => ({ value: y, label: y }))]} />
        </div>
      </div>

      <div className="border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-3 py-2 text-left">Mês</th>
                <th className="px-3 py-2 text-right">Registros</th>
                <th className="px-3 py-2 text-right">Peças</th>
                <th className="px-3 py-2 text-right">Mão de obra</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {porMes.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-600">Sem despesas registradas no período.</td></tr>
              )}
              {porMes.map(([mes, v]) => (
                <tr key={mes} className="border-b border-gray-800">
                  <td className="px-3 py-2 text-white">{mes.slice(5)}/{mes.slice(0, 4)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{v.qtd}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{fmtBRL(v.pecas)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{fmtBRL(v.maoObra)}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-300">{fmtBRL(v.total)}</td>
                </tr>
              ))}
            </tbody>
            {porMes.length > 0 && (
              <tfoot>
                <tr className="border-t border-red-500/20 bg-red-900/10">
                  <td colSpan={4} className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Total no período</td>
                  <td className="px-3 py-2 text-right font-black text-red-300">{fmtBRL(filtrados.reduce((s, m) => s + Number(m.valor_total), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {filtrados.length > 0 && (
        <details className="text-[11px] text-gray-500">
          <summary className="cursor-pointer hover:text-gray-300">Ver os {filtrados.length} registro(s) do período</summary>
          <ul className="mt-2 space-y-1">
            {filtrados.map(m => (
              <li key={m.id}>
                {fmtData(m.data)} · {TIPO_MANUTENCAO_LABEL[m.tipo]} · {m.descricao} · <span className="text-gray-300">{fmtBRL(Number(m.valor_total))}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
