import { useState } from 'react';
import { OrcamentoItem, TipoCalculo, MATERIAIS, calcItemTotal } from '../../types/orcamento';
import { PAPEIS } from '../../types/calculadora';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full";

const TIPOS: { key: TipoCalculo; label: string; icon: string; desc: string }[] = [
  { key: 'metro',        label: 'm² Material',  icon: '📐', desc: 'Calcula por metro quadrado com material pré-definido' },
  { key: 'metro_manual', label: 'm² Manual',    icon: '✏️', desc: 'Você informa o preço por m² manualmente' },
  { key: 'folha',        label: 'Por Folha',    icon: '📄', desc: 'Calcula por folha com encaixe automático' },
  { key: 'livre',        label: 'Preço Livre',  icon: '💰', desc: 'Informa o preço unitário diretamente' },
];

const ACABAMENTOS = ['Sem acabamento', 'Laminação Fosca', 'Laminação Brilho', 'Corte especial', 'Ilhós', 'Bastão', 'Dobra', 'Vinco'];

interface Props {
  onAdicionar: (item: OrcamentoItem) => void;
  onCancelar: () => void;
  editando?: OrcamentoItem | null;
}

function campoVazio(): Omit<OrcamentoItem, 'total' | 'preco_unitario'> & { preco_unitario: string } {
  return {
    descricao: '', tipo_calculo: 'metro', quantidade: 1,
    largura_cm: 0, altura_cm: 0,
    material_id: 'adesivo_vinil', preco_por_m2: '',
    folha_tipo: 'A4', itens_por_folha: 1, preco_por_folha: 0,
    preco_unitario: '', acabamento: 'Sem acabamento', arte_inclusa: true,
  } as any;
}

export function ItemOrcEditor({ onAdicionar, onCancelar, editando }: Props) {
  const [f, setF] = useState<any>(editando ? {
    ...editando,
    preco_por_m2: editando.preco_por_m2 ?? '',
    preco_unitario: editando.preco_unitario ?? '',
  } : campoVazio());

  function set(key: string, val: any) { setF((p: any) => ({ ...p, [key]: val })); }

  // Calcula preço/m² do material selecionado
  const matSelecionado = MATERIAIS.find(m => m.id === f.material_id);

  // Monta o item com o preço calculado
  function buildItem(): OrcamentoItem {
    let preco_por_m2 = 0;
    if (f.tipo_calculo === 'metro')        preco_por_m2 = matSelecionado?.preco ?? 0;
    if (f.tipo_calculo === 'metro_manual') preco_por_m2 = parseFloat(f.preco_por_m2) || 0;

    const itemParcial: Partial<OrcamentoItem> = {
      ...f,
      preco_por_m2,
      preco_por_folha: parseFloat(f.preco_por_folha) || 0,
      preco_unitario:  parseFloat(f.preco_unitario) || 0,
      quantidade: Number(f.quantidade) || 1,
    };

    const { unitario, total } = calcItemTotal(itemParcial);
    return { ...itemParcial, preco_unitario: unitario, total } as OrcamentoItem;
  }

  const preview = calcItemTotal({
    ...f,
    preco_por_m2: f.tipo_calculo === 'metro' ? (matSelecionado?.preco ?? 0) : parseFloat(f.preco_por_m2) || 0,
    preco_por_folha: parseFloat(f.preco_por_folha) || 0,
    preco_unitario: parseFloat(f.preco_unitario) || 0,
    quantidade: Number(f.quantidade) || 1,
  });

  const valido = f.descricao.trim() && preview.total > 0;

  return (
    <div className="bg-[#111827] border border-blue-500/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-blue-300">
          {editando ? '✏️ Editar Item' : '➕ Novo Item'}
        </h4>
        <button onClick={onCancelar} className="text-gray-500 hover:text-white text-xs">✕ Cancelar</button>
      </div>

      {/* Tipo de cálculo */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Modo de Precificação</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {TIPOS.map(t => (
            <button key={t.key} onClick={() => set('tipo_calculo', t.key)}
              title={t.desc}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                f.tipo_calculo === t.key
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}>
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Descrição do Item *</label>
        <input value={f.descricao} onChange={e => set('descricao', e.target.value)}
          className={IN + ' text-sm'} placeholder="Ex: Banner lona brilho 2x1m" />
      </div>

      {/* ── METRO (material pré-definido) ── */}
      {f.tipo_calculo === 'metro' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Material</label>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
              {MATERIAIS.map(m => (
                <button key={m.id} onClick={() => set('material_id', m.id)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all text-left ${
                    f.material_id === m.id
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  <div className="font-bold truncate">{m.label}</div>
                  <div className="text-gray-500">{fmtBRL(m.preco)}/m²</div>
                </button>
              ))}
            </div>
          </div>
          <DimensoesQtd f={f} set={set} />
          {matSelecionado && (
            <div className="text-[10px] text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
              Preço/m²: <span className="text-white font-bold">{fmtBRL(matSelecionado.preco)}</span>
              {preview.area ? ` · Área: ${preview.area.toFixed(4)} m²` : ''}
            </div>
          )}
        </div>
      )}

      {/* ── METRO MANUAL ── */}
      {f.tipo_calculo === 'metro_manual' && (
        <div className="space-y-3">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2.5 text-xs text-yellow-300 flex items-center gap-2">
            <span>✏️</span> Você define o preço por m² manualmente — útil para materiais especiais ou negociações.
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço por m² (R$)</label>
            <input type="number" min="0" step="0.01" value={f.preco_por_m2}
              onChange={e => set('preco_por_m2', e.target.value)}
              className={IN + ' text-lg font-black text-yellow-300 text-center'} placeholder="0,00" />
          </div>
          <DimensoesQtd f={f} set={set} />
          {preview.area ? (
            <div className="text-[10px] text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
              Área: <span className="text-white font-bold">{preview.area.toFixed(4)} m²</span>
              {parseFloat(f.preco_por_m2) > 0 && ` · Preço/m²: ${fmtBRL(parseFloat(f.preco_por_m2))}`}
            </div>
          ) : null}
        </div>
      )}

      {/* ── POR FOLHA ── */}
      {f.tipo_calculo === 'folha' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Tipo de Folha</label>
              <select value={f.folha_tipo} onChange={e => set('folha_tipo', e.target.value)} className={IN}>
                {Object.keys(PAPEIS).map(k => (
                  <option key={k} value={k}>{PAPEIS[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Itens por Folha</label>
              <input type="number" min="1" step="1" value={f.itens_por_folha}
                onChange={e => set('itens_por_folha', parseInt(e.target.value) || 1)} className={IN} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço por Folha (R$)</label>
              <input type="number" min="0" step="0.01" value={f.preco_por_folha}
                onChange={e => set('preco_por_folha', e.target.value)} className={IN} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade de Itens</label>
              <input type="number" min="1" value={f.quantidade}
                onChange={e => set('quantidade', parseInt(e.target.value) || 1)} className={IN} />
            </div>
            <div className="flex items-end">
              <div className="bg-gray-800/50 rounded-lg px-3 py-2 text-[10px] text-gray-400 w-full">
                Folhas necessárias: <span className="font-bold text-white">
                  {Math.ceil((Number(f.quantidade) || 1) / (Number(f.itens_por_folha) || 1))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PREÇO LIVRE ── */}
      {f.tipo_calculo === 'livre' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço Unitário (R$)</label>
            <input type="number" min="0" step="0.01" value={f.preco_unitario}
              onChange={e => set('preco_unitario', e.target.value)}
              className={IN + ' text-center text-lg font-black'} placeholder="0,00" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade</label>
            <input type="number" min="1" value={f.quantidade}
              onChange={e => set('quantidade', parseInt(e.target.value) || 1)} className={IN} />
          </div>
        </div>
      )}

      {/* Acabamento + Arte */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Acabamento</label>
          <select value={f.acabamento ?? 'Sem acabamento'} onChange={e => set('acabamento', e.target.value)} className={IN}>
            {ACABAMENTOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => set('arte_inclusa', !f.arte_inclusa)}
              className={`w-10 h-5 rounded-full transition-all relative ${f.arte_inclusa ? 'bg-green-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${f.arte_inclusa ? 'left-5' : 'left-0.5'}`} />
            </div>
            <span className="text-xs text-gray-400">Arte inclusa</span>
          </label>
        </div>
      </div>

      {/* Preview + Adicionar */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-700">
        <div>
          {preview.total > 0 ? (
            <div>
              <p className="text-[10px] text-gray-500">Total do item</p>
              <p className="text-2xl font-black text-green-400">{fmtBRL(preview.total)}</p>
              <p className="text-[10px] text-gray-600">
                {Number(f.quantidade) > 1 && `${fmtBRL(preview.unitario)} × ${f.quantidade} un`}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-600">Preencha os campos para ver o total</p>
          )}
        </div>
        <button
          onClick={() => { if (valido) { onAdicionar(buildItem()); } }}
          disabled={!valido}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
          {editando ? '✓ Atualizar' : '+ Adicionar'}
        </button>
      </div>
    </div>
  );
}

function DimensoesQtd({ f, set }: { f: any; set: (k: string, v: any) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Largura (cm)</label>
        <input type="number" min="0" step="0.1" value={f.largura_cm || ''}
          onChange={e => set('largura_cm', parseFloat(e.target.value) || 0)} className={IN} placeholder="0" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Altura (cm)</label>
        <input type="number" min="0" step="0.1" value={f.altura_cm || ''}
          onChange={e => set('altura_cm', parseFloat(e.target.value) || 0)} className={IN} placeholder="0" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade</label>
        <input type="number" min="1" value={f.quantidade}
          onChange={e => set('quantidade', parseInt(e.target.value) || 1)} className={IN} />
      </div>
    </div>
  );
}
