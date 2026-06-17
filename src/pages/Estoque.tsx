import { useState, useMemo } from 'react';
import { useMateriasPrimas, useMovimentos } from '../hooks/useEstoque';
import { MateriaPrima, statusEstoque } from '../types/estoque';
import { KpiCard } from '../components/ui/KpiCard';
import { ModalMP } from '../components/estoque/ModalMP';
import { ModalMov } from '../components/estoque/ModalMov';
import { useConfirm } from '../components/ui/ConfirmModal';
import {
  Warehouse, Package, AlertTriangle, AlertCircle, DollarSign,
  BarChart3, Settings, ClipboardList, ArrowUp, ArrowDown, type LucideIcon,
} from 'lucide-react';

type Aba = 'saldo' | 'gerenciar' | 'historico';

export function Estoque() {
  const { data: mps = [], isLoading, criar, atualizar, deletar } = useMateriasPrimas();
  const { data: movimentos = [], registrar, isRegistrando } = useMovimentos();
  const { confirmar, ConfirmModal } = useConfirm();

  const [aba, setAba]             = useState<Aba>('saldo');
  const [busca, setBusca]         = useState('');
  const [modalMP, setModalMP]     = useState(false);
  const [editando, setEditando]   = useState<MateriaPrima | null>(null);
  const [movTipo, setMovTipo]     = useState<'entrada' | 'saida'>('entrada');
  const [movMP, setMovMP]         = useState<MateriaPrima | null>(null);
  const [filtroMov, setFiltroMov] = useState('');

  const filtradas = useMemo(() =>
    mps.filter(m => !busca || m.nome.toLowerCase().includes(busca.toLowerCase()) || (m.categoria ?? '').toLowerCase().includes(busca.toLowerCase())),
    [mps, busca]
  );

  const movFiltrados = useMemo(() =>
    movimentos.filter(m =>
      !filtroMov ||
      m.materias_primas?.nome.toLowerCase().includes(filtroMov.toLowerCase()) ||
      m.motivo?.toLowerCase().includes(filtroMov.toLowerCase())
    ),
    [movimentos, filtroMov]
  );

  // KPIs
  const total   = mps.length;
  const zerados = mps.filter(m => Number(m.saldo) <= 0).length;
  const baixos  = mps.filter(m => { const s = statusEstoque(m); return s.key === 'baixo'; }).length;
  const valorTotal = mps.reduce((s, m) => s + Number(m.custo_unitario) * Number(m.saldo), 0);

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function abrirMov(mp: MateriaPrima, tipo: 'entrada' | 'saida') {
    setMovMP(mp); setMovTipo(tipo);
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Estoque...</div>;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Warehouse className="w-6 h-6 text-blue-400" /> Estoque</h1>
          <p className="text-gray-500 text-sm">Controle de matérias-primas e insumos</p>
        </div>
        {aba === 'gerenciar' && (
          <button
            onClick={() => { setEditando(null); setModalMP(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30"
          >
            + Nova Matéria-Prima
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total cadastradas"  value={total}        icon={Package}       color="text-blue-400" />
        <KpiCard label="Estoque baixo"      value={baixos}       icon={AlertTriangle} color="text-yellow-400" />
        <KpiCard label="Zeradas"            value={zerados}      icon={AlertCircle}   color="text-red-400" />
        <KpiCard label="Valor em estoque"   value={fmtBRL(valorTotal)} icon={DollarSign} color="text-green-400" />
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 w-fit">
        {([
          { key: 'saldo',    label: 'Saldo Atual', icon: BarChart3 },
          { key: 'gerenciar',label: 'Gerenciar',   icon: Settings },
          { key: 'historico',label: 'Histórico',   icon: ClipboardList },
        ] as { key: Aba; label: string; icon: LucideIcon }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setAba(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              aba === t.key ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ─── ABA: SALDO ─── */}
      {aba === 'saldo' && (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Matéria-Prima</th>
                <th className="px-5 py-3 text-left">Categoria</th>
                <th className="px-5 py-3 text-right">Saldo</th>
                <th className="px-5 py-3 text-right">Mínimo</th>
                <th className="px-5 py-3 text-right">Custo/un</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Movimentar</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-600">Nenhuma matéria-prima encontrada.</td></tr>
              )}
              {filtradas.map(mp => {
                const st = statusEstoque(mp);
                return (
                  <tr key={mp.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-white">{mp.nome}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{mp.categoria || '—'}</td>
                    <td className="px-5 py-3 text-right font-bold text-white">
                      {Number(mp.saldo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {mp.unidade}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs">
                      {mp.estoque_minimo || '—'} {mp.estoque_minimo ? mp.unidade : ''}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400 text-xs">{fmtBRL(mp.custo_unitario)}</td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className="px-2 py-1 rounded-full text-[10px] font-bold border"
                        style={{ color: st.cor, borderColor: st.cor + '40', backgroundColor: st.cor + '15' }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => abrirMov(mp, 'entrada')}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/30 transition-all">
                          +Entrada
                        </button>
                        <button onClick={() => abrirMov(mp, 'saida')}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">
                          −Saída
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── ABA: GERENCIAR ─── */}
      {aba === 'gerenciar' && (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Categoria</th>
                <th className="px-5 py-3 text-center">Unidade</th>
                <th className="px-5 py-3 text-right">Custo/un</th>
                <th className="px-5 py-3 text-right">Saldo</th>
                <th className="px-5 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhuma matéria-prima cadastrada.</td></tr>
              )}
              {filtradas.map(mp => (
                <tr key={mp.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{mp.nome}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{mp.categoria || '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="text-[10px] font-bold bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{mp.unidade}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">{fmtBRL(mp.custo_unitario)}</td>
                  <td className="px-5 py-3 text-right font-bold text-white">
                    {Number(mp.saldo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => { setEditando(mp); setModalMP(true); }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => { if (await confirmar(`Remover "${mp.nome}"?`)) deletar(mp.id); }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── ABA: HISTÓRICO ─── */}
      {aba === 'historico' && (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <input value={filtroMov} onChange={e => setFiltroMov(e.target.value)} placeholder="Filtrar por matéria-prima ou motivo..."
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Data</th>
                <th className="px-5 py-3 text-left">Matéria-Prima</th>
                <th className="px-5 py-3 text-center">Tipo</th>
                <th className="px-5 py-3 text-right">Quantidade</th>
                <th className="px-5 py-3 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movFiltrados.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-600">Nenhum movimento registrado.</td></tr>
              )}
              {movFiltrados.map(m => (
                <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-5 py-3 font-medium text-white">{m.materias_primas?.nome ?? '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                      m.tipo === 'entrada'
                        ? 'bg-green-500/15 text-green-400 border-green-500/30'
                        : 'bg-red-500/15 text-red-400 border-red-500/30'
                    }`}>
                      <span className="inline-flex items-center gap-1">
                        {m.tipo === 'entrada' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-white">
                    {Number(m.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {m.materias_primas?.unidade ?? ''}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{m.motivo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais */}
      <ModalMP
        open={modalMP}
        editando={editando}
        onClose={() => { setModalMP(false); setEditando(null); }}
        onSalvar={dados => editando ? atualizar({ id: editando.id, dados }) : criar(dados)}
      />

      <ModalMov
        open={!!movMP}
        tipo={movTipo}
        materia={movMP}
        onClose={() => setMovMP(null)}
        onConfirmar={registrar}
      />
      <ConfirmModal />
    </div>
  );
}
