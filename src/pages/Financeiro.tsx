import { useState, useMemo } from 'react';
import { useLancamentos } from '../hooks/useLancamentos';
import { Lancamento } from '../types/financeiro';
import { ModalLancamento } from '../components/financeiro/ModalLancamento';
import { KpiCard } from '../components/ui/KpiCard';

type Filtro = 'todos' | 'receita' | 'despesa' | 'pendente' | 'atrasado';

const STATUS_COR: Record<string, string> = {
  pago:      'bg-green-500/15 text-green-400 border-green-500/30',
  pendente:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  atrasado:  'bg-red-500/15 text-red-400 border-red-500/30',
  cancelado: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

function calcStatus(l: Lancamento): string {
  if (l.status === 'pago' || l.status === 'cancelado') return l.status;
  if (l.data_vencimento && new Date(l.data_vencimento + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0))) return 'atrasado';
  return l.status;
}

export function Financeiro() {
  const { data: lancamentos = [], isLoading, criar, atualizar, pagar, deletar, isSaving } = useLancamentos();
  const [modalOpen, setModalOpen]   = useState(false);
  const [editando, setEditando]     = useState<Lancamento | null>(null);
  const [tipoInicial, setTipoInicial] = useState<'receita' | 'despesa'>('despesa');
  const [filtro, setFiltro]         = useState<Filtro>('todos');
  const [busca, setBusca]           = useState('');
  const [mes, setMes]               = useState(() => new Date().toISOString().slice(0, 7));

  // KPIs do mês
  const doMes = useMemo(() => lancamentos.filter(l => {
    const d = l.data_vencimento ?? l.created_at ?? '';
    return d.startsWith(mes);
  }), [lancamentos, mes]);

  const totalReceitas  = doMes.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas  = doMes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
  const aReceber       = lancamentos.filter(l => l.tipo === 'receita' && l.status !== 'pago' && l.status !== 'cancelado').reduce((s, l) => s + Number(l.valor), 0);
  const aPagar         = lancamentos.filter(l => l.tipo === 'despesa' && l.status !== 'pago' && l.status !== 'cancelado').reduce((s, l) => s + Number(l.valor), 0);

  const filtrados = useMemo(() => {
    return lancamentos
      .map(l => ({ ...l, statusCalc: calcStatus(l) }))
      .filter(l => {
        if (filtro === 'receita')  return l.tipo === 'receita';
        if (filtro === 'despesa')  return l.tipo === 'despesa';
        if (filtro === 'pendente') return l.statusCalc === 'pendente';
        if (filtro === 'atrasado') return l.statusCalc === 'atrasado';
        return true;
      })
      .filter(l =>
        !busca ||
        l.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        (l.cliente_nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.categoria ?? '').toLowerCase().includes(busca.toLowerCase())
      );
  }, [lancamentos, filtro, busca]);

  function abrirNovo(tipo: 'receita' | 'despesa') {
    setEditando(null); setTipoInicial(tipo); setModalOpen(true);
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Financeiro...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">🏦 Financeiro</h1>
          <p className="text-gray-500 text-sm">Contas a pagar e receber</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => abrirNovo('receita')}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
            + Receita
          </button>
          <button onClick={() => abrirNovo('despesa')}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
            + Despesa
          </button>
        </div>
      </div>

      {/* Seletor de mês + KPIs */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
        <span className="text-gray-600 text-xs">— KPIs do mês selecionado</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Receitas do mês"  value={fmtBRL(totalReceitas)} icon="↑" color="text-green-400" />
        <KpiCard label="Despesas do mês"  value={fmtBRL(totalDespesas)} icon="↓" color="text-red-400" />
        <KpiCard label="A receber (total)" value={fmtBRL(aReceber)}     icon="⏳" color="text-blue-400" />
        <KpiCard label="A pagar (total)"   value={fmtBRL(aPagar)}       icon="💸" color="text-yellow-400" />
      </div>

      {/* Filtros + busca */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1">
          {([
            { key: 'todos',    label: 'Todos' },
            { key: 'receita',  label: '↑ Receitas' },
            { key: 'despesa',  label: '↓ Despesas' },
            { key: 'pendente', label: '⏳ Pendentes' },
            { key: 'atrasado', label: '🚨 Atrasados' },
          ] as { key: Filtro; label: string }[]).map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filtro === f.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar..."
          className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
      </div>

      {/* Tabela */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Descrição</th>
              <th className="px-5 py-3 text-left">Categoria</th>
              <th className="px-5 py-3 text-left">Cliente / Forn.</th>
              <th className="px-5 py-3 text-right">Valor</th>
              <th className="px-5 py-3 text-center">Vencimento</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-600">Nenhum lançamento encontrado.</td></tr>
            )}
            {filtrados.map(l => {
              const st = l.statusCalc;
              return (
                <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={l.tipo === 'receita' ? 'text-green-400 font-black' : 'text-red-400 font-black'}>
                        {l.tipo === 'receita' ? '↑' : '↓'}
                      </span>
                      <span className="font-medium text-white">{l.descricao}</span>
                      {l.parcela_num && l.total_parcelas && (
                        <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">
                          {l.parcela_num}/{l.total_parcelas}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{l.categoria || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{l.cliente_nome || '—'}</td>
                  <td className={`px-5 py-3 text-right font-black ${l.tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtBRL(Number(l.valor))}
                  </td>
                  <td className="px-5 py-3 text-center text-xs text-gray-400">{fmtData(l.data_vencimento)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_COR[st] ?? STATUS_COR.pendente}`}>
                      {st}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      {st !== 'pago' && st !== 'cancelado' && (
                        <button onClick={() => pagar({ id: l.id })}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/30 transition-all">
                          ✓ Pagar
                        </button>
                      )}
                      <button onClick={() => { setEditando(l); setModalOpen(true); }}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all">
                        Editar
                      </button>
                      <button onClick={() => { if (confirm('Remover?')) deletar(l.id); }}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ModalLancamento
        open={modalOpen}
        editando={editando}
        tipoInicial={tipoInicial}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        onSalvar={dados => editando ? atualizar({ id: editando.id, payload: dados }) : criar(dados)}
      />
    </div>
  );
}
