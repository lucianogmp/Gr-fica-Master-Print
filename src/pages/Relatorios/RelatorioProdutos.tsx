// src/pages/Relatorios/RelatorioProdutos.tsx
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

  if (isLoading) return <div className="p-6 text-blue-500 animate-pulse font-bold text-sm">Carregando...</div>;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-black text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-400" /> Relatório de Produtos
        </h1>
        <p className="text-gray-500 text-xs">Visão geral do catálogo de produtos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KpiCard label="Total"       value={produtos.length} icon={Package}      color="text-blue-400" compact />
        <KpiCard label="Ativos"      value={ativos.length}   icon={CheckCircle2} color="text-green-400" compact />
        <KpiCard label="Preço médio" value={fmtBRL(avgPreco)} icon={DollarSign} color="text-yellow-400" compact />
        <KpiCard label="Rascunhos"   value={rascunhos.length} icon={Tag}         color="text-gray-400" compact />
      </div>

      {/* Status compactado em uma linha só */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-lg px-3.5 py-2 flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Produtos por Status</span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-green-500/10 border border-green-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            <span className="text-[11px] font-medium text-green-400">Ativos:</span>
            <span className="text-xs font-black text-white">{ativos.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gray-500/10 border border-gray-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            <span className="text-[11px] font-medium text-gray-400">Inativos:</span>
            <span className="text-xs font-black text-white">{inativos.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
            <span className="text-[11px] font-medium text-yellow-400">Rascunhos:</span>
            <span className="text-xs font-black text-white">{rascunhos.length}</span>
          </div>
        </div>
      </div>

      {/* Lista completa compacta */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-3.5 py-2 border-b border-gray-700 bg-gray-800/30">
          <p className="text-[11px] font-bold text-gray-400 uppercase">Catálogo Completo ({produtos.length})</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase bg-gray-800/40">
              <th className="px-3 py-1.5 text-left">Produto</th>
              <th className="px-3 py-1.5 text-left w-28">SKU</th>
              <th className="px-3 py-1.5 text-center w-20">Unidade</th>
              <th className="px-3 py-1.5 text-center w-24">Status</th>
              <th className="px-3 py-1.5 text-right w-28">Preço</th>
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-600 text-xs">Nenhum produto cadastrado.</td></tr>
            )}
            {produtos.map(p => (
              <tr key={p.id} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                <td className="px-3 py-1.5 font-medium text-white">{p.nome}</td>
                <td className="px-3 py-1.5 text-gray-500 font-mono text-[11px]">{p.sku || '—'}</td>
                <td className="px-3 py-1.5 text-center">
                  <span className="text-[10px] font-bold bg-gray-700/60 text-gray-300 px-1.5 py-0.5 rounded">
                    {p.unidade_medida === 'm2' ? 'm²' : 'un'}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border capitalize ${
                    p.status === 'ativo'    ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                    p.status === 'inativo'  ? 'bg-gray-500/15 text-gray-400 border-gray-500/30' :
                    'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                  }`}>{p.status}</span>
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-green-400">
                  {fmtBRL(Number(p.preco_venda))}
                  {p.unidade_medida === 'm2' && <span className="text-[10px] text-gray-500 font-normal ml-0.5">/m²</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

