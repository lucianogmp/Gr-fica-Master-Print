// src/pages/Relatorios.tsx
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  useRelatorioVendas, useRelatorioFinanceiro,
  RelatorioVendasFiltros, RelatorioFinanceiroFiltros,
} from '../hooks/useRelatorios';
import { STATUS_VENDA } from '../types/venda';
import { DateInput } from '../components/ui/DateInput';
import { FileText, Download, Printer, TrendingUp, Landmark, AlertTriangle, Inbox } from 'lucide-react';
import { useContainerReady } from '../hooks/useContainerReady';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const IN = "bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const valorVenda = (v: { valor_total?: number | null; total?: number | null }) =>
  Number(v.valor_total ?? v.total ?? 0);

type Aba = 'vendas' | 'financeiro';

// Mês atual como padrão
const hoje     = new Date();
const anoMes   = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const inicioMes = `${anoMes}-01`;
const fimMes    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  .toISOString().slice(0, 10);

export function Relatorios() {
  const { ref: chart1Ref, pronto: chart1Pronto } = useContainerReady<HTMLDivElement>();
  const { ref: chart2Ref, pronto: chart2Pronto } = useContainerReady<HTMLDivElement>();
  const [aba, setAba] = useState<Aba>('vendas');
  const printRef      = useRef<HTMLDivElement>(null);

  // ── Filtros Vendas ────────────────────────────────────────────────────────
  const [filtrosV, setFiltrosV] = useState<RelatorioVendasFiltros>({
    data_inicio: inicioMes,
    data_fim:    fimMes,
  });
  const [rascV, setRascV] = useState(filtrosV);

  // ── Filtros Financeiro ────────────────────────────────────────────────────
  const [filtrosF, setFiltrosF] = useState<RelatorioFinanceiroFiltros>({
    data_inicio: inicioMes,
    data_fim:    fimMes,
  });
  const [rascF, setRascF] = useState(filtrosF);

  // ── Queries ───────────────────────────────────────────────────────────────
  const relV = useRelatorioVendas(filtrosV);
  const relF = useRelatorioFinanceiro(filtrosF);

  // ── Export Excel ──────────────────────────────────────────────────────────
  function exportarVendasExcel() {
    if (!relV.data) return;
    const wb = XLSX.utils.book_new();

    // Aba: Vendas
    const wsVendas = XLSX.utils.json_to_sheet(
      relV.data.vendas.map(v => ({
        'Nº':         v.numero ?? '',
        'Cliente':    v.cliente_nome,
        'Status':     v.status,
        'Data Venda': fmtData(v.data_venda),
        'Entrega':    fmtData(v.data_entrega),
        'Valor (R$)': valorVenda(v),
        'Desconto (%)': Number(v.desconto ?? 0),
        'Vendedor':   v.vendedor ?? '',
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsVendas, 'Vendas');

    // Aba: Top Clientes
    const wsClientes = XLSX.utils.json_to_sheet(
      relV.data.resumo.por_cliente.map(c => ({
        'Cliente':   c.nome,
        'Pedidos':   c.count,
        'Total (R$)': c.total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsClientes, 'Top Clientes');

    // Aba: Por Dia
    const wsDia = XLSX.utils.json_to_sheet(
      relV.data.resumo.por_dia.map(d => ({
        'Data':      d.data,
        'Pedidos':   d.count,
        'Total (R$)': d.total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsDia, 'Por Dia');

    XLSX.writeFile(wb, `relatorio-vendas-${filtrosV.data_inicio}_${filtrosV.data_fim}.xlsx`);
  }

  function exportarFinanceiroExcel() {
    if (!relF.data) return;
    const wb = XLSX.utils.book_new();

    const wsLanc = XLSX.utils.json_to_sheet(
      relF.data.lancamentos.map(l => ({
        'Tipo':         l.tipo,
        'Descrição':    l.descricao,
        'Valor (R$)':   Number(l.valor),
        'Status':       l.status,
        'Categoria':    l.categoria ?? '',
        'Cliente/Forn': l.cliente_nome ?? '',
        'Vencimento':   fmtData(l.data_vencimento),
        'Pagamento':    fmtData(l.data_pagamento),
        'Forma Pgto':   l.forma_pagamento ?? '',
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsLanc, 'Lançamentos');

    const wsCat = XLSX.utils.json_to_sheet(
      relF.data.resumo.por_categoria.map(c => ({
        'Categoria':  c.categoria,
        'Tipo':       c.tipo,
        'Total (R$)': c.total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsCat, 'Por Categoria');

    const wsMes = XLSX.utils.json_to_sheet(
      relF.data.resumo.por_mes.map(m => ({
        'Mês':         m.mes,
        'Receita (R$)': m.receita,
        'Despesa (R$)': m.despesa,
        'Saldo (R$)':   m.saldo,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsMes, 'Por Mês');

    XLSX.writeFile(wb, `relatorio-financeiro-${filtrosF.data_inicio}_${filtrosF.data_fim}.xlsx`);
  }

  // ── Export PDF (print CSS) ────────────────────────────────────────────────
  function imprimirRelatorio() {
    window.print();
  }

  function ErroRelatorio({ msg }: { msg: string }) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-red-400 text-sm">Erro ao gerar relatório</p>
          <p className="text-gray-400 text-xs mt-1">{msg}</p>
        </div>
      </div>
    );
  }

  function VazioRelatorio({ texto }: { texto: string }) {
    return (
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center">
        <Inbox className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">{texto}</p>
      </div>
    );
  }

  // ── KPI Card reutilizável ─────────────────────────────────────────────────
  function KPI({ label, value, cor = 'text-white' }: { label: string; value: string; cor?: string }) {
    return (
      <div className="bg-[#111827] border border-gray-700 rounded-xl p-4 print:border-gray-300 print:bg-white">
        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 print:text-gray-600">{label}</p>
        <p className={`text-xl font-black ${cor} print:text-gray-900`}>{value}</p>
      </div>
    );
  }

  return (
    <>
      {/* CSS de impressão inline */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start no-print">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-400" /> Relatórios
            </h1>
            <p className="text-gray-500 text-sm">Vendas e financeiro com export PDF e Excel</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={imprimirRelatorio}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-bold text-sm transition-all"
            >
              <Printer className="w-4 h-4" /> PDF / Imprimir
            </button>
            <button
              onClick={aba === 'vendas' ? exportarVendasExcel : exportarFinanceiroExcel}
              disabled={aba === 'vendas' ? !relV.data : !relF.data}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition-all"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 w-fit no-print">
          <button onClick={() => setAba('vendas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${aba === 'vendas' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            <TrendingUp className="w-4 h-4" /> Vendas
          </button>
          <button onClick={() => setAba('financeiro')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${aba === 'financeiro' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            <Landmark className="w-4 h-4" /> Financeiro
          </button>
        </div>

        {/* ── ABA VENDAS ── */}
        {aba === 'vendas' && (
          <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 no-print">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">De</label>
                  <DateInput value={rascV.data_inicio} onChange={v => setRascV(f => ({ ...f, data_inicio: v }))} className={IN + ' w-full'} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Até</label>
                  <DateInput value={rascV.data_fim} onChange={v => setRascV(f => ({ ...f, data_fim: v }))} className={IN + ' w-full'} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Status</label>
                  <select value={rascV.status ?? ''} onChange={e => setRascV(f => ({ ...f, status: e.target.value || undefined }))} className={IN + ' w-full'}>
                    <option value="">Todos</option>
                    {Object.entries(STATUS_VENDA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cliente</label>
                  <input value={rascV.cliente ?? ''} onChange={e => setRascV(f => ({ ...f, cliente: e.target.value || undefined }))} placeholder="parte do nome..." className={IN + ' w-full'} />
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button onClick={() => setFiltrosV(rascV)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all">
                  Gerar relatório
                </button>
              </div>
            </div>

            {relV.isLoading && <div className="p-8 text-center text-blue-500 animate-pulse font-bold">Gerando relatório...</div>}
            {relV.isError && <ErroRelatorio msg={(relV.error as Error)?.message ?? 'Falha ao carregar dados de vendas.'} />}

            {relV.data && relV.data.vendas.length === 0 && (
              <VazioRelatorio texto="Nenhuma venda encontrada no período selecionado." />
            )}

            {relV.data && relV.data.vendas.length > 0 && (
              <div id="print-area" ref={printRef} className="space-y-5">
                {/* Cabeçalho de impressão */}
                <div className="hidden print:block mb-4 border-b pb-4">
                  <h2 className="text-xl font-black">Relatório de Vendas</h2>
                  <p className="text-gray-600 text-sm">Período: {fmtData(filtrosV.data_inicio)} a {fmtData(filtrosV.data_fim)}</p>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPI label="Total de vendas"  value={String(relV.data.resumo.total_vendas)} />
                  <KPI label="Valor total"       value={fmtBRL(relV.data.resumo.valor_total)}  cor="text-green-400" />
                  <KPI label="Ticket médio"      value={fmtBRL(relV.data.resumo.ticket_medio)} cor="text-blue-400" />
                  <KPI label="Canceladas"        value={String(relV.data.resumo.por_status.cancelado?.count ?? 0)} cor="text-red-400" />
                </div>

                {/* Gráfico por dia */}
                {relV.data.resumo.por_dia.length > 0 && (
                  <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 print:border-gray-300">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-4">Vendas por Dia</p>
                    <div className="h-52" ref={chart1Ref}>
                      {chart1Pronto && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={relV.data.resumo.por_dia}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                          <XAxis dataKey="data" stroke="#4b5563" fontSize={10} tickLine={false}
                            tickFormatter={d => d.slice(5)} />
                          <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false}
                            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                            formatter={(v: any) => fmtBRL(v)} />
                          <Bar dataKey="total" fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={32} name="Total" />
                        </BarChart>
                      </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                )}

                {/* Top clientes */}
                <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden print:border-gray-300">
                  <div className="px-5 py-3 border-b border-gray-700 print:border-gray-300">
                    <p className="text-xs font-bold text-gray-400 uppercase">Top Clientes</p>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40 print:bg-gray-100">
                        <th className="px-5 py-2 text-left">#</th>
                        <th className="px-5 py-2 text-left">Cliente</th>
                        <th className="px-5 py-2 text-right">Pedidos</th>
                        <th className="px-5 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relV.data.resumo.por_cliente.map((c, i) => (
                        <tr key={c.nome} className="border-b border-gray-800 print:border-gray-200">
                          <td className="px-5 py-2 text-gray-500 font-bold">{i + 1}</td>
                          <td className="px-5 py-2 text-white font-medium">{c.nome}</td>
                          <td className="px-5 py-2 text-right text-gray-400">{c.count}</td>
                          <td className="px-5 py-2 text-right font-bold text-green-400">{fmtBRL(c.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* Lista completa de vendas */}
                <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden print:border-gray-300">
                  <div className="px-5 py-3 border-b border-gray-700 print:border-gray-300">
                    <p className="text-xs font-bold text-gray-400 uppercase">
                      Todas as Vendas ({relV.data.vendas.length})
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40 print:bg-gray-100">
                        <th className="px-4 py-2 text-left">Nº</th>
                        <th className="px-4 py-2 text-left">Cliente</th>
                        <th className="px-4 py-2 text-left">Data</th>
                        <th className="px-4 py-2 text-left">Entrega</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relV.data.vendas.map(v => (
                        <tr key={v.id} className="border-b border-gray-800 print:border-gray-200">
                          <td className="px-4 py-2 text-gray-500 font-mono text-xs">{v.numero ? `#${v.numero}` : '—'}</td>
                          <td className="px-4 py-2 text-white">{v.cliente_nome}</td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{fmtData(v.data_venda)}</td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{fmtData(v.data_entrega)}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_VENDA[v.status as keyof typeof STATUS_VENDA]?.cor ?? 'text-gray-400 border-gray-600'}`}>
                              {STATUS_VENDA[v.status as keyof typeof STATUS_VENDA]?.label ?? v.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-white">{fmtBRL(valorVenda(v))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-green-900/20 border-t border-green-500/20 print:bg-gray-50">
                        <td colSpan={5} className="px-4 py-2 text-right text-xs font-bold text-gray-400 uppercase">Total</td>
                        <td className="px-4 py-2 text-right font-black text-green-400">{fmtBRL(relV.data.resumo.valor_total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA FINANCEIRO ── */}
        {aba === 'financeiro' && (
          <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 no-print">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">De</label>
                  <DateInput value={rascF.data_inicio} onChange={v => setRascF(f => ({ ...f, data_inicio: v }))} className={IN + ' w-full'} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Até</label>
                  <DateInput value={rascF.data_fim} onChange={v => setRascF(f => ({ ...f, data_fim: v }))} className={IN + ' w-full'} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tipo</label>
                  <select value={rascF.tipo ?? ''} onChange={e => setRascF(f => ({ ...f, tipo: (e.target.value as any) || undefined }))} className={IN + ' w-full'}>
                    <option value="">Todos</option>
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Status</label>
                  <select value={rascF.status ?? ''} onChange={e => setRascF(f => ({ ...f, status: e.target.value || undefined }))} className={IN + ' w-full'}>
                    <option value="">Todos</option>
                    <option value="pago">Pago</option>
                    <option value="pendente">Pendente</option>
                    <option value="atrasado">Atrasado</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button onClick={() => setFiltrosF(rascF)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all">
                  Gerar relatório
                </button>
              </div>
            </div>

            {relF.isLoading && <div className="p-8 text-center text-blue-500 animate-pulse font-bold">Gerando relatório...</div>}
            {relF.isError && <ErroRelatorio msg={(relF.error as Error)?.message ?? 'Falha ao carregar dados financeiros.'} />}

            {relF.data && relF.data.lancamentos.length === 0 && (
              <VazioRelatorio texto="Nenhum lançamento encontrado no período selecionado." />
            )}

            {relF.data && relF.data.lancamentos.length > 0 && (
              <div id="print-area" className="space-y-5">
                <div className="hidden print:block mb-4 border-b pb-4">
                  <h2 className="text-xl font-black">Relatório Financeiro</h2>
                  <p className="text-gray-600 text-sm">Período: {fmtData(filtrosF.data_inicio)} a {fmtData(filtrosF.data_fim)}</p>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPI label="Total receitas" value={fmtBRL(relF.data.resumo.total_receitas)} cor="text-green-400" />
                  <KPI label="Total despesas" value={fmtBRL(relF.data.resumo.total_despesas)} cor="text-red-400" />
                  <KPI label="Saldo"          value={fmtBRL(relF.data.resumo.saldo)}          cor={relF.data.resumo.saldo >= 0 ? 'text-blue-400' : 'text-red-400'} />
                  <KPI label="A receber"      value={fmtBRL(relF.data.resumo.a_receber)}      cor="text-yellow-400" />
                </div>

                {/* Gráfico por mês */}
                {relF.data.resumo.por_mes.length > 0 && (
                  <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-4">Receita × Despesa por Mês</p>
                    <div className="h-52" ref={chart2Ref}>
                      {chart2Pronto && (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={relF.data.resumo.por_mes}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                          <XAxis dataKey="mes" stroke="#4b5563" fontSize={10} tickLine={false} />
                          <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false}
                            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                            formatter={(v: any) => fmtBRL(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="receita" stroke="#10b981" dot={false} strokeWidth={2} name="Receita" />
                          <Line type="monotone" dataKey="despesa" stroke="#ef4444" dot={false} strokeWidth={2} name="Despesa" />
                          <Line type="monotone" dataKey="saldo"   stroke="#3b82f6" dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="Saldo" />
                        </LineChart>
                      </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                )}

                {/* Por categoria */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['receita', 'despesa'].map(tipo => {
                    const cats = relF.data!.resumo.por_categoria.filter(c => c.tipo === tipo);
                    if (cats.length === 0) return null;
                    return (
                      <div key={tipo} className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-700">
                          <p className={`text-xs font-bold uppercase ${tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
                            {tipo === 'receita' ? 'Receitas por Categoria' : 'Despesas por Categoria'}
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {cats.map(c => (
                              <tr key={c.categoria} className="border-b border-gray-800">
                                <td className="px-5 py-2 text-gray-300">{c.categoria}</td>
                                <td className={`px-5 py-2 text-right font-bold ${tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
                                  {fmtBRL(c.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Lançamentos */}
                <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-700">
                    <p className="text-xs font-bold text-gray-400 uppercase">
                      Lançamentos ({relF.data.lancamentos.length})
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40">
                        <th className="px-4 py-2 text-left">Descrição</th>
                        <th className="px-4 py-2 text-left">Categoria</th>
                        <th className="px-4 py-2 text-left">Vencimento</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relF.data.lancamentos.map(l => (
                        <tr key={l.id} className="border-b border-gray-800">
                          <td className="px-4 py-2 text-white">{l.descricao}</td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{l.categoria ?? '—'}</td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{fmtData(l.data_vencimento)}</td>
                          <td className="px-4 py-2 text-center text-xs text-gray-300">{l.status}</td>
                          <td className={`px-4 py-2 text-right font-bold ${l.tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
                            {l.tipo === 'receita' ? '+' : '-'}{fmtBRL(Number(l.valor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
