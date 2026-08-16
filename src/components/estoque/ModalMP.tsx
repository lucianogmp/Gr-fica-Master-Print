import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { MateriaPrima } from '../../types/estoque';
import { Pencil, Plus } from 'lucide-react';
import { DarkSelect } from '../ui/DarkSelect';
import { MoneyInput } from '../ui/MoneyInput';
import { useCategorias } from '../../hooks/useCategorias';
import toast from 'react-hot-toast';

const UNIDADES = ['un', 'kg', 'g', 'l', 'ml', 'm', 'm2', 'cm', 'folha', 'caixa', 'resma', 'par'];
const UNIDADES_LABEL: Record<string, string> = { m2: 'm²' };
const UNIDADES_OPCOES = UNIDADES.map(u => ({ value: u, label: UNIDADES_LABEL[u] ?? u }));

type FormData = {
  nome: string;
  categoria: string;
  unidade: string;
  custo_unitario: number;
  estoque_minimo: string;
  saldo_inicial: string;
  controla_estoque: boolean;
  largura_padrao_cm: string;
};

const EMPTY: FormData = { nome: '', categoria: '', unidade: 'un', custo_unitario: 0, estoque_minimo: '', saldo_inicial: '', controla_estoque: true, largura_padrao_cm: '' };

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
        custo_unitario: Number(editando.custo_unitario) || 0,
        estoque_minimo: String(editando.estoque_minimo ?? ''),
        saldo_inicial:  '',
        controla_estoque: editando.controla_estoque !== false, // itens antigos sem esse campo continuam controlando
        largura_padrao_cm: editando.largura_padrao_cm != null ? String(editando.largura_padrao_cm) : '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [editando, open]);

  function set(field: Exclude<keyof FormData, 'custo_unitario' | 'controla_estoque'>, val: string) {
    setForm(f => ({ ...f, [field]: val }));
  }
  function setCustoUnitario(val: number) {
    setForm(f => ({ ...f, custo_unitario: val }));
  }
  function setControlaEstoque(val: boolean) {
    setForm(f => ({ ...f, controla_estoque: val }));
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      await onSalvar({
        nome:           form.nome.trim(),
        categoria:      form.categoria.trim() || null,
        unidade:        form.unidade,
        custo_unitario: form.custo_unitario || 0,
        controla_estoque: form.controla_estoque,
        largura_padrao_cm: form.unidade === 'm2' && form.largura_padrao_cm
          ? parseFloat(form.largura_padrao_cm) || null
          : null,
        // Sem controle: item comprado sob medida, não faz sentido rastrear
        // mínimo nem saldo — zera pra não sobrar lixo de um estado anterior.
        estoque_minimo: form.controla_estoque ? (parseFloat(form.estoque_minimo) || 0) : 0,
        ...(!editando ? { saldo_inicial: form.controla_estoque ? (parseFloat(form.saldo_inicial) || 0) : 0 } : {}),
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

        {/* Controlar estoque: desliga pra itens comprados sob medida/encomenda
            (ex: metalon cortado sob medida) — não faz sentido rastrear saldo. */}
        <div className="flex items-center justify-between bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5">
          <div>
            <p className="text-sm font-bold text-white">Controlar estoque?</p>
            <p className="text-[10px] text-gray-500">Desligue para itens comprados sob medida — não calcula saldo nem avisa falta.</p>
          </div>
          <button type="button" onClick={() => setControlaEstoque(!form.controla_estoque)}
            className={`w-11 h-6 rounded-full relative transition-all flex-shrink-0 ${form.controla_estoque ? 'bg-green-600' : 'bg-gray-700'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.controla_estoque ? 'left-5.5' : 'left-0.5'}`}
              style={{ left: form.controla_estoque ? 22 : 2 }} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria">
            <div className="flex gap-2">
              <DarkSelect
                value={form.categoria}
                onChange={v => set('categoria', v)}
                placeholder="Sem categoria"
                className="flex-1"
                options={categorias.map(c => c.nome)}
              />
              <button onClick={() => setModalCat(true)} title="Criar nova categoria"
                className="flex-shrink-0 w-10 h-10 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 rounded-lg flex items-center justify-center transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </Field>
          <Field label="Unidade">
            <DarkSelect
              value={form.unidade}
              onChange={v => set('unidade', v)}
              allowEmpty={false}
              options={UNIDADES_OPCOES}
            />
          </Field>
        </div>

        {form.unidade === 'm2' && (
          <Field label="Largura do Rolo (cm)">
            <input type="number" min="0" step="0.1" value={form.largura_padrao_cm}
              onFocus={e => e.target.select()}
              onChange={e => set('largura_padrao_cm', e.target.value)}
              className={INPUT + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"}
              placeholder="Ex: 61" />
            <p className="text-[10px] text-gray-600 mt-1">
              Largura fixa desse rolo/bobina — usada pra pré-preencher a calculadora de m² ao registrar entrada/saída, sem precisar redigitar toda vez.
            </p>
          </Field>
        )}

        {form.controla_estoque ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Custo por Unidade (R$)">
              <MoneyInput value={form.custo_unitario}
                onChange={setCustoUnitario}
                className={INPUT} placeholder="0,00" />
            </Field>
            <Field label="Estoque Mínimo">
              <input type="number" min="0" step="0.001" value={form.estoque_minimo}
                onChange={e => set('estoque_minimo', e.target.value)}
                className={INPUT} placeholder="0" />
            </Field>
          </div>
        ) : (
          <Field label="Custo por Unidade (R$)">
            <MoneyInput value={form.custo_unitario}
              onChange={setCustoUnitario}
              className={INPUT} placeholder="0,00" />
          </Field>
        )}

        {!editando && form.controla_estoque && (
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
              const cat = await criarCategoria(novaCatNome.trim());
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
