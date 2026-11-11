// src/pages/Estoque/Historico.tsx
import { useState, useMemo } from 'react';
import { useMovimentos } from '../../hooks/useEstoque';
import { History, ArrowUp, ArrowDown } from 'lucide-react';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { BarraLista } from '../../components/ui/BarraLista';
import { CampoFiltro, FiltroValor, passaPeriodo, passaMulti, passaFaixa, passaSimNao } from '../../components/ui/FiltroModal';
import { CabecalhoFiltro } from '../../components/ui/CabecalhoFiltro';
import { aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';

export function Historico() {
  const { data: movimentos = [], isLoading } = useMovimentos();
  const [filtro, setFiltro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');

  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [filtros, setFiltros] = useState<FiltroValor>({});
  const camposFiltro = useMemo<CampoFiltro[]>(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.map(x => (x ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(x => ({ value: x, label: x }));
    return [
      { tipo: 'periodo', chave: 'periodo', label: 'Data do movimento' },
      { tipo: 'busca', chave: 'busca', label: 'Busca (matéria-prima, motivo)', placeholder: 'Nome ou motivo...' },
      { tipo: 'busca', chave: 'motivo', label: 'Motivo contém', placeholder: 'Ex.: compra, venda, ajuste' },
      { tipo: 'faixa', chave: 'qtd', label: 'Quantidade' },
      { tipo: 'multi', chave: 'tipo', label: 'Tipo', opcoes: [{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }] },
      { tipo: 'multi', chave: 'mp', label: 'Matéria-prima', opcoes: uniq(movimentos.map(m => m.materias_primas?.nome)), largo: true },
      { tipo: 'multi', chave: 'origem', label: 'Origem do movimento', opcoes: uniq(movimentos.map(m => m.origem)) },
      { tipo: 'simnao', chave: 'venda', label: 'Ligado a uma venda/referência' },
    ];
  }, [movimentos]);
  const filtrados = useMemo(() => {
    const f = filtros;
    const bm = String(f.busca ?? '').trim();
    const mot = String(f.motivo ?? '').trim().toLowerCase();
    const lista = movimentos
      .filter(m => filtroTipo === 'todos' || m.tipo === filtroTipo)
      .filter(m => correspondeABuscaEmCampos([m.materias_primas?.nome, m.motivo], filtro))
      .filter(m => passaPeriodo(f.periodo, m.created_at))
      .filter(m => !bm || correspondeABuscaEmCampos([m.materias_primas?.nome, m.motivo, m.origem], bm))
      .filter(m => !mot || (m.motivo ?? '').toLowerCase().includes(mot))
      .filter(m => passaFaixa(f.qtd, m.quantidade))
      .filter(m => passaMulti(f.tipo, m.tipo))
      .filter(m => passaMulti(f.mp, m.materias_primas?.nome ?? ''))
      .filter(m => passaMulti(f.origem, m.origem ?? ''))
      .filter(m => passaSimNao(f.venda, !!m.referencia_id));
    return aplicarOrdenacao(lista, ordenacao ?? { campo: 'data', direcao: 'desc' }, {
      data: m => m.created_at, mp: m => m.materias_primas?.nome, qtd: m => Number(m.quantidade),
    });
  }, [movimentos, filtro, filtroTipo, filtros, ordenacao]);
  const opcoesMp = (camposFiltro.find(c => c.chave === 'mp') as any)?.opcoes ?? [];

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <History className="w-6 h-6 text-blue-400" /> Histórico de Movimentos
        </h1>
        <p className="text-gray-500 text-sm">{movimentos.length} movimento(s) registrado(s)</p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1">
          {([
            { key: 'todos',   label: 'Todos' },
            { key: 'entrada', label: 'Entradas' },
            { key: 'saida',   label: 'Saídas' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFiltroTipo(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filtroTipo === f.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-48">
          <BarraLista busca={filtro} onBusca={setFiltro} placeholder="Filtrar por matéria-prima ou motivo..."
            camposOrdem={[
              { key: 'data', label: 'Data', labelAsc: 'Mais antigo primeiro', labelDesc: 'Mais recente primeiro' },
              { key: 'mp', label: 'Matéria-prima', labelAsc: 'A → Z', labelDesc: 'Z → A' },
              { key: 'qtd', label: 'Quantidade', labelAsc: 'Menor primeiro', labelDesc: 'Maior primeiro' },
            ]}
            ordenacao={ordenacao} onOrdenar={setOrdenacao}
            camposFiltro={camposFiltro} filtros={filtros} onFiltros={setFiltros} titulo="Filtro avançado — Movimentos de estoque" />
        </div>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Data</th>
              <th className="px-5 py-3 text-left">
                <CabecalhoFiltro label="Matéria-Prima" valor={filtros.mp?.length === 1 ? filtros.mp[0] : ''}
                  opcoes={opcoesMp} onChange={x => setFiltros(p => ({ ...p, mp: x ? [x] : [] }))} />
              </th>
              <th className="px-5 py-3 text-center">Tipo</th>
              <th className="px-5 py-3 text-right">Quantidade</th>
              <th className="px-5 py-3 text-left">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-600">Nenhum movimento encontrado.</td></tr>
            )}
            {filtrados.map(m => (
              <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-5 py-3 font-medium text-white">{m.materias_primas?.nome ?? '—'}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                    m.tipo === 'entrada'
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}>
                    {m.tipo === 'entrada' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-bold text-white">
                  {Number(m.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {m.materias_primas?.unidade ?? ''}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">{m.motivo || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
