-- =============================================================================
-- Migration: 007_layout_impressao.sql
-- Adiciona as colunas jsonb que guardam o layout de impressão editável
-- de Vendas e Orçamentos. Os valores DEFAULT abaixo espelham exatamente
-- DEFAULT_LAYOUT_VENDA / DEFAULT_LAYOUT_ORCAMENTO em
-- src/types/layoutImpressao.ts — se um for alterado, alterar o outro.
--
-- Execute no Supabase SQL Editor. Seguro rodar mais de uma vez.
-- =============================================================================

ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS layout_impressao_venda jsonb DEFAULT '{
    "tituloDocumento": "RECIBO DE VENDA",
    "mostrarLogo": true,
    "corDestaque": "#3b82f6",
    "mostrarNumeroDocumento": true,
    "mostrarDadosEmpresa": true,
    "mostrarCnpj": true,
    "mostrarEndereco": true,
    "mostrarContato": true,
    "textoCabecalhoExtra": "",
    "colunasItens": {"quantidade": true, "unidade": true, "precoUnitario": true, "desconto": true},
    "mostrarObservacoes": true,
    "mostrarValidade": false,
    "mostrarGarantia": false,
    "mostrarAssinatura": true,
    "textoRodape": ""
  }'::jsonb;

ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS layout_impressao_orcamento jsonb DEFAULT '{
    "tituloDocumento": "ORÇAMENTO",
    "mostrarLogo": true,
    "corDestaque": "#3b82f6",
    "mostrarNumeroDocumento": true,
    "mostrarDadosEmpresa": true,
    "mostrarCnpj": true,
    "mostrarEndereco": true,
    "mostrarContato": true,
    "textoCabecalhoExtra": "",
    "colunasItens": {"quantidade": true, "unidade": false, "precoUnitario": true, "desconto": false},
    "mostrarObservacoes": true,
    "mostrarValidade": true,
    "mostrarGarantia": true,
    "mostrarAssinatura": false,
    "textoRodape": ""
  }'::jsonb;

-- Preenche linhas que já existiam antes da coluna ter um DEFAULT aplicado
UPDATE configuracoes SET layout_impressao_venda     = DEFAULT WHERE layout_impressao_venda     IS NULL;
UPDATE configuracoes SET layout_impressao_orcamento = DEFAULT WHERE layout_impressao_orcamento IS NULL;

-- =============================================================================
-- VERIFICAÇÃO — rode após aplicar
-- =============================================================================
-- SELECT layout_impressao_venda, layout_impressao_orcamento FROM configuracoes;
-- → as duas colunas devem vir preenchidas com o JSON acima (não NULL)
-- =============================================================================
