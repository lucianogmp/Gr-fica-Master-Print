import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrcamentos, useOrcamentoItens } from '../hooks/useOrcamentos';
import { Orcamento, OrcamentoItem, StatusOrcamento, STATUS_ORC } from '../types/orcamento';
import { ItemOrcEditor } from '../components/orcamentos/ItemOrcEditor';
import { ClienteSelector } from '../components/orcamentos/ClienteSelector';
import { KpiCard } from '../components/ui/KpiCard';
import {
  FileText, CheckCircle2, DollarSign, Wallet, Zap, X, ArrowLeft, Save,
  User, Package, Scissors, Palette, Pencil, Copy, ArrowUp, Check, Loader2,
} from 'lucide-react';

type View = 'lista' | 'detalhe';
type Filtro = 'todos' | StatusOrcamento;

const fmtBRL  = (v: number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

const TIPO_LABEL: Record<string, string> = {
  metro: 'm²', metro_manual: 'm² Manual', folha: 'Folha', livre: 'Livre',
};

const NOVO_ORC: Omit<Orcamento, 'id' | 'created_at' | 'updated_at'> = {
  cliente_nome: '', status: 'rascunho', desconto: 0, observacoes: '', total: 0,
};

export function Orcamentos() {
  const { data: orcamentos = [], isLoading, criar, atualizar, atualizarStatus, converterEmVenda, deletar, isSaving, isConvertendo } = useOrcamentos();
  const navigate = useNavigate();

  const [view, setView]               = useState<View>('lista');
  const [orcId, setOrcId]             = useState<string | null>(null);
  const [form, setForm]               = useState({ ...NOVO_ORC });
  const [itens, setItens]             = useState<OrcamentoItem[]>([]);
  const [showEditor, setShowEditor]   = useState(false);
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
  const [filtro, setFiltro]           = useState<Filtro>('todos');
  const [busca, setBusca]             = useState('');

  const isNovo = orcId === '__novo__';
  const { data: itensCarregados } = useOrcamentoItens(isNovo ? null : orcId);

  useMemo(() => {
    if (itensCarregados && !isNovo) setItens(itensCarregados);
  }, [itensCarregados, isNovo]);

  // Totais
  const subtotal   = itens.reduce((s, i) => s + Number(i.total), 0);
  const descGlobal = Number(form.desconto ?? 0);
  const totalFinal = subtotal * (1 - descGlobal / 100);

  function setF(k: keyof typeof NOVO_ORC, v: any) { setForm(p => ({ ...p, [k]: v })); }

  async function abrirDetalhe(o: Orcamento | null) {
    if (o) { setOrcId(o.id); setForm({ ...NOVO_ORC, ...o }); }
    else   { setOrcId('__novo__'); setForm({ ...NOVO_ORC }); setItens([]); }
    setShowEditor(false);
    setView('detalhe');
  }

  function fechar() { setView('lista'); setOrcId(null); setForm({ ...NOVO_ORC }); setItens([]); setShowEditor(false); }

  function handleAdicionarItem(item: OrcamentoItem) {
    if (editandoIdx !== null) {
      setItens(p => p.map((it, i) => i === editandoIdx ? item : it));
      setEditandoIdx(null);
    } else {
      setItens(p => [...p, item]);
    }
    setShowEditor(false);
  }

  function duplicarItem(idx: number) {
    setItens(p => [...p, { ...p[idx] }]);
  }

  function arredondarTotal() {
    const arredondado = Math.ceil(totalFinal);
    const novoDesc = subtotal > 0 ? Math.max(0, (1 - arredondado / subtotal) * 100) : 0;
    setF('desconto', parseFloat(novoDesc.toFixed(4)));
  }

  async function handleSalvar() {
    const payload = { ...form, total: totalFinal, desconto: descGlobal };
    const { id: _id, created_at: _c, updated_at: _u, ...clean } = { id: '', created_at: '', updated_at: '', ...payload };
    if (isNovo) { await criar({ orc: clean as any, itens }); }
    else if (orcId) { await atualizar({ id: orcId, orc: clean as any, itens }); }
    fechar();
  }

  async function handleConverter() {
    if (!orcId || isNovo) return;
    const orc = orcamentos.find(o => o.id === orcId);
    if (!orc) return;
    await converterEmVenda({ orc: { ...orc, total: totalFinal }, itens });
    fechar();
    navigate('/vendas');
  }

  const totalOrc    = orcamentos.length;
  const aprovados   = orcamentos.filter(o => o.status === 'aprovado').length;
  const convertidos = orcamentos.filter(o => o.status === 'convertido').length;
  const valorTotal  = orcamentos.filter(o => o.status !== 'recusado').reduce((s, o) => s + Number(o.total ?? 0), 0);

  const filtrados = useMemo(() => orcamentos
    .filter(o => filtro === 'todos' || o.status === filtro)
    .filter(o => !busca || o.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
      (o.numero ? String(o.numero).includes(busca) : false))
  , [orcamentos, filtro, busca]);

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Orçamentos...</div>;

  /* ── LISTA ── */
  if (view === 'lista') return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><FileText className="w-6 h-6 text-blue-400" /> Orçamentos</h1>
          <p className="text-gray-500 text-sm">{orcamentos.length} orçamento(s)</p>
        </div>
        <button onClick={() => abrirDetalhe(null)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
          + Novo Orçamento
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total"       value={totalOrc}           icon={FileText}     color="text-blue-400" />
        <KpiCard label="Aprovados"   value={aprovados}          icon={CheckCircle2} color="text-green-400" />
        <KpiCard label="Convertidos" value={convertidos}        icon={DollarSign}   color="text-purple-400" />
        <KpiCard label="Valor total" value={fmtBRL(valorTotal)} icon={Wallet}       color="text-yellow-400" />
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
          {(['todos','rascunho','enviado','aprovado','recusado','convertido'] as Filtro[]).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtro === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {f === 'todos' ? 'Todos' : STATUS_ORC[f as StatusOrcamento]?.label ?? f}
            </button>
          ))}
        </div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
          className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Nº</th>
              <th className="px-5 py-3 text-left">Cliente</th>
              <th className="px-5 py-3 text-left">Data</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhum orçamento encontrado.</td></tr>
            )}
            {filtrados.map(o => {
              const st = STATUS_ORC[o.status] ?? STATUS_ORC.rascunho;
              return (
                <tr key={o.id} onClick={() => abrirDetalhe(o)}
                  className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{o.numero ? `#${o.numero}` : '—'}</td>
                  <td className="px-5 py-3 font-medium text-white">{o.cliente_nome || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(o.created_at)}</td>
                  <td className="px-5 py-3 text-right font-bold text-white">{fmtBRL(o.total)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${st.cor}`}>{st.label}</span>
                  </td>
                  <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5 justify-center">
                      <button onClick={() => abrirDetalhe(o)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30">Editar</button>
                      {o.status === 'aprovado' && !o.venda_id && (
                        <button onClick={async (e) => {
                            e.stopPropagation();
                            const { supabase } = await import('../lib/supabase');
                            const { data: its } = await supabase.from('orcamento_itens').select('*').eq('orcamento_id', o.id);
                            await converterEmVenda({ orc: o, itens: its ?? [] });
                            navigate('/vendas');
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30">
                          <Zap className="w-3 h-3" /> Venda
                        </button>
                      )}
                      <button onClick={() => { if (confirm('Remover?')) deletar(o.id); }}
                        className="flex items-center justify-center px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── DETALHE ── */
  const orcAtual    = orcamentos.find(o => o.id === orcId);
  const jaConvertido = orcAtual?.status === 'convertido';

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={fechar}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-white truncate">
            {isNovo ? 'Novo Orçamento' : `Orçamento ${form.numero ? `#${form.numero}` : ''} — ${form.cliente_nome || 'Editar'}`}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isNovo && !jaConvertido && (
            <select value={form.status}
              onChange={e => { setF('status', e.target.value); atualizarStatus({ id: orcId!, status: e.target.value as StatusOrcamento }); }}
              className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
              {Object.entries(STATUS_ORC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
          {!isNovo && form.status === 'aprovado' && !jaConvertido && (
            <button onClick={handleConverter} disabled={isConvertendo}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              {isConvertendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {isConvertendo ? '...' : 'Converter em Venda'}
            </button>
          )}
          {jaConvertido && (
            <span className="px-4 py-2 rounded-xl text-sm font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1.5"><Check className="w-4 h-4" /> Convertido</span>
          )}
          <button onClick={handleSalvar} disabled={isSaving || !form.cliente_nome.trim()}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Principal */}
        <div className="xl:col-span-2 space-y-5">

          {/* Dados */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Dados do Orçamento</h3>
            <div className="space-y-4">
              <ClienteSelector value={form.cliente_nome} onChange={v => setF('cliente_nome', v)} />
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Observações</label>
                <textarea rows={2} value={form.observacoes ?? ''} onChange={e => setF('observacoes', e.target.value)}
                  className={IN + ' resize-none'} placeholder="Condições, prazos, informações adicionais..." />
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Itens</h3>
              {!showEditor && !jaConvertido && (
                <button onClick={() => { setEditandoIdx(null); setShowEditor(true); }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all">
                  + Adicionar Item
                </button>
              )}
            </div>

            {showEditor && (
              <div className="mb-5">
                <ItemOrcEditor
                  editando={editandoIdx !== null ? itens[editandoIdx] : null}
                  onAdicionar={handleAdicionarItem}
                  onCancelar={() => { setShowEditor(false); setEditandoIdx(null); }}
                />
              </div>
            )}

            {itens.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] font-bold text-gray-500 uppercase bg-gray-800/50 border-b border-gray-700">
                      <th className="px-3 py-2 text-left">Descrição</th>
                      <th className="px-3 py-2 text-center">Tipo</th>
                      <th className="px-3 py-2 text-center">Dim.</th>
                      <th className="px-3 py-2 text-right w-16">Qtd</th>
                      <th className="px-3 py-2 text-right w-24">Unit.</th>
                      <th className="px-3 py-2 text-right w-24">Total</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it, i) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/20">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-white">{it.descricao}</div>
                          {it.acabamento_nome && it.acabamento_nome !== 'Sem acabamento' && (
                            <div className="text-[9px] text-gray-500 flex items-center gap-1"><Scissors className="w-2.5 h-2.5" /> {it.acabamento_nome}</div>
                          )}
                          {it.arte_inclusa && (
                            <div className="text-[9px] text-green-500 flex items-center gap-1"><Palette className="w-2.5 h-2.5" /> Arte inclusa</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-[9px] font-bold bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">
                            {TIPO_LABEL[it.tipo_calculo] ?? it.tipo_calculo}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-400">
                          {(it.tipo_calculo === 'metro' || it.tipo_calculo === 'metro_manual') && it.largura_cm && it.altura_cm
                            ? `${it.largura_cm}×${it.altura_cm}cm`
                            : it.tipo_calculo === 'folha' ? it.folha_tipo : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-white">{it.quantidade}</td>
                        <td className="px-3 py-2.5 text-right text-gray-300">{fmtBRL(it.preco_unitario)}</td>
                        <td className="px-3 py-2.5 text-right font-black text-white">{fmtBRL(it.total)}</td>
                        <td className="px-3 py-2.5">
                          {!jaConvertido && (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => { setEditandoIdx(i); setShowEditor(true); }}
                                title="Editar" className="text-gray-500 hover:text-blue-400 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => duplicarItem(i)}
                                title="Duplicar" className="text-gray-500 hover:text-green-400 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setItens(p => p.filter((_, idx) => idx !== i))}
                                title="Remover" className="text-gray-500 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !showEditor ? (
              <div className="text-center py-10 text-gray-600 border-2 border-dashed border-gray-700 rounded-xl">
                <Package className="w-10 h-10 mb-2 opacity-30 mx-auto" />
                <p className="text-sm">Nenhum item adicionado.</p>
                <button onClick={() => setShowEditor(true)}
                  className="mt-3 text-blue-400 hover:text-blue-300 text-xs font-bold underline">
                  + Adicionar primeiro item
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Resumo lateral */}
        <div>
          <div className="bg-[#1f2937] border-t-2 border-blue-500 border-x border-b border-gray-700 rounded-xl p-5 sticky top-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Resumo</h3>

            <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
              {itens.map((it, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-400 border-b border-gray-800 pb-1">
                  <span className="truncate max-w-28">{it.descricao}</span>
                  <span className="font-bold text-white ml-2 flex-shrink-0">{fmtBRL(it.total)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="font-bold text-white">{fmtBRL(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Desconto (%)</span>
                <input type="number" min="0" max="100" step="0.5"
                  value={form.desconto ?? 0} onChange={e => setF('desconto', parseFloat(e.target.value) || 0)}
                  className="w-20 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-blue-500" />
              </div>
              {descGlobal > 0 && (
                <div className="flex justify-between text-xs text-red-400">
                  <span>Desconto</span>
                  <span>−{fmtBRL(subtotal * descGlobal / 100)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-700">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-white">Total</span>
                  <div className="text-right">
                    <p className="text-3xl font-black text-blue-400">{fmtBRL(totalFinal)}</p>
                    {/* Arredondar */}
                    {totalFinal !== Math.ceil(totalFinal) && (
                      <button onClick={arredondarTotal}
                        className="flex items-center gap-0.5 text-[10px] text-yellow-400 hover:text-yellow-300 underline mt-0.5 ml-auto">
                        <ArrowUp className="w-3 h-3" /> Arredondar para {fmtBRL(Math.ceil(totalFinal))}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button onClick={handleSalvar} disabled={isSaving || !form.cliente_nome.trim()}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar Orçamento'}
              </button>
              {!isNovo && form.status === 'aprovado' && !jaConvertido && (
                <button onClick={handleConverter} disabled={isConvertendo}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                  {isConvertendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isConvertendo ? 'Convertendo...' : 'Converter em Venda'}
                </button>
              )}
              {!isNovo && !jaConvertido && (
                <div className="pt-2">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Status</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(STATUS_ORC).filter(([k]) => k !== 'convertido').map(([k, v]) => (
                      <button key={k} onClick={() => { setF('status', k); atualizarStatus({ id: orcId!, status: k as StatusOrcamento }); }}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${form.status === k ? v.cor : 'border-gray-700 text-gray-500 hover:text-white hover:bg-gray-700/30'}`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
