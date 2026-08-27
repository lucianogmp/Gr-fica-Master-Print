// src/pages/GestaoCustos/CustosVariaveis.tsx
import { useState, useMemo } from 'react';
import { useCustosVariaveis } from '../../hooks/useGestaoBase';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { KpiCard } from '../../components/ui/KpiCard';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { GitCompare, Plus, X, Pencil, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const FORM_VAZIO = { nome: '', categoria: '', valor: 0 as number, observacoes: '' };

export function CustosVariaveis() {
  const hoje = new Date();
  const [mes, setMes] = useState(() => hoje.toISOString().slice(0, 7));

  const { data: custos = [], criar, atualizar, deletar, isSaving } = useCustosVariaveis(mes);
  const { confirmar, ConfirmModal } = useConfirm();

  const [showForm, setShowForm]     = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm]             = useState({ ...FORM_VAZIO });

  const totalMes = custos.reduce((s, c) => s + Number(c.valor), 0);

  // Navegar entre meses
  function mudarMes(delta: number) {
    const [ano, m] = mes.split('-').map(Number);
    const d = new Date(ano, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const [anoStr, mesStr] = mes.split('-');
  const labelMes = `${MESES[Number(mesStr) - 1]} ${anoStr}`;

  function abrirNovo() {
    setEditandoId(null);
    setForm({ ...FORM_VAZIO });
    setShowForm(true);
  }

  function abrirEdicao(c: typeof custos[0]) {
    setEditandoId(c.id);
    setForm({
      nome:        c.nome,
      categoria:   c.categoria ?? '',
      valor:       Number(c.valor) || 0,
      observacoes: c.observacoes ?? '',
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
    if (!form.nome || !form.valor) return;
    const payload = {
      nome:           form.nome.trim(),
      categoria:      form.categoria || null,
      valor:          form.valor,
      mes_referencia: mes,
      observacoes:    form.observacoes || null,
    };
    if (editandoId) {
      await atualizar({ id: editandoId, dados: payload });
    } else {
      await criar(payload);
    }
    fecharForm();
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
              <GitCompare className="w-6 h-6 text-blue-400" /> Custos Variáveis
              <HelpTooltip texto="Diferente de Custos Fixos e Depreciação, o que você lança aqui NÃO entra automático no cálculo de Overhead/hora usado no custo dos produtos — é só pra você acompanhar/registrar gastos que mudam de mês a mês (energia, freelancer, etc)." />
            </h1>
            <p className="text-gray-500 text-sm">Custos que variam mês a mês (energia, freelancers, etc)</p>
          </div>
          <button onClick={() => showForm ? fecharForm() : abrirNovo()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2">
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Custo</>}
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <form onSubmit={handleSalvar} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
            {editandoId && (
              <p className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Editando custo variável
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className={LABEL}>Nome *</label>
                <input required value={form.nome} onChange={e => setF('nome', e.target.value)}
                  className={IN} placeholder="Ex: Energia elétrica" />
              </div>
              <div>
                <label className={LABEL}>Categoria</label>
                <input value={form.categoria} onChange={e => setF('categoria', e.target.value)}
                  className={IN} placeholder="Ex: Utilidades" />
              </div>
              <div>
                <label className={LABEL}>Valor (R$) *</label>
                <MoneyInput required value={form.valor}
                  onChange={setValor} className={IN} placeholder="0,00" />
              </div>
            </div>
            <div>
              <label className={LABEL}>Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)}
                className={IN + ' resize-none'} placeholder="Ex: Fatura de julho com ar-condicionado ligado o mês todo" />
            </div>
            <div className="flex justify-end gap-2">
              {editandoId && (
                <button type="button" onClick={fecharForm}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 transition-all">
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={isSaving}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
                {isSaving ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Registrar Custo'}
              </button>
            </div>
          </form>
        )}

        {/* Navegação de mês */}
        <div className="flex items-center justify-center gap-4 bg-[#1f2937] border border-gray-700 rounded-xl p-3">
          <button onClick={() => mudarMes(-1)}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700/50 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-white text-lg w-44 text-center">{labelMes}</span>
          <button onClick={() => mudarMes(1)}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700/50 transition-all">
            <ChevronRight className="w-5 h-5" />
          </button>
          {mes !== hoje.toISOString().slice(0, 7) && (
            <button onClick={() => setMes(hoje.toISOString().slice(0, 7))}
              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 ml-2">
              Mês atual
            </button>
          )}
        </div>

        <KpiCard label={`Total variável — ${labelMes}`} value={fmtBRL(totalMes)} icon={DollarSign} color="text-orange-400" />

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Categoria</th>
                <th className="px-5 py-3 text-left">Observações</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {custos.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-600">
                  Nenhum custo variável registrado em {labelMes}.
                </td></tr>
              )}
              {custos.map(c => (
                <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{c.nome}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{c.categoria || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs max-w-xs truncate">{c.observacoes || '—'}</td>
                  <td className="px-5 py-3 text-right font-bold text-orange-400">{fmtBRL(Number(c.valor))}</td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex gap-1.5 justify-center">
                      <button onClick={() => abrirEdicao(c)}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all"
                        title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={async () => { if (await confirmar(`Remover "${c.nome}"?`, 'Remover')) deletar(c.id); }}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all"
                        title="Excluir">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {custos.length > 0 && (
              <tfoot>
                <tr className="border-t border-orange-500/20 bg-orange-900/10">
                  <td colSpan={3} className="px-5 py-2.5 text-right text-xs font-bold text-gray-500 uppercase">Total do mês</td>
                  <td className="px-5 py-2.5 text-right font-black text-orange-400">{fmtBRL(totalMes)}</td>
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
