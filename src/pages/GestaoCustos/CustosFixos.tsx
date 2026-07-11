// src/pages/GestaoCustos/CustosFixos.tsx
import { useState } from 'react';
import { useCustosFixos } from '../../hooks/useGestaoBase';
import { useGestaoCustos } from '../../hooks/useGestaoCustos';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { KpiCard } from '../../components/ui/KpiCard';
import { Building2, Plus, DollarSign, Pencil, X } from 'lucide-react';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

const FORM_VAZIO = { nome: '', categoria: '', valor_mensal: '', ativo: true, observacoes: '' };

export function CustosFixos() {
  const { data: fixos = [], criar, atualizar, deletar } = useCustosFixos();
  const { data: gc } = useGestaoCustos();
  const { confirmar, ConfirmModal } = useConfirm();

  const [showForm, setShowForm]   = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm]           = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando]   = useState(false);

  const totalAtivo = fixos.filter(f => f.ativo).reduce((s, f) => s + Number(f.valor_mensal), 0);

  function abrirNovo() {
    setEditandoId(null);
    setForm({ ...FORM_VAZIO });
    setShowForm(true);
  }

  function abrirEdicao(f: typeof fixos[0]) {
    setEditandoId(f.id);
    setForm({
      nome:         f.nome,
      categoria:    f.categoria ?? '',
      valor_mensal: String(f.valor_mensal),
      ativo:        f.ativo,
      observacoes:  f.observacoes ?? '',
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
    if (!form.nome || !form.valor_mensal) return;
    setSalvando(true);
    try {
      const payload = {
        nome:         form.nome.trim(),
        categoria:    form.categoria || null,
        valor_mensal: parseFloat(form.valor_mensal),
        ativo:        form.ativo,
        observacoes:  form.observacoes || null,
      } as any;

      if (editandoId) {
        await atualizar({ id: editandoId, dados: payload });
      } else {
        await criar(payload);
      }
      fecharForm();
    } finally { setSalvando(false); }
  }

  function setF(campo: keyof typeof FORM_VAZIO, valor: any) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-400" /> Custos Fixos
            </h1>
            <p className="text-gray-500 text-sm">{fixos.length} custo(s) cadastrado(s)</p>
          </div>
          <button onClick={() => showForm ? fecharForm() : abrirNovo()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2">
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Custo Fixo</>}
          </button>
        </div>

        {/* Formulário (criar ou editar) */}
        {showForm && (
          <form onSubmit={handleSalvar} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
            {editandoId && (
              <p className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Editando custo fixo
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className={LABEL}>Nome *</label>
                <input required value={form.nome} onChange={e => setF('nome', e.target.value)} className={IN} placeholder="Ex: Aluguel do galpão" />
              </div>
              <div>
                <label className={LABEL}>Categoria</label>
                <input value={form.categoria} onChange={e => setF('categoria', e.target.value)} className={IN} placeholder="Ex: Infraestrutura" />
              </div>
              <div>
                <label className={LABEL}>Valor/mês (R$) *</label>
                <input required type="number" min="0" step="0.01" value={form.valor_mensal}
                  onChange={e => setF('valor_mensal', e.target.value)} className={IN} placeholder="0,00" />
              </div>
            </div>
            <div>
              <label className={LABEL}>Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} className={IN + ' resize-none'} />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.ativo} onChange={e => setF('ativo', e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500" />
                <span className="text-sm text-gray-300 font-medium">Ativo (entra no cálculo do overhead)</span>
              </label>
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
                {salvando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Criar Custo Fixo'}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard label="Total ativos/mês"   value={fmtBRL(totalAtivo)}    icon={Building2}  color="text-blue-400" />
          <KpiCard label="Overhead total/mês" value={fmtBRL(gc?.total ?? 0)} icon={DollarSign} color="text-red-400" />
          <KpiCard label="Overhead/hora"      value={fmtBRL(gc?.porHora ?? 0)} icon={DollarSign} color="text-purple-400" />
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Categoria</th>
                <th className="px-5 py-3 text-right">Valor/mês</th>
                <th className="px-5 py-3 text-center">Ativo</th>
                <th className="px-5 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {fixos.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-600">Nenhum custo fixo cadastrado.</td></tr>
              )}
              {fixos.map(f => (
                <tr key={f.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{f.nome}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{f.categoria || '—'}</td>
                  <td className="px-5 py-3 text-right font-bold text-red-400">{fmtBRL(f.valor_mensal)}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => atualizar({ id: f.id, dados: { ativo: !f.ativo } as any })}
                      className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                        f.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                      }`}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex gap-1.5 justify-center">
                      <button onClick={() => abrirEdicao(f)}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all"
                        title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={async () => { if (await confirmar(`Remover "${f.nome}"?`, 'Remover Custo')) deletar(f.id); }}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all"
                        title="Excluir">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {fixos.length > 0 && (
              <tfoot>
                <tr className="border-t border-blue-500/20 bg-blue-900/10">
                  <td colSpan={2} className="px-5 py-2.5 text-right text-xs font-bold text-gray-500 uppercase">Total ativo/mês</td>
                  <td className="px-5 py-2.5 text-right font-black text-blue-400">{fmtBRL(totalAtivo)}</td>
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
