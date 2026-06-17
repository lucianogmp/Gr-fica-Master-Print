// src/types/layoutImpressao.ts
//
// Configuração editável do layout de impressão de Vendas e Orçamentos.
// Fica salva em configuracoes.layout_impressao_venda e
// configuracoes.layout_impressao_orcamento (colunas jsonb).
//
// Mantém um padrão sensato (DEFAULT_LAYOUT_VENDA / DEFAULT_LAYOUT_ORCAMENTO)
// para que o documento já saia correto mesmo sem nenhuma edição.

export interface ColunasItensConfig {
  quantidade: boolean;
  unidade: boolean;
  precoUnitario: boolean;
  desconto: boolean;
}

export interface LayoutImpressaoConfig {
  tituloDocumento: string;
  mostrarLogo: boolean;
  corDestaque: string;
  mostrarNumeroDocumento: boolean;
  mostrarDadosEmpresa: boolean;
  mostrarCnpj: boolean;
  mostrarEndereco: boolean;
  mostrarContato: boolean;
  textoCabecalhoExtra: string;
  colunasItens: ColunasItensConfig;
  mostrarObservacoes: boolean;
  /** Só faz sentido para orçamento */
  mostrarValidade: boolean;
  /** Só faz sentido para orçamento */
  mostrarGarantia: boolean;
  mostrarAssinatura: boolean;
  /** Vazio = usa o rodapé padrão (empresa_rodape / orc_rodape) */
  textoRodape: string;
}

export const DEFAULT_LAYOUT_VENDA: LayoutImpressaoConfig = {
  tituloDocumento: 'RECIBO DE VENDA',
  mostrarLogo: true,
  corDestaque: '#3b82f6',
  mostrarNumeroDocumento: true,
  mostrarDadosEmpresa: true,
  mostrarCnpj: true,
  mostrarEndereco: true,
  mostrarContato: true,
  textoCabecalhoExtra: '',
  colunasItens: { quantidade: true, unidade: true, precoUnitario: true, desconto: true },
  mostrarObservacoes: true,
  mostrarValidade: false,
  mostrarGarantia: false,
  mostrarAssinatura: true,
  textoRodape: '',
};

export const DEFAULT_LAYOUT_ORCAMENTO: LayoutImpressaoConfig = {
  tituloDocumento: 'ORÇAMENTO',
  mostrarLogo: true,
  corDestaque: '#3b82f6',
  mostrarNumeroDocumento: true,
  mostrarDadosEmpresa: true,
  mostrarCnpj: true,
  mostrarEndereco: true,
  mostrarContato: true,
  textoCabecalhoExtra: '',
  // Orçamentos não têm unidade/desconto por item no banco — desligado por padrão.
  colunasItens: { quantidade: true, unidade: false, precoUnitario: true, desconto: false },
  mostrarObservacoes: true,
  mostrarValidade: true,
  mostrarGarantia: true,
  mostrarAssinatura: false,
  textoRodape: '',
};
