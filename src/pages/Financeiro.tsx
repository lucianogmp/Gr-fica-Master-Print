// src/pages/Financeiro.tsx
//
// Módulo financeiro reorganizado em sub-abas:
//   • Lançamentos  — contas a pagar/receber manuais
//   • Vendas       — entradas geradas por vendas (com forma de pagamento, status, link)
//   • Fluxo de Caixa — movimentos de caixa
//   • Resumo       — KPIs consolidados
//
// Ao clicar numa venda dentro da aba Vendas, abre o editor de venda na mesma
// página com um estado "origem=financeiro". Ao fechar/salvar, volta para cá.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLancamentos } from '../hooks/useLancamentos';
import { useVendas, useVendaItens } from '../hooks/useVendas';
import { useClientes } from '../hooks/useClientes';
import { usePagamentosVenda } from '../hooks/usePagamentosVenda';
import { useCaixaMovimentos } from '../hooks/useCaixaMovimentos';
import { useConfiguracoes } from '../hooks/useConfiguracoes';
import { useProducao } from '../hooks/useProducao';
import { supabase } from '../lib/supabase';
import { Lancamento } from '../types/financeiro';
import { Venda, VendaItem, StatusVenda, STATUS_VENDA } from '../types/venda';
import { formatarEnderecoCliente } from '../types/cliente';
import {
  FORMAS_PAGAMENTO_DEFAULT,
  parseFormas,
} from '../types/configuracoes';
import { ModalLancamento } from '../components/financeiro/ModalLancamento';
import { ItensEditor } from '../components/vendas/ItensEditor';
import { ClienteSelectorVenda } from '../components/vendas/ClienteSelectorVenda';
import { VendedorSelector } from '../components/vendas/VendedorSelector';
import { PainelFinanceiro } from '../components/vendas/PainelFinanceiro';
import { KpiCard } from '../components/ui/KpiCard';
import { useConfirm } from '../components/ui/ConfirmModal';
import { DateInput } from '../components/ui/DateInput';
import toast from 'react-hot-toast';
import {
  Landmark, TrendingUp, TrendingDown, Clock, Banknote,
  ArrowUp, ArrowDown, AlertCircle, Check, X, ShoppingCart,
  DollarSign, CreditCard, ArrowLeft, Save, Package,
  Settings, Printer, Calendar, AlertTriangle, BarChart3,
  Wallet, Sparkles, ArrowDownToLine, ArrowUpFromLine, ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { DocumentoImpressaoData } from '../components/impressao/DocumentoImpressao';
import { imprimirDocumento } from '../components/impressao/imprimirDocumento';
import { DEFAULT_LAYOUT_VENDA } from '../types/layoutImpressao';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtBRL  = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

function parseFormasLocal(raw: any) {
  if (!raw) return FORMAS_PAGAMENTO_DEFAULT;
  if (Array.isArray(raw)) return raw.length > 0 ? raw : FORMAS_PAGAMENTO_DEFAULT;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length > 0) return p;
    } catch { /* */ }
  }
  return FORMAS_PAGAMENTO_DEFAULT;
}

const STATUS_COR: Record<string, string> = {
  pago:      'bg-green-500/15 text-green-400 border-green-500/30',
  pendente:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  atrasado:  'bg-red-500/15 text-red-400 border-red-500/30',
  cancelado: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

function calcStatusLanc(l: Lancamento): string {
  if (l.status === 'pago' || l.status === 'cancelado') return l.status;
  if (l.data_vencimento && new Date(l.data_vencimento + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0)))
    return 'atrasado';
  return l.status;
}

type SubAba = 'lancamentos' | 'vendas' | 'fluxo' | 'resumo';
type FiltroLanc = 'todos' | 'receita' | 'despesa' | 'pendente' | 'atrasado';

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

// ── Estado de edição de venda (aberta a partir do financeiro) ────────────────
const NOVA_VENDA_FORM = {
  cliente_nome:    '',
  cliente_id:      null as string | null,
  status:          'orcamento' as StatusVenda,
  desconto:        0,
  frete:           0,
  taxa_adicional:  0,
  parcelas:        1,
  juros:           0,
  observacoes:     '',
  consumidor_final: false,
  data_entrega:    '',
  data_venda:      new Date().toISOString().split('T')[0],
  vendedor:        '',
  vendedor_id:     null as string | null,
  palavra_chave:   '',
  tipo:            '',
  valor_total:     0,
  valor_pago:      0,
  forma_pagamento: '',
};

// Extrai venda_id de observações no formato "pagamento_venda:UUID"
function extrairVendaId(obs?: string | null): string | null {
  if (!obs) return null;
  const match = obs.match(/pagamento_venda[:\-_]([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

export function Financeiro() {
  const navigate = useNavigate();
  const { data: lancamentos = [], isLoading: loadLanc, criar, atualizar, pagar, deletar, isSaving } = useLancamentos();
  const { data: vendas = [], isLoading: loadVendas, atualizar: atualizarVenda, isSaving: isSavingVenda } = useVendas();
  const { data: clientes = [] } = useClientes();
  const { data: movimentos = [], isLoading: loadMov } = useCaixaMovimentos();
  const { data: cfg } = useConfiguracoes();
  const { criar: criarOP } = useProducao();
  const { confirmar, ConfirmModal } = useConfirm();

  // Sub-aba ativa
  const [subAba, setSubAba] = useState<SubAba>('lancamentos');

  // Estado do modal de lançamento
  const [modalOpen, setModalOpen]     = useState(false);
  const [editandoLanc, setEditandoLanc] = useState<Lancamento | null>(null);
  const [tipoInicial, setTipoInicial] = useState<'receita' | 'despesa'>('despesa');
  const [filtroLanc, setFiltroLanc]   = useState<FiltroLanc>('todos');
  const [buscaLanc, setBuscaLanc]     = useState('');
  const [mesLanc, setMesLanc]         = useState(() => new Date().toISOString().slice(0, 7));

  // Estado da sub-aba Vendas
  const [buscaVenda, setBuscaVenda]   = useState('');
  const [filtroVendaStatus, setFiltroVendaStatus] = useState<StatusVenda | 'todos'>('todos');

  // Estado de edição de venda (aberta dentro do financeiro)
  const [vendaEditandoId, setVendaEditandoId] = useState<string | null>(null);
  const [formVenda, setFormVenda]   = useState({ ...NOVA_VENDA_FORM });
  const [itensVenda, setItensVenda] = useState<VendaItem[]>([]);

  const { data: itensCarregados } = useVendaItens(vendaEditandoId);
  const {
    data: pagamentosVenda = [],
    registrar: registrarPagamento,
    excluir: excluirPagamento,
    isRegistrando,
  } = usePagamentosVenda(vendaEditandoId);

  // Carrega itens quando abre venda
  useMemo(() => {
    if (itensCarregados !== undefined && vendaEditandoId) {
      setItensVenda(itensCarregados);
    }
  }, [itensCarregados, vendaEditandoId]);

  // Sub-aba Fluxo
  const [mesFx, setMesFx] = useState(() => new Date().toISOString().slice(0, 7));

  // ── KPIs do mês (lançamentos) ──────────────────────────────────────────────
  const doMes = useMemo(() => lancamentos.filter(l => {
    const d = l.data_vencimento ?? l.created_at ?? '';
    return d.startsWith(mesLanc);
  }), [lancamentos, mesLanc]);

  const totalReceitas  = doMes.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas  = doMes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
  const aReceber       = lancamentos.filter(l => l.tipo === 'receita' && l.status !== 'pago' && l.status !== 'cancelado').reduce((s, l) => s + Number(l.valor), 0);
  const aPagar         = lancamentos.filter(l => l.tipo === 'despesa' && l.status !== 'pago' && l.status !== 'cancelado').reduce((s, l) => s + Number(l.valor), 0);

  // ── Lançamentos filtrados ──────────────────────────────────────────────────
  const lancsFiltrados = useMemo(() => {
    return lancamentos
      .map(l => ({ ...l, statusCalc: calcStatusLanc(l) }))
      .filter(l => {
        if (filtroLanc === 'receita')  return l.tipo === 'receita';
        if (filtroLanc === 'despesa')  return l.tipo === 'despesa';
        if (filtroLanc === 'pendente') return l.statusCalc === 'pendente';
        if (filtroLanc === 'atrasado') return l.statusCalc === 'atrasado';
        return true;
      })
      .filter(l =>
        !buscaLanc ||
        l.descricao.toLowerCase().includes(buscaLanc.toLowerCase()) ||
        (l.cliente_nome ?? '').toLowerCase().includes(buscaLanc.toLowerCase())
      );
  }, [lancamentos, filtroLanc, buscaLanc]);

  // ── Vendas como entradas financeiras ──────────────────────────────────────
  const vendasFinanceiro = useMemo(() => {
    return vendas
      .filter(v => v.status !== 'cancelado')
      .filter(v => {
        if (filtroVendaStatus !== 'todos') return v.status === filtroVendaStatus;
        return true;
      })
      .filter(v =>
        !buscaVenda ||
        v.cliente_nome.toLowerCase().includes(buscaVenda.toLowerCase()) ||
        (v.numero ? String(v.numero).includes(buscaVenda) : false)
      );
  }, [vendas, filtroVendaStatus, buscaVenda]);

  // KPIs das vendas
  const totalVendasValor = vendas.filter(v => v.status !== 'cancelado').reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0);
  const totalVendasPago  = vendas.filter(v => v.status !== 'cancelado').reduce((s, v) => s + Number(v.valor_pago ?? 0), 0);
  const totalVendasRest  = Math.max(0, totalVendasValor - totalVendasPago);

  // ── Fluxo de caixa ────────────────────────────────────────────────────────
  const movDoMes = useMemo(() =>
    movimentos.filter(m => (m.data ?? '').startsWith(mesFx)),
    [movimentos, mesFx]
  );
  const entradas = movDoMes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const saidas   = movDoMes.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const saldo    = entradas - saidas;
  const hoje     = new Date().toISOString().split('T')[0];
  const receber  = lancamentos.filter(l => l.tipo === 'receita' && l.status !== 'pago' && l.status !== 'cancelado' && (l.data_vencimento ?? '') >= hoje).reduce((s, l) => s + Number(l.valor), 0);
  const pagar2   = lancamentos.filter(l => l.tipo === 'despesa' && l.status !== 'pago' && l.status !== 'cancelado' && (l.data_vencimento ?? '') >= hoje).reduce((s, l) => s + Number(l.valor), 0);
  const porData  = useMemo(() => {
    const map: Record<string, typeof movDoMes> = {};
    [...movDoMes].sort((a, b) => b.data.localeCompare(a.data)).forEach(m => {
      if (!map[m.data]) map[m.data] = [];
      map[m.data].push(m);
    });
    return map;
  }, [movDoMes]);
  const datas = Object.keys(porData).sort((a, b) => b.localeCompare(a));

  // ── Abrir venda para edição (dentro do financeiro) ────────────────────────
  function abrirVenda(v: Venda) {
    setVendaEditandoId(v.id);
    setItensVenda([]);
    setFormVenda({
      cliente_nome:    v.cliente_nome,
      cliente_id:      (v as any).cliente_id ?? null,
      status:          v.status,
      desconto:        Number(v.desconto ?? 0),
      frete:           Number((v as any).frete ?? 0),
      taxa_adicional:  Number((v as any).taxa_adicional ?? 0),
      parcelas:        Number((v as any).parcelas ?? 1),
      juros:           Number((v as any).juros_parcelas ?? 0),
      observacoes:     v.observacoes ?? '',
      consumidor_final: v.consumidor_final ?? false,
      data_entrega:    v.data_entrega ?? '',
      data_venda:      v.data_venda ?? new Date().toISOString().split('T')[0],
      vendedor:        v.vendedor ?? '',
      vendedor_id:     (v as any).vendedor_id ?? null,
      palavra_chave:   v.palavra_chave ?? '',
      tipo:            v.tipo ?? '',
      valor_total:     Number(v.valor_total ?? v.total ?? 0),
      valor_pago:      Number(v.valor_pago ?? 0),
      forma_pagamento: v.forma_pagamento ?? '',
    });
  }

  function fecharVenda() {
    setVendaEditandoId(null);
    setFormVenda({ ...NOVA_VENDA_FORM });
    setItensVenda([]);
  }

  function setFV(f: keyof typeof NOVA_VENDA_FORM, v: any) {
    setFormVenda(p => ({ ...p, [f]: v }));
  }

  // Cálculos financeiros da venda sendo editada
  const subtotalV      = itensVenda.reduce((s, i) => s + Number(i.total), 0);
  const descontoValorV = subtotalV * (formVenda.desconto / 100);
  const totalBaseV     = subtotalV - descontoValorV + Number(formVenda.frete || 0) + Number(formVenda.taxa_adicional || 0);
  const totalFinalV    = totalBaseV; // simplificado — juros calculados no PainelFinanceiro

  async function salvarVenda() {
    if (!vendaEditandoId) return;
    const payload = {
      cliente_nome:    formVenda.cliente_nome,
      cliente_id:      formVenda.cliente_id,
      status:          formVenda.status,
      desconto:        formVenda.desconto,
      frete:           formVenda.frete,
      taxa_adicional:  formVenda.taxa_adicional,
      parcelas:        formVenda.parcelas,
      juros_parcelas:  formVenda.juros,
      observacoes:     formVenda.observacoes,
      consumidor_final: formVenda.consumidor_final,
      data_entrega:    formVenda.data_entrega || null,
      data_venda:      formVenda.data_venda,
      vendedor:        formVenda.vendedor,
      vendedor_id:     formVenda.vendedor_id,
      palavra_chave:   formVenda.palavra_chave,
      tipo:            formVenda.tipo,
      valor_total:     totalFinalV,
      valor_pago:      formVenda.valor_pago,
      forma_pagamento: formVenda.forma_pagamento,
    };
    await atualizarVenda({ id: vendaEditandoId, payload: payload as any, itens: itensVenda });
    fecharVenda();
  }

  async function handleMudarStatusVenda(novoStatus: StatusVenda) {
    setFV('status', novoStatus);
    if (vendaEditandoId) {
      const { atualizarStatus } = await import('../hooks/useVendas').then(m => {
        // re-use the hook's method via the already-loaded vendas hook
        return { atualizarStatus: null };
      });
      // Atualiza direto no supabase para não recarregar o hook
      await supabase.from('vendas').update({ status: novoStatus, updated_at: new Date().toISOString() }).eq('id', vendaEditandoId);
      if (novoStatus === 'producao') {
        try {
          const v = vendas.find(x => x.id === vendaEditandoId);
          if (v) {
            await criarOP({
              titulo: v.tipo?.trim() || 'Sem título',
              descricao: v.observacoes ?? null,
              etapa: 'fila', prioridade: 'normal', responsavel: null,
              data_entrega: v.data_entrega ?? null, venda_id: v.id,
            } as any);
            toast.success('Ordem de Produção criada!');
          }
        } catch { /* best-effort */ }
      }
    }
  }

  const layoutVenda = { ...DEFAULT_LAYOUT_VENDA, ...(cfg?.layout_impressao_venda ?? {}) };
  const vendaAtual = vendas.find(v => v.id === vendaEditandoId);
  const docImpressao: DocumentoImpressaoData | null = vendaAtual ? {
    tipo: 'venda',
    numero: vendaAtual.numero ?? null,
    data: formVenda.data_venda ?? null,
    dataEntrega: formVenda.data_entrega ?? null,
    clienteNome: formVenda.cliente_nome,
    clienteTelefone: clientes.find(c => c.id === formVenda.cliente_id)?.telefone ?? null,
    clienteEmail: clientes.find(c => c.id === formVenda.cliente_id)?.email ?? null,
    clienteEndereco: formatarEnderecoCliente(clientes.find(c => c.id === formVenda.cliente_id)) || null,
    itens: itensVenda.map(i => ({
      descricao: i.descricao, quantidade: Number(i.quantidade),
      unidade: i.unidade ?? 'un', precoUnitario: Number(i.preco_unitario),
      desconto: Number(i.desconto ?? 0), total: Number(i.total),
    })),
    subtotal: subtotalV,
    descontoGlobalPct: formVenda.desconto,
    total: totalFinalV,
    valorPago: formVenda.valor_pago,
    formaPagamento: formVenda.forma_pagamento,
    observacoes: formVenda.observacoes,
  } : null;

  // ── RENDER: edição de venda (overlay dentro do financeiro) ────────────────
  if (vendaEditandoId && vendaAtual) {
    return (
      <>
        <ConfirmModal />
        <div className="p-6 space-y-6">
          {/* Header com botão voltar para financeiro */}
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={fecharVenda}
              className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
              title="Voltar ao Financeiro"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  Financeiro
                </span>
                <span className="text-gray-600">/</span>
                <h1 className="text-xl font-black text-white">
                  Venda {vendaAtual.numero ? `#${vendaAtual.numero}` : ''} — {formVenda.cliente_nome || 'Editar'}
                </h1>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">
                Ao salvar ou fechar, volta para o Financeiro
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {docImpressao && (
                <button
                  onClick={() => imprimirDocumento(layoutVenda, cfg ?? {}, docImpressao)}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
              )}
              <button
                onClick={fecharVenda}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Fechar
              </button>
              <button
                onClick={salvarVenda}
                disabled={isSavingVenda || !formVenda.cliente_nome.trim()}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {isSavingVenda ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Coluna principal */}
            <div className="xl:col-span-2 space-y-5">

              {/* Dados da venda */}
              <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Dados da Venda
                </h3>
                <div className="space-y-4">
                  <ClienteSelectorVenda
                    value={formVenda.cliente_nome}
                    clienteId={formVenda.cliente_id}
                    onChange={(nome, id) => { setFV('cliente_nome', nome); setFV('cliente_id', id ?? null); }}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Data da Venda</label>
                      <DateInput value={formVenda.data_venda} onChange={v => setFV('data_venda', v)} className={IN} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Data de Entrega</label>
                      <DateInput value={formVenda.data_entrega} onChange={v => setFV('data_entrega', v)} className={IN} />
                    </div>
                  </div>
                  <VendedorSelector
                    value={formVenda.vendedor}
                    vendedorId={formVenda.vendedor_id}
                    onChange={(nome, id) => { setFV('vendedor', nome); setFV('vendedor_id', id ?? null); }}
                  />
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Observações</label>
                    <textarea rows={2} value={formVenda.observacoes ?? ''} onChange={e => setFV('observacoes', e.target.value)} className={IN + ' resize-none'} />
                  </div>
                </div>
              </div>

              {/* Itens */}
              <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Itens da Venda
                </h3>
                <ItensEditor itens={itensVenda} onChange={setItensVenda} />
              </div>
            </div>

            {/* Coluna lateral */}
            <div className="space-y-4">
              <PainelFinanceiro
                subtotal={subtotalV}
                desconto={formVenda.desconto}
                frete={formVenda.frete}
                taxaAdicional={formVenda.taxa_adicional}
                parcelas={formVenda.parcelas}
                formaPagamento={formVenda.forma_pagamento}
                valorPago={formVenda.valor_pago}
                pagamentos={pagamentosVenda}
                cfg={cfg}
                vendaId={vendaEditandoId}
                onDescontoChange={v => setFV('desconto', v)}
                onFreteChange={v => setFV('frete', v)}
                onTaxaChange={v => setFV('taxa_adicional', v)}
                onParcelasChange={v => setFV('parcelas', v)}
                onFormaPagamentoChange={v => setFV('forma_pagamento', v)}
                onRegistrarPagamento={registrarPagamento}
                onExcluirPagamento={excluirPagamento}
                isRegistrando={isRegistrando}
              />

              {/* Status */}
              <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" /> Status
                </h3>
                <div className="space-y-1.5">
                  {Object.entries(STATUS_VENDA).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => handleMudarStatusVenda(k as StatusVenda)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-between ${
                        formVenda.status === k
                          ? v.cor
                          : 'border-gray-700 text-gray-500 hover:text-white hover:bg-gray-700/30'
                      }`}
                    >
                      {v.label}
                      {k === 'producao' && (
                        <span className="text-[9px] text-yellow-400 font-normal">cria OP</span>
                      )}
                    </button>
                  ))}
                </div>
                {formVenda.status === 'producao' && (
                  <div className="mt-3 flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-yellow-300">
                      Em Produção — verifique a OP criada automaticamente.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  const isLoading = loadLanc || loadVendas || loadMov;
  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Financeiro...</div>;

  const SUB_ABAS: { key: SubAba; label: string; icon: LucideIcon }[] = [
    { key: 'lancamentos', label: 'Lançamentos',   icon: Landmark },
    { key: 'vendas',      label: 'Vendas',        icon: ShoppingCart },
    { key: 'fluxo',       label: 'Fluxo de Caixa', icon: TrendingUp },
    { key: 'resumo',      label: 'Resumo',        icon: BarChart3 },
  ];

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Landmark className="w-6 h-6 text-blue-400" /> Financeiro
            </h1>
            <p className="text-gray-500 text-sm">Lançamentos, vendas, fluxo de caixa e resumo</p>
          </div>
          {(subAba === 'lancamentos' || subAba === 'fluxo') && (
            <div className="flex gap-2">
              <button onClick={() => { setEditandoLanc(null); setTipoInicial('receita'); setModalOpen(true); }}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
                + Entrada
              </button>
              <button onClick={() => { setEditandoLanc(null); setTipoInicial('despesa'); setModalOpen(true); }}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
                + Despesa
              </button>
            </div>
          )}
        </div>

        {/* Sub-abas */}
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
          {SUB_ABAS.map(a => (
            <button
              key={a.key}
              onClick={() => setSubAba(a.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                subAba === a.key ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <a.icon className="w-4 h-4" /> {a.label}
            </button>
          ))}
        </div>

        {/* ─── SUB-ABA: LANÇAMENTOS ─── */}
        {subAba === 'lancamentos' && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="flex items-center gap-3 flex-wrap">
              <input type="month" value={mesLanc} onChange={e => setMesLanc(e.target.value)}
                className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              <span className="text-gray-600 text-xs">KPIs do mês selecionado</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Receitas do mês"   value={fmtBRL(totalReceitas)} icon={TrendingUp}   color="text-green-400" />
              <KpiCard label="Despesas do mês"   value={fmtBRL(totalDespesas)} icon={TrendingDown} color="text-red-400" />
              <KpiCard label="A receber (total)"  value={fmtBRL(aReceber)}     icon={Clock}        color="text-blue-400" />
              <KpiCard label="A pagar (total)"    value={fmtBRL(aPagar)}       icon={Banknote}     color="text-yellow-400" />
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1">
                {([
                  { key: 'todos',    label: 'Todos',     icon: null },
                  { key: 'receita',  label: 'Receitas',  icon: ArrowUp },
                  { key: 'despesa',  label: 'Despesas',  icon: ArrowDown },
                  { key: 'pendente', label: 'Pendentes', icon: Clock },
                  { key: 'atrasado', label: 'Atrasados', icon: AlertCircle },
                ] as { key: FiltroLanc; label: string; icon: any }[]).map(f => (
                  <button key={f.key} onClick={() => setFiltroLanc(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      filtroLanc === f.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}>
                    {f.icon && <f.icon className="w-3 h-3" />} {f.label}
                  </button>
                ))}
              </div>
              <input value={buscaLanc} onChange={e => setBuscaLanc(e.target.value)} placeholder="Buscar..."
                className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>

            {/* Tabela de lançamentos */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
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
                  {lancsFiltrados.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-600">Nenhum lançamento encontrado.</td></tr>
                  )}
                  {lancsFiltrados.map(l => {
                    const st = l.statusCalc;
                    const isDeVenda = !!l.venda_id;
                    return (
                      <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={l.tipo === 'receita' ? 'text-green-400' : 'text-red-400'}>
                              {l.tipo === 'receita' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                            </span>
                            <div>
                              <span className="font-medium text-white">{l.descricao}</span>
                              {isDeVenda && (
                                <span className="ml-2 text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                                  venda
                                </span>
                              )}
                            </div>
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
                          {isDeVenda ? (
                            /* Lançamento gerado por venda — só navega para a venda, sem editar/pagar */
                            <button
                              onClick={() => navigate(`/vendas/${l.venda_id}`)}
                              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all mx-auto"
                            >
                              <ExternalLink className="w-3 h-3" /> Ver venda
                            </button>
                          ) : (
                            /* Lançamento manual — ações completas */
                            <div className="flex gap-1 justify-center">
                              {st !== 'pago' && st !== 'cancelado' && (
                                <button onClick={() => pagar({ id: l.id })}
                                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/30 transition-all">
                                  <Check className="w-3 h-3" /> Pagar
                                </button>
                              )}
                              <button onClick={() => { setEditandoLanc(l); setModalOpen(true); }}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all">
                                Editar
                              </button>
                              <button onClick={async () => { if (await confirmar('Remover este lançamento?')) deletar(l.id); }}
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
          </div>
        )}

        {/* ─── SUB-ABA: VENDAS ─── */}
        {subAba === 'vendas' && (
          <div className="space-y-5">
            {/* KPIs de vendas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard label="Total das vendas"   value={fmtBRL(totalVendasValor)} icon={DollarSign}  color="text-green-400" />
              <KpiCard label="Total recebido"     value={fmtBRL(totalVendasPago)}  icon={Check}       color="text-blue-400" />
              <KpiCard label="A receber (vendas)" value={fmtBRL(totalVendasRest)}  icon={Clock}       color="text-yellow-400" />
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
                {(['todos','orcamento','aprovado','producao','pronto','entregue'] as const).map(f => (
                  <button key={f} onClick={() => setFiltroVendaStatus(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      filtroVendaStatus === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}>
                    {f === 'todos' ? 'Todas' : STATUS_VENDA[f as StatusVenda]?.label ?? f}
                  </button>
                ))}
              </div>
              <input value={buscaVenda} onChange={e => setBuscaVenda(e.target.value)}
                placeholder="Buscar por cliente ou nº..."
                className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>

            {/* Tabela de vendas */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                    <th className="px-5 py-3 text-left">Nº</th>
                    <th className="px-5 py-3 text-left">Cliente</th>
                    <th className="px-5 py-3 text-left">Data / Entrega</th>
                    <th className="px-5 py-3 text-left">Forma de Pgto</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-right">Pago</th>
                    <th className="px-5 py-3 text-right">Restante</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasFinanceiro.length === 0 && (
                    <tr><td colSpan={9} className="px-5 py-12 text-center text-gray-600">Nenhuma venda encontrada.</td></tr>
                  )}
                  {vendasFinanceiro.map(v => {
                    const st        = STATUS_VENDA[v.status] ?? STATUS_VENDA.orcamento;
                    const total     = Number(v.valor_total ?? v.total ?? 0);
                    const pago      = Number(v.valor_pago ?? 0);
                    const restante  = Math.max(0, total - pago);
                    const quitado   = total > 0 && restante <= 0.01;
                    const formasPag = parseFormasLocal(cfg?.formas_pagamento);
                    return (
                      <tr
                        key={v.id}
                        onClick={() => abrirVenda(v)}
                        className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                          {v.numero ? `#${v.numero}` : '—'}
                        </td>
                        <td className="px-5 py-3 font-medium text-white">{v.cliente_nome}</td>
                        <td className="px-5 py-3">
                          <div className="text-xs text-gray-300">{fmtData(v.data_venda)}</div>
                          {v.data_entrega && (
                            <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" /> {fmtData(v.data_entrega)}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {v.forma_pagamento ? (
                            <span className="flex items-center gap-1.5 text-xs text-gray-300">
                              <CreditCard className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              {v.forma_pagamento}
                              {(v as any).parcelas > 1 && (
                                <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full font-bold">
                                  {(v as any).parcelas}x
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-white text-sm">
                          {fmtBRL(total)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-bold text-green-400 text-sm">{fmtBRL(pago)}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {quitado ? (
                            <span className="text-[10px] font-black text-green-400 bg-green-500/15 border border-green-500/30 px-2 py-1 rounded-full">
                              QUITADO
                            </span>
                          ) : (
                            <span className="font-bold text-yellow-400 text-sm">{fmtBRL(restante)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${st.cor}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => abrirVenda(v)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {vendasFinanceiro.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-800/30 border-t border-gray-700">
                      <td colSpan={4} className="px-5 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">
                        Totais filtrados
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-white">
                        {fmtBRL(vendasFinanceiro.reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0))}
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-green-400">
                        {fmtBRL(vendasFinanceiro.reduce((s, v) => s + Number(v.valor_pago ?? 0), 0))}
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-yellow-400">
                        {fmtBRL(vendasFinanceiro.reduce((s, v) => {
                          const t = Number(v.valor_total ?? v.total ?? 0);
                          const p = Number(v.valor_pago ?? 0);
                          return s + Math.max(0, t - p);
                        }, 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── SUB-ABA: FLUXO DE CAIXA ─── */}
        {subAba === 'fluxo' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
              <input type="month" value={mesFx} onChange={e => setMesFx(e.target.value)}
                className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Entradas no mês"  value={fmtBRL(entradas)} icon={ArrowUp}          color="text-green-400" />
              <KpiCard label="Saídas no mês"    value={fmtBRL(saidas)}   icon={ArrowDown}         color="text-red-400" />
              <KpiCard label="Saldo do mês"     value={fmtBRL(saldo)}    icon={Wallet}            color={saldo >= 0 ? 'text-blue-400' : 'text-red-400'} />
              <KpiCard label="Saldo projetado"  value={fmtBRL(saldo + receber - pagar2)} icon={Sparkles} color="text-purple-400" />
            </div>

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
                <p className="text-2xl font-black text-red-400">{fmtBRL(pagar2)}</p>
              </div>
            </div>

            {datas.length === 0 ? (
              <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center text-gray-600">
                Nenhum movimento registrado no período.
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
                        <span className="text-sm font-bold text-white">
                          {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        <div className="flex gap-4 text-xs">
                          {entDia > 0 && <span className="text-green-400 font-bold">+{fmtBRL(entDia)}</span>}
                          {saiDia > 0 && <span className="text-red-400 font-bold">-{fmtBRL(saiDia)}</span>}
                          <span className={`font-black ${entDia - saiDia >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                            = {fmtBRL(entDia - saiDia)}
                          </span>
                        </div>
                      </div>
                      {movs.map(m => (
                        <div key={m.id} className="flex items-center justify-between px-5 py-2.5 border-b border-gray-800 last:border-b-0 hover:bg-gray-800/20 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className={m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}>
                              {m.tipo === 'entrada' ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-white">{m.descricao}</p>
                              <p className="text-[10px] text-gray-500">
                                {[m.cliente_nome, m.origem, m.observacoes].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                          </div>
                          <span className={`font-black text-sm ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                            {m.tipo === 'entrada' ? '+' : '-'}{fmtBRL(Number(m.valor))}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── SUB-ABA: RESUMO ─── */}
        {subAba === 'resumo' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KpiCard label="Receitas pendentes"  value={fmtBRL(aReceber)}         icon={ArrowUp}      color="text-green-400" />
              <KpiCard label="Despesas pendentes"  value={fmtBRL(aPagar)}           icon={ArrowDown}    color="text-red-400" />
              <KpiCard label="Saldo projetado"     value={fmtBRL(aReceber - aPagar)} icon={Wallet}      color={aReceber - aPagar >= 0 ? 'text-blue-400' : 'text-red-400'} />
              <KpiCard label="Total vendas"        value={fmtBRL(totalVendasValor)} icon={ShoppingCart} color="text-purple-400" />
              <KpiCard label="Recebido (vendas)"   value={fmtBRL(totalVendasPago)}  icon={Check}        color="text-green-400" />
              <KpiCard label="A receber (vendas)"  value={fmtBRL(totalVendasRest)}  icon={Clock}        color="text-yellow-400" />
            </div>

            {/* Top formas de pagamento usadas */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Formas de Pagamento Mais Usadas
              </h3>
              {(() => {
                const mapa: Record<string, { count: number; total: number }> = {};
                vendas.filter(v => v.forma_pagamento && v.status !== 'cancelado').forEach(v => {
                  const f = v.forma_pagamento!;
                  if (!mapa[f]) mapa[f] = { count: 0, total: 0 };
                  mapa[f].count++;
                  mapa[f].total += Number(v.valor_total ?? v.total ?? 0);
                });
                const arr = Object.entries(mapa).sort((a, b) => b[1].count - a[1].count);
                if (arr.length === 0) return <p className="text-gray-600 text-sm">Nenhuma venda com forma de pagamento definida.</p>;
                return (
                  <div className="space-y-2">
                    {arr.map(([forma, d]) => (
                      <div key={forma} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-bold text-white">{forma}</span>
                          <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">{d.count} venda(s)</span>
                        </div>
                        <span className="font-black text-green-400">{fmtBRL(d.total)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Vendas por status */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Vendas por Status</h3>
              <div className="space-y-2">
                {Object.entries(STATUS_VENDA).map(([k, v]) => {
                  const count = vendas.filter(x => x.status === k).length;
                  const val   = vendas.filter(x => x.status === k).reduce((s, x) => s + Number(x.valor_total ?? x.total ?? 0), 0);
                  if (count === 0) return null;
                  return (
                    <div key={k} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${v.cor}`}>{v.label}</span>
                        <span className="text-xs text-gray-500">{count} venda(s)</span>
                      </div>
                      <span className="font-bold text-white">{fmtBRL(val)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de lançamento */}
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
    </>
  );
}
