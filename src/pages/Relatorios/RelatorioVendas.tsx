// src/pages/Relatorios/RelatorioVendas.tsx
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  useRelatorioVendas, RelatorioVendasFiltros,
} from '../../hooks/useRelatorios';
import { useContainerReady } from '../../hooks/useContainerReady';
import { STATUS_VENDA } from '../../types/venda';
import { DateInput } from '../../components/ui/DateInput';
import { TrendingUp, Download, Printer, AlertTriangle, Inbox } from 'lucide-react';

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const IN = "bg-[#111827] border border-gray-700 rounded-md px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors";
const valorVenda = (v: { valor_total?: number | null }) =>
  Number(v.valor_total ?? 0);

const hoje      = new Date();
const anoMes    = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const inicioMes = `${anoMes}-01`;
const fimMes    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

function KPI({ label, value, cor = 'text-white' }: { label: string; value: string; cor?: string }) {
  return (
    <div className="bg-[#111827] border border-gray-700 rounded-lg px-3.5 py-2.5">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-lg font-black ${cor}`}>{value}</p>
    </div>
  );
}

export function RelatorioVendas() {
  const printRef = useRef<HTMLDivElement>(null);
  const { ref: chartRef, pronto: chartPronto } = useContainerReady<HTMLDivElement>();

  const [filtros, setFiltros]   = useState<RelatorioVendasFiltros>({ data_inicio: inicioMes, data_fim: fimMes });
  const [rascunho, setRascunho] = useState(filtros);

  const rel = useRelatorioVendas(filtros);

  function exportarExcel() {
    if (!rel.data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      rel.data.vendas.map(v => ({
        'Nº': v.numero ?? '', 'Cliente': v.cliente_nome, 'Status': v.status,
        'Data Venda': fmtData(v.data_venda), 'Entrega': fmtData(v.data_entrega),
        'Valor (R$)': valorVenda(v), 'Desconto (%)': Number(v.desconto ?? 0), 'Vendedor': v.vendedor ?? '',
      }))
    ), 'Vendas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      rel.data.resumo.por_cliente.map(c => ({ 'Cliente': c.nome, 'Pedidos': c.count, 'Total (R$)': c.total }))
    ), 'Top Clientes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      rel.data.resumo.por_dia.map(d => ({ 'Data': d.data, 'Pedidos': d.count, 'Total (R$)': d.total }))
    ), 'Por Dia');
    XLSX.writeFile(wb, `relatorio-vendas-${filtros.data_inicio}_${filtros.data_fim}.xlsx`);
  }

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #print-rel, #print-rel * { visibility: visible; } #print-rel { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>

      <div className="p-4 space-y-4">
        {/* Header Compacto */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" /> Relatório de Vendas
            </h1>
            <p className="text-gray-500 text-xs">Análise de vendas por período</p>
          </div>
          <div className="flex gap-2 no-print">
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-bold text-xs transition-all">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            <button onClick={exportarExcel} disabled={!rel.data}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg font-bold text-xs transition-all">
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>

        {/* Filtros Compactos em Linha */}
        <div className="bg-[#1f2937] border border-gray-700 rounded-lg p-3 no-print">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 items-end">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">De</label>
              <DateInput value={rascunho.data_inicio}
                onChange={v => setRascunho(f => ({ ...f, data_inicio: v }))} className={IN + ' w-full'} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Até</label>
              <DateInput value={rascunho.data_fim}
                onChange={v => setRascunho(f => ({ ...f, data_fim: v }))} className={IN + ' w-full'} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Status</label>
              <select value={rascunho.status ?? ''}
                onChange={e => setRascunho(f => ({ ...f, status: e.target.value || undefined }))} className={IN + ' w-full'}>
                <option value="">Todos</option>
                {Object.entries(STATUS_VENDA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Cliente</label>
              <input value={rascunho.cliente ?? ''}
                onChange={e => setRascunho(f => ({ ...f, cliente: e.target.value || undefined }))}
                placeholder="parte do nome..." className={IN + ' w-full'} />
            </div>
            <div className="col-span-2 sm:col-span-2 md:col-span-4 lg:col-span-1">
              <button onClick={() => setFiltros(rascunho)}
                className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold transition-all flex items-center justify-center">
                Filtrar
              </button>
            </div>
          </div>
        </div>

        {rel.isLoading && <div className="p-6 text-center text-blue-500 animate-pulse font-bold text-sm">Gerando relatório...</div>}
        {rel.isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-xs font-bold">Erro ao gerar relatório</p>
          </div>
        )}
        {rel.data && rel.data.vendas.length === 0 && (
          <div className="bg-[#1f2937] border border-gray-700 rounded-lg p-8 text-center">
            <Inbox className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-xs">Nenhuma venda encontrada no período.</p>
          </div>
        )}

        {rel.data && rel.data.vendas.length > 0 && (
          <div id="print-rel" ref={printRef} className="space-y-4">
            <div className="hidden print:block mb-3 border-b pb-2">
              <h2 className="text-lg font-black">Relatório de Vendas</h2>
              <p className="text-gray-600 text-xs">Período: {fmtData(filtros.data_inicio)} a {fmtData(filtros.data_fim)}</p>
            </div>

            {/* KPIs compactos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <KPI label="Total de vendas" value={String(rel.data.resumo.total_vendas)} />
              <KPI label="Valor total"     value={fmtBRL(rel.data.resumo.valor_total)}  cor="text-green-400" />
              <KPI label="Ticket médio"    value={fmtBRL(rel.data.resumo.ticket_medio)} cor="text-blue-400" />
              <KPI label="Canceladas"      value={String(rel.data.resumo.por_status.cancelado?.count ?? 0)} cor="text-red-400" />
            </div>

            {/* Gráfico compacto */}
            {rel.data.resumo.por_dia.length > 0 && (
              <div className="bg-[#1f2937] border border-gray-700 rounded-lg p-3.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Vendas por Dia</p>
                <div className="h-44" ref={chartRef}>
                  {chartPronto && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rel.data.resumo.por_dia} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                      <XAxis dataKey="data" stroke="#6b7280" fontSize={10} tickLine={false} tickFormatter={d => d.slice(5)} />
                      <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 11, padding: '6px 10px' }}
                        formatter={(v: any) => fmtBRL(v)} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[2,2,0,0]} maxBarSize={28} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* Top Clientes compacto */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-lg overflow-hidden">
              <div className="px-3.5 py-2 border-b border-gray-700 bg-gray-800/30">
                <p className="text-[11px] font-bold text-gray-400 uppercase">Top Clientes</p>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40">
                    <th className="px-3 py-1.5 text-left w-10">#</th>
                    <th className="px-3 py-1.5 text-left">Cliente</th>
                    <th className="px-3 py-1.5 text-right">Pedidos</th>
                    <th className="px-3 py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.data.resumo.por_cliente.map((c, i) => (
                    <tr key={c.nome} className="border-b border-gray-800/60 hover:bg-gray-800/30">
                      <td className="px-3 py-1.5 text-gray-500 font-bold">{i + 1}</td>
                      <td className="px-3 py-1.5 text-white font-medium">{c.nome}</td>
                      <td className="px-3 py-1.5 text-right text-gray-400">{c.count}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-green-400">{fmtBRL(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Todas as Vendas compacto */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-lg overflow-hidden">
              <div className="px-3.5 py-2 border-b border-gray-700 bg-gray-800/30">
                <p className="text-[11px] font-bold text-gray-400 uppercase">Todas as Vendas ({rel.data.vendas.length})</p>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40">
                    <th className="px-3 py-1.5 text-left w-16">Nº</th>
                    <th className="px-3 py-1.5 text-left">Cliente</th>
                    <th className="px-3 py-1.5 text-left w-24">Data</th>
                    <th className="px-3 py-1.5 text-left w-24">Entrega</th>
                    <th className="px-3 py-1.5 text-center w-28">Status</th>
                    <th className="px-3 py-1.5 text-right w-28">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.data.vendas.map(v => (
                    <tr key={v.id} className="border-b border-gray-800/60 hover:bg-gray-800/30">
                      <td className="px-3 py-1.5 text-gray-500 font-mono text-[11px]">{v.numero ? `#${v.numero}` : '—'}</td>
                      <td className="px-3 py-1.5 text-white font-medium">{v.cliente_nome}</td>
                      <td className="px-3 py-1.5 text-gray-400 text-[11px]">{fmtData(v.data_venda)}</td>
                      <td className="px-3 py-1.5 text-gray-400 text-[11px]">{fmtData(v.data_entrega)}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_VENDA[v.status as keyof typeof STATUS_VENDA]?.cor ?? 'text-gray-400 border-gray-600'}`}>
                          {STATUS_VENDA[v.status as keyof typeof STATUS_VENDA]?.label ?? v.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-white">{fmtBRL(valorVenda(v))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-green-900/20 border-t border-green-500/20">
                    <td colSpan={5} className="px-3 py-1.5 text-right text-[11px] font-bold text-gray-400 uppercase">Total</td>
                    <td className="px-3 py-1.5 text-right font-black text-green-400 text-xs">{fmtBRL(rel.data.resumo.valor_total)}</td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

