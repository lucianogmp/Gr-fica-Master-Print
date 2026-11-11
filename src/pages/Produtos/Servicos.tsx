// src/pages/Produtos/Servicos.tsx
import { useState, useMemo } from 'react';
import { useProdutos } from '../../hooks/useProdutos';
import { BarraLista } from '../../components/ui/BarraLista';
import { CampoFiltro, FiltroValor, passaPeriodo, passaMulti, passaFaixa } from '../../components/ui/FiltroModal';
import { CabecalhoFiltro } from '../../components/ui/CabecalhoFiltro';
import { aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { Wrench } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Servicos() {
  const { data: produtos = [], isLoading } = useProdutos();
  // Serviços = produtos terceirizados ou da categoria "Serviço"
  const servicosBase = produtos.filter(p => p.terceirizado || (p as any).setor?.toLowerCase() === 'serviço');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [filtros, setFiltros] = useState<FiltroValor>({});
  const camposFiltro = useMemo<CampoFiltro[]>(() => [
    { tipo: 'periodo', chave: 'periodo', label: 'Cadastrado em' },
    { tipo: 'busca', chave: 'busca', label: 'Busca (nome, SKU, descrição)', placeholder: 'Nome, SKU...' },
    { tipo: 'faixa', chave: 'preco', label: 'Preço' },
    { tipo: 'multi', chave: 'status', label: 'Status', opcoes: [{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }, { value: 'rascunho', label: 'Rascunho' }] },
  ], []);
  const servicos = useMemo(() => {
    const f = filtros;
    const bm = String(f.busca ?? '').trim();
    const lista = servicosBase
      .filter(p => correspondeABuscaEmCampos([p.nome, p.sku], busca))
      .filter(p => passaPeriodo(f.periodo, p.created_at))
      .filter(p => !bm || correspondeABuscaEmCampos([p.nome, p.sku, p.descricao], bm))
      .filter(p => passaFaixa(f.preco, p.preco_venda))
      .filter(p => passaMulti(f.status, p.status));
    return aplicarOrdenacao(lista, ordenacao, { nome: p => p.nome, preco: p => Number(p.preco_venda), sku: p => p.sku });
  }, [servicosBase, busca, filtros, ordenacao]);

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Wrench className="w-6 h-6 text-blue-400" /> Terceirizados
        </h1>
        <p className="text-gray-500 text-sm">{servicos.length} serviço(s) terceirizado(s)</p>
      </div>

      {servicosBase.length > 0 && (
        <BarraLista busca={busca} onBusca={setBusca} placeholder="Buscar por nome ou SKU..."
          camposOrdem={[
            { key: 'nome', label: 'Nome', labelAsc: 'A → Z', labelDesc: 'Z → A' },
            { key: 'preco', label: 'Preço', labelAsc: 'Menor primeiro', labelDesc: 'Maior primeiro' },
            { key: 'sku', label: 'SKU', labelAsc: 'A → Z', labelDesc: 'Z → A' },
          ]}
          ordenacao={ordenacao} onOrdenar={setOrdenacao}
          camposFiltro={camposFiltro} filtros={filtros} onFiltros={setFiltros} titulo="Filtro avançado — Terceirizados" />
      )}

      {servicosBase.length === 0 ? (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center space-y-3">
          <Wrench className="w-12 h-12 text-gray-700 mx-auto" />
          <p className="text-gray-400 font-bold">Nenhum serviço terceirizado cadastrado</p>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Produtos marcados como "Terceirizado" ou com setor "Serviço" aparecerão aqui.
            Cadastre em <strong>Catálogo</strong>.
          </p>
        </div>
      ) : (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Terceirizado</th>
                <th className="px-5 py-3 text-left">SKU</th>
                <th className="px-5 py-3 text-center">
                  <CabecalhoFiltro label="Status" align="center" valor={filtros.status?.length === 1 ? filtros.status[0] : ''}
                    opcoes={(camposFiltro[3] as any).opcoes} onChange={x => setFiltros(p => ({ ...p, status: x ? [x] : [] }))} />
                </th>
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
        </div>
      )}
    </div>
  );
}
