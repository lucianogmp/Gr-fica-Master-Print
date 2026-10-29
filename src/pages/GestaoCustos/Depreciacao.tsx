// src/pages/GestaoCustos/Depreciacao.tsx
// Equipamentos: cadastro, consumíveis, manutenções e custo real por hora de cada máquina.
// (O arquivo mantém o nome antigo porque a rota /custos/depreciacao continua a mesma.)
import { useState } from 'react';
import { TrendingDown, Plus, X, Pencil, Timer, Cog, Wallet } from 'lucide-react';
import { useDepreciacao } from '../../hooks/useGestaoBase';
import { useGestaoCustos } from '../../hooks/useGestaoCustos';
import { useCustosEquipamentos } from '../../hooks/useEquipamentos';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { KpiCard } from '../../components/ui/KpiCard';
import type { Equipamento } from '../../types/equipamento';
import { DadosGerais } from './equipamentos/DadosGerais';
import { ConsumiveisTab } from './equipamentos/ConsumiveisTab';
import { ManutencoesTab } from './equipamentos/ManutencoesTab';
import { CustoHoraTab } from './equipamentos/CustoHoraTab';
import { RelatorioTab } from './equipamentos/RelatorioTab';
import { calcCustoPorUnidade, tecnologiaDe } from '../../lib/tecnologias';
import { fmtBRL, fmtHora, fmtData } from './equipamentos/ui';

type Aba = 'custo' | 'dados' | 'consumiveis' | 'manutencoes' | 'relatorio';
const ABAS: { key: Aba; label: string }[] = [
  { key: 'custo',        label: 'Custo por hora' },
  { key: 'dados',        label: 'Dados gerais' },
  { key: 'consumiveis',  label: 'Consumíveis' },
  { key: 'manutencoes',  label: 'Manutenções e peças' },
  { key: 'relatorio',    label: 'Relatório' },
];

export function Depreciacao() {
  const { deletar } = useDepreciacao();
  const { data: gc } = useGestaoCustos();
  const { equipamentos, custos, isLoading } = useCustosEquipamentos();
  const { confirmar, ConfirmModal } = useConfirm();

  const [novo, setNovo] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('custo');
  const [ordem, setOrdem] = useState<'nome' | 'custo'>('nome');

  const lista = [...equipamentos].sort((a, b) =>
    ordem === 'custo'
      ? (custos[b.id]?.hora.total ?? 0) - (custos[a.id]?.hora.total ?? 0)
      : a.nome.localeCompare(b.nome));
  const maxHora = Math.max(0, ...lista.filter(e => e.ativo !== false).map(e => custos[e.id]?.hora.total ?? 0));
  const aberto: Equipamento | undefined = equipamentos.find(e => e.id === abertoId);
  const totalAtivos = equipamentos.filter(e => e.ativo !== false).reduce((s, e) => s + Number(e.valor), 0);

  function abrir(id: string, abaInicial: Aba = 'custo') {
    setNovo(false);
    setAbertoId(id);
    setAba(abaInicial);
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Cog className="w-6 h-6 text-yellow-400" /> Equipamentos
            </h1>
            <p className="text-gray-500 text-sm">
              {equipamentos.length} equipamento(s) · custo real de operação de cada máquina
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <KpiCard compact label="Depreciação/mês" value={fmtBRL(gc?.depr ?? 0)} icon={TrendingDown} color="text-yellow-400" />
            <KpiCard compact label="Total em ativos" value={fmtBRL(totalAtivos)} icon={Wallet} color="text-gray-400" />
            <KpiCard compact label="Overhead/hora" value={fmtBRL(gc?.porHora ?? 0)} icon={Timer} color="text-purple-400" />
            <button onClick={() => { setAbertoId(null); setNovo(n => !n); }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2 whitespace-nowrap">
              {novo ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo equipamento</>}
            </button>
          </div>
        </div>

        {novo && (
          <div className="bg-[#1f2937] border border-gray-700 border-t-2 border-t-blue-500 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-400 mb-3">Novo equipamento</p>
            <DadosGerais onSalvo={() => setNovo(false)} onCancelar={() => setNovo(false)} />
          </div>
        )}

        {aberto && (
          <div className="bg-[#1f2937] border border-gray-700 border-t-2 border-t-yellow-500 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h2 className="text-base font-black text-white truncate">{aberto.nome}</h2>
                <p className="text-[11px] text-gray-500">
                  {aberto.categoria || 'Sem tipo'} · {fmtBRL(Number(aberto.valor))} · comprado em {fmtData(aberto.data_aquisicao)}
                </p>
              </div>
              <button onClick={() => setAbertoId(null)} className="text-gray-500 hover:text-white" title="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 bg-[#111827] border border-gray-700 rounded-lg p-1 w-full overflow-x-auto">
              {ABAS.map(t => (
                <button key={t.key} onClick={() => setAba(t.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                    aba === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}>{t.label}</button>
              ))}
            </div>

            {custos[aberto.id] && (
              <>
                {aba === 'custo'       && <CustoHoraTab equipamento={aberto} custo={custos[aberto.id]} />}
                {aba === 'dados'       && <DadosGerais key={aberto.id} equipamento={aberto} onSalvo={() => setAba('custo')} />}
                {aba === 'consumiveis' && <ConsumiveisTab equipamento={aberto} custo={custos[aberto.id]} />}
                {aba === 'manutencoes' && <ManutencoesTab equipamento={aberto} custo={custos[aberto.id]} />}
                {aba === 'relatorio'   && <RelatorioTab equipamento={aberto} custo={custos[aberto.id]} />}
              </>
            )}
          </div>
        )}

        {/* Comparativo entre equipamentos */}
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-700 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Comparativo de custo de utilização</p>
            <div className="flex items-center gap-1 text-[10px] font-bold">
              <span className="text-gray-500 uppercase mr-1">Ordenar</span>
              {(['nome', 'custo'] as const).map(o => (
                <button key={o} onClick={() => setOrdem(o)}
                  className={`px-2 py-1 rounded-md transition-all ${ordem === o ? 'bg-blue-600 text-white' : 'bg-gray-700/50 text-gray-400 hover:text-white'}`}>
                  {o === 'nome' ? 'Nome' : 'Custo/hora'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                  <th className="px-4 py-2 text-left">Equipamento</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-right">Depr./mês</th>
                  <th className="px-4 py-2 text-center">Horas/mês</th>
                  <th className="px-4 py-2 text-left" style={{ minWidth: 170 }}>Custo/hora</th>
                  <th className="px-4 py-2 text-right">Custo/mês</th>
                  <th className="px-4 py-2 text-right">Custo/página ou m²</th>
                  <th className="px-4 py-2 text-left">Últ. manutenção</th>
                  <th className="px-4 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-600">Nenhum equipamento cadastrado.</td></tr>
                )}
                {lista.map(eq => {
                  const c = custos[eq.id];
                  const inativo = eq.ativo === false;
                  const pct = maxHora > 0 && c ? (c.hora.total / maxHora) * 100 : 0;
                  return (
                    <tr key={eq.id} onClick={() => abrir(eq.id)}
                      className={`border-b border-gray-800 hover:bg-gray-800/40 transition-colors cursor-pointer ${inativo ? 'opacity-50' : ''} ${abertoId === eq.id ? 'bg-yellow-500/5' : ''}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-white">
                          {eq.nome}
                          {inativo && <span className="ml-2 text-[9px] font-bold bg-gray-500/20 text-gray-400 border border-gray-600/30 px-1.5 py-0.5 rounded-full">inativo</span>}
                        </p>
                        <p className="text-[10px] text-gray-500">{eq.categoria || '—'}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{fmtBRL(Number(eq.valor))}</td>
                      <td className="px-4 py-2.5 text-right text-yellow-400">{fmtBRL(c?.mensal.depreciacao ?? 0)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-400">{c?.horasMes ?? 160}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-black text-green-400">{fmtHora(c?.hora.total ?? 0)}</p>
                        <div className="h-1 bg-gray-700 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{fmtBRL(c?.mensal.total ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {(() => {
                          const cu = c ? calcCustoPorUnidade(eq, c.mensal.total, c.consumiveis) : null;
                          if (!cu) return <span className="text-gray-600">—</span>;
                          return <span className="font-bold text-blue-300" title={cu.estimada ? 'Produção mensal estimada' : undefined}>
                            {cu.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            <span className="text-[10px] text-gray-500 font-normal"> /{tecnologiaDe(eq.tecnologia)?.unidadeProducao === 'm²' ? 'm²' : 'pág'}{cu.estimada ? '*' : ''}</span>
                          </span>;
                        })()}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">{fmtData(c?.ultimaManutencao)}</td>
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => abrir(eq.id, 'dados')} title="Editar dados"
                            className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button title="Excluir"
                            onClick={async () => {
                              if (await confirmar(`Remover "${eq.nome}"? Os consumíveis e o histórico de manutenção dele também serão apagados.`, 'Remover equipamento')) {
                                if (abertoId === eq.id) setAbertoId(null);
                                deletar(eq.id);
                              }
                            }}
                            className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[10px] text-gray-600">
          Clique numa máquina pra ver a composição do custo, consumíveis, manutenções e relatório. O custo/hora não inclui o overhead geral
          (aluguel, salários...), que continua rateado à parte nos produtos.
        </p>
      </div>
    </>
  );
}
