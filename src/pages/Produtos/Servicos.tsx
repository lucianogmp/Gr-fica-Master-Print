// src/pages/Produtos/Servicos.tsx
import { useProdutos } from '../../hooks/useProdutos';
import { Wrench } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Servicos() {
  const { data: produtos = [], isLoading } = useProdutos();
  // Serviços = produtos terceirizados ou da categoria "Serviço"
  const servicos = produtos.filter(p => p.terceirizado || (p as any).setor?.toLowerCase() === 'serviço');

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Wrench className="w-6 h-6 text-blue-400" /> Serviços
        </h1>
        <p className="text-gray-500 text-sm">{servicos.length} serviço(s) cadastrado(s)</p>
      </div>

      {servicos.length === 0 ? (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center space-y-3">
          <Wrench className="w-12 h-12 text-gray-700 mx-auto" />
          <p className="text-gray-400 font-bold">Nenhum serviço cadastrado</p>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Produtos marcados como "Terceirizado" ou com setor "Serviço" aparecerão aqui.
            Cadastre em <strong>Catálogo</strong>.
          </p>
        </div>
      ) : (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Serviço</th>
                <th className="px-5 py-3 text-left">SKU</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Preço</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map(p => (
                <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">
                    {p.nome}
                    <span className="ml-2 text-[9px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">Terceirizado</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.sku || '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      p.status === 'ativo' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-black text-green-400">{fmtBRL(Number(p.preco_venda))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
