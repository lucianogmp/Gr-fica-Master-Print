import { useState } from 'react';
import { useCalculoFolhas } from '../hooks/useCalculoFolhas';
import { PAPEIS, TipoMaterial } from '../types/calculadora';

export function CalculadoraFolhas() {
  const [papelKey, setPapelKey] = useState<string>('A4');
  const [larguraItem, setLarguraItem] = useState<number>(0);
  const [alturaItem, setAlturaItem] = useState<number>(0);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [tipo, setTipo] = useState<TipoMaterial>('adesivo');

  const resultado = useCalculoFolhas({
    papelKey,
    larguraItem,
    alturaItem,
    quantidadeTotal: quantidade,
    tipoMaterial: tipo,
  });

  return (
    <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl">📏</span>
        <h3 className="font-bold text-white">Calculadora de Encaixe de Folhas</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Tipo de papel */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Papel</label>
          <select
            value={papelKey}
            onChange={e => setPapelKey(e.target.value)}
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {Object.entries(PAPEIS).map(([key, p]) => (
              <option key={key} value={key}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Largura do item */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Largura item (cm)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={larguraItem || ''}
            onChange={e => setLarguraItem(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Altura do item */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Altura item (cm)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={alturaItem || ''}
            onChange={e => setAlturaItem(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Quantidade total */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Qtd. total</label>
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={e => setQuantidade(parseInt(e.target.value) || 1)}
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tipo de material */}
      <div className="flex gap-3 mb-6">
        {(['adesivo', 'tag'] as TipoMaterial[]).map(t => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              tipo === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {t === 'adesivo' ? '🏷️ Adesivo' : '🎫 Tag'}
          </button>
        ))}
      </div>

      {/* Resultado */}
      {resultado && resultado.porFolha > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ResultCard label="Por folha" value={resultado.porFolha} color="text-green-400" />
          <ResultCard label="Folhas necessárias" value={resultado.totalFolhas} color="text-blue-400" />
          <ResultCard label="Layout" value={`${resultado.cols}×${resultado.rows}`} color="text-yellow-400" />
          <ResultCard label="Área útil" value={resultado.areaUtil} color="text-purple-400" />
          {resultado.rotacionado && (
            <div className="col-span-full text-xs text-yellow-500 flex items-center gap-1">
              <span>↻</span> Melhor encaixe rotacionando o item 90°
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center py-4">
          Preencha as dimensões do item para calcular o encaixe.
        </p>
      )}
    </div>
  );
}

function ResultCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[#111827] border border-gray-700 rounded-lg p-3 text-center">
      <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}
