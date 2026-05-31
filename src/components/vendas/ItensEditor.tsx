import { useState } from 'react';
import { VendaItem } from '../../types/venda';
import { X } from 'lucide-react';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full";

interface ItensEditorProps {
  itens: VendaItem[];
  onChange: (itens: VendaItem[]) => void;
}

const ITEM_VAZIO: Omit<VendaItem, 'total'> = {
  descricao: '', quantidade: 1, preco_unitario: 0,
  desconto: 0, unidade: 'un', obs: '',
};

export function ItensEditor({ itens, onChange }: ItensEditorProps) {
  const [novoItem, setNovoItem] = useState({ ...ITEM_VAZIO });

  function calcTotal(qtd: number, preco: number, desc: number) {
    return qtd * preco * (1 - (desc || 0) / 100);
  }

  function adicionarItem() {
    if (!novoItem.descricao.trim() || novoItem.preco_unitario <= 0) return;
    const total = calcTotal(novoItem.quantidade, novoItem.preco_unitario, novoItem.desconto ?? 0);
    onChange([...itens, { ...novoItem, total }]);
    setNovoItem({ ...ITEM_VAZIO });
  }

  function removerItem(idx: number) {
    onChange(itens.filter((_, i) => i !== idx));
  }

  function atualizarItem(idx: number, field: keyof VendaItem, val: any) {
    const next = itens.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: val };
      updated.total = calcTotal(
        Number(updated.quantidade),
        Number(updated.preco_unitario),
        Number(updated.desconto ?? 0)
      );
      return updated;
    });
    onChange(next);
  }

  const subtotal = itens.reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="space-y-3">
      {/* Tabela de itens */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] font-bold text-gray-500 uppercase bg-gray-800/50 border-b border-gray-700">
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-center w-16">Un.</th>
              <th className="px-3 py-2 text-right w-20">Qtd.</th>
              <th className="px-3 py-2 text-right w-28">Preço Unit.</th>
              <th className="px-3 py-2 text-right w-20">Desc.%</th>
              <th className="px-3 py-2 text-right w-28">Total</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-600">Nenhum item adicionado.</td></tr>
            )}
            {itens.map((it, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/20">
                <td className="px-2 py-1.5">
                  <input value={it.descricao} onChange={e => atualizarItem(i, 'descricao', e.target.value)} className={IN} />
                </td>
                <td className="px-2 py-1.5">
                  <input value={it.unidade ?? 'un'} onChange={e => atualizarItem(i, 'unidade', e.target.value)} className={IN + ' text-center'} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0.001" step="0.001" value={it.quantidade}
                    onChange={e => atualizarItem(i, 'quantidade', parseFloat(e.target.value) || 0)} className={IN + ' text-right'} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" step="0.01" value={it.preco_unitario}
                    onChange={e => atualizarItem(i, 'preco_unitario', parseFloat(e.target.value) || 0)} className={IN + ' text-right'} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" max="100" step="0.1" value={it.desconto ?? 0}
                    onChange={e => atualizarItem(i, 'desconto', parseFloat(e.target.value) || 0)} className={IN + ' text-right'} />
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-white">{fmtBRL(it.total)}</td>
                <td className="px-2 py-1.5">
                  <button onClick={() => removerItem(i)} className="inline-flex text-gray-600 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Linha de novo item */}
      <div className="bg-[#111827] border border-dashed border-gray-700 rounded-xl p-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">+ Adicionar item</p>
        <div className="grid grid-cols-6 gap-2 items-end">
          <div className="col-span-2">
            <label className="text-[9px] text-gray-600 uppercase block mb-1">Descrição *</label>
            <input value={novoItem.descricao} onChange={e => setNovoItem(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Nome do produto / serviço" className={IN}
              onKeyDown={e => { if (e.key === 'Enter') adicionarItem(); }} />
          </div>
          <div>
            <label className="text-[9px] text-gray-600 uppercase block mb-1">Unidade</label>
            <input value={novoItem.unidade ?? 'un'} onChange={e => setNovoItem(f => ({ ...f, unidade: e.target.value }))} className={IN} />
          </div>
          <div>
            <label className="text-[9px] text-gray-600 uppercase block mb-1">Qtd.</label>
            <input type="number" min="0.001" step="0.001" value={novoItem.quantidade}
              onChange={e => setNovoItem(f => ({ ...f, quantidade: parseFloat(e.target.value) || 1 }))} className={IN + ' text-right'} />
          </div>
          <div>
            <label className="text-[9px] text-gray-600 uppercase block mb-1">Preço Unit. (R$) *</label>
            <input type="number" min="0" step="0.01" value={novoItem.preco_unitario || ''}
              onChange={e => setNovoItem(f => ({ ...f, preco_unitario: parseFloat(e.target.value) || 0 }))}
              placeholder="0,00" className={IN + ' text-right'} />
          </div>
          <div>
            <button onClick={adicionarItem}
              disabled={!novoItem.descricao.trim() || novoItem.preco_unitario <= 0}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all">
              Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Subtotal */}
      {itens.length > 0 && (
        <div className="flex justify-end">
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl px-5 py-3 text-right">
            <p className="text-xs text-gray-500 mb-0.5">{itens.length} item(s)</p>
            <p className="text-xl font-black text-white">{fmtBRL(subtotal)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
