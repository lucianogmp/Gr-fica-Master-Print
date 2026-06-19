// src/components/vendas/ItensEditor.tsx
//
// Agora com duas formas de adicionar item:
//   1) Buscar e clicar num produto já cadastrado em Produtos (preço e
//      unidade vêm preenchidos automaticamente, e o item fica vinculado
//      via produto_id).
//   2) Cadastro manual (descrição livre), para serviços ou itens fora
//      do catálogo — como já funcionava antes.

import { useState, useMemo, useRef, useEffect } from 'react';
import { VendaItem } from '../../types/venda';
import { Produto } from '../../types/produto';
import { useProdutos } from '../../hooks/useProdutos';
import { X, Search, Package } from 'lucide-react';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const IN = "bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full [color-scheme:dark]";

interface ItensEditorProps {
  itens: VendaItem[];
  onChange: (itens: VendaItem[]) => void;
}

const ITEM_VAZIO: Omit<VendaItem, 'total'> = {
  descricao: '', quantidade: 1, preco_unitario: 0,
  desconto: 0, unidade: 'un', obs: '', produto_id: null,
};

export function ItensEditor({ itens, onChange }: ItensEditorProps) {
  const [novoItem, setNovoItem] = useState({ ...ITEM_VAZIO });
  const [buscaProduto, setBuscaProduto] = useState('');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: produtos = [] } = useProdutos();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMostrarSugestoes(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const produtosAtivos = useMemo(() => produtos.filter(p => p.status === 'ativo'), [produtos]);

  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto.trim()) return produtosAtivos.slice(0, 8);
    const termo = buscaProduto.toLowerCase();
    return produtosAtivos
      .filter(p => p.nome.toLowerCase().includes(termo) || (p.sku ?? '').toLowerCase().includes(termo))
      .slice(0, 8);
  }, [produtosAtivos, buscaProduto]);

  function calcTotal(qtd: number, preco: number, desc: number) {
    return qtd * preco * (1 - (desc || 0) / 100);
  }

  function adicionarDoCatalogo(produto: Produto) {
    const eM2 = produto.unidade_medida === 'm2';
    const item: VendaItem = {
      descricao: produto.nome,
      quantidade: 1,
      preco_unitario: Number(produto.preco_venda ?? 0),
      desconto: 0,
      unidade: eM2 ? 'm²' : 'un',
      obs: null,
      produto_id: produto.id,
      total: calcTotal(1, Number(produto.preco_venda ?? 0), 0),
    };
    onChange([...itens, item]);
    setBuscaProduto('');
    setMostrarSugestoes(false);
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

      {/* Buscar produto do catálogo */}
      <div className="bg-[#111827] border border-blue-500/30 rounded-xl p-3 space-y-2" ref={wrapRef}>
        <p className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Adicionar produto do catálogo
        </p>
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-gray-500 pointer-events-none z-10" />
          <input
            value={buscaProduto}
            onChange={e => { setBuscaProduto(e.target.value); setMostrarSugestoes(true); }}
            onFocus={() => setMostrarSugestoes(true)}
            placeholder="Buscar produto cadastrado por nome ou SKU..."
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
          />
          {mostrarSugestoes && (
            <div
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
                backgroundColor: '#0f1824', border: '1px solid #374151', borderRadius: 12,
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)', overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
              }}
            >
              {produtosFiltrados.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-500">Nenhum produto encontrado.</p>
              ) : produtosFiltrados.map(p => {
                const eM2 = p.unidade_medida === 'm2';
                return (
                  <button
                    key={p.id}
                    onMouseDown={e => { e.preventDefault(); adicionarDoCatalogo(p); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', backgroundColor: 'transparent', borderBottom: '1px solid #1f2937',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    className="hover:bg-blue-900/20 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-white text-xs font-bold truncate flex items-center gap-1.5">
                        {p.nome}
                        {eM2 && (
                          <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1 py-0.5 rounded flex-shrink-0">
                            m²
                          </span>
                        )}
                      </p>
                      {p.sku && <p className="text-[10px] text-gray-500 font-mono">{p.sku}</p>}
                    </div>
                    <span className="text-xs font-black text-green-400 ml-2 flex-shrink-0">
                      {fmtBRL(Number(p.preco_venda ?? 0))}{eM2 ? '/m²' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {produtosAtivos.length === 0 && (
          <p className="text-[10px] text-yellow-400">Nenhum produto ativo cadastrado em Produtos.</p>
        )}
      </div>

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

      {/* Linha de novo item manual */}
      <div className="bg-[#111827] border border-dashed border-gray-700 rounded-xl p-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">+ Adicionar item manual (fora do catálogo)</p>
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
