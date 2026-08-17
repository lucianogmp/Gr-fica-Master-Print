import { useState } from 'react';
import { BomItem } from '../../types/produto';
import { MateriaPrima } from '../../types/estoque';
import { Modal } from '../ui/Modal';
import { calcCustoBOM } from '../../hooks/useBom';
import { Boxes, X, ArrowRight } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const unidadeLabel = (u: string) => u === 'm2' ? 'm²' : u;

interface BomEditorProps {
  bom: BomItem[];
  materias: MateriaPrima[];
  onChange: (bom: BomItem[]) => void;
}

export function BomEditor({ bom, materias, onChange }: BomEditorProps) {
  const [showModal, setShowModal] = useState(false);
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<MateriaPrima | null>(null);
  const [qtd, setQtd] = useState('');

  const custoBOM = calcCustoBOM(bom);
  const usadas   = new Set(bom.map(b => b.materias_primas?.id));
  const disponiveis = materias.filter(m =>
    !usadas.has(m.id) &&
    (!busca || m.nome.toLowerCase().includes(busca.toLowerCase()))
  ).slice(0, 10);

  function handleAddMP() {
    if (!selecionada || !qtd || Number(qtd) <= 0) return;
    onChange([
      ...bom,
      {
        produto_id: '',
        materia_id: selecionada.id,
        quantidade: Number(qtd),
        materias_primas: {
          id:             selecionada.id,
          nome:           selecionada.nome,
          unidade:        selecionada.unidade,
          custo_unitario: selecionada.custo_unitario,
        },
      },
    ]);
    setSelecionada(null);
    setBusca('');
    setQtd('');
    setShowModal(false);
  }

  function handleQtdChange(index: number, val: string) {
    const next = [...bom];
    next[index] = { ...next[index], quantidade: parseFloat(val) || 0 };
    onChange(next);
  }

  function handleRemove(index: number) {
    onChange(bom.filter((_, i) => i !== index));
  }

  return (
    <>
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Boxes className="w-4 h-4" /> Matérias-Primas (BOM)
          </h3>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
          >
            + Adicionar
          </button>
        </div>

        {bom.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            <Boxes className="w-8 h-8 mb-2 opacity-30 mx-auto" />
            Nenhuma matéria-prima adicionada.<br />
            <span className="text-xs">Adicione os insumos para calcular o custo BOM.</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold text-gray-500 uppercase border-b border-gray-700 bg-gray-800/50">
                  <th className="px-3 py-2 text-left">Matéria-Prima</th>
                  <th className="px-3 py-2 text-center">Un.</th>
                  <th className="px-3 py-2 text-right w-28">Qtd.</th>
                  <th className="px-3 py-2 text-right">Custo/un</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {bom.map((b, i) => {
                  const mp  = b.materias_primas!;
                  const sub = Number(mp.custo_unitario) * Number(b.quantidade);
                  return (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="px-3 py-2 font-medium text-white">{mp.nome}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-[10px] font-bold bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{unidadeLabel(mp.unidade)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number" onWheel={e => e.currentTarget.blur()} min="0.001" step="0.001"
                          value={b.quantidade}
                          onChange={e => handleQtdChange(i, e.target.value)}
                          className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-right text-white text-xs focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400 text-xs">{fmtBRL(mp.custo_unitario)}</td>
                      <td className="px-3 py-2 text-right font-bold text-blue-400">{fmtBRL(sub)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => handleRemove(i)} className="text-gray-600 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-blue-900/20 border-t border-blue-500/20">
                  <td colSpan={4} className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">
                    Custo Total BOM
                  </td>
                  <td className="px-3 py-2 text-right text-lg font-black text-blue-400">{fmtBRL(custoBOM)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal adicionar MP */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setSelecionada(null); setBusca(''); setQtd(''); }}
        title="Adicionar Matéria-Prima"
        maxWidth="460px"
        actions={
          <>
            <button
              onClick={() => { setShowModal(false); setSelecionada(null); setBusca(''); setQtd(''); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddMP}
              disabled={!selecionada || !qtd || Number(qtd) <= 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all"
            >
              Adicionar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Buscar matéria-prima</label>
            <input
              autoFocus
              value={busca}
              onChange={e => { setBusca(e.target.value); setSelecionada(null); }}
              placeholder="Digite para filtrar..."
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {!selecionada && (
            <div className="border border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {disponiveis.length === 0 ? (
                <p className="p-4 text-center text-gray-600 text-sm">Nenhuma encontrada.</p>
              ) : (
                disponiveis.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelecionada(m); setBusca(m.nome); }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-900/20 border-b border-gray-800 last:border-b-0 text-left transition-all"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{m.nome}</p>
                      <p className="text-xs text-gray-500">{unidadeLabel(m.unidade)} · {fmtBRL(m.custo_unitario)}/un</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                ))
              )}
            </div>
          )}

          {selecionada && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3 text-sm">
              <span className="font-bold text-blue-300">{selecionada.nome}</span>
              <span className="text-gray-400"> · {unidadeLabel(selecionada.unidade)} · {fmtBRL(selecionada.custo_unitario)}/un</span>
              <button onClick={() => { setSelecionada(null); setBusca(''); }} className="ml-2 inline-flex text-gray-600 hover:text-red-400"><X className="w-3 h-3" /></button>
            </div>
          )}

          {selecionada && (
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">
                Quantidade ({unidadeLabel(selecionada.unidade)})
              </label>
              <input
                autoFocus
                type="number" onWheel={e => e.currentTarget.blur()} min="0.001" step="0.001"
                value={qtd}
                onChange={e => setQtd(e.target.value)}
                placeholder="0.000"
                className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 text-center text-lg font-bold"
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
