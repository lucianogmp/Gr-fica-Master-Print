// src/pages/Financeiro/FluxoCaixa.tsx
import { useState, useMemo } from 'react';
import { useCaixaMovimentos } from '../../hooks/useCaixaMovimentos';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useContasBancarias } from '../../hooks/useContasBancarias';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { KpiCard } from '../../components/ui/KpiCard';
import {
  TrendingUp, ArrowUp, ArrowDown, Wallet, Sparkles,
  ArrowDownToLine, ArrowUpFromLine, Plus, X, Save,
} from 'lucide-react';

const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

const NOVO_MOV = {
  tipo:        'entrada' as 'entrada' | 'saida',
  valor:       '',
  data:        new Date().toISOString().split('T')[0],
  descricao:   '',
  conta_id:    '',
  observacoes: '',
};

export function FluxoCaixa() {
  const { data: movimentos = [], isLoading, criar, deletar, isSaving } = useCaixaMovimentos();
  const { data: lancamentos = [] } = useLancamentos();
  const { data: contas = [] } = useContasBancarias();
  const { confirmar, ConfirmModal } = useConfirm();

  const [mesFx, setMesFx]       = useState(() => new Date().toISOString().slice(0, 7));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]          = useState({ ...NOVO_MOV });

  const contasAtivas = contas.filter(c => c.ativo);

  const movDoMes = useMemo(() =>
    movimentos.filter(m => (m.data ?? '').startsWith(mesFx)),
    [movimentos, mesFx]
  );

  const entradas = movDoMes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const saidas   = movDoMes.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const saldo    = entradas - saidas;

  const hoje    = new Date().toISOString().split('T')[0];
  const receber = lancamentos.filter(l => l.tipo === 'receita' && !['pago','cancelado'].includes(l.status) && (l.data_vencimento ?? '') >= hoje).reduce((s, l) => s + Number(l.valor), 0);
  const pagar   = lancamentos.filter(l => l.tipo === 'despesa' && !['pago','cancelado'].includes(l.status) && (l.data_vencimento ?? '') >= hoje).reduce((s, l) => s + Number(l.valor), 0);

  const porData = useMemo(() => {
    const map: Record<string, typeof movDoMes> = {};
    [...movDoMes].sort((a, b) => b.data.localeCompare(a.data)).forEach(m => {
      if (!map[m.data]) map[m.data] = [];
      map[m.data].push(m);
    });
    return map;
  }, [movDoMes]);

  const datas = Object.keys(porData).sort((a, b) => b.localeCompare(a));

  function setF<K extends keyof typeof NOVO_MOV>(campo: K, valor: typeof NOVO_MOV[K]) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    await criar({
      tipo:        form.tipo,
      valor:       Number(form.valor),
      data:        form.data,
      descricao:   form.descricao || null,
      conta_id:    form.conta_id || null,
      observacoes: form.observacoes || null,
      origem:      'manual',
    });
    setForm({ ...NOVO_MOV });
    setShowModal(false);
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <>
      <ConfirmModal />

      {/* ── Modal movimentação avulsa ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1f2937] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="font-black text-white">Nova Movimentação</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSalvar} className="p-5 space-y-4">

              {/* Tipo: toggle visual */}
              <div>
                <label className={LABEL}>Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => setF('tipo', 'entrada')}
                    className={`py-2.5 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${
                      form.tipo === 'entrada'
                        ? 'bg-green-600 border-green-500 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-green-500/50 hover:text-green-400'
                    }`}>
                    <ArrowDown className="w-4 h-4" /> Entrada
                  </button>
                  <button type="button"
                    onClick={() => setF('tipo', 'saida')}
                    className={`py-2.5 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${
                      form.tipo === 'saida'
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-red-500/50 hover:text-red-400'
                    }`}>
                    <ArrowUp className="w-4 h-4" /> Saída
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Valor *</label>
                  <input
                    required type="number" min="0.01" step="0.01"
                    value={form.valor}
                    onChange={e => setF('valor', e.target.value)}
                    className={IN} placeholder="0,00"
                  />
                </div>
                <div>
                  <label className={LABEL}>Data</label>
                  <input type="date" value={form.data}
                    onChange={e => setF('data', e.target.value)} className={IN} />
                </div>
              </div>

              <div>
                <label className={LABEL}>Conta</label>
                <select value={form.conta_id} onChange={e => setF('conta_id', e.target.value)} className={IN}>
                  <option value="">Selecione uma conta...</option>
                  {contasAtivas.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` — ${c.banco}` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL}>Descrição *</label>
                <input required value={form.descricao}
                  onChange={e => setF('descricao', e.target.value)}
                  className={IN} placeholder="Ex: Sangria, Suprimento de caixa, Pagamento fornecedor..." />
              </div>

              <div>
                <label className={LABEL}>Observações</label>
                <textarea rows={2} value={form.observacoes}
                  onChange={e => setF('observacoes', e.target.value)}
                  className={IN + ' resize-none'} />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all">
                  <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-400" /> Fluxo de Caixa
            </h1>
            <p className="text-gray-500 text-sm">Movimentos de dinheiro físico e avulsos</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="month" value={mesFx} onChange={e => setMesFx(e.target.value)}
              className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30"
            >
              <Plus className="w-4 h-4" /> Movimentação
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Entradas no mês"  value={fmtBRL(entradas)} icon={ArrowUp}    color="text-green-400" />
          <KpiCard label="Saídas no mês"    value={fmtBRL(saidas)}   icon={ArrowDown}  color="text-red-400" />
          <KpiCard label="Saldo do mês"     value={fmtBRL(saldo)}    icon={Wallet}     color={saldo >= 0 ? 'text-blue-400' : 'text-red-400'} />
          <KpiCard label="Saldo projetado"  value={fmtBRL(saldo + receber - pagar)} icon={Sparkles} color="text-purple-400" />
        </div>

        {/* A receber / A pagar */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#1f2937] border border-green-500/20 rounded-xl p-5">
            <p className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <ArrowDownToLine className="w-3.5 h-3.5 text-green-400" /> A receber (pendente)
            </p>
            <p className="text-2xl font-black text-green-400">{fmtBRL(receber)}</p>
          </div>
          <div className="bg-[#1f2937] border border-red-500/20 rounded-xl p-5">
            <p className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <ArrowUpFromLine className="w-3.5 h-3.5 text-red-400" /> A pagar (pendente)
            </p>
            <p className="text-2xl font-black text-red-400">{fmtBRL(pagar)}</p>
          </div>
        </div>

        {/* Lista por data */}
        {datas.length === 0 ? (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center space-y-3">
            <Wallet className="w-10 h-10 text-gray-700 mx-auto" />
            <p className="text-gray-600">Nenhum movimento em {mesFx}.</p>
            <button onClick={() => setShowModal(true)}
              className="text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors">
              + Registrar primeira movimentação
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {datas.map(data => {
              const movs   = porData[data];
              const entDia = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
              const saiDia = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
              return (
                <div key={data} className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 bg-gray-800/40">
                    <span className="text-sm font-bold text-white">{fmtData(data)}</span>
                    <div className="flex gap-4 text-xs">
                      {entDia > 0 && <span className="text-green-400 font-bold">+{fmtBRL(entDia)}</span>}
                      {saiDia > 0 && <span className="text-red-400 font-bold">-{fmtBRL(saiDia)}</span>}
                      <span className={`font-black ${entDia - saiDia >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        = {fmtBRL(entDia - saiDia)}
                      </span>
                    </div>
                  </div>
                  {movs.map(m => {
                    const conta = contas.find(c => c.id === m.conta_id);
                    return (
                      <div key={m.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-800 last:border-b-0 hover:bg-gray-800/20 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`flex-shrink-0 ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                            {m.tipo === 'entrada' ? <ArrowDown className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{m.descricao}</p>
                            <p className="text-[10px] text-gray-500 flex items-center gap-2">
                              {conta && <span className="font-bold text-gray-400">{conta.nome}</span>}
                              {[m.cliente_nome, m.origem !== 'manual' ? m.origem : null, m.observacoes]
                                .filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`font-black text-sm ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                            {m.tipo === 'entrada' ? '+' : '-'}{fmtBRL(Number(m.valor))}
                          </span>
                          {!m.venda_id && (
                            <button
                              onClick={async () => {
                                if (await confirmar('Remover este movimento?', 'Remover'))
                                  deletar(m.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-1 rounded transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
