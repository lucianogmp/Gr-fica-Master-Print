-- =====================================================
-- Migration: 2024_01_XX_performance_optimizations
-- =====================================================

-- ──────────────────────────────────────────────────────
-- 1. CREATE INDEXES FOR BETTER QUERY PERFORMANCE
-- ──────────────────────────────────────────────────────

-- Índice para filtrar lançamentos por data de vencimento
CREATE INDEX IF NOT EXISTS idx_lancamentos_data_vencimento 
ON lancamentos(data_vencimento);

-- Índice para filtrar vendas por cliente_nome e status
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_nome 
ON vendas(cliente_nome);

CREATE INDEX IF NOT EXISTS idx_vendas_status 
ON vendas(status);

-- Índice para filtrar movimentos de estoque por materia_prima_id
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_materia_prima_id 
ON estoque_movimentos(materia_prima_id);

-- ──────────────────────────────────────────────────────
-- 2. CREATE FUNCTION FOR CALCULATING BALANCE
-- ──────────────────────────────────────────────────────

-- Função para calcular saldo de conta corrente
CREATE OR REPLACE FUNCTION calculate_account_balance(p_mes TEXT DEFAULT NULL)
RETURNS TABLE (
  total_receita NUMERIC,
  total_despesa NUMERIC,
  saldo_liquido NUMERIC,
  receita_paga NUMERIC,
  despesa_paga NUMERIC,
  receita_pendente NUMERIC,
  despesa_pendente NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0) AS total_receita,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0) AS total_despesa,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0) AS saldo_liquido,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status = 'pago' THEN l.valor ELSE 0 END), 0) AS receita_paga,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status = 'pago' THEN l.valor ELSE 0 END), 0) AS despesa_paga,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status != 'pago' AND l.status != 'cancelado' THEN l.valor ELSE 0 END), 0) AS receita_pendente,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status != 'pago' AND l.status != 'cancelado' THEN l.valor ELSE 0 END), 0) AS despesa_pendente
  FROM lancamentos l
  WHERE (p_mes IS NULL OR l.data_vencimento::TEXT LIKE p_mes || '%');
END;
$$ LANGUAGE plpgsql STABLE;

-- View para saldo mensal por mês
CREATE OR REPLACE VIEW vw_monthly_balance AS
SELECT
  DATE_TRUNC('month', l.data_vencimento)::DATE AS mes,
  COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0) AS total_receita,
  COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0) AS total_despesa,
  COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0) AS saldo_liquido,
  COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status = 'pago' THEN l.valor ELSE 0 END), 0) AS receita_paga,
  COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status = 'pago' THEN l.valor ELSE 0 END), 0) AS despesa_paga
FROM lancamentos l
GROUP BY DATE_TRUNC('month', l.data_vencimento)
ORDER BY mes DESC;

-- ──────────────────────────────────────────────────────
-- 3. CREATE MATERIALIZED VIEW FOR PERFORMANCE
-- ──────────────────────────────────────────────────────

-- View materializada para dashboard rápido
CREATE MATERIALIZED VIEW IF NOT EXISTS vw_dashboard_summary AS
SELECT
  (SELECT COUNT(*) FROM vendas WHERE status = 'pendente') AS vendas_pendentes,
  (SELECT COUNT(*) FROM vendas WHERE status = 'em_execucao') AS vendas_em_execucao,
  (SELECT COUNT(*) FROM producao WHERE status = 'andamento') AS producao_andamento,
  (SELECT COALESCE(SUM(valor), 0) FROM lancamentos WHERE tipo = 'receita' AND status = 'pago' AND DATE_TRUNC('month', data_vencimento) = DATE_TRUNC('month', CURRENT_DATE)) AS receita_mes_paga,
  (SELECT COALESCE(SUM(valor), 0) FROM lancamentos WHERE tipo = 'despesa' AND status = 'pago' AND DATE_TRUNC('month', data_vencimento) = DATE_TRUNC('month', CURRENT_DATE)) AS despesa_mes_paga;

-- Índice para a view materializada
CREATE INDEX IF NOT EXISTS idx_vw_dashboard_summary 
ON vw_dashboard_summary (vendas_pendentes, vendas_em_execucao);

-- ──────────────────────────────────────────────────────
-- 4. EXECUTE MAINTENANCE
-- ──────────────────────────────────────────────────────

-- Analisar as tabelas para melhorar query planning
ANALYZE lancamentos;
ANALYZE vendas;
ANALYZE estoque_movimentos;
ANALYZE producao;
