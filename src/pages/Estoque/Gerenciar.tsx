// src/pages/Estoque/Gerenciar.tsx
import { usePersistente } from '../../hooks/usePersistente';
import { useState, useMemo } from 'react';
import { useMateriasPrimas } from '../../hooks/useEstoque';
import { MateriaPrima, statusEstoque } from '../../types/estoque';
import { ModalMP } from '../../components/estoque/ModalMP';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { PackageSearch, Plus, Tags } from 'lucide-react';
import { CategoriasMaterialModal } from '../../components/estoque/CategoriasMaterialModal';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { BarraLista } from '../../components/ui/BarraLista';
import { CampoFiltro, FiltroValor, passaPeriodo, passaMulti, passaFaixa, passaSimNao } from '../../components/ui/FiltroModal';
import { CabecalhoFiltro } from '../../components/ui/CabecalhoFiltro';
import { aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Gerenciar() {
  const { data: mps = [], isLoading, criar, atualizar, deletar } = useMateriasPrimas();
  const { confirmar, ConfirmModal } = useConfirm();

  const [busca, setBusca] = usePersistente('busca', '');
  const [modalMP, setModalMP]   = useState(false);
  const [modalCats, setModalCats] = useState(false);
  const [editando, setEditando] = useState<MateriaPrima | null>(null);

  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [filtros, setFiltros] = usePersistente<FiltroValor>('filtros', {});
  const camposFiltro = useMemo<CampoFiltro[]>(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.map(x => (x ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(x => ({ value: x, label: x }));
    return [
      { tipo: 'periodo', chave: 'periodo', label: 'Cadastrado em' },
      { tipo: 'busca', chave: 'busca', label: 'Busca (nome, categoria)', placeholder: 'Nome ou categoria...' },
      { tipo: 'faixa', chave: 'saldo', label: 'Saldo em estoque' },
      { tipo: 'faixa', chave: 'custo', label: 'Custo por unidade' },
      { tipo: 'faixa', chave: 'venda', label: 'Preço de venda por unidade' },
      { tipo: 'multi', chave: 'status', label: 'Status do estoque', opcoes: [
        { value: 'ok', label: 'OK' }, { value: 'baixo', label: 'Baixo' }, { value: 'zerado', label: 'Zerado' }, { value: 'sem_controle', label: 'Sem controle' }] },
      { tipo: 'multi', chave: 'categoria', label: 'Categoria', opcoes: uniq(mps.map(m => m.categoria)), largo: true },
      { tipo: 'multi', chave: 'unidade', label: 'Unidade', opcoes: uniq(mps.map(m => m.unidade)) },
      { tipo: 'simnao', chave: 'controla', label: 'Controla estoque' },
      { tipo: 'simnao', chave: 'minimo', label: 'Tem estoque mínimo definido' },
      { tipo: 'simnao', chave: 'precoVenda', label: 'Tem preço de venda' },
    ];
  }, [mps]);
  const filtradas = useMemo(() => {
    const f = filtros;
    const bm = String(f.busca ?? '').trim();
    const lista = mps
      .filter(m => correspondeABuscaEmCampos([m.nome, m.categoria], busca))
      .filter(m => passaPeriodo(f.periodo, m.created_at))
      .filter(m => !bm || correspondeABuscaEmCampos([m.nome, m.categoria], bm))
      .filter(m => passaFaixa(f.saldo, m.saldo))
      .filter(m => passaFaixa(f.custo, m.custo_unitario))
      .filter(m => passaFaixa(f.venda, m.preco_venda))
      .filter(m => passaMulti(f.status, statusEstoque(m).key))
      .filter(m => passaMulti(f.categoria, m.categoria ?? ''))
      .filter(m => passaMulti(f.unidade, m.unidade))
      .filter(m => passaSimNao(f.controla, m.controla_estoque !== false))
      .filter(m => passaSimNao(f.minimo, Number(m.estoque_minimo) > 0))
      .filter(m => passaSimNao(f.precoVenda, Number(m.preco_venda ?? 0) > 0));
    return aplicarOrdenacao(lista, ordenacao, {
      nome: m => m.nome, categoria: m => m.categoria, saldo: m => Number(m.saldo), custo: m => Number(m.custo_unitario),
    });
  }, [mps, busca, filtros, ordenacao]);
  const opcoesCategoria = (camposFiltro.find(c => c.chave === 'categoria') as any)?.opcoes ?? [];

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <>
      <ConfirmModal />
      <CategoriasMaterialModal open={modalCats} onClose={() => setModalCats(false)} />
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <PackageSearch className="w-6 h-6 text-blue-400" /> Gerenciar Estoque
            </h1>
            <p className="text-gray-500 text-sm">{mps.length} matéria(s)-prima(s) cadastrada(s)</p>
          </div>
          <div className="flex gap-2">
          <button onClick={() => setModalCats(true)}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Tags className="w-4 h-4" /> Categorias
          </button>
          <button
            onClick={() => { setEditando(null); setModalMP(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Matéria-Prima
          </button>
          </div>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-gray-700">
            <BarraLista busca={busca} onBusca={setBusca} placeholder="Buscar por nome ou categoria..."
              camposOrdem={[
                { key: 'nome', label: 'Nome', labelAsc: 'A → Z', labelDesc: 'Z → A' },
                { key: 'categoria', label: 'Categoria', labelAsc: 'A → Z', labelDesc: 'Z → A' },
                { key: 'saldo', label: 'Saldo', labelAsc: 'Menor primeiro', labelDesc: 'Maior primeiro' },
                { key: 'custo', label: 'Custo', labelAsc: 'Menor primeiro', labelDesc: 'Maior primeiro' },
              ]}
              ordenacao={ordenacao} onOrdenar={setOrdenacao}
              camposFiltro={camposFiltro} filtros={filtros} onFiltros={setFiltros} titulo="Filtro avançado — Matérias-primas" />
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">
                  <CabecalhoFiltro label="Categoria" valor={filtros.categoria?.length === 1 ? filtros.categoria[0] : ''}
                    opcoes={opcoesCategoria} onChange={x => setFiltros(p => ({ ...p, categoria: x ? [x] : [] }))} />
                </th>
                <th className="px-5 py-3 text-center">Unidade</th>
                <th className="px-5 py-3 text-right">Custo/un</th>
                <th className="px-5 py-3 text-right">Saldo atual</th>
                <th className="px-5 py-3 text-right">Estoque mín.</th>
                <th className="px-5 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-600">Nenhuma matéria-prima cadastrada.</td></tr>
              )}
              {filtradas.map(mp => (
                <tr key={mp.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">
                    {mp.nome}
                    {mp.controla_estoque === false && (
                      <span className="ml-2 text-[9px] font-bold bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full align-middle">
                        sob medida
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{mp.categoria || '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="text-[10px] font-bold bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{mp.unidade}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">{fmtBRL(mp.custo_unitario)}</td>
                  <td className="px-5 py-3 text-right font-bold text-white">
                    {mp.controla_estoque === false
                      ? <span className="text-gray-600 font-normal text-xs">—</span>
                      : <>{Number(mp.saldo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {mp.unidade}</>}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500 text-xs">
                    {mp.controla_estoque === false ? '—' : (mp.estoque_minimo ? `${mp.estoque_minimo} ${mp.unidade}` : '—')}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => { setEditando(mp); setModalMP(true); }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirmar(`Remover "${mp.nome}"? Esta ação não pode ser desfeita.`, 'Remover Matéria-Prima'))
                            deletar(mp.id);
                        }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <ModalMP
        open={modalMP}
        editando={editando}
        onClose={() => { setModalMP(false); setEditando(null); }}
        onSalvar={dados => editando ? atualizar({ id: editando.id, dados }) : criar(dados)}
      />
    </>
  );
}
