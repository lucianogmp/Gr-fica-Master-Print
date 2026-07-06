// src/pages/Produtos/Categorias.tsx
// Extraído da view 'categorias' do Produtos.tsx original.
import { useState } from 'react';
import { useCategorias } from '../../hooks/useCategorias';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { Tags, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function Categorias() {
  const { data: categorias = [], criar, atualizar: atualizarCat, deletar: deletarCat } = useCategorias();
  const { confirmar, ConfirmModal } = useConfirm();
  const [nome, setNome]           = useState('');
  const [salvando, setSalvando]   = useState(false);

  async function handleSalvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await criar.mutateAsync(nome.trim());
      setNome('');
    } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Tags className="w-6 h-6 text-blue-400" /> Categorias
          </h1>
          <p className="text-gray-500 text-sm">{categorias.length} categoria(s) cadastrada(s)</p>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nova Categoria
          </h3>
          <div className="flex gap-3">
            <input value={nome} onChange={e => setNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSalvar(); }}
              className={IN} placeholder="Ex: Papel, Impressão, Adesivo..." />
            <button onClick={handleSalvar} disabled={salvando || !nome.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0">
              {salvando ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Nome (clique para editar)</th>
                <th className="px-5 py-3 text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categorias.length === 0 && (
                <tr><td colSpan={2} className="px-5 py-12 text-center text-gray-600">Nenhuma categoria cadastrada.</td></tr>
              )}
              {categorias.map(c => (
                <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="px-5 py-3 font-medium text-white">
                    <input
                      defaultValue={c.nome}
                      onBlur={e => {
                        const val = e.target.value.trim();
                        if (val && val !== c.nome) atualizarCat({ id: c.id, nome: val });
                        else e.target.value = c.nome;
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="bg-transparent border border-transparent hover:border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-white w-full max-w-sm transition-colors"
                    />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={async () => {
                        if (await confirmar(`Remover "${c.nome}"? Pode causar erros se já estiver em uso.`, 'Remover Categoria'))
                          deletarCat(c.id);
                      }}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
