-- =============================================================================
-- Migration: 021_cleanup_and_audit_retention.sql
--
-- Aplicada em produção em 2026-08-08, resolvendo os 2 últimos itens de
-- dívida técnica da auditoria completa.
-- =============================================================================


-- =============================================================================
-- 1) itens_orcamento — versão legada de orcamento_itens (era vanilla JS,
--    modelo de cálculo simples sem material/folha/acabamento). Zero linhas,
--    zero uso no frontend. Removida.
-- =============================================================================
DROP TABLE IF EXISTS itens_orcamento;


-- =============================================================================
-- 2) Política de retenção do audit_log — por decisão do Luciano:
--    6 meses quente na tabela principal → arquivado por ~12 meses →
--    apagado de vez (18 meses de vida total).
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log_arquivo (LIKE audit_log INCLUDING DEFAULTS);

CREATE INDEX IF NOT EXISTS idx_audit_log_arquivo_created ON audit_log_arquivo (created_at);

ALTER TABLE audit_log_arquivo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_arquivo_select" ON audit_log_arquivo;
CREATE POLICY "audit_log_arquivo_select" ON audit_log_arquivo
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['dono']));

CREATE OR REPLACE FUNCTION fn_arquivar_audit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log_arquivo
  SELECT * FROM audit_log
  WHERE created_at < now() - interval '6 months';

  DELETE FROM audit_log
  WHERE created_at < now() - interval '6 months';
END;
$$;

CREATE OR REPLACE FUNCTION fn_limpar_audit_log_arquivo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM audit_log_arquivo
  WHERE created_at < now() - interval '18 months';
END;
$$;

-- Agendamento diário, mesmo horário base do job de limpeza de produção já existente
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'arquivar-audit-log-diario') THEN
    PERFORM cron.schedule('arquivar-audit-log-diario', '0 4 * * *',
      $sql$SELECT public.fn_arquivar_audit_log();$sql$);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'limpar-audit-log-arquivo-diario') THEN
    PERFORM cron.schedule('limpar-audit-log-arquivo-diario', '15 4 * * *',
      $sql$SELECT public.fn_limpar_audit_log_arquivo();$sql$);
  END IF;
END;
$$;


-- =============================================================================
-- 3) fn_set_updated_at (criada na migration 020) estava sem search_path
--    fixo — corrigido pra manter o mesmo padrão de segurança do resto do
--    schema.
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
-- SELECT jobname FROM cron.job WHERE jobname LIKE '%audit-log%';
-- -- Deve retornar 2 linhas
--
-- SELECT to_regclass('public.itens_orcamento');
-- -- Deve retornar NULL (tabela não existe mais)
-- =============================================================================
