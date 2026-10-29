// src/pages/GestaoCustos/equipamentos/ManutencoesTab.tsx
// Histórico de manutenção, troca de peça e reparo de UMA máquina.
import { useState } from 'react';
import { Plus, Pencil, X, Info } from 'lucide-react';
import { useManutencoes } from '../../../hooks/useEquipamentos';
import { CustoEquipamento } from '../../../lib/custoEquipamento';
import { TIPO_MANUTENCAO_LABEL, TipoManutencao, Manutencao, Equipamento } from '../../../types/equipamento';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { InteiroInput } from '../../../components/ui/InteiroInput';
import { DateInput } from '../../../components/ui/DateInput';
import { DarkSelect } from '../../../components/ui/DarkSelect';
import { AutoTextarea } from '../../../components/ui/AutoTextarea';
import { HelpTooltip } from '../../../components/ui/HelpTooltip';
import { IN, LABEL, BTN_SALVAR, BTN_CANCELAR, fmtBRL, fmtData } from './ui';

const hoje = () => new Date().toISOString().slice(0, 10);
const vazio = () => ({
  tipo: 'manutencao' as TipoManutencao, descricao: '', data: hoje(),
  valor_peca: 0, valor_mao_obra: 0, custo_adicional: 0, meses_rateio: 12, observacoes: '',
});

export function ManutencoesTab({ equipamento, custo }: { equipamento: Equipamento; custo: CustoEquipamento }) {
  const { data: todas = [], criar, atualizar, deletar, isSaving } = useManutencoes();
  const { confirmar, ConfirmModal } = useConfirm();
  const itens = todas.filter(m => m.equipamento_id === equipamento.id);

  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState(vazio());
  const set = <K extends keyof ReturnType<typeof vazio>>(k: K, v: ReturnType<typeof vazio>[K]) => setF(p => ({ ...p, [k]: v }));
  const total = f.valor_peca + f.valor_mao_obra + f.custo_adicional;

  function novo() { setEditId(null); setF(vazio()); setAberto(true); }
  function editar(m: Manutencao) {
    setEditId(m.id);
    setF({
      tipo: m.tipo, descricao: m.descricao, data: m.data,
      valor_peca: Number(m.valor_peca), valor_mao_obra: Number(m.valor_mao_obra),
      custo_adicional: Number(m.custo_adicional), meses_rateio: Number(m.meses_rateio), observacoes: m.observacoes ?? '',
    });
    setAberto(true);
  }
  function fechar() { setAberto(false); setEditId(null); setF(vazio()); }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.descricao.trim() || !f.data) return;
    const dados = {
      equipamento_id: equipamento.id,
      tipo: f.tipo, descricao: f.descricao.trim(), data: f.data,
      valor_peca: f.valor_peca, valor_mao_obra: f.valor_mao_obra, custo_adicional: f.custo_adicional,
      meses_rateio: Math.min(120, Math.max(1, f.meses_rateio || 12)),
      observacoes: f.observacoes.trim() || null,
    } as Partial<Manutencao>;
    if (editId) await atualizar({ id: editId, dados });
    else await criar(dados);
    fechar();
  }

  const situacaoDe = (id: string) => custo.manutencoes.find(m => m.id === id);

  return (
    <>
      <ConfirmModal />
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            ['Total em manutenção', custo.acumulado.manutencao, 'text-red-400'],
            ['Peças', custo.acumulado.pecas, 'text-yellow-400'],
            ['Mão de obra', custo.acumulado.maoObra, 'text-blue-400'],
            ['Custo acumulado (compra + manutenção)', custo.acumulado.custoTotal, 'text-gray-200'],
          ].map(([rotulo, valor, cor]) => (
            <div key={rotulo as string} className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-1.5">
              <p className="text-[9px] text-gray-500 uppercase font-bold">{rotulo as string}</p>
              <p className={`text-sm font-black ${cor}`}>{fmtBRL(valor as number)}</p>
            </div>
          ))}
        </div>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-gray-500 max-w-2xl flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            Cada registro é <strong className="text-gray-300">rateado em N meses</strong> (padrão 12) no custo por hora e depois sai da conta —
            ele nunca é somado de novo. Aqui é só custo de produção: <strong className="text-gray-300">não cria despesa no Financeiro</strong>,
            então não duplica o que você já lançou lá.
          </p>
          {!aberto && (
            <button onClick={novo} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Novo registro
            </button>
          )}
        </div>

        {aberto && (
          <form onSubmit={salvar} className="bg-[#111827] border border-gray-700 rounded-xl p-3 space-y-3">
            <p className="text-[10px] font-bold text-blue-400 uppercase">{editId ? 'Editando registro' : 'Novo registro'}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div style={{ width: 140 }}>
                <label className={LABEL}>Tipo</label>
                <DarkSelect size="sm" value={f.tipo} onChange={v => set('tipo', v as TipoManutencao)} allowEmpty={false}
                  options={(Object.keys(TIPO_MANUTENCAO_LABEL) as TipoManutencao[]).map(k => ({ value: k, label: TIPO_MANUTENCAO_LABEL[k] }))} />
              </div>
              <div style={{ width: 130 }}>
                <label className={LABEL}>Data</label>
                <DateInput value={f.data} onChange={v => set('data', v)} className={IN + ' w-full'} />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className={LABEL}>Descrição *</label>
                <input required value={f.descricao} onChange={e => set('descricao', e.target.value)} className={IN + ' w-full'} placeholder="Ex: Troca da agulha, revisão técnica..." />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div><label className={LABEL}>Valor da peça</label>
                <MoneyInput value={f.valor_peca} onChange={v => set('valor_peca', v)} className={IN} style={{ width: 100 }} placeholder="0,00" /></div>
              <div><label className={LABEL}>Mão de obra</label>
                <MoneyInput value={f.valor_mao_obra} onChange={v => set('valor_mao_obra', v)} className={IN} style={{ width: 100 }} placeholder="0,00" /></div>
              <div><label className={LABEL}>Custo adicional</label>
                <MoneyInput value={f.custo_adicional} onChange={v => set('custo_adicional', v)} className={IN} style={{ width: 100 }} placeholder="0,00" /></div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                <p className="text-[9px] text-gray-500 uppercase font-bold">Total</p>
                <p className="text-sm font-black text-red-300">{fmtBRL(total)}</p>
              </div>
              <div>
                <label className={LABEL + ' flex items-center gap-1'}>
                  Ratear em (meses)
                  <HelpTooltip texto="Em quantos meses esse gasto é distribuído no custo por hora. Um reparo de R$ 1.200 rateado em 12 meses pesa R$ 100 por mês, e não R$ 1.200 de uma vez. Depois dos meses informados ele deixa de pesar." />
                </label>
                <InteiroInput value={f.meses_rateio} onChange={v => set('meses_rateio', v)} max={120} className={IN + ' text-center'} />
              </div>
              {total > 0 && f.meses_rateio > 0 && (
                <div className="bg-gray-700/30 border border-gray-700 rounded-lg px-3 py-1.5">
                  <p className="text-[9px] text-gray-500 uppercase font-bold">Pesa por mês</p>
                  <p className="text-sm font-black text-gray-200">{fmtBRL(total / f.meses_rateio)}</p>
                </div>
              )}
            </div>
            <div>
              <label className={LABEL}>Observações</label>
              <AutoTextarea value={f.observacoes} onChange={v => set('observacoes', v)} className={IN + ' w-full'} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={fechar} className={BTN_CANCELAR}>Cancelar</button>
              <button type="submit" disabled={isSaving || !f.descricao.trim()} className={BTN_SALVAR}>{editId ? 'Salvar' : 'Adicionar'}</button>
            </div>
          </form>
        )}

        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-right">Peça</th>
                  <th className="px-3 py-2 text-right">Mão de obra</th>
                  <th className="px-3 py-2 text-right">Adic.</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Rateio</th>
                  <th className="px-3 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-600">Nenhum registro para este equipamento.</td></tr>
                )}
                {itens.map(m => {
                  const s = situacaoDe(m.id);
                  return (
                    <tr key={m.id} className="border-b border-gray-800">
                      <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmtData(m.data)}</td>
                      <td className="px-3 py-2 text-white">{m.descricao}</td>
                      <td className="px-3 py-2 text-gray-400">{TIPO_MANUTENCAO_LABEL[m.tipo]}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fmtBRL(Number(m.valor_peca))}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fmtBRL(Number(m.valor_mao_obra))}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fmtBRL(Number(m.custo_adicional))}</td>
                      <td className="px-3 py-2 text-right font-bold text-red-300">{fmtBRL(Number(m.valor_total))}</td>
                      <td className="px-3 py-2 text-[10px] whitespace-nowrap">
                        {s?.situacao === 'rateando' && <span className="text-yellow-400">{fmtBRL(s.mensal)}/mês · faltam {s.mesesRestantes}m</span>}
                        {s?.situacao === 'concluido' && <span className="text-gray-500">concluído ({m.meses_rateio}m)</span>}
                        {s?.situacao === 'futuro' && <span className="text-blue-400">começa em {fmtData(m.data)}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => editar(m)} title="Editar"
                            className="w-6 h-6 flex items-center justify-center rounded-md bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={async () => { if (await confirmar(`Remover "${m.descricao}"?`, 'Remover registro')) deletar(m.id); }} title="Excluir"
                            className="w-6 h-6 flex items-center justify-center rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30">
                            <X className="w-3 h-3" />
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
      </div>
    </>
  );
}
