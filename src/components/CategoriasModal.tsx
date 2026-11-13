import { useState } from 'react';
import { Plus, Tags, Pencil, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from './ui/Modal';
import { useConfirm } from './ui/ConfirmModal';
import { useCategorias, TipoCategoria } from '../hooks/useCategorias';

const IN = 'bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors';

const TEXTOS: Record<TipoCategoria, { titulo: string; dica: string; exemplo: string }> = {
  produto:  { titulo: 'Categorias de produtos',        dica: 'Lista só do catálogo — não mistura com as categorias das matérias-primas.', exemplo: 'Nova categoria (ex: Cartão de Visita...)' },
  material: { titulo: 'Categorias de matérias-primas', dica: 'Lista só do estoque — não mistura com as categorias dos produtos. Ao renomear, as matérias-primas acompanham.', exemplo: 'Nova categoria (ex: Papel, Ilhós...)' },
};

/** Janela padrão para gerenciar categorias (criar, editar o nome e excluir). Usada no Catálogo e no Estoque. */
export function CategoriasModal({ tipo, open, onClose }: { tipo: TipoCategoria; open: boolean; onClose: () => void }) {
  const { data: categorias = [], criar, atualizar, deletar } = useCategorias(tipo);
  const { confirmar, ConfirmModal } = useConfirm();
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const t = TEXTOS[tipo];

  async function adicionar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try { await criar(nome.trim()); setNome(''); } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  async function salvarEdicao(c: { id: string; nome: string }) {
    const v = editNome.trim();
    setEditId(null);
    if (v && v !== c.nome) {
      try { await atualizar({ id: c.id, nome: v, nomeAnterior: c.nome }); } catch (e: any) { toast.error(e.message); }
    }
  }

  return (
    <>
      <ConfirmModal />
      <Modal open={open} onClose={onClose} maxWidth="460px"
        title={<span className="flex items-center gap-1.5"><Tags className="w-4 h-4 text-blue-400" /> {t.titulo}</span>}>
        <p className="text-[11px] text-gray-500 mb-3">{t.dica}</p>
        <div className="flex gap-2 mb-3">
          <input value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') adicionar(); }}
            className={`${IN} flex-1`} placeholder={t.exemplo} />
          <button onClick={adicionar} disabled={salvando || !nome.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 rounded-lg text-sm font-bold flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-800 border border-gray-700 rounded-lg">
          {categorias.length === 0 && <p className="px-3 py-6 text-center text-gray-600 text-sm">Nenhuma categoria.</p>}
          {categorias.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 min-h-[40px]">
              {editId === c.id ? (
                <>
                  <input autoFocus value={editNome} onChange={e => setEditNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(c); if (e.key === 'Escape') setEditId(null); }}
                    className={`${IN} flex-1 py-1`} />
                  <button onClick={() => salvarEdicao(c)} title="Salvar" className="text-green-400 hover:text-green-300 p-1"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditId(null)} title="Cancelar" className="text-gray-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-white truncate">{c.nome}</span>
                  <button onClick={() => { setEditId(c.id); setEditNome(c.nome); }} title="Editar nome"
                    className="text-gray-500 hover:text-blue-400 p-1"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={async () => { if (await confirmar(`Remover "${c.nome}"? Quem já usa esse nome continua com ele, mas a categoria sai da lista.`, 'Remover categoria')) deletar(c.id); }}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30">Excluir</button>
                </>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
