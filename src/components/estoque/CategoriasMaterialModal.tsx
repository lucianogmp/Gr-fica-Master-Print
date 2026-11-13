import { useState } from 'react';
import { Plus, Tags } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmModal';
import { useCategorias } from '../../hooks/useCategorias';

const IN = 'bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors';

/** Gerencia a lista de categorias das MATÉRIAS-PRIMAS (independente das categorias dos produtos). */
export function CategoriasMaterialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: categorias = [], criar, atualizar, deletar } = useCategorias('material');
  const { confirmar, ConfirmModal } = useConfirm();
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try { await criar(nome.trim()); setNome(''); } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  return (
    <>
      <ConfirmModal />
      <Modal open={open} onClose={onClose} maxWidth="460px"
        title={<span className="flex items-center gap-1.5"><Tags className="w-4 h-4 text-blue-400" /> Categorias de matérias-primas</span>}>
        <p className="text-[11px] text-gray-500 mb-3">Lista só do estoque — não mistura com as categorias dos produtos. Ao renomear, as matérias-primas acompanham.</p>
        <div className="flex gap-2 mb-3">
          <input value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') adicionar(); }}
            className={`${IN} flex-1`} placeholder="Nova categoria (ex: Papel, Ilhós...)" />
          <button onClick={adicionar} disabled={salvando || !nome.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 rounded-lg text-sm font-bold flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-800 border border-gray-700 rounded-lg">
          {categorias.length === 0 && <p className="px-3 py-6 text-center text-gray-600 text-sm">Nenhuma categoria.</p>}
          {categorias.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-2 py-1.5">
              <input defaultValue={c.nome}
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (v && v !== c.nome) atualizar({ id: c.id, nome: v, nomeAnterior: c.nome });
                  else e.target.value = c.nome;
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="flex-1 bg-transparent border border-transparent hover:border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500" />
              <button onClick={async () => { if (await confirmar(`Remover "${c.nome}"? As matérias-primas que usam esse nome continuam com ele, mas a categoria sai da lista.`, 'Remover categoria')) deletar(c.id); }}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30">Excluir</button>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
