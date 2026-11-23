// src/pages/Estoque/ListaCompras.tsx
// Lembrete de compras: o dono pesquisa a matéria-prima e deixa marcada pra comprar, mesmo com
// o estoque ok (ex.: se adiantar por causa de datas comerciais). Itens avulsos também entram.
import { useMemo, useRef, useState } from 'react';
import { ShoppingCart, Search, Plus, Trash2, Check, AlertTriangle, PackageSearch } from 'lucide-react';
import { useMateriasPrimas } from '../../hooks/useEstoque';
import { useListaCompras, ItemCompra } from '../../hooks/useListaCompras';
import { statusEstoque, MateriaPrima } from '../../types/estoque';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { QtdInput } from '../../components/ui/QtdInput';
import { DateInput } from '../../components/ui/DateInput';
import { useConfirm } from '../../components/ui/ConfirmModal';

const IN = 'bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors';
const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const hojeISO = () => new Date().toLocaleDateString('en-CA');
const fmtData = (d: string) => d.split('-').reverse().join('/');

function Linha({ it, mpPorId, atualizar, remover }: { it: ItemCompra; mpPorId: Map<string, MateriaPrima>; atualizar: (a: { id: string; dados: Partial<ItemCompra> }) => void; remover: (ids: string[]) => Promise<void> }) {
  const mp = it.materia_prima_id ? mpPorId.get(it.materia_prima_id) : undefined;
  const st = mp ? statusEstoque(mp) : null;
  const atrasado = !it.comprado && it.comprar_ate && it.comprar_ate < hojeISO();
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 flex-wrap ${it.comprado ? 'opacity-60' : ''}`}>
      <button
        onClick={() => atualizar({ id: it.id, dados: { comprado: !it.comprado, comprado_em: !it.comprado ? new Date().toISOString() : null } })}
        title={it.comprado ? 'Voltar para a lista' : 'Marcar como comprado'}
        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${it.comprado ? 'bg-green-600 border-green-500' : 'border-gray-600 hover:border-green-500'}`}>
        {it.comprado && <Check className="w-3.5 h-3.5 text-white" />}
      </button>

      <div className="min-w-[160px] flex-1">
        <div className={`text-sm font-semibold ${it.comprado ? 'line-through text-gray-500' : 'text-white'}`}>{it.nome}</div>
        <div className="text-[10px] text-gray-500">
          {mp ? <>Em estoque: <span style={{ color: st?.corTexto }}>{fmtN(Number(mp.saldo))} {mp.unidade}</span>{Number(mp.estoque_minimo) > 0 && <> · mín. {fmtN(Number(mp.estoque_minimo))}</>}{st && (st.key === 'baixo' || st.key === 'zerado') && <span style={{ color: st.corTexto }}> · {st.label}</span>}</> : 'Item avulso (fora do estoque)'}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <QtdInput value={it.quantidade != null ? String(it.quantidade) : ''} onChange={v => atualizar({ id: it.id, dados: { quantidade: v === '' ? null : Number(v) } })}
          className={IN + ' w-16 text-center'} placeholder="Qtd" />
        <span className="text-[10px] text-gray-500 w-8">{it.unidade ?? ''}</span>
      </div>

      <div className="w-[120px]" title="Comprar até (data)">
        <DateInput value={it.comprar_ate ?? ''} onChange={v => atualizar({ id: it.id, dados: { comprar_ate: v || null } })} className={IN + ' w-full'} />
      </div>
      {atrasado && <span className="text-[10px] font-bold text-red-400 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> venceu {fmtData(it.comprar_ate!)}</span>}

      <input defaultValue={it.observacao ?? ''} placeholder="Observação (fornecedor, marca…)"
        onBlur={e => { const v = e.target.value.trim(); if (v !== (it.observacao ?? '')) atualizar({ id: it.id, dados: { observacao: v || null } }); }}
        className={IN + ' w-56 max-w-full'} />

      <button onClick={() => remover([it.id])} title="Remover da lista" className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}


export function ListaCompras() {
  const { data: mps = [] } = useMateriasPrimas();
  const { data: itens = [], isLoading, adicionar, atualizar, remover } = useListaCompras();
  const { confirmar } = useConfirm();

  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [idx, setIdx] = useState(0);
  const [verComprados, setVerComprados] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mpPorId = useMemo(() => new Map(mps.map(m => [m.id, m])), [mps]);
  const jaNaLista = useMemo(() => new Set(itens.filter(i => !i.comprado && i.materia_prima_id).map(i => i.materia_prima_id as string)), [itens]);

  const sugestoes = useMemo(() => {
    const q = busca.trim();
    if (!q) return [];
    return mps.filter(m => correspondeABuscaEmCampos([m.nome, m.categoria], q)).slice(0, 8);
  }, [mps, busca]);
  const nomeExato = mps.some(m => m.nome.trim().toLowerCase() === busca.trim().toLowerCase());
  const opcoes: Array<{ mp?: MateriaPrima; avulso?: string }> = [
    ...sugestoes.map(mp => ({ mp })),
    ...(busca.trim() && !nomeExato ? [{ avulso: busca.trim() }] : []),
  ];

  async function escolher(o: { mp?: MateriaPrima; avulso?: string }) {
    if (o.mp) {
      if (jaNaLista.has(o.mp.id)) { setBusca(''); setAberto(false); return; }
      await adicionar([{ materia_prima_id: o.mp.id, nome: o.mp.nome, unidade: o.mp.unidade }]);
    } else if (o.avulso) {
      await adicionar([{ nome: o.avulso }]);
    }
    setBusca(''); setIdx(0); setAberto(false);
    inputRef.current?.focus();
  }

  const pendentes = itens.filter(i => !i.comprado).sort((a, b) => (a.comprar_ate ?? '9999').localeCompare(b.comprar_ate ?? '9999'));
  const comprados = itens.filter(i => i.comprado);

  const baixos = mps.filter(m => ['zerado', 'baixo'].includes(statusEstoque(m).key) && !jaNaLista.has(m.id));
  async function adicionarBaixos() {
    if (baixos.length === 0) return;
    await adicionar(baixos.map(m => ({ materia_prima_id: m.id, nome: m.nome, unidade: m.unidade })));
  }

  async function limparComprados() {
    if (!(await confirmar(`Remover ${comprados.length} item(ns) já comprado(s) da lista?`, 'Limpar comprados'))) return;
    await remover(comprados.map(i => i.id));
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-blue-400" /> Lista de Compras</h1>
          <p className="text-gray-500 text-xs">Marque o que precisa comprar, mesmo com o estoque em dia — {pendentes.length} para comprar{comprados.length > 0 && `, ${comprados.length} comprado(s)`}</p>
        </div>
        {baixos.length > 0 && (
          <button onClick={adicionarBaixos} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-all flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Adicionar {baixos.length} item(ns) com estoque baixo/zerado
          </button>
        )}
      </div>

      {/* Pesquisa / adicionar */}
      <div className="relative max-w-xl">
        <div className="flex items-center gap-2 bg-[#1f2937] border border-blue-500/40 rounded-xl px-3 py-2 focus-within:border-blue-500">
          <Search className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <input ref={inputRef} value={busca} placeholder="Pesquise a matéria-prima para marcar como comprar…"
            onChange={e => { setBusca(e.target.value); setAberto(true); setIdx(0); }}
            onFocus={() => setAberto(true)}
            onBlur={() => setTimeout(() => setAberto(false), 150)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setIdx(i => Math.min(i + 1, opcoes.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter' && aberto && opcoes[idx]) { e.preventDefault(); escolher(opcoes[idx]); }
              else if (e.key === 'Escape') setAberto(false);
            }}
            className="bg-transparent flex-1 text-sm text-white placeholder-gray-500 focus:outline-none" />
        </div>
        {aberto && opcoes.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-[#1f2937] border border-gray-600 rounded-xl shadow-2xl overflow-hidden">
            {opcoes.map((o, i) => {
              const st = o.mp ? statusEstoque(o.mp) : null;
              const ja = o.mp && jaNaLista.has(o.mp.id);
              return (
                <button key={o.mp?.id ?? 'avulso'} onMouseDown={e => e.preventDefault()} onClick={() => escolher(o)} onMouseEnter={() => setIdx(i)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 text-sm ${i === idx ? 'bg-blue-600/25' : ''}`}>
                  {o.mp ? (
                    <>
                      <span className="text-white font-medium truncate">{o.mp.nome} {o.mp.categoria && <span className="text-[10px] text-gray-500">· {o.mp.categoria}</span>}</span>
                      <span className="text-[11px] whitespace-nowrap" style={{ color: st?.corTexto }}>
                        {ja ? 'já está na lista' : `${fmtN(Number(o.mp.saldo))} ${o.mp.unidade} em estoque`}
                      </span>
                    </>
                  ) : (
                    <span className="text-blue-300 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Adicionar “{o.avulso}” como item avulso</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Para comprar */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        {pendentes.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            <PackageSearch className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            Nada marcado para comprar. Pesquise acima para adicionar.
          </div>
        ) : pendentes.map(it => <Linha key={it.id} it={it} mpPorId={mpPorId} atualizar={atualizar} remover={remover} />)}
      </div>

      {/* Comprados */}
      {comprados.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <button onClick={() => setVerComprados(v => !v)} className="text-xs font-bold text-gray-400 hover:text-white">
              {verComprados ? '▾' : '▸'} Já comprados ({comprados.length})
            </button>
            <button onClick={limparComprados} className="text-[11px] text-gray-500 hover:text-red-400 underline">Limpar comprados</button>
          </div>
          {verComprados && <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">{comprados.map(it => <Linha key={it.id} it={it} mpPorId={mpPorId} atualizar={atualizar} remover={remover} />)}</div>}
        </div>
      )}
    </div>
  );
}
