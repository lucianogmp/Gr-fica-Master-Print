import { useState, useEffect } from 'react';
import {
  Ruler, Pencil, FileText, DollarSign, Plus, X, AlertTriangle,
  Tag, Ticket, RotateCw, Check, Package, Search, type LucideIcon,
} from 'lucide-react';
import { OrcamentoItem, TipoCalculo, calcTaxaArte } from '../../types/orcamento';
import { PAPEIS } from '../../types/calculadora';
import { useMateriaisImpressao } from '../../hooks/useMateriaisImpressao';
import { useAcabamentos } from '../../hooks/useAcabamentos';
import { useCalculoFolhas } from '../../hooks/useCalculoFolhas';
import { useProdutos } from '../../hooks/useProdutos';
import { Produto } from '../../types/produto';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full";

type TabMode = TipoCalculo | 'catalogo';

const TIPOS: { key: TabMode; label: string; icon: LucideIcon }[] = [
  { key: 'catalogo',     label: 'Catálogo',    icon: Package },
  { key: 'metro',        label: 'm² Material', icon: Ruler },
  { key: 'metro_manual', label: 'm² Manual',   icon: Pencil },
  { key: 'folha',        label: 'Por Folha',   icon: FileText },
  { key: 'livre',        label: 'Livre',       icon: DollarSign },
];

interface Props {
  onAdicionar: (item: OrcamentoItem) => void;
  onCancelar: () => void;
  editando?: OrcamentoItem | null;
}

export function ItemOrcEditor({ onAdicionar, onCancelar, editando }: Props) {
  const { data: materiais = [] } = useMateriaisImpressao();
  const { data: acabamentos = [] } = useAcabamentos();
  const { data: produtos = [] } = useProdutos();

  const [tab, setTab]               = useState<TabMode>(editando ? editando.tipo_calculo : 'catalogo');
  const [tipo, setTipo]             = useState<TipoCalculo>(editando?.tipo_calculo ?? 'livre');
  const [descricao, setDescricao]   = useState(editando?.descricao ?? '');
  const [materialId, setMaterialId] = useState(editando?.material_id ?? '');
  const [precoM2, setPrecoM2]       = useState(String(editando?.preco_por_m2 ?? ''));
  const [largura, setLargura]       = useState(String(editando?.largura_cm ?? ''));
  const [altura, setAltura]         = useState(String(editando?.altura_cm ?? ''));
  const [quantidade, setQuantidade] = useState(String(editando?.quantidade ?? 1));
  const [folhaTipo, setFolhaTipo]   = useState(editando?.folha_tipo ?? 'A4');
  const [tipoMat, setTipoMat]       = useState<'adesivo' | 'tag'>('adesivo');
  const [itensFolha, setItensFolha] = useState(String(editando?.itens_por_folha ?? ''));
  const [precoFolha, setPrecoFolha] = useState(String(editando?.preco_por_folha ?? ''));
  const [precoLivre, setPrecoLivre] = useState(String(editando?.preco_unitario ?? ''));
  const [acabId, setAcabId]         = useState(editando?.acabamento_id ?? '');
  const [acabamentosPerFolha, setAcabamentosPerFolha] = useState(String(editando?.acabamentos_por_folha ?? ''));
  const [arteInclusa, setArteInclusa] = useState(editando?.arte_inclusa ?? false);

  // Catálogo
  const [buscaProd, setBuscaProd]     = useState('');
  const [prodSel, setProdSel]         = useState<Produto | null>(null);
  const [produtoId, setProdutoId]     = useState<string | null>(editando?.produto_id ?? null);

  function handleTabChange(t: TabMode) {
    setTab(t);
    if (t !== 'catalogo') {
      setTipo(t as TipoCalculo);
      setProdSel(null);
    }
  }

  function selecionarProduto(p: Produto) {
    setProdSel(p);
    setProdutoId(p.id);
    setDescricao(p.nome);
    setPrecoLivre(String(p.preco_venda ?? 0));
    setTipo('livre');
  }

  const matSel = materiais.find(m => m.id === materialId);
  const acabSel = acabamentos.find(a => a.id === acabId);

  const calcFolha = useCalculoFolhas({
    papelKey: folhaTipo,
    larguraItem: parseFloat(largura) || 0,
    alturaItem: parseFloat(altura) || 0,
    quantidadeTotal: parseInt(quantidade) || 1,
    tipoMaterial: tipoMat,
  });

  useEffect(() => {
    if (tipo === 'folha' && calcFolha && calcFolha.porFolha > 0) {
      setItensFolha(String(calcFolha.porFolha));
    }
  }, [calcFolha?.porFolha, tipo]);

  function buildPreview(): { unitario: number; total: number; area?: number; arteValor: number; custAcab: number } {
    const qtd       = parseInt(quantidade) || 1;
    const qtdAcab   = parseInt(acabamentosPerFolha) || 0;
    const custAcab  = acabSel ? Number(acabSel.custo) * qtdAcab * qtd : 0;
    let unitario   = 0;
    let area: number | undefined;

    if (tipo === 'metro') {
      const m2  = Number(matSel?.preco_m2 ?? 0);
      const w   = parseFloat(largura) / 100;
      const h   = parseFloat(altura) / 100;
      area      = w * h;
      unitario  = area * m2;
    } else if (tipo === 'metro_manual') {
      const m2  = parseFloat(precoM2) || 0;
      const w   = parseFloat(largura) / 100;
      const h   = parseFloat(altura) / 100;
      area      = w * h;
      unitario  = area * m2;
    } else if (tipo === 'folha') {
      const ppf = parseFloat(precoFolha) || 0;
      const ipf = parseInt(itensFolha) || 1;
      unitario  = ipf > 0 ? ppf / ipf : ppf;
    } else {
      unitario  = parseFloat(precoLivre) || 0;
    }

    let subtotal = unitario * qtd + custAcab;
    let arteValor = 0;
    if (arteInclusa && subtotal > 0) {
      const pct = calcTaxaArte(subtotal);
      arteValor = subtotal * (pct / 100);
      subtotal += arteValor;
    }
    return { unitario, total: subtotal, area, arteValor, custAcab };
  }

  const prev   = buildPreview();
  const acabQtdOk = !acabId || (parseInt(acabamentosPerFolha) > 0);
  const catalogoValido = tab === 'catalogo' ? (prodSel !== null && parseInt(quantidade) > 0) : true;
  const valido = descricao.trim().length > 0 && prev.total > 0 && acabQtdOk && catalogoValido;

  function handleAdicionar() {
    if (!valido) return;
    const item: OrcamentoItem = {
      descricao:       descricao.trim(),
      tipo_calculo:    tipo,
      produto_id:      produtoId ?? null,
      material_id:     tipo === 'metro' ? (materialId || null) : null,
      preco_por_m2:    tipo === 'metro' ? (matSel?.preco_m2 ?? 0) : tipo === 'metro_manual' ? (parseFloat(precoM2) || 0) : null,
      largura_cm:      ['metro','metro_manual','folha'].includes(tipo) ? (parseFloat(largura) || null) : null,
      altura_cm:       ['metro','metro_manual','folha'].includes(tipo) ? (parseFloat(altura) || null) : null,
      folha_tipo:      tipo === 'folha' ? folhaTipo : null,
      itens_por_folha: tipo === 'folha' ? (parseInt(itensFolha) || 1) : null,
      preco_por_folha: tipo === 'folha' ? (parseFloat(precoFolha) || 0) : null,
      quantidade:      parseInt(quantidade) || 1,
      preco_unitario:  prev.unitario,
      total:           prev.total,
      acabamento_id:   acabId || null,
      acabamento_nome: acabSel?.nome ?? null,
      acabamento_custo: acabSel?.custo ?? null,
      acabamentos_por_folha: acabId ? (parseInt(acabamentosPerFolha) || null) : null,
      arte_inclusa:    arteInclusa,
    };
    onAdicionar(item);
  }

  // produtos filtrados pela busca
  const produtosFiltrados = produtos
    .filter(p => p.status === 'ativo')
    .filter(p => !buscaProd || p.nome.toLowerCase().includes(buscaProd.toLowerCase()));

  return (
    <div className="bg-[#0d1117] border border-blue-500/40 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-blue-300 flex items-center gap-2">
          {editando ? <><Pencil className="w-4 h-4" /> Editar Item</> : <><Plus className="w-4 h-4" /> Novo Item</>}
        </h4>
        <button onClick={onCancelar} className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700 transition-all flex items-center gap-1">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>

      {/* Abas de tipo */}
      <div className="grid grid-cols-5 gap-1.5">
        {TIPOS.map(t => (
          <button key={t.key} onClick={() => handleTabChange(t.key)}
            className={`py-2.5 rounded-xl text-[10px] font-bold border transition-all flex flex-col items-center gap-1 ${
              tab === t.key
                ? t.key === 'catalogo'
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── CATÁLOGO ── */}
      {tab === 'catalogo' && (
        <div className="space-y-3">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              value={buscaProd}
              onChange={e => setBuscaProd(e.target.value)}
              placeholder="Buscar produto por nome..."
              className="w-full bg-[#111827] border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Grid de produtos */}
          {produtos.filter(p => p.status === 'ativo').length === 0 ? (
            <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Nenhum produto ativo cadastrado. Acesse a aba Produtos para adicionar.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {produtosFiltrados.length === 0 ? (
                <p className="col-span-2 text-center text-xs text-gray-600 py-4">Nenhum produto encontrado.</p>
              ) : (
                produtosFiltrados.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selecionarProduto(p)}
                    className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                      prodSel?.id === p.id
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-purple-500/50 hover:bg-gray-700/60'
                    }`}
                  >
                    <div className="font-bold text-xs truncate">{p.nome}</div>
                    {p.sku && <div className="text-[10px] text-gray-500 font-mono mt-0.5">{p.sku}</div>}
                    <div className="text-[11px] font-black text-green-400 mt-1">
                      {Number(p.preco_venda ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Produto selecionado — ajustar quantidade */}
          {prodSel && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-purple-400 uppercase font-bold">Produto selecionado</p>
                  <p className="text-sm font-bold text-white truncate mt-0.5">{prodSel.nome}</p>
                  <p className="text-xs text-green-400 font-black">
                    {Number(prodSel.preco_venda ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / un
                  </p>
                </div>
                <button onClick={() => { setProdSel(null); setProdutoId(null); setDescricao(''); setPrecoLivre(''); }}
                  className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Descrição (editável)</label>
                  <input value={descricao} onChange={e => setDescricao(e.target.value)}
                    className="bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-purple-500 transition-colors w-full" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade</label>
                  <input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)}
                    className="bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-purple-500 transition-colors w-full text-center text-lg font-black" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço unitário (R$)</label>
                <input type="number" min="0" step="0.01" value={precoLivre} onChange={e => setPrecoLivre(e.target.value)}
                  className="bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors w-full" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Descrição — apenas para abas não-catálogo */}
      {tab !== 'catalogo' && (
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Descrição *</label>
          <input value={descricao} onChange={e => setDescricao(e.target.value)}
            className={IN + ' py-2.5 text-sm'} placeholder="Ex: Banner lona brilho 2×1m" />
        </div>
      )}

      {/* ── m² Material ── */}
      {tab === 'metro' && tipo === 'metro' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">
              Material de Impressão ({materiais.filter(m => m.ativo).length} disponíveis)
            </label>
            {materiais.filter(m => m.ativo).length === 0 ? (
              <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Nenhum material cadastrado. Acesse Orçamentos → aba Materiais para adicionar.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {materiais.filter(m => m.ativo).map(m => (
                  <button key={m.id} onClick={() => setMaterialId(m.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                      materialId === m.id
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}>
                    <div className="font-bold truncate">{m.nome}</div>
                    <div className="text-gray-500 mt-0.5">{fmtBRL(m.preco_m2)}/m²</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DimQtd l={largura} a={altura} q={quantidade} setL={setLargura} setA={setAltura} setQ={setQuantidade} />
          {matSel && prev.area && prev.area > 0 && (
            <InfoRow items={[
              { label: 'Preço/m²', value: fmtBRL(matSel.preco_m2) },
              { label: 'Área', value: `${prev.area.toFixed(4)} m²` },
              { label: 'Unitário', value: fmtBRL(prev.unitario) },
            ]} />
          )}
        </div>
      )}

      {/* ── m² Manual ── */}
      {tab === 'metro_manual' && tipo === 'metro_manual' && (
        <div className="space-y-3">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-300 flex items-center gap-2">
            <Pencil className="w-4 h-4 flex-shrink-0" />
            Informe o preço por m² manualmente — para materiais especiais ou negociações.
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço por m² (R$)</label>
            <input type="number" min="0" step="0.01" value={precoM2} onChange={e => setPrecoM2(e.target.value)}
              className={IN + ' text-xl font-black text-center text-yellow-300 py-3'} placeholder="0,00" />
          </div>
          <DimQtd l={largura} a={altura} q={quantidade} setL={setLargura} setA={setAltura} setQ={setQuantidade} />
          {prev.area && prev.area > 0 && parseFloat(precoM2) > 0 && (
            <InfoRow items={[
              { label: 'Área', value: `${prev.area.toFixed(4)} m²` },
              { label: 'Unitário', value: fmtBRL(prev.unitario) },
            ]} />
          )}
        </div>
      )}

      {/* ── Por Folha ── */}
      {tab === 'folha' && tipo === 'folha' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Tipo de Papel</label>
              <select value={folhaTipo} onChange={e => setFolhaTipo(e.target.value)} className={IN}>
                {Object.entries(PAPEIS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Tipo de Material</label>
              <div className="flex gap-1 h-[38px]">
                {(['adesivo','tag'] as const).map(t => (
                  <button key={t} onClick={() => setTipoMat(t)}
                    className={`flex-1 rounded-lg text-xs font-bold border transition-all ${
                      tipoMat === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}>
                    {t === 'adesivo'
                      ? <span className="flex items-center justify-center gap-1"><Tag className="w-3.5 h-3.5" /> Adesivo</span>
                      : <span className="flex items-center justify-center gap-1"><Ticket className="w-3.5 h-3.5" /> Tag</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DimQtd l={largura} a={altura} q={quantidade} setL={setLargura} setA={setAltura} setQ={setQuantidade} />
          {calcFolha && calcFolha.porFolha > 0 && (
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3">
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <div><p className="text-[9px] text-gray-500 uppercase">Por folha</p><p className="text-xl font-black text-green-400">{calcFolha.porFolha}</p></div>
                <div><p className="text-[9px] text-gray-500 uppercase">Folhas</p><p className="text-xl font-black text-blue-400">{calcFolha.totalFolhas}</p></div>
                <div><p className="text-[9px] text-gray-500 uppercase">Área útil</p><p className="text-xl font-black text-yellow-400">{calcFolha.areaUtil}</p></div>
              </div>
              {calcFolha.rotacionado && (
                <p className="text-[9px] text-yellow-500 text-center flex items-center justify-center gap-1">
                  <RotateCw className="w-3 h-3" /> Melhor rotacionando 90°
                </p>
              )}
              <p className="text-[9px] text-gray-600 text-center">Espaço entre itens: {tipoMat === 'tag' ? '5mm' : '1,5mm'}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Itens por Folha</label>
              <input type="number" min="1" value={itensFolha} onChange={e => setItensFolha(e.target.value)} className={IN} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço por Folha (R$)</label>
              <input type="number" min="0" step="0.01" value={precoFolha} onChange={e => setPrecoFolha(e.target.value)} className={IN} />
            </div>
          </div>
        </div>
      )}

      {/* ── Preço Livre ── */}
      {tab === 'livre' && tipo === 'livre' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço Unitário (R$) *</label>
            <input type="number" min="0" step="0.01" value={precoLivre} onChange={e => setPrecoLivre(e.target.value)}
              className={IN + ' text-xl font-black text-center py-3'} placeholder="0,00" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade</label>
            <input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)}
              className={IN + ' text-xl font-black text-center py-3'} />
          </div>
        </div>
      )}

      {/* Acabamento — oculto no catálogo enquanto produto não selecionado */}
      {(tab !== 'catalogo' || prodSel) && <div className="pt-3 border-t border-gray-800">
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Acabamento</label>
        <div className="flex flex-wrap gap-1.5 items-end">
          <button onClick={() => setAcabId('')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
              !acabId ? 'bg-gray-600 border-gray-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'
            }`}>
            Sem acabamento
          </button>
          {acabamentos.filter(a => a.ativo).map(a => (
            <button key={a.id} onClick={() => setAcabId(a.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                acabId === a.id ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white hover:border-gray-500'
              }`}>
              {a.nome}{a.custo > 0 && ` +${fmtBRL(a.custo)}`}
            </button>
          ))}
          {acabId && (
            <div>
              <label className="text-[9px] text-gray-500 uppercase block mb-0.5">Qtd. acabamento</label>
              <input type="number" min="1" value={acabamentosPerFolha} onChange={e => setAcabamentosPerFolha(e.target.value)}
                className={IN + ' py-1.5 w-24'} placeholder="Ex: 4" />
            </div>
          )}
        </div>
      </div>}

      {/* Arte — oculto no catálogo enquanto produto não selecionado */}
      {(tab !== 'catalogo' || prodSel) && <div className="flex items-center justify-between py-2 border-t border-gray-800">
        <label className="flex items-center gap-2 cursor-pointer" onClick={() => setArteInclusa(!arteInclusa)}>
          <div className={`w-10 h-5 rounded-full relative transition-all ${arteInclusa ? 'bg-green-600' : 'bg-gray-700'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${arteInclusa ? 'left-5' : 'left-0.5'}`} />
          </div>
          <span className="text-xs text-gray-400">Arte inclusa</span>
        </label>
        {arteInclusa && prev.arteValor > 0 && (
          <div className="text-right">
            {(() => {
              const base = prev.total - prev.arteValor;
              const pct  = calcTaxaArte(base);
              return <p className="text-[10px] text-green-400">+{pct}% arte = {fmtBRL(prev.arteValor)}</p>;
            })()}
          </div>
        )}
      </div>}

      {/* Preview + botão */}
      <div className="flex items-end justify-between pt-3 border-t border-gray-700">
        <div>
          {prev.total > 0 ? (
            <>
              <p className="text-[10px] text-gray-500">Total do item</p>
              <p className="text-3xl font-black text-green-400">{fmtBRL(prev.total)}</p>
              {parseInt(quantidade) > 1 && prev.unitario > 0 && (
                <p className="text-[10px] text-gray-600">{fmtBRL(prev.unitario)} × {quantidade}</p>
              )}
              {prev.custAcab > 0 && (
                <p className="text-[10px] text-gray-600">
                  Acabamento: {fmtBRL(Number(acabSel?.custo ?? 0))} × {acabamentosPerFolha || 0}
                  {parseInt(quantidade) > 1 ? ` × ${quantidade}` : ''} = {fmtBRL(prev.custAcab)}
                </p>
              )}
            </>
          ) : (
            <div>
              <p className="text-xs text-gray-600">Preencha os campos para ver o total</p>
              {!descricao.trim() && <p className="text-[10px] text-red-500 mt-0.5">• Descrição obrigatória</p>}
              {tipo === 'livre' && !parseFloat(precoLivre) && <p className="text-[10px] text-red-500 mt-0.5">• Preço unitário obrigatório</p>}
              {tipo === 'metro' && !materialId && <p className="text-[10px] text-red-500 mt-0.5">• Selecione um material</p>}
              {(tipo === 'metro' || tipo === 'metro_manual') && (!parseFloat(largura) || !parseFloat(altura)) && <p className="text-[10px] text-red-500 mt-0.5">• Dimensões obrigatórias</p>}
              {acabId && !acabQtdOk && <p className="text-[10px] text-red-500 mt-0.5">• Informe a quantidade do acabamento</p>}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdicionar}
          disabled={!valido}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
            valido
              ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {editando
            ? <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Atualizar</span>
            : <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Adicionar</span>}
        </button>
      </div>
    </div>
  );
}

function DimQtd({ l, a, q, setL, setA, setQ }: { l: string; a: string; q: string; setL: (v: string) => void; setA: (v: string) => void; setQ: (v: string) => void; }) {
  const IN = "bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full";
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Largura (cm)</label>
        <input type="number" min="0" step="0.1" value={l} onChange={e => setL(e.target.value)} className={IN} placeholder="0" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Altura (cm)</label>
        <input type="number" min="0" step="0.1" value={a} onChange={e => setA(e.target.value)} className={IN} placeholder="0" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade</label>
        <input type="number" min="1" value={q} onChange={e => setQ(e.target.value)} className={IN} />
      </div>
    </div>
  );
}

function InfoRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="flex gap-4 bg-gray-800/50 rounded-lg px-3 py-2">
      {items.map(i => (
        <div key={i.label}>
          <p className="text-[9px] text-gray-500 uppercase">{i.label}</p>
          <p className="text-xs font-bold text-white">{i.value}</p>
        </div>
      ))}
    </div>
  );
}
