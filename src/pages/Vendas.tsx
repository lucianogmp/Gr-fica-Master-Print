// src/pages/Vendas.tsx
import { useState, useMemo, useEffect } from 'react';
import { useVendas, useVendaItens } from '../hooks/useVendas';
import { usePagamentosVenda } from '../hooks/usePagamentosVenda';
import { useConfiguracoes } from '../hooks/useConfiguracoes';
import { useProducao } from '../hooks/useProducao';
import { supabase } from '../lib/supabase';
import { Venda, VendaItem, StatusVenda, STATUS_VENDA } from '../types/venda';
import { ItensEditor } from '../components/vendas/ItensEditor';
import { ClienteSelectorVenda } from '../components/vendas/ClienteSelectorVenda';
import { VendedorSelector } from '../components/vendas/VendedorSelector';
import { PainelFinanceiro } from '../components/vendas/PainelFinanceiro';
import { KpiCard } from '../components/ui/KpiCard';
import { useConfirm } from '../components/ui/ConfirmModal';
import {
  ShoppingCart, DollarSign, ClipboardList, Factory, CheckCircle2,
  ArrowLeft, Save, Package, Settings, X, Printer, Calendar, AlertTriangle,
} from 'lucide-react';
import { DocumentoImpressaoData } from '../components/impressao/DocumentoImpressao';
import { imprimirDocumento } from '../components/impressao/imprimirDocumento';
import { DEFAULT_LAYOUT_VENDA } from '../types/layoutImpressao';
import toast from 'react-hot-toast';

type View = 'lista' | 'detalhe';
type Filtro = 'todos' | StatusVenda;

const fmtBRL  = (v: number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

const NOVA_VENDA = {
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

export function Vendas() {
  const { data: vendas = [], isLoading, criar, atualizar, atualizarStatus, deletar, isSaving } = useVendas();
  const { data: cfg } = useConfiguracoes();
  const { criar: criarOP } = useProducao();
  const { confirmar, ConfirmModal } = useConfirm();

  const [view, setView]       = useState<View>('lista');
  const [vendaId, setVendaId] = useState<string | null>(null);
  const [form, setForm]       = useState({ ...NOVA_VENDA });
  const [itens, setItens]     = useState<VendaItem[]>([]);
  const [filtro, setFiltro]   = useState<Filtro>('todos');
  const [busca, setBusca]     = useState('');

  const isNovo = vendaId === '__novo__';
  const { data: itensCarregados } = useVendaItens(isNovo ? null : vendaId);
  const {
    data: pagamentos = [],
    registrar: registrarPagamento,
    excluir: excluirPagamento,
    isRegistrando,
  } = usePagamentosVenda(vendaId);

  useEffect(() => {
    if (isNovo) return;
    if (itensCarregados !== undefined) setItens(itensCarregados);
  }, [itensCarregados, isNovo, vendaId]);

  // Sugestão de data de entrega ao criar nova venda
  useEffect(() => {
    if (isNovo && cfg?.venda_prazo_entrega_dias) {
      const d = new Date();
      d.setDate(d.getDate() + cfg.venda_prazo_entrega_dias);
      setForm(f => ({ ...f, data_entrega: d.toISOString().split('T')[0] }));
    }
  }, [isNovo, cfg?.venda_prazo_entrega_dias]);

  // Valores padrão ao abrir nova venda
  useEffect(() => {
    if (isNovo && cfg) {
      setForm(f => ({
        ...f,
        frete:          cfg.venda_frete_padrao ?? 0,
        taxa_adicional: cfg.venda_taxa_adicional_padrao ?? 0,
        parcelas:       1,
        juros:          cfg.venda_juros_parcela ?? 0,
      }));
    }
  }, [isNovo, cfg]);

  function abrirDetalhe(v: Venda | null) {
    if (v) {
      setItens([]);
      setVendaId(v.id);
      setForm({
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
    } else {
      setVendaId('__novo__');
      setForm({ ...NOVA_VENDA, data_venda: new Date().toISOString().split('T')[0] });
      setItens([]);
    }
    setView('detalhe');
  }

  function fechar() {
    setView('lista');
    setVendaId(null);
    setForm({ ...NOVA_VENDA });
    setItens([]);
  }

  function setF(f: keyof typeof NOVA_VENDA, v: any) {
    setForm(p => ({ ...p, [f]: v }));
  }

  // Cálculos financeiros
  const subtotal        = itens.reduce((s, i) => s + Number(i.total), 0);
  const descontoValor   = subtotal * (form.desconto / 100);
  const subtotalDescont = subtotal - descontoValor;
  const totalSemJuros   = subtotalDescont + Number(form.frete || 0) + Number(form.taxa_adicional || 0);
  const jurosTotalPct   = form.juros * (form.parcelas - 1);
  const totalFinal      = totalSemJuros; // A taxa é da maquininha e não repassada ao cliente

  // Mudar status + criar OP automática ao entrar em produção
  async function handleMudarStatus(novoStatus: StatusVenda) {
    setF('status', novoStatus);
    if (vendaId && vendaId !== '__novo__') {
      atualizarStatus({ id: vendaId, status: novoStatus });

      if (novoStatus === 'producao') {
        try {
          const venda = vendas.find(v => v.id === vendaId);
          if (venda) {
            await criarOP({
              titulo:       `Venda #${(venda as any).numero ?? ''} — ${venda.cliente_nome}`,
              descricao:    venda.observacoes ?? null,
              etapa:        'fila',
              prioridade:   'normal',
              responsavel:  null,
              data_entrega: venda.data_entrega ?? null,
              venda_id:     venda.id,
            } as any);
            toast.success('Ordem de Produção criada automaticamente!');
          }
        } catch (e) {
          console.warn('Aviso: falha ao criar OP automática', e);
        }
      }
    }
  }

  const { data: cfg2 } = useConfiguracoes();
  const layoutVenda = { ...DEFAULT_LAYOUT_VENDA, ...(cfg2?.layout_impressao_venda ?? {}) };

  const docImpressaoVenda: DocumentoImpressaoData = {
    tipo: 'venda',
    numero: (form as any).numero ?? null,
    data: form.data_venda ?? null,
    dataEntrega: form.data_entrega ?? null,
    clienteNome: form.cliente_nome,
    itens: itens.map(i => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      unidade: i.unidade ?? 'un',
      precoUnitario: Number(i.preco_unitario),
      desconto: Number(i.desconto ?? 0),
      total: Number(i.total),
    })),
    subtotal,
    descontoGlobalPct: form.desconto,
    total: totalFinal,
    valorPago: form.valor_pago,
    formaPagamento: form.forma_pagamento,
    observacoes: form.observacoes,
  };

  const [imprimindoId, setImprimindoId] = useState<string | null>(null);
  const vendaImprimir = vendas.find(v => v.id === imprimindoId) ?? null;
  const { data: itensImprimir } = useVendaItens(imprimindoId);

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
  }, [imprimindoId, docImpressaoLista]);

  async function handleSalvar() {
    const payload = {
      cliente_nome:    form.cliente_nome,
      cliente_id:      form.cliente_id,
      status:          form.status,
      desconto:        form.desconto,
      frete:           form.frete,
      taxa_adicional:  form.taxa_adicional,
      parcelas:        form.parcelas,
      juros_parcelas:  form.juros,
      observacoes:     form.observacoes,
      consumidor_final: form.consumidor_final,
      data_entrega:    form.data_entrega || null,
      data_venda:      form.data_venda,
      vendedor:        form.vendedor,
      vendedor_id:     form.vendedor_id,
      palavra_chave:   form.palavra_chave,
      tipo:            form.tipo,
      valor_total:     totalFinal,
      valor_pago:      form.valor_pago,
      forma_pagamento: form.forma_pagamento,
    };

    if (isNovo) {
      await criar({ venda: payload as any, itens });
    } else if (vendaId) {
      await atualizar({ id: vendaId, payload: payload as any, itens });
    }
    fechar();
  }

  const totalVendas = vendas.reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0);
  const emProducao  = vendas.filter(v => v.status === 'producao').length;
  const prontas     = vendas.filter(v => v.status === 'pronto').length;

  const filtradas = useMemo(() => vendas
    .filter(v => filtro === 'todos' || v.status === filtro)
    .filter(v =>
      !busca ||
      v.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
      (v.numero ? String(v.numero).includes(busca) : false) ||
      (v.palavra_chave ?? '').toLowerCase().includes(busca.toLowerCase())
    ), [vendas, filtro, busca]);

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Vendas...</div>;

  /* ── LISTA ── */
  if (view === 'lista') return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-blue-400" /> Vendas
            </h1>
            <p className="text-gray-500 text-sm">{vendas.length} venda(s) no sistema</p>
          </div>
          <button
            onClick={() => abrirDetalhe(null)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30"
          >
            + Nova Venda
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total vendido"   value={fmtBRL(totalVendas)} icon={DollarSign}    color="text-green-400" />
          <KpiCard label="Total de vendas" value={vendas.length}       icon={ClipboardList} color="text-blue-400" />
          <KpiCard label="Em produção"     value={emProducao}          icon={Factory}       color="text-yellow-400" />
          <KpiCard label="Prontas"         value={prontas}             icon={CheckCircle2}  color="text-purple-400" />
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
            {(['todos','orcamento','aprovado','producao','pronto','entregue','cancelado'] as Filtro[]).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                  filtro === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {f === 'todos' ? 'Todos' : STATUS_VENDA[f as StatusVenda]?.label ?? f}
              </button>
            ))}
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por cliente, nº ou palavra-chave..."
            className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
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
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-600">Nenhuma venda encontrada.</td></tr>
              )}
              {filtradas.map(v => {
                const st = STATUS_VENDA[v.status] ?? STATUS_VENDA.orcamento;
                const totalPago  = Number(v.valor_pago ?? 0);
                const totalVenda = Number(v.valor_total ?? v.total ?? 0);
                const quitado = totalVenda > 0 && totalPago >= totalVenda;
                return (
                  <tr key={v.id} onClick={() => abrirDetalhe(v)}
                    className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer">
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{v.numero ? `#${v.numero}` : '—'}</td>
                    <td className="px-5 py-3 font-medium text-white">{v.cliente_nome || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(v.data_venda)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(v.data_entrega)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="font-bold text-white">{fmtBRL(v.valor_total ?? v.total)}</div>
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
    </>
  );

  /* ── DETALHE ── */
  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={fechar}
            className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white truncate">
              {isNovo
                ? 'Nova Venda'
                : `Venda ${(form as any).numero ? `#${(form as any).numero}` : ''} — ${form.cliente_nome || 'Editar'}`}
            </h1>
            <p className="text-gray-500 text-sm">
              {isNovo ? 'Preencha os dados e salve' : 'Edite e salve as alterações'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isNovo && (
              <button
                onClick={() => imprimirDocumento(layoutVenda, cfg ?? {}, docImpressaoVenda)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
            )}
            <button
              onClick={handleSalvar}
              disabled={isSaving || !form.cliente_nome.trim()}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        <div className="space-y-5">

          {/* ── Linha 1: Dados da Venda + Status — card único compacto ── */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4">
            <div className="flex gap-4">

              {/* Campos — cresce */}
              <div className="flex-1 min-w-0 space-y-2.5">

                {/* Linha A: Cliente + Vendedor */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cliente *</label>
                    <ClienteSelectorVenda
                      hideLabel
                      value={form.cliente_nome}
                      clienteId={form.cliente_id}
                      onChange={(nome, id) => { setF('cliente_nome', nome); setF('cliente_id', id ?? null); }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Vendedor</label>
                    <VendedorSelector
                      value={form.vendedor}
                      vendedorId={form.vendedor_id}
                      onChange={(nome, id) => { setF('vendedor', nome); setF('vendedor_id', id ?? null); }}
                    />
                  </div>
                </div>

                {/* Linha B: Datas + Palavra-chave + Tipo */}
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data da Venda</label>
                    <input type="date" value={form.data_venda ?? ''}
                      onChange={e => setF('data_venda', e.target.value)} className={IN} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Entrega
                      {cfg?.venda_prazo_entrega_dias && (
                        <span className="text-[9px] text-blue-400 font-normal">({cfg.venda_prazo_entrega_dias}d)</span>
                      )}
                    </label>
                    <input type="date" value={form.data_entrega ?? ''}
                      onChange={e => setF('data_entrega', e.target.value)} className={IN} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Palavra-chave</label>
                    <input value={form.palavra_chave ?? ''}
                      onChange={e => setF('palavra_chave', e.target.value)}
                      className={IN} placeholder="Tag busca rápida" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tipo</label>
                    <input value={form.tipo ?? ''}
                      onChange={e => setF('tipo', e.target.value)}
                      className={IN} placeholder="Categoria" />
                  </div>
                </div>

                {/* Linha C: Observações */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Observações</label>
                  <textarea rows={2} value={form.observacoes ?? ''}
                    onChange={e => setF('observacoes', e.target.value)}
                    className={IN + ' resize-none'}
                    placeholder="Observações para o cliente, instrução de entrega..." />
                </div>
              </div>

              {/* Divisor vertical */}
              <div className="w-px bg-gray-700/60 flex-shrink-0" />

              {/* Status — coluna estreita */}
              <div className="w-44 flex-shrink-0 flex flex-col">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <Settings className="w-3 h-3" /> Status
                </p>
                <div className="space-y-1 flex-1">
                  {Object.entries(STATUS_VENDA).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => handleMudarStatus(k as StatusVenda)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all flex items-center justify-between ${
                        form.status === k
                          ? v.cor + ' opacity-100'
                          : 'border-gray-700 text-gray-500 hover:text-white hover:bg-gray-700/30'
                      }`}
                    >
                      {v.label}
                      {k === 'producao' && (
                        <span className="text-[8px] text-yellow-400 font-normal">OP auto</span>
                      )}
                    </button>
                  ))}
                </div>
                {form.status === 'producao' && !isNovo && (
                  <div className="mt-2 flex items-start gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
                    <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[9px] text-yellow-300">Verifique a OP criada automaticamente.</p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Linha 2: Itens da Venda — full width ── */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Itens da Venda
            </h3>
            <ItensEditor itens={itens} onChange={setItens} />
          </div>

          {/* ── Linha 3: Resumo Financeiro — full width ── */}
          <PainelFinanceiro
            subtotal={subtotal}
            desconto={form.desconto}
            frete={form.frete}
            taxaAdicional={form.taxa_adicional}
            parcelas={form.parcelas}
            juros={form.juros}
            formaPagamento={form.forma_pagamento}
            valorPago={vendaId !== '__novo__' ? pagamentos.reduce((s, p) => s + p.valor, 0) : Number(form.valor_pago || 0)}
            pagamentos={pagamentos}
            cfg={cfg}
            vendaId={vendaId}
            onDescontoChange={v => setF('desconto', v)}
            onFreteChange={v => setF('frete', v)}
            onTaxaChange={v => setF('taxa_adicional', v)}
            onParcelasChange={v => setF('parcelas', v)}
            onJurosChange={v => setF('juros', v)}
            onFormaPagamentoChange={v => setF('forma_pagamento', v)}
            onRegistrarPagamento={registrarPagamento}
            onExcluirPagamento={excluirPagamento}
            isRegistrando={isRegistrando}
          />

        </div>
      </div>
    </>
  );
}
