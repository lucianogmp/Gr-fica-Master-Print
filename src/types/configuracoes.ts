// src/types/configuracoes.ts
import { LayoutImpressaoConfig } from './layoutImpressao';

// Taxa por número de parcelas — cada entrada é uma linha da tabela
export interface TaxaParcela {
  parcelas: number;   // 1, 2, 3, ... 12 (ou mais)
  taxa_pct: number;   // % cobrada do cliente nessa quantidade de parcelas
                      // 0 = sem acréscimo (à vista ou sem juros)
}

// Configuração completa de uma forma de pagamento
export interface FormasPagamentoConfig {
  nome: string;
  ativo: boolean;
  permite_parcelamento: boolean;
  max_parcelas: number;
  // Tabela de taxas: uma linha por número de parcelas
  // Ex: [{parcelas:1, taxa_pct:0}, {parcelas:2, taxa_pct:2.99}, ...]
  tabela_taxas: TaxaParcela[];
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
  prec_horas_mes?: number | null;
  prec_margem_minima?: number | null;
  prec_margem_ideal?: number | null;
  prec_margem_premium?: number | null;
  prec_desconto_max?: number | null;
  prec_min_pedido?: number | null;
  prec_taxa_arte?: number | null;
  prec_taxa_urgencia?: number | null;
  prec_taxa_instalacao?: number | null;
  prec_depreciacao_mensal?: number | null;
  prec_energia_hora?: number | null;
  // Orçamentos
  orc_prefixo?: string | null;
  orc_numero_inicial?: number | null;
  orc_validade_dias?: number | null;
  orc_prazo_producao?: number | null;
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
  sistema_nome?: string | null;
  tema_accent_color?: string | null;
  tema_modo?: string | null;
  // Integrações — Trello
  trello_api_key?: string | null;
  trello_token?: string | null;
  trello_board_id?: string | null;
  trello_list_fila?: string | null;
  trello_list_imprimindo?: string | null;
  trello_list_acabamento?: string | null;
  trello_list_pronto?: string | null;
  // Integrações — Mercado Pago
  mp_access_token?: string | null;
  mp_pix_chave?: string | null;
  mp_webhook_url?: string | null;
  layout_impressao_venda?: LayoutImpressaoConfig | null;
  layout_impressao_orcamento?: LayoutImpressaoConfig | null;
  // Segurança
  seg_tempo_sessao?: number | null;
  updated_at?: string;
}

// Gera tabela de taxas padrão para N parcelas
// (todas zeradas — usuário preenche manualmente)
export function gerarTabelaTaxas(maxParcelas: number): TaxaParcela[] {
  return Array.from({ length: maxParcelas }, (_, i) => ({
    parcelas: i + 1,
    taxa_pct: 0,
  }));
}

// Retorna a taxa de uma forma para N parcelas (0 se não encontrar)
export function getTaxaParcela(
  forma: FormasPagamentoConfig | undefined,
  parcelas: number
): number {
  if (!forma) return 0;
  const entrada = forma.tabela_taxas?.find(t => t.parcelas === parcelas);
  return entrada?.taxa_pct ?? 0;
}

// Calcula o total com acréscimo de parcelamento
export function calcTotalComTaxa(totalBase: number, taxaPct: number): number {
  return totalBase * (1 + taxaPct / 100);
}

// Formas de pagamento padrão (tabela de taxas zerada — usuário configura)
export const FORMAS_PAGAMENTO_DEFAULT: FormasPagamentoConfig[] = [
  {
    nome: 'Dinheiro',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
  },
  {
    nome: 'PIX',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
  },
  {
    nome: 'Cartão de Débito',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
  },
  {
    nome: 'Cartão de Crédito',
    ativo: true,
    permite_parcelamento: true,
    max_parcelas: 12,
    // Taxas zeradas — usuário preenche conforme sua maquininha
    tabela_taxas: gerarTabelaTaxas(12),
  },
  {
    nome: 'Boleto',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
  },
  {
    nome: 'Transferência',
    ativo: true,
    permite_parcelamento: false,
    max_parcelas: 1,
    tabela_taxas: [{ parcelas: 1, taxa_pct: 0 }],
  },
  {
    nome: 'Cheque',
    ativo: false,
    permite_parcelamento: true,
    max_parcelas: 6,
    tabela_taxas: gerarTabelaTaxas(6),
  },
  {
    nome: 'Crediário',
    ativo: false,
    permite_parcelamento: true,
    max_parcelas: 24,
    tabela_taxas: gerarTabelaTaxas(24),
  },
];
