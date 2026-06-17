import { LayoutImpressaoConfig } from './layoutImpressao';

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
