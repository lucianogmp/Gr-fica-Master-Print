// src/pages/Relatorios/RelatorioFinanceiro.tsx
import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useRelatorioFinanceiro, RelatorioFinanceiroFiltros } from '../../hooks/useRelatorios';
import { useContainerReady } from '../../hooks/useContainerReady';
import { DateInput } from '../../components/ui/DateInput';
import { Landmark, Download, Printer, AlertTriangle, Inbox } from 'lucide-react';

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const IN = "bg-[#111827] border border-gray-700 rounded-md px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors";

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

export function RelatorioFinanceiro() {
  const { ref: chartRef, pronto: chartPronto } = useContainerReady<HTMLDivElement>();
  const [filtros, setFiltros]   = useState<RelatorioFinanceiroFiltros>({ data_inicio: inicioMes, data_fim: fimMes });
  const [rascunho, setRascunho] = useState(filtros);

  const rel = useRelatorioFinanceiro(filtros);

  function exportarExcel() {
    if (!rel.data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      rel.data.lancamentos.map(l => ({
        'Tipo': l.tipo, 'Descrição': l.descricao, 'Valor (R$)': Number(l.valor),
        'Status': l.status, 'Categoria': l.categoria ?? '', 'Cliente/Forn': l.cliente_nome ?? '',
        'Vencimento': fmtData(l.data_vencimento), 'Pagamento': fmtData(l.data_pagamento),
        'Forma Pgto': l.forma_pagamento ?? '',
      }))
    ), 'Lançamentos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      rel.data.resumo.por_categoria.map(c => ({ 'Categoria': c.categoria, 'Tipo': c.tipo, 'Total (R$)': c.total }))
    ), 'Por Categoria');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      rel.data.resumo.por_mes.map(m => ({ 'Mês': m.mes, 'Receita (R$)': m.receita, 'Despesa (R$)': m.despesa, 'Saldo (R$)': m.saldo }))
    ), 'Por Mês');
    XLSX.writeFile(wb, `relatorio-financeiro-${filtros.data_inicio}_${filtros.data_fim}.xlsx`);
  }

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #print-rel-fin, #print-rel-fin * { visibility: visible; } #print-rel-fin { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>

      <div className="p-4 space-y-4">
        {/* Header Compacto */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-blue-400" /> Relatório Financeiro
            </h1>
            <p className="text-gray-500 text-xs">Lançamentos, receitas e despesas por período</p>
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

        {/* Filtros Compactos */}
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
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tipo</label>
              <select value={rascunho.tipo ?? ''}
                onChange={e => setRascunho(f => ({ ...f, tipo: (e.target.value as any) || undefined }))} className={IN + ' w-full'}>
                <option value="">Todos</option>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Status</label>
              <select value={rascunho.status ?? ''}
                onChange={e => setRascunho(f => ({ ...f, status: e.target.value || undefined }))} className={IN + ' w-full'}>
                <option value="">Todos</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="atrasado">Atrasado</option>
              </select>
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
            <p className="text-red-400 text-xs font-bold">Erro ao gerar relatório financeiro.</p>
          </div>
        )}
        {rel.data && rel.data.lancamentos.length === 0 && (
          <div className="bg-[#1f2937] border border-gray-700 rounded-lg p-8 text-center">
            <Inbox className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-xs">Nenhum lançamento encontrado no período.</p>
          </div>
        )}

        {rel.data && rel.data.lancamentos.length > 0 && (
          <div id="print-rel-fin" className="space-y-4">
            <div className="hidden print:block mb-3 border-b pb-2">
              <h2 className="text-lg font-black">Relatório Financeiro</h2>
              <p className="text-gray-600 text-xs">Período: {fmtData(filtros.data_inicio)} a {fmtData(filtros.data_fim)}</p>
            </div>

            {/* KPIs compactos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <KPI label="Total receitas" value={fmtBRL(rel.data.resumo.total_receitas)} cor="text-green-400" />
              <KPI label="Total despesas" value={fmtBRL(rel.data.resumo.total_despesas)} cor="text-red-400" />
              <KPI label="Saldo"          value={fmtBRL(rel.data.resumo.saldo)} cor={rel.data.resumo.saldo >= 0 ? 'text-blue-400' : 'text-red-400'} />
              <KPI label="A receber"      value={fmtBRL(rel.data.resumo.a_receber)} cor="text-yellow-400" />
            </div>

            {/* Gráfico compacto */}
            {rel.data.resumo.por_mes.length > 0 && (
              <div className="bg-[#1f2937] border border-gray-700 rounded-lg p-3.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Receita × Despesa por Mês</p>
                <div className="h-44" ref={chartRef}>
                  {chartPronto && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rel.data.resumo.por_mes} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                      <XAxis dataKey="mes" stroke="#6b7280" fontSize={10} tickLine={false} />
                      <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 11, padding: '6px 10px' }}
                        formatter={(v: any) => fmtBRL(v)} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                      <Line type="monotone" dataKey="receita" stroke="#10b981" dot={false} strokeWidth={2} name="Receita" />
                      <Line type="monotone" dataKey="despesa" stroke="#ef4444" dot={false} strokeWidth={2} name="Despesa" />
                      <Line type="monotone" dataKey="saldo"   stroke="#3b82f6" dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="Saldo" />
                    </LineChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* Categorias compactas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(['receita', 'despesa'] as const).map(tipo => {
                const cats = rel.data!.resumo.por_categoria.filter(c => c.tipo === tipo);
                if (cats.length === 0) return null;
                return (
                  <div key={tipo} className="bg-[#1f2937] border border-gray-700 rounded-lg overflow-hidden">
                    <div className="px-3.5 py-2 border-b border-gray-700 bg-gray-800/30">
                      <p className={`text-[11px] font-bold uppercase ${tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
                        {tipo === 'receita' ? 'Receitas por Categoria' : 'Despesas por Categoria'}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {cats.map(c => (
                          <tr key={c.categoria} className="border-b border-gray-800/60 hover:bg-gray-800/30">
                            <td className="px-3 py-1.5 text-gray-300 font-medium">{c.categoria}</td>
                            <td className={`px-3 py-1.5 text-right font-bold ${tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
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

            {/* Lançamentos compactos */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-lg overflow-hidden">
              <div className="px-3.5 py-2 border-b border-gray-700 bg-gray-800/30">
                <p className="text-[11px] font-bold text-gray-400 uppercase">Lançamentos ({rel.data.lancamentos.length})</p>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40">
                    <th className="px-3 py-1.5 text-left">Descrição</th>
                    <th className="px-3 py-1.5 text-left w-28">Categoria</th>
                    <th className="px-3 py-1.5 text-left w-24">Vencimento</th>
                    <th className="px-3 py-1.5 text-center w-24">Status</th>
                    <th className="px-3 py-1.5 text-right w-28">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.data.lancamentos.map(l => (
                    <tr key={l.id} className="border-b border-gray-800/60 hover:bg-gray-800/30">
                      <td className="px-3 py-1.5 text-white font-medium">{l.descricao}</td>
                      <td className="px-3 py-1.5 text-gray-400 text-[11px]">{l.categoria ?? '—'}</td>
                      <td className="px-3 py-1.5 text-gray-400 text-[11px]">{fmtData(l.data_vencimento)}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${
                          l.status === 'pago' ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
                          l.status === 'atrasado' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                          'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                      <td className={`px-3 py-1.5 text-right font-bold ${l.tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
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
    </>
  );
}

