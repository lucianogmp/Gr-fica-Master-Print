// src/pages/Financeiro/TabelaLancamentos.tsx
// Tabela reutilizável de lançamentos com filtros, KPIs e ações.
// Usada por: Lancamentos.tsx (todos), ContasReceber.tsx (receitas), ContasPagar.tsx (despesas)
import { usePersistente } from '../../hooks/usePersistente';
import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { movimentoManual } from '../../lib/financeiroMes';
import { useNavigate } from 'react-router-dom';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useCaixaMovimentos } from '../../hooks/useCaixaMovimentos';
import { useContasBancarias } from '../../hooks/useContasBancarias';
import { Lancamento, StatusLancamento, FORMAS_PAGAMENTO, CATEGORIAS_RECEITA, CATEGORIAS_DESPESA } from '../../types/financeiro';
import { ModalLancamento } from '../../components/financeiro/ModalLancamento';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { OrdenarMenu, aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { FiltroModal, CampoFiltro, FiltroValor, passaPeriodo, passaMulti, passaFaixa, passaSimNao, periodoAtivo, dataUsada } from '../../components/ui/FiltroModal';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { CabecalhoFiltro } from '../../components/ui/CabecalhoFiltro';
import {
  ArrowUp, ArrowDown, ChevronDown, Clock, AlertCircle, Check, X, ExternalLink, LucideIcon, CheckSquare, Square, Wallet, Landmark,
} from 'lucide-react';

// Título de coluna que ordena: 1º clique = maior/mais recente primeiro, 2º inverte.
function CabecalhoOrdem({ label, campo, ordenacao, onChange, center }: {
  label: string; campo: string; ordenacao: Ordenacao | null; onChange: (o: Ordenacao) => void; center?: boolean;
}) {
  const ativo = ordenacao?.campo === campo;
  return (
    <button type="button"
      onClick={() => onChange({ campo, direcao: ativo && ordenacao?.direcao === 'desc' ? 'asc' : 'desc' })}
      title={campo === 'valor' ? 'Ordenar por valor (maior ↔ menor)' : 'Ordenar por vencimento (recente ↔ antigo)'}
      className={`inline-flex items-center gap-1 uppercase font-bold transition-colors ${ativo ? 'text-blue-400' : 'text-gray-400 hover:text-white'} ${center ? 'mx-auto' : ''}`}>
      {label}
      {ativo
        ? (ordenacao?.direcao === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)
        : <ChevronDown className="w-3 h-3 opacity-60" />}
    </button>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
export const fmtBRL  = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtData = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export const STATUS_COR: Record<string, string> = {
  pago:      'bg-green-500/15 text-green-400 border-green-500/30',
  pendente:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  atrasado:  'bg-red-500/15 text-red-400 border-red-500/30',
  cancelado: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export function calcStatusLanc(l: Lancamento): string {
  if (l.status === 'pago' || l.status === 'cancelado') return l.status;
  if (l.data_vencimento && new Date(l.data_vencimento + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0)))
    return 'atrasado';
  return l.status;
}

type FiltroStatus = 'todos' | 'pendente' | 'atrasado' | 'pago' | 'cancelado';

/** Lançamento + os que vêm do Fluxo de Caixa, mesclados só pra exibição. */
export type LancamentoExibido = Lancamento & { isDeCaixa?: boolean; isPagamentoVenda?: boolean };

type KpiExtra = {
  label: string;
  icon: LucideIcon;
  color: string;
  value: string | number;
};

type TabelaLancamentosProps = {
  /** 'receita' = só receitas, 'despesa' = só despesas, undefined = todos */
  fixarTipo?: 'receita' | 'despesa';
  /** KPIs customizados passados pela tela pai */
  kpis?: KpiExtra[];
  mensagemVazio?: string;
  /** 'AAAA-MM': mostra só os lançamentos com vencimento nesse mês. Sem isso, mostra tudo. */
  mes?: string;
};

export function TabelaLancamentos({ fixarTipo, kpis, botoesHeader, mensagemVazio, mes }: TabelaLancamentosProps) {
  const navigate = useNavigate();
  const { data: todos = [], isLoading, criar, atualizar, pagar, deletar, isSaving, isPagando } = useLancamentos();
  const { data: contas = [] } = useContasBancarias();
  const contaCaixaPadraoId = contas.find(c => c.ativo && c.tipo === 'caixa')?.id ?? null;
  // Pra onde foi o dinheiro de cada venda: o lançamento da venda é um só (total),
  // mas a conta que recebeu está em cada pagamento da venda (pode ser mais de uma).
  // Chave começa com 'lancamentos' pra ser atualizada junto com qualquer pagamento.
  const { data: pagamentosDestino = [] } = useQuery({
    queryKey: ['lancamentos', 'destino-pagamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pagamentos_venda').select('id,venda_id,valor,juros_pct,conta_id,forma_pagamento,data_pagamento,created_at');
      if (error) throw error;
      return (data ?? []) as { id: string; venda_id: string; valor: number; juros_pct: number | null; conta_id: string | null; forma_pagamento: string | null; data_pagamento: string | null; created_at: string | null }[];
    },
  });
  const formasPorVenda = useMemo(() => {
    const m = new Map<string, string[]>();
    pagamentosDestino.forEach(p => {
      const f = (p.forma_pagamento ?? '').trim();
      if (!f) return;
      const l = m.get(p.venda_id) ?? [];
      if (!l.includes(f)) l.push(f);
      m.set(p.venda_id, l);
    });
    return m;
  }, [pagamentosDestino]);
  const contasPorVenda = useMemo(() => {
    const m = new Map<string, string[]>();
    pagamentosDestino.forEach(p => {
      if (!p.conta_id) return;
      const l = m.get(p.venda_id) ?? [];
      if (!l.includes(p.conta_id)) l.push(p.conta_id);
      m.set(p.venda_id, l);
    });
    return m;
  }, [pagamentosDestino]);
  // Fluxo de Caixa também é "algo lançado no sistema" (entrada/saída de
  // dinheiro) — mescla aqui só pra exibição, marcado com isDeCaixa. Editar
  // e excluir desses continua só lá no Fluxo de Caixa, pra não arriscar
  // mexer na tabela errada numa ação em massa.
  // IMPORTANTE: movimento de caixa que já pertence a uma venda (venda_id
  // preenchido) NÃO entra aqui — essa venda já aparece como lançamento
  // (vindo da aba Vendas). Sem esse filtro, uma venda paga em dinheiro/Pix/
  // cartão aparecia duplicada: uma vez como "venda", outra como "caixa".
  const { data: movsCaixa = [], isLoading: isLoadingCaixa } = useCaixaMovimentos();
  const movsCaixaReais = useMemo(
    () => movsCaixa.filter(m => movimentoManual(m) && !m.venda_id),
    [movsCaixa]
  );
  // Cada pagamento de uma venda vira uma linha própria (valor, forma e conta de CADA
  // pagamento), pra conferir o caixa sem somar de cabeça. É só exibição: no banco continua
  // um lançamento por venda. Se ainda falta receber, sobra uma linha pendente com o restante.
  const todosExpandidos = useMemo<LancamentoExibido[]>(() => {
    const pagsPorVenda = new Map<string, typeof pagamentosDestino>();
    pagamentosDestino.forEach(p => { const l = pagsPorVenda.get(p.venda_id) ?? []; l.push(p); pagsPorVenda.set(p.venda_id, l); });
    const liq = (p: { valor: number; juros_pct: number | null }) => Number(p.valor) - Math.round(Number(p.valor) * Number(p.juros_pct ?? 0)) / 100;
    const out: LancamentoExibido[] = [];
    for (const l of todos) {
      const pags = l.venda_id && l.tipo === 'receita' && l.status !== 'cancelado' ? (pagsPorVenda.get(l.venda_id) ?? []) : [];
      if (pags.length === 0) { out.push(l); continue; }
      const ordenados = [...pags].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
      let somaLiq = 0;
      for (const p of ordenados) {
        const v = Math.round(liq(p) * 100) / 100;
        somaLiq += v;
        out.push({
          ...l,
          id: `pg:${p.id}`,
          valor: v,
          status: 'pago',
          data_vencimento: (p.data_pagamento ?? l.data_vencimento) as any,
          data_pagamento: (p.data_pagamento ?? null) as any,
          forma_pagamento: p.forma_pagamento ?? null,
          conta_id: p.conta_id ?? null,
          created_at: (p.created_at ?? l.created_at) as any,
          isPagamentoVenda: true,
        } as LancamentoExibido);
      }
      if (l.status === 'pendente') {
        const resto = Math.round((Number(l.valor) - somaLiq) * 100) / 100;
        if (resto > 0.01) out.push({ ...l, valor: resto });
      }
    }
    return out;
  }, [todos, pagamentosDestino]);
  const todosComCaixa = useMemo<LancamentoExibido[]>(() => [
    ...todosExpandidos,
    ...movsCaixaReais.map((m): LancamentoExibido => ({
      id:              `caixa:${m.id}`,
      tipo:            m.tipo === 'entrada' ? 'receita' : 'despesa',
      descricao:       m.descricao,
      valor:           Number(m.valor),
      status:          'pago',
      categoria:       'Fluxo de Caixa',
      cliente_nome:    m.cliente_nome ?? null,
      data_vencimento: m.data,
      data_pagamento:  m.data,
      observacoes:     m.observacoes ?? null,
      conta_id:        m.conta_id ?? contaCaixaPadraoId,
      isDeCaixa:       true,
    })),
  ], [todosExpandidos, movsCaixaReais, contaCaixaPadraoId]);

  // Contas (ids) de destino/origem de um lançamento
  const idsContaDe = (l: LancamentoExibido): string[] =>
    l.isPagamentoVenda ? (l.conta_id ? [l.conta_id] : [])
    : l.venda_id ? (contasPorVenda.get(l.venda_id) ?? (l.conta_id ? [l.conta_id] : []))
      : (l.conta_id ? [l.conta_id] : []);
  // Forma(s) de pagamento: nas vendas vem dos pagamentos registrados; nos demais, do próprio lançamento
  const formasDe = (l: LancamentoExibido): string[] =>
    l.isPagamentoVenda ? (l.forma_pagamento ? [l.forma_pagamento] : [])
    : l.venda_id ? (formasPorVenda.get(l.venda_id) ?? (l.forma_pagamento ? [l.forma_pagamento] : []))
      : (l.forma_pagamento ? [l.forma_pagamento] : []);
  const nomeConta = (id: string) => contas.find(c => c.id === id)?.nome?.trim() ?? 'Conta removida';
  const { confirmar, ConfirmModal } = useConfirm();

  const [pagandoLanc, setPagandoLanc] = useState<LancamentoExibido | null>(null);
  const [formaPag, setFormaPag]       = useState('');
  const [contaPagId, setContaPagId]   = useState('');
  const [modalOpen, setModalOpen]       = useState(false);
  const [editandoLanc, setEditandoLanc] = useState<Lancamento | null>(null);
  const [tipoInicial, setTipoInicial]   = useState<'receita' | 'despesa'>(fixarTipo ?? 'despesa');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [busca, setBusca] = usePersistente('busca', '');
  const [mesLanc, setMesLanc]           = useState(() => new Date().toISOString().slice(0, 7));
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [filtrosAv, setFiltrosAv] = usePersistente<FiltroValor>('filtros', {});
  const [filtroContaId, setFiltroContaId] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroForma, setFiltroForma] = useState('');

  // Aplica filtro de tipo fixo (se vier da tela pai)
  const base = useMemo(() => {
    let lista = fixarTipo ? todosComCaixa.filter(l => l.tipo === fixarTipo) : todosComCaixa;
    if (mes && !busca.trim() && !periodoAtivo(filtrosAv.periodo)) lista = lista.filter(l => (l.data_vencimento ?? l.created_at ?? '').startsWith(mes));
    return lista;
  }, [todosComCaixa, fixarTipo, mes, busca, filtrosAv.periodo]);

  // Opções dos seletores vêm do que realmente existe nos lançamentos (antes eram listas fixas
  // e deixavam de fora categorias/formas que aparecem nas vendas).
  const opcoesCategoria = useMemo(
    () => Array.from(new Set(base.map(l => l.categoria).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [base]);
  const opcoesForma = useMemo(() => {
    const set = new Set<string>();
    base.forEach(l => formasDe(l as LancamentoExibido).forEach(f => f && set.add(f)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [base, formasPorVenda]);
  const camposFiltro = useMemo<CampoFiltro[]>(() => [
    { tipo: 'periodo', chave: 'periodo', label: 'Data', datas: [
      { value: 'data_vencimento', label: 'Vencimento' }, { value: 'data_pagamento', label: 'Data de pagamento' }, { value: 'created_at', label: 'Data de criação' }] },
    { tipo: 'busca', chave: 'busca', label: 'Busca (descrição, cliente/fornecedor, categoria)', placeholder: 'Descrição, cliente, fornecedor...' },
    { tipo: 'faixa', chave: 'valor', label: 'Valor' },
    { tipo: 'multi', chave: 'status', label: 'Situação', opcoes: [
      { value: 'pendente', label: 'Pendente' }, { value: 'atrasado', label: 'Atrasado' }, { value: 'pago', label: 'Pago' }, { value: 'cancelado', label: 'Cancelado' }] },
    ...(!fixarTipo ? [{ tipo: 'multi' as const, chave: 'tipo', label: 'Tipo', opcoes: [{ value: 'receita', label: 'Receita' }, { value: 'despesa', label: 'Despesa' }] }] : []),
    { tipo: 'multi', chave: 'categoria', label: 'Categoria', opcoes: opcoesCategoria.map(c => ({ value: c, label: c })) },
    { tipo: 'multi', chave: 'conta', label: 'Conta financeira', opcoes: contas.map(c => ({ value: c.id, label: c.nome.trim() })) },
    { tipo: 'multi', chave: 'forma', label: 'Forma de pagamento', opcoes: opcoesForma.map(f => ({ value: f, label: f })) },
    { tipo: 'simnao', chave: 'venda', label: 'Vinculado a uma venda' },
    { tipo: 'simnao', chave: 'caixa', label: 'Movimento manual de caixa' },
    { tipo: 'simnao', chave: 'pago', label: 'Já pago/recebido' },
    { tipo: 'simnao', chave: 'semConta', label: 'Sem conta financeira' },
  ], [fixarTipo, opcoesCategoria, opcoesForma, contas]);
  const filtrados = useMemo(() => {
    const basico = base
      .map(l => ({ ...l, statusCalc: calcStatusLanc(l) }))
      .filter(l => {
        if (filtroStatus !== 'todos') return l.statusCalc === filtroStatus;
        return true;
      })
      .filter(l => correspondeABuscaEmCampos([l.descricao, l.cliente_nome], busca))
      .filter(l => !filtroContaId || idsContaDe(l as LancamentoExibido).includes(filtroContaId))
      .filter(l => !filtroCategoria || l.categoria === filtroCategoria)
      .filter(l => !filtroForma || formasDe(l as LancamentoExibido).includes(filtroForma));
    const f = filtrosAv;
    const campoData = dataUsada(f.periodo, 'data_vencimento');
    const buscaModal = String(f.busca ?? '').trim();
    const desc = String(f.descricao ?? '').trim().toLowerCase();
    const comFiltrosAv = basico
      .filter(l => passaPeriodo(f.periodo, (l as any)[campoData]))
      .filter(l => !buscaModal || correspondeABuscaEmCampos([l.descricao, l.cliente_nome, l.categoria], buscaModal))
      .filter(l => !desc || (l.descricao ?? '').toLowerCase().includes(desc))
      .filter(l => passaFaixa(f.valor, l.valor))
      .filter(l => passaMulti(f.status, l.statusCalc))
      .filter(l => passaMulti(f.tipo, l.tipo))
      .filter(l => passaMulti(f.categoria, l.categoria ?? ''))
      .filter(l => passaMulti(f.conta, idsContaDe(l as LancamentoExibido)))
      .filter(l => passaMulti(f.forma, formasDe(l as LancamentoExibido)))
      .filter(l => passaSimNao(f.venda, !!l.venda_id))
      .filter(l => passaSimNao(f.caixa, !!(l as LancamentoExibido).isDeCaixa))
      .filter(l => passaSimNao(f.pago, l.status === 'pago'))
      .filter(l => passaSimNao(f.semConta, idsContaDe(l as LancamentoExibido).length === 0));
    // Sem ordenação escolhida (estado inicial): o mais recente em cima — de hoje para
    // o dia 1º do mês — e, no mesmo dia, o lançado por último primeiro. Lançamentos com
    // vencimento FUTURO (ex.: a receber dia 30) ficam depois, do mais próximo ao mais distante,
    // pra não empurrarem o que aconteceu hoje pra baixo.
    if (!ordenacao) {
      const d = new Date();
      const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dt = (x: any) => String(x.data_vencimento ?? '').slice(0, 10);
      const cr = (x: any) => String(x.created_at ?? '');
      return [...comFiltrosAv].sort((x, y) => {
        const fx = dt(x) > hoje, fy = dt(y) > hoje;
        if (fx !== fy) return fx ? 1 : -1;
        if (fx && fy) return dt(x).localeCompare(dt(y)) || cr(y).localeCompare(cr(x));
        return dt(y).localeCompare(dt(x)) || cr(y).localeCompare(cr(x));
      });
    }
    return aplicarOrdenacao(comFiltrosAv, ordenacao, {
      data:    l => l.data_vencimento,
      cliente: l => l.cliente_nome ?? '',
      valor:   l => Number(l.valor ?? 0),
    });
  }, [base, filtroStatus, busca, filtrosAv, ordenacao, filtroContaId, filtroCategoria, filtroForma, contasPorVenda, formasPorVenda]);

  // Seleção múltipla: inclui todos os lançamentos, inclusive os vindos de
  // venda. Excluir um lançamento de venda não mexe na venda em si (o
  // pagamento continua lá) — só some da lista do Financeiro, então o
  // valor pago que aparece na tela da venda pode ficar sem bater com os
  // lançamentos aqui. Por isso o aviso de confirmação é mais forte quando
  // a seleção inclui algum desses.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const selecionaveis = filtrados.filter(l => !(l as LancamentoExibido).isDeCaixa && !(l as LancamentoExibido).isPagamentoVenda);

  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleTodosVisiveis() {
    setSelecionados(prev => {
      const todosMarcados = selecionaveis.length > 0 && selecionaveis.every(l => prev.has(l.id));
      const next = new Set(prev);
      if (todosMarcados) {
        selecionaveis.forEach(l => next.delete(l.id));
      } else {
        selecionaveis.forEach(l => next.add(l.id));
      }
      return next;
    });
  }
  const totalSelecionado = filtrados
    .filter(l => selecionados.has(l.id))
    .reduce((s, l) => s + (l.tipo === 'despesa' ? -1 : 1) * Number(l.valor), 0);

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    const itensSelecionados = filtrados.filter(l => selecionados.has(l.id));
    const qtdDeVenda = itensSelecionados.filter(l => l.venda_id).length;
    const mensagem = qtdDeVenda > 0
      ? `Remover ${selecionados.size} lançamento(s) selecionado(s)? ${qtdDeVenda} deles vieram de uma venda — excluir aqui não mexe na venda, mas o valor pago/restante mostrado nela pode ficar sem bater com o Financeiro. Essa ação não pode ser desfeita.`
      : `Remover ${selecionados.size} lançamento(s) selecionado(s)? Essa ação não pode ser desfeita.`;
    const ok = await confirmar(mensagem, 'Excluir lançamentos selecionados');
    if (!ok) return;
    selecionados.forEach(id => deletar(id));
    setSelecionados(new Set());
  }

  if (isLoading || isLoadingCaixa) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <>
      <ConfirmModal />

      {/* KPIs agora ficam na mesma linha do título (ver página que usa este
          componente) — mais compacto, não duplica aqui embaixo. */}

      {/* Filtros + ações */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => { setEditandoLanc(null); setTipoInicial(fixarTipo ?? 'receita'); setModalOpen(true); }}
          className={`${fixarTipo === 'despesa' ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'} text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5`}
        >
          <ArrowUp className="w-4 h-4" />
          {fixarTipo === 'despesa' ? '+ Despesa' : '+ Entrada'}
        </button>
        {!fixarTipo && (
          <button
            onClick={() => { setEditandoLanc(null); setTipoInicial('despesa'); setModalOpen(true); }}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5"
          >
            <ArrowDown className="w-4 h-4" /> + Despesa
          </button>
        )}

        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por descrição ou cliente..."
          className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />

        <OrdenarMenu
          valor={ordenacao}
          onChange={setOrdenacao}
          campos={[
            { key: 'data',    label: 'Vencimento', labelAsc: 'Mais antigo primeiro', labelDesc: 'Mais recente primeiro' },
            { key: 'valor',   label: 'Valor',      labelAsc: 'Menor primeiro',       labelDesc: 'Maior primeiro' },
            { key: 'cliente', label: 'Cliente/Forn.', labelAsc: 'A → Z',              labelDesc: 'Z → A' },
          ]}
        />
        <FiltroModal campos={camposFiltro} valor={filtrosAv} onChange={setFiltrosAv} titulo="Filtro avançado — Lançamentos" />
      </div>

      {/* Tabela */}
      <div className={`bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden ${selecionados.size > 0 ? 'mb-16' : ''}`}>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-3 py-3 text-center w-8">
                <button onClick={toggleTodosVisiveis} title="Selecionar/desmarcar todos visíveis" className="text-gray-500 hover:text-blue-400 transition-colors">
                  {selecionaveis.length > 0 && selecionaveis.every(l => selecionados.has(l.id))
                    ? <CheckSquare className="w-4 h-4 text-blue-400" />
                    : <Square className="w-4 h-4" />}
                </button>
              </th>
              {!fixarTipo && <th className="px-5 py-3 text-left">Tipo</th>}
              <th className="px-5 py-3 text-left">Descrição</th>
              <th className="px-5 py-3 text-left">
                <CabecalhoFiltro label="Categoria" valor={filtroCategoria} onChange={setFiltroCategoria}
                  opcoes={opcoesCategoria.map(c => ({ value: c, label: c }))} />
              </th>
              <th className="px-5 py-3 text-left">Cliente/Forn.</th>
              <th className="px-5 py-3 text-right">
                <CabecalhoOrdem label="Valor" campo="valor" ordenacao={ordenacao} onChange={setOrdenacao} />
              </th>
              <th className="px-5 py-3 text-left">
                <CabecalhoFiltro label="Conta" valor={filtroContaId} onChange={setFiltroContaId}
                  opcoes={contas.map(c => ({ value: c.id, label: c.ativo ? c.nome.trim() : `${c.nome.trim()} (inativa)` }))} />
              </th>
              <th className="px-5 py-3 text-left">
                <CabecalhoFiltro label="Forma" valor={filtroForma} onChange={setFiltroForma}
                  opcoes={opcoesForma.map(f => ({ value: f, label: f }))} />
              </th>
              <th className="px-5 py-3 text-center">
                <CabecalhoOrdem label="Vencimento" campo="data" ordenacao={ordenacao} onChange={setOrdenacao} center />
              </th>
              <th className="px-5 py-3 text-center">
                <CabecalhoFiltro label="Status" align="center" valor={filtroStatus === 'todos' ? '' : filtroStatus}
                  onChange={v => setFiltroStatus((v || 'todos') as FiltroStatus)}
                  opcoes={[{ value: 'pendente', label: 'Pendentes' }, { value: 'atrasado', label: 'Atrasados' },
                    { value: 'pago', label: 'Pagos' }, { value: 'cancelado', label: 'Cancelados' }]} />
              </th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={!fixarTipo ? 11 : 10} className="px-5 py-12 text-center text-gray-600">
                {mensagemVazio ?? 'Nenhum lançamento encontrado.'}
              </td></tr>
            )}
            {filtrados.map(l => {
              const st = l.statusCalc;
              const isDeVenda = !!l.venda_id;
              const isDeCaixa = !!(l as LancamentoExibido).isDeCaixa;
              const marcado = selecionados.has(l.id);
              const soExibicao = isDeCaixa || !!(l as LancamentoExibido).isPagamentoVenda;
              return (
                <tr key={l.id} className={`border-b border-gray-800 hover:bg-gray-800/30 transition-colors ${marcado ? 'bg-blue-500/5' : ''}`}>
                  <td className="px-3 py-3 text-center">
                    {!soExibicao && (
                      <button onClick={() => toggleSelecionado(l.id)} className="text-gray-500 hover:text-blue-400 transition-colors">
                        {marcado ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                  </td>
                  {!fixarTipo && (
                    <td className="px-5 py-3">
                      <span className={l.tipo === 'receita' ? 'text-green-400' : 'text-red-400'}>
                        {l.tipo === 'receita'
                          ? <ArrowUp className="w-4 h-4" />
                          : <ArrowDown className="w-4 h-4" />}
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{l.descricao}</span>
                      {isDeVenda && (
                        <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                          venda
                        </span>
                      )}
                      {isDeCaixa && (
                        <span className="text-[9px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                          caixa
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{l.categoria || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{l.cliente_nome || '—'}</td>
                  <td className={`px-5 py-3 text-right font-black ${l.tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtBRL(Number(l.valor))}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {(() => {
                      const ids = idsContaDe(l as LancamentoExibido);
                      if (ids.length === 0) return <span className="text-gray-600">—</span>;
                      return (
                        <span className={`font-bold ${l.tipo === 'receita' ? 'text-green-300' : 'text-red-300'}`}
                          title={ids.map(nomeConta).join(', ')}>
                          {l.tipo === 'receita' ? '→ ' : '← '}{nomeConta(ids[0])}
                          {ids.length > 1 && <span className="text-gray-500 font-normal"> +{ids.length - 1}</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {(() => {
                      const fs = formasDe(l as LancamentoExibido);
                      return fs.length ? fs.join(', ') : '—';
                    })()}
                  </td>
                  <td className="px-5 py-3 text-center text-xs text-gray-400">{fmtData(l.data_vencimento)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_COR[st] ?? STATUS_COR.pendente}`}>
                      {st}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {isDeCaixa ? (
                      <button
                        onClick={() => navigate('/financeiro/fluxo-caixa')}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30 transition-all mx-auto"
                      >
                        <Wallet className="w-3 h-3" /> Ver no Fluxo de Caixa
                      </button>
                    ) : isDeVenda ? (
                      <button
                        onClick={() => navigate(`/vendas/nova/${l.venda_id}`, { state: { from: '/financeiro/lancamentos' } })}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all mx-auto"
                      >
                        <ExternalLink className="w-3 h-3" /> Ver venda
                      </button>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        {st !== 'pago' && st !== 'cancelado' && (
                          <button onClick={() => {
                            setPagandoLanc(l);
                            setFormaPag(l.forma_pagamento || FORMAS_PAGAMENTO[0]);
                            setContaPagId('');
                          }}
                            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all border ${l.tipo === 'despesa' ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border-red-500/30' : 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border-green-500/30'}`}>
                            <Check className="w-3 h-3" /> Pagar
                          </button>
                        )}
                        <button onClick={() => { setEditandoLanc(l); setTipoInicial(l.tipo); setModalOpen(true); }}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all">
                          Editar
                        </button>
                        <button onClick={async () => { if (await confirmar('Remover este lançamento?', 'Remover')) deletar(l.id); }}
                          className="flex items-center justify-center px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Confirmar pagamento — exige conta financeira, filtrada pela forma escolhida,
          pra que o saldo da conta certa seja atualizado (regra: forma de pagamento ≠ conta). */}
      {pagandoLanc && (() => {
        const contasAtivas = contas.filter(c => c.ativo);
        const contasCompativeis = formaPag === 'Dinheiro'
          ? contasAtivas.filter(c => c.tipo === 'caixa')
          : contasAtivas.filter(c => c.tipo !== 'caixa');
        const contasDaForma = contasCompativeis.filter(c => (c.formas_aceitas ?? []).includes(formaPag));
        const opcoesConta = contasDaForma.length > 0 ? contasDaForma : contasCompativeis;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-[#1f2937] border border-gray-700 rounded-2xl shadow-2xl p-5 w-full max-w-sm space-y-4">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Landmark className="w-4 h-4 text-green-400" />
                {pagandoLanc.tipo === 'receita' ? 'Confirmar recebimento' : 'Confirmar pagamento'}
              </p>
              <p className="text-xs text-gray-400">{pagandoLanc.descricao} — {fmtBRL(Number(pagandoLanc.valor))}</p>

              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Forma de pagamento</label>
                <DarkSelect
                  value={formaPag}
                  onChange={v => { setFormaPag(v); setContaPagId(''); }}
                  allowEmpty={false}
                  options={FORMAS_PAGAMENTO}
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Conta financeira *</label>
                {opcoesConta.length === 0 ? (
                  <p className="text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    Nenhuma conta cadastrada ainda. Cadastre uma em Configurações → Formas de Pagamento.
                  </p>
                ) : (
                  <>
                    <DarkSelect
                      value={contaPagId}
                      onChange={setContaPagId}
                      allowEmpty
                      options={opcoesConta.map(c => ({ value: c.id, label: c.nome }))}
                    />
                    {contasDaForma.length === 0 && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        Nenhuma conta marcada como aceitando "{formaPag}" — mostrando todas as contas ativas.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setPagandoLanc(null)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-bold">
                  Cancelar
                </button>
                <button
                  disabled={!contaPagId || isPagando}
                  onClick={async () => {
                    await pagar({
                      id: pagandoLanc.id,
                      contaId: contaPagId,
                      forma: formaPag,
                      lancamento: {
                        tipo: pagandoLanc.tipo,
                        valor: Number(pagandoLanc.valor),
                        descricao: pagandoLanc.descricao,
                        cliente_nome: pagandoLanc.cliente_nome ?? null,
                        venda_id: pagandoLanc.venda_id ?? null,
                      },
                    });
                    setPagandoLanc(null);
                  }}
                  className={`px-4 py-1.5 ${pagandoLanc?.tipo === 'despesa' ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'} disabled:opacity-40 text-white rounded-lg text-xs font-bold`}>
                  {isPagando ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <ModalLancamento
        open={modalOpen}
        editando={editandoLanc}
        tipoInicial={tipoInicial}
        onClose={() => { setModalOpen(false); setEditandoLanc(null); }}
        onSalvar={dados =>
          editandoLanc
            ? atualizar({ id: editandoLanc.id, payload: dados })
            : criar(dados)
        }
      />

      {/* Barra de seleção — fixa embaixo, só aparece com algo marcado */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1f2937] border-t border-blue-500/40 shadow-2xl shadow-black/50">
          <div className="px-6 py-3 flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-300">
              <span className="font-black text-white">{selecionados.size}</span> selecionado{selecionados.size > 1 ? 's' : ''}
            </span>
            <span className={`text-sm font-black ${totalSelecionado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalSelecionado >= 0 ? '+' : ''}{fmtBRL(totalSelecionado)}
            </span>
            <div className="flex-1" />
            <button onClick={() => setSelecionados(new Set())}
              className="text-xs font-bold text-gray-400 hover:text-white transition-colors">
              Limpar seleção
            </button>
            <button onClick={excluirSelecionados}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all">
              <X className="w-3.5 h-3.5" /> Excluir selecionados
            </button>
          </div>
        </div>
      )}
    </>
  );
}
