// src/pages/Produtos/TabelaPrecos.tsx
import { useProdutos } from '../../hooks/useProdutos';
import { useCategorias } from '../../hooks/useCategorias';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { DollarSign, Printer } from 'lucide-react';
import { imprimirCatalogo } from '../../components/impressao/imprimirCatalogo';
import { DEFAULT_LAYOUT_CATALOGO } from '../../types/layoutImpressao';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function TabelaPrecos() {
  const { data: produtos = [], isLoading } = useProdutos();
  const { data: categorias = [] } = useCategorias();
  const { data: cfg } = useConfiguracoes();
  const ativos = produtos.filter(p => p.status === 'ativo');

  function handleImprimirCatalogo() {
    const categoriaPorId = new Map(categorias.map(c => [c.id, c.nome]));
    imprimirCatalogo(
      cfg?.layout_impressao_catalogo ?? DEFAULT_LAYOUT_CATALOGO,
      cfg ?? {},
      {
        itens: ativos.map(p => ({
          nome: p.nome,
          sku: p.sku,
          descricao: p.descricao,
          unidade: p.unidade_medida,
          precoVenda: Number(p.preco_venda),
          categoriaNome: p.categoria_id ? categoriaPorId.get(p.categoria_id) ?? null : null,
        })),
      },
    );
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-400" /> Tabela de Preços
          </h1>
          <p className="text-gray-500 text-sm">{ativos.length} produto(s) ativo(s)</p>
        </div>
        <button onClick={handleImprimirCatalogo} disabled={ativos.length === 0}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 flex-shrink-0">
          <Printer className="w-4 h-4" /> Imprimir Catálogo
        </button>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Produto</th>
              <th className="px-5 py-3 text-left">SKU</th>
              <th className="px-5 py-3 text-center">Unidade</th>
              <th className="px-5 py-3 text-right">Preço de Venda</th>
            </tr>
          </thead>
          <tbody>
            {ativos.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-600">Nenhum produto ativo.</td></tr>
            )}
            {ativos.map(p => (
              <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3 font-medium text-white">{p.nome}</td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.sku || '—'}</td>
                <td className="px-5 py-3 text-center">
                  <span className="text-[10px] font-bold bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                    {p.unidade_medida === 'm2' ? 'm²' : 'un'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-black text-green-400">
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
