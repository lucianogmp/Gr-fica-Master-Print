// src/components/vendas/ItensEditor.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { VendaItem } from '../../types/venda';
import { Produto } from '../../types/produto';
import { useProdutos } from '../../hooks/useProdutos';
import { loadBom, calcCustoBOM } from '../../hooks/useBom';
import { useRole } from '../../hooks/useRole';
import { X, Search, Pencil, Check } from 'lucide-react';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { resumoPlacaLinha } from '../../lib/placaCalc';
import { MoneyInput } from '../ui/MoneyInput';
import { QtdInput } from '../ui/QtdInput';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const IN = [
  'bg-[#111827]', 'border border-gray-700', 'rounded-md', 'px-1.5', 'py-1.5',
  'text-white', 'text-sm', 'focus:outline-none', 'focus:border-blue-500',
  'transition-colors', 'w-full',
].join(' ');

// Remove as setinhas nativas de incremento do input number — elas comem espaço
// dos dígitos e fazem números maiores (ex: 1000) ficarem escondidos.
const IN_NUM = IN + ' [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Desconto do item em R$ (valor da linha). Itens novos guardam `desconto_valor`; itens antigos só
 * têm o percentual, então o valor em R$ é derivado dele (percentual × quantidade × preço).
 */
export function descontoEmReais(it: Pick<VendaItem, 'quantidade' | 'preco_unitario' | 'desconto'> & { desconto_valor?: number | null }): number {
  const bruto = Number(it.quantidade) * Number(it.preco_unitario);
  const rs = it.desconto_valor != null ? Number(it.desconto_valor) : bruto * (Number(it.desconto ?? 0) / 100);
  return Math.min(Math.max(0, r2(rs)), Math.max(0, r2(bruto)));
}

/** Recalcula desconto (% e R$) e total da linha a partir de quantidade, preço e desconto em R$. */
export function normalizarItem<T extends VendaItem>(it: T, descontoRs: number = descontoEmReais(it as any)): T {
  const bruto = r2(Number(it.quantidade) * Number(it.preco_unitario));
  const desc = Math.min(Math.max(0, r2(descontoRs)), Math.max(0, bruto));
  return {
    ...it,
    desconto_valor: desc,
    // percentual continua gravado (impressão e registros antigos usam ele)
    desconto: bruto > 0 ? Number(((desc / bruto) * 100).toFixed(2)) : 0,
    total: r2(bruto - desc),
  };
}

interface ItensEditorProps {
  itens: VendaItem[];
  onChange: (itens: VendaItem[]) => void;
  /** Lápis do item: abre o cadastro do produto pra editar; ao salvar, volta pra esta venda. */
  onEditarProduto?: (indice: number) => void;
}

export function ItensEditor({ itens, onChange, onEditarProduto }: ItensEditorProps) {
  const [buscaProduto, setBuscaProduto] = useState('');
  const [mostrarSugestoes, setMostrar]  = useState(false);
  const [dropRect, setDropRect]         = useState<DOMRect | null>(null);
  // Navegação por teclado no dropdown de produtos (seta cima/baixo + Enter).
  const [indiceAtivo, setIndiceAtivo]   = useState(0);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const buscaInputRef = useRef<HTMLInputElement>(null);
  // Depois de adicionar um item, o cursor vai pra QUANTIDADE dele (não volta pra busca).
  const focarQtdRef = useRef<number | null>(null);
  const [editandoNome, setEditandoNome] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: produtos = [] } = useProdutos();
  const { isAdmin } = useRole();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setMostrar(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const idx = focarQtdRef.current;
    if (idx == null || idx >= itens.length) return;
    focarQtdRef.current = null;
    const el = document.getElementById(`item-qtd-${idx}`) as HTMLInputElement | null;
    if (el) { el.focus(); setTimeout(() => el.select(), 0); }
  }, [itens.length]);

  function atualizarRect() {
    if (inputRef.current) setDropRect(inputRef.current.getBoundingClientRect());
  }

  const produtosAtivos = useMemo(() => produtos.filter(p => p.status === 'ativo'), [produtos]);

  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto.trim()) return produtosAtivos.slice(0, 8);
    return produtosAtivos
      .filter(p => correspondeABuscaEmCampos([p.nome, p.sku], buscaProduto))
      .slice(0, 8);
  }, [produtosAtivos, buscaProduto]);

  async function adicionarDoCatalogo(produto: Produto) {
    const eM2 = produto.unidade_medida === 'm2';

    // Custo por unidade (ou por m²) — só é usado pra referência de admin/dono,
    // calculado a partir do BOM (receita) do produto + custos fixos dele.
    // Não é preciso esperar isso pra adicionar o item — se demorar, o item
    // entra sem custo e o admin pode recalcular depois se quiser (não é o
    // caso comum, já que o BOM já vem carregado do cache na maioria das vezes).
    let custoUnitario: number | null = null;
    if (isAdmin) {
      try {
        const bom = await loadBom(produto.id);
        custoUnitario = calcCustoBOM(bom)
          + Number((produto as any).custo_mao_obra ?? 0)
          + Number((produto as any).custo_acabamento ?? 0)
          + Number((produto as any).custo_operacional ?? 0);
      } catch {
        // silencioso — item continua sendo adicionado normalmente sem custo
      }
    }

    focarQtdRef.current = itens.length;
    onChange([...itens, normalizarItem({
      descricao: produto.nome, quantidade: 1,
      preco_unitario: Number(produto.preco_venda ?? 0), desconto: 0,
      unidade: eM2 ? 'm²' : 'un', obs: null, produto_id: produto.id,
      total: 0,
      ...(custoUnitario != null ? { custo_unitario: custoUnitario } as any : {}),
    } as VendaItem, 0)]);
    setBuscaProduto('');
    setMostrar(false);
  }

  function removerItem(idx: number) { setEditandoNome(null); onChange(itens.filter((_, i) => i !== idx)); }

  // Quantidade ou preço mudando mantêm o desconto em R$ digitado (só limita ao valor da linha).
  function atualizarItem(idx: number, field: keyof VendaItem, val: any) {
    onChange(itens.map((it, i) => {
      if (i !== idx) return it;
      const rsAtual = descontoEmReais(it as any);
      return normalizarItem({ ...it, [field]: val } as VendaItem, field === ('desconto_valor' as any) ? Number(val) : rsAtual);
    }));
  }

  function handleBuscaChange(v: string) {
    setBuscaProduto(v);
    setIndiceAtivo(0);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { atualizarRect(); setMostrar(true); }, 150);
  }

  function handleBuscaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mostrarSugestoes || produtosFiltrados.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceAtivo(i => (i + 1) % produtosFiltrados.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceAtivo(i => (i - 1 + produtosFiltrados.length) % produtosFiltrados.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = produtosFiltrados[indiceAtivo];
      if (p) adicionarDoCatalogo(p);
    } else if (e.key === 'Escape') {
      setMostrar(false);
    }
  }

  const subtotal = itens.reduce((s, i) => s + Number(i.total), 0);
  // Custo total dos itens — só admin/dono, nunca aparece em impressão/mensagem.
  const custoTotalItens = itens.reduce((s, i) => {
    const custo = Number((i as any).custo_unitario ?? 0);
    return custo > 0 ? s + custo * Number(i.quantidade ?? 0) : s;
  }, 0);

  // Portal: renderiza no document.body, position:fixed relativo à viewport
  // getBoundingClientRect() retorna coords relativas à viewport — correto para fixed
  // floating-panel (index.css) dá fundo 100% opaco — NUNCA bg-[#1a2332]
  // aqui (glassmorphism translúcido dos cards, deixa o conteúdo por baixo
  // vazando através do dropdown).
  const dropdown = mostrarSugestoes && dropRect ? createPortal(
    <div
      style={{
        position: 'fixed',
        ...(dropRect.bottom + 330 > window.innerHeight && dropRect.top > 330
          ? { bottom: window.innerHeight - dropRect.top + 4 }
          : { top: dropRect.bottom + 4 }),
        left: dropRect.left,
        width: dropRect.width,
        zIndex: 99999,
        overflow: 'hidden',
        maxHeight: 320,
        overflowY: 'auto',
      }}
      className="floating-panel"
    >
      {produtosFiltrados.length === 0 ? (
        <p className="px-4 py-3 text-xs text-gray-500">Nenhum produto encontrado.</p>
      ) : produtosFiltrados.map((p, idx) => {
        const eM2 = p.unidade_medida === 'm2';
        const ativoPorTeclado = idx === indiceAtivo;
        return (
          <button
            key={p.id}
            onMouseDown={e => { e.preventDefault(); adicionarDoCatalogo(p); }}
            onMouseEnter={() => setIndiceAtivo(idx)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '7px 12px',
              cursor: 'pointer', textAlign: 'left',
            }}
            className={`transition-colors duration-150 border-b border-gray-700/50 ${ativoPorTeclado ? 'bg-blue-900/30' : 'bg-transparent hover:bg-blue-900/20'}`}
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

  const podeEditarProduto = (it: VendaItem) => !!it.produto_id && !it.detalhe_placa && !!onEditarProduto;

  return (
    <div className="space-y-2">

      {/* ── Tabela de itens (a busca fica SEMPRE abaixo dos itens já adicionados) ── */}
      {itens.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          {/* table-fixed + larguras iguais: Qtd., Preço e Desconto ficam do mesmo tamanho e não cortam o número */}
          <table className="w-full table-fixed tabela-itens" style={{ minWidth: 780 }}>
            <colgroup>
              <col />
              <col style={{ width: 48 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 56 }} />
            </colgroup>
            <thead>
              <tr className="text-[11px] font-bold text-gray-400 uppercase bg-gray-800/50 border-b border-gray-700">
                <th className="px-2 py-1 text-left">Descrição</th>
                <th className="px-1 py-1 text-center">Un.</th>
                <th className="px-1 py-1 text-center">Qtd.</th>
                <th className="px-1 py-1 text-center">Preço unit.</th>
                <th className="px-1 py-1 text-center">Desc. R$</th>
                <th className="px-2 py-1 text-right">Total</th>
                <th className="px-1 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, i) => (
                <tr key={i} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/20">
                  <td className="px-2 py-2">
                    {editandoNome === i ? (
                      <input autoFocus value={it.descricao} className={IN}
                        onChange={e => atualizarItem(i, 'descricao', e.target.value)}
                        onBlur={() => setEditandoNome(null)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setEditandoNome(null); } }} />
                    ) : (
                      <>
                        <p className="text-sm text-white font-semibold truncate" title={it.descricao}>{it.descricao}</p>
                        {/* Detalhe vindo do orçamento: configuração da placa ou medidas do item (ex.: 5 × 5 cm) */}
                        {(() => {
                          const detalhe = it.detalhe_placa ? resumoPlacaLinha(it.detalhe_placa) : (it.obs ?? '');
                          return detalhe ? <p className="text-[10px] text-gray-500 truncate" title={detalhe}>{detalhe}</p> : null;
                        })()}
                      </>
                    )}
                  </td>
                  <td className="px-1 py-1 text-center text-xs text-gray-400">{it.unidade ?? 'un'}</td>
                  <td className="px-1 py-1">
                    <QtdInput id={`item-qtd-${i}`} value={String(it.quantidade ?? '')}
                      onChange={v => atualizarItem(i, 'quantidade', parseFloat(v) || 0)}
                      onEnter={() => buscaInputRef.current?.focus()}
                      className={IN_NUM + ' text-right px-2 min-w-0'} />
                  </td>
                  <td className="px-1 py-1">
                    <MoneyInput value={it.preco_unitario}
                      onChange={v => atualizarItem(i, 'preco_unitario', v)} className={IN + ' text-right px-2 min-w-0'} />
                  </td>
                  <td className="px-1 py-1">
                    <MoneyInput value={descontoEmReais(it as any)}
                      onChange={v => atualizarItem(i, 'desconto_valor' as any, v)} className={IN + ' text-right px-2 min-w-0'} placeholder="0,00" />
                  </td>
                  <td className="px-2 py-1 text-right font-bold text-white text-sm whitespace-nowrap">
                    {fmtBRL(it.total)}
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        title={podeEditarProduto(it) ? 'Editar o produto (volta pra esta venda ao salvar)' : 'Editar a descrição'}
                        onClick={() => {
                          if (podeEditarProduto(it)) onEditarProduto!(i);
                          else setEditandoNome(editandoNome === i ? null : i);
                        }}
                        className="text-gray-500 hover:text-blue-400 transition-colors inline-flex">
                        {editandoNome === i ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      </button>
                      <button title="Remover item" onClick={() => removerItem(i)} className="text-gray-600 hover:text-red-400 transition-colors inline-flex">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Buscar produto do catálogo ── */}
      <div ref={wrapRef}>
        <div
          ref={inputRef}
          className="flex items-center gap-2 bg-[#0d1117] border border-blue-500/30 rounded-lg px-2.5 py-1.5 focus-within:border-blue-500 transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <input
            ref={buscaInputRef}
            value={buscaProduto}
            onChange={e => handleBuscaChange(e.target.value)}
            onFocus={() => { atualizarRect(); if (buscaProduto.length > 0) setMostrar(true); }}
            onKeyDown={handleBuscaKeyDown}
            placeholder="Adicionar produto: nome ou SKU (setas + Enter)"
            className="flex-1 bg-transparent text-white text-xs placeholder-gray-600 focus:outline-none"
          />
        </div>
        {dropdown}
        {produtosAtivos.length === 0 && (
          <p className="text-[10px] text-yellow-400 mt-1">Nenhum produto ativo cadastrado em Produtos.</p>
        )}
      </div>

      {/* ── Subtotal ── */}
      {itens.length > 0 && (
        <div className="flex items-center justify-end gap-3 flex-wrap pr-1">
          {isAdmin && custoTotalItens > 0 && (
            <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-md px-2 py-0.5 text-[10px]">
              <span className="font-bold text-red-400 uppercase">🔒 Custo</span>
              <span className="font-black text-red-300">{fmtBRL(custoTotalItens)}</span>
              {subtotal > 0 && (
                <span className="text-gray-500">· Margem {(((subtotal - custoTotalItens) / subtotal) * 100).toFixed(1)}%</span>
              )}
            </span>
          )}
          <span className="text-[11px] text-gray-500">{itens.length} item(s)</span>
          <span className="text-sm font-black text-white">{fmtBRL(subtotal)}</span>
        </div>
      )}
    </div>
  );
}
