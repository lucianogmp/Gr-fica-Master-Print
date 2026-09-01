// src/components/vendas/GastosVenda.tsx
//
// Lançamento de gasto vinculado a uma venda — ex: cartão de visita
// terceirizado, material comprado de um fornecedor específico pra essa
// venda. Cria um lançamento de despesa (venda_id preenchido) que aparece
// no Financeiro normalmente, mas fica rastreável de qual venda veio.

import { useState } from 'react';
import { Plus, Trash2, Truck, Receipt, X } from 'lucide-react';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { parseFormas, calcularDataLiquidacao } from '../../types/configuracoes';
import { MoneyInput } from '../ui/MoneyInput';
import { DateInput } from '../ui/DateInput';
import { DarkSelect } from '../ui/DarkSelect';
import { VendaItem } from '../../types/venda';
import { Lancamento } from '../../types/financeiro';
import { useConfirm } from '../ui/ConfirmModal';

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors";

const fmtBRL = (v: number) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  vendaId: string;
  clienteNome: string;
  itens: VendaItem[];
  gastosRascunho?: Lancamento[];
  onAdicionarRascunho?: (gasto: Omit<Lancamento, 'id' | 'created_at'>) => void;
  onExcluirRascunho?: (id: string) => void;
}

export function GastosVenda({ vendaId, clienteNome, itens, gastosRascunho = [], onAdicionarRascunho, onExcluirRascunho }: Props) {
  const { data: lancamentos = [], criar, deletar, isSaving } = useLancamentos();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: cfg } = useConfiguracoes();
  const { confirmar, ConfirmModal } = useConfirm();

  const formas = parseFormas(cfg?.formas_pagamento).filter(f => f.ativo);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [itemRelacionadoIdx, setItemRelacionadoIdx] = useState<string>('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState('');
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [jaPago, setJaPago] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('');

  // Data real de compensação: dinheiro/PIX caem na hora, cartão/boleto
  // demoram os dias úteis configurados em Formas de Pagamento.
  const formaSelecionada = formas.find(f => f.nome === formaPagamento);
  const hoje = new Date().toISOString().split('T')[0];
  const dataLiquidacao = formaSelecionada ? calcularDataLiquidacao(hoje, formaSelecionada) : hoje;

  // Gastos já lançados pra essa venda (filtra do cache geral de lançamentos —
  // evita mais uma query só pra isso, já que useLancamentos já busca tudo).
  const isVendaNova = vendaId === '__novo__';
  const gastos = isVendaNova
    ? gastosRascunho
    : lancamentos.filter(l => l.tipo === 'despesa' && (l as any).venda_id === vendaId);
  const totalGastos = gastos.reduce((s, g) => s + Number(g.valor), 0);

  // Ao escolher qual item da venda gerou esse gasto, a descrição já vem
  // pronta — ex: "Cartão de Visita — João Silva" — mas continua editável.
  function selecionarItem(idxStr: string) {
    setItemRelacionadoIdx(idxStr);
    if (idxStr !== '' && itens[Number(idxStr)]) {
      setDescricao(`${itens[Number(idxStr)].descricao} — ${clienteNome}`);
    }
  }

  function limparForm() {
    setMostrarForm(false);
    setFornecedorNome('');
    setValor(0);
    setDescricao('');
    setItemRelacionadoIdx('');
    setDataVencimento(new Date().toISOString().split('T')[0]);
    setJaPago(false);
    setFormaPagamento('');
  }

  async function handleAdicionar() {
    if (!fornecedorNome.trim() || valor <= 0) return;
    if (jaPago && !formaPagamento) return; // precisa saber a forma pra calcular a data certa
    const payload = {
      tipo: 'despesa',
      valor,
      status: jaPago ? 'pago' : 'pendente',
      categoria: 'Fornecedor / Terceirização',
      venda_id: isVendaNova ? null : vendaId,
      cliente_nome: fornecedorNome, // campo genérico de "contraparte", igual já é usado em contas a pagar
      descricao: descricao.trim() || `Gasto — Venda de ${clienteNome}`,
      data_vencimento: dataVencimento,
      data_pagamento: jaPago ? dataLiquidacao : null,
      forma_pagamento: jaPago ? formaPagamento : null,
    } as Omit<Lancamento, 'id' | 'created_at'>;

    if (isVendaNova) {
      onAdicionarRascunho?.(payload);
    } else {
      await criar(payload as any);
    }
    limparForm();
  }

  async function handleExcluir(id: string) {
    if (isVendaNova) {
      onExcluirRascunho?.(id);
      return;
    }
    const ok = await confirmar('Remover este lançamento de gasto? Essa ação não pode ser desfeita.', 'Excluir Gasto');
    if (ok) deletar(id);
  }

  return (
    <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
      <ConfirmModal />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Gastos desta Venda
          {totalGastos > 0 && (
            <span className="text-red-400 normal-case font-normal">— {fmtBRL(totalGastos)}</span>
          )}
        </h3>
        {!mostrarForm && (
          <button onClick={() => setMostrarForm(true)}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Adicionar Gasto
          </button>
        )}
      </div>

      {gastos.length === 0 && !mostrarForm && (
        <p className="text-xs text-gray-600">
          Nenhum gasto lançado nesta venda ainda — ex: material terceirizado, fornecedor externo.
        </p>
      )}

      {gastos.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {gastos.map(g => (
            <div key={g.id} className="flex items-center justify-between bg-[#111827] border border-gray-700/60 rounded-lg px-3 py-2 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{(g as any).cliente_nome || 'Fornecedor'}</p>
                <p className="text-[10px] text-gray-500 truncate">
                  {g.descricao}
                  {(g as any).forma_pagamento ? ` · ${(g as any).forma_pagamento}` : ''}
                </p>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                g.status === 'pago' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
              }`}>
                {g.status === 'pago' ? 'PAGO' : 'PENDENTE'}
              </span>
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="text-xs font-bold text-red-400">{fmtBRL(Number(g.valor))}</span>
                <button onClick={() => handleExcluir(g.id)} className="text-gray-600 hover:text-red-400" title="Excluir gasto">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <div className="bg-[#111827] border border-gray-700 rounded-lg p-3 space-y-2.5">
          <div className="flex justify-end">
            <button onClick={limparForm} className="text-gray-500 hover:text-white" title="Cancelar">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Fornecedor / Pago a *</label>
              <input list="fornecedores-lista-gasto" value={fornecedorNome}
                onChange={e => setFornecedorNome(e.target.value)}
                className={IN} placeholder="Nome do fornecedor" />
              <datalist id="fornecedores-lista-gasto">
                {fornecedores.map(f => <option key={f.id} value={f.nome} />)}
              </datalist>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Valor *</label>
              <MoneyInput value={valor} onChange={setValor} className={IN} />
            </div>
          </div>

          {itens.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Relacionado a qual item? (opcional)</label>
              <DarkSelect
                value={itemRelacionadoIdx}
                onChange={selecionarItem}
                placeholder="— Selecione um item da venda —"
                triggerClassName={IN + ' text-left flex items-center justify-between gap-2 cursor-pointer'}
                options={itens.map((it, idx) => ({ value: String(idx), label: it.descricao }))}
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Descrição</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className={IN}
              placeholder="Ex: Cartão de Visita — João Silva" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 items-end">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data</label>
              <DateInput value={dataVencimento} onChange={setDataVencimento} className={IN} />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400 pb-2 cursor-pointer">
              <input type="checkbox" checked={jaPago} onChange={e => { setJaPago(e.target.checked); if (!e.target.checked) setFormaPagamento(''); }}
                className="w-3.5 h-3.5 accent-blue-500" />
              Já foi pago
            </label>
          </div>

          {jaPago && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Forma de pagamento *</label>
              <DarkSelect
                value={formaPagamento}
                onChange={setFormaPagamento}
                allowEmpty
                options={formas.map(f => f.nome)}
              />
              {formaSelecionada && (
                <p className="text-[10px] text-gray-500 mt-1">
                  {(formaSelecionada.dias_uteis_liquidacao ?? 0) > 0
                    ? <>Compensa em {formaSelecionada.dias_uteis_liquidacao} dia(s) útil(eis) — <span className="text-yellow-400 font-bold">{new Date(dataLiquidacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span></>
                    : <>Cai na hora — <span className="text-green-400 font-bold">{new Date(dataLiquidacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span></>}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={limparForm} className="text-xs text-gray-400 hover:text-white px-3 py-2">Cancelar</button>
            <button onClick={handleAdicionar} disabled={isSaving || !fornecedorNome.trim() || valor <= 0 || (jaPago && !formaPagamento)}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> {isSaving ? 'Salvando...' : 'Lançar Gasto'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
