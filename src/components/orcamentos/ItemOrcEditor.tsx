import { useState, useRef, useEffect } from 'react';
import {
  Ruler, Pencil, Plus, X, AlertTriangle,
  Check, Package, Search, type LucideIcon,
} from 'lucide-react';
import { OrcamentoItem, TipoCalculo, calcTaxaArte } from '../../types/orcamento';
import { useMateriaisImpressao } from '../../hooks/useMateriaisImpressao';
import { useAcabamentos } from '../../hooks/useAcabamentos';
import { useProdutos } from '../../hooks/useProdutos';
import { Produto } from '../../types/produto';
import { MoneyInput } from '../ui/MoneyInput';
import { MedidaInput } from '../ui/MedidaInput';

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const IN_BASE =
  'bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full';

type TabMode = TipoCalculo | 'catalogo';

const TIPOS: { key: TabMode; label: string; icon: LucideIcon }[] = [
  { key: 'catalogo', label: 'Catálogo', icon: Package },
  { key: 'metro', label: 'm² Material', icon: Ruler },
  { key: 'metro_manual', label: 'm² Manual', icon: Pencil },
];

// ── Sub-componentes declarados ANTES do componente principal ─────────────────

function NumInput({
  value,
  onChange,
  className,
  placeholder,
  step = '0.001',
  min = '0',
  center = false,
  big = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  step?: string;
  min?: string;
  center?: boolean;
  big?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        className ?? IN_BASE,
        center ? 'text-center' : '',
        big ? 'text-xl font-black py-3' : '',
      ].join(' ')}
    />
  );
}

function DimQtd({
  l, a, q,
  setL, setA, setQ,
}: {
  l: string; a: string; q: string;
  setL: (v: string) => void;
  setA: (v: string) => void;
  setQ: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Largura (m)</label>
        <MedidaInput
          value={l ? Number(l) / 100 : 0}
          onChange={vMetros => setL(vMetros > 0 ? String(Math.round(vMetros * 100 * 100) / 100) : '')}
          className={IN_BASE}
          placeholder="0,00"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Altura (m)</label>
        <MedidaInput
          value={a ? Number(a) / 100 : 0}
          onChange={vMetros => setA(vMetros > 0 ? String(Math.round(vMetros * 100 * 100) / 100) : '')}
          className={IN_BASE}
          placeholder="0,00"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade</label>
        <NumInput value={q} onChange={setQ} step="1" min="1" />
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

// ── Componente principal ─────────────────────────────────────────────────────

interface Props {
  onAdicionar: (item: OrcamentoItem) => void;
  onCancelar: () => void;
  editando?: OrcamentoItem | null;
}

export function ItemOrcEditor({ onAdicionar, onCancelar, editando }: Props) {
  const { data: materiais = [] } = useMateriaisImpressao();
  const { data: acabamentos = [] } = useAcabamentos();
  const { data: produtos = [] } = useProdutos();

  // Refs pro auto-scroll/foco progressivo: ao abrir o editor, rola até ele;
  // ao escolher material/produto, rola até a próxima seção obrigatória.
  const raizRef = useRef<HTMLDivElement>(null);
  const medidasRef = useRef<HTMLDivElement>(null);
  const painelProdutoRef = useRef<HTMLDivElement>(null);

  function scrollAte(ref: React.RefObject<HTMLDivElement>) {
    // Espera o próximo paint pra garantir que a seção já está no DOM
    // (ex: o painel do produto só aparece depois que prodSel deixa de ser null).
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  useEffect(() => {
    raizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = useState<TabMode>(
    editando ? (editando.tipo_calculo as TabMode) : 'metro',
  );
  const [tipo, setTipo] = useState<TipoCalculo>(editando?.tipo_calculo ?? 'metro');
  const [descricao, setDescricao] = useState(editando?.descricao ?? '');
  const [materialId, setMaterialId] = useState(editando?.material_id ?? '');
  const [precoM2, setPrecoM2] = useState(String(editando?.preco_por_m2 ?? ''));
  const [largura, setLargura] = useState(String(editando?.largura_cm ?? ''));
  const [altura, setAltura] = useState(String(editando?.altura_cm ?? ''));
  const [quantidade, setQuantidade] = useState(String(editando?.quantidade ?? 1));
  const [precoLivre, setPrecoLivre] = useState(String(editando?.preco_unitario ?? ''));
  const [acabId, setAcabId] = useState(editando?.acabamento_id ?? '');
  const [acabQtd, setAcabQtd] = useState(String(editando?.acabamentos_por_folha ?? ''));
  const [arteInclusa, setArteInclusa] = useState(editando?.arte_inclusa ?? false);

  // Detalhe adicional opcional pro tipo "m² Material" — a descrição principal
  // vem automaticamente do material selecionado (ex: "Adesivo de Papel"), e
  // esse campo é só um complemento livre, não obrigatório (ex: "2 faces").
  // Ao editar um item existente, tenta separar de volta "Material — detalhe".
  const materialEditando = materiais.find(m => m.id === editando?.material_id);
  const prefixoEditando = materialEditando ? `${materialEditando.nome} — ` : null;
  const [subdescricao, setSubdescricao] = useState(
    editando && prefixoEditando && editando.descricao.startsWith(prefixoEditando)
      ? editando.descricao.slice(prefixoEditando.length)
      : ''
  );

  // Catálogo
  const [buscaProd, setBuscaProd] = useState('');
  const [prodSel, setProdSel] = useState<Produto | null>(null);
  const [produtoId, setProdutoId] = useState<string | null>(editando?.produto_id ?? null);
  const [areaM2, setAreaM2] = useState(
    editando?.area_m2 != null ? String(editando.area_m2) : '',
  );

  // ── handlers ───────────────────────────────────────────────────────────────

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
    if (!editando || editando.produto_id !== p.id) setAreaM2('');
    scrollAte(painelProdutoRef);
  }

  function selecionarMaterial(m: { id: string; nome: string; preco_m2: number }) {
    setMaterialId(m.id);
    // descrição principal passa a ser o nome do material automaticamente —
    // o usuário só precisa diferenciar no campo de detalhe, se quiser.
    setDescricao(m.nome);
    scrollAte(medidasRef);
  }

  const matSel = materiais.find(m => m.id === materialId);
  const acabSel = acabamentos.find(a => a.id === acabId);
  const prodPorM2 = !!prodSel && (prodSel as any).unidade_medida === 'm2';

  // descrição que efetivamente conta pra validação/gravação: no modo "m²
  // Material" ela é sempre o nome do material (não depende de digitação).
  const descricaoEfetiva = tab === 'metro' ? (matSel?.nome ?? '') : descricao;

  // ── cálculo do preview ─────────────────────────────────────────────────────

  function buildPreview() {
    const qtd = parseFloat(quantidade) || 1;
    const qtdAcab = parseInt(acabQtd) || 0;
    const custAcab = acabSel ? Number(acabSel.custo) * qtdAcab * qtd : 0;
    let unitario = 0;
    let area: number | undefined;

    if (tipo === 'metro') {
      const w = parseFloat(largura) / 100;
      const h = parseFloat(altura) / 100;
      area = w * h;
      unitario = area * Number(matSel?.preco_m2 ?? 0);
    } else if (tipo === 'metro_manual') {
      const w = parseFloat(largura) / 100;
      const h = parseFloat(altura) / 100;
      area = w * h;
      unitario = area * (parseFloat(precoM2) || 0);
    } else if (prodPorM2) {
      area = parseFloat(areaM2) || 0;
      unitario = area * (parseFloat(precoLivre) || 0);
    } else {
      unitario = parseFloat(precoLivre) || 0;
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

  const prev = buildPreview();

  const acabQtdOk = !acabId || parseInt(acabQtd) > 0;
  const areaOk = !prodPorM2 || parseFloat(areaM2) > 0;
  const catalogoValido =
    tab === 'catalogo'
      ? prodSel !== null && parseFloat(quantidade) > 0 && areaOk
      : true;
  const valido =
    descricaoEfetiva.trim().length > 0 && prev.total > 0 && acabQtdOk && catalogoValido;

  // ── adicionar item ─────────────────────────────────────────────────────────

  function handleAdicionar() {
    if (!valido) return;
    const qtd = parseFloat(quantidade) || 1;

    // No modo "m² Material" a descrição gravada é "Nome do Material" e, se
    // houver detalhe adicional, "Nome do Material — detalhe".
    const descricaoFinal =
      tab === 'metro' && matSel
        ? (subdescricao.trim() ? `${matSel.nome} — ${subdescricao.trim()}` : matSel.nome)
        : descricao.trim();

    // preco_unitario deve incluir o acréscimo da arte para que
    // preco_unitario × quantidade == total (sem o acabamento, que é custo separado)
    // total = (unitario * qtd + custAcab) * (1 + pctArte/100)
    // => precoUnitarioComArte = total / qtd  — forma mais simples e sempre consistente
    const precoUnitarioFinal = qtd > 0 ? prev.total / qtd : prev.total;
    const item: OrcamentoItem = {
      descricao: descricaoFinal,
      tipo_calculo: tipo,
      produto_id: produtoId ?? null,
      material_id: tipo === 'metro' ? (materialId || null) : null,
      preco_por_m2:
        tipo === 'metro' ? (matSel?.preco_m2 ?? 0)
          : tipo === 'metro_manual' ? (parseFloat(precoM2) || 0)
            : prodPorM2 ? (parseFloat(precoLivre) || 0)
              : null,
      largura_cm: ['metro', 'metro_manual'].includes(tipo) ? (parseFloat(largura) || null) : null,
      altura_cm: ['metro', 'metro_manual'].includes(tipo) ? (parseFloat(altura) || null) : null,
      area_m2: prodPorM2 ? (parseFloat(areaM2) || null) : null,
      folha_tipo: null,
      itens_por_folha: null,
      preco_por_folha: null,
      quantidade: qtd,
      preco_unitario: precoUnitarioFinal,
      total: prev.total,
      acabamento_id: acabId || null,
      acabamento_nome: acabSel?.nome ?? null,
      acabamento_custo: acabSel?.custo ?? null,
      acabamentos_por_folha: acabId ? (parseInt(acabQtd) || null) : null,
      arte_inclusa: arteInclusa,
    };
    onAdicionar(item);
  }

  const produtosFiltrados = produtos
    .filter(p => p.status === 'ativo')
    .filter(p =>
      !buscaProd || p.nome.toLowerCase().includes(buscaProd.toLowerCase()),
    );

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={raizRef} className="bg-[#0d1117] border border-blue-500/40 rounded-2xl p-5 space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-blue-300 flex items-center gap-2">
          {editando
            ? <><Pencil className="w-4 h-4" /> Editar Item</>
            : <><Plus className="w-4 h-4" /> Novo Item</>}
        </h4>
        <button
          onClick={onCancelar}
          className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700 transition-all flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-3 gap-1.5">
        {TIPOS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={[
              'py-2.5 rounded-xl text-[10px] font-bold border transition-all flex flex-col items-center gap-1',
              tab === t.key
                ? t.key === 'catalogo'
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500',
            ].join(' ')}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CATÁLOGO ── */}
      {tab === 'catalogo' && (
        <div className="space-y-3">
          {/* Busca */}
          <div className="flex items-center gap-2 bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 focus-within:border-purple-500 transition-colors">
            <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              value={buscaProd}
              onChange={e => setBuscaProd(e.target.value)}
              placeholder="Buscar produto por nome..."
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none [color-scheme:dark]"
            />
          </div>

          {/* Grid */}
          {produtos.filter(p => p.status === 'ativo').length === 0 ? (
            <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Nenhum produto ativo cadastrado.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {produtosFiltrados.length === 0 ? (
                <p className="col-span-2 text-center text-xs text-gray-600 py-4">Nenhum produto encontrado.</p>
              ) : produtosFiltrados.map(p => {
                const eM2 = (p as any).unidade_medida === 'm2';
                return (
                  <button
                    key={p.id}
                    onClick={() => selecionarProduto(p)}
                    className={[
                      'text-left px-3 py-2.5 rounded-xl border transition-all',
                      prodSel?.id === p.id
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-purple-500/50 hover:bg-gray-700/60',
                    ].join(' ')}
                  >
                    <div className="font-bold text-xs truncate flex items-center gap-1">
                      {p.nome}
                      {eM2 && (
                        <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1 py-0.5 rounded flex-shrink-0">
                          m²
                        </span>
                      )}
                    </div>
                    {p.sku && (
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">{p.sku}</div>
                    )}
                    <div className="text-[11px] font-black text-green-400 mt-1">
                      {Number(p.preco_venda ?? 0).toLocaleString('pt-BR', {
                        style: 'currency', currency: 'BRL',
                      })}
                      {eM2 ? ' /m²' : ' /un'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Painel produto selecionado */}
          {prodSel && (
            <div ref={painelProdutoRef} className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-purple-400 uppercase font-bold">Produto selecionado</p>
                  <p className="text-sm font-bold text-white truncate mt-0.5">{prodSel.nome}</p>
                  <p className="text-xs text-green-400 font-black">
                    {Number(prodSel.preco_venda ?? 0).toLocaleString('pt-BR', {
                      style: 'currency', currency: 'BRL',
                    })}
                    {prodPorM2 ? ' /m²' : ' /un'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setProdSel(null); setProdutoId(null);
                    setDescricao(''); setPrecoLivre(''); setAreaM2('');
                  }}
                  className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Descrição — linha inteira */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Descrição</label>
                <input
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors w-full"
                />
              </div>

              {/* Preço + Quantidade — linha dividida */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">
                    {prodPorM2 ? 'Preço por m² (R$)' : 'Preço unitário (R$)'}
                  </label>
                  <MoneyInput
                    value={precoLivre}
                    onChange={v => setPrecoLivre(String(v))}
                    className="bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade</label>
                  <NumInput
                    value={quantidade}
                    onChange={setQuantidade}
                    step="1" min="1"
                    center big
                    className="bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-purple-500 transition-colors w-full"
                  />
                </div>
              </div>

              {/* Área m² — só para produtos por m² */}
              {prodPorM2 && (
                <div>
                  <label className="text-[10px] font-bold text-blue-400 uppercase block mb-1.5">
                    Área (m²)
                  </label>
                  <NumInput
                    value={areaM2}
                    onChange={setAreaM2}
                    step="0.001" min="0"
                    center big
                    placeholder="Ex: 1.250"
                    className="bg-[#111827] border border-blue-500/50 rounded-lg px-2.5 py-2 text-blue-300 text-xs focus:outline-none focus:border-blue-400 transition-colors w-full"
                  />
                  {!areaOk && (
                    <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Informe a área em m²
                    </p>
                  )}
                </div>
              )}

              {/* Resumo m² */}
              {prodPorM2 && parseFloat(areaM2) > 0 && parseFloat(precoLivre) > 0 && (
                <InfoRow items={[
                  { label: 'Área', value: `${(parseFloat(areaM2) || 0).toFixed(3)} m²` },
                  { label: 'Preço/m²', value: fmtBRL(parseFloat(precoLivre) || 0) },
                  { label: 'Subtotal', value: fmtBRL(prev.unitario) },
                ]} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Descrição — abas não-catálogo, exceto "m² Material" que é automática */}
      {tab !== 'catalogo' && tab !== 'metro' && (
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Descrição *</label>
          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className={IN_BASE + ' py-2.5 text-sm'}
            placeholder="Ex: Banner lona brilho 2×1m"
          />
        </div>
      )}

      {/* ── m² MATERIAL ── */}
      {tab === 'metro' && tipo === 'metro' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">
              Material de Impressão ({materiais.filter(m => m.ativo).length} disponíveis)
            </label>
            {materiais.filter(m => m.ativo).length === 0 ? (
              <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Nenhum material cadastrado.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {materiais.filter(m => m.ativo).map(m => (
                  <button
                    key={m.id}
                    onClick={() => selecionarMaterial(m)}
                    className={[
                      'px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left',
                      materialId === m.id
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white',
                    ].join(' ')}
                  >
                    <div className="font-bold truncate">{m.nome}</div>
                    <div className="text-gray-500 mt-0.5">{fmtBRL(m.preco_m2)}/m²</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {matSel && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-blue-400 uppercase font-bold">Descrição</span>
                <span className="text-sm font-bold text-white">{matSel.nome}</span>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">
                  Detalhe adicional (opcional)
                </label>
                <input
                  value={subdescricao}
                  onChange={e => setSubdescricao(e.target.value)}
                  className={IN_BASE}
                  placeholder="Ex: 2 faces, corte especial, cliente tal..."
                />
              </div>
            </div>
          )}

          <div ref={medidasRef}>
            <DimQtd l={largura} a={altura} q={quantidade} setL={setLargura} setA={setAltura} setQ={setQuantidade} />
          </div>
          {matSel && prev.area && prev.area > 0 && (
            <InfoRow items={[
              { label: 'Preço/m²', value: fmtBRL(matSel.preco_m2) },
              { label: 'Área', value: `${prev.area.toFixed(4)} m²` },
              { label: 'Unitário', value: fmtBRL(prev.unitario) },
            ]} />
          )}
        </div>
      )}

      {/* ── m² MANUAL ── */}
      {tab === 'metro_manual' && tipo === 'metro_manual' && (
        <div className="space-y-3">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-300 flex items-center gap-2">
            <Pencil className="w-4 h-4 flex-shrink-0" />
            Informe o preço por m² manualmente.
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço por m² (R$)</label>
            <MoneyInput
              value={precoM2}
              onChange={v => setPrecoM2(String(v))}
              placeholder="0,00"
              className={IN_BASE + ' text-yellow-300 text-center text-xl font-black py-3'}
            />
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

      {/* ── ACABAMENTO ── */}
      {(tab !== 'catalogo' || prodSel) && (
        <div className="pt-3 border-t border-gray-800">
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Acabamento</label>
          <div className="flex flex-wrap gap-1.5 items-end">
            <button
              onClick={() => setAcabId('')}
              className={[
                'px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
                !acabId
                  ? 'bg-gray-600 border-gray-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white',
              ].join(' ')}
            >
              Sem acabamento
            </button>
            {acabamentos.filter(a => a.ativo).map(a => (
              <button
                key={a.id}
                onClick={() => setAcabId(a.id)}
                className={[
                  'px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
                  acabId === a.id
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white hover:border-gray-500',
                ].join(' ')}
              >
                {a.nome}{a.custo > 0 && ` +${fmtBRL(a.custo)}`}
              </button>
            ))}
            {acabId && (
              <div>
                <label className="text-[9px] text-gray-500 uppercase block mb-0.5">Qtd. acabamento</label>
                <NumInput
                  value={acabQtd}
                  onChange={setAcabQtd}
                  step="1" min="1"
                  placeholder="Ex: 4"
                  className={IN_BASE + ' py-1.5 w-24'}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACRÉSCIMO DA ARTE ── */}
      {(tab !== 'catalogo' || prodSel) && (
        <div className="flex items-center justify-between py-2 border-t border-gray-800">
          <label
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setArteInclusa(v => !v)}
          >
            <div className={[
              'w-10 h-5 rounded-full relative transition-all',
              arteInclusa ? 'bg-green-600' : 'bg-gray-700',
            ].join(' ')}>
              <div className={[
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                arteInclusa ? 'left-5' : 'left-0.5',
              ].join(' ')} />
            </div>
            <span className="text-xs text-gray-400">Acréscimo da Arte</span>
          </label>
          {arteInclusa && prev.arteValor > 0 && (() => {
            const pct = calcTaxaArte(prev.total - prev.arteValor);
            return (
              <p className="text-[10px] text-green-400">
                +{pct}% arte = {fmtBRL(prev.arteValor)}
              </p>
            );
          })()}
        </div>
      )}

      {/* ── PREVIEW + BOTÃO ── */}
      <div className="flex items-end justify-between pt-3 border-t border-gray-700">
        <div>
          {prev.total > 0 ? (
            <>
              <p className="text-[10px] text-gray-500">Total do item</p>
              <p className="text-3xl font-black text-green-400">{fmtBRL(prev.total)}</p>
              {parseFloat(quantidade) > 1 && prev.total > 0 && (
                <p className="text-[10px] text-gray-600">
                  {fmtBRL(prev.total / (parseFloat(quantidade) || 1))} × {quantidade}
                </p>
              )}
              {prodPorM2 && prev.area != null && (
                <p className="text-[10px] text-gray-600">
                  {prev.area.toFixed(3)} m² × {fmtBRL(parseFloat(precoLivre) || 0)}/m²
                </p>
              )}
              {prev.custAcab > 0 && (
                <p className="text-[10px] text-gray-600">
                  Acabamento: {fmtBRL(Number(acabSel?.custo ?? 0))} × {acabQtd || 0}
                  {parseFloat(quantidade) > 1 ? ` × ${quantidade}` : ''} = {fmtBRL(prev.custAcab)}
                </p>
              )}
            </>
          ) : (
            <div>
              <p className="text-xs text-gray-600">Preencha os campos para ver o total</p>
              {!descricaoEfetiva.trim() && tab !== 'metro' && (
                <p className="text-[10px] text-red-500 mt-0.5">• Descrição obrigatória</p>
              )}
              {tipo === 'metro' && !materialId && (
                <p className="text-[10px] text-red-500 mt-0.5">• Selecione um material</p>
              )}
              {(['metro', 'metro_manual'] as TipoCalculo[]).includes(tipo) &&
                (!parseFloat(largura) || !parseFloat(altura)) && (
                  <p className="text-[10px] text-red-500 mt-0.5">• Dimensões obrigatórias</p>
                )}
              {prodPorM2 && !areaOk && (
                <p className="text-[10px] text-red-500 mt-0.5">• Informe a área em m²</p>
              )}
              {acabId && !acabQtdOk && (
                <p className="text-[10px] text-red-500 mt-0.5">• Informe a quantidade do acabamento</p>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdicionar}
          disabled={!valido}
          className={[
            'px-8 py-3 rounded-xl font-bold text-sm transition-all',
            valido
              ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed',
          ].join(' ')}
        >
          {editando
            ? <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Atualizar</span>
            : <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Adicionar</span>}
        </button>
      </div>
    </div>
  );
}
