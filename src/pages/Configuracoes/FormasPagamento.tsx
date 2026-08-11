// src/pages/Configuracoes/FormasPagamento.tsx
// Conteúdo da aba "Vendas" do Configuracoes.tsx original
// + Gestão de contas bancárias (useContasBancarias)
import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { useContasBancarias, TIPO_CONTA, TipoConta } from '../../hooks/useContasBancarias';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { Configuracoes as ConfigType } from '../../types/configuracoes';
import { AbaVendas } from '../../components/configuracoes/AbaVendas';
import { CreditCard, Building2, Plus, X, Pencil, Save, Check } from 'lucide-react';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { IN, IN_N, Lbl, Section, Row } from './utils';

const FORM_CONTA_VAZIO = { nome: '', tipo: 'caixa' as TipoConta, banco: '', agencia: '', conta: '', saldo_inicial: 0 as number, observacoes: '' };

export function FormasPagamento() {
  const { data: cfg, isLoading, salvar, isSaving } = useConfiguracoes();
  const { data: contas = [], criar, atualizar, deletar, isSaving: salvandoConta } = useContasBancarias();
  const { confirmar, ConfirmModal } = useConfirm();

  const [form, setForm] = useState<Partial<ConfigType>>({});
  const [dirty, setDirty] = useState(false);
  const [showFormConta, setShowFormConta] = useState(false);
  const [editandoContaId, setEditandoContaId] = useState<string | null>(null);
  const [formConta, setFormConta] = useState({ ...FORM_CONTA_VAZIO });

  useEffect(() => { if (cfg) { setForm(cfg); setDirty(false); } }, [cfg]);

  function set(field: keyof ConfigType, val: any) { setForm(f => ({ ...f, [field]: val })); setDirty(true); }

  async function handleSalvar() {
    const { id: _id, updated_at: _u, ...payload } = form as any;
    await salvar(payload);
    setDirty(false);
  }

  function abrirNovaConta() {
    setEditandoContaId(null);
    setFormConta({ ...FORM_CONTA_VAZIO });
    setShowFormConta(true);
  }

  function abrirEdicaoConta(c: typeof contas[0]) {
    setEditandoContaId(c.id);
    setFormConta({
      nome:           c.nome,
      tipo:           c.tipo,
      banco:          c.banco ?? '',
      agencia:        c.agencia ?? '',
      conta:          c.conta ?? '',
      saldo_inicial:  Number(c.saldo_inicial) || 0,
      observacoes:    c.observacoes ?? '',
    });
    setShowFormConta(true);
  }

  async function handleSalvarConta(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      nome:          formConta.nome,
      tipo:          formConta.tipo,
      banco:         formConta.banco || null,
      agencia:       formConta.agencia || null,
      conta:         formConta.conta || null,
      saldo_inicial: formConta.saldo_inicial || 0,
      observacoes:   formConta.observacoes || null,
      ativo:         true,
      ordem:         editandoContaId ? contas.find(c => c.id === editandoContaId)?.ordem ?? 0 : contas.length + 1,
    };
    if (editandoContaId) {
      await atualizar({ id: editandoContaId, payload });
    } else {
      await criar(payload);
    }
    setShowFormConta(false);
    setEditandoContaId(null);
    setFormConta({ ...FORM_CONTA_VAZIO });
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-400" /> Formas de Pagamento
            </h1>
            <p className="text-gray-500 text-sm">Configurações de pagamento e contas bancárias</p>
          </div>
          <button onClick={handleSalvar} disabled={isSaving || !dirty}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            {dirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            {isSaving ? 'Salvando...' : dirty ? 'Salvar' : 'Salvo'}
          </button>
        </div>

        {/* Formas de pagamento e parcelamento (AbaVendas existente) */}
        <AbaVendas form={form} set={set} />

        {/* Contas bancárias */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" /> Contas Bancárias
            </h2>
            <button onClick={() => showFormConta ? setShowFormConta(false) : abrirNovaConta()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              {showFormConta ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Nova Conta</>}
            </button>
          </div>

          {showFormConta && (
            <form onSubmit={handleSalvarConta} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
              {editandoContaId && (
                <p className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Editando conta
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Lbl>Nome *</Lbl>
                  <input required value={formConta.nome} onChange={e => setFormConta(f => ({ ...f, nome: e.target.value }))}
                    className={IN} placeholder="Ex: Bradesco CC, Caixa, PIX..." />
                </div>
                <div>
                  <Lbl>Tipo *</Lbl>
                  <DarkSelect
                    value={formConta.tipo}
                    onChange={v => setFormConta(f => ({ ...f, tipo: v as TipoConta }))}
                    allowEmpty={false}
                    options={Object.entries(TIPO_CONTA).map(([k, v]) => ({ value: k, label: v.label }))}
                  />
                </div>
                <div>
                  <Lbl>Saldo Inicial (R$)</Lbl>
                  <MoneyInput value={formConta.saldo_inicial}
                    onChange={v => setFormConta(f => ({ ...f, saldo_inicial: v }))} className={IN} placeholder="0,00" />
                </div>
                <div>
                  <Lbl>Banco</Lbl>
                  <input value={formConta.banco} onChange={e => setFormConta(f => ({ ...f, banco: e.target.value }))}
                    className={IN} placeholder="Ex: Bradesco, Nubank..." />
                </div>
                <div>
                  <Lbl>Agência</Lbl>
                  <input value={formConta.agencia} onChange={e => setFormConta(f => ({ ...f, agencia: e.target.value }))} className={IN} />
                </div>
                <div>
                  <Lbl>Conta</Lbl>
                  <input value={formConta.conta} onChange={e => setFormConta(f => ({ ...f, conta: e.target.value }))} className={IN} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {editandoContaId && (
                  <button type="button" onClick={() => { setShowFormConta(false); setEditandoContaId(null); }}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 transition-all">
                    Cancelar
                  </button>
                )}
                <button type="submit" disabled={salvandoConta}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
                  {salvandoConta ? 'Salvando...' : editandoContaId ? 'Salvar Alterações' : 'Criar Conta'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                  <th className="px-5 py-3 text-left">Nome</th>
                  <th className="px-5 py-3 text-left">Tipo</th>
                  <th className="px-5 py-3 text-left">Banco</th>
                  <th className="px-5 py-3 text-right">Saldo Inicial</th>
                  <th className="px-5 py-3 text-center">Ativo</th>
                  <th className="px-5 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contas.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhuma conta cadastrada.</td></tr>
                )}
                {contas.map(c => {
                  const info = TIPO_CONTA[c.tipo] ?? TIPO_CONTA.outro;
                  return (
                    <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-white">{c.nome}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.bg} ${info.cor}`}>{info.label}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{c.banco || '—'}</td>
                      <td className="px-5 py-3 text-right text-gray-300">
                        {Number(c.saldo_inicial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button onClick={() => atualizar({ id: c.id, payload: { ativo: !c.ativo } as any })}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            c.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                          }`}>
                          {c.ativo ? 'Ativa' : 'Inativa'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => abrirEdicaoConta(c)}
                            className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={async () => { if (await confirmar(`Remover "${c.nome}"?`, 'Remover Conta')) deletar(c.id); }}
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
        </div>

        {dirty && (
          <div className="fixed bottom-6 right-6 z-40">
            <button onClick={handleSalvar} disabled={isSaving}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl transition-all flex items-center gap-2">
              <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
