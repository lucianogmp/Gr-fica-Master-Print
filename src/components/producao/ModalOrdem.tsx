import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { DateInput } from '../ui/DateInput';
import { OrdemProducao, ETAPAS, PRIORIDADES } from '../../types/producao';
import { Pencil, Plus } from 'lucide-react';
import { DarkSelect } from '../ui/DarkSelect';

type FormData = {
  titulo: string;
  descricao: string;
  etapa: string;
  prioridade: string;
  responsavel: string;
  data_entrega: string;
};

const EMPTY: FormData = {
  titulo: '', descricao: '', etapa: 'fila',
  prioridade: 'normal', responsavel: '', data_entrega: '',
};

interface ModalOrdemProps {
  open: boolean;
  editando?: OrdemProducao | null;
  etapaInicial?: string;
  onClose: () => void;
  onSalvar: (dados: any) => Promise<void>;
}

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function ModalOrdem({ open, editando, etapaInicial, onClose, onSalvar }: ModalOrdemProps) {
  const [form, setForm]       = useState<FormData>(EMPTY);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (editando) {
      setForm({
        titulo:       editando.titulo,
        descricao:    editando.descricao ?? '',
        etapa:        editando.etapa,
        prioridade:   editando.prioridade,
        responsavel:  editando.responsavel ?? '',
        data_entrega: editando.data_entrega ?? '',
      });
    } else {
      setForm({ ...EMPTY, etapa: etapaInicial ?? 'fila' });
    }
  }, [editando, etapaInicial, open]);

  function set(f: keyof FormData, v: string) {
    setForm(prev => ({ ...prev, [f]: v }));
  }

  async function handleSalvar() {
    if (!form.titulo.trim()) return;
    setSalvando(true);
    try {
      await onSalvar({
        titulo:       form.titulo.trim(),
        descricao:    form.descricao.trim() || null,
        etapa:        form.etapa,
        prioridade:   form.prioridade,
        responsavel:  form.responsavel.trim() || null,
        data_entrega: form.data_entrega || null,
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<span className="flex items-center gap-1.5">{editando ? <><Pencil className="w-4 h-4" /> Editar Ordem</> : <><Plus className="w-4 h-4" /> Nova Ordem de Produção</>}</span>}
      maxWidth="520px"
      actions={
        <>
          <button onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={salvando || !form.titulo.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
            {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar Ordem'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Título *</label>
          <input autoFocus value={form.titulo} onChange={e => set('titulo', e.target.value)}
            className={IN} placeholder="Ex: Adesivos Loja Silva - 500un" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Etapa</label>
            <DarkSelect
              value={form.etapa}
              onChange={v => set('etapa', v)}
              allowEmpty={false}
              options={ETAPAS.map(e => ({ value: e.key, label: e.label }))}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Prioridade</label>
            <DarkSelect
              value={form.prioridade}
              onChange={v => set('prioridade', v)}
              allowEmpty={false}
              options={PRIORIDADES.map(p => ({ value: p.key, label: p.label }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Responsável</label>
            <input value={form.responsavel} onChange={e => set('responsavel', e.target.value)}
              className={IN} placeholder="Nome do operador" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Data de Entrega</label>
            <DateInput value={form.data_entrega} onChange={v => set('data_entrega', v)}
              className={IN} />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Descrição / Observações</label>
          <textarea rows={3} value={form.descricao} onChange={e => set('descricao', e.target.value)}
            className={IN + ' resize-none'} placeholder="Detalhes do serviço, especificações..." />
        </div>
      </div>
    </Modal>
  );
}
