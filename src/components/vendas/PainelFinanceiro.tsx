// src/components/vendas/PainelFinanceiro.tsx
import { useState, useEffect, useRef } from 'react';
import { PagamentoVenda } from '../../types/venda';
import { ContaBancaria } from '../../hooks/useContasBancarias';
import {
  Configuracoes,
  FormasPagamentoConfig,
  FORMAS_PAGAMENTO_DEFAULT,
  gerarTabelaTaxas,
  getTaxaParcela,
  calcTotalComTaxa,
} from '../../types/configuracoes';
import { DollarSign, Plus, Trash2, CreditCard, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { DateInput } from '../ui/DateInput';
import { DarkSelect } from '../ui/DarkSelect';

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

function parseFormas(raw: any): FormasPagamentoConfig[] {
  if (!raw) return FORMAS_PAGAMENTO_DEFAULT;
  if (Array.isArray(raw)) return raw.length > 0 ? raw.map(normalizarForma) : FORMAS_PAGAMENTO_DEFAULT;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length > 0) return p.map(normalizarForma);
    } catch {}
  }
  return FORMAS_PAGAMENTO_DEFAULT;
}

function normalizarForma(forma: Partial<FormasPagamentoConfig>): FormasPagamentoConfig {
  const maxParcelas = Number(forma.max_parcelas || forma.tabela_taxas?.length || 1);
  const permiteParcelamento = Boolean(forma.permite_parcelamento || maxParcelas > 1);
  const tabela = Array.isArray(forma.tabela_taxas) && forma.tabela_taxas.length > 0
    ? forma.tabela_taxas
    : gerarTabelaTaxas(permiteParcelamento ? Math.max(maxParcelas, 12) : 1);

  return {
    nome: forma.nome ?? '',
    ativo: forma.ativo ?? true,
    permite_parcelamento: permiteParcelamento,
    max_parcelas: permiteParcelamento ? Math.max(maxParcelas, tabela.length, 1) : 1,
    tabela_taxas: tabela,
    dias_uteis_liquidacao: forma.dias_uteis_liquidacao ?? 0,
  };
}

interface Props {
  subtotal: number;
  desconto: number;
  frete: number;
  taxaAdicional: number;
  parcelas: number;
  juros?: number;
  formaPagamento: string;
  valorPago: number;
  pagamentos: PagamentoVenda[];
  cfg?: Configuracoes | null;
  vendaId?: string | null;
  contas?: ContaBancaria[];
  onDescontoChange: (v: number) => void;
  onFreteChange: (v: number) => void;
  onTaxaChange: (v: number) => void;
  onParcelasChange: (v: number) => void;
  onJurosChange?: (v: number) => void;
  onFormaPagamentoChange: (v: string) => void;
  onRegistrarPagamento: (pag: Omit<PagamentoVenda, 'id' | 'created_at'>) => Promise<void>;
  onExcluirPagamento: (id: string, vendaId: string) => void;
  isRegistrando?: boolean;
}

const IN_SM = "bg-[#111827] border border-gray-700 rounded-md px-2.5 py-1 text-white text-xs text-right focus:outline-none focus:border-blue-500 [color-scheme:dark]";
const IN = "bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark] w-full";

export function PainelFinanceiro({
  subtotal, desconto, frete, taxaAdicional, parcelas, formaPagamento,
  valorPago, pagamentos, cfg, vendaId, contas = [],
  onDescontoChange, onFreteChange, onTaxaChange, onParcelasChange,
  onFormaPagamentoChange, onRegistrarPagamento, onExcluirPagamento, isRegistrando,
}: Props) {
  const [showNovoPag, setShowNovoPag]     = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [novoPag, setNovoPag] = useState<{ valor: number; forma: string; data: string; obs: string; parcelas: number; contaId: string }>({
    valor: 0, forma: formaPagamento || 'PIX',
    data: new Date().toISOString().slice(0, 10), obs: '', parcelas: 1, contaId: '',
  });

  const contasAtivas  = contas.filter(c => c.ativo);
  // Dinheiro só pode ir pro caixa físico; qualquer outra forma (Pix, cartão,
  // transferência...) nunca pode cair na conta Caixa — senão o dinheiro some
  // do Resumo Financeiro sem aparecer em conta nenhuma de verdade, e o
  // Fluxo de Caixa (que é só dinheiro físico) mostraria um pagamento que
  // na real nunca passou pela gaveta do caixa.
  const contasCompativeis = novoPag.forma === 'Dinheiro'
    ? contasAtivas.filter(c => c.tipo === 'caixa')
    : contasAtivas.filter(c => c.tipo !== 'caixa');
  const contasDaForma = contasCompativeis.filter(c => (c.formas_aceitas ?? []).includes(novoPag.forma));
  const opcoesConta   = contasDaForma.length > 0 ? contasDaForma : contasCompativeis;

  // Desconto pode ser digitado em R$ ou em % — a pessoa escolhe. Por baixo
  // dos panos sempre fica salvo como % (mesma coluna de sempre, não bagunça
  // vendas antigas); só a forma de digitar muda. O buffer local de R$ só
  // resincroniza quando "desconto" muda por fora (venda carregando do
  // banco) — nunca quando a mudança veio do próprio campo, senão o
  // arredondamento %→R$→% ficaria brigando com o que a pessoa digitou.
  const [modoDesconto, setModoDesconto] = useState<'valor' | 'pct'>('valor');
  const [descontoValorLocal, setDescontoValorLocal] = useState(() => subtotal > 0 ? subtotal * (desconto / 100) : 0);
  const ultimoDescontoEmitido = useRef(desconto);

  useEffect(() => {
    if (desconto !== ultimoDescontoEmitido.current) {
      ultimoDescontoEmitido.current = desconto;
      setDescontoValorLocal(subtotal > 0 ? subtotal * (desconto / 100) : 0);
    }
  }, [desconto, subtotal]);

  function mudarDescontoValor(v: number) {
    setDescontoValorLocal(v);
    const pct = subtotal > 0 ? Math.min(100, (v / subtotal) * 100) : 0;
    ultimoDescontoEmitido.current = pct;
    onDescontoChange(pct);
  }

  function mudarDescontoPct(v: number) {
    ultimoDescontoEmitido.current = v;
    onDescontoChange(v);
    setDescontoValorLocal(subtotal > 0 ? subtotal * (v / 100) : 0);
  }

  const formas           = parseFormas(cfg?.formas_pagamento).filter(f => f.ativo);
  const formaNovoPag     = formas.find(f => f.nome === novoPag.forma);
  const permiteParc      = formaNovoPag?.permite_parcelamento;
  const maxParcelas      = Math.max(1, formaNovoPag?.max_parcelas ?? 1);
  const taxaPctNovoPag   = getTaxaParcela(formaNovoPag, novoPag.parcelas);
  const valorNovoPag     = novoPag.valor || 0;
  const taxaMaquininha   = calcTotalComTaxa(valorNovoPag, taxaPctNovoPag) - valorNovoPag;

  // Valor líquido de cada pagamento = bruto - taxa maquininha
  const valorLiquidoPago = pagamentos.reduce((s, p) => {
    const taxa = Number(p.juros_pct ?? 0);
    const liq  = taxa > 0
      ? Number(p.valor) * (1 - taxa / 100)
      : Number(p.valor);
    return s + liq;
  }, 0);

  // Taxa total absorvida pela maquininha (não é restante — é desconto definitivo)
  const taxaTotalAbsorvida = pagamentos.reduce((s, p) => {
    const taxa = Number(p.juros_pct ?? 0);
    return taxa > 0 ? s + Number(p.valor) * (taxa / 100) : s;
  }, 0);

  const descontoValor = subtotal * (desconto / 100);
  const totalBase     = subtotal - descontoValor + Number(frete || 0) + Number(taxaAdicional || 0);
  // Total efetivo = total da venda menos taxa da maquininha absorvida
  const totalEfetivo  = totalBase - taxaTotalAbsorvida;
  const valorRestante = Math.max(0, totalEfetivo - valorLiquidoPago);
  const quitado       = totalEfetivo > 0 && valorRestante <= 0.01;
  const pctPago       = totalEfetivo > 0 ? Math.min(100, (valorLiquidoPago / totalEfetivo) * 100) : 0;

  async function handleRegistrar() {
    if (!vendaId || !novoPag.valor || !novoPag.contaId) return;
    await onRegistrarPagamento({
      venda_id:        vendaId,
      valor:           novoPag.valor,
      forma_pagamento: novoPag.forma,
      conta_id:        novoPag.contaId,
      parcelas:        permiteParc && novoPag.parcelas > 1 ? novoPag.parcelas : null,
      juros_pct:       taxaPctNovoPag > 0 ? taxaPctNovoPag : null,
      data_pagamento:  novoPag.data,
      observacoes:     novoPag.obs || null,
      usuario_id:      null,
      usuario_nome:    null,
    });
    setNovoPag({ valor: 0, forma: formaPagamento || 'PIX', data: new Date().toISOString().slice(0, 10), obs: '', parcelas: 1, contaId: '' });
    setShowNovoPag(false);
  }

  return (
    <div className="bg-[#1f2937] border border-gray-700 border-t-2 border-t-green-500 rounded-xl overflow-hidden">

      {/* ══ LINHA ÚNICA: título + campos + pagamento + total ══ */}
      <div className="px-4 py-3 flex items-center gap-4 flex-wrap">

        {/* Título */}
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
          <DollarSign className="w-3 h-3 text-green-400" /> Resumo Financeiro
        </span>

        <div className="w-px h-4 bg-gray-700 flex-shrink-0" />

        {/* Subtotal */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Subtotal</span>
          <span className="text-xs font-bold text-white">{fmtBRL(subtotal)}</span>
        </div>

        {/* Desconto — a pessoa escolhe se digita em R$ ou em %. Guardado
            sempre como % no banco (coluna de sempre), só a forma de
            digitar muda. */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Desconto</span>
          <div className="flex items-center bg-[#111827] border border-gray-700 rounded-md overflow-hidden text-[9px] font-bold">
            <button type="button"
              onClick={() => setModoDesconto('valor')}
              className={`px-1.5 py-1 transition-colors ${modoDesconto === 'valor' ? 'bg-blue-500/30 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}
            >
              R$
            </button>
            <button type="button"
              onClick={() => setModoDesconto('pct')}
              className={`px-1.5 py-1 transition-colors ${modoDesconto === 'pct' ? 'bg-blue-500/30 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}
            >
              %
            </button>
          </div>
          {modoDesconto === 'valor' ? (
            <MoneyInput
              value={descontoValorLocal}
              onChange={mudarDescontoValor}
              className={IN_SM}
              style={{ width: 88 }}
              placeholder="0,00"
            />
          ) : (
            <PctInput
              value={desconto}
              onChange={mudarDescontoPct}
              className={IN_SM}
              style={{ width: 72 }}
              placeholder="0"
            />
          )}
          {desconto > 0 && (
            <span className="text-[9px] text-gray-600">
              ({modoDesconto === 'valor'
                ? `${desconto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                : fmtBRL(subtotal * (desconto / 100))})
            </span>
          )}
        </div>

        {/* Frete */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Frete (R$)</span>
          <MoneyInput
            value={frete}
            onChange={onFreteChange}
            className={IN_SM}
            style={{ width: 88 }}
            placeholder="0,00"
          />
        </div>

        {/* Taxas */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Taxas (R$)</span>
          <MoneyInput
            value={taxaAdicional}
            onChange={onTaxaChange}
            className={IN_SM}
            style={{ width: 88 }}
            placeholder="0,00"
          />
        </div>

        <div className="w-px h-4 bg-gray-700 flex-shrink-0" />

        {/* Pagamento */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Recebido líquido</span>
          <span className="text-xs font-black text-green-400">{fmtBRL(valorLiquidoPago)}</span>
          {quitado ? (
            <span className="text-xs font-black text-green-400">QUITADO ✓</span>
          ) : (
            <span className="text-xs font-black text-yellow-400">{fmtBRL(valorRestante)} restante</span>
          )}
        </div>

        {/* Histórico */}
        {pagamentos.length > 0 && (
          <button
            onClick={() => setShowHistorico(v => !v)}
            className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            Histórico ({pagamentos.length})
            {showHistorico ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Total efetivo */}
        <span className="text-xl font-black text-green-400 flex-shrink-0">
          {fmtBRL(totalEfetivo)}
          {taxaTotalAbsorvida > 0 && (
            <span className="ml-1 text-[10px] font-normal text-gray-500 line-through">{fmtBRL(totalBase)}</span>
          )}
        </span>

        {/* Botão Registrar */}
        {vendaId && (
          <button
            onClick={() => {
              const abrindo = !showNovoPag;
              setShowNovoPag(abrindo);
              if (abrindo) setNovoPag(prev => ({ ...prev, valor: Number(valorRestante.toFixed(2)) }));
            }}
            className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all flex-shrink-0"
          >
            <Plus className="w-3 h-3" /> Registrar
          </button>
        )}
      </div>

      {/* Barra de progresso */}
      <div className="h-0.5 bg-gray-800">
        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${pctPago}%` }} />
      </div>

      {showHistorico && pagamentos.length > 0 && (
        <div className="border-t border-gray-700/60 divide-y divide-gray-800">
          {pagamentos.map(p => {
            const taxa    = Number(p.juros_pct ?? 0);
            const bruto   = Number(p.valor);
            const liq     = taxa > 0 ? bruto * (1 - taxa / 100) : bruto;
            const taxaVal = bruto - liq;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-800/20 transition-colors">
                <div className="w-6 h-6 rounded-md bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-3 h-3 text-green-400" />
                </div>
                <div className="flex-shrink-0">
                  <span className="text-sm font-black text-green-400">{fmtBRL(liq)}</span>
                  {taxa > 0 && (
                    <span className="ml-1.5 text-[10px] text-gray-500">
                      (bruto {fmtBRL(bruto)} − taxa {taxa}% = <span className="text-red-400">−{fmtBRL(taxaVal)}</span>)
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {p.forma_pagamento}{p.parcelas && p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}
                </span>
                <span className="text-[10px] text-gray-500 flex items-center gap-1 flex-shrink-0">
                  <Calendar className="w-3 h-3" /> {fmtData(p.data_pagamento)}
                </span>
                {p.usuario_nome && (
                  <span className="text-[10px] text-gray-500 flex items-center gap-1 flex-shrink-0">
                    <User className="w-3 h-3" /> {p.usuario_nome}
                  </span>
                )}
                {p.observacoes && <span className="text-[10px] text-gray-500 truncate">{p.observacoes}</span>}
                <div className="flex-1" />
                {vendaId && (
                  <button onClick={() => onExcluirPagamento(p.id, vendaId)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Form novo pagamento ══ */}
      {showNovoPag && vendaId && (
        <div className="border-t border-gray-700 px-4 py-4 space-y-3">
          <p className="text-[10px] font-bold text-green-400 uppercase">Novo Pagamento</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Valor (R$) *</label>
              <MoneyInput value={novoPag.valor}
                onChange={v => setNovoPag(f => ({ ...f, valor: v }))}
                className={IN} placeholder="0,00" autoFocus />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Data</label>
              <DateInput value={novoPag.data}
                onChange={v => setNovoPag(f => ({ ...f, data: v }))}
                className={IN} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Forma</label>
              <DarkSelect
                value={novoPag.forma}
                onChange={v => {
                  const compat = v === 'Dinheiro'
                    ? contasAtivas.filter(c => c.tipo === 'caixa')
                    : contasAtivas.filter(c => c.tipo !== 'caixa');
                  const opcoes = compat.filter(c => (c.formas_aceitas ?? []).includes(v));
                  const auto = (opcoes.length === 1 ? opcoes[0] : compat.length === 1 ? compat[0] : null)?.id ?? '';
                  setNovoPag(f => ({ ...f, forma: v, parcelas: 1, contaId: auto }));
                }}
                allowEmpty={false}
                options={formas.map(f => f.nome)}
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Conta *</label>
              {opcoesConta.length === 0 ? (
                <span className="text-[10px] text-yellow-400">Cadastre uma conta em Configurações</span>
              ) : (
                <DarkSelect
                  value={novoPag.contaId}
                  onChange={v => setNovoPag(f => ({ ...f, contaId: v }))}
                  allowEmpty
                  options={opcoesConta.map(c => ({ value: c.id, label: c.nome }))}
                />
              )}
            </div>
            {permiteParc && maxParcelas > 1 ? (
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Parcelas</label>
                <DarkSelect
                  value={String(novoPag.parcelas)}
                  onChange={v => setNovoPag(f => ({ ...f, parcelas: parseInt(v) }))}
                  allowEmpty={false}
                  options={Array.from({ length: maxParcelas }, (_, i) => {
                    const parcelas = i + 1;
                    const taxa = getTaxaParcela(formaNovoPag, parcelas);
                    return {
                      value: String(parcelas),
                      label: `${parcelas}x${taxa > 0 ? ` (+${taxa.toLocaleString('pt-BR')}%)` : ' sem juros'}`,
                    };
                  })}
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Observações</label>
                <input value={novoPag.obs}
                  onChange={e => setNovoPag(f => ({ ...f, obs: e.target.value }))}
                  className={IN} placeholder="Opcional" />
              </div>
            )}
          </div>
          {taxaPctNovoPag > 0 && (
            <div className="flex justify-between items-center text-[10px] bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <span className="text-gray-400">Taxa maquininha ({taxaPctNovoPag.toLocaleString('pt-BR')}%)</span>
              <span className="text-red-400 font-bold">- {fmtBRL(taxaMaquininha)}</span>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNovoPag(false)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-bold">
              Cancelar
            </button>
            <button onClick={handleRegistrar} disabled={isRegistrando || !novoPag.valor || !novoPag.contaId}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold">
              {isRegistrando ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
