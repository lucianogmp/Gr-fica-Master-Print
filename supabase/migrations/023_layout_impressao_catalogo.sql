-- =============================================================================
-- Migration: 023_layout_impressao_catalogo.sql
-- Adiciona a coluna jsonb que guarda o layout de impressão editável do
-- Catálogo de Produtos (Produtos → Tabela de Preços → Imprimir Catálogo).
-- O valor DEFAULT abaixo espelha exatamente DEFAULT_LAYOUT_CATALOGO em
-- src/types/layoutImpressao.ts — se um for alterado, alterar o outro.
--
-- Execute no Supabase SQL Editor. Seguro rodar mais de uma vez.
-- =============================================================================

ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS layout_impressao_catalogo jsonb DEFAULT '{
    "tituloDocumento": "CATÁLOGO DE PRODUTOS",
    "mostrarLogo": true,
    "corDestaque": "#3b82f6",
    "mostrarDadosEmpresa": true,
    "mostrarCnpj": false,
    "mostrarContato": true,
    "textoCabecalhoExtra": "",
    "agruparPorCategoria": true,
    "mostrarSku": false,
    "mostrarDescricao": true,
    "mostrarUnidade": true,
    "textoRodape": ""
  }'::jsonb;

-- Preenche linhas que já existiam antes da coluna ter um DEFAULT aplicado
UPDATE configuracoes SET layout_impressao_catalogo = DEFAULT WHERE layout_impressao_catalogo IS NULL;

-- =============================================================================
-- VERIFICAÇÃO — rode após aplicar
-- =============================================================================
-- SELECT layout_impressao_catalogo FROM configuracoes;
-- → a coluna deve vir preenchida com o JSON acima (não NULL)
-- =============================================================================
