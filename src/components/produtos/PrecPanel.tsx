import { GcData } from '../../hooks/useGestaoCustos';
import { CustosProduto } from '../../types/produto';
import { Calculator, Lightbulb, Tag, Star } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface PrecPanelProps {
  custos: CustosProduto;
  preco: number;
  onPrecoChange: (v: number) => void;
  gc: GcData;
  tempo: number;
  porMetroQuadrado?: boolean;
}

export function PrecPanel({ custos, preco, onPrecoChange, gc, tempo, porMetroQuadrado }: PrecPanelProps) {
  const { custoBOM, maoObra, acabamento, outros, overhead, total } = custos;
  const lucro  = preco - total;
  const margem = total > 0 && preco > 0 ? ((preco - total) / preco) * 100 : preco > 0 ? 100 : 0;
  const margemCls = margem >= 30 ? 'text-green-400' : margem > 0 ? 'text-yellow-400' : 'text-red-400';

  const sug = (m: number) => total > 0 ? total / (1 - m / 100) : 0;

  return (
    <div className="flex flex-col gap-4">

      {/* Composição de Custos */}
      <div className="bg-[#1f2937] border-t-2 border-blue-500 border-x border-b border-gray-700 rounded-xl p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5" /> Composição de Custos
        </p>
        <div className="space-y-1.5">
          <CustoLinha label="BOM (matérias-primas)" valor={custoBOM} />
          <CustoLinha label="Mão de obra"           valor={maoObra} />
          <CustoLinha label="Acabamento"            valor={acabamento} />
          <CustoLinha label="Outros"                valor={outros} />
          <CustoLinha
            label={overhead > 0 ? `Overhead (${tempo}h)` : 'Overhead'}
            valor={overhead}
            highlight={overhead > 0}
            dim={overhead === 0}
          />
          <div className="pt-2 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-white">Custo Total</span>
              <span className="text-base font-black text-blue-400">{fmtBRL(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sugestões */}
      <div className={`bg-[#1f2937] border-t-2 border-yellow-500/60 border-x border-b border-gray-700 rounded-xl p-4 ${total === 0 ? 'opacity-50' : ''}`}>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" /> Preço Sugerido
        </p>
        {total > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: '30%', v: sug(30) },
              { label: '40%', v: sug(40), dest: true },
              { label: '50%', v: sug(50) },
            ]).map(s => (
              <div key={s.label} className={`border rounded-lg p-2 text-center ${s.dest ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-gray-700'}`}>
                <p className="text-[9px] text-gray-500 font-bold mb-1 flex items-center justify-center gap-0.5">{s.label}{s.dest && <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />}</p>
                <p className="text-xs font-black text-white">{fmtBRL(s.v)}</p>
                <button
                  onClick={() => onPrecoChange(s.v)}
                  className="mt-1 text-[9px] text-gray-500 hover:text-blue-400 border border-gray-700 hover:border-blue-500 rounded px-1.5 py-0.5 transition-all"
                >
                  Usar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 text-center py-2">Preencha os custos para ver sugestões.</p>
        )}
        {gc.total > 0 && (
          <p className="text-[10px] text-gray-600 mt-2">Overhead: {fmtBRL(gc.porHora)}/h · {fmtBRL(gc.depr)}/mês depr. + {fmtBRL(gc.fixos)}/mês fixos</p>
        )}
      </div>

      {/* Preço de Venda */}
      <div className="bg-[#1f2937] border-t-2 border-green-500/60 border-x border-b border-gray-700 rounded-xl p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" /> Preço de Venda {porMetroQuadrado && '(por m²)'}
        </p>
        <div className="flex items-center bg-[#111827] border border-gray-700 rounded-lg overflow-hidden focus-within:border-green-500 transition-colors">
          <span className="px-3 text-gray-500 text-sm font-bold bg-gray-800 border-r border-gray-700 py-3">R$</span>
          <input
            type="number" min="0" step="0.01"
            value={preco || ''}
            onChange={e => onPrecoChange(parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="flex-1 bg-transparent px-3 py-3 text-xl font-black text-white focus:outline-none"
          />
        </div>

        {preco > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Custo total</span>
              <span className="text-gray-300">{fmtBRL(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Lucro bruto</span>
              <span className={lucro >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{fmtBRL(lucro)}</span>
            </div>
            <div className={`flex justify-between items-center mt-2 p-2.5 rounded-lg ${
              margem >= 30 ? 'bg-green-500/10 border border-green-500/20' :
              margem > 0   ? 'bg-yellow-500/10 border border-yellow-500/20' :
                             'bg-red-500/10 border border-red-500/20'
            }`}>
              <span className="text-xs font-semibold text-gray-400">Margem de Lucro</span>
              <span className={`text-lg font-black ${margemCls}`}>{margem.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${margem >= 30 ? 'bg-green-500' : margem > 0 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(Math.max(margem, 0), 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CustoLinha({ label, valor, highlight, dim }: { label: string; valor: number; highlight?: boolean; dim?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1 text-xs border-b border-gray-800 last:border-0 ${dim ? 'opacity-40' : ''}`}>
      <span className={highlight ? 'text-yellow-400' : 'text-gray-500'}>{label}</span>
      <span className={`font-semibold ${highlight ? 'text-yellow-400' : 'text-gray-300'}`}>{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
    </div>
  );
}
