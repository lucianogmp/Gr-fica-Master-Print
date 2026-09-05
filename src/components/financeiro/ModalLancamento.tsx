import { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Lancamento, CATEGORIAS_RECEITA, CATEGORIAS_DESPESA, FORMAS_PAGAMENTO } from '../../types/financeiro';
import { useContasBancarias } from '../../hooks/useContasBancarias';
import { Pencil, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { DateInput } from '../ui/DateInput';
import { DarkSelect } from '../ui/DarkSelect';
import { marcarAlteracoesPendentes, limparAlteracoesPendentes } from '../../lib/unsavedChangesGuard';

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
  conta_id: string;
};

const EMPTY: FormData = {
  tipo: 'despesa', descricao: '', valor: 0, categoria: '',
  data_vencimento: '', forma_pagamento: '', cliente_nome: '', observacoes: '', status: 'pendente', conta_id: '',
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
  const { data: contas = [] } = useContasBancarias();
  const contasAtivas = contas.filter(c => c.ativo);
  // Dinheiro só pode ir pro caixa físico; outras formas nunca podem cair
  // na conta Caixa — mesma regra do pagamento de venda.
  const contasCompativeis = form.forma_pagamento === 'Dinheiro'
    ? contasAtivas.filter(c => c.tipo === 'caixa')
    : contasAtivas.filter(c => c.tipo !== 'caixa');
  const contasDaForma = contasCompativeis.filter(c => (c.formas_aceitas ?? []).includes(form.forma_pagamento));
  const opcoesConta = contasDaForma.length > 0 ? contasDaForma : contasCompativeis;
  // Ignora as mudanças de estado disparadas pelo próprio carregamento
  // (abrir o modal já preenchendo com o lançamento existente) — só marca
  // "alterações pendentes" quando é a pessoa mexendo em algum campo.
  const carregandoRef = useRef(true);

  useEffect(() => {
    carregandoRef.current = true;
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
        conta_id:        editando.conta_id ?? '',
      });
    } else {
      setForm({ ...EMPTY, tipo: tipoInicial ?? 'despesa' });
    }
    carregandoRef.current = false;
  }, [editando, tipoInicial, open]);

  // Modal fechou por qualquer caminho (Salvar, Cancelar, X, Esc, clique
  // fora) — limpa o aviso, não precisa mais dele.
  useEffect(() => {
    if (!open) limparAlteracoesPendentes();
  }, [open]);

  function marcarSujo() {
    if (!carregandoRef.current) {
      marcarAlteracoesPendentes('Você tem alterações não salvas nesse lançamento. Sair mesmo assim?');
    }
  }

  function set(f: Exclude<keyof FormData, 'valor'>, v: string) { setForm(p => ({ ...p, [f]: v })); marcarSujo(); }
  function setValor(v: number) { setForm(p => ({ ...p, valor: v })); marcarSujo(); }

  const precisaConta = form.status === 'pago';
  const podeSalvar = form.descricao.trim() && form.valor && (!precisaConta || form.conta_id);

  async function handleSalvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      await onSalvar({
        tipo:            form.tipo,
        descricao:       form.descricao.trim(),
        valor:           form.valor,
        categoria:       form.categoria || null,
        data_vencimento: form.data_vencimento || null,
        data_pagamento:  form.status === 'pago' ? (editando?.data_pagamento ?? new Date().toISOString().slice(0, 10)) : null,
        forma_pagamento: form.forma_pagamento || null,
        cliente_nome:    form.cliente_nome.trim() || null,
        observacoes:     form.observacoes.trim() || null,
        status:          form.status,
        conta_id:        form.status === 'pago' ? (form.conta_id || null) : null,
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
          <button onClick={handleSalvar} disabled={salvando || !podeSalvar}
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
            <DarkSelect
              value={form.status}
              onChange={v => set('status', v)}
              allowEmpty={false}
              options={[
                { value: 'pendente', label: 'Pendente' },
                { value: 'pago', label: 'Pago' },
                { value: 'atrasado', label: 'Atrasado' },
                { value: 'cancelado', label: 'Cancelado' },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Categoria</label>
            <DarkSelect
              value={form.categoria}
              onChange={v => set('categoria', v)}
              placeholder="Sem categoria"
              options={cats}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Vencimento</label>
            <DateInput value={form.data_vencimento} onChange={v => set('data_vencimento', v)} className={IN} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Forma de Pagamento</label>
            <DarkSelect
              value={form.forma_pagamento}
              onChange={v => { set('forma_pagamento', v); setForm(f => ({ ...f, conta_id: '' })); }}
              placeholder="—"
              options={FORMAS_PAGAMENTO}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Cliente / Fornecedor</label>
            <input value={form.cliente_nome} onChange={e => set('cliente_nome', e.target.value)} className={IN} placeholder="Nome..." />
          </div>
        </div>

        {/* Conta financeira — só faz sentido perguntar quando já está pago,
            porque é o que efetivamente atualiza o saldo daquela conta. */}
        {precisaConta && (
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Conta financeira *</label>
            {opcoesConta.length === 0 ? (
              <p className="text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                Nenhuma conta cadastrada ainda. Cadastre uma em Configurações → Formas de Pagamento.
              </p>
            ) : (
              <>
                <DarkSelect
                  value={form.conta_id}
                  onChange={v => set('conta_id', v)}
                  allowEmpty
                  options={opcoesConta.map(c => ({ value: c.id, label: c.nome }))}
                />
                {contasDaForma.length === 0 && form.forma_pagamento && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Nenhuma conta marcada como aceitando "{form.forma_pagamento}" — mostrando todas as contas ativas.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
