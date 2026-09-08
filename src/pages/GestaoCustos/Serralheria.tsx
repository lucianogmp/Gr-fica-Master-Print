// src/pages/GestaoCustos/Serralheria.tsx
import { useState, useEffect } from 'react';
import { useMetalonTipos, MetalonTipo } from '../../hooks/useMetalonTipos';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { MedidaInput } from '../../components/ui/MedidaInput';
import { PctInput } from '../../components/ui/PctInput';
import { Wrench, Plus, X, Pencil } from 'lucide-react';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

const METALON_VAZIO = { nome: '', custo_por_metro: 0 as number, ativo: true };

export function Serralheria() {
  const { data: metalons = [], criar, atualizar, deletar } = useMetalonTipos();
  const { data: config, salvar, isSaving } = useConfiguracoes();
  const { confirmar, ConfirmModal } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...METALON_VAZIO });
  const [salvandoMetalon, setSalvandoMetalon] = useState(false);

  // Config de mão de obra — carrega da tabela `configuracoes` (linha única)
  const [maoObraSerralheriaPct, setMaoObraSerralheriaPct]         = useState(30);
  const [maoObraInstalacaoEsticar, setMaoObraInstalacaoEsticar]   = useState(50);
  const [maoObraInstalacaoCompleta, setMaoObraInstalacaoCompleta] = useState(100);
  const [espacamentoPadrao, setEspacamentoPadrao]                 = useState(1.0);

  useEffect(() => {
    if (!config) return;
    setMaoObraSerralheriaPct(Number(config.mao_obra_serralheria_pct ?? 30));
    setMaoObraInstalacaoEsticar(Number(config.mao_obra_instalacao_esticar ?? 50));
    setMaoObraInstalacaoCompleta(Number(config.mao_obra_instalacao_completa ?? 100));
    setEspacamentoPadrao(Number(config.espacamento_travessa_padrao_m ?? 1.0));
  }, [config]);

  async function handleSalvarConfig() {
    await salvar({
      mao_obra_serralheria_pct: maoObraSerralheriaPct,
      mao_obra_instalacao_esticar: maoObraInstalacaoEsticar,
      mao_obra_instalacao_completa: maoObraInstalacaoCompleta,
      espacamento_travessa_padrao_m: espacamentoPadrao,
    });
  }

  function abrirNovo() {
    setEditandoId(null);
    setForm({ ...METALON_VAZIO });
    setShowForm(true);
  }
  function abrirEdicao(m: MetalonTipo) {
    setEditandoId(m.id);
    setForm({ nome: m.nome, custo_por_metro: Number(m.custo_por_metro) || 0, ativo: m.ativo });
    setShowForm(true);
  }
  function fecharForm() {
    setShowForm(false);
    setEditandoId(null);
    setForm({ ...METALON_VAZIO });
  }

  async function handleSalvarMetalon(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvandoMetalon(true);
    try {
      if (editandoId) {
        await atualizar({ id: editandoId, dados: form });
      } else {
        await criar(form);
      }
      fecharForm();
    } finally {
      setSalvandoMetalon(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <ConfirmModal />
      <div>
        <h1 className="text-xl font-black text-white flex items-center gap-2">
          <Wrench className="w-5 h-5 text-blue-400" /> Serralheria
        </h1>
        <p className="text-gray-500 text-sm">Metalons, mão de obra e regras usadas no Orçamento de Placas</p>
      </div>

      {/* Configuração oficial de mão de obra — item 6/9/12 da especificação:
          um único lugar pra esses valores, sem percentuais soltos na tela
          de orçamento. */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Mão de obra e estrutura</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={LABEL}>Mão de obra serralheria (%)</label>
            <PctInput className={IN} value={maoObraSerralheriaPct} onChange={setMaoObraSerralheriaPct} center={false} />
            <p className="text-[10px] text-gray-600 mt-1">% sobre o custo do metalon usado</p>
          </div>
          <div>
            <label className={LABEL}>Instalação — só esticar lona (R$)</label>
            <MoneyInput value={maoObraInstalacaoEsticar} onChange={setMaoObraInstalacaoEsticar} className={IN} />
          </div>
          <div>
            <label className={LABEL}>Instalação — completa (R$)</label>
            <MoneyInput value={maoObraInstalacaoCompleta} onChange={setMaoObraInstalacaoCompleta} className={IN} />
          </div>
          <div>
            <label className={LABEL}>Espaçamento padrão de travessa (m)</label>
            <MedidaInput className={IN} value={espacamentoPadrao} onChange={setEspacamentoPadrao} />
            <p className="text-[10px] text-gray-600 mt-1">Sugestão inicial — ajustável em cada orçamento</p>
          </div>
        </div>
        <button onClick={handleSalvarConfig} disabled={isSaving}
          className="mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
          {isSaving ? 'Salvando...' : 'Salvar configuração'}
        </button>
      </div>

      {/* Cadastro de metalons */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase">Tipos de metalon</h3>
          {!showForm && (
            <button onClick={abrirNovo}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Novo metalon
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSalvarMetalon} className="bg-[#111827] border border-gray-800 rounded-xl p-4 mb-4 flex gap-3 items-end">
            <div className="flex-1">
              <label className={LABEL}>Nome *</label>
              <input autoFocus value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className={IN} placeholder="Ex: Metalon 20×20" />
            </div>
            <div className="w-40">
              <label className={LABEL}>Custo por metro (R$)</label>
              <MoneyInput value={form.custo_por_metro}
                onChange={v => setForm(f => ({ ...f, custo_por_metro: v }))} className={IN} />
            </div>
            <button type="submit" disabled={salvandoMetalon || !form.nome.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
              {salvandoMetalon ? 'Salvando...' : editandoId ? 'Salvar' : 'Adicionar'}
            </button>
            <button type="button" onClick={fecharForm}
              className="text-gray-500 hover:text-white w-10 h-10 flex items-center justify-center rounded-lg bg-gray-800">
              <X className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-right">Custo/metro</th>
                <th className="px-5 py-3 text-center">Ativo</th>
                <th className="px-5 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {metalons.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-600">Nenhum metalon cadastrado.</td></tr>
              )}
              {metalons.map(m => (
                <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="px-5 py-3 font-medium text-white">{m.nome}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{fmtBRL(m.custo_por_metro)}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => atualizar({ id: m.id, dados: { ativo: !m.ativo } })}
                      className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${m.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
                      {m.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => abrirEdicao(m)} className="text-gray-500 hover:text-blue-400"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={async () => { if (await confirmar(`Remover "${m.nome}"?`)) deletar(m.id); }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30">
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
