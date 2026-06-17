-- =============================================================================
-- Migration: 008_fix_vendas_status_check.sql
-- Alinha a constraint vendas_status_check com os status usados pelo app.
-- =============================================================================

-- Normaliza valores antigos/comuns antes de recriar a constraint.
UPDATE vendas
SET status = CASE
  WHEN status IN ('pendente', 'rascunho', 'aberto', 'nova', 'novo') THEN 'orcamento'
  WHEN status IN ('aprovada', 'confirmado', 'confirmada') THEN 'aprovado'
  WHEN status IN ('em_producao', 'em produção', 'andamento', 'em_andamento', 'em_execucao') THEN 'producao'
  WHEN status IN ('finalizado', 'finalizada', 'concluido', 'concluida') THEN 'pronto'
  WHEN status IN ('entrega', 'entregue') THEN 'entregue'
  WHEN status IN ('cancelada', 'cancelado') THEN 'cancelado'
  ELSE status
END
WHERE status IS NOT NULL;

ALTER TABLE vendas
  DROP CONSTRAINT IF EXISTS vendas_status_check;

ALTER TABLE vendas
  ADD CONSTRAINT vendas_status_check
  CHECK (status IN ('orcamento', 'aprovado', 'producao', 'pronto', 'entregue', 'cancelado'));

ALTER TABLE vendas
  ALTER COLUMN status SET DEFAULT 'orcamento';
