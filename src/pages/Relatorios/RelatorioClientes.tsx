// src/pages/Relatorios/RelatorioClientes.tsx
import { useMemo } from 'react';
import { useClientes } from '../../hooks/useClientes';
import { useVendas } from '../../hooks/useVendas';
import { KpiCard } from '../../components/ui/KpiCard';
import { Users2, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';

const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export function RelatorioClientes() {
  const { data: clientes = [], isLoading: loadC } = useClientes();
  const { data: vendas   = [], isLoading: loadV } = useVendas();

  const ranking = useMemo(() => {
    const map: Record<string, { nome: string; pedidos: number; total: number; ultima: string }> = {};
    vendas.filter(v => v.status !== 'cancelado').forEach(v => {
      const nome = v.cliente_nome || 'Sem cliente';
      if (!map[nome]) map[nome] = { nome, pedidos: 0, total: 0, ultima: '' };
      map[nome].pedidos++;
      map[nome].total += Number(v.valor_total ?? v.total ?? 0);
      const data = v.data_venda ?? v.created_at ?? '';
      if (data > map[nome].ultima) map[nome].ultima = data;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [vendas]);

  const totalGeral = ranking.reduce((s, c) => s + c.total, 0);
  const ticketMedio = ranking.length > 0
    ? ranking.reduce((s, c) => s + c.total / c.pedidos, 0) / ranking.length : 0;

  if (loadC || loadV) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Users2 className="w-6 h-6 text-blue-400" /> Relatório de Clientes
        </h1>
        <p className="text-gray-500 text-sm">Ranking e análise de clientes</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Clientes cadastrados" value={clientes.length}     icon={Users2}      color="text-blue-400" />
        <KpiCard label="Com compras"          value={ranking.length}      icon={ShoppingCart} color="text-green-400" />
        <KpiCard label="Total geral"          value={fmtBRL(totalGeral)}  icon={DollarSign}  color="text-green-400" />
        <KpiCard label="Ticket médio"         value={fmtBRL(ticketMedio)} icon={TrendingUp}  color="text-purple-400" />
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700">
          <p className="text-xs font-bold text-gray-400 uppercase">Ranking de Clientes por Valor Total</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40">
              <th className="px-5 py-3 text-left">#</th>
              <th className="px-5 py-3 text-left">Cliente</th>
              <th className="px-5 py-3 text-right">Pedidos</th>
              <th className="px-5 py-3 text-right">Ticket Médio</th>
              <th className="px-5 py-3 text-left">Última Compra</th>
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhuma venda registrada ainda.</td></tr>
            )}
            {ranking.map((c, i) => (
              <tr key={c.nome} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3 text-gray-500 font-bold">{i + 1}</td>
                <td className="px-5 py-3 font-medium text-white">{c.nome}</td>
                <td className="px-5 py-3 text-right text-gray-400">{c.pedidos}</td>
                <td className="px-5 py-3 text-right text-blue-400 font-bold">{fmtBRL(c.total / c.pedidos)}</td>
                <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(c.ultima)}</td>
                <td className="px-5 py-3 text-right font-black text-green-400">{fmtBRL(c.total)}</td>
              </tr>
            ))}
          </tbody>
          {ranking.length > 0 && (
            <tfoot>
              <tr className="border-t border-green-500/20 bg-green-900/10">
                <td colSpan={5} className="px-5 py-2.5 text-right text-xs font-bold text-gray-500 uppercase">Total geral</td>
                <td className="px-5 py-2.5 text-right font-black text-green-400">{fmtBRL(totalGeral)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
