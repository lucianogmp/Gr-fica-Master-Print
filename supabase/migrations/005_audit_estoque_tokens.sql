-- =============================================================================
-- Migration: 005_audit_estoque_tokens.sql
-- Consolida (e substitui) os antigos: 005_final.sql, 005_funcional_modules.sql
-- e 005_funcional_modules_fixed.sql — que eram 3 tentativas sucessivas da
-- mesma migration, deixadas no repo ao mesmo tempo.
--
-- Todo o conteúdo abaixo foi conferido contra o schema REAL do banco de
-- produção (qrgdcyceqsrtmerqazgp) em 2026-08-01 antes de ser escrito aqui.
--
-- audit_log real:          id (uuid), tabela, operacao, usuario_id, user_email,
--                           dados_antes, dados_depois, ip, created_at
-- estoque_movimentos real: id (uuid), materia_prima_id, tipo, quantidade,
--                           motivo, origem, referencia_id, created_at, operador_id
--
-- Pré-requisito: 004_security_hardening_complete.sql já aplicada
-- (cria has_role(), audit_log, estoque_movimentos, fn_audit_trigger inicial).
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: audit_log — coluna user_email + índices
-- =============================================================================

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS user_email text;

CREATE INDEX IF NOT EXISTS idx_audit_tabela  ON audit_log (tabela);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_log (usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_email   ON audit_log (user_email);

REVOKE ALL ON audit_log FROM anon;


-- =============================================================================
-- SEÇÃO 2: fn_audit_trigger — grava usuario_id + user_email (nomes reais)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_user_email text;
BEGIN
  v_usuario_id := auth.uid();
  v_user_email := auth.jwt()->>'email';

  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (tabela, operacao, usuario_id, user_email, dados_antes)
    VALUES (TG_TABLE_NAME, TG_OP, v_usuario_id, v_user_email, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (tabela, operacao, usuario_id, user_email, dados_depois)
    VALUES (TG_TABLE_NAME, TG_OP, v_usuario_id, v_user_email, to_jsonb(NEW));
    RETURN NEW;
  ELSE -- UPDATE
    INSERT INTO audit_log (tabela, operacao, usuario_id, user_email, dados_antes, dados_depois)
    VALUES (TG_TABLE_NAME, TG_OP, v_usuario_id, v_user_email, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS tg_audit_vendas      ON vendas;
DROP TRIGGER IF EXISTS tg_audit_lancamentos ON lancamentos;
DROP TRIGGER IF EXISTS tg_audit_estoque     ON estoque_movimentos;
DROP TRIGGER IF EXISTS tg_audit_config      ON configuracoes;
DROP TRIGGER IF EXISTS tg_audit_produtos    ON produtos;
DROP TRIGGER IF EXISTS tg_audit_orcamentos  ON orcamentos;

CREATE TRIGGER tg_audit_vendas
  AFTER INSERT OR UPDATE OR DELETE ON vendas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER tg_audit_lancamentos
  AFTER INSERT OR UPDATE OR DELETE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER tg_audit_estoque
  AFTER INSERT OR UPDATE OR DELETE ON estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER tg_audit_config
  AFTER INSERT OR UPDATE OR DELETE ON configuracoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER tg_audit_produtos
  AFTER INSERT OR UPDATE OR DELETE ON produtos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER tg_audit_orcamentos
  AFTER INSERT OR UPDATE OR DELETE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- =============================================================================
-- SEÇÃO 3: operador_id em estoque_movimentos
-- =============================================================================

ALTER TABLE estoque_movimentos
  ADD COLUMN IF NOT EXISTS operador_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_operador
  ON estoque_movimentos (operador_id);


-- =============================================================================
-- SEÇÃO 4: registrar_movimento_estoque (com operador_id)
-- =============================================================================

CREATE OR REPLACE FUNCTION registrar_movimento_estoque(
  p_materia_id uuid,
  p_tipo       text,
  p_quantidade numeric,
  p_motivo     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_anterior numeric;
  v_saldo_novo     numeric;
  v_operador_id    uuid := auth.uid();
BEGIN
  SELECT saldo INTO v_saldo_anterior
    FROM materias_primas
   WHERE id = p_materia_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matéria-prima não encontrada: %', p_materia_id;
  END IF;

  IF p_tipo = 'saida' AND v_saldo_anterior < p_quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, solicitado: %',
      v_saldo_anterior, p_quantidade;
  END IF;

  IF    p_tipo = 'entrada' THEN v_saldo_novo := v_saldo_anterior + p_quantidade;
  ELSIF p_tipo = 'saida'   THEN v_saldo_novo := v_saldo_anterior - p_quantidade;
  ELSE  RAISE EXCEPTION 'Tipo inválido: %. Use "entrada" ou "saida"', p_tipo;
  END IF;

  UPDATE materias_primas SET saldo = v_saldo_novo WHERE id = p_materia_id;

  INSERT INTO estoque_movimentos
    (materia_prima_id, tipo, quantidade, motivo, operador_id)
  VALUES
    (p_materia_id, p_tipo, p_quantidade, p_motivo, v_operador_id);

  RETURN jsonb_build_object(
    'saldo_anterior', v_saldo_anterior,
    'saldo_novo',     v_saldo_novo
  );
END;
$$;

REVOKE ALL ON FUNCTION registrar_movimento_estoque FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_movimento_estoque TO authenticated;


-- =============================================================================
-- SEÇÃO 5: RPCs atômicas de itens (venda / orçamento)
-- =============================================================================

CREATE OR REPLACE FUNCTION salvar_itens_venda(
  p_venda_id uuid,
  p_itens    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM venda_itens WHERE venda_id = p_venda_id;

  IF jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO venda_itens (
      venda_id, descricao, quantidade, preco_unitario,
      desconto, obs, unidade, total
    )
    SELECT
      p_venda_id,
      (item->>'descricao'),
      (item->>'quantidade')::numeric,
      (item->>'preco_unitario')::numeric,
      COALESCE((item->>'desconto')::numeric, 0),
      (item->>'obs'),
      COALESCE(item->>'unidade', 'un'),
      (item->>'total')::numeric
    FROM jsonb_array_elements(p_itens) AS item;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION salvar_itens_venda FROM PUBLIC;
GRANT EXECUTE ON FUNCTION salvar_itens_venda TO authenticated;


CREATE OR REPLACE FUNCTION salvar_itens_orcamento(
  p_orcamento_id uuid,
  p_itens        jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM orcamento_itens WHERE orcamento_id = p_orcamento_id;

  IF jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO orcamento_itens (
      orcamento_id, descricao, tipo_calculo, quantidade,
      preco_unitario, total, largura_cm, altura_cm,
      preco_por_m2, material_id, folha_tipo, itens_por_folha,
      preco_por_folha, acabamento_id, acabamento_nome,
      acabamento_custo, acabamentos_por_folha, arte_inclusa
    )
    SELECT
      p_orcamento_id,
      (item->>'descricao'),
      (item->>'tipo_calculo'),
      (item->>'quantidade')::numeric,
      (item->>'preco_unitario')::numeric,
      (item->>'total')::numeric,
      NULLIF(item->>'largura_cm',            '')::numeric,
      NULLIF(item->>'altura_cm',             '')::numeric,
      NULLIF(item->>'preco_por_m2',          '')::numeric,
      NULLIF(item->>'material_id',           '')::uuid,
      (item->>'folha_tipo'),
      NULLIF(item->>'itens_por_folha',       '')::integer,
      NULLIF(item->>'preco_por_folha',       '')::numeric,
      NULLIF(item->>'acabamento_id',         '')::uuid,
      (item->>'acabamento_nome'),
      NULLIF(item->>'acabamento_custo',      '')::numeric,
      NULLIF(item->>'acabamentos_por_folha', '')::integer,
      COALESCE((item->>'arte_inclusa')::boolean, false)
    FROM jsonb_array_elements(p_itens) AS item;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION salvar_itens_orcamento FROM PUBLIC;
GRANT EXECUTE ON FUNCTION salvar_itens_orcamento TO authenticated;


-- =============================================================================
-- SEÇÃO 6: vw_dashboard_summary (troca materialized view por view normal)
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS vw_dashboard_summary;

CREATE OR REPLACE VIEW vw_dashboard_summary AS
SELECT
  (SELECT COUNT(*) FROM vendas
   WHERE status IN ('orcamento','aprovado'))           AS vendas_pendentes,
  (SELECT COUNT(*) FROM vendas
   WHERE status = 'producao')                          AS vendas_em_producao,
  (SELECT COUNT(*) FROM producao
   WHERE etapa NOT IN ('pronto','entregue'))            AS producao_em_andamento,
  (SELECT COALESCE(SUM(valor), 0) FROM lancamentos
   WHERE tipo = 'receita' AND status = 'pago'
     AND DATE_TRUNC('month', data_vencimento)
       = DATE_TRUNC('month', CURRENT_DATE))             AS receita_mes_paga,
  (SELECT COALESCE(SUM(valor), 0) FROM lancamentos
   WHERE tipo = 'despesa' AND status = 'pago'
     AND DATE_TRUNC('month', data_vencimento)
       = DATE_TRUNC('month', CURRENT_DATE))             AS despesa_mes_paga;


-- =============================================================================
-- SEÇÃO 7: (removida) integração com Trello — descontinuada.
-- trello_card_id em producao e a tabela trello_sync_log foram removidas
-- diretamente em produção; este arquivo não recria mais esse schema.
-- =============================================================================


-- =============================================================================
-- SEÇÃO 8: índices de performance para relatórios
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_vendas_data_venda
  ON vendas (data_venda);

CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo_status
  ON lancamentos (tipo, status);

CREATE INDEX IF NOT EXISTS idx_mp_saldo_minimo
  ON materias_primas (saldo, estoque_minimo)
  WHERE estoque_minimo > 0;


-- =============================================================================
-- SEÇÃO 9: Realtime em materias_primas
-- =============================================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE materias_primas;
  EXCEPTION WHEN undefined_object OR duplicate_object THEN
    NULL;
  END;
END;
$$;


-- =============================================================================
-- SEÇÃO 10: salvar_token / ler_token (credenciais no Vault, ex.: Trello)
-- Estas duas funções já existiam em produção mas nunca tinham sido versionadas
-- em nenhum arquivo de migration deste repositório. Corpo abaixo copiado
-- fielmente do banco real, incluindo a dependência de has_role() (criada na
-- migration 004).
-- =============================================================================

CREATE OR REPLACE FUNCTION salvar_token(p_nome text, p_valor text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT has_role(ARRAY['dono']) THEN
    RAISE EXCEPTION 'Apenas o dono pode salvar tokens.';
  END IF;

  -- Upsert: atualiza se já existe, cria se não existe
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_nome;

  IF FOUND THEN
    PERFORM vault.update_secret(v_id, p_valor);
  ELSE
    v_id := vault.create_secret(p_valor, p_nome);
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION salvar_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION salvar_token TO authenticated;


CREATE OR REPLACE FUNCTION ler_token(p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_valor text;
BEGIN
  -- Apenas roles administrativos leem tokens
  IF NOT has_role(ARRAY['dono', 'admin']) THEN
    RAISE EXCEPTION 'Permissão negada para leitura de tokens.';
  END IF;

  SELECT decrypted_secret INTO v_valor
  FROM vault.decrypted_secrets
  WHERE name = p_nome;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token "%" não encontrado no Vault.', p_nome;
  END IF;

  RETURN v_valor;
END;
$$;

REVOKE ALL ON FUNCTION ler_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ler_token TO authenticated;


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
--
-- 1. Colunas de audit_log (deve incluir user_email):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'audit_log' ORDER BY ordinal_position;
--
-- 2. Colunas de estoque_movimentos (deve incluir operador_id):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'estoque_movimentos' ORDER BY ordinal_position;
--
-- 3. Triggers de audit ativos:
-- SELECT trigger_name, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public' ORDER BY event_object_table;
--
-- 4. ler_token / salvar_token existem e dependem de has_role:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name IN ('ler_token','salvar_token');
-- =============================================================================
