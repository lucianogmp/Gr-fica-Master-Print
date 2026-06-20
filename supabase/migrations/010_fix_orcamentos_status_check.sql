-- =============================================================================
-- Migration: 010_fix_orcamentos_status_check.sql
-- Inclui o status 'convertido' na constraint da tabela orcamentos.
-- =============================================================================

ALTER TABLE orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_status_check;

ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_status_check
  CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado', 'convertido'));
