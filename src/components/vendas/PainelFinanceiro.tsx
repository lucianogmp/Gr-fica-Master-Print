// src/components/vendas/PainelFinanceiro.tsx
//
// CORREÇÃO: usa parseFormas() seguro igual ao AbaVendas —
// evita "formas.map is not a function" quando o Supabase
// retorna formas_pagamento como string JSON ou null.

import { useState } from 'react';
import { PagamentoVenda } from '../../types/venda';
import {
  Configuracoes,
  FormasPagamentoConfig,
  FORMAS_PAGAMENTO_DEFAULT,
  getTaxaParcela,
  calcTotalComTaxa,
} from '../../types/configuracoes';
import {
  DollarSign, Plus, Trash2, CreditCard, Calendar, User,
} from 'lucide-react';

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
      })
    : '—';

// ── Parse seguro (mesmo helper do AbaVendas) ────────────────────────────────
function parseFormas(raw: any): FormasPagamentoConfig[] {
  if (!raw) return FORMAS_PAGAMENTO_DEFAULT;
  if (Array.isArray(raw)) return raw.length > 0 ? raw : FORMAS_PAGAMENTO_DEFAULT;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* ignora */ }
  }
  return FORMAS_PAGAMENTO_DEFAULT;
}

interface Props {
  subtotal: number;
  desconto: number;
  frete: number;
  taxaAdicional: number;
  parcelas: number;
  formaPagamento: string;
  valorPago: number;
  pagamentos: PagamentoVenda[];
  cfg?: Configuracoes | null;
  vendaId?: string | null;
  onDescontoChange: (v: number) => void;
  onFreteChange: (v: number) => void;
  onTaxaChange: (v: number) => void;
  onParcelasChange: (v: number) => void;
  onFormaPagamentoChange: (v: string) => void;
  onRegistrarPagamento: (pag: Omit<PagamentoVenda, 'id' | 'created_at'>) => Promise<void>;
  onExcluirPagamento: (id: string, vendaId: string) => void;
  isRegistrando?: boolean;
}

export function PainelFinanceiro({
  subtotal, desconto, frete, taxaAdicional, parcelas, formaPagamento,
  valorPago, pagamentos, cfg, vendaId,
  onDescontoChange, onFreteChange, onTaxaChange, onParcelasChange,
  onFormaPagamentoChange, onRegistrarPagamento, onExcluirPagamento, isRegistrando,
}: Props) {
  const [showNovoPag, setShowNovoPag] = useState(false);
  const [novoPag, setNovoPag] = useState({
    valor: '',
    forma: formaPagamento || 'PIX',
    data: new Date().toISOString().slice(0, 10),
    obs: '',
  });

  // Formas ativas — parse seguro
  const formas = parseFormas(cfg?.formas_pagamento).filter(f => f.ativo);

  // Forma selecionada
  const formaAtual = formas.find(f => f.nome === formaPagamento);

  // Taxa para o número de parcelas atual
  const taxaPct = getTaxaParcela(formaAtual, parcelas);

  // Cálculos
  const descontoValor   = subtotal * (desconto / 100);
  const subtotalDescont = subtotal - descontoValor;
  const totalBase       = subtotalDescont + Number(frete || 0) + Number(taxaAdicional || 0);
  const totalComTaxa    = calcTotalComTaxa(totalBase, taxaPct);
  const acrescimo       = totalComTaxa - totalBase;
  const valorParcela    = parcelas > 0 ? totalComTaxa / parcelas : totalComTaxa;
  const valorRestante   = Math.max(0, totalComTaxa - valorPago);
  const quitado         = totalComTaxa > 0 && valorRestante <= 0.01;

  // Opções de parcelas da forma
  const maxParcelas = formaAtual?.max_parcelas ?? 1;
  const opcoesParc  = formaAtual?.permite_parcelamento
    ? Array.from({ length: maxParcelas }, (_, i) => i + 1)
    : [1];

  function handleFormaChange(nome: string) {
    onFormaPagamentoChange(nome);
    onParcelasChange(1);
  }

  async function handleRegistrar() {
    if (!vendaId || !novoPag.valor) return;
    await onRegistrarPagamento({
      venda_id:        vendaId,
      valor:           parseFloat(novoPag.valor),
      forma_pagamento: novoPag.forma,
      parcelas:        null,
      juros_pct:       null,
      data_pagamento:  novoPag.data,
      observacoes:     novoPag.obs || null,
      usuario_id:      null,
      usuario_nome:    null,
    });
    setNovoPag({
      valor: '',
      forma: formaPagamento || 'PIX',
      data: new Date().toISOString().slice(0, 10),
      obs: '',
    });
    setShowNovoPag(false);
  }

  const IN = "bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors w-full [color-scheme:dark]";

  return (
    <div className="space-y-4">

      {/* ── Resumo financeiro ── */}
      <div className="bg-[#1f2937] border-t-2 border-green-500 border-x border-b border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" /> Resumo Financeiro
        </h3>

        <div className="space-y-3">

          {/* Subtotal */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal dos itens</span>
            <span className="font-bold text-white">{fmtBRL(subtotal)}</span>
          </div>

          {/* Desconto % */}
          <div className="flex items-center justify-between text-sm gap-2">
            <span className="text-gray-400 flex-shrink-0">Desconto (%)</span>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="100" step="0.1"
                value={desconto || ''}
                onChange={e => onDescontoChange(parseFloat(e.target.value) || 0)}
                className="w-20 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                placeholder="0"
              />
              {descontoValor > 0 && (
                <span className="text-red-400 text-xs font-bold flex-shrink-0">
                  -{fmtBRL(descontoValor)}
                </span>
              )}
            </div>
          </div>

          {/* Frete */}
          <div className="flex items-center justify-between text-sm gap-2">
            <span className="text-gray-400 flex-shrink-0">Frete (R$)</span>
            <input
              type="number" min="0" step="0.01"
              value={frete || ''}
              onChange={e => onFreteChange(parseFloat(e.target.value) || 0)}
              className="w-28 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              placeholder="0,00"
            />
          </div>

          {/* Taxa adicional */}
          <div className="flex items-center justify-between text-sm gap-2">
            <span className="text-gray-400 flex-shrink-0">Taxas adicionais (R$)</span>
            <input
              type="number" min="0" step="0.01"
              value={taxaAdicional || ''}
              onChange={e => onTaxaChange(parseFloat(e.target.value) || 0)}
              className="w-28 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              placeholder="0,00"
            />
          </div>

          {/* Subtotal sem acréscimo */}
          <div className="border-t border-gray-700 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total sem acréscimo</span>
              <span className="font-bold text-gray-300">{fmtBRL(totalBase)}</span>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-2" />

          {/* Forma de pagamento */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Forma de Pagamento</p>
            <select
              value={formaPagamento}
              onChange={e => handleFormaChange(e.target.value)}
              className={IN}
            >
              <option value="">— Selecionar —</option>
              {formas.map(f => (
                <option key={f.nome} value={f.nome}>{f.nome}</option>
              ))}
            </select>
          </div>

          {/* Parcelamento */}
          {formaAtual?.permite_parcelamento && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2.5">
              <p className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Parcelamento
              </p>

              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">
                  Número de parcelas
                </label>
                <select
                  value={parcelas}
                  onChange={e => onParcelasChange(parseInt(e.target.value))}
                  className={IN}
                >
                  {opcoesParc.map(n => {
                    const taxa  = getTaxaParcela(formaAtual, n);
                    const totalN = calcTotalComTaxa(totalBase, taxa);
                    const parcN  = totalN / n;
                    return (
                      <option key={n} value={n}>
                        {n === 1
                          ? `1x — à vista${taxa > 0 ? ` (+${taxa.toLocaleString('pt-BR')}%)` : ' — sem juros'}`
                          : `${n}x de ${parcN.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${taxa > 0 ? ` (+${taxa.toLocaleString('pt-BR')}%)` : ' — sem juros'}`
                        }
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Resumo */}
              {parcelas > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">
                      Taxa {parcelas}x {formaAtual.nome}
                    </span>
                    <span className={taxaPct > 0 ? 'text-yellow-400 font-bold' : 'text-green-400'}>
                      {taxaPct > 0
                        ? `+${taxaPct.toLocaleString('pt-BR')}%`
                        : 'Sem acréscimo'}
                    </span>
                  </div>
                  {taxaPct > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Acréscimo (R$)</span>
                      <span className="text-yellow-400 font-bold">+{fmtBRL(acrescimo)}</span>
                    </div>
                  )}
                  {parcelas > 1 && (
                    <div className="flex justify-between text-xs font-bold border-t border-blue-500/20 pt-1.5 mt-1">
                      <span className="text-blue-300">{parcelas}x de</span>
                      <span className="text-blue-300 text-sm">{fmtBRL(valorParcela)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-700 pt-2" />

          {/* TOTAL FINAL */}
          <div className="flex justify-between items-center">
            <span className="font-bold text-white text-sm">Total</span>
            <div className="text-right">
              <span className="text-2xl font-black text-green-400">{fmtBRL(totalComTaxa)}</span>
              {parcelas > 1 && (
                <div className="text-[10px] text-blue-400 mt-0.5">
                  {parcelas}x de {fmtBRL(valorParcela)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Situação do pagamento ── */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase">Situação do Pagamento</h3>
          {vendaId && vendaId !== '__novo__' && (
            <button
              onClick={() => setShowNovoPag(!showNovoPag)}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all"
            >
              <Plus className="w-3 h-3" /> Registrar
            </button>
          )}
        </div>

        {/* Pago / Restante */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Pago</p>
            <p className="text-lg font-black text-green-400">{fmtBRL(valorPago)}</p>
          </div>
          <div className={`border rounded-lg p-3 text-center ${
            quitado
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-yellow-500/10 border-yellow-500/20'
          }`}>
            <p className="text-[10px] text-gray-500 uppercase mb-1">
              {quitado ? 'Status' : 'Restante'}
            </p>
            {quitado
              ? <p className="text-base font-black text-green-400">QUITADO ✓</p>
              : <p className="text-lg font-black text-yellow-400">{fmtBRL(valorRestante)}</p>
            }
          </div>
        </div>

        {/* Barra de progresso */}
        {totalComTaxa > 0 && (
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (valorPago / totalComTaxa) * 100)}%` }}
            />
          </div>
        )}

        {/* Form novo pagamento */}
        {showNovoPag && vendaId && vendaId !== '__novo__' && (
          <div className="mt-3 border-t border-gray-700 pt-3 space-y-3">
            <p className="text-[10px] font-bold text-green-400 uppercase">Novo Pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Valor (R$) *</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={novoPag.valor}
                  onChange={e => setNovoPag(f => ({ ...f, valor: e.target.value }))}
                  className={IN}
                  placeholder="0,00"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Data</label>
                <input
                  type="date"
                  value={novoPag.data}
                  onChange={e => setNovoPag(f => ({ ...f, data: e.target.value }))}
                  className={IN}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Forma</label>
                <select
                  value={novoPag.forma}
                  onChange={e => setNovoPag(f => ({ ...f, forma: e.target.value }))}
                  className={IN}
                >
                  {formas.map(f => (
                    <option key={f.nome} value={f.nome}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Observações</label>
                <input
                  value={novoPag.obs}
                  onChange={e => setNovoPag(f => ({ ...f, obs: e.target.value }))}
                  className={IN}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNovoPag(false)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrar}
                disabled={isRegistrando || !novoPag.valor}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold"
              >
                {isRegistrando ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Histórico de pagamentos ── */}
      {pagamentos.length > 0 && (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-xs font-bold text-gray-400 uppercase">
              Histórico ({pagamentos.length})
            </p>
          </div>
          <div className="divide-y divide-gray-800">
            {pagamentos.map(p => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/20 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-green-400">
                      {fmtBRL(p.valor)}
                    </span>
                    <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                      {p.forma_pagamento}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {fmtData(p.data_pagamento)}
                    </span>
                    {p.usuario_nome && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <User className="w-3 h-3" /> {p.usuario_nome}
                      </span>
                    )}
                    {p.observacoes && (
                      <span className="text-[10px] text-gray-500 truncate">
                        {p.observacoes}
                      </span>
                    )}
                  </div>
                </div>
                {vendaId && vendaId !== '__novo__' && (
                  <button
                    onClick={() => onExcluirPagamento(p.id, vendaId)}
                    className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                    title="Remover pagamento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
