// src/pages/CRM/HistoricoAtendimento.tsx  →  "Histórico de Clientes"
//
// Montado sozinho a partir do que o sistema já sabe (vendas e orçamentos) — nada de
// registrar contato à mão. Serve pra responder: quem compra, quanto, quando foi a última
// vez, quem está sumido (hora de chamar de volta) e o que cada cliente já fez com a gente.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes } from '../../hooks/useClientes';
import { useVendas } from '../../hooks/useVendas';
import { useOrcamentos } from '../../hooks/useOrcamentos';
import { STATUS_VENDA } from '../../types/venda';
import { History, Search, ChevronDown, ChevronRight, ShoppingBag, FileText, ExternalLink } from 'lucide-react';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const DIA = 86_400_000;

type Situacao = 'ativo' | 'esfriando' | 'inativo' | 'nunca';
const SIT: Record<Situacao, { label: string; cor: string }> = {
  ativo:     { label: 'Ativo',          cor: 'bg-green-500/15 text-green-400 border-green-500/30' },
  esfriando: { label: 'Esfriando',      cor: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  inativo:   { label: 'Sumido',         cor: 'bg-red-500/15 text-red-400 border-red-500/30' },
  nunca:     { label: 'Nunca comprou',  cor: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

export function HistoricoAtendimento() {
  const navigate = useNavigate();
  const { data: clientes = [], isLoading: l1 } = useClientes();
  const { data: vendas = [], isLoading: l2 } = useVendas();
  const { data: orcamentos = [], isLoading: l3 } = useOrcamentos();

  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'' | Situacao>('');
  const [ordem, setOrdem] = useState<'recente' | 'gasto' | 'pedidos' | 'nome'>('recente');
  const [aberto, setAberto] = useState<string | null>(null);

  const linhas = useMemo(() => {
    const agora = Date.now();
    return clientes.map(c => {
      const vs = vendas.filter(v => v.status !== 'cancelado' && (v.cliente_id === c.id));
      const os = orcamentos.filter(o => (o as any).cliente_id === c.id);
      const total = vs.reduce((s, v) => s + Number(v.valor_total ?? v.total ?? 0), 0);
      const ultima = vs.map(v => v.data_venda ?? '').filter(Boolean).sort().pop() ?? null;
      const dias = ultima ? Math.floor((agora - new Date(ultima.slice(0, 10) + 'T00:00:00').getTime()) / DIA) : null;
      const sit: Situacao = dias == null ? 'nunca' : dias <= 60 ? 'ativo' : dias <= 120 ? 'esfriando' : 'inativo';
      return { c, vs, os, total, ultima, dias, sit, ticket: vs.length ? total / vs.length : 0 };
    });
  }, [clientes, vendas, orcamentos]);

  const resumo = useMemo(() => ({
    ativos: linhas.filter(l => l.sit === 'ativo').length,
    esfriando: linhas.filter(l => l.sit === 'esfriando').length,
    inativos: linhas.filter(l => l.sit === 'inativo').length,
    nunca: linhas.filter(l => l.sit === 'nunca').length,
  }), [linhas]);

  const lista = useMemo(() => {
    const f = linhas
      .filter(l => !filtro || l.sit === filtro)
      .filter(l => correspondeABuscaEmCampos([l.c.nome, l.c.telefone, l.c.email], busca));
    const cmp: Record<typeof ordem, (a: typeof f[0], b: typeof f[0]) => number> = {
      recente: (a, b) => (b.ultima ?? '').localeCompare(a.ultima ?? ''),
      gasto:   (a, b) => b.total - a.total,
      pedidos: (a, b) => b.vs.length - a.vs.length,
      nome:    (a, b) => a.c.nome.localeCompare(b.c.nome, 'pt-BR'),
    };
    return [...f].sort(cmp[ordem]);
  }, [linhas, filtro, busca, ordem]);

  if (l1 || l2 || l3) return <div className="p-6"><TableSkeleton rows={8} cols={6} /></div>;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <History className="w-6 h-6 text-blue-400" /> Histórico de Clientes
        </h1>
        <p className="text-gray-500 text-sm">Montado automaticamente com as vendas e orçamentos de cada cliente.</p>
      </div>

      {/* Situação da carteira — clique pra filtrar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([['ativo', resumo.ativos, 'comprou nos últimos 60 dias'], ['esfriando', resumo.esfriando, 'última compra entre 60 e 120 dias'],
           ['inativo', resumo.inativos, 'sem comprar há mais de 120 dias'], ['nunca', resumo.nunca, 'cadastrados sem nenhuma venda']] as [Situacao, number, string][]).map(([k, n, dica]) => (
          <button key={k} type="button" onClick={() => setFiltro(f => f === k ? '' : k)} title={dica}
            className={`text-left bg-[#1f2937] border rounded-xl px-4 py-3 transition-colors ${filtro === k ? 'border-blue-500' : 'border-gray-700 hover:border-gray-500'}`}>
            <p className="text-[10px] font-bold uppercase text-gray-400">{SIT[k].label}</p>
            <p className="text-2xl font-black text-white">{n}</p>
            <p className="text-[10px] text-gray-500 truncate">{dica}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-[#1f2937] border border-gray-700 rounded-xl px-3 py-2 focus-within:border-blue-500">
          <Search className="w-4 h-4 text-gray-500" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente por nome, telefone ou e-mail"
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none" />
        </div>
        <div className="w-full sm:w-56">
          <DarkSelect value={ordem} onChange={v => setOrdem(v as typeof ordem)}
            options={[{ value: 'recente', label: 'Última compra' }, { value: 'gasto', label: 'Mais gastou' },
              { value: 'pedidos', label: 'Mais pedidos' }, { value: 'nome', label: 'Nome (A → Z)' }]} />
        </div>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-center">Situação</th>
                <th className="px-4 py-3 text-center">Última compra</th>
                <th className="px-4 py-3 text-center">Pedidos</th>
                <th className="px-4 py-3 text-right">Total gasto</th>
                <th className="px-4 py-3 text-right">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhum cliente encontrado.</td></tr>
              )}
              {lista.map(l => {
                const exp = aberto === l.c.id;
                const eventos = [
                  ...l.vs.map(v => ({ k: 'v' as const, id: v.id, data: v.data_venda ?? '', num: v.numero, titulo: v.tipo || 'Venda',
                    valor: Number(v.valor_total ?? v.total ?? 0), status: STATUS_VENDA[v.status]?.label ?? v.status })),
                  ...l.os.map(o => ({ k: 'o' as const, id: o.id, data: (o.created_at ?? '').slice(0, 10), num: o.numero, titulo: (o as any).tipo || 'Orçamento',
                    valor: Number((o as any).total ?? 0), status: o.status })),
                ].sort((a, b) => b.data.localeCompare(a.data));
                return (
                  <>
                    <tr key={l.c.id} onClick={() => setAberto(exp ? null : l.c.id)}
                      className="border-b border-gray-700/50 hover:bg-gray-800/30 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {exp ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                          <div>
                            <p className="font-bold text-white">{l.c.nome}</p>
                            {l.c.telefone && <p className="text-[11px] text-gray-500">{l.c.telefone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SIT[l.sit].cor}`}>{SIT[l.sit].label}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300 text-xs">
                        {fmtData(l.ultima)}{l.dias != null && <span className="text-gray-600"> · há {l.dias}d</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300">{l.vs.length}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-400">{l.total ? fmtBRL(l.total) : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{l.ticket ? fmtBRL(l.ticket) : '—'}</td>
                    </tr>
                    {exp && (
                      <tr key={l.c.id + '-det'} className="bg-gray-900/40 border-b border-gray-700/50">
                        <td colSpan={6} className="px-6 py-3">
                          {eventos.length === 0 ? (
                            <p className="text-xs text-gray-500">Nenhuma venda ou orçamento para este cliente ainda.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {eventos.slice(0, 30).map(ev => (
                                <div key={ev.k + ev.id} className="flex items-center gap-3 text-xs">
                                  {ev.k === 'v' ? <ShoppingBag className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                                  <span className="text-gray-500 w-20 flex-shrink-0">{fmtData(ev.data)}</span>
                                  <span className="text-gray-400 w-24 flex-shrink-0">{ev.k === 'v' ? 'Venda' : 'Orçamento'}{ev.num ? ` #${ev.num}` : ''}</span>
                                  <span className="text-white font-semibold truncate flex-1">{ev.titulo}</span>
                                  <span className="text-gray-500 hidden sm:inline">{ev.status}</span>
                                  <span className="text-gray-200 font-bold w-24 text-right flex-shrink-0">{ev.valor ? fmtBRL(ev.valor) : '—'}</span>
                                  <button title="Abrir" onClick={e => { e.stopPropagation(); navigate(ev.k === 'v' ? `/vendas/nova/${ev.id}` : `/orcamentos?abrir=${ev.id}`); }}
                                    className="text-gray-500 hover:text-blue-400"><ExternalLink className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                              {eventos.length > 30 && <p className="text-[11px] text-gray-600">Mostrando os 30 mais recentes de {eventos.length}.</p>}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
