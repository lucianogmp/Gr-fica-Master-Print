import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Lancamento, CATEGORIAS_RECEITA, CATEGORIAS_DESPESA, FORMAS_PAGAMENTO } from '../../types/financeiro';
import { Pencil, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { DateInput } from '../ui/DateInput';

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

type FormData = {
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  categoria: string;
  data_vencimento: string;
  forma_pagamento: string;
  cliente_nome: string;
  observacoes: string;
  status: string;
};

const EMPTY: FormData = {
  tipo: 'despesa', descricao: '', valor: 0, categoria: '',
  data_vencimento: '', forma_pagamento: '', cliente_nome: '', observacoes: '', status: 'pendente',
};

interface ModalLancamentoProps {
  open: boolean;
  editando?: Lancamento | null;
  tipoInicial?: 'receita' | 'despesa';
  onClose: () => void;
  onSalvar: (dados: any) => Promise<void>;
}

export function ModalLancamento({ open, editando, tipoInicial, onClose, onSalvar }: ModalLancamentoProps) {
  const [form, setForm]       = useState<FormData>(EMPTY);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (editando) {
      setForm({
        tipo:            editando.tipo,
        descricao:       editando.descricao,
        valor:           Number(editando.valor) || 0,
        categoria:       editando.categoria ?? '',
        data_vencimento: editando.data_vencimento ?? '',
        forma_pagamento: editando.forma_pagamento ?? '',
        cliente_nome:    editando.cliente_nome ?? '',
        observacoes:     editando.observacoes ?? '',
        status:          editando.status,
      });
    } else {
      setForm({ ...EMPTY, tipo: tipoInicial ?? 'despesa' });
    }
  }, [editando, tipoInicial, open]);

  function set(f: Exclude<keyof FormData, 'valor'>, v: string) { setForm(p => ({ ...p, [f]: v })); }
  function setValor(v: number) { setForm(p => ({ ...p, valor: v })); }

  async function handleSalvar() {
    if (!form.descricao.trim() || !form.valor) return;
    setSalvando(true);
    try {
      await onSalvar({
        tipo:            form.tipo,
        descricao:       form.descricao.trim(),
        valor:           form.valor,
        categoria:       form.categoria || null,
        data_vencimento: form.data_vencimento || null,
        forma_pagamento: form.forma_pagamento || null,
        cliente_nome:    form.cliente_nome.trim() || null,
        observacoes:     form.observacoes.trim() || null,
        status:          form.status,
      });
      onClose();
    } finally { setSalvando(false); }
  }

  const cats = form.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<span className="flex items-center gap-1.5">{editando ? <><Pencil className="w-4 h-4" /> Editar Lançamento</> : <><Plus className="w-4 h-4" /> Novo Lançamento</>}</span>}
      maxWidth="520px"
      actions={
        <>
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={salvando || !form.descricao.trim() || !form.valor}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tipo */}
        <div className="flex gap-2">
          {(['receita', 'despesa'] as const).map(t => (
            <button key={t} onClick={() => set('tipo', t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all capitalize ${
                form.tipo === t
                  ? t === 'receita'
                    ? 'bg-green-600 border-green-500 text-white'
                    : 'bg-red-600 border-red-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}>
              <span className="inline-flex items-center gap-1.5">
                {t === 'receita' ? <><ArrowUp className="w-3.5 h-3.5" /> Receita</> : <><ArrowDown className="w-3.5 h-3.5" /> Despesa</>}
              </span>
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Descrição *</label>
          <input autoFocus value={form.descricao} onChange={e => set('descricao', e.target.value)} className={IN} placeholder="Ex: Fornecedor de papel" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Valor (R$) *</label>
            <MoneyInput value={form.valor} onChange={setValor} className={IN} placeholder="0,00" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={IN}>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="atrasado">Atrasado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Categoria</label>
            <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={IN}>
              <option value="">Sem categoria</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Vencimento</label>
            <DateInput value={form.data_vencimento} onChange={v => set('data_vencimento', v)} className={IN} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Forma de Pagamento</label>
            <select value={form.forma_pagamento} onChange={e => set('forma_pagamento', e.target.value)} className={IN}>
              <option value="">—</option>
              {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Cliente / Fornecedor</label>
            <input value={form.cliente_nome} onChange={e => set('cliente_nome', e.target.value)} className={IN} placeholder="Nome..." />
          </div>
        </div>
      </div>
    </Modal>
  );
}
