-- =============================================================================
-- Fix: 005_funcional_modules_fixed.sql
-- Corrige o erro "column user_email does not exist" verificando o estado
-- real do banco antes de aplicar cada alteração.
-- Execute este arquivo NO LUGAR do 005 original.
-- =============================================================================


-- =============================================================================
-- SEÇÃO 0: Garantir que audit_log existe com todas as colunas
-- (caso a migration 004 não tenha sido aplicada ou foi parcial)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial    PRIMARY KEY,
  tabela      text         NOT NULL,
  operacao    text         NOT NULL,
  user_id     uuid,
  user_email  text,
  dados_antes jsonb,
  dados_depois jsonb,
  criado_em   timestamptz  NOT NULL DEFAULT now()
);

-- Adiciona user_email se a tabela existia mas sem a coluna
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS user_email text;

-- Garante RLS ativo
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Recria políticas (DROP IF EXISTS é seguro)
DROP POLICY IF EXISTS "audit_select"         ON audit_log;
DROP POLICY IF EXISTS "audit_insert_trigger" ON audit_log;

CREATE POLICY "audit_select" ON audit_log
  FOR SELECT TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('dono', 'admin')
  );

CREATE POLICY "audit_insert_trigger" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_tabela    ON audit_log (tabela);
CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_criado_em ON audit_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_email     ON audit_log (user_email);

REVOKE ALL ON audit_log FROM anon;


-- =============================================================================
-- SEÇÃO 1: Função de audit (recria com OR REPLACE — seguro)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_user_email text;
BEGIN
  v_user_id    := auth.uid();
  v_user_email := auth.jwt()->>'email';

  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (tabela, operacao, user_id, user_email, dados_antes)
    VALUES (TG_TABLE_NAME, TG_OP, v_user_id, v_user_email, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (tabela, operacao, user_id, user_email, dados_depois)
    VALUES (TG_TABLE_NAME, TG_OP, v_user_id, v_user_email, to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO audit_log (tabela, operacao, user_id, user_email, dados_antes, dados_depois)
    VALUES (TG_TABLE_NAME, TG_OP, v_user_id, v_user_email, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

-- Triggers nas tabelas críticas
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
-- SEÇÃO 2: operador_id em estoque_movimentos
-- =============================================================================

ALTER TABLE estoque_movimentos
  ADD COLUMN IF NOT EXISTS operador_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_operador
  ON estoque_movimentos (operador_id);

-- RPC atualizada com operador_id
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

  INSERT INTO estoque_movimentos (materia_prima_id, tipo, quantidade, motivo, operador_id)
  VALUES (p_materia_id, p_tipo, p_quantidade, p_motivo, v_operador_id);

  RETURN jsonb_build_object('saldo_anterior', v_saldo_anterior, 'saldo_novo', v_saldo_novo);
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_movimento_estoque TO authenticated;


-- =============================================================================
-- SEÇÃO 3: RPCs atômicas para itens
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

GRANT EXECUTE ON FUNCTION salvar_itens_orcamento TO authenticated;


-- =============================================================================
-- SEÇÃO 4: Fix da view vw_dashboard_summary
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS vw_dashboard_summary;

CREATE OR REPLACE VIEW vw_dashboard_summary AS
SELECT
  (SELECT COUNT(*) FROM vendas   WHERE status IN ('orcamento','aprovado'))  AS vendas_pendentes,
  (SELECT COUNT(*) FROM vendas   WHERE status = 'producao')                 AS vendas_em_producao,
  (SELECT COUNT(*) FROM producao WHERE etapa NOT IN ('pronto','entregue'))   AS producao_em_andamento,
  (SELECT COALESCE(SUM(valor),0) FROM lancamentos
   WHERE tipo='receita' AND status='pago'
     AND DATE_TRUNC('month',data_vencimento)=DATE_TRUNC('month',CURRENT_DATE)) AS receita_mes_paga,
  (SELECT COALESCE(SUM(valor),0) FROM lancamentos
   WHERE tipo='despesa' AND status='pago'
     AND DATE_TRUNC('month',data_vencimento)=DATE_TRUNC('month',CURRENT_DATE)) AS despesa_mes_paga;


-- =============================================================================
-- SEÇÃO 5: RPC ler_token
-- =============================================================================

CREATE OR REPLACE FUNCTION ler_token(p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  text;
  v_valor text;
BEGIN
  v_role := auth.jwt()->'app_metadata'->>'role';
  IF v_role NOT IN ('dono', 'admin') THEN
    RAISE EXCEPTION 'Permissão negada para ler tokens.';
  END IF;

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
-- SEÇÃO 6: coluna trello_card_id + tabela trello_sync_log
-- =============================================================================

ALTER TABLE producao
  ADD COLUMN IF NOT EXISTS trello_card_id text;

CREATE INDEX IF NOT EXISTS idx_producao_trello_card
  ON producao (trello_card_id)
  WHERE trello_card_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS trello_sync_log (
  id         bigserial PRIMARY KEY,
  ordem_id   uuid REFERENCES producao(id) ON DELETE SET NULL,
  card_id    text,
  acao       text        NOT NULL,
  etapa_de   text,
  etapa_para text,
  user_id    uuid REFERENCES auth.users(id),
  erro_msg   text,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trello_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trello_sync_select" ON trello_sync_log;
DROP POLICY IF EXISTS "trello_sync_insert" ON trello_sync_log;

CREATE POLICY "trello_sync_select" ON trello_sync_log
  FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('dono','admin'));

CREATE POLICY "trello_sync_insert" ON trello_sync_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_trello_sync_ordem   ON trello_sync_log (ordem_id);
CREATE INDEX IF NOT EXISTS idx_trello_sync_criado  ON trello_sync_log (criado_em DESC);

REVOKE ALL ON trello_sync_log FROM anon;


-- =============================================================================
-- SEÇÃO 7: índices de performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_vendas_data_venda    ON vendas (data_venda);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo_status ON lancamentos (tipo, status);
CREATE INDEX IF NOT EXISTS idx_mp_saldo_minimo
  ON materias_primas (saldo, estoque_minimo)
  WHERE estoque_minimo > 0;


-- =============================================================================
-- SEÇÃO 8: Realtime em materias_primas
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
-- VERIFICAÇÃO — rode após aplicar
-- =============================================================================
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'audit_log' ORDER BY ordinal_position;
-- → deve incluir: id, tabela, operacao, user_id, user_email, dados_antes, dados_depois, criado_em
--
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('fn_audit_trigger','registrar_movimento_estoque',
--                        'salvar_itens_venda','salvar_itens_orcamento','ler_token');
-- → deve retornar as 5 funções
--
-- SELECT trigger_name, event_object_table FROM information_schema.triggers
-- WHERE trigger_schema = 'public' ORDER BY event_object_table;
-- → deve listar os 6 triggers de audit
-- =============================================================================
