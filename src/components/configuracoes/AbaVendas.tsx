// src/components/configuracoes/AbaVendas.tsx
//
// CORREÇÃO: formas_pagamento vindo do banco pode ser string JSON ou objeto,
// não necessariamente um array. Adicionado parse seguro em todas as ocorrências.

import { useState } from 'react';
import {
  Configuracoes,
  FormasPagamentoConfig,
  TaxaParcela,
  FORMAS_PAGAMENTO_DEFAULT,
  gerarTabelaTaxas,
} from '../../types/configuracoes';
import {
  Plus, Trash2, CreditCard, ShoppingCart, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { MoneyInput } from '../ui/MoneyInput';

const IN   = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const IN_N = IN + " [appearance:textfield]";
const IN_SM = "bg-[#0d1117] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full text-right [appearance:textfield]";

// ── Parse seguro: aceita array, string JSON ou null/undefined ────────────────
function parseFormas(raw: any): FormasPagamentoConfig[] {
  if (!raw) return FORMAS_PAGAMENTO_DEFAULT;

  // Já é array
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw : FORMAS_PAGAMENTO_DEFAULT;
  }

  // É string JSON (às vezes o Supabase retorna jsonb como string)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignora erro de parse
    }
    return FORMAS_PAGAMENTO_DEFAULT;
  }

  // É objeto mas não array (caso raro de jsonb mal formado)
  return FORMAS_PAGAMENTO_DEFAULT;
}

// ── Garante que tabela_taxas existe e é array (e dias_uteis_liquidacao existe,
// pra formas salvas antes desse campo existir) ──────────────────────────────
function normalizarForma(f: FormasPagamentoConfig): FormasPagamentoConfig {
  return {
    ...f,
    tabela_taxas: Array.isArray(f.tabela_taxas)
      ? f.tabela_taxas
      : gerarTabelaTaxas(f.max_parcelas || 1),
    dias_uteis_liquidacao: f.dias_uteis_liquidacao ?? 0,
  };
}

// ── Editor da tabela de taxas ────────────────────────────────────────────────
function TabelaTaxasEditor({
  forma,
  onChange,
}: {
  forma: FormasPagamentoConfig;
  onChange: (f: FormasPagamentoConfig) => void;
}) {
  const tabela = Array.isArray(forma.tabela_taxas) ? forma.tabela_taxas : [];

  function setTaxa(parcelas: number, taxa: number) {
    const next = tabela.map(t =>
      t.parcelas === parcelas ? { ...t, taxa_pct: taxa } : t
    );
    onChange({ ...forma, tabela_taxas: next });
  }

  function setMaxParcelas(max: number) {
    const nextTabela: TaxaParcela[] = Array.from({ length: max }, (_, i) => {
      const n = i + 1;
      const existente = tabela.find(t => t.parcelas === n);
      return existente ?? { parcelas: n, taxa_pct: 0 };
    });
    onChange({ ...forma, max_parcelas: max, tabela_taxas: nextTabela });
  }

  function exemploParcela(n: number, taxa: number): string {
    const totalComTaxa = 100 * (1 + taxa / 100);
    const valorParcela = totalComTaxa / n;
    return valorParcela.toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL',
    });
  }

  const maxOpcoes = [1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48];

  return (
    <div className="mt-3 space-y-3">
      {/* Máximo de parcelas */}
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-bold text-gray-500 uppercase flex-shrink-0">
          Máx. parcelas
        </label>
        <select
          value={forma.max_parcelas}
          onChange={e => setMaxParcelas(parseInt(e.target.value))}
          className="bg-[#0d1117] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
        >
          {maxOpcoes.map(n => (
            <option key={n} value={n}>{n}x</option>
          ))}
        </select>
        <span className="text-[10px] text-gray-600">
          Ajuste para exibir as linhas abaixo.
        </span>
      </div>

      {/* Tabela de taxas */}
      <div className="rounded-xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div
          className="grid text-[9px] font-bold text-gray-500 uppercase bg-gray-800/60 border-b border-gray-700 px-3 py-2"
          style={{ gridTemplateColumns: '80px 110px 1fr 110px' }}
        >
          <span>Parcelas</span>
          <span className="text-right">Taxa (%)</span>
          <span className="px-3">Observação</span>
          <span className="text-right">Exemplo (R$100)</span>
        </div>

        {/* Linhas */}
        <div className="divide-y divide-gray-800">
          {tabela.map(t => {
            const taxa   = t.taxa_pct ?? 0;
            const isZero = taxa === 0;
            return (
              <div
                key={t.parcelas}
                className="grid items-center px-3 py-2 hover:bg-gray-800/20 transition-colors"
                style={{ gridTemplateColumns: '80px 110px 1fr 110px' }}
              >
                {/* Nº parcelas */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{t.parcelas}x</span>
                  {t.parcelas === 1 && (
                    <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full font-bold">
                      à vista
                    </span>
                  )}
                </div>

                {/* Taxa % */}
                <div className="flex items-center gap-1 justify-end">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxa || ''}
                    onChange={e => setTaxa(t.parcelas, parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className={IN_SM}
                    style={{ maxWidth: 80 }}
                  />
                  <span className="text-[10px] text-gray-500 flex-shrink-0">%</span>
                </div>

                {/* Observação automática */}
                <div className="px-3">
                  <span className={`text-[10px] ${isZero ? 'text-green-400' : 'text-yellow-400'}`}>
                    {isZero
                      ? (t.parcelas === 1 ? 'Sem acréscimo' : 'Sem juros')
                      : `+${taxa.toLocaleString('pt-BR')}% sobre o total`}
                  </span>
                </div>

                {/* Exemplo */}
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-300">
                    {t.parcelas}x {exemploParcela(t.parcelas, taxa)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
        <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-blue-300">
          <strong>Exemplo</strong> mostra como ficaria um pedido de R$100,00.
          Taxa 0% = sem acréscimo ao cliente.
        </p>
      </div>
    </div>
  );
}

// ── Card de uma forma de pagamento ───────────────────────────────────────────
function FormaCard({
  forma,
  onChange,
  onRemover,
}: {
  forma: FormasPagamentoConfig;
  onChange: (f: FormasPagamentoConfig) => void;
  onRemover: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  // Garante que a forma está normalizada
  const formaNorm = normalizarForma(forma);

  function toggleParcelamento() {
    const next = !formaNorm.permite_parcelamento;
    if (next && formaNorm.tabela_taxas.length === 0) {
      onChange({
        ...formaNorm,
        permite_parcelamento: true,
        tabela_taxas: gerarTabelaTaxas(formaNorm.max_parcelas || 12),
      });
    } else {
      onChange({ ...formaNorm, permite_parcelamento: next });
    }
  }

  const temTaxasConfiguradas = formaNorm.tabela_taxas.some(t => t.taxa_pct > 0);

  return (
    <div className={`border rounded-xl transition-colors ${
      formaNorm.ativo ? 'bg-[#111827] border-gray-700' : 'bg-gray-800/20 border-gray-800'
    }`}>
      {/* Linha principal */}
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
        {/* Nome + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${formaNorm.ativo ? 'text-white' : 'text-gray-500'}`}>
              {formaNorm.nome}
            </span>
            {formaNorm.permite_parcelamento && (
              <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                até {formaNorm.max_parcelas}x
              </span>
            )}
            {temTaxasConfiguradas && (
              <span className="text-[9px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">
                com acréscimo
              </span>
            )}
            {!formaNorm.ativo && (
              <span className="text-[9px] font-bold bg-gray-500/20 text-gray-500 border border-gray-600/30 px-1.5 py-0.5 rounded-full">
                inativo
              </span>
            )}
          </div>
        </div>

        {/* Dias úteis pra compensar */}
        <div className="flex items-center gap-1.5 flex-shrink-0" title="Depois de quantos dias úteis o valor realmente cai/compensa (dinheiro e PIX geralmente é 0 — na hora)">
          <span className="text-[10px] text-gray-500 whitespace-nowrap">Compensa em</span>
          <input
            type="number" min="0" step="1"
            value={formaNorm.dias_uteis_liquidacao ?? 0}
            onChange={e => onChange({ ...formaNorm, dias_uteis_liquidacao: Math.max(0, parseInt(e.target.value) || 0) })}
            className="bg-[#0d1117] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-blue-500 [appearance:textfield]"
            style={{ width: 44 }}
          />
          <span className="text-[10px] text-gray-500 whitespace-nowrap">dia(s) útil(eis)</span>
        </div>

        {/* Toggle ativo */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500">Ativo</span>
          <button
            onClick={() => onChange({ ...formaNorm, ativo: !formaNorm.ativo })}
            className={`w-10 h-5 rounded-full relative transition-all ${
              formaNorm.ativo ? 'bg-green-600' : 'bg-gray-700'
            }`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              formaNorm.ativo ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Toggle parcelamento */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-500">Parcela</span>
          <button
            onClick={toggleParcelamento}
            className={`w-10 h-5 rounded-full relative transition-all ${
              formaNorm.permite_parcelamento ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              formaNorm.permite_parcelamento ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Expandir tabela de taxas */}
        {formaNorm.permite_parcelamento && (
          <button
            onClick={() => setAberto(!aberto)}
            className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0 px-2 py-1 rounded-lg hover:bg-blue-500/10"
          >
            {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {aberto ? 'Fechar' : 'Taxas'}
          </button>
        )}

        {/* Excluir */}
        <button
          onClick={onRemover}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Remover forma"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabela de taxas expansível */}
      {aberto && formaNorm.permite_parcelamento && (
        <div className="px-4 pb-4 border-t border-gray-700/60">
          <TabelaTaxasEditor forma={formaNorm} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
interface Props {
  form: Partial<Configuracoes>;
  set: (field: keyof Configuracoes, val: any) => void;
}

export function AbaVendas({ form, set }: Props) {
  // CORREÇÃO PRINCIPAL: parse seguro do campo formas_pagamento
  const formas = parseFormas(form.formas_pagamento);

  const [novaForma, setNovaForma] = useState('');

  function atualizarForma(idx: number, nova: FormasPagamentoConfig) {
    const next = formas.map((f, i) => i === idx ? nova : f);
    set('formas_pagamento', next);
  }

  function removerForma(idx: number) {
    set('formas_pagamento', formas.filter((_, i) => i !== idx));
  }

  function adicionarForma() {
    if (!novaForma.trim()) return;
    const nova: FormasPagamentoConfig = {
      nome: novaForma.trim(),
      ativo: true,
      permite_parcelamento: false,
      max_parcelas: 1,
      tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
      dias_uteis_liquidacao: 0,
    };
    set('formas_pagamento', [...formas, nova]);
    setNovaForma('');
  }

  const num = (field: keyof Configuracoes) =>
    (form[field] as number | null | undefined) ?? '';

  return (
    <div className="space-y-6">

      {/* ── Padrões de Venda ── */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Padrões de Venda
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">
              Prazo padrão de entrega (dias)
            </label>
            <input
              type="number" min="0" step="1"
              value={num('venda_prazo_entrega_dias')}
              onChange={e => set('venda_prazo_entrega_dias', parseInt(e.target.value) || null)}
              className={IN_N}
              placeholder="Ex: 5"
            />
            <p className="text-[10px] text-gray-600 mt-1">Sugerido ao criar nova venda.</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">
              Frete padrão (R$)
            </label>
            <MoneyInput
              value={num('venda_frete_padrao')}
              onChange={v => set('venda_frete_padrao', v || null)}
              className={IN_N}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">
              Taxa adicional padrão (R$)
            </label>
            <MoneyInput
              value={num('venda_taxa_adicional_padrao')}
              onChange={v => set('venda_taxa_adicional_padrao', v || null)}
              className={IN_N}
              placeholder="0,00"
            />
          </div>
        </div>
      </div>

      {/* ── Formas de Pagamento ── */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Formas de Pagamento
          </h3>
          <p className="text-[10px] text-gray-500 mt-1.5">
            Para formas com parcelamento, ative o toggle <strong className="text-blue-400">Parcela</strong> e
            clique em <strong className="text-blue-400">Taxas</strong> para definir a taxa de cada parcela individualmente.
          </p>
        </div>

        <div className="space-y-2 mb-4">
          {formas.map((f, idx) => (
            <FormaCard
              key={`${f.nome}-${idx}`}
              forma={f}
              onChange={nova => atualizarForma(idx, nova)}
              onRemover={() => removerForma(idx)}
            />
          ))}
        </div>

        {/* Adicionar nova forma */}
        <div className="flex gap-2">
          <input
            value={novaForma}
            onChange={e => setNovaForma(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') adicionarForma(); }}
            placeholder="Nome da nova forma (ex: Crediário próprio)"
            className="flex-1 bg-[#111827] border border-dashed border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={adicionarForma}
            disabled={!novaForma.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
