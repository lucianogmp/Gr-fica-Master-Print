// src/pages/Vendas/ListaVendas.tsx
// Tabela de vendas reaproveitável — recebe quais status mostrar e título da página.
// Usado por: Pedidos.tsx, Historico.tsx, EmProducao.tsx, Entregues.tsx
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendas, useVendaItens } from '../../hooks/useVendas';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { useRole } from '../../hooks/useRole';
import { Venda, StatusVenda, STATUS_VENDA } from '../../types/venda';
import { KpiCard } from '../../components/ui/KpiCard';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { DollarSign, ClipboardList, X, LucideIcon, Printer, Trash2, CheckSquare } from 'lucide-react';
import { DocumentoImpressaoData } from '../../components/impressao/DocumentoImpressao';
import { imprimirDocumento } from '../../components/impressao/imprimirDocumento';
import { DEFAULT_LAYOUT_VENDA } from '../../types/layoutImpressao';

const fmtBRL  = (v: number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

type KpiConfig = {
  label: string;
  icon: LucideIcon;
  color: string;
  calcular: (vendas: Venda[]) => string | number;
};

type ListaVendasProps = {
  titulo: string;
  icon: LucideIcon;
  /** Quais status aparecem nesta lista. undefined = todos */
  statusPermitidos?: StatusVenda[];
  /** Rota base para abrir o detalhe (ex: '/vendas/nova') */
  rotaDetalhe: string;
  /** Rota desta própria lista, para o botão "Editar" voltar corretamente */
  rotaAtual: string;
  /** KPIs customizados no topo. Se omitido, usa o padrão (total vendido + qtde) */
  kpis?: KpiConfig[];
  /** Mostra filtro de status dentro da lista (útil no Histórico) */
  mostrarFiltroStatus?: boolean;
  /** Mostra botão "+ Nova Venda" */
  mostrarBotaoNovo?: boolean;
  mensagemVazio?: string;
};

export function ListaVendas({
  titulo,
  icon: Icon,
  statusPermitidos,
  rotaDetalhe,
  rotaAtual,
  kpis,
  mostrarFiltroStatus = false,
  mostrarBotaoNovo = false,
  mensagemVazio = 'Nenhuma venda encontrada.',
}: ListaVendasProps) {
  const navigate = useNavigate();
  const { data: vendasTodas = [], isLoading, deletar } = useVendas();
  const { data: cfg } = useConfiguracoes();
  const { confirmar, ConfirmModal } = useConfirm();
  const { isVendedor } = useRole();

  const [filtroExtra, setFiltroExtra] = useState<'todos' | StatusVenda>('todos');
  const [busca, setBusca] = useState('');

  // ── Seleção múltipla ──────────────────────────────────────────────────────
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Filtra pelos status permitidos nesta tela
  const vendasBase = useMemo(() => {
    if (!statusPermitidos) return vendasTodas;
    return vendasTodas.filter(v => statusPermitidos.includes(v.status));
  }, [vendasTodas, statusPermitidos]);

  const filtradas = useMemo(() => vendasBase
    .filter(v => filtroExtra === 'todos' || v.status === filtroExtra)
    .filter(v =>
      !busca ||
      v.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
      (v.numero ? String(v.numero).includes(busca) : false) ||
      (v.palavra_chave ?? '').toLowerCase().includes(busca.toLowerCase())
    ), [vendasBase, filtroExtra, busca]);

  // Impressão a partir da lista
  const [imprimindoId, setImprimindoId] = useState<string | null>(null);
  const [filaImpressao, setFilaImpressao] = useState<string[]>([]);
  const vendaImprimir = vendasTodas.find(v => v.id === imprimindoId) ?? null;
  const { data: itensImprimir } = useVendaItens(imprimindoId);
  const layoutVenda = { ...DEFAULT_LAYOUT_VENDA, ...(cfg?.layout_impressao_venda ?? {}) };

  const docImpressaoLista: DocumentoImpressaoData | null =
    vendaImprimir && itensImprimir ? {
      tipo: 'venda',
      numero: vendaImprimir.numero ?? null,
      data: vendaImprimir.data_venda ?? null,
      dataEntrega: vendaImprimir.data_entrega ?? null,
      clienteNome: vendaImprimir.cliente_nome,
      itens: itensImprimir.map(i => ({
        descricao: i.descricao, quantidade: Number(i.quantidade),
        unidade: i.unidade ?? 'un', precoUnitario: Number(i.preco_unitario),
        desconto: Number(i.desconto ?? 0), total: Number(i.total),
      })),
      subtotal: itensImprimir.reduce((s, i) => s + Number(i.total), 0),
      descontoGlobalPct: Number(vendaImprimir.desconto ?? 0),
      total: Number(vendaImprimir.valor_total ?? vendaImprimir.total ?? 0),
      valorPago: vendaImprimir.valor_pago,
      formaPagamento: vendaImprimir.forma_pagamento,
      observacoes: vendaImprimir.observacoes,
    } : null;

  useEffect(() => {
    if (!imprimindoId || !docImpressaoLista) return;
    imprimirDocumento(layoutVenda, cfg ?? {}, docImpressaoLista);
    setImprimindoId(null);
    // Avança fila de impressão em lote
    setFilaImpressao(prev => {
      if (prev.length > 0) {
        const [next, ...rest] = prev;
        setTimeout(() => setImprimindoId(next), 400);
        return rest;
      }
      return prev;
    });
  }, [imprimindoId, docImpressaoLista]);

  function abrirDetalhe(v: Venda) {
    navigate(`${rotaDetalhe}/${v.id}`, { state: { from: rotaAtual } });
  }

  // ── Helpers de seleção ────────────────────────────────────────────────────
  const todosSelecionados = filtradas.length > 0 && filtradas.every(v => selecionados.has(v.id));
  const algumSelecionado  = selecionados.size > 0;

  const totalSelecionado = useMemo(() =>
    vendasTodas
      .filter(v => selecionados.has(v.id))
      .reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0)
  , [vendasTodas, selecionados]);

  function toggleSelecionado(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodos(e: React.MouseEvent) {
    e.stopPropagation();
    if (todosSelecionados) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filtradas.map(v => v.id)));
    }
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    const ok = await confirmar(
      `Remover ${selecionados.size} venda(s) selecionada(s)? Esta ação não pode ser desfeita.`,
      'Excluir Selecionadas'
    );
    if (!ok) return;
    for (const id of selecionados) {
      deletar(id);
    }
    setSelecionados(new Set());
  }

  function imprimirSelecionados() {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setImprimindoId(ids[0]);
    setFilaImpressao(ids.slice(1));
  }

  // KPIs padrão se não vier customizado
  const kpisBase: KpiConfig[] = kpis ?? [
    {
      label: 'Total',
      icon: DollarSign,
      color: 'text-green-400',
      calcular: (lista) => fmtBRL(lista.reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0)),
    },
    {
      label: 'Quantidade',
      icon: ClipboardList,
      color: 'text-blue-400',
      calcular: (lista) => lista.length,
    },
  ];

  // Vendedor não vê o valor total consolidado de vendas — só o valor de
  // cada venda individualmente na tabela. Sem opção de revelar aqui.
  const kpisAtivos = kpisBase.filter(k => !(isVendedor && k.label === 'Total'));

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Icon className="w-6 h-6 text-blue-400" /> {titulo}
            </h1>
            <p className="text-gray-500 text-sm">{vendasBase.length} venda(s)</p>
          </div>
          {mostrarBotaoNovo && (
            <button
              onClick={() => navigate(`${rotaDetalhe}/__novo__`, { state: { from: rotaAtual } })}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30"
            >
              + Nova Venda
            </button>
          )}
        </div>

        <div className={`grid grid-cols-2 gap-4 ${kpisAtivos.length === 2 ? 'md:grid-cols-2' : kpisAtivos.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          {kpisAtivos.map((k, i) => (
            <KpiCard key={i} label={k.label} value={k.calcular(vendasBase)} icon={k.icon} color={k.color} />
          ))}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {mostrarFiltroStatus && (
            <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
              {(['todos', ...(statusPermitidos ?? Object.keys(STATUS_VENDA) as StatusVenda[])] as const).map(f => (
                <button key={f} onClick={() => setFiltroExtra(f as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                    filtroExtra === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}>
                  {f === 'todos' ? 'Todos' : STATUS_VENDA[f as StatusVenda]?.label ?? f}
                </button>
              ))}
            </div>
          )}
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por cliente, nº ou palavra-chave..."
            className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* ── Barra de ações em massa ── */}
        {algumSelecionado && (
          <div className="flex items-center gap-3 bg-blue-600/10 border border-blue-500/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-blue-300">
              <CheckSquare className="w-4 h-4" />
              <span className="text-sm font-bold">{selecionados.size} selecionada(s)</span>
            </div>
            <div className="w-px h-5 bg-blue-500/30" />
            <div className="flex-1">
              <span className="text-xs text-gray-400">Total selecionado: </span>
              <span className="text-sm font-black text-green-400">{fmtBRL(totalSelecionado)}</span>
            </div>
            <button
              onClick={imprimirSelecionados}
              disabled={!!imprimindoId}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-500/20 text-gray-300 hover:bg-gray-500/35 border border-gray-500/30 disabled:opacity-40 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir selecionadas
            </button>
            <button
              onClick={excluirSelecionados}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir selecionadas
            </button>
            <button
              onClick={() => setSelecionados(new Set())}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="Limpar seleção"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                {/* Checkbox selecionar todos */}
                <th className="px-4 py-3 text-center w-10">
                  <button
                    onClick={toggleTodos}
                    title={todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
                    className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all mx-auto"
                    style={{
                      background: todosSelecionados ? '#2563eb' : 'transparent',
                      borderColor: todosSelecionados ? '#2563eb' : '#4b5563',
                    }}
                  >
                    {todosSelecionados && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {!todosSelecionados && filtradas.some(v => selecionados.has(v.id)) && (
                      <div className="w-2 h-2 rounded-sm bg-blue-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">Nº</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Entrega</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-600">{mensagemVazio}</td></tr>
              )}
              {filtradas.map(v => {
                const st = STATUS_VENDA[v.status] ?? STATUS_VENDA.orcamento;
                const totalPago  = Number(v.valor_pago ?? 0);
                const totalVenda = Number(v.valor_total ?? v.total ?? 0);
                const quitado = totalVenda > 0 && totalPago >= totalVenda;
                const isSel = selecionados.has(v.id);
                return (
                  <tr key={v.id} onClick={() => abrirDetalhe(v)}
                    className={`border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer ${
                      isSel ? 'bg-blue-600/5' : ''
                    }`}>
                    {/* Checkbox por linha */}
                    <td className="px-4 py-3 text-center" onClick={e => toggleSelecionado(v.id, e)}>
                      <button
                        className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all mx-auto"
                        style={{
                          background: isSel ? '#2563eb' : 'transparent',
                          borderColor: isSel ? '#2563eb' : '#4b5563',
                        }}
                        tabIndex={-1}
                      >
                        {isSel && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{v.numero ? `#${v.numero}` : '—'}</td>
                    <td className="px-4 py-3 font-medium text-white">{v.cliente_nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtData(v.data_venda)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtData(v.data_entrega)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-white">
                        {fmtBRL(v.valor_total ?? v.total)}
                        {Number((v as any).valor_original ?? 0) > 0 &&
                         Number((v as any).valor_original) > Number(v.valor_total ?? v.total ?? 0) && (
                          <span className="ml-1 text-[9px] text-gray-600 line-through font-normal">
                            {fmtBRL((v as any).valor_original)}
                          </span>
                        )}
                      </div>
                      {quitado
                        ? <div className="text-[9px] text-green-400 font-bold">QUITADO</div>
                        : totalPago > 0
                        ? <div className="text-[9px] text-yellow-400">Pago: {fmtBRL(totalPago)}</div>
                        : null
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${st.cor}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => abrirDetalhe(v)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all">
                          Editar
                        </button>
                        <button
                          onClick={() => setImprimindoId(v.id)}
                          disabled={imprimindoId === v.id}
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gray-500/15 text-gray-300 hover:bg-gray-500/25 border border-gray-500/30 disabled:opacity-40 transition-all"
                        >
                          {imprimindoId === v.id ? '...' : 'Imprimir'}
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirmar(`Remover a venda de "${v.cliente_nome}"? Esta ação não pode ser desfeita.`, 'Remover Venda'))
                              deletar(v.id);
                          }}
                          className="flex items-center justify-center px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all"
                        >
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
    </>
  );
}
