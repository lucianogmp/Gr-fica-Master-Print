// src/pages/GestaoCustos/equipamentos/CustoHoraTab.tsx
// Composição do custo por hora de UMA máquina — cada componente separado e com a regra à vista.
import { Info } from 'lucide-react';
import { CustoEquipamento } from '../../../lib/custoEquipamento';
import type { Equipamento } from '../../../types/equipamento';
import { fmtBRL, fmtHora } from './ui';

export function CustoHoraTab({ equipamento, custo }: { equipamento: Equipamento; custo: CustoEquipamento }) {
  const c = custo;
  const valorBase = Math.max(0, Number(equipamento.valor) - Number(equipamento.valor_residual ?? 0));

  const linhas: { nome: string; mensal: number; hora: number; cor: string; regra: string }[] = [
    {
      nome: 'Depreciação', mensal: c.mensal.depreciacao, hora: c.hora.depreciacao, cor: 'bg-yellow-500',
      regra: `(${fmtBRL(Number(equipamento.valor))} − residual ${fmtBRL(Number(equipamento.valor_residual ?? 0))}) ÷ ${Number(equipamento.vida_util_anos) * 12} meses = ${fmtBRL(c.depreciacaoMensal)}/mês`,
    },
    {
      nome: 'Manutenção e peças', mensal: c.mensal.manutencao, hora: c.hora.manutencao, cor: 'bg-red-500',
      regra: c.manutencoes.filter(m => m.situacao === 'rateando').length > 0
        ? `${c.manutencoes.filter(m => m.situacao === 'rateando').length} registro(s) sendo rateado(s) — cada um: valor ÷ meses de rateio`
        : 'nenhum registro em rateio no momento',
    },
    {
      nome: 'Consumíveis', mensal: c.mensal.consumiveis, hora: c.hora.consumiveis, cor: 'bg-purple-500',
      regra: c.consumiveis.filter(x => !x.foraDoCustoHora).length > 0
        ? `soma dos consumíveis por hora/vida/periodicidade (${c.consumiveis.filter(x => !x.foraDoCustoHora).map(x => x.nome).join(', ')})`
        : 'nenhum consumível por hora cadastrado',
    },
    {
      nome: 'Energia elétrica', mensal: c.mensal.energia, hora: c.hora.energia, cor: 'bg-blue-500',
      regra: Number(equipamento.energia_hora_manual ?? 0) > 0
        ? 'custo por hora informado manualmente'
        : Number(equipamento.potencia_kw ?? 0) > 0 ? `${equipamento.potencia_kw} kW × ${fmtBRL(Number(equipamento.preco_kwh ?? 0))}/kWh` : 'sem dados de energia (opcional)',
    },
    {
      nome: 'Outros custos', mensal: c.mensal.outros, hora: c.hora.outros, cor: 'bg-gray-400',
      regra: Number(equipamento.outros_custos_mes ?? 0) > 0 ? `${fmtBRL(Number(equipamento.outros_custos_mes))}/mês ÷ ${c.horasMes} h` : 'não cadastrado (opcional)',
    },
  ];

  const foraDoCusto = c.consumiveis.filter(x => x.foraDoCustoHora);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-stretch">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">
          <p className="text-[9px] text-gray-500 uppercase font-bold">Custo por hora da máquina</p>
          <p className="text-xl font-black text-green-400">{fmtHora(c.hora.total)}</p>
        </div>
        <div className="bg-[#111827] border border-gray-700 rounded-lg px-4 py-2">
          <p className="text-[9px] text-gray-500 uppercase font-bold">Horas produtivas/mês</p>
          <p className="text-xl font-black text-gray-200">{c.horasMes} h</p>
        </div>
        <div className="bg-[#111827] border border-gray-700 rounded-lg px-4 py-2">
          <p className="text-[9px] text-gray-500 uppercase font-bold">Custo estimado/mês</p>
          <p className="text-xl font-black text-gray-200">{fmtBRL(c.mensal.total)}</p>
        </div>
        <div className="bg-[#111827] border border-gray-700 rounded-lg px-4 py-2">
          <p className="text-[9px] text-gray-500 uppercase font-bold">Exemplo: 30 minutos</p>
          <p className="text-xl font-black text-gray-200">{fmtBRL(c.hora.total / 2)}</p>
        </div>
      </div>

      <div className="border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-3 py-2 text-left">Componente</th>
                <th className="px-3 py-2 text-right">R$/mês</th>
                <th className="px-3 py-2 text-right">R$/hora</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2 text-left">De onde vem</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => {
                const pct = c.hora.total > 0 ? (l.hora / c.hora.total) * 100 : 0;
                return (
                  <tr key={l.nome} className={`border-b border-gray-800 ${l.hora === 0 ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 font-medium text-white whitespace-nowrap">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${l.cor}`} />{l.nome}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">{fmtBRL(l.mensal)}</td>
                    <td className="px-3 py-2 text-right font-bold text-white">{fmtHora(l.hora)}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{pct.toFixed(0)}%</td>
                    <td className="px-3 py-2 text-[10px] text-gray-500">{l.regra}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-green-500/20 bg-green-900/10">
                <td className="px-3 py-2 font-black text-gray-300 uppercase text-[10px]">Total</td>
                <td className="px-3 py-2 text-right font-black text-green-400">{fmtBRL(c.mensal.total)}</td>
                <td className="px-3 py-2 text-right font-black text-green-400">{fmtHora(c.hora.total)}</td>
                <td className="px-3 py-2 text-right text-gray-400">100%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="space-y-1.5 text-[11px] text-gray-500">
        <p className="flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          Tudo é dividido pelas <strong className="text-gray-300">{c.horasMes} horas produtivas/mês</strong> desta máquina
          (base de depreciação: {fmtBRL(valorBase)}).
        </p>
        <p className="flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          O <strong className="text-gray-300">overhead geral</strong> (aluguel, salários, internet...) não está neste valor:
          ele é rateado à parte em Produtos (custos fixos ÷ horas), pra não ser contado duas vezes.
        </p>
        {foraDoCusto.length > 0 && (
          <p className="flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            Fora do custo por hora (cobrados por consumo no orçamento/BOM):{' '}
            <strong className="text-gray-300">{foraDoCusto.map(x => x.nome).join(', ')}</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
