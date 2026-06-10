-- =============================================================================
-- Migration: 005_funcional_modules.sql
-- Pré-requisito: 004_security_hardening_complete.sql já aplicada
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: RPC ler_token — lê credencial do Vault de forma segura
-- Complementa o salvar_token já existente.
-- Apenas usuários autenticados com role dono/admin podem ler.
-- =============================================================================

CREATE OR REPLACE FUNCTION ler_token(p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_valor text;
BEGIN
  -- Somente dono e admin podem ler tokens
  v_role := auth.jwt()->'app_metadata'->>'role';
  IF v_role NOT IN ('dono', 'admin') THEN
    RAISE EXCEPTION 'Permissão negada para ler tokens.';
  END IF;

  -- Lê do Vault (extensão supabase_vault deve estar habilitada)
  SELECT decrypted_secret
    INTO v_valor
    FROM vault.decrypted_secrets
   WHERE name = p_nome
   LIMIT 1;

  RETURN v_valor;
END;
$$;

GRANT EXECUTE ON FUNCTION ler_token TO authenticated;


-- =============================================================================
-- SEÇÃO 2: coluna trello_card_id em producao
-- Rastreia o card Trello vinculado a cada ordem de produção.
-- =============================================================================

ALTER TABLE producao
  ADD COLUMN IF NOT EXISTS trello_card_id text;

CREATE INDEX IF NOT EXISTS idx_producao_trello_card
  ON producao (trello_card_id)
  WHERE trello_card_id IS NOT NULL;


-- =============================================================================
-- SEÇÃO 3: tabela trello_sync_log
-- Histórico de todas as sincronizações com o Trello para diagnóstico.
-- =============================================================================

CREATE TABLE IF NOT EXISTS trello_sync_log (
  id            bigserial PRIMARY KEY,
  ordem_id      uuid REFERENCES producao(id) ON DELETE SET NULL,
  card_id       text,
  acao          text NOT NULL,  -- 'criado' | 'movido' | 'arquivado' | 'erro'
  etapa_de      text,
  etapa_para    text,
  user_id       uuid REFERENCES auth.users(id),
  erro_msg      text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trello_sync_log ENABLE ROW LEVEL SECURITY;

-- Apenas dono/admin leem o log de sync
CREATE POLICY "trello_sync_select" ON trello_sync_log
  FOR SELECT TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('dono', 'admin')
  );

-- Inserção via função (trigger ou RPC) — ninguém insere diretamente
CREATE POLICY "trello_sync_insert" ON trello_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_trello_sync_ordem
  ON trello_sync_log (ordem_id);
CREATE INDEX IF NOT EXISTS idx_trello_sync_criado
  ON trello_sync_log (criado_em DESC);

-- Bloqueia anon
REVOKE ALL ON trello_sync_log FROM anon;


-- =============================================================================
-- SEÇÃO 4: view para relatórios de vendas com join em venda_itens
-- Facilita queries no hook useRelatorios sem múltiplos roundtrips.
-- =============================================================================

CREATE OR REPLACE VIEW vw_vendas_completas AS
SELECT
  v.id,
  v.numero,
  v.cliente_nome,
  v.status,
  v.data_venda,
  v.data_entrega,
  v.valor_total,
  v.desconto,
  v.vendedor,
  v.observacoes,
  v.created_at,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'descricao',      vi.descricao,
        'quantidade',     vi.quantidade,
        'preco_unitario', vi.preco_unitario,
        'total',          vi.total,
        'unidade',        vi.unidade
      )
    ) FILTER (WHERE vi.id IS NOT NULL),
    '[]'::jsonb
  ) AS itens
FROM vendas v
LEFT JOIN venda_itens vi ON vi.venda_id = v.id
GROUP BY v.id;


-- =============================================================================
-- SEÇÃO 5: índices para performance dos relatórios
-- =============================================================================

-- Relatório de vendas por período
CREATE INDEX IF NOT EXISTS idx_vendas_data_venda
  ON vendas (data_venda);

-- Relatório financeiro por período
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo_status
  ON lancamentos (tipo, status);

-- Audit log por email (filtro frequente)
CREATE INDEX IF NOT EXISTS idx_audit_email
  ON audit_log (user_email);

-- Estoque para alertas (saldo <= minimo)
CREATE INDEX IF NOT EXISTS idx_mp_saldo_minimo
  ON materias_primas (saldo, estoque_minimo)
  WHERE estoque_minimo > 0;


-- =============================================================================
-- SEÇÃO 6: habilitar Realtime na tabela materias_primas
-- Necessário para o hook useEstoqueRealtime funcionar.
--
-- Execute este bloco separado se a extensão supabase_realtime estiver ativa:
-- =============================================================================

-- No Supabase Dashboard:
-- Database → Replication → Tables → marcar "materias_primas" para INSERT/UPDATE/DELETE
--
-- Ou via SQL (requer que a publicação já exista):
DO $$
BEGIN
  -- Tenta adicionar materias_primas à publicação supabase_realtime
  -- Ignora erro se a publicação não existir (ambientes que não usam Realtime)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE materias_primas;
  EXCEPTION WHEN undefined_object OR duplicate_object THEN
    NULL; -- já está na publicação ou publicação não existe
  END;
END;
$$;


-- =============================================================================
-- VERIFICAÇÃO FINAL
-- =============================================================================
--
-- 1. Confirmar ler_token existe:
--    SELECT routine_name FROM information_schema.routines
--    WHERE routine_name = 'ler_token';
--
-- 2. Confirmar coluna trello_card_id:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'producao' AND column_name = 'trello_card_id';
--
-- 3. Confirmar trello_sync_log com RLS:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE tablename = 'trello_sync_log';
--
-- 4. Testar ler_token como dono:
--    SELECT ler_token('trello_api_key');
--    -- Deve retornar o valor ou NULL se não configurado ainda
-- =============================================================================
