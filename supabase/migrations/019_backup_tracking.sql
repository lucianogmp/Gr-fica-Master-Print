-- =============================================================================
-- Migration: 019_backup_tracking.sql
--
-- Aplicada em produção em 2026-08-04, resultado da auditoria de Backup.
--
-- ACHADO CRÍTICO: o projeto está no plano Free do Supabase, que não inclui
-- backup automático nem PITR (isso só existe a partir do plano Pro). A tela
-- Configuracoes/Backup.tsx do próprio sistema afirmava incorretamente que
-- "o Supabase realiza backups automáticos diários" — informação falsa que
-- foi corrigida no frontend.
--
-- Por decisão do Luciano: o backup continua manual (ele mesmo faz), mas o
-- sistema passa a alertar quando estiver atrasado (mais de 30 dias sem
-- registro de backup).
-- =============================================================================

ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS ultimo_backup_em timestamptz;

-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='configuracoes' AND column_name='ultimo_backup_em';
-- =============================================================================
