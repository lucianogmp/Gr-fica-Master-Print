// src/pages/Relatorios/RelatorioFinanceiro.tsx
import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useRelatorioFinanceiro, RelatorioFinanceiroFiltros } from '../../hooks/useRelatorios';
import { Landmark, Download, Printer, AlertTriangle, Inbox } from 'lucide-react';

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const IN = "bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

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

export function RelatorioFinanceiro() {
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

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Landmark className="w-6 h-6 text-blue-400" /> Relatório Financeiro
            </h1>
            <p className="text-gray-500 text-sm">Lançamentos, receitas e despesas por período</p>
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
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tipo</label>
              <select value={rascunho.tipo ?? ''}
                onChange={e => setRascunho(f => ({ ...f, tipo: (e.target.value as any) || undefined }))} className={IN + ' w-full'}>
                <option value="">Todos</option>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Status</label>
              <select value={rascunho.status ?? ''}
                onChange={e => setRascunho(f => ({ ...f, status: e.target.value || undefined }))} className={IN + ' w-full'}>
                <option value="">Todos</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="atrasado">Atrasado</option>
              </select>
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
            <p className="text-red-400 text-sm font-bold">Erro ao gerar relatório financeiro.</p>
          </div>
        )}
        {rel.data && rel.data.lancamentos.length === 0 && (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center">
            <Inbox className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum lançamento encontrado no período.</p>
          </div>
        )}

        {rel.data && rel.data.lancamentos.length > 0 && (
          <div id="print-rel-fin" className="space-y-5">
            <div className="hidden print:block mb-4 border-b pb-4">
              <h2 className="text-xl font-black">Relatório Financeiro</h2>
              <p className="text-gray-600 text-sm">Período: {fmtData(filtros.data_inicio)} a {fmtData(filtros.data_fim)}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Total receitas" value={fmtBRL(rel.data.resumo.total_receitas)} cor="text-green-400" />
              <KPI label="Total despesas" value={fmtBRL(rel.data.resumo.total_despesas)} cor="text-red-400" />
              <KPI label="Saldo"          value={fmtBRL(rel.data.resumo.saldo)} cor={rel.data.resumo.saldo >= 0 ? 'text-blue-400' : 'text-red-400'} />
              <KPI label="A receber"      value={fmtBRL(rel.data.resumo.a_receber)} cor="text-yellow-400" />
            </div>

            {rel.data.resumo.por_mes.length > 0 && (
              <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-4">Receita × Despesa por Mês</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rel.data.resumo.por_mes}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
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
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['receita', 'despesa'] as const).map(tipo => {
                const cats = rel.data!.resumo.por_categoria.filter(c => c.tipo === tipo);
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

            <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-700">
                <p className="text-xs font-bold text-gray-400 uppercase">Lançamentos ({rel.data.lancamentos.length})</p>
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
                  {rel.data.lancamentos.map(l => (
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
    </>
  );
}
