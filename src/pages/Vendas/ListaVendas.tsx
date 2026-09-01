// src/pages/Vendas/ListaVendas.tsx
// Tabela de vendas reaproveitável — recebe quais status mostrar e título da página.
// Usado por: Pedidos.tsx, Historico.tsx, EmProducao.tsx, Entregues.tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendas, useVendaItens } from '../../hooks/useVendas';
import { useClientes } from '../../hooks/useClientes';
import { formatarEnderecoCliente } from '../../types/cliente';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { useRole } from '../../hooks/useRole';
import { Venda, StatusVenda, STATUS_VENDA } from '../../types/venda';
import { KpiCard } from '../../components/ui/KpiCard';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { DollarSign, ClipboardList, X, LucideIcon, ChevronLeft, ChevronRight, Printer, CheckSquare, Square } from 'lucide-react';
import { MonthInput } from '../../components/ui/MonthInput';
import { OrdenarMenu, aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';
import { FiltrosAvancados, aplicarFiltrosAvancados, FiltrosAvancadosValor } from '../../components/ui/FiltrosAvancados';
import { useEffect } from 'react';
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
  const { data: clientes = [] } = useClientes();
  const { data: cfg } = useConfiguracoes();
  const { confirmar, ConfirmModal } = useConfirm();
  const { isVendedor } = useRole();

  const [filtroExtra, setFiltroExtra] = useState<'todos' | StatusVenda>('todos');
  const [busca, setBusca] = useState('');
  // Ordenação e filtros avançados — padrão do sistema (ver OrdenarMenu.tsx
  // e FiltrosAvancados.tsx), reaproveitado em todas as listas.
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>({ campo: 'data', direcao: 'desc' });
  const [filtrosAv, setFiltrosAv] = useState<FiltrosAvancadosValor>({});

  // Filtro de mês: por padrão só mostra o mês atual, pra não empilhar vendas
  // antigas na tela sem necessidade — mas é fácil trocar de mês ou ver tudo.
  const mesAtualYM = useMemo(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [mes, setMes] = useState<string | null>(mesAtualYM);

  function deslocarMes(delta: number) {
    setMes(atual => {
      const base = atual ?? mesAtualYM;
      const [y, m] = base.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }

  // Filtra pelos status permitidos nesta tela
  const vendasBase = useMemo(() => {
    if (!statusPermitidos) return vendasTodas;
    return vendasTodas.filter(v => statusPermitidos.includes(v.status));
  }, [vendasTodas, statusPermitidos]);

  // Só o filtro de mês, sem status/busca — usado no header e nos KPIs, que
  // ficam estáveis conforme você clica nas abas de status (igual sempre foi),
  // só que agora escopados ao mês selecionado.
  const vendasDoMes = useMemo(() =>
    vendasBase.filter(v => !mes || (v.data_venda ?? '').startsWith(mes)),
    [vendasBase, mes]
  );

  const filtradas = useMemo(() => {
    const base = vendasBase
      .filter(v => filtroExtra === 'todos' || v.status === filtroExtra)
      .filter(v => !mes || (v.data_venda ?? '').startsWith(mes))
      .filter(v =>
        !busca ||
        v.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
        (v.numero ? String(v.numero).includes(busca) : false) ||
        (v.palavra_chave ?? '').toLowerCase().includes(busca.toLowerCase())
      );
    const comFiltrosAv = aplicarFiltrosAvancados(base, filtrosAv, v => v.data_venda, v => v.valor_total);
    return aplicarOrdenacao(comFiltrosAv, ordenacao, {
      data:    v => v.data_venda,
      cliente: v => v.cliente_nome,
      valor:   v => Number(v.valor_total ?? 0),
      numero:  v => Number(v.numero ?? 0),
    });
  }, [vendasBase, filtroExtra, mes, busca, filtrosAv, ordenacao]);

  // Impressão a partir da lista
  const [imprimindoId, setImprimindoId] = useState<string | null>(null);
  const vendaImprimir = vendasTodas.find(v => v.id === imprimindoId) ?? null;
  const { data: itensImprimir } = useVendaItens(imprimindoId);
  const layoutVenda = { ...DEFAULT_LAYOUT_VENDA, ...(cfg?.layout_impressao_venda ?? {}) };

  // Seleção múltipla: marca várias vendas pra imprimir em lote (sequencial),
  // excluir em lote, ou só ver a soma (ex: "quanto esse cliente comprou
  // esse mês" — marca tudo dele e olha o total aqui embaixo).
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [filaImpressao, setFilaImpressao] = useState<string[]>([]);

  function toggleSelecionada(id: string) {
    setSelecionadas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleTodasVisiveis() {
    setSelecionadas(prev => {
      const todasMarcadas = filtradas.every(v => prev.has(v.id));
      const next = new Set(prev);
      if (todasMarcadas) {
        filtradas.forEach(v => next.delete(v.id));
      } else {
        filtradas.forEach(v => next.add(v.id));
      }
      return next;
    });
  }
  const totalSelecionadas = vendasTodas
    .filter(v => selecionadas.has(v.id))
    .reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0);

  function imprimirSelecionadas() {
    if (selecionadas.size === 0) return;
    setFilaImpressao(Array.from(selecionadas));
  }

  // Processa a fila uma de cada vez — só chama a próxima quando a anterior
  // já disparou a janela de impressão (senão os popups de impressão do
  // navegador se atropelam e só a última funciona direito).
  useEffect(() => {
    if (imprimindoId === null && filaImpressao.length > 0) {
      const [proximo, ...resto] = filaImpressao;
      setFilaImpressao(resto);
      setImprimindoId(proximo);
    }
  }, [imprimindoId, filaImpressao]);

  async function excluirSelecionadas() {
    if (selecionadas.size === 0) return;
    const ok = await confirmar(
      `Remover ${selecionadas.size} venda(s) selecionada(s)? Essa ação não pode ser desfeita.`,
      'Excluir vendas selecionadas'
    );
    if (!ok) return;
    selecionadas.forEach(id => deletar(id));
    setSelecionadas(new Set());
  }

  const docImpressaoLista: DocumentoImpressaoData | null =
    vendaImprimir && itensImprimir ? {
      tipo: 'venda',
      numero: vendaImprimir.numero ?? null,
      data: vendaImprimir.data_venda ?? null,
      dataEntrega: vendaImprimir.data_entrega ?? null,
      clienteNome: vendaImprimir.cliente_nome,
      clienteTelefone: clientes.find(c => c.id === vendaImprimir.cliente_id)?.telefone ?? null,
      clienteEmail: clientes.find(c => c.id === vendaImprimir.cliente_id)?.email ?? null,
      clienteEndereco: formatarEnderecoCliente(clientes.find(c => c.id === vendaImprimir.cliente_id)) || null,
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
  }, [imprimindoId, docImpressaoLista]);

  function abrirDetalhe(v: Venda) {
    navigate(`${rotaDetalhe}/${v.id}`, { state: { from: rotaAtual } });
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
      <div className={`p-6 space-y-6 ${selecionadas.size > 0 ? 'pb-24' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Icon className="w-6 h-6 text-blue-400" /> {titulo}
            </h1>
            <p className="text-gray-500 text-sm">{vendasDoMes.length} venda(s){mes ? ' neste mês' : ''}</p>
          </div>
          {mostrarBotaoNovo && (
            <button
              onClick={() => navigate(`${rotaDetalhe}/__novo__`, { state: { from: rotaAtual } })}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 whitespace-nowrap"
            >
              + Nova Venda
            </button>
          )}
        </div>

        <div className={`grid grid-cols-2 gap-4 ${kpisAtivos.length === 2 ? 'md:grid-cols-2' : kpisAtivos.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          {kpisAtivos.map((k, i) => (
            <KpiCard key={i} label={k.label} value={k.calcular(vendasDoMes)} icon={k.icon} color={k.color} />
          ))}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* Navegador de mês — padrão mês atual, ajustável ou removível */}
          <div className="flex items-center gap-1 bg-[#1f2937] border border-gray-700 rounded-xl px-1.5 py-1.5 flex-shrink-0">
            <button onClick={() => deslocarMes(-1)} title="Mês anterior"
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <MonthInput
              value={mes}
              onChange={v => setMes(v || null)}
              className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs font-bold capitalize min-w-[132px]"
            />
            <button onClick={() => deslocarMes(1)} title="Próximo mês"
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {mes ? (
            <button onClick={() => setMes(null)}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline flex-shrink-0">
              Ver todos os meses
            </button>
          ) : (
            <button onClick={() => setMes(mesAtualYM)}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline flex-shrink-0">
              Voltar pro mês atual
            </button>
          )}

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
          <OrdenarMenu
            valor={ordenacao}
            onChange={setOrdenacao}
            campos={[
              { key: 'data',    label: 'Data',    labelAsc: 'Mais antiga primeiro', labelDesc: 'Mais recente primeiro' },
              { key: 'valor',   label: 'Valor',   labelAsc: 'Menor primeiro',       labelDesc: 'Maior primeiro' },
              { key: 'cliente', label: 'Cliente',  labelAsc: 'A → Z',                labelDesc: 'Z → A' },
              { key: 'numero',  label: 'Nº da venda' },
            ]}
          />
          <FiltrosAvancados valor={filtrosAv} onChange={setFiltrosAv} mostrarData={false} labelValor="Valor da venda" />
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-3 py-3 text-center w-8">
                  <button onClick={toggleTodasVisiveis} title="Selecionar/desmarcar todas visíveis" className="text-gray-500 hover:text-blue-400 transition-colors">
                    {filtradas.length > 0 && filtradas.every(v => selecionadas.has(v.id))
                      ? <CheckSquare className="w-4 h-4 text-blue-400" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-5 py-3 text-left">Nº</th>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">Data</th>
                <th className="px-5 py-3 text-left">Entrega</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Ações</th>
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
                const marcada = selecionadas.has(v.id);
                return (
                  <tr key={v.id} onClick={() => abrirDetalhe(v)}
                    className={`border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer ${marcada ? 'bg-blue-500/5' : ''}`}>
                    <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleSelecionada(v.id)} className="text-gray-500 hover:text-blue-400 transition-colors">
                        {marcada ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{v.numero ? `#${v.numero}` : '—'}</td>
                    <td className="px-5 py-3 font-medium text-white">{v.cliente_nome || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(v.data_venda)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(v.data_entrega)}</td>
                    <td className="px-5 py-3 text-right">
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
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${st.cor}`}>{st.label}</span>
                    </td>
                    <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
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
      </div>

      {/* Barra de seleção — fixa embaixo, só aparece com algo marcado */}
      {selecionadas.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1f2937] border-t border-blue-500/40 shadow-2xl shadow-black/50">
          <div className="max-w-full px-6 py-3 flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-300">
              <span className="font-black text-white">{selecionadas.size}</span> selecionada{selecionadas.size > 1 ? 's' : ''}
            </span>
            <span className="text-sm font-black text-green-400">{fmtBRL(totalSelecionadas)}</span>
            <div className="flex-1" />
            <button onClick={() => setSelecionadas(new Set())}
              className="text-xs font-bold text-gray-400 hover:text-white transition-colors">
              Limpar seleção
            </button>
            <button onClick={imprimirSelecionadas} disabled={filaImpressao.length > 0 || imprimindoId !== null}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white transition-all">
              <Printer className="w-3.5 h-3.5" />
              {filaImpressao.length > 0 || imprimindoId !== null ? 'Imprimindo...' : 'Imprimir selecionadas'}
            </button>
            <button onClick={excluirSelecionadas}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all">
              <X className="w-3.5 h-3.5" /> Excluir selecionadas
            </button>
          </div>
        </div>
      )}
    </>
  );
}
