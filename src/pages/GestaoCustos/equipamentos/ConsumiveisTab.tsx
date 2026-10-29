// src/pages/GestaoCustos/equipamentos/ConsumiveisTab.tsx
// Consumíveis específicos de UMA máquina. Cada máquina tem os seus — nenhum é obrigatório.
import { useState } from 'react';
import { Plus, Pencil, X, Info } from 'lucide-react';
import { useConsumiveis } from '../../../hooks/useEquipamentos';
import { calcConsumivel, CustoEquipamento } from '../../../lib/custoEquipamento';
import { BASE_CALCULO_LABEL, UNIDADES_CONSUMO, BaseCalculoConsumivel, Consumivel, Equipamento } from '../../../types/equipamento';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { QtdInput } from '../../../components/ui/QtdInput';
import { InteiroInput } from '../../../components/ui/InteiroInput';
import { DarkSelect } from '../../../components/ui/DarkSelect';
import { AutoTextarea } from '../../../components/ui/AutoTextarea';
import { HelpTooltip } from '../../../components/ui/HelpTooltip';
import { IN, LABEL, BTN_SALVAR, BTN_CANCELAR, fmtBRL, fmtHora } from './ui';

const VAZIO = {
  nome: '', unidade: 'unidade', preco_compra: 0, quantidade_adquirida: '1', rendimento: '',
  base_calculo: 'por_unidade' as BaseCalculoConsumivel,
  vida_horas: 0, periodicidade_meses: 0, consumo_hora: '', custo_hora_manual: 0, observacoes: '',
};

export function ConsumiveisTab({ equipamento, custo }: { equipamento: Equipamento; custo: CustoEquipamento }) {
  const { data: todos = [], criar, atualizar, deletar, isSaving } = useConsumiveis();
  const { confirmar, ConfirmModal } = useConfirm();
  const itens = todos.filter(c => c.equipamento_id === equipamento.id);

  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ ...VAZIO });
  const set = <K extends keyof typeof VAZIO>(k: K, v: (typeof VAZIO)[K]) => setF(p => ({ ...p, [k]: v }));

  function novo() { setEditId(null); setF({ ...VAZIO }); setAberto(true); }
  function editar(c: Consumivel) {
    setEditId(c.id);
    setF({
      nome: c.nome, unidade: c.unidade, preco_compra: Number(c.preco_compra),
      quantidade_adquirida: String(c.quantidade_adquirida),
      rendimento: c.rendimento != null ? String(c.rendimento) : '',
      base_calculo: c.base_calculo,
      vida_horas: Number(c.vida_horas ?? 0), periodicidade_meses: Number(c.periodicidade_meses ?? 0),
      consumo_hora: c.consumo_hora != null ? String(c.consumo_hora) : '',
      custo_hora_manual: Number(c.custo_hora_manual ?? 0), observacoes: c.observacoes ?? '',
    });
    setAberto(true);
  }
  function fechar() { setAberto(false); setEditId(null); setF({ ...VAZIO }); }

  function montar(): Partial<Consumivel> {
    return {
      equipamento_id: equipamento.id,
      nome: f.nome.trim(), unidade: f.unidade,
      preco_compra: f.preco_compra,
      quantidade_adquirida: parseFloat(f.quantidade_adquirida) || 1,
      rendimento: parseFloat(f.rendimento) || null,
      base_calculo: f.base_calculo,
      vida_horas: f.base_calculo === 'vida_horas' ? (f.vida_horas || null) : null,
      periodicidade_meses: f.base_calculo === 'periodicidade' ? (f.periodicidade_meses || null) : null,
      consumo_hora: f.base_calculo === 'consumo_hora' ? (parseFloat(f.consumo_hora) || null) : null,
      custo_hora_manual: f.base_calculo === 'manual_hora' ? (f.custo_hora_manual || null) : null,
      observacoes: f.observacoes.trim() || null,
    };
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim()) return;
    if (editId) await atualizar({ id: editId, dados: montar() });
    else await criar({ ...montar(), ativo: true });
    fechar();
  }

  // Prévia ao vivo com a mesma regra do cálculo oficial
  const previa = calcConsumivel({ id: 'p', ...(montar() as any), ativo: true }, custo.horasMes);

  return (
    <>
      <ConfirmModal />
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-gray-500 max-w-2xl flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            Cadastre só o que essa máquina usa. Itens marcados <strong className="text-gray-300">"cobrado por consumo"</strong> (ex: tinta
            calculada no orçamento) ficam fora do custo por hora, pra não serem cobrados duas vezes.
          </p>
          {!aberto && (
            <button onClick={novo} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Novo consumível
            </button>
          )}
        </div>

        {aberto && (
          <form onSubmit={salvar} className="bg-[#111827] border border-gray-700 rounded-xl p-3 space-y-3">
            <p className="text-[10px] font-bold text-blue-400 uppercase">{editId ? 'Editando consumível' : 'Novo consumível'}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className={LABEL}>Nome *</label>
                <input required value={f.nome} onChange={e => set('nome', e.target.value)} className={IN + ' w-full'} placeholder="Ex: Agulha, Teflon, Toner..." />
              </div>
              <div style={{ width: 110 }}>
                <label className={LABEL}>Unidade</label>
                <DarkSelect size="sm" value={f.unidade} onChange={v => set('unidade', v)} allowEmpty={false} options={UNIDADES_CONSUMO} />
              </div>
              <div>
                <label className={LABEL}>Preço de compra</label>
                <MoneyInput value={f.preco_compra} onChange={v => set('preco_compra', v)} className={IN} style={{ width: 100 }} placeholder="0,00" />
              </div>
              <div>
                <label className={LABEL}>Qtd. comprada</label>
                <QtdInput value={f.quantidade_adquirida} onChange={v => set('quantidade_adquirida', v)} className={IN} style={{ width: 70 }} />
              </div>
              <div>
                <label className={LABEL + ' flex items-center gap-1'}>
                  Rendimento
                  <HelpTooltip texto="Quantas unidades de consumo cada unidade comprada rende (ex: um toner rende 1.000 páginas, um frasco de 100 ml rende 100 ml). Sem rendimento não dá pra calcular o custo por unidade de consumo." />
                </label>
                <QtdInput value={f.rendimento} onChange={v => set('rendimento', v)} className={IN} style={{ width: 80 }} placeholder="opcional" />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div style={{ width: 250 }}>
                <label className={LABEL + ' flex items-center gap-1'}>
                  Como entra no custo/hora
                  <HelpTooltip texto="Escolha a regra que combina com o item: peça que dura X horas (agulha, teflon), troca periódica, consumo por hora, valor por hora fixo — ou 'cobrado por consumo' se o orçamento já calcula esse material e ele não deve entrar de novo no custo da máquina." />
                </label>
                <DarkSelect size="sm" value={f.base_calculo} onChange={v => set('base_calculo', v as BaseCalculoConsumivel)} allowEmpty={false}
                  options={(Object.keys(BASE_CALCULO_LABEL) as BaseCalculoConsumivel[]).map(k => ({ value: k, label: BASE_CALCULO_LABEL[k] }))} />
              </div>
              {f.base_calculo === 'vida_horas' && (
                <div><label className={LABEL}>Dura (horas)</label>
                  <InteiroInput value={f.vida_horas} onChange={v => set('vida_horas', v)} className={IN + ' text-center'} /></div>
              )}
              {f.base_calculo === 'periodicidade' && (
                <div><label className={LABEL}>Troca a cada (meses)</label>
                  <InteiroInput value={f.periodicidade_meses} onChange={v => set('periodicidade_meses', v)} max={120} className={IN + ' text-center'} /></div>
              )}
              {f.base_calculo === 'consumo_hora' && (
                <div><label className={LABEL}>Consumo por hora ({f.unidade})</label>
                  <QtdInput value={f.consumo_hora} onChange={v => set('consumo_hora', v)} className={IN} style={{ width: 90 }} /></div>
              )}
              {f.base_calculo === 'manual_hora' && (
                <div><label className={LABEL}>Custo por hora</label>
                  <MoneyInput value={f.custo_hora_manual} onChange={v => set('custo_hora_manual', v)} className={IN} style={{ width: 100 }} placeholder="0,00" /></div>
              )}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-1.5">
                <p className="text-[9px] text-gray-500 uppercase font-bold">No custo/hora</p>
                <p className="text-sm font-black text-purple-300">{previa.foraDoCustoHora ? 'fora' : fmtHora(previa.porHora)}</p>
              </div>
              {previa.custoPorUso != null && (
                <div className="bg-gray-700/30 border border-gray-700 rounded-lg px-3 py-1.5">
                  <p className="text-[9px] text-gray-500 uppercase font-bold">Custo por {f.unidade}</p>
                  <p className="text-sm font-black text-gray-200">{fmtHora(previa.custoPorUso)}</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-500">Regra: {previa.regra}</p>

            <div>
              <label className={LABEL}>Observações</label>
              <AutoTextarea value={f.observacoes} onChange={v => set('observacoes', v)} className={IN + ' w-full'} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={fechar} className={BTN_CANCELAR}>Cancelar</button>
              <button type="submit" disabled={isSaving || !f.nome.trim()} className={BTN_SALVAR}>{editId ? 'Salvar' : 'Adicionar'}</button>
            </div>
          </form>
        )}

        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                  <th className="px-3 py-2 text-left">Consumível</th>
                  <th className="px-3 py-2 text-right">Compra</th>
                  <th className="px-3 py-2 text-left">Regra</th>
                  <th className="px-3 py-2 text-right">R$/hora</th>
                  <th className="px-3 py-2 text-center">Ativo</th>
                  <th className="px-3 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-600">Nenhum consumível cadastrado para este equipamento.</td></tr>
                )}
                {itens.map(c => {
                  const calc = calcConsumivel(c, custo.horasMes);
                  return (
                    <tr key={c.id} className={`border-b border-gray-800 ${c.ativo ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-white">{c.nome}</p>
                        <p className="text-[10px] text-gray-500">{BASE_CALCULO_LABEL[c.base_calculo]}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {fmtBRL(Number(c.preco_compra))}
                        <span className="text-[10px] text-gray-500"> / {c.quantidade_adquirida} {c.unidade}</span>
                      </td>
                      <td className="px-3 py-2 text-[10px] text-gray-500 max-w-[260px]">{calc.regra}</td>
                      <td className="px-3 py-2 text-right font-bold text-purple-300">
                        {calc.foraDoCustoHora ? <span className="text-gray-500 font-normal">fora</span> : fmtHora(calc.porHora)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => atualizar({ id: c.id, dados: { ativo: !c.ativo } })}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                          }`}>{c.ativo ? 'Ativo' : 'Inativo'}</button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => editar(c)} title="Editar"
                            className="w-6 h-6 flex items-center justify-center rounded-md bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={async () => { if (await confirmar(`Remover "${c.nome}"?`, 'Remover consumível')) deletar(c.id); }} title="Excluir"
                            className="w-6 h-6 flex items-center justify-center rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {itens.length > 0 && (
                <tfoot>
                  <tr className="border-t border-purple-500/20 bg-purple-900/10">
                    <td colSpan={3} className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Consumíveis no custo/hora</td>
                    <td className="px-3 py-2 text-right font-black text-purple-300">{fmtHora(custo.hora.consumiveis)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
