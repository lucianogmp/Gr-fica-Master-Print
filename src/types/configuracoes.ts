// src/types/configuracoes.ts
import { LayoutImpressaoConfig, LayoutCatalogoConfig } from './layoutImpressao';

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
  /** Template da mensagem de WhatsApp enviada junto com o orçamento — vazio
   * usa o padrão do sistema (MENSAGEM_WHATSAPP_ORC_DEFAULT). Usa tokens entre
   * chaves: {numero} {tipo} {cliente} {itens} {total} {observacoes}. */
  mensagem_whatsapp_orcamento?: string | null;
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
  layout_impressao_catalogo?: LayoutCatalogoConfig | null;
  // Serralheria / Orçamento de Placas (Gestão de Custos → Serralheria)
  mao_obra_serralheria_pct?: number | null;
  mao_obra_instalacao_esticar?: number | null;
  mao_obra_instalacao_completa?: number | null;
  espacamento_travessa_padrao_m?: number | null;
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

/**
 * Template padrão da mensagem de WhatsApp do orçamento. O usuário pode
 * personalizar isso em Configurações → Impressão → Mensagem, editando o
 * texto ao redor dos tokens (sem precisar mexer na formatação dos itens,
 * que é o token opaco {itens}).
 */
export const MENSAGEM_WHATSAPP_ORC_DEFAULT =
`*ORÇAMENTO{numero}*
{tipo}

Cliente: {cliente}

ITENS

{itens}

───────────────
Total do Orçamento: {total}

{observacoes}`;

/** Tokens aceitos no template da mensagem — usado tanto pra montar a
 * mensagem de verdade quanto pra exibir a lista de ajuda na tela de edição. */
export const TOKENS_MENSAGEM_ORC: { token: string; descricao: string }[] = [
  { token: '{numero}',      descricao: 'Número do orçamento (ex: " Nº 42" — some se não tiver número)' },
  { token: '{tipo}',        descricao: 'Tipo/título do orçamento entre asteriscos (some se estiver vazio)' },
  { token: '{cliente}',     descricao: 'Nome do cliente' },
  { token: '{itens}',       descricao: 'Lista dos itens com medidas, quantidade e valores (formato fixo)' },
  { token: '{total}',       descricao: 'Valor total do orçamento, já formatado em R$' },
  { token: '{observacoes}', descricao: 'Linha "Obs: ..." (some se não tiver observação)' },
];

/**
 * Substitui os tokens do template pelos valores reais e limpa o excesso de
 * linhas em branco que sobra quando um token opcional (numero/tipo/observações)
 * vem vazio — assim o usuário não precisa lidar com "if tem isso, mostra
 * aquilo" no template, só escreve o texto ao redor dos tokens.
 */
export function preencherTemplateMensagem(template: string, tokens: Record<string, string>): string {
  let texto = template;
  for (const [chave, valor] of Object.entries(tokens)) {
    texto = texto.split(`{${chave}}`).join(valor ?? '');
  }
  return texto
    .split('\n')
    .map(l => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
