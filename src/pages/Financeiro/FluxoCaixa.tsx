// src/pages/Financeiro/FluxoCaixa.tsx
import { useState, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaixaMovimentos, CaixaMovimento } from '../../hooks/useCaixaMovimentos';
import { useCaixaKpisDia } from '../../hooks/useCaixaKpisDia';
import { useContasBancarias, useSaldoCaixaFisico } from '../../hooks/useContasBancarias';
import { useUsuarios } from '../../hooks/useUsuarios';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useRole } from '../../hooks/useRole';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { DateInput } from '../../components/ui/DateInput';
import {
  TrendingUp, ArrowUp, ArrowDown, Wallet,
  Plus, X, Save, ChevronLeft, ChevronRight, CheckSquare, Square, Trash2, User, ArrowLeftRight, ExternalLink,
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

function MiniKpi({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-0.5">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <p className="text-[9px] text-gray-500 uppercase font-bold leading-tight">{label}</p>
      <p className={`text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}

export function FluxoCaixa() {
  const navigate = useNavigate();
  const { data: movimentos = [], isLoading, criar, atualizar, deletar, transferir, isSaving, isTransferindo } = useCaixaMovimentos();
  const { data: kpisDia } = useCaixaKpisDia();
  const { data: contas = [] } = useContasBancarias();
  const { saldo: saldoTotalCaixa } = useSaldoCaixaFisico();
  const { data: usuarios = [] } = useUsuarios();
  const { confirmar, ConfirmModal } = useConfirm();
  const { isVendedor } = useRole();

  const [mesFx, setMesFx]       = useState(() => new Date().toISOString().slice(0, 7));
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<CaixaMovimento | null>(null);
  const [form, setForm]          = useState({ ...NOVO_MOV });
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [showTransfModal, setShowTransfModal] = useState(false);
  const [transf, setTransf] = useState({ origemId: '', destinoId: '', valor: 0, data: new Date().toISOString().split('T')[0], observacoes: '' });
  const [busca, setBusca]             = useState('');
  const [filtroTipo, setFiltroTipo]       = useState<'' | 'entrada' | 'saida'>('');

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
  // Fluxo de Caixa é só dinheiro físico — só entra pagamento em dinheiro
  // aqui, então não tem por que perguntar "qual conta": só existe o caixa
  // físico mesmo. Se só tiver uma conta do tipo Caixa cadastrada, usa ela
  // direto sem perguntar; se tiver mais de uma (ex: caixa de duas lojas),
  // deixa escolher só entre essas.
  const contasCaixaFisico = contasAtivas.filter(c => c.tipo === 'caixa');

  const movDoMes = useMemo(() => {
    const idsCaixaFisico = new Set(contas.filter(c => c.tipo === 'caixa').map(c => c.id));
    return movimentos.filter(m =>
      (m.data ?? '').startsWith(mesFx) &&
      // Fluxo de Caixa é só dinheiro físico — pagamento em cartão/Pix/
      // transferência que caiu numa conta bancária não entra aqui, mesmo
      // que tenha sido registrado no mesmo mês. Aparece no Resumo
      // Financeiro (Saldo por Conta) normalmente.
      (!m.conta_id || idsCaixaFisico.has(m.conta_id))
    );
  }, [movimentos, mesFx, contas]);

  const entradas = movDoMes.filter(m => m.tipo === 'entrada' && m.origem !== 'transferencia').reduce((s, m) => s + Number(m.valor), 0);
  const saidas   = movDoMes.filter(m => m.tipo === 'saida' && m.origem !== 'transferencia').reduce((s, m) => s + Number(m.valor), 0);
  const saldo    = entradas - saidas;

  const entradasHoje  = kpisDia?.entradas_hoje ?? 0;
  const saidasHoje    = kpisDia?.saidas_hoje ?? 0;

  const porData = useMemo(() => {
    const map: Record<string, typeof movDoMes> = {};
    // Mesmos filtros padrão do resto do financeiro (busca, conta, tipo) —
    // afetam só a listagem, não os KPIs de entradas/saídas/saldo do mês.
    const filtrados = movDoMes
      .filter(m =>
        !busca ||
        (m.descricao ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (m.cliente_nome ?? '').toLowerCase().includes(busca.toLowerCase())
      )
      .filter(m => !filtroTipo || m.tipo === filtroTipo);
    // Mais novo primeiro: por data, e dentro do mesmo dia por quando foi
    // lançado no sistema (created_at) — antes ficava na ordem que vinha do
    // banco, meio aleatória pra quem tinha vários movimentos no mesmo dia.
    [...filtrados]
      .sort((a, b) => b.data.localeCompare(a.data) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .forEach(m => {
        if (!map[m.data]) map[m.data] = [];
        map[m.data].push(m);
      });
    return map;
  }, [movDoMes, busca, filtroTipo]);

  const datas = Object.keys(porData).sort((a, b) => b.localeCompare(a));

  function setF<K extends keyof typeof NOVO_MOV>(campo: K, valor: typeof NOVO_MOV[K]) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  function abrirNovaMovimentacao() {
    setEditando(null);
    setForm({ ...NOVO_MOV, conta_id: contasCaixaFisico.length === 1 ? contasCaixaFisico[0].id : '' });
    setShowModal(true);
  }

  async function handleSalvar(e: React.FormEvent) {    e.preventDefault();
    // Fluxo de Caixa é só dinheiro físico — se só existe um caixa
    // cadastrado, usa ele mesmo que o campo não tenha sido tocado.
    const contaIdFinal = form.conta_id || (contasCaixaFisico.length === 1 ? contasCaixaFisico[0].id : '');
    const payload = {
      tipo:        form.tipo,
      valor:       form.valor,
      data:        form.data,
      descricao:   form.descricao || null,
      conta_id:    contaIdFinal || null,
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
                {contasCaixaFisico.length === 0 ? (
                  <p className="text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    Nenhuma conta do tipo "Caixa" cadastrada ainda. Cadastre uma em
                    Configurações → Formas de Pagamento pra registrar movimentações aqui.
                  </p>
                ) : contasCaixaFisico.length === 1 ? (
                  <div className="bg-[#111827] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-400 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-gray-600" /> {contasCaixaFisico[0].nome}
                    <span className="text-[10px] text-gray-600 ml-auto">único caixa físico — fixo</span>
                  </div>
                ) : (
                  <DarkSelect
                    value={form.conta_id}
                    onChange={v => setF('conta_id', v)}
                    placeholder="Selecione o caixa..."
                    options={contasCaixaFisico.map(c => ({ value: c.id, label: c.nome }))}
                  />
                )}
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

      {/* ── Modal transferência entre contas ── */}
      {showTransfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1f2937] border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-400" /> Transferência entre contas
              </h3>
              <button onClick={() => setShowTransfModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Move dinheiro de uma conta pra outra. Não conta como receita nem despesa no financeiro.
            </p>
            <form
              onSubmit={async e => {
                e.preventDefault();
                const origem  = contasAtivas.find(c => c.id === transf.origemId);
                const destino = contasAtivas.find(c => c.id === transf.destinoId);
                if (!origem || !destino) return;
                await transferir({
                  contaOrigemId: origem.id,
                  contaDestinoId: destino.id,
                  valor: transf.valor,
                  data: transf.data,
                  observacoes: transf.observacoes || null,
                  nomeOrigem: origem.nome,
                  nomeDestino: destino.nome,
                });
                setShowTransfModal(false);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>De</label>
                  <DarkSelect
                    value={transf.origemId}
                    onChange={v => setTransf(f => ({ ...f, origemId: v }))}
                    allowEmpty
                    options={contasAtivas.map(c => ({ value: c.id, label: c.nome }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Para</label>
                  <DarkSelect
                    value={transf.destinoId}
                    onChange={v => setTransf(f => ({ ...f, destinoId: v }))}
                    allowEmpty
                    options={contasAtivas.filter(c => c.id !== transf.origemId).map(c => ({ value: c.id, label: c.nome }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Valor (R$)</label>
                  <MoneyInput value={transf.valor} onChange={v => setTransf(f => ({ ...f, valor: v }))} className={IN} placeholder="0,00" />
                </div>
                <div>
                  <label className={LABEL}>Data</label>
                  <DateInput value={transf.data} onChange={v => setTransf(f => ({ ...f, data: v }))} className={IN} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Observações</label>
                <input value={transf.observacoes} onChange={e => setTransf(f => ({ ...f, observacoes: e.target.value }))} className={IN} placeholder="Opcional" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowTransfModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">
                  Cancelar
                </button>
                <button type="submit"
                  disabled={isTransferindo || !transf.origemId || !transf.destinoId || transf.origemId === transf.destinoId || !transf.valor}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
                  {isTransferindo ? 'Transferindo...' : 'Transferir'}
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
              onClick={abrirNovaMovimentacao}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30"
            >
              <Plus className="w-4 h-4" /> Movimentação
            </button>
            <button
              onClick={() => { setTransf({ origemId: '', destinoId: '', valor: 0, data: new Date().toISOString().split('T')[0], observacoes: '' }); setShowTransfModal(true); }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <ArrowLeftRight className="w-4 h-4" /> Transferência
            </button>
          </div>
        </div>

        {/* KPIs — layout compacto: dois grupos (Dia / Mês) lado a lado, cada
            um com 3 estatísticas pequenas por dentro, mais o Saldo Total em
            Caixa como card à parte. Substitui o grid de cards grandes de
            antes, que ocupava altura demais. */}
        <div className="flex flex-wrap gap-4 items-stretch">
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl px-5 py-3 flex-1 min-w-[280px]">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide text-center mb-2">Resultados do Dia</p>
            <div className="grid grid-cols-3 gap-3">
              <MiniKpi label="Entradas hoje" value={fmtBRL(entradasHoje)} icon={ArrowUp} color="text-green-400" />
              <MiniKpi label="Saídas hoje" value={fmtBRL(saidasHoje)} icon={ArrowDown} color="text-red-400" />
              <MiniKpi label="Saldo do dia" value={fmtBRL(entradasHoje - saidasHoje)} icon={Wallet}
                color={entradasHoje - saidasHoje >= 0 ? 'text-blue-400' : 'text-red-400'} />
            </div>
          </div>

          {!isVendedor && (
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl px-5 py-3 flex-1 min-w-[280px]">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide text-center mb-2">Resultados do Mês</p>
              <div className="grid grid-cols-3 gap-3">
                <MiniKpi label="Entradas no mês" value={fmtBRL(entradas)} icon={ArrowUp} color="text-green-400" />
                <MiniKpi label="Saídas no mês" value={fmtBRL(saidas)} icon={ArrowDown} color="text-red-400" />
                <MiniKpi label="Saldo do mês" value={fmtBRL(saldo)} icon={Wallet} color={saldo >= 0 ? 'text-blue-400' : 'text-red-400'} />
              </div>
            </div>
          )}

          <div className="bg-[#1f2937] border border-gray-700 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Wallet className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase whitespace-nowrap">Saldo Total em Caixa</p>
              <p className={`text-xl font-black ${saldoTotalCaixa >= 0 ? 'text-purple-400' : 'text-red-400'}`}>{fmtBRL(saldoTotalCaixa)}</p>
            </div>
          </div>
        </div>

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
        {/* Filtros — busca + tipo (não tem filtro de conta: só existe o
            caixa físico aqui, não faz sentido escolher "qual conta") */}
        <div className="flex flex-wrap gap-2 items-center">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por descrição ou cliente..."
            className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          <div className="w-36">
            <DarkSelect
              value={filtroTipo}
              onChange={v => setFiltroTipo(v as '' | 'entrada' | 'saida')}
              allowEmpty
              placeholder="Todo tipo"
              options={[{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }]}
            />
          </div>
        </div>

        {datas.length === 0 ? (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center space-y-3">
            <Wallet className="w-10 h-10 text-gray-700 mx-auto" />
            <p className="text-gray-600">Nenhum movimento em {new Date(mesFx + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.</p>
            <button onClick={abrirNovaMovimentacao}
              className="text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors">
              + Registrar primeira movimentação
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {selecionaveis.length > 0 && (
              <button onClick={toggleTodosVisiveis} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">
                {selecionaveis.length > 0 && selecionaveis.every(m => selecionados.has(m.id))
                  ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                Selecionar todos do mês
              </button>
            )}
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                      <th className="px-3 py-3 text-center w-8"></th>
                      <th className="px-5 py-3 text-left">Descrição</th>
                      <th className="px-5 py-3 text-left">Vendedor</th>
                      <th className="px-5 py-3 text-left">Data</th>
                      <th className="px-5 py-3 text-right">Valor</th>
                      <th className="px-5 py-3 text-center w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datas.map(data => {
                      const movs   = porData[data];
                      const entDia = movs.filter(m => m.tipo === 'entrada' && m.origem !== 'transferencia').reduce((s, m) => s + Number(m.valor), 0);
                      const saiDia = movs.filter(m => m.tipo === 'saida' && m.origem !== 'transferencia').reduce((s, m) => s + Number(m.valor), 0);
                      return (
                        <Fragment key={data}>
                          <tr className="bg-gray-800/60">
                            <td colSpan={6} className="px-5 py-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white">{fmtData(data)}</span>
                                <div className="flex gap-4 text-[11px]">
                                  {entDia > 0 && <span className="text-green-400 font-bold">+{fmtBRL(entDia)}</span>}
                                  {saiDia > 0 && <span className="text-red-400 font-bold">-{fmtBRL(saiDia)}</span>}
                                  <span className={`font-black ${entDia - saiDia >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                    = {fmtBRL(entDia - saiDia)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {movs.map(m => {
                            const autor = nomeDoAutor(m);
                            const marcado = selecionados.has(m.id);
                            const isTransferencia = m.origem === 'transferencia';
                            return (
                              <tr key={m.id} className="border-b border-gray-800 last:border-b-0 hover:bg-gray-800/20 transition-colors group">
                                <td className="px-3 py-3 text-center">
                                  {!m.venda_id && (
                                    <button onClick={() => toggleSelecionado(m.id)} className="text-gray-500 hover:text-blue-400 transition-colors">
                                      {marcado ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                                    </button>
                                  )}
                                </td>
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`flex-shrink-0 ${isTransferencia ? 'text-gray-400' : m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                                      {isTransferencia ? <ArrowLeftRight className="w-4 h-4" /> : m.tipo === 'entrada' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-medium text-white truncate flex items-center gap-2">
                                        {m.descricao}
                                        {isTransferencia && (
                                          <span className="text-[9px] font-bold bg-gray-600/40 text-gray-300 border border-gray-500/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                            transferência
                                          </span>
                                        )}
                                      </p>
                                      {(m.cliente_nome || m.observacoes) && (
                                        <p className="text-[10px] text-gray-500 truncate">
                                          {[m.cliente_nome, m.observacoes].filter(Boolean).join(' · ')}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-gray-400 text-xs">
                                  {autor
                                    ? <span className="flex items-center gap-1"><User className="w-3 h-3 text-gray-600" /> {autor}</span>
                                    : '—'}
                                </td>
                                <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(m.data)}</td>
                                <td className="px-5 py-3 text-right">
                                  <span className={`font-black ${isTransferencia ? 'text-gray-300' : m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                                    {m.tipo === 'entrada' ? '+' : '-'}{fmtBRL(Number(m.valor))}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <div className="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 transition-all">
                                    {!m.venda_id && !isTransferencia && (
                                      <button
                                        onClick={() => abrirEdicao(m)}
                                        className="text-gray-600 hover:text-blue-400 p-1 rounded transition-all"
                                        title="Editar"
                                      >
                                        <Save className="w-4 h-4" />
                                      </button>
                                    )}
                                    {!m.venda_id && (
                                      <button
                                        onClick={async () => {
                                          const msg = isTransferencia
                                            ? 'Remover esta transferência? Os dois lados (origem e destino) serão desfeitos.'
                                            : 'Remover este movimento?';
                                          if (await confirmar(msg, 'Remover'))
                                            deletar(m.id);
                                        }}
                                        className="text-gray-600 hover:text-red-400 p-1 rounded transition-all"
                                        title="Excluir"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    )}
                                    {m.venda_id && (
                                      <button
                                        onClick={() => navigate(`/vendas/nova/${m.venda_id}`, { state: { from: '/financeiro/fluxo-caixa' } })}
                                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all whitespace-nowrap"
                                      >
                                        <ExternalLink className="w-3 h-3" /> Ver venda
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
