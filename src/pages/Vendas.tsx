import { useState, useMemo } from 'react';
import { useVendas, useVendaItens } from '../hooks/useVendas';
import { Venda, VendaItem, StatusVenda, STATUS_VENDA } from '../types/venda';
import { ItensEditor } from '../components/vendas/ItensEditor';
import { KpiCard } from '../components/ui/KpiCard';
import {
  ShoppingCart, DollarSign, ClipboardList, Factory, CheckCircle2,
  ArrowLeft, Save, User, Package, Settings, X,
} from 'lucide-react';

type View = 'lista' | 'detalhe';
type Filtro = 'todos' | StatusVenda;

const fmtBRL  = (v: number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

const NOVA_VENDA: Omit<Venda, 'id' | 'created_at' | 'updated_at' | 'numero'> = {
  cliente_nome: '', status: 'orcamento', desconto: 0,
  observacoes: '', consumidor_final: false,
  data_entrega: '', data_venda: new Date().toISOString().split('T')[0],
  vendedor: '', palavra_chave: '', tipo: '', valor_total: 0, total: 0,
};

export function Vendas() {
  const { data: vendas = [], isLoading, criar, atualizar, atualizarStatus, deletar, isSaving } = useVendas();

  const [view, setView]           = useState<View>('lista');
  const [vendaId, setVendaId]     = useState<string | null>(null);
  const [form, setForm]           = useState({ ...NOVA_VENDA });
  const [itens, setItens]         = useState<VendaItem[]>([]);
  const [filtro, setFiltro]       = useState<Filtro>('todos');
  const [busca, setBusca]         = useState('');

  const isNovo = vendaId === '__novo__';

  // Carrega itens da venda ao abrir detalhe
  const { data: itensCarregados } = useVendaItens(isNovo ? null : vendaId);

  // Abre detalhe
  function abrirDetalhe(v: Venda | null) {
    if (v) {
      setVendaId(v.id);
      setForm({ ...NOVA_VENDA, ...v });
      setItens(itensCarregados ?? []);
    } else {
      setVendaId('__novo__');
      setForm({ ...NOVA_VENDA, data_venda: new Date().toISOString().split('T')[0] });
      setItens([]);
    }
    setView('detalhe');
  }

  // Sincroniza itens quando carregam do banco
  useMemo(() => {
    if (itensCarregados && !isNovo) setItens(itensCarregados);
  }, [itensCarregados, isNovo]);

  function fechar() { setView('lista'); setVendaId(null); setForm({ ...NOVA_VENDA }); setItens([]); }
  function setF(f: keyof typeof NOVA_VENDA, v: any) { setForm(p => ({ ...p, [f]: v })); }

  const totalItens = itens.reduce((s, i) => s + Number(i.total), 0);
  const descGlobal  = Number(form.desconto ?? 0);
  const totalFinal  = totalItens * (1 - descGlobal / 100);

  async function handleSalvar() {
    const payload = {
      ...form,
      valor_total: totalFinal,
      total:       totalFinal,
    };
    const { id: _id, created_at: _c, updated_at: _u, numero: _n, ...clean } = { id: '', created_at: '', updated_at: '', numero: 0, ...payload };

    if (isNovo) {
      await criar({ venda: clean as any, itens });
    } else if (vendaId) {
      await atualizar({ id: vendaId, payload: clean as any });
      // Re-salva itens: deleta e reinsere
      const { supabase } = await import('../lib/supabase');
      await supabase.from('venda_itens').delete().eq('venda_id', vendaId);
      if (itens.length > 0) {
        await supabase.from('venda_itens').insert(itens.map(i => ({ ...i, venda_id: vendaId })));
      }
    }
    fechar();
  }

  // KPIs
  const totalVendas = vendas.reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0);
  const emProducao  = vendas.filter(v => v.status === 'producao').length;
  const prontas     = vendas.filter(v => v.status === 'pronto').length;

  const filtradas = useMemo(() => vendas
    .filter(v => filtro === 'todos' || v.status === filtro)
    .filter(v =>
      !busca ||
      v.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
      (v.numero ? String(v.numero).includes(busca) : false) ||
      (v.palavra_chave ?? '').toLowerCase().includes(busca.toLowerCase())
    ), [vendas, filtro, busca]);

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Vendas...</div>;

  /* ────────── LISTA ────────── */
  if (view === 'lista') return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><ShoppingCart className="w-6 h-6 text-blue-400" /> Vendas</h1>
          <p className="text-gray-500 text-sm">{vendas.length} venda(s) no sistema</p>
        </div>
        <button onClick={() => abrirDetalhe(null)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30">
          + Nova Venda
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total vendido"  value={fmtBRL(totalVendas)} icon={DollarSign}    color="text-green-400" />
        <KpiCard label="Total de vendas" value={vendas.length}      icon={ClipboardList} color="text-blue-400" />
        <KpiCard label="Em produção"    value={emProducao}           icon={Factory}      color="text-yellow-400" />
        <KpiCard label="Prontas"        value={prontas}              icon={CheckCircle2} color="text-purple-400" />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
          {(['todos', 'orcamento', 'aprovado', 'producao', 'pronto', 'entregue', 'cancelado'] as Filtro[]).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                filtro === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {f === 'todos' ? 'Todos' : STATUS_VENDA[f as StatusVenda]?.label ?? f}
            </button>
          ))}
        </div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente, nº ou palavra-chave..."
          className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
      </div>

      {/* Tabela */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Nº</th>
              <th className="px-5 py-3 text-left">Cliente</th>
              <th className="px-5 py-3 text-left">Data</th>
              <th className="px-5 py-3 text-left">Entrega</th>
              <th className="px-5 py-3 text-right">Valor</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-600">Nenhuma venda encontrada.</td></tr>
            )}
            {filtradas.map(v => {
              const st = STATUS_VENDA[v.status] ?? STATUS_VENDA.orcamento;
              return (
                <tr key={v.id} onClick={() => abrirDetalhe(v)}
                  className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                    {v.numero ? `#${v.numero}` : '—'}
                  </td>
                  <td className="px-5 py-3 font-medium text-white">{v.cliente_nome || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(v.data_venda)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(v.data_entrega)}</td>
                  <td className="px-5 py-3 text-right font-bold text-white">
                    {fmtBRL(v.valor_total ?? v.total)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${st.cor}`}>{st.label}</span>
                  </td>
                  <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5 justify-center">
                      <button onClick={() => abrirDetalhe(v)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all">
                        Editar
                      </button>
                      <button onClick={() => { if (confirm('Remover esta venda?')) deletar(v.id); }}
                        className="flex items-center justify-center px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
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

  /* ────────── DETALHE ────────── */
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={fechar}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-white">
            {isNovo ? 'Nova Venda' : `Venda ${form.numero ? `#${form.numero}` : ''} — ${form.cliente_nome || 'Editar'}`}
          </h1>
          <p className="text-gray-500 text-sm">{isNovo ? 'Preencha os dados e salve' : 'Edite e salve as alterações'}</p>
        </div>
        {!isNovo && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Status:</span>
            <select
              value={form.status}
              onChange={e => { setF('status', e.target.value); atualizarStatus({ id: vendaId!, status: e.target.value as StatusVenda }); }}
              className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {Object.entries(STATUS_VENDA).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        )}
        <button onClick={handleSalvar} disabled={isSaving || !form.cliente_nome.trim()}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="xl:col-span-2 space-y-5">

          {/* Dados do cliente */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Dados da Venda</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Cliente *</label>
                <input value={form.cliente_nome} onChange={e => setF('cliente_nome', e.target.value)}
                  className={IN} placeholder="Nome do cliente" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Data da Venda</label>
                <input type="date" value={form.data_venda ?? ''} onChange={e => setF('data_venda', e.target.value)} className={IN} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Data de Entrega</label>
                <input type="date" value={form.data_entrega ?? ''} onChange={e => setF('data_entrega', e.target.value)} className={IN} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Vendedor</label>
                <input value={form.vendedor ?? ''} onChange={e => setF('vendedor', e.target.value)} className={IN} placeholder="Nome do vendedor" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Palavra-chave</label>
                <input value={form.palavra_chave ?? ''} onChange={e => setF('palavra_chave', e.target.value)} className={IN} placeholder="Tag para busca" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Observações</label>
                <textarea rows={2} value={form.observacoes ?? ''} onChange={e => setF('observacoes', e.target.value)}
                  className={IN + ' resize-none'} placeholder="Observações internas..." />
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Itens da Venda</h3>
            <ItensEditor itens={itens} onChange={setItens} />
          </div>
        </div>

        {/* Coluna lateral — Resumo */}
        <div className="space-y-4">
          <div className="bg-[#1f2937] border-t-2 border-green-500 border-x border-b border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Resumo</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="font-bold text-white">{fmtBRL(totalItens)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Desconto global (%)</span>
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={form.desconto ?? 0}
                  onChange={e => setF('desconto', parseFloat(e.target.value) || 0)}
                  className="w-20 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-blue-500"
                />
              </div>
              {descGlobal > 0 && (
                <div className="flex justify-between text-xs text-red-400">
                  <span>Desconto</span>
                  <span>-{fmtBRL(totalItens * descGlobal / 100)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-700 flex justify-between items-center">
                <span className="font-bold text-white">Total</span>
                <span className="text-2xl font-black text-green-400">{fmtBRL(totalFinal)}</span>
              </div>
            </div>
          </div>

          {!isNovo && (
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> Status</h3>
              <div className="space-y-1.5">
                {Object.entries(STATUS_VENDA).map(([k, v]) => (
                  <button key={k} onClick={() => { setF('status', k); atualizarStatus({ id: vendaId!, status: k as StatusVenda }); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      form.status === k ? v.cor + ' opacity-100' : 'border-gray-700 text-gray-500 hover:text-white hover:bg-gray-700/30'
                    }`}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
