// src/pages/Estoque/Gerenciar.tsx
import { useState, useMemo } from 'react';
import { useMateriasPrimas } from '../../hooks/useEstoque';
import { MateriaPrima } from '../../types/estoque';
import { ModalMP } from '../../components/estoque/ModalMP';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { PackageSearch, Plus } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Gerenciar() {
  const { data: mps = [], isLoading, criar, atualizar, deletar } = useMateriasPrimas();
  const { confirmar, ConfirmModal } = useConfirm();

  const [busca, setBusca]       = useState('');
  const [modalMP, setModalMP]   = useState(false);
  const [editando, setEditando] = useState<MateriaPrima | null>(null);

  const filtradas = useMemo(() =>
    mps.filter(m =>
      !busca ||
      m.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (m.categoria ?? '').toLowerCase().includes(busca.toLowerCase())
    ), [mps, busca]);

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <PackageSearch className="w-6 h-6 text-blue-400" /> Entradas e Saídas
            </h1>
            <p className="text-gray-500 text-sm">{mps.length} matéria(s)-prima(s) cadastrada(s)</p>
          </div>
          <button
            onClick={() => { setEditando(null); setModalMP(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Matéria-Prima
          </button>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou categoria..."
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Categoria</th>
                <th className="px-5 py-3 text-center">Unidade</th>
                <th className="px-5 py-3 text-right">Custo/un</th>
                <th className="px-5 py-3 text-right">Saldo atual</th>
                <th className="px-5 py-3 text-right">Estoque mín.</th>
                <th className="px-5 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-600">Nenhuma matéria-prima cadastrada.</td></tr>
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
                    {Number(mp.saldo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {mp.unidade}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500 text-xs">
                    {mp.estoque_minimo ? `${mp.estoque_minimo} ${mp.unidade}` : '—'}
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
                        onClick={async () => {
                          if (await confirmar(`Remover "${mp.nome}"? Esta ação não pode ser desfeita.`, 'Remover Matéria-Prima'))
                            deletar(mp.id);
                        }}
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
      </div>

      <ModalMP
        open={modalMP}
        editando={editando}
        onClose={() => { setModalMP(false); setEditando(null); }}
        onSalvar={dados => editando ? atualizar({ id: editando.id, dados }) : criar(dados)}
      />
    </>
  );
}
