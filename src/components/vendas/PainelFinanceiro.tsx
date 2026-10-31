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

const IN_SM = "bg-[#111827] border border-gray-700 rounded-md px-2.5 py-1 text-white text-xs text-right focus:outline-none focus:border-blue-500";

const fmtPct = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

/** Formas que parcelam começam em 1x; as demais (débito, pix...) não têm nº de parcelas. */
function parcelasIniciais(forma?: FormasPagamentoConfig): number | null {
  return forma?.permite_parcelamento && (forma.max_parcelas ?? 1) > 1 ? 1 : null;
}

/** Taxa da maquininha que vale para uma linha de pagamento: a que já está gravada
 * na linha ou, se não houver (linha antiga/rascunho sem taxa), a da configuração. */
export function resolverTaxaRascunho(r: Pick<PagamentoVenda, 'forma_pagamento' | 'parcelas' | 'juros_pct'>, cfg?: Configuracoes | null): number {
  const gravada = Number(r.juros_pct ?? 0);
  if (gravada > 0) return gravada;
  const forma = parseFormas(cfg?.formas_pagamento).find(f => f.nome === r.forma_pagamento);
  return getTaxaParcela(forma, r.parcelas || 1);
}

function novaParcelaBase(valor: number, formaPadrao: string, formas: FormasPagamentoConfig[] = []): RascunhoParcela {
  const nome  = formaPadrao || 'PIX';
  const forma = formas.find(f => f.nome === nome);
  const parc  = parcelasIniciais(forma);
  const taxa  = getTaxaParcela(forma, parc ?? 1);
  return {
    id: crypto.randomUUID(),
    venda_id: '',
    valor: Math.max(0, Number(valor.toFixed(2))),
    forma_pagamento: nome,
    conta_id: '',
    parcelas: parc,
    juros_pct: taxa > 0 ? taxa : null,
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

  const formas = parseFormas(cfg?.formas_pagamento).filter(f => f.ativo);

  // Mesma ideia da linha de cima, mas pras parcelas ainda não salvas: assim que
  // a pessoa escolhe débito/crédito, o total já aparece com a taxa descontada.
  const taxaPrevista = rascunhos.reduce(
    (s, r) => s + Number(r.valor || 0) * resolverTaxaRascunho(r, cfg) / 100, 0);

  const descontoValor = subtotal * (desconto / 100);
  const totalBase     = subtotal - descontoValor + Number(frete || 0) + Number(taxaAdicional || 0);
  const totalEfetivo  = totalBase - taxaTotalAbsorvida;
  // valorRestante fica de fora das taxas previstas de propósito: ele alimenta a
  // criação automática de parcela, e incluir a taxa aqui faria o valor oscilar.
  const valorRestante = Math.max(0, totalEfetivo - valorLiquidoPago);
  const totalComTaxas = totalEfetivo - taxaPrevista;
  const quitado       = totalEfetivo > 0 && valorRestante <= 0.01;
  const pctPago       = totalEfetivo > 0 ? Math.min(100, (valorLiquidoPago / totalEfetivo) * 100) : 0;

  // Sempre a versão mais recente das parcelas, mesmo quando duas linhas
  // alteram o estado no mesmo instante (evita uma sobrescrever a outra).
  const rascunhosRef = useRef(rascunhos);
  rascunhosRef.current = rascunhos;
  function emitirRascunhos(novos: RascunhoParcela[]) {
    rascunhosRef.current = novos;
    onRascunhosChange(novos);
  }

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

    const atuais = rascunhosRef.current;
    const somaRascunhos = atuais.reduce((s, r) => s + Number(r.valor || 0), 0);
    const diferenca = Math.round((valorRestante - somaRascunhos) * 100) / 100;

    if (diferenca > 0.01 && atuais.length === 0) {
      emitirRascunhos([novaParcelaBase(diferenca, formaPagamento, formas)]);
      return;
    }
    // Se a diferença mudou (ex: adicionou item novo) e existe exatamente um
    // rascunho ainda "a receber" sem edição manual de forma/conta, ajusta o
    // valor dele sozinho, sem mexer no que já foi digitado quando há mais de um.
    if (atuais.length === 1 && atuais[0].status === 'a_receber' && Math.abs(diferenca) > 0.01) {
      const unico = atuais[0];
      emitirRascunhos([{ ...unico, valor: Math.max(0, Number((unico.valor + diferenca).toFixed(2))) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorRestante, carregandoPagamentos]);

  function atualizarLinha(id: string, patch: Partial<RascunhoParcela>) {
    emitirRascunhos(rascunhosRef.current.map(r => r.id === id ? { ...r, ...patch } : r));
  }
  function removerLinha(id: string) {
    emitirRascunhos(rascunhosRef.current.filter(r => r.id !== id));
  }
  // A parcela nova já nasce com o que ainda falta pagar (total - o que já foi
  // pago - o que já está nas outras parcelas), na mesma forma de pagamento da
  // última linha. Se já existe uma linha zerada, não cria outra (clique repetido).
  function adicionarLinha() {
    const atuais = rascunhosRef.current;
    if (atuais.some(r => Number(r.valor || 0) <= 0.01)) return;
    const somaRascunhos = atuais.reduce((s, r) => s + Number(r.valor || 0), 0);
    const falta = Math.max(0, Math.round((valorRestante - somaRascunhos) * 100) / 100);
    const formaBase = atuais.length > 0 ? atuais[atuais.length - 1].forma_pagamento : formaPagamento;
    emitirRascunhos([...atuais, novaParcelaBase(falta, formaBase, formas)]);
  }
  function toggleStatus(id: string) {
    emitirRascunhos(rascunhosRef.current.map(r => r.id === id
      ? { ...r, status: r.status === 'a_receber' ? 'recebido' : 'a_receber' }
      : r));
  }

  const totalLinhas = pagamentos.length + rascunhos.length;

  return (
    <div className="bg-[#1f2937] border border-gray-700 border-t-2 border-t-green-500 rounded-xl overflow-hidden">

      {/* ══ LINHA ÚNICA: título + campos + total ══ */}
      <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
          <DollarSign className="w-3 h-3 text-green-400" /> Resumo Financeiro
        </span>

        <div className="w-px h-4 bg-gray-700 flex-shrink-0 max-md:hidden" />

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

        <div className="w-px h-4 bg-gray-700 flex-shrink-0 max-md:hidden" />

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

        <span className="text-xl font-black text-green-400 flex-shrink-0" title={taxaPrevista > 0 ? 'Total já descontando a taxa da maquininha das parcelas' : undefined}>
          {fmtBRL(totalComTaxas)}
          {(taxaTotalAbsorvida + taxaPrevista) > 0.004 && (
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
          <div className="parcela-grid parcela-head grid grid-cols-[1.75rem_1fr_1fr_1fr_1fr_1fr_1.75rem] gap-2 px-4 py-1.5 text-[9px] font-bold text-gray-500 uppercase">
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
    <div className="parcela-grid grid grid-cols-[1.75rem_1fr_1fr_1fr_1fr_1fr_1.75rem] gap-2 px-4 py-2 items-center opacity-80">
      <span className="text-[10px] text-gray-500">{indice}/{total}</span>
      <button onClick={onReabrir} title="Editar o valor: pede pra reabrir o recebimento"
        className="text-xs font-bold text-white text-left hover:text-blue-300 transition-colors cursor-text">{fmtBRL(pagamento.valor)}</button>
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
  const taxaPct = Number(linha.juros_pct ?? 0) > 0
    ? Number(linha.juros_pct)
    : getTaxaParcela(formaSelecionada, linha.parcelas || 1);
  const taxaValor = Number(linha.valor || 0) * taxaPct / 100;
  const recebido = linha.status === 'recebido';

  return (
    <div className={`parcela-grid grid grid-cols-[1.75rem_1fr_1fr_1fr_1fr_1fr_1.75rem] gap-2 px-4 py-2 items-center ${recebido ? 'bg-blue-500/5' : ''}`}>
      <span className="text-[10px] text-gray-500">{indice}/{total}</span>
      <MoneyInput value={linha.valor} onChange={v => onChange({ valor: v })}
        className="bg-[#111827] border border-gray-700 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 w-full" placeholder="0,00" />
      <DateInput value={linha.data_pagamento} onChange={v => onChange({ data_pagamento: v })}
        className="bg-[#111827] border border-gray-700 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 w-full" />
      <DarkSelect size="sm" value={linha.forma_pagamento}
        onChange={v => {
          const compat = v === 'Dinheiro' ? contasAtivas.filter(c => c.tipo === 'caixa') : contasAtivas.filter(c => c.tipo !== 'caixa');
          const opcoes = compat.filter(c => (c.formas_aceitas ?? []).includes(v));
          const auto = (opcoes.length === 1 ? opcoes[0] : compat.length === 1 ? compat[0] : null)?.id ?? '';
          // A taxa da forma escolhida entra sozinha (débito, crédito à vista...),
          // sem depender de mexer no número de parcelas.
          const novaForma = formas.find(f => f.nome === v);
          const parc = parcelasIniciais(novaForma);
          const taxa = getTaxaParcela(novaForma, parc ?? 1);
          onChange({ forma_pagamento: v, parcelas: parc, juros_pct: taxa > 0 ? taxa : null, conta_id: auto });
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
              return { value: String(n), label: `${n}x${t > 0 ? ` (taxa ${fmtPct(t)}%)` : ' sem taxa'}` };
            })}
            className="w-44" />
          {taxaPct > 0 && (
            <span className="text-[10px] text-red-400">
              taxa maquininha {fmtPct(taxaPct)}%: -{fmtBRL(taxaValor)} · líquido {fmtBRL(Number(linha.valor || 0) - taxaValor)}
            </span>
          )}
        </div>
      )}
      {/* Formas que não parcelam (ex: débito) também têm taxa — aparece direto aqui */}
      {!(permiteParc && maxParcelas > 1) && taxaPct > 0 && (
        <div className="col-span-7 -mt-1 pl-[2.2rem]">
          <span className="text-[10px] text-red-400">
            taxa maquininha {fmtPct(taxaPct)}%: -{fmtBRL(taxaValor)} · líquido {fmtBRL(Number(linha.valor || 0) - taxaValor)}
          </span>
        </div>
      )}
    </div>
  );
}
