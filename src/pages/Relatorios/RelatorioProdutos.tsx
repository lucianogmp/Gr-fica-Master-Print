// src/pages/Relatorios/RelatorioProdutos.tsx
import { useMemo } from 'react';
import { useProdutos } from '../../hooks/useProdutos';
import { KpiCard } from '../../components/ui/KpiCard';
import { Package, DollarSign, CheckCircle2, Tag } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function RelatorioProdutos() {
  const { data: produtos = [], isLoading } = useProdutos();

  const ativos    = produtos.filter(p => p.status === 'ativo');
  const inativos  = produtos.filter(p => p.status === 'inativo');
  const rascunhos = produtos.filter(p => p.status === 'rascunho');
  const avgPreco  = ativos.length > 0
    ? ativos.reduce((s, p) => s + Number(p.preco_venda), 0) / ativos.length : 0;

  const porCategoria = useMemo(() => {
    const map: Record<string, { count: number; avgPreco: number; total: number }> = {};
    produtos.forEach(p => {
      const cat = (p as any).categoria_id ? 'Com categoria' : 'Sem categoria';
      if (!map[cat]) map[cat] = { count: 0, avgPreco: 0, total: 0 };
      map[cat].count++;
      map[cat].total += Number(p.preco_venda);
    });
    return Object.entries(map).map(([cat, d]) => ({
      categoria: cat,
      count: d.count,
      avgPreco: d.count > 0 ? d.total / d.count : 0,
    }));
  }, [produtos]);

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-400" /> Relatório de Produtos
        </h1>
        <p className="text-gray-500 text-sm">Visão geral do catálogo de produtos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total"      value={produtos.length} icon={Package}      color="text-blue-400" />
        <KpiCard label="Ativos"     value={ativos.length}   icon={CheckCircle2} color="text-green-400" />
        <KpiCard label="Preço médio" value={fmtBRL(avgPreco)} icon={DollarSign} color="text-yellow-400" />
        <KpiCard label="Rascunhos"  value={rascunhos.length} icon={Tag}         color="text-gray-400" />
      </div>

      {/* Status */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Produtos por Status</h3>
        <div className="space-y-2">
          {[
            { label: 'Ativos',    count: ativos.length,    cor: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30' },
            { label: 'Inativos',  count: inativos.length,  cor: 'text-gray-400',   bg: 'bg-gray-500/15 border-gray-500/30' },
            { label: 'Rascunhos', count: rascunhos.length, cor: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.bg} ${s.cor}`}>{s.label}</span>
              <span className="font-bold text-white">{s.count} produto(s)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lista completa */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700">
          <p className="text-xs font-bold text-gray-400 uppercase">Catálogo Completo ({produtos.length})</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40">
              <th className="px-5 py-3 text-left">Produto</th>
              <th className="px-5 py-3 text-left">SKU</th>
              <th className="px-5 py-3 text-center">Unidade</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-right">Preço</th>
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-600">Nenhum produto cadastrado.</td></tr>
            )}
            {produtos.map(p => (
              <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3 font-medium text-white">{p.nome}</td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.sku || '—'}</td>
                <td className="px-5 py-3 text-center">
                  <span className="text-[10px] font-bold bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                    {p.unidade_medida === 'm2' ? 'm²' : 'un'}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    p.status === 'ativo'    ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                    p.status === 'inativo'  ? 'bg-gray-500/15 text-gray-400 border-gray-500/30' :
                    'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                  }`}>{p.status}</span>
                </td>
                <td className="px-5 py-3 text-right font-bold text-green-400">
                  {fmtBRL(Number(p.preco_venda))}
                  {p.unidade_medida === 'm2' && <span className="text-[10px] text-gray-500 font-normal ml-0.5">/m²</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
