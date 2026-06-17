import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { MateriaPrima } from '../../types/estoque';
import { Pencil, Plus } from 'lucide-react';
import { useCategorias } from '../../hooks/useCategorias';
import toast from 'react-hot-toast';

const UNIDADES = ['un', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'folha', 'rolo', 'caixa', 'resma', 'par'];

type FormData = {
  nome: string;
  categoria: string;
  unidade: string;
  custo_unitario: string;
  estoque_minimo: string;
  saldo_inicial: string;
};

const EMPTY: FormData = { nome: '', categoria: '', unidade: 'un', custo_unitario: '', estoque_minimo: '', saldo_inicial: '' };

interface ModalMPProps {
  open: boolean;
  editando?: MateriaPrima | null;
  onClose: () => void;
  onSalvar: (dados: any) => Promise<void>;
}

export function ModalMP({ open, editando, onClose, onSalvar }: ModalMPProps) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [salvando, setSalvando] = useState(false);
  const { data: categorias = [], criar: criarCategoria } = useCategorias();
  const [modalCat, setModalCat] = useState(false);
  const [novaCatNome, setNovaCatNome] = useState('');
  const [salvandoCat, setSalvandoCat] = useState(false);

  useEffect(() => {
    if (editando) {
      setForm({
        nome:           editando.nome,
        categoria:      editando.categoria ?? '',
        unidade:        editando.unidade,
        custo_unitario: String(editando.custo_unitario),
        estoque_minimo: String(editando.estoque_minimo ?? ''),
        saldo_inicial:  '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [editando, open]);

  function set(field: keyof FormData, val: string) {
    setForm(f => ({ ...f, [field]: val }));
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      await onSalvar({
        nome:           form.nome.trim(),
        categoria:      form.categoria.trim() || null,
        unidade:        form.unidade,
        custo_unitario: parseFloat(form.custo_unitario) || 0,
        estoque_minimo: parseFloat(form.estoque_minimo) || 0,
        ...(!editando ? { saldo_inicial: parseFloat(form.saldo_inicial) || 0 } : {}),
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal
      open={open}
      onClose={onClose}
      title={<span className="flex items-center gap-1.5">{editando ? <><Pencil className="w-4 h-4" /> Editar Matéria-Prima</> : <><Plus className="w-4 h-4" /> Nova Matéria-Prima</>}</span>}
      actions={
        <>
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !form.nome.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all"
          >
            {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Criar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome *">
          <input autoFocus value={form.nome} onChange={e => set('nome', e.target.value)}
            className={INPUT} placeholder="Ex: Papel Couchê 150g" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria">
            <div className="flex gap-2">
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={INPUT + ' flex-1'}>
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
              <button onClick={() => setModalCat(true)} title="Criar nova categoria"
                className="flex-shrink-0 w-10 h-10 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 rounded-lg flex items-center justify-center transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </Field>
          <Field label="Unidade">
            <select value={form.unidade} onChange={e => set('unidade', e.target.value)} className={INPUT}>
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Custo por Unidade (R$)">
            <input type="number" min="0" step="0.01" value={form.custo_unitario}
              onChange={e => set('custo_unitario', e.target.value)}
              className={INPUT} placeholder="0,00" />
          </Field>
          <Field label="Estoque Mínimo">
            <input type="number" min="0" step="0.001" value={form.estoque_minimo}
              onChange={e => set('estoque_minimo', e.target.value)}
              className={INPUT} placeholder="0" />
          </Field>
        </div>

        {!editando && (
          <Field label="Saldo Inicial">
            <input type="number" min="0" step="0.001" value={form.saldo_inicial}
              onChange={e => set('saldo_inicial', e.target.value)}
              className={INPUT} placeholder="0" />
          </Field>
        )}
      </div>
      </Modal>

      <Modal open={modalCat} onClose={() => setModalCat(false)}
        title={<span className="flex items-center gap-1.5"><Plus className="w-4 h-4 text-green-400" /> Nova Categoria</span>}
        maxWidth="360px"
        actions={<>
          <button onClick={() => setModalCat(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
          <button onClick={async () => {
            if (!novaCatNome.trim()) return;
            setSalvandoCat(true);
            try {
              const cat = await criarCategoria.mutateAsync(novaCatNome.trim());
              set('categoria', cat.nome);
              setNovaCatNome(''); setModalCat(false);
            } catch (e: any) { toast.error(e.message); }
            finally { setSalvandoCat(false); }
          }} disabled={salvandoCat || !novaCatNome.trim()}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
            {salvandoCat ? 'Salvando...' : 'Criar'}
          </button>
        </>}>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Nome *</label>
          <input autoFocus value={novaCatNome} onChange={e => setNovaCatNome(e.target.value)}
            className={INPUT} placeholder="Ex: Impressão, Acabamento, Serviço..." />
        </div>
      </Modal>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
