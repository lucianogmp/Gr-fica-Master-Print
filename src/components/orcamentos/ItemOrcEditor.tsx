import { useState, useEffect } from 'react';
import { OrcamentoItem, TipoCalculo, calcItemTotal, calcTaxaArte } from '../../types/orcamento';
import { PAPEIS } from '../../types/calculadora';
import { useMateriaisOrcamento } from '../../hooks/useMateriaisOrcamento';
import { useAcabamentos } from '../../hooks/useAcabamentos';
import { useCalculoFolhas } from '../../hooks/useCalculoFolhas';
import {
  Ruler, Pencil, FileText, DollarSign, X, Plus, Check,
  AlertTriangle, Tag, Ticket, RotateCw, type LucideIcon,
} from 'lucide-react';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full";

const TIPOS: { key: TipoCalculo; label: string; icon: LucideIcon }[] = [
  { key: 'metro',        label: 'm² Material', icon: Ruler },
  { key: 'metro_manual', label: 'm² Manual',   icon: Pencil },
  { key: 'folha',        label: 'Por Folha',   icon: FileText },
  { key: 'livre',        label: 'Preço Livre', icon: DollarSign },
];

interface Props {
  onAdicionar: (item: OrcamentoItem) => void;
  onCancelar: () => void;
  editando?: OrcamentoItem | null;
}

export function ItemOrcEditor({ onAdicionar, onCancelar, editando }: Props) {
  const { data: materiais = [] } = useMateriaisOrcamento();
  const { data: acabamentos = [] } = useAcabamentos();

  const [tipo, setTipo]               = useState<TipoCalculo>(editando?.tipo_calculo ?? 'metro');
  const [descricao, setDescricao]     = useState(editando?.descricao ?? '');
  const [materialId, setMaterialId]   = useState(editando?.material_id ?? '');
  const [precoM2, setPrecoM2]         = useState(String(editando?.preco_por_m2 ?? ''));
  const [largura, setLargura]         = useState(String(editando?.largura_cm ?? ''));
  const [altura, setAltura]           = useState(String(editando?.altura_cm ?? ''));
  const [quantidade, setQuantidade]   = useState(String(editando?.quantidade ?? 1));
  const [folhaTipo, setFolhaTipo]     = useState(editando?.folha_tipo ?? 'A4');
  const [tipoMat, setTipoMat]         = useState<'adesivo'|'tag'>('adesivo');
  const [itensPorFolha, setItensPorFolha] = useState(String(editando?.itens_por_folha ?? ''));
  const [precoPorFolha, setPrecoPorFolha] = useState(String(editando?.preco_por_folha ?? ''));
  const [precoLivre, setPrecoLivre]   = useState(String(editando?.preco_unitario ?? ''));
  const [acabamentoId, setAcabamentoId] = useState(editando?.acabamento_id ?? '');
  const [arteInclusa, setArteInclusa] = useState(editando?.arte_inclusa ?? false);

  // Material selecionado
  const matSel = materiais.find(m => m.id === materialId);

  // Calcula encaixe para modo folha
  const calcFolha = useCalculoFolhas({
    papelKey: folhaTipo,
    larguraItem: parseFloat(largura) || 0,
    alturaItem:  parseFloat(altura) || 0,
    quantidadeTotal: parseInt(quantidade) || 1,
    tipoMaterial: tipoMat,
  });

  // Sincroniza itensPorFolha com o cálculo automático
  useEffect(() => {
    if (tipo === 'folha' && calcFolha && calcFolha.porFolha > 0) {
      setItensPorFolha(String(calcFolha.porFolha));
    }
  }, [calcFolha?.porFolha, tipo]);

  // Preview do total
  function buildPreview() {
    const qtd = parseInt(quantidade) || 1;
    const acab = acabamentos.find(a => a.id === acabamentoId);
    const custAcab = acab ? Number(acab.custo) * qtd : 0;

    let unitario = 0;
    let area: number | undefined;

    if (tipo === 'metro') {
      const m2 = Number(matSel?.preco ?? 0);
      const w = parseFloat(largura) / 100;
      const h = parseFloat(altura) / 100;
      area = w * h;
      unitario = area * m2;
    } else if (tipo === 'metro_manual') {
      const m2 = parseFloat(precoM2) || 0;
      const w = parseFloat(largura) / 100;
      const h = parseFloat(altura) / 100;
      area = w * h;
      unitario = area * m2;
    } else if (tipo === 'folha') {
      const ppf = parseFloat(precoPorFolha) || 0;
      const ipf = parseInt(itensPorFolha) || 1;
      unitario = ipf > 0 ? ppf / ipf : ppf;
    } else {
      unitario = parseFloat(precoLivre) || 0;
    }

    let subtotalItens = unitario * qtd + custAcab;

    // Arte
    let arteValor = 0;
    if (arteInclusa && subtotalItens > 0) {
      const pct = calcTaxaArte(subtotalItens);
      arteValor = subtotalItens * (pct / 100);
      subtotalItens += arteValor;
    }

    return { unitario, total: subtotalItens, area, arteValor };
  }

  const prev = buildPreview();
  const valido = descricao.trim() && prev.total > 0;

  function handleAdicionar() {
    if (!valido) return;
    const acab = acabamentos.find(a => a.id === acabamentoId);
    const item: OrcamentoItem = {
      descricao:       descricao.trim(),
      tipo_calculo:    tipo,
      material_id:     tipo === 'metro' ? materialId : null,
      preco_por_m2:    tipo === 'metro' ? (matSel?.preco ?? 0) : tipo === 'metro_manual' ? (parseFloat(precoM2) || 0) : null,
      largura_cm:      (tipo === 'metro' || tipo === 'metro_manual' || tipo === 'folha') ? (parseFloat(largura) || null) : null,
      altura_cm:       (tipo === 'metro' || tipo === 'metro_manual' || tipo === 'folha') ? (parseFloat(altura) || null) : null,
      folha_tipo:      tipo === 'folha' ? folhaTipo : null,
      itens_por_folha: tipo === 'folha' ? (parseInt(itensPorFolha) || 1) : null,
      preco_por_folha: tipo === 'folha' ? (parseFloat(precoPorFolha) || 0) : null,
      quantidade:      parseInt(quantidade) || 1,
      preco_unitario:  prev.unitario,
      total:           prev.total,
      acabamento_id:   acabamentoId || null,
      acabamento_nome: acab?.nome ?? null,
      acabamento_custo: acab?.custo ?? null,
      arte_inclusa:    arteInclusa,
    };
    onAdicionar(item);
  }

  return (
    <div className="bg-[#0d1117] border border-blue-500/40 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-blue-300 flex items-center gap-1.5">{editando ? <><Pencil className="w-4 h-4" /> Editar Item</> : <><Plus className="w-4 h-4" /> Novo Item</>}</h4>
        <button onClick={onCancelar} className="text-gray-500 hover:text-white text-xs flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancelar</button>
      </div>

      {/* Tipo */}
      <div className="grid grid-cols-4 gap-2">
        {TIPOS.map(t => (
          <button key={t.key} onClick={() => setTipo(t.key)}
            className={`py-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
              tipo === t.key ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Descrição */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Descrição *</label>
        <input value={descricao} onChange={e => setDescricao(e.target.value)}
          className={IN + ' text-sm py-2.5'} placeholder="Ex: Banner lona brilho 2×1m" />
      </div>

      {/* ── m² Material ── */}
      {tipo === 'metro' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">
              Material ({materiais.length} produtos ativos)
            </label>
            {materiais.length === 0 ? (
              <p className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Nenhum produto ativo cadastrado. Adicione produtos na aba Produtos.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {materiais.map(m => (
                  <button key={m.id} onClick={() => setMaterialId(m.id)}
                    className={`px-2.5 py-2 rounded-lg text-[10px] font-medium border transition-all text-left ${
                      materialId === m.id ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}>
                    <div className="font-bold truncate">{m.nome}</div>
                    <div className="text-gray-500">{fmtBRL(m.preco)}/m²</div>
                    {m.terceirizado && <div className="text-yellow-500 text-[9px]">terceirizado</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DimensoesQtd l={largura} a={altura} q={quantidade} setL={setLargura} setA={setAltura} setQ={setQuantidade} />
          {matSel && prev.area !== undefined && prev.area > 0 && (
            <InfoRow items={[
              { label: 'Preço/m²', value: fmtBRL(matSel.preco) },
              { label: 'Área', value: `${prev.area.toFixed(4)} m²` },
              { label: 'Unitário', value: fmtBRL(prev.unitario) },
            ]} />
          )}
        </div>
      )}

      {/* ── m² Manual ── */}
      {tipo === 'metro_manual' && (
        <div className="space-y-3">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-300 flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5" /> Informe o preço por m² manualmente.
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço por m² (R$)</label>
            <input type="number" min="0" step="0.01" value={precoM2}
              onChange={e => setPrecoM2(e.target.value)}
              className={IN + ' text-xl font-black text-center text-yellow-300 py-3'} placeholder="0,00" />
          </div>
          <DimensoesQtd l={largura} a={altura} q={quantidade} setL={setLargura} setA={setAltura} setQ={setQuantidade} />
          {prev.area !== undefined && prev.area > 0 && parseFloat(precoM2) > 0 && (
            <InfoRow items={[
              { label: 'Área', value: `${prev.area.toFixed(4)} m²` },
              { label: 'Unitário', value: fmtBRL(prev.unitario) },
            ]} />
          )}
        </div>
      )}

      {/* ── Por Folha ── */}
      {tipo === 'folha' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Tipo de Papel</label>
              <select value={folhaTipo} onChange={e => setFolhaTipo(e.target.value)} className={IN}>
                {Object.entries(PAPEIS).map(([k, p]) => (
                  <option key={k} value={k}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Material</label>
              <div className="flex gap-1">
                {(['adesivo', 'tag'] as const).map(t => (
                  <button key={t} onClick={() => setTipoMat(t)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all capitalize ${
                      tipoMat === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                    }`}>
                    <span className="inline-flex items-center gap-1">
                      {t === 'adesivo' ? <><Tag className="w-3 h-3" /> Adesivo</> : <><Ticket className="w-3 h-3" /> Tag</>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DimensoesQtd l={largura} a={altura} q={quantidade} setL={setLargura} setA={setAltura} setQ={setQuantidade} />
          {calcFolha && calcFolha.porFolha > 0 && (
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-[9px] text-gray-500 uppercase">Por folha</p><p className="text-lg font-black text-green-400">{calcFolha.porFolha}</p></div>
                <div><p className="text-[9px] text-gray-500 uppercase">Folhas</p><p className="text-lg font-black text-blue-400">{calcFolha.totalFolhas}</p></div>
                <div><p className="text-[9px] text-gray-500 uppercase">Área útil</p><p className="text-lg font-black text-yellow-400">{calcFolha.areaUtil}</p></div>
              </div>
              {calcFolha.rotacionado && <p className="text-[9px] text-yellow-500 text-center mt-1 flex items-center justify-center gap-1"><RotateCw className="w-3 h-3" /> Melhor encaixe rotacionando 90°</p>}
              <p className="text-[9px] text-gray-600 text-center mt-1">Espaçamento: {tipoMat === 'tag' ? '5mm' : '1,5mm'} entre itens</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Itens por Folha</label>
              <input type="number" min="1" value={itensPorFolha}
                onChange={e => setItensPorFolha(e.target.value)} className={IN} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço por Folha (R$)</label>
              <input type="number" min="0" step="0.01" value={precoPorFolha}
                onChange={e => setPrecoPorFolha(e.target.value)} className={IN} />
            </div>
          </div>
        </div>
      )}

      {/* ── Preço Livre ── */}
      {tipo === 'livre' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço Unitário (R$)</label>
            <input type="number" min="0" step="0.01" value={precoLivre}
              onChange={e => setPrecoLivre(e.target.value)}
              className={IN + ' text-center text-xl font-black py-3'} placeholder="0,00" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade</label>
            <input type="number" min="1" value={quantidade}
              onChange={e => setQuantidade(e.target.value)} className={IN} />
          </div>
        </div>
      )}

      {/* Acabamento */}
      <div className="pt-3 border-t border-gray-800">
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Acabamento</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
          <button onClick={() => setAcabamentoId('')}
            className={`px-2.5 py-2 rounded-lg text-[10px] font-medium border transition-all text-center ${
              !acabamentoId ? 'bg-gray-600 border-gray-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}>
            Sem acabamento
          </button>
          {acabamentos.filter(a => a.ativo).map(a => (
            <button key={a.id} onClick={() => setAcabamentoId(a.id)}
              className={`px-2.5 py-2 rounded-lg text-[10px] font-medium border transition-all text-left ${
                acabamentoId === a.id ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              <div className="font-bold">{a.nome}</div>
              {a.custo > 0 && <div className="text-gray-500">+{fmtBRL(a.custo)}/un</div>}
            </button>
          ))}
        </div>
      </div>

      {/* Arte */}
      <div className="flex items-center justify-between py-2 border-t border-gray-800">
        <div>
          <label className="flex items-center gap-2 cursor-pointer" onClick={() => setArteInclusa(!arteInclusa)}>
            <div className={`w-10 h-5 rounded-full transition-all relative ${arteInclusa ? 'bg-green-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${arteInclusa ? 'left-5' : 'left-0.5'}`} />
            </div>
            <span className="text-xs text-gray-400">Arte inclusa</span>
          </label>
        </div>
        {arteInclusa && prev.total > 0 && (
          <div className="text-right">
            {(() => {
              const base = prev.total - prev.arteValor;
              const pct = calcTaxaArte(base);
              return (
                <p className="text-[10px] text-green-400">
                  +{pct}% arte = {fmtBRL(prev.arteValor)}
                  <span className="text-gray-600 ml-1">
                    ({base <= 100 ? 'até R$100' : base <= 200 ? 'R$100-200' : base <= 300 ? 'R$200-300' : '>R$300'})
                  </span>
                </p>
              );
            })()}
          </div>
        )}
      </div>

      {/* Preview + Adicionar */}
      <div className="flex items-end justify-between pt-3 border-t border-gray-700">
        <div>
          {prev.total > 0 ? (
            <>
              <p className="text-[10px] text-gray-500">Total do item</p>
              <p className="text-3xl font-black text-green-400">{fmtBRL(prev.total)}</p>
              {parseInt(quantidade) > 1 && (
                <p className="text-[10px] text-gray-600">{fmtBRL(prev.unitario)} × {quantidade} un</p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-600">Preencha os campos para ver o total</p>
          )}
        </div>
        <button onClick={handleAdicionar} disabled={!valido}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5">
          {editando ? <><Check className="w-4 h-4" /> Atualizar Item</> : <><Plus className="w-4 h-4" /> Adicionar</>}
        </button>
      </div>
    </div>
  );
}

function DimensoesQtd({ l, a, q, setL, setA, setQ }: {
  l: string; a: string; q: string;
  setL: (v: string) => void; setA: (v: string) => void; setQ: (v: string) => void;
}) {
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
