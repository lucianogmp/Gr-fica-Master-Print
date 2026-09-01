// src/pages/Financeiro/TabelaLancamentos.tsx
// Tabela reutilizável de lançamentos com filtros, KPIs e ações.
// Usada por: Lancamentos.tsx (todos), ContasReceber.tsx (receitas), ContasPagar.tsx (despesas)
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useCaixaMovimentos } from '../../hooks/useCaixaMovimentos';
import { Lancamento, StatusLancamento } from '../../types/financeiro';
import { ModalLancamento } from '../../components/financeiro/ModalLancamento';
import { KpiCard } from '../../components/ui/KpiCard';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { OrdenarMenu, aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';
import { FiltrosAvancados, aplicarFiltrosAvancados, FiltrosAvancadosValor } from '../../components/ui/FiltrosAvancados';
import {
  ArrowUp, ArrowDown, Clock, AlertCircle, Check, X, ExternalLink, LucideIcon, CheckSquare, Square, Wallet,
} from 'lucide-react';

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
export type LancamentoExibido = Lancamento & { isDeCaixa?: boolean };

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
};

export function TabelaLancamentos({ fixarTipo, kpis, botoesHeader, mensagemVazio }: TabelaLancamentosProps) {
  const navigate = useNavigate();
  const { data: todos = [], isLoading, criar, atualizar, pagar, deletar, isSaving } = useLancamentos();
  // Fluxo de Caixa também é "algo lançado no sistema" (entrada/saída de
  // dinheiro) — mescla aqui só pra exibição, marcado com isDeCaixa. Editar
  // e excluir desses continua só lá no Fluxo de Caixa, pra não arriscar
  // mexer na tabela errada numa ação em massa.
  const { data: movsCaixa = [], isLoading: isLoadingCaixa } = useCaixaMovimentos();
  const todosComCaixa = useMemo<LancamentoExibido[]>(() => [
    ...todos,
    ...movsCaixa.map((m): LancamentoExibido => ({
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
      isDeCaixa:       true,
    })),
  ], [todos, movsCaixa]);
  const { confirmar, ConfirmModal } = useConfirm();

  const [modalOpen, setModalOpen]       = useState(false);
  const [editandoLanc, setEditandoLanc] = useState<Lancamento | null>(null);
  const [tipoInicial, setTipoInicial]   = useState<'receita' | 'despesa'>(fixarTipo ?? 'despesa');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [busca, setBusca]               = useState('');
  const [mesLanc, setMesLanc]           = useState(() => new Date().toISOString().slice(0, 7));
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>({ campo: 'data', direcao: 'desc' });
  const [filtrosAv, setFiltrosAv] = useState<FiltrosAvancadosValor>({});

  // Aplica filtro de tipo fixo (se vier da tela pai)
  const base = useMemo(() =>
    fixarTipo ? todosComCaixa.filter(l => l.tipo === fixarTipo) : todosComCaixa,
    [todosComCaixa, fixarTipo]
  );

  const filtrados = useMemo(() => {
    const basico = base
      .map(l => ({ ...l, statusCalc: calcStatusLanc(l) }))
      .filter(l => {
        if (filtroStatus !== 'todos') return l.statusCalc === filtroStatus;
        return true;
      })
      .filter(l =>
        !busca ||
        l.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        (l.cliente_nome ?? '').toLowerCase().includes(busca.toLowerCase())
      );
    const comFiltrosAv = aplicarFiltrosAvancados(basico, filtrosAv, l => l.data_vencimento, l => l.valor);
    return aplicarOrdenacao(comFiltrosAv, ordenacao, {
      data:    l => l.data_vencimento,
      cliente: l => l.cliente_nome ?? '',
      valor:   l => Number(l.valor ?? 0),
    });
  }, [base, filtroStatus, busca, filtrosAv, ordenacao]);

  // Seleção múltipla: inclui todos os lançamentos, inclusive os vindos de
  // venda. Excluir um lançamento de venda não mexe na venda em si (o
  // pagamento continua lá) — só some da lista do Financeiro, então o
  // valor pago que aparece na tela da venda pode ficar sem bater com os
  // lançamentos aqui. Por isso o aviso de confirmação é mais forte quando
  // a seleção inclui algum desses.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const selecionaveis = filtrados.filter(l => !(l as LancamentoExibido).isDeCaixa);

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

      {/* KPIs */}
      {kpis && kpis.length > 0 && (
        <div className={`grid grid-cols-2 md:grid-cols-${Math.min(kpis.length, 4)} gap-4`}>
          {kpis.map((k, i) => (
            <KpiCard key={i} label={k.label} value={k.value} icon={k.icon} color={k.color} />
          ))}
        </div>
      )}

      {/* Filtros + ações */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => { setEditandoLanc(null); setTipoInicial(fixarTipo ?? 'receita'); setModalOpen(true); }}
          className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5"
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

        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
          {([
            { key: 'todos',    label: 'Todos' },
            { key: 'pendente', label: 'Pendentes' },
            { key: 'atrasado', label: 'Atrasados' },
            { key: 'pago',     label: 'Pagos' },
            { key: 'cancelado', label: 'Cancelados' },
          ] as { key: FiltroStatus; label: string }[]).map(f => (
            <button key={f.key} onClick={() => setFiltroStatus(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filtroStatus === f.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

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
        <FiltrosAvancados valor={filtrosAv} onChange={setFiltrosAv} labelData="Vencimento" labelValor="Valor" />
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
              <th className="px-5 py-3 text-left">Categoria</th>
              <th className="px-5 py-3 text-left">Cliente/Forn.</th>
              <th className="px-5 py-3 text-right">Valor</th>
              <th className="px-5 py-3 text-center">Vencimento</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={!fixarTipo ? 9 : 8} className="px-5 py-12 text-center text-gray-600">
                {mensagemVazio ?? 'Nenhum lançamento encontrado.'}
              </td></tr>
            )}
            {filtrados.map(l => {
              const st = l.statusCalc;
              const isDeVenda = !!l.venda_id;
              const isDeCaixa = !!(l as LancamentoExibido).isDeCaixa;
              const marcado = selecionados.has(l.id);
              return (
                <tr key={l.id} className={`border-b border-gray-800 hover:bg-gray-800/30 transition-colors ${marcado ? 'bg-blue-500/5' : ''}`}>
                  <td className="px-3 py-3 text-center">
                    {!isDeCaixa && (
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
                          <button onClick={() => pagar({ id: l.id })}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/30 transition-all">
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
