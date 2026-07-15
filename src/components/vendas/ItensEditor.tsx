// src/components/vendas/ItensEditor.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { VendaItem } from '../../types/venda';
import { Produto } from '../../types/produto';
import { useProdutos } from '../../hooks/useProdutos';
import { X, Search, Package } from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const IN = [
  'bg-[#111827]', 'border border-gray-700', 'rounded-lg', 'px-2', 'py-1.5',
  'text-white', 'text-xs', 'focus:outline-none', 'focus:border-blue-500',
  'transition-colors', 'w-full', '[color-scheme:dark]',
].join(' ');

// Remove as setinhas nativas de incremento do input number — elas comem espaço
// dos dígitos e fazem números maiores (ex: 1000) ficarem escondidos.
const IN_NUM = IN + ' [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

interface ItensEditorProps {
  itens: VendaItem[];
  onChange: (itens: VendaItem[]) => void;
}

const ITEM_VAZIO: Omit<VendaItem, 'total'> = {
  descricao: '', quantidade: 1, preco_unitario: 0,
  desconto: 0, unidade: 'un', obs: '', produto_id: null,
};

export function ItensEditor({ itens, onChange }: ItensEditorProps) {
  const [novoItem, setNovoItem]         = useState({ ...ITEM_VAZIO });
  const [buscaProduto, setBuscaProduto] = useState('');
  const [mostrarSugestoes, setMostrar]  = useState(false);
  const [dropRect, setDropRect]         = useState<DOMRect | null>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: produtos = [] } = useProdutos();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setMostrar(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function atualizarRect() {
    if (inputRef.current) setDropRect(inputRef.current.getBoundingClientRect());
  }

  const produtosAtivos = useMemo(() => produtos.filter(p => p.status === 'ativo'), [produtos]);

  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto.trim()) return produtosAtivos.slice(0, 8);
    const t = buscaProduto.toLowerCase();
    return produtosAtivos
      .filter(p => p.nome.toLowerCase().includes(t) || (p.sku ?? '').toLowerCase().includes(t))
      .slice(0, 8);
  }, [produtosAtivos, buscaProduto]);

  function calcTotal(qtd: number, preco: number, desc: number) {
    return qtd * preco * (1 - (desc || 0) / 100);
  }

  function adicionarDoCatalogo(produto: Produto) {
    const eM2 = produto.unidade_medida === 'm2';
    onChange([...itens, {
      descricao: produto.nome, quantidade: 1,
      preco_unitario: Number(produto.preco_venda ?? 0), desconto: 0,
      unidade: eM2 ? 'm²' : 'un', obs: null, produto_id: produto.id,
      total: calcTotal(1, Number(produto.preco_venda ?? 0), 0),
    }]);
    setBuscaProduto('');
    setMostrar(false);
  }

  function adicionarItem() {
    if (!novoItem.descricao.trim() || novoItem.preco_unitario <= 0) return;
    onChange([...itens, { ...novoItem, total: calcTotal(novoItem.quantidade, novoItem.preco_unitario, novoItem.desconto ?? 0) }]);
    setNovoItem({ ...ITEM_VAZIO });
  }

  function removerItem(idx: number) { onChange(itens.filter((_, i) => i !== idx)); }

  function atualizarItem(idx: number, field: keyof VendaItem, val: any) {
    onChange(itens.map((it, i) => {
      if (i !== idx) return it;
      const u = { ...it, [field]: val };
      u.total = calcTotal(Number(u.quantidade), Number(u.preco_unitario), Number(u.desconto ?? 0));
      return u;
    }));
  }

  function handleBuscaChange(v: string) {
    setBuscaProduto(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { atualizarRect(); setMostrar(true); }, 150);
  }

  const subtotal = itens.reduce((s, i) => s + Number(i.total), 0);

  // Portal: renderiza no document.body, position:fixed relativo à viewport
  // getBoundingClientRect() retorna coords relativas à viewport — correto para fixed
  const dropdown = mostrarSugestoes && dropRect ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: dropRect.bottom + 4,
        left: dropRect.left,
        width: dropRect.width,
        zIndex: 99999,
        backgroundColor: '#0f1824',
        border: '1px solid #374151',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.92)',
        overflow: 'hidden',
        maxHeight: 320,
        overflowY: 'auto',
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
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '10px 14px',
              backgroundColor: 'transparent', borderBottom: '1px solid #1f2937',
              cursor: 'pointer', textAlign: 'left',
            }}
            className="hover:bg-blue-900/20 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-white text-xs font-bold truncate flex items-center gap-1.5">
                {p.nome}
                {eM2 && <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1 py-0.5 rounded flex-shrink-0">m²</span>}
              </p>
              {p.sku && <p className="text-[10px] text-gray-500 font-mono">{p.sku}</p>}
            </div>
            <span className="text-xs font-black text-green-400 ml-2 flex-shrink-0">
              {fmtBRL(Number(p.preco_venda ?? 0))}{eM2 ? '/m²' : ''}
            </span>
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-3">

      {/* ── Buscar produto do catálogo ── */}
      <div className="bg-[#111827] border border-blue-500/30 rounded-xl p-3 space-y-2" ref={wrapRef}>
        <p className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Adicionar produto do catálogo
        </p>
        <div
          ref={inputRef}
          className="flex items-center gap-2 bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 focus-within:border-blue-500 transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <input
            value={buscaProduto}
            onChange={e => handleBuscaChange(e.target.value)}
            onFocus={() => { atualizarRect(); if (buscaProduto.length > 0) setMostrar(true); }}
            placeholder="Buscar produto por nome ou SKU..."
            className="flex-1 bg-transparent text-white text-xs placeholder-gray-600 focus:outline-none [color-scheme:dark]"
          />
        </div>
        {dropdown}
        {produtosAtivos.length === 0 && (
          <p className="text-[10px] text-yellow-400">Nenhum produto ativo cadastrado em Produtos.</p>
        )}
      </div>

      {/* ── Tabela de itens ── */}
      {itens.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full" style={{ minWidth: 920 }}>
            <thead>
              <tr className="text-[10px] font-bold text-gray-400 uppercase bg-gray-800/50 border-b border-gray-700">
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-2 py-2 text-center" style={{ width: 80 }}>Un.</th>
                <th className="px-2 py-2 text-center" style={{ width: 130 }}>Qtd.</th>
                <th className="px-2 py-2 text-center" style={{ width: 170 }}>Preço Unit.</th>
                <th className="px-2 py-2 text-center" style={{ width: 120 }}>Desc.%</th>
                <th className="px-3 py-2 text-right" style={{ width: 150 }}>Total</th>
                <th className="px-2 py-2 text-center" style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/20">
                  <td className="px-2 py-1.5">
                    <input value={it.descricao} onChange={e => atualizarItem(i, 'descricao', e.target.value)} className={IN} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input value={it.unidade ?? 'un'} onChange={e => atualizarItem(i, 'unidade', e.target.value)} className={IN + ' text-center'} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input type="number" min="0.001" step="0.001" value={it.quantidade}
                      onChange={e => atualizarItem(i, 'quantidade', parseFloat(e.target.value) || 0)} className={IN_NUM + ' text-center'} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <MoneyInput value={it.preco_unitario}
                      onChange={v => atualizarItem(i, 'preco_unitario', v)} className={IN + ' text-right'} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input type="number" min="0" max="100" step="0.1" value={it.desconto ?? 0}
                      onChange={e => atualizarItem(i, 'desconto', parseFloat(e.target.value) || 0)} className={IN_NUM + ' text-center'} />
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold text-white text-sm whitespace-nowrap">
                    {fmtBRL(it.total)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => removerItem(i)} className="text-gray-600 hover:text-red-400 transition-colors inline-flex">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Novo item manual ── */}
      <div className="bg-[#111827] border border-dashed border-gray-700 rounded-xl px-3 py-2.5">
        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">
          + Adicionar item manual (fora do catálogo)
        </p>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[9px] text-gray-600 uppercase block mb-1">Descrição *</label>
            <input value={novoItem.descricao}
              onChange={e => setNovoItem(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Nome do produto / serviço" className={IN}
              onKeyDown={e => { if (e.key === 'Enter') adicionarItem(); }} />
          </div>
          <div style={{ width: 72 }}>
            <label className="text-[9px] text-gray-600 uppercase block mb-1">Un.</label>
            <input value={novoItem.unidade ?? 'un'}
              onChange={e => setNovoItem(f => ({ ...f, unidade: e.target.value }))}
              className={IN + ' text-center'} />
          </div>
          <div style={{ width: 110 }}>
            <label className="text-[9px] text-gray-600 uppercase block mb-1">Qtd.</label>
            <input type="number" min="0.001" step="0.001" value={novoItem.quantidade}
              onChange={e => setNovoItem(f => ({ ...f, quantidade: parseFloat(e.target.value) || 1 }))}
              className={IN_NUM + ' text-center'} />
          </div>
          <div style={{ width: 140 }}>
            <label className="text-[9px] text-gray-600 uppercase block mb-1">Preço Unit. *</label>
            <MoneyInput value={novoItem.preco_unitario}
              onChange={v => setNovoItem(f => ({ ...f, preco_unitario: v }))}
              placeholder="0,00" className={IN + ' text-right'} />
          </div>
          <div style={{ width: 100 }}>
            <label className="text-[9px] text-gray-600 uppercase block mb-1">Desc.%</label>
            <input type="number" min="0" max="100" step="0.1" value={novoItem.desconto || ''}
              onChange={e => setNovoItem(f => ({ ...f, desconto: parseFloat(e.target.value) || 0 }))}
              placeholder="0" className={IN_NUM + ' text-center'} />
          </div>
          <button onClick={adicionarItem}
            disabled={!novoItem.descricao.trim() || novoItem.preco_unitario <= 0}
            className="h-[34px] px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-shrink-0">
            Adicionar
          </button>
        </div>
      </div>

      {/* ── Subtotal ── */}
      {itens.length > 0 && (
        <div className="flex justify-end items-center gap-3 pr-1">
          <span className="text-xs text-gray-500">{itens.length} item(s)</span>
          <span className="text-base font-black text-white">{fmtBRL(subtotal)}</span>
        </div>
      )}
    </div>
  );
}
