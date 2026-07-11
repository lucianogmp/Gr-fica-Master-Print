// src/pages/Estoque/EstoqueAtual.tsx
import { useState, useMemo } from 'react';
import { useMateriasPrimas, useMovimentos } from '../../hooks/useEstoque';
import { MateriaPrima, statusEstoque } from '../../types/estoque';
import { KpiCard } from '../../components/ui/KpiCard';
import { ModalMP } from '../../components/estoque/ModalMP';
import { ModalMov } from '../../components/estoque/ModalMov';
import { Warehouse, Package, AlertTriangle, AlertCircle, DollarSign, Plus } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function EstoqueAtual() {
  const { data: mps = [], isLoading, criar, atualizar } = useMateriasPrimas();
  const { registrar, isRegistrando } = useMovimentos();

  const [busca, setBusca]       = useState('');
  const [modalMP, setModalMP]   = useState(false);
  const [movTipo, setMovTipo]   = useState<'entrada' | 'saida'>('entrada');
  const [movMP, setMovMP]       = useState<MateriaPrima | null>(null);

  const filtradas = useMemo(() =>
    mps.filter(m =>
      !busca ||
      m.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (m.categoria ?? '').toLowerCase().includes(busca.toLowerCase())
    ), [mps, busca]);

  const zerados    = mps.filter(m => Number(m.saldo) <= 0).length;
  const baixos     = mps.filter(m => statusEstoque(m).key === 'baixo').length;
  const valorTotal = mps.reduce((s, m) => s + Number(m.custo_unitario) * Number(m.saldo), 0);

  function abrirMov(mp: MateriaPrima, tipo: 'entrada' | 'saida') {
    setMovMP(mp);
    setMovTipo(tipo);
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Estoque...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-blue-400" /> Estoque Atual
          </h1>
          <p className="text-gray-500 text-sm">Saldo de matérias-primas e insumos</p>
        </div>
        {/* Botão nova matéria-prima aqui também conforme solicitado */}
        <button
          onClick={() => setModalMP(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nova Matéria-Prima
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total cadastradas" value={mps.length}        icon={Package}       color="text-blue-400" />
        <KpiCard label="Estoque baixo"     value={baixos}            icon={AlertTriangle} color="text-yellow-400" />
        <KpiCard label="Zeradas"           value={zerados}           icon={AlertCircle}   color="text-red-400" />
        <KpiCard label="Valor em estoque"  value={fmtBRL(valorTotal)} icon={DollarSign}   color="text-green-400" />
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou categoria..."
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="overflow-x-auto">
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
                    {mp.estoque_minimo ? `${mp.estoque_minimo} ${mp.unidade}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400 text-xs">{fmtBRL(mp.custo_unitario)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold border"
                      style={{ color: st.cor, borderColor: st.cor + '40', backgroundColor: st.cor + '15' }}>
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
      </div>

      <ModalMP
        open={modalMP}
        editando={null}
        onClose={() => setModalMP(false)}
        onSalvar={dados => criar(dados)}
      />

      <ModalMov
        open={!!movMP}
        tipo={movTipo}
        materia={movMP}
        onClose={() => setMovMP(null)}
        onConfirmar={registrar}
      />
    </div>
  );
}
