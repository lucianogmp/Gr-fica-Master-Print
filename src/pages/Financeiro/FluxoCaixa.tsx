// src/pages/Financeiro/FluxoCaixa.tsx
import { useState, useMemo } from 'react';
import { useCaixaMovimentos, CaixaMovimento } from '../../hooks/useCaixaMovimentos';
import { useCaixaKpisDia } from '../../hooks/useCaixaKpisDia';
import { useContasBancarias } from '../../hooks/useContasBancarias';
import { useUsuarios } from '../../hooks/useUsuarios';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useRole } from '../../hooks/useRole';
import { KpiCard } from '../../components/ui/KpiCard';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { DateInput } from '../../components/ui/DateInput';
import {
  TrendingUp, ArrowUp, ArrowDown, Wallet,
  Plus, X, Save, ChevronLeft, ChevronRight, CheckSquare, Square, Trash2, User,
} from 'lucide-react';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { MonthInput } from '../../components/ui/MonthInput';

const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

const NOVO_MOV = {
  tipo:        'entrada' as 'entrada' | 'saida',
  valor:       0 as number,
  data:        new Date().toISOString().split('T')[0],
  descricao:   '',
  conta_id:    '',
  observacoes: '',
};

export function FluxoCaixa() {
  const { data: movimentos = [], isLoading, criar, atualizar, deletar, isSaving } = useCaixaMovimentos();
  const { data: kpisDia } = useCaixaKpisDia();
  const { data: contas = [] } = useContasBancarias();
  const { data: usuarios = [] } = useUsuarios();
  const { confirmar, ConfirmModal } = useConfirm();
  const { isVendedor } = useRole();

  const [mesFx, setMesFx]       = useState(() => new Date().toISOString().slice(0, 7));
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<CaixaMovimento | null>(null);
  const [form, setForm]          = useState({ ...NOVO_MOV });
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function nomeDoAutor(m: CaixaMovimento) {
    const email = (m as any).criado_por_email as string | undefined;
    if (!email) return null;
    return usuarios.find(u => u.email === email)?.nome || email;
  }

  function deslocarMesFx(delta: number) {
    const [y, m] = mesFx.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesFx(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const contasAtivas = contas.filter(c => c.ativo);

  const movDoMes = useMemo(() =>
    movimentos.filter(m => (m.data ?? '').startsWith(mesFx)),
    [movimentos, mesFx]
  );

  const entradas = movDoMes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const saidas   = movDoMes.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const saldo    = entradas - saidas;

  const entradasHoje  = kpisDia?.entradas_hoje ?? 0;
  const saidasHoje    = kpisDia?.saidas_hoje ?? 0;

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
    const payload = {
      tipo:        form.tipo,
      valor:       form.valor,
      data:        form.data,
      descricao:   form.descricao || null,
      conta_id:    form.conta_id || null,
      observacoes: form.observacoes || null,
      origem:      'manual',
    };
    if (editando) {
      await atualizar({ id: editando.id, payload });
    } else {
      await criar(payload);
    }
    setForm({ ...NOVO_MOV });
    setEditando(null);
    setShowModal(false);
  }

  function abrirEdicao(m: CaixaMovimento) {
    setEditando(m);
    setForm({
      tipo: m.tipo,
      valor: Number(m.valor),
      data: m.data,
      descricao: m.descricao ?? '',
      conta_id: m.conta_id ?? '',
      observacoes: m.observacoes ?? '',
    });
    setShowModal(true);
  }

  // Seleção múltipla — movimentos vindos de venda (venda_id) não entram,
  // mesma regra que já vale pro botão de excluir individual deles.
  const selecionaveis = useMemo(() => movDoMes.filter(m => !m.venda_id), [movDoMes]);
  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleTodosVisiveis() {
    setSelecionados(prev => {
      const todosMarcados = selecionaveis.length > 0 && selecionaveis.every(m => prev.has(m.id));
      const next = new Set(prev);
      if (todosMarcados) selecionaveis.forEach(m => next.delete(m.id));
      else selecionaveis.forEach(m => next.add(m.id));
      return next;
    });
  }
  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    const ok = await confirmar(
      `Remover ${selecionados.size} movimento(s) selecionado(s)? Essa ação não pode ser desfeita.`,
      'Excluir movimentos selecionados'
    );
    if (!ok) return;
    selecionados.forEach(id => deletar(id));
    setSelecionados(new Set());
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
              <h2 className="font-black text-white">{editando ? 'Editar Movimentação' : 'Nova Movimentação'}</h2>
              <button onClick={() => { setShowModal(false); setEditando(null); }} className="text-gray-400 hover:text-white transition-colors">
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
                  <MoneyInput
                    required
                    value={form.valor}
                    onChange={v => setF('valor', v)}
                    className={IN} placeholder="0,00"
                  />
                </div>
                <div>
                  <label className={LABEL}>Data</label>
                  <DateInput value={form.data}
                    onChange={v => setF('data', v)} className={IN} />
                </div>
              </div>

              <div>
                <label className={LABEL}>Conta</label>
                <DarkSelect
                  value={form.conta_id}
                  onChange={v => setF('conta_id', v)}
                  placeholder="Selecione uma conta..."
                  options={contasAtivas.map(c => ({
                    value: c.id,
                    label: `${c.nome}${c.banco ? ` — ${c.banco}` : ''}`,
                  }))}
                />
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
                <button type="button" onClick={() => { setShowModal(false); setEditando(null); }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all">
                  <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : editando ? 'Salvar' : 'Registrar'}
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
            <div className="flex items-center gap-1 bg-[#1f2937] border border-gray-700 rounded-xl px-1.5 py-1.5">
              <button onClick={() => deslocarMesFx(-1)} title="Mês anterior"
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <MonthInput
                value={mesFx}
                onChange={v => v && setMesFx(v)}
                className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm font-bold capitalize min-w-[150px]"
              />
              <button onClick={() => deslocarMesFx(1)} title="Próximo mês"
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => { setEditando(null); setForm({ ...NOVO_MOV }); setShowModal(true); }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30"
            >
              <Plus className="w-4 h-4" /> Movimentação
            </button>
          </div>
        </div>

        {/* KPIs do dia — sempre visíveis, para todos os perfis (inclusive vendedor) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard label="Entradas hoje"  value={fmtBRL(entradasHoje)} icon={ArrowUp}   color="text-green-400" />
          <KpiCard label="Saídas hoje"    value={fmtBRL(saidasHoje)}   icon={ArrowDown} color="text-red-400" />
          <KpiCard label="Saldo do dia"   value={fmtBRL(entradasHoje - saidasHoje)} icon={Wallet}
            color={entradasHoje - saidasHoje >= 0 ? 'text-blue-400' : 'text-red-400'} />
        </div>

        {/* KPIs do mês — só dono/admin/financeiro. Vendedor vê só o dia (acima) */}
        {!isVendedor && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="Entradas no mês"  value={fmtBRL(entradas)} icon={ArrowUp}    color="text-green-400" />
            <KpiCard label="Saídas no mês"    value={fmtBRL(saidas)}   icon={ArrowDown}  color="text-red-400" />
            <KpiCard label="Saldo do mês"     value={fmtBRL(saldo)}    icon={Wallet}     color={saldo >= 0 ? 'text-blue-400' : 'text-red-400'} />
          </div>
        )}

        {/* Lista de movimentos — todo mundo com acesso a essa página vê e edita */}
        {selecionados.size > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-blue-300 font-bold">{selecionados.size} selecionado(s)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelecionados(new Set())}
                className="text-xs font-bold text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                Limpar seleção
              </button>
              <button onClick={excluirSelecionados}
                className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Excluir selecionados
              </button>
            </div>
          </div>
        )}
        {datas.length === 0 ? (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center space-y-3">
            <Wallet className="w-10 h-10 text-gray-700 mx-auto" />
            <p className="text-gray-600">Nenhum movimento em {new Date(mesFx + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.</p>
            <button onClick={() => { setEditando(null); setForm({ ...NOVO_MOV }); setShowModal(true); }}
              className="text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors">
              + Registrar primeira movimentação
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {selecionaveis.length > 0 && (
              <button onClick={toggleTodosVisiveis} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">
                {selecionaveis.length > 0 && selecionaveis.every(m => selecionados.has(m.id))
                  ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                Selecionar todos do mês
              </button>
            )}
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
                    const autor = nomeDoAutor(m);
                    const marcado = selecionados.has(m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-800 last:border-b-0 hover:bg-gray-800/20 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          {!m.venda_id && (
                            <button onClick={() => toggleSelecionado(m.id)} className="flex-shrink-0 text-gray-500 hover:text-blue-400 transition-colors">
                              {marcado ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                            </button>
                          )}
                          <span className={`flex-shrink-0 ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                            {m.tipo === 'entrada' ? <ArrowDown className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{m.descricao}</p>
                            <p className="text-[10px] text-gray-500 flex items-center gap-2 flex-wrap">
                              {conta && <span className="font-bold text-gray-400">{conta.nome}</span>}
                              {[m.cliente_nome, m.origem !== 'manual' ? m.origem : null, m.observacoes]
                                .filter(Boolean).join(' · ')}
                              {autor && (
                                <span className="flex items-center gap-1 text-gray-600">
                                  <User className="w-2.5 h-2.5" /> {autor}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`font-black text-sm ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                            {m.tipo === 'entrada' ? '+' : '-'}{fmtBRL(Number(m.valor))}
                          </span>
                          {!m.venda_id && (
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                              <button
                                onClick={() => abrirEdicao(m)}
                                className="text-gray-600 hover:text-blue-400 p-1 rounded transition-all"
                                title="Editar"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (await confirmar('Remover este movimento?', 'Remover'))
                                    deletar(m.id);
                                }}
                                className="text-gray-600 hover:text-red-400 p-1 rounded transition-all"
                                title="Excluir"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
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
