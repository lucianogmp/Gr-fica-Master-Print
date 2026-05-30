import React, { useState } from 'react';
import { useCalculoOrcamento } from '../hooks/useCalculoOrcamento';
import { MATERIAIS, ItemOrcamento } from '../types/orcamento';
import { CalculadoraFolhas } from '../components/CalculadoraFolhas';

export function Orcamentos() {
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [materialId, setMaterialId] = useState("adesivo_vinil");
  const [temArte, setTemArte] = useState(true);
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [showCalc, setShowCalc] = useState(false); // Controle da Calculadora

  const resultado = useCalculoOrcamento({
    largura, altura, quantidade, materialId, temArte, 
    custoOperacionalPct: 0, 
    arredondar: false, itensAdicionais: itens
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Novo Orçamento</h2>
        <button 
          onClick={() => setShowCalc(!showCalc)}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          {showCalc ? '✕ Fechar Calculadora' : '📏 Calculadora de Encaixe'}
        </button>
      </div>

      {/* Seção da Calculadora de Folhas */}
      {showCalc && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <CalculadoraFolhas />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Card de Materiais */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-4">Material de Impressão</label>
            <div className="flex flex-wrap gap-2">
              {MATERIAIS.map(m => (
                <button 
                  key={m.id}
                  onClick={() => setMaterialId(m.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    materialId === m.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Medidas */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2">Largura (cm)</label>
              <input type="number" value={largura} onChange={e => setLargura(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2">Altura (cm)</label>
              <input type="number" value={altura} onChange={e => setAltura(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2">Quantidade</label>
              <input type="number" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-white" />
            </div>
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="bg-blue-900/10 p-6 rounded-xl border border-blue-500/30 h-fit sticky top-6">
          <h3 className="text-lg font-bold text-blue-100 mb-4">Resumo do Pedido</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-gray-400"><span>Área Total:</span><span className="text-white font-medium">{resultado.area.toFixed(2)} m²</span></div>
            <div className="flex justify-between text-gray-400"><span>Preço m²:</span><span className="text-white font-medium">R$ {resultado.unitario.toFixed(2)}</span></div>
            <div className="pt-4 mt-4 border-t border-blue-500/20">
              <span className="text-blue-200 text-sm font-bold uppercase">Total Estimado</span>
              <div className="text-3xl font-black text-blue-400">
                R$ {resultado.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-6 shadow-lg shadow-blue-900/20 transition-all">
              SALVAR ORÇAMENTO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}