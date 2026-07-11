// src/pages/GestaoCustos/Depreciacao.tsx
import { useState } from 'react';
import { useDepreciacao } from '../../hooks/useGestaoBase';
import { useGestaoCustos } from '../../hooks/useGestaoCustos';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { KpiCard } from '../../components/ui/KpiCard';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { TrendingDown, Plus, X, Pencil, Timer } from 'lucide-react';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

const FORM_VAZIO = { nome: '', categoria: '', valor: 0 as number, vida_util_anos: '', data_aquisicao: '', observacoes: '' };

export function Depreciacao() {
  const { data: deprs = [], criar, atualizar, deletar } = useDepreciacao();
  const { data: gc } = useGestaoCustos();
  const { confirmar, ConfirmModal } = useConfirm();

  const [showForm, setShowForm]     = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm]             = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando]     = useState(false);

  const totalDeprMes = deprs.reduce((s, d) => {
    const meses = Number(d.vida_util_anos) * 12;
    return s + (meses > 0 ? Number(d.valor) / meses : 0);
  }, 0);

  function abrirNovo() {
    setEditandoId(null);
    setForm({ ...FORM_VAZIO });
    setShowForm(true);
  }

  function abrirEdicao(d: typeof deprs[0]) {
    setEditandoId(d.id);
    setForm({
      nome:           d.nome,
      categoria:      d.categoria ?? '',
      valor:          Number(d.valor) || 0,
      vida_util_anos: String(d.vida_util_anos),
      data_aquisicao: d.data_aquisicao ?? '',
      observacoes:    d.observacoes ?? '',
    });
    setShowForm(true);
  }

  function fecharForm() {
    setShowForm(false);
    setEditandoId(null);
    setForm({ ...FORM_VAZIO });
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.valor || !form.vida_util_anos) return;
    setSalvando(true);
    try {
      const payload = {
        nome:           form.nome.trim(),
        categoria:      form.categoria || null,
        valor:          form.valor,
        vida_util_anos: parseFloat(form.vida_util_anos),
        data_aquisicao: form.data_aquisicao || null,
        observacoes:    form.observacoes || null,
      } as any;

      if (editandoId) {
        await atualizar({ id: editandoId, dados: payload });
      } else {
        await criar(payload);
      }
      fecharForm();
    } finally { setSalvando(false); }
  }

  function setF(campo: Exclude<keyof typeof FORM_VAZIO, 'valor'>, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }
  function setValor(valor: number) {
    setForm(f => ({ ...f, valor }));
  }

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-yellow-400" /> Depreciação
            </h1>
            <p className="text-gray-500 text-sm">{deprs.length} ativo(s) cadastrado(s)</p>
          </div>
          <button onClick={() => showForm ? fecharForm() : abrirNovo()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2">
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Ativo</>}
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <form onSubmit={handleSalvar} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
            {editandoId && (
              <p className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Editando ativo
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className={LABEL}>Nome *</label>
                <input required value={form.nome} onChange={e => setF('nome', e.target.value)}
                  className={IN} placeholder="Ex: Plotter Roland" />
              </div>
              <div>
                <label className={LABEL}>Valor de compra (R$) *</label>
                <MoneyInput required value={form.valor}
                  onChange={setValor} className={IN} placeholder="0,00" />
              </div>
              <div>
                <label className={LABEL}>Vida útil (anos) *</label>
                <input required type="number" min="1" step="1" value={form.vida_util_anos}
                  onChange={e => setF('vida_util_anos', e.target.value)} className={IN} placeholder="5" />
              </div>
              <div>
                <label className={LABEL}>Categoria</label>
                <input value={form.categoria} onChange={e => setF('categoria', e.target.value)}
                  className={IN} placeholder="Ex: Equipamento" />
              </div>
              <div>
                <label className={LABEL}>Data de aquisição</label>
                <input type="date" value={form.data_aquisicao} onChange={e => setF('data_aquisicao', e.target.value)}
                  className={IN} />
              </div>
              {form.valor && form.vida_util_anos && (
                <div className="flex items-end">
                  <div className="w-full bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Depr./mês calculada</p>
                    <p className="text-lg font-black text-yellow-400">
                      {fmtBRL(form.valor / (parseFloat(form.vida_util_anos) * 12))}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className={LABEL}>Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)}
                className={IN + ' resize-none'} />
            </div>
            <div className="flex justify-end gap-2">
              {editandoId && (
                <button type="button" onClick={fecharForm}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 transition-all">
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={salvando}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
                {salvando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Criar Ativo'}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard label="Depreciação/mês"  value={fmtBRL(totalDeprMes)} icon={TrendingDown} color="text-yellow-400" />
          <KpiCard label="Total em ativos"  value={fmtBRL(deprs.reduce((s, d) => s + Number(d.valor), 0))} icon={TrendingDown} color="text-gray-400" />
          <KpiCard label="Overhead/hora"    value={fmtBRL(gc?.porHora ?? 0)} icon={Timer} color="text-purple-400" />
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Categoria</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3 text-center">Vida útil</th>
                <th className="px-5 py-3 text-right">Depr./mês</th>
                <th className="px-5 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {deprs.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhum ativo cadastrado.</td></tr>
              )}
              {deprs.map(d => {
                const deprMes = Number(d.valor) / (Number(d.vida_util_anos) * 12);
                return (
                  <tr key={d.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-white">{d.nome}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{d.categoria || '—'}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{fmtBRL(Number(d.valor))}</td>
                    <td className="px-5 py-3 text-center text-gray-400 text-xs">{d.vida_util_anos} anos</td>
                    <td className="px-5 py-3 text-right font-bold text-yellow-400">{fmtBRL(deprMes)}</td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => abrirEdicao(d)}
                          className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all"
                          title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => { if (await confirmar(`Remover "${d.nome}"?`, 'Remover Ativo')) deletar(d.id); }}
                          className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all"
                          title="Excluir">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {deprs.length > 0 && (
              <tfoot>
                <tr className="border-t border-yellow-500/20 bg-yellow-900/10">
                  <td colSpan={4} className="px-5 py-2.5 text-right text-xs font-bold text-gray-500 uppercase">Total depr./mês</td>
                  <td className="px-5 py-2.5 text-right font-black text-yellow-400">{fmtBRL(totalDeprMes)}</td>
                  <td />
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
