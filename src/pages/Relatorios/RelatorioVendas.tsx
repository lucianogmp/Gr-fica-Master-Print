// src/pages/Relatorios/RelatorioVendas.tsx
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  useRelatorioVendas, RelatorioVendasFiltros,
} from '../../hooks/useRelatorios';
import { STATUS_VENDA } from '../../types/venda';
import { TrendingUp, Download, Printer, AlertTriangle, Inbox } from 'lucide-react';

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const IN = "bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const valorVenda = (v: { valor_total?: number | null }) =>
  Number(v.valor_total ?? 0);

const hoje      = new Date();
const anoMes    = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const inicioMes = `${anoMes}-01`;
const fimMes    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

function KPI({ label, value, cor = 'text-white' }: { label: string; value: string; cor?: string }) {
  return (
    <div className="bg-[#111827] border border-gray-700 rounded-xl p-4">
      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</p>
      <p className={`text-xl font-black ${cor}`}>{value}</p>
    </div>
  );
}

export function RelatorioVendas() {
  const printRef = useRef<HTMLDivElement>(null);

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

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-400" /> Relatório de Vendas
            </h1>
            <p className="text-gray-500 text-sm">Análise de vendas por período</p>
          </div>
          <div className="flex gap-2 no-print">
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-bold text-sm transition-all">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={exportarExcel} disabled={!rel.data}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition-all">
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 no-print">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">De</label>
              <input type="date" value={rascunho.data_inicio}
                onChange={e => setRascunho(f => ({ ...f, data_inicio: e.target.value }))} className={IN + ' w-full'} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Até</label>
              <input type="date" value={rascunho.data_fim}
                onChange={e => setRascunho(f => ({ ...f, data_fim: e.target.value }))} className={IN + ' w-full'} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Status</label>
              <select value={rascunho.status ?? ''}
                onChange={e => setRascunho(f => ({ ...f, status: e.target.value || undefined }))} className={IN + ' w-full'}>
                <option value="">Todos</option>
                {Object.entries(STATUS_VENDA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cliente</label>
              <input value={rascunho.cliente ?? ''}
                onChange={e => setRascunho(f => ({ ...f, cliente: e.target.value || undefined }))}
                placeholder="parte do nome..." className={IN + ' w-full'} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={() => setFiltros(rascunho)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all">
              Gerar relatório
            </button>
          </div>
        </div>

        {rel.isLoading && <div className="p-8 text-center text-blue-500 animate-pulse font-bold">Gerando relatório...</div>}
        {rel.isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm font-bold">Erro ao gerar relatório</p>
          </div>
        )}
        {rel.data && rel.data.vendas.length === 0 && (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center">
            <Inbox className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma venda encontrada no período.</p>
          </div>
        )}

        {rel.data && rel.data.vendas.length > 0 && (
          <div id="print-rel" ref={printRef} className="space-y-5">
            <div className="hidden print:block mb-4 border-b pb-4">
              <h2 className="text-xl font-black">Relatório de Vendas</h2>
              <p className="text-gray-600 text-sm">Período: {fmtData(filtros.data_inicio)} a {fmtData(filtros.data_fim)}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Total de vendas" value={String(rel.data.resumo.total_vendas)} />
              <KPI label="Valor total"     value={fmtBRL(rel.data.resumo.valor_total)}  cor="text-green-400" />
              <KPI label="Ticket médio"    value={fmtBRL(rel.data.resumo.ticket_medio)} cor="text-blue-400" />
              <KPI label="Canceladas"      value={String(rel.data.resumo.por_status.cancelado?.count ?? 0)} cor="text-red-400" />
            </div>

            {rel.data.resumo.por_dia.length > 0 && (
              <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-4">Vendas por Dia</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rel.data.resumo.por_dia}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                      <XAxis dataKey="data" stroke="#4b5563" fontSize={10} tickLine={false} tickFormatter={d => d.slice(5)} />
                      <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                        formatter={(v: any) => fmtBRL(v)} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={32} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-700">
                <p className="text-xs font-bold text-gray-400 uppercase">Top Clientes</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40">
                    <th className="px-5 py-2 text-left">#</th>
                    <th className="px-5 py-2 text-left">Cliente</th>
                    <th className="px-5 py-2 text-right">Pedidos</th>
                    <th className="px-5 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.data.resumo.por_cliente.map((c, i) => (
                    <tr key={c.nome} className="border-b border-gray-800">
                      <td className="px-5 py-2 text-gray-500 font-bold">{i + 1}</td>
                      <td className="px-5 py-2 text-white font-medium">{c.nome}</td>
                      <td className="px-5 py-2 text-right text-gray-400">{c.count}</td>
                      <td className="px-5 py-2 text-right font-bold text-green-400">{fmtBRL(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-700">
                <p className="text-xs font-bold text-gray-400 uppercase">Todas as Vendas ({rel.data.vendas.length})</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40">
                    <th className="px-4 py-2 text-left">Nº</th>
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Entrega</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.data.vendas.map(v => (
                    <tr key={v.id} className="border-b border-gray-800">
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
                  <tr className="bg-green-900/20 border-t border-green-500/20">
                    <td colSpan={5} className="px-4 py-2 text-right text-xs font-bold text-gray-400 uppercase">Total</td>
                    <td className="px-4 py-2 text-right font-black text-green-400">{fmtBRL(rel.data.resumo.valor_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
