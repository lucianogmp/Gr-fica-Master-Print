// src/types/configuracoes.ts
import { LayoutImpressaoConfig } from './layoutImpressao';

// Taxa por número de parcelas
export interface TaxaParcela {
  parcelas: number;
  taxa_pct: number; // 0 = sem acréscimo
}

// Configuração de uma forma de pagamento
export interface FormasPagamentoConfig {
  nome: string;
  ativo: boolean;
  permite_parcelamento: boolean;
  max_parcelas: number;
  tabela_taxas: TaxaParcela[];
  /** Em quantos dias ÚTEIS o valor efetivamente compensa/fica disponível
   * depois do pagamento (ex: dinheiro/PIX = 0, cartão de débito = 1,
   * boleto = 1...). Usado pra calcular a data real de "caiu na conta",
   * não a data em que o pagamento foi registrado. */
  dias_uteis_liquidacao: number;
}

export interface Configuracoes {
  id: string;
  // Empresa
  empresa_nome?: string | null;
  empresa_razao_social?: string | null;
  empresa_cnpj?: string | null;
  empresa_ie?: string | null;
  empresa_telefone?: string | null;
  empresa_whatsapp?: string | null;
  empresa_email?: string | null;
  empresa_site?: string | null;
  empresa_endereco?: string | null;
  empresa_logo_url?: string | null;
  empresa_rodape?: string | null;
  // Precificação
  prec_margem_premium?: number | null;
  prec_taxa_arte?: number | null;
  prec_taxa_urgencia?: number | null;
  prec_taxa_instalacao?: number | null;
  prec_depreciacao_mensal?: number | null;
  prec_energia_hora?: number | null;
  // Orçamentos
  orc_validade_dias?: number | null;
  orc_obs_padrao?: string | null;
  orc_garantia?: string | null;
  orc_rodape?: string | null;
  // Vendas
  venda_prazo_entrega_dias?: number | null;
  venda_taxa_adicional_padrao?: number | null;
  venda_frete_padrao?: number | null;
  venda_max_parcelas?: number | null;
  venda_juros_parcela?: number | null;
  formas_pagamento?: FormasPagamentoConfig[] | null;
  // Sistema
  sistema_logo_url?: string | null;
  sistema_logo_url_dark?: string | null;
  tema_modo?: string | null;
  // Integrações — Mercado Pago
  mp_access_token?: string | null;
  mp_pix_chave?: string | null;
  mp_webhook_url?: string | null;
  layout_impressao_venda?: LayoutImpressaoConfig | null;
  layout_impressao_orcamento?: LayoutImpressaoConfig | null;
  updated_at?: string;
}

// ── Helpers exportados ────────────────────────────────────────────────────────

/** Gera tabela de taxas zerada para N parcelas */
export function gerarTabelaTaxas(maxParcelas: number): TaxaParcela[] {
  return Array.from({ length: maxParcelas }, (_, i) => ({
    parcelas: i + 1,
    taxa_pct: 0,
  }));
}

/** Retorna a taxa de uma forma para N parcelas (0 se não encontrar) */
export function getTaxaParcela(
  forma: FormasPagamentoConfig | undefined,
  parcelas: number,
): number {
  if (!forma) return 0;
  const entrada = forma.tabela_taxas?.find(t => t.parcelas === parcelas);
  return entrada?.taxa_pct ?? 0;
}

/** Calcula total com acréscimo */
export function calcTotalComTaxa(totalBase: number, taxaPct: number): number {
  return totalBase * (1 + taxaPct / 100);
}

/**
 * Soma N dias ÚTEIS (pula sábado e domingo) a partir de uma data.
 * Ex: sexta-feira + 1 dia útil = segunda-feira, não sábado.
 * `dataBase` no formato 'YYYY-MM-DD'; retorna no mesmo formato.
 */
export function somarDiasUteis(dataBase: string, diasUteis: number): string {
  const d = new Date(dataBase + 'T00:00:00');
  let restantes = Math.max(0, Math.floor(diasUteis));
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const diaSemana = d.getDay(); // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6) restantes--;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Data real de liquidação de um pagamento — pega a data em que o pagamento
 * foi feito e soma os dias úteis configurados pra forma de pagamento usada
 * (0 pra dinheiro/PIX, que caem na hora; N pra cartão/boleto, que demoram
 * pra compensar).
 */
export function calcularDataLiquidacao(
  dataPagamento: string,
  forma: FormasPagamentoConfig | undefined,
): string {
  const dias = forma?.dias_uteis_liquidacao ?? 0;
  return dias > 0 ? somarDiasUteis(dataPagamento, dias) : dataPagamento;
}

/**
 * Parse seguro de formas_pagamento — aceita array, string JSON ou null.
 * Exportado para reuso em Financeiro, PainelFinanceiro, AbaVendas, etc.
 */
export function parseFormas(raw: any): FormasPagamentoConfig[] {
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

/** Formas de pagamento padrão (tabelas zeradas — usuário configura) */
export const FORMAS_PAGAMENTO_DEFAULT: FormasPagamentoConfig[] = [
  {
    nome: 'Dinheiro',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
    dias_uteis_liquidacao: 0,
  },
  {
    nome: 'PIX',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
    dias_uteis_liquidacao: 0,
  },
  {
    nome: 'Cartão de Débito',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
    dias_uteis_liquidacao: 1,
  },
  {
    nome: 'Cartão de Crédito',
    ativo: true,
    permite_parcelamento: true,
    max_parcelas: 12,
    tabela_taxas: gerarTabelaTaxas(12),
    dias_uteis_liquidacao: 1,
  },
  {
    nome: 'Boleto',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
    dias_uteis_liquidacao: 1,
  },
  {
    nome: 'Transferência',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
    dias_uteis_liquidacao: 0,
  },
  {
    nome: 'Cheque',
    ativo: false,
    permite_parcelamento: true,
    max_parcelas: 6,
    tabela_taxas: gerarTabelaTaxas(6),
    dias_uteis_liquidacao: 1,
  },
  {
    nome: 'Crediário',
    ativo: false,
    permite_parcelamento: true,
    max_parcelas: 24,
    tabela_taxas: gerarTabelaTaxas(24),
    dias_uteis_liquidacao: 0,
  },
];
