// src/components/vendas/PainelFinanceiro.tsx
import { useState, useEffect } from 'react';
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
import { DollarSign, Plus, Trash2, Lock, Unlock } from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';
import { DateInput } from '../ui/DateInput';
import { DarkSelect } from '../ui/DarkSelect';
import { useRole } from '../../hooks/useRole';
import { supabase } from '../../lib/supabase';

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

/** Uma linha da tabela de parcelas ainda não persistida (rascunho). Só vira
 * um pagamento de verdade (com todos os efeitos financeiros) quando a venda
 * é salva E o status dela está 'recebido'. */
export type RascunhoParcela = Omit<PagamentoVenda, 'created_at'> & {
  status: 'a_receber' | 'recebido';
};

interface Props {
  subtotal: number;
  desconto: number;
  frete: number;
  taxaAdicional: number;
  formaPagamento: string;
  /** Pagamentos já persistidos no banco (travados — só editáveis via reabrir). */
  pagamentos: PagamentoVenda[];
  /** Parcelas ainda não salvas — editáveis livremente, inclusive o toggle. */
  rascunhos: RascunhoParcela[];
  cfg?: Configuracoes | null;
  vendaId?: string | null;
  contas?: ContaBancaria[];
  onDescontoChange: (v: number) => void;
  onFreteChange: (v: number) => void;
  onTaxaChange: (v: number) => void;
  onRascunhosChange: (rascunhos: RascunhoParcela[]) => void;
  onReabrirPagamento: (pagamento: PagamentoVenda) => void;
  /** true enquanto os pagamentos já salvos ainda estão sendo carregados do
   * banco (venda existente, primeira leitura) — evita que a auto-criação de
   * parcela rode com base num "restante" ainda incompleto/zerado. */
  carregandoPagamentos?: boolean;
  isSalvando?: boolean;
}

const IN_SM = "bg-[#111827] border border-gray-700 rounded-md px-2.5 py-1 text-white text-xs text-right focus:outline-none focus:border-blue-500 [color-scheme:dark]";

function novaParcelaBase(valor: number, formaPadrao: string): RascunhoParcela {
  return {
    id: crypto.randomUUID(),
    venda_id: '',
    valor: Math.max(0, Number(valor.toFixed(2))),
    forma_pagamento: formaPadrao || 'PIX',
    conta_id: '',
    parcelas: null,
    juros_pct: null,
    data_pagamento: new Date().toISOString().slice(0, 10),
    observacoes: null,
    usuario_id: null,
    usuario_nome: null,
    status: 'a_receber',
  };
}

export function PainelFinanceiro({
  subtotal, desconto, frete, taxaAdicional, formaPagamento,
  pagamentos, rascunhos, cfg, vendaId, contas = [],
  onDescontoChange, onFreteChange, onTaxaChange,
  onRascunhosChange, onReabrirPagamento, carregandoPagamentos, isSalvando,
}: Props) {
  const [modoDesconto, setModoDesconto] = useState<'valor' | 'pct'>('valor');
  const [descontoValorLocal, setDescontoValorLocal] = useState(() => subtotal > 0 ? subtotal * (desconto / 100) : 0);

  useEffect(() => {
    setDescontoValorLocal(subtotal > 0 ? subtotal * (desconto / 100) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desconto, subtotal]);

  function mudarDescontoValor(v: number) {
    setDescontoValorLocal(v);
    onDescontoChange(subtotal > 0 ? Math.min(100, (v / subtotal) * 100) : 0);
  }
  function mudarDescontoPct(v: number) {
    onDescontoChange(v);
    setDescontoValorLocal(subtotal > 0 ? subtotal * (v / 100) : 0);
  }

  // Valor líquido já efetivamente recebido (pagamentos persistidos, travados)
  const valorLiquidoPago = pagamentos.reduce((s, p) => {
    const taxa = Number(p.juros_pct ?? 0);
    return s + (taxa > 0 ? Number(p.valor) * (1 - taxa / 100) : Number(p.valor));
  }, 0);
  const taxaTotalAbsorvida = pagamentos.reduce((s, p) => {
    const taxa = Number(p.juros_pct ?? 0);
    return taxa > 0 ? s + Number(p.valor) * (taxa / 100) : s;
  }, 0);

  const descontoValor = subtotal * (desconto / 100);
  const totalBase     = subtotal - descontoValor + Number(frete || 0) + Number(taxaAdicional || 0);
  const totalEfetivo  = totalBase - taxaTotalAbsorvida;
  const valorRestante = Math.max(0, totalEfetivo - valorLiquidoPago);
  const quitado       = totalEfetivo > 0 && valorRestante <= 0.01;
  const pctPago       = totalEfetivo > 0 ? Math.min(100, (valorLiquidoPago / totalEfetivo) * 100) : 0;

  // ── Auto-gestão da(s) parcela(s) em aberto ──
  // Sempre que sobrar valor não coberto por nenhum pagamento travado nem por
  // nenhum rascunho já lançado, cria (ou ajusta) automaticamente UM rascunho
  // "a receber" pra cobrir a diferença — é isso que faz a aba de pagamento
  // já vir pronta assim que o primeiro item é adicionado, e que faz uma
  // parcela nova aparecer sozinha quando o total sobe numa venda que já
  // estava toda recebida/travada.
  useEffect(() => {
    // Enquanto os pagamentos já salvos dessa venda ainda estão sendo
    // carregados do banco, "valorRestante" está calculado com uma lista
    // vazia (ainda não chegou) — criar parcela com base nisso geraria uma
    // parcela fantasma assim que os dados reais chegassem. Só roda depois
    // que o carregamento inicial termina.
    if (carregandoPagamentos) return;

    const somaRascunhos = rascunhos.reduce((s, r) => s + Number(r.valor || 0), 0);
    const diferenca = Math.round((valorRestante - somaRascunhos) * 100) / 100;

    if (diferenca > 0.01 && rascunhos.length === 0) {
      onRascunhosChange([novaParcelaBase(diferenca, formaPagamento)]);
      return;
    }
    // Se a diferença mudou (ex: adicionou item novo) e existe exatamente um
    // rascunho ainda "a receber" sem edição manual de forma/conta, ajusta o
    // valor dele sozinho, sem mexer no que já foi digitado quando há mais de um.
    if (rascunhos.length === 1 && rascunhos[0].status === 'a_receber' && Math.abs(diferenca) > 0.01) {
      const unico = rascunhos[0];
      onRascunhosChange([{ ...unico, valor: Math.max(0, Number((unico.valor + diferenca).toFixed(2))) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorRestante, carregandoPagamentos]);

  function atualizarLinha(id: string, patch: Partial<RascunhoParcela>) {
    onRascunhosChange(rascunhos.map(r => r.id === id ? { ...r, ...patch } : r));
  }
  function removerLinha(id: string) {
    onRascunhosChange(rascunhos.filter(r => r.id !== id));
  }
  function adicionarLinha() {
    onRascunhosChange([...rascunhos, novaParcelaBase(0, formaPagamento)]);
  }
  function toggleStatus(id: string) {
    onRascunhosChange(rascunhos.map(r => r.id === id
      ? { ...r, status: r.status === 'a_receber' ? 'recebido' : 'a_receber' }
      : r));
  }

  const formas = parseFormas(cfg?.formas_pagamento).filter(f => f.ativo);
  const totalLinhas = pagamentos.length + rascunhos.length;

  return (
    <div className="bg-[#1f2937] border border-gray-700 border-t-2 border-t-green-500 rounded-xl overflow-hidden">

      {/* ══ LINHA ÚNICA: título + campos + total ══ */}
      <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
          <DollarSign className="w-3 h-3 text-green-400" /> Resumo Financeiro
        </span>

        <div className="w-px h-4 bg-gray-700 flex-shrink-0" />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Subtotal</span>
          <span className="text-xs font-bold text-white">{fmtBRL(subtotal)}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Desconto</span>
          <div className="flex items-center bg-[#111827] border border-gray-700 rounded-md overflow-hidden text-[9px] font-bold">
            <button type="button" onClick={() => setModoDesconto('valor')}
              className={`px-1.5 py-1 transition-colors ${modoDesconto === 'valor' ? 'bg-blue-500/30 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}>R$</button>
            <button type="button" onClick={() => setModoDesconto('pct')}
              className={`px-1.5 py-1 transition-colors ${modoDesconto === 'pct' ? 'bg-blue-500/30 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}>%</button>
          </div>
          {modoDesconto === 'valor' ? (
            <MoneyInput value={descontoValorLocal} onChange={mudarDescontoValor} className={IN_SM} style={{ width: 88 }} placeholder="0,00" />
          ) : (
            <MoneyInput value={desconto} onChange={mudarDescontoPct} className={IN_SM} style={{ width: 72 }} placeholder="0" />
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Frete (R$)</span>
          <MoneyInput value={frete} onChange={onFreteChange} className={IN_SM} style={{ width: 88 }} placeholder="0,00" />
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Taxas (R$)</span>
          <MoneyInput value={taxaAdicional} onChange={onTaxaChange} className={IN_SM} style={{ width: 88 }} placeholder="0,00" />
        </div>

        <div className="w-px h-4 bg-gray-700 flex-shrink-0" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-gray-500 uppercase">Recebido líquido</span>
          <span className="text-xs font-black text-green-400">{fmtBRL(valorLiquidoPago)}</span>
          {quitado ? (
            <span className="text-xs font-black text-green-400">QUITADO ✓</span>
          ) : (
            <span className="text-xs font-black text-yellow-400">{fmtBRL(valorRestante)} restante</span>
          )}
        </div>

        <div className="flex-1" />

        <span className="text-xl font-black text-green-400 flex-shrink-0">
          {fmtBRL(totalEfetivo)}
          {taxaTotalAbsorvida > 0 && (
            <span className="ml-1 text-[10px] font-normal text-gray-500 line-through">{fmtBRL(totalBase)}</span>
          )}
        </span>

        {vendaId && (
          <button onClick={adicionarLinha}
            className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-all flex-shrink-0">
            <Plus className="w-3 h-3" /> Adicionar parcela
          </button>
        )}
      </div>

      <div className="h-0.5 bg-gray-800">
        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${pctPago}%` }} />
      </div>

      {/* ══ Tabela de parcelas — sempre visível, sem precisar clicar em nada ══ */}
      {totalLinhas > 0 && (
        <div className="border-t border-gray-700/60 divide-y divide-gray-800">
          <div className="grid grid-cols-[1.75rem_1fr_1fr_1fr_1fr_1fr_1.75rem] gap-2 px-4 py-1.5 text-[9px] font-bold text-gray-500 uppercase">
            <span>#</span><span>Valor Total</span><span>Data de Pagamento</span><span>Forma de Pagamento</span><span>Conta</span><span>Status</span><span />
          </div>

          {pagamentos.map((p, i) => (
            <LinhaTravada key={p.id} indice={i + 1} total={totalLinhas} pagamento={p}
              contas={contas} onReabrir={() => onReabrirPagamento(p)} />
          ))}

          {rascunhos.map((r, i) => (
            <LinhaRascunho key={r.id} indice={pagamentos.length + i + 1} total={totalLinhas}
              linha={r} contas={contas} formas={formas}
              onChange={patch => atualizarLinha(r.id, patch)}
              onRemover={() => removerLinha(r.id)}
              onToggle={() => toggleStatus(r.id)}
            />
          ))}
        </div>
      )}

      {isSalvando && (
        <div className="px-4 py-2 text-[10px] text-blue-300 bg-blue-500/10 border-t border-blue-500/20">
          Salvando parcelas marcadas como recebido...
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Linha já persistida no banco — travada. Só o cadeado é clicável.
// ─────────────────────────────────────────────────────────────────────────
function LinhaTravada({ indice, total, pagamento, contas, onReabrir }: {
  indice: number; total: number; pagamento: PagamentoVenda; contas: ContaBancaria[]; onReabrir: () => void;
}) {
  const conta = contas.find(c => c.id === pagamento.conta_id);
  return (
    <div className="grid grid-cols-[1.75rem_1fr_1fr_1fr_1fr_1fr_1.75rem] gap-2 px-4 py-2 items-center opacity-80">
      <span className="text-[10px] text-gray-500">{indice}/{total}</span>
      <span className="text-xs font-bold text-white">{fmtBRL(pagamento.valor)}</span>
      <span className="text-xs text-gray-400">{new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR')}</span>
      <span className="text-xs text-gray-400">{pagamento.forma_pagamento}{pagamento.parcelas && pagamento.parcelas > 1 ? ` (${pagamento.parcelas}x)` : ''}</span>
      <span className="text-xs text-gray-400 truncate">{conta?.nome ?? '—'}</span>
      <button onClick={onReabrir}
        className="flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1 bg-blue-600/90 text-white rounded-md cursor-pointer hover:bg-blue-500 transition-colors">
        <Lock className="w-3 h-3" /> Recebido
      </button>
      <span />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Linha rascunho — totalmente editável até virar "Recebido" + a venda ser salva.
// ─────────────────────────────────────────────────────────────────────────
function LinhaRascunho({ indice, total, linha, contas, formas, onChange, onRemover, onToggle }: {
  indice: number; total: number; linha: RascunhoParcela; contas: ContaBancaria[];
  formas: FormasPagamentoConfig[];
  onChange: (patch: Partial<RascunhoParcela>) => void;
  onRemover: () => void;
  onToggle: () => void;
}) {
  const { isVendedor } = useRole();
  const contasAtivas = contas.filter(c => c.ativo);
  const contasCompativeis = linha.forma_pagamento === 'Dinheiro'
    ? contasAtivas.filter(c => c.tipo === 'caixa')
    : contasAtivas.filter(c => c.tipo !== 'caixa');
  const contasDaForma = contasCompativeis.filter(c => (c.formas_aceitas ?? []).includes(linha.forma_pagamento));
  const opcoesConta = contasDaForma.length > 0 ? contasDaForma : contasCompativeis;

  const [contaPadraoVendedor, setContaPadraoVendedor] = useState<{ id: string; nome: string } | null>(null);
  useEffect(() => {
    if (!isVendedor || !linha.forma_pagamento) { setContaPadraoVendedor(null); return; }
    let cancelado = false;
    supabase.rpc('obter_conta_padrao_pagamento', { p_forma: linha.forma_pagamento }).then(({ data }) => {
      if (cancelado) return;
      const registro = Array.isArray(data) ? data[0] : data;
      const conta = registro ? { id: registro.conta_id, nome: registro.nome } : null;
      setContaPadraoVendedor(conta);
      if (conta?.id && conta.id !== linha.conta_id) onChange({ conta_id: conta.id });
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendedor, linha.forma_pagamento]);

  const formaSelecionada = formas.find(f => f.nome === linha.forma_pagamento);
  const permiteParc = formaSelecionada?.permite_parcelamento;
  const maxParcelas = Math.max(1, formaSelecionada?.max_parcelas ?? 1);
  const taxaPct = getTaxaParcela(formaSelecionada, linha.parcelas || 1);
  const recebido = linha.status === 'recebido';

  return (
    <div className={`grid grid-cols-[1.75rem_1fr_1fr_1fr_1fr_1fr_1.75rem] gap-2 px-4 py-2 items-center ${recebido ? 'bg-blue-500/5' : ''}`}>
      <span className="text-[10px] text-gray-500">{indice}/{total}</span>
      <MoneyInput value={linha.valor} onChange={v => onChange({ valor: v })}
        className="bg-[#111827] border border-gray-700 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 [color-scheme:dark] w-full" placeholder="0,00" />
      <DateInput value={linha.data_pagamento} onChange={v => onChange({ data_pagamento: v })}
        className="bg-[#111827] border border-gray-700 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 [color-scheme:dark] w-full" />
      <DarkSelect size="sm" value={linha.forma_pagamento}
        onChange={v => {
          const compat = v === 'Dinheiro' ? contasAtivas.filter(c => c.tipo === 'caixa') : contasAtivas.filter(c => c.tipo !== 'caixa');
          const opcoes = compat.filter(c => (c.formas_aceitas ?? []).includes(v));
          const auto = (opcoes.length === 1 ? opcoes[0] : compat.length === 1 ? compat[0] : null)?.id ?? '';
          onChange({ forma_pagamento: v, parcelas: null, conta_id: auto });
        }}
        allowEmpty={false} options={formas.map(f => f.nome)} />
      {isVendedor ? (
        <span className="text-xs text-gray-400 truncate">{contaPadraoVendedor?.nome ?? 'Carregando...'}</span>
      ) : opcoesConta.length === 0 ? (
        <span className="text-[10px] text-yellow-400">Cadastre uma conta</span>
      ) : (
        <DarkSelect size="sm" value={linha.conta_id} onChange={v => onChange({ conta_id: v })}
          allowEmpty options={opcoesConta.map(c => ({ value: c.id, label: c.nome }))} />
      )}
      <button onClick={onToggle}
        className={`relative flex items-center rounded-full text-[10px] font-bold px-1 py-1 transition-colors w-full justify-center gap-1 ${
          recebido ? 'bg-blue-600 text-white' : 'bg-[#111827] border border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-300'
        }`}
      >
        {recebido ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        {recebido ? 'Recebido' : 'A receber'}
      </button>
      <button onClick={onRemover} className="text-gray-600 hover:text-red-400 transition-colors flex justify-center">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {permiteParc && maxParcelas > 1 && (
        <div className="col-span-7 -mt-1 flex items-center gap-2 pl-[2.2rem]">
          <span className="text-[9px] text-gray-500 uppercase">Parcelas do cartão</span>
          <DarkSelect size="sm" value={String(linha.parcelas || 1)}
            onChange={v => onChange({ parcelas: parseInt(v), juros_pct: getTaxaParcela(formaSelecionada, parseInt(v)) || null })}
            allowEmpty={false}
            options={Array.from({ length: maxParcelas }, (_, idx) => {
              const n = idx + 1;
              const t = getTaxaParcela(formaSelecionada, n);
              return { value: String(n), label: `${n}x${t > 0 ? ` (+${t.toLocaleString('pt-BR')}%)` : ' sem juros'}` };
            })}
            className="w-40" />
          {taxaPct > 0 && (
            <span className="text-[10px] text-red-400">
              taxa maquininha: -{fmtBRL(calcTotalComTaxa(linha.valor, taxaPct) - linha.valor)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
