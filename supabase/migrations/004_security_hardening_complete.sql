-- =============================================================================
-- Migration: 004_security_hardening_complete.sql
-- Aplica em: todas as tabelas sem RLS confirmado + audit log + fixes críticos
--
-- Execute no Supabase SQL Editor.
-- Seguro para rodar múltiplas vezes (IF NOT EXISTS / OR REPLACE em tudo).
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: VERIFICAÇÃO — quais tabelas estão sem RLS
-- (rode isto separado primeiro para confirmar antes de aplicar)
-- =============================================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Tabelas com rowsecurity = false são as que precisam do bloco abaixo.
-- =============================================================================


-- =============================================================================
-- SEÇÃO 2: HABILITAR RLS NAS TABELAS QUE FALTAM
-- (as migrations 001/002 já cobriram parte — este bloco cobre o resto)
-- =============================================================================

ALTER TABLE IF EXISTS configuracoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orcamentos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orcamento_itens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS venda_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS produto_materias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS acabamentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS materiais_impressao ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS caixa_movimentos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS producao            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lancamentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS produtos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS materias_primas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS estoque_movimentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custos_fixos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS depreciacao         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_roles          ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SEÇÃO 3: POLÍTICAS PARA TABELAS QUE FALTAVAM
-- Padrão: autenticados leem/escrevem; configuracoes e user_roles só dono/admin.
-- =============================================================================

-- ── configuracoes (apenas dono altera) ──────────────────────────────────────
DROP POLICY IF EXISTS "config_select" ON configuracoes;
DROP POLICY IF EXISTS "config_update" ON configuracoes;
DROP POLICY IF EXISTS "config_insert" ON configuracoes;

CREATE POLICY "config_select" ON configuracoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "config_update" ON configuracoes
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('dono', 'admin')
  );

CREATE POLICY "config_insert" ON configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('dono', 'admin')
  );

-- ── orcamentos ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orc_all_authenticated" ON orcamentos;
CREATE POLICY "orc_all_authenticated" ON orcamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── orcamento_itens ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orc_itens_all" ON orcamento_itens;
CREATE POLICY "orc_itens_all" ON orcamento_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── venda_itens ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "venda_itens_all" ON venda_itens;
CREATE POLICY "venda_itens_all" ON venda_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── produto_materias (BOM) ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "produto_materias_all" ON produto_materias;
CREATE POLICY "produto_materias_all" ON produto_materias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── categorias ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "categorias_all" ON categorias;
CREATE POLICY "categorias_all" ON categorias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── acabamentos ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "acabamentos_all" ON acabamentos;
CREATE POLICY "acabamentos_all" ON acabamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── materiais_impressao ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "mat_impressao_all" ON materiais_impressao;
CREATE POLICY "mat_impressao_all" ON materiais_impressao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── clientes ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clientes_all" ON clientes;
CREATE POLICY "clientes_all" ON clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── lancamentos ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lancamentos_all" ON lancamentos;
CREATE POLICY "lancamentos_all" ON lancamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── vendas ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vendas_all" ON vendas;
CREATE POLICY "vendas_all" ON vendas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── produtos ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "produtos_all" ON produtos;
CREATE POLICY "produtos_all" ON produtos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── materias_primas ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "mp_all" ON materias_primas;
CREATE POLICY "mp_all" ON materias_primas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── estoque_movimentos ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "estoque_mov_all" ON estoque_movimentos;
CREATE POLICY "estoque_mov_all" ON estoque_movimentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── caixa_movimentos ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "caixa_mov_all" ON caixa_movimentos;
CREATE POLICY "caixa_mov_all" ON caixa_movimentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── producao ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "producao_all" ON producao;
CREATE POLICY "producao_all" ON producao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── custos_fixos ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "custos_fixos_all" ON custos_fixos;
CREATE POLICY "custos_fixos_all" ON custos_fixos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── depreciacao ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "depreciacao_all" ON depreciacao;
CREATE POLICY "depreciacao_all" ON depreciacao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── user_roles (apenas dono gerencia) ────────────────────────────────────────
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_manage" ON user_roles;

CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_manage" ON user_roles
  FOR ALL TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') = 'dono'
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'dono'
  );


-- =============================================================================
-- SEÇÃO 4: AUDIT LOG
-- Tabela centralizada + função trigger genérica.
-- Grava: tabela, operação, user_id do JWT, dados antes/depois.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id            bigserial PRIMARY KEY,
  tabela        text        NOT NULL,
  operacao      text        NOT NULL,   -- INSERT | UPDATE | DELETE
  user_id       uuid,                   -- auth.uid() no momento da operação
  user_email    text,                   -- para leitura humana no painel
  dados_antes   jsonb,
  dados_depois  jsonb,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

-- Apenas admins e donos leem o audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select" ON audit_log;
CREATE POLICY "audit_select" ON audit_log
  FOR SELECT TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('dono', 'admin')
  );

-- Ninguém insere diretamente — apenas via trigger
DROP POLICY IF EXISTS "audit_insert_trigger" ON audit_log;
CREATE POLICY "audit_insert_trigger" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (false);

-- Index para buscas por tabela, usuário e data
CREATE INDEX IF NOT EXISTS idx_audit_tabela    ON audit_log (tabela);
CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_criado_em ON audit_log (criado_em DESC);


-- ── Função genérica de audit ─────────────────────────────────────────────────
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
  -- Pega o usuário do contexto JWT atual (funciona dentro de RLS)
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
  ELSE -- UPDATE
    INSERT INTO audit_log (tabela, operacao, user_id, user_email, dados_antes, dados_depois)
    VALUES (TG_TABLE_NAME, TG_OP, v_user_id, v_user_email, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;


-- ── Aplicar trigger nas tabelas críticas ────────────────────────────────────
-- vendas
DROP TRIGGER IF EXISTS tg_audit_vendas ON vendas;
CREATE TRIGGER tg_audit_vendas
  AFTER INSERT OR UPDATE OR DELETE ON vendas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- lancamentos
DROP TRIGGER IF EXISTS tg_audit_lancamentos ON lancamentos;
CREATE TRIGGER tg_audit_lancamentos
  AFTER INSERT OR UPDATE OR DELETE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- estoque_movimentos
DROP TRIGGER IF EXISTS tg_audit_estoque ON estoque_movimentos;
CREATE TRIGGER tg_audit_estoque
  AFTER INSERT OR UPDATE OR DELETE ON estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- configuracoes
DROP TRIGGER IF EXISTS tg_audit_config ON configuracoes;
CREATE TRIGGER tg_audit_config
  AFTER INSERT OR UPDATE OR DELETE ON configuracoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- user_roles
DROP TRIGGER IF EXISTS tg_audit_roles ON user_roles;
CREATE TRIGGER tg_audit_roles
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- produtos
DROP TRIGGER IF EXISTS tg_audit_produtos ON produtos;
CREATE TRIGGER tg_audit_produtos
  AFTER INSERT OR UPDATE OR DELETE ON produtos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- orcamentos
DROP TRIGGER IF EXISTS tg_audit_orcamentos ON orcamentos;
CREATE TRIGGER tg_audit_orcamentos
  AFTER INSERT OR UPDATE OR DELETE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- =============================================================================
-- SEÇÃO 5: ADICIONAR operador_id EM estoque_movimentos
-- Registra qual usuário autenticado gerou cada movimento de estoque.
-- =============================================================================

ALTER TABLE estoque_movimentos
  ADD COLUMN IF NOT EXISTS operador_id uuid REFERENCES auth.users(id);

-- Índice para filtrar movimentos por operador
CREATE INDEX IF NOT EXISTS idx_estoque_mov_operador
  ON estoque_movimentos (operador_id);

-- Atualizar a RPC de movimento para gravar o operador automaticamente
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
  -- Lock na linha para evitar race condition
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

  IF p_tipo = 'entrada' THEN
    v_saldo_novo := v_saldo_anterior + p_quantidade;
  ELSIF p_tipo = 'saida' THEN
    v_saldo_novo := v_saldo_anterior - p_quantidade;
  ELSE
    RAISE EXCEPTION 'Tipo inválido: %. Use "entrada" ou "saida"', p_tipo;
  END IF;

  -- Atualiza saldo
  UPDATE materias_primas
  SET saldo = v_saldo_novo
  WHERE id = p_materia_id;

  -- Registra movimento com operador
  INSERT INTO estoque_movimentos (
    materia_prima_id, tipo, quantidade, motivo, operador_id
  ) VALUES (
    p_materia_id, p_tipo, p_quantidade, p_motivo, v_operador_id
  );

  RETURN jsonb_build_object(
    'saldo_anterior', v_saldo_anterior,
    'saldo_novo',     v_saldo_novo
  );
END;
$$;

-- Permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION registrar_movimento_estoque TO authenticated;


-- =============================================================================
-- SEÇÃO 6: FIX DA VIEW vw_dashboard_summary
-- A view materializada original usa status hardcoded incorretos
-- ('em_execucao', 'andamento') que não existem no schema real.
-- Substituída por view normal (não materializada) com os status corretos.
-- =============================================================================

-- Remove a view materializada quebrada
DROP MATERIALIZED VIEW IF EXISTS vw_dashboard_summary;

-- Recria como view normal com os status corretos do schema
CREATE OR REPLACE VIEW vw_dashboard_summary AS
SELECT
  (
    SELECT COUNT(*) FROM vendas
    WHERE status IN ('orcamento', 'aprovado')
  ) AS vendas_pendentes,
  (
    SELECT COUNT(*) FROM vendas
    WHERE status = 'producao'
  ) AS vendas_em_producao,
  (
    SELECT COUNT(*) FROM producao
    WHERE etapa NOT IN ('pronto', 'entregue')
  ) AS producao_em_andamento,
  (
    SELECT COALESCE(SUM(valor), 0) FROM lancamentos
    WHERE tipo = 'receita'
      AND status = 'pago'
      AND DATE_TRUNC('month', data_vencimento) = DATE_TRUNC('month', CURRENT_DATE)
  ) AS receita_mes_paga,
  (
    SELECT COALESCE(SUM(valor), 0) FROM lancamentos
    WHERE tipo = 'despesa'
      AND status = 'pago'
      AND DATE_TRUNC('month', data_vencimento) = DATE_TRUNC('month', CURRENT_DATE)
  ) AS despesa_mes_paga;


-- =============================================================================
-- SEÇÃO 7: RPC ATÔMICA PARA SALVAR ITENS DE VENDA
-- Substitui o delete+insert sem transação em Vendas.tsx e useOrcamentos.ts
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
  -- Delete e insert dentro da mesma transação — atomico
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
      (item->>'desconto')::numeric,
      (item->>'obs'),
      (item->>'unidade'),
      (item->>'total')::numeric
    FROM jsonb_array_elements(p_itens) AS item;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_itens_venda TO authenticated;


-- Equivalente para itens de orçamento
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
      NULLIF(item->>'largura_cm', '')::numeric,
      NULLIF(item->>'altura_cm', '')::numeric,
      NULLIF(item->>'preco_por_m2', '')::numeric,
      NULLIF(item->>'material_id', '')::uuid,
      (item->>'folha_tipo'),
      NULLIF(item->>'itens_por_folha', '')::integer,
      NULLIF(item->>'preco_por_folha', '')::numeric,
      NULLIF(item->>'acabamento_id', '')::uuid,
      (item->>'acabamento_nome'),
      NULLIF(item->>'acabamento_custo', '')::numeric,
      NULLIF(item->>'acabamentos_por_folha', '')::integer,
      COALESCE((item->>'arte_inclusa')::boolean, false)
    FROM jsonb_array_elements(p_itens) AS item;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_itens_orcamento TO authenticated;


-- =============================================================================
-- SEÇÃO 8: BLOQUEAR ANON EM TODAS AS TABELAS
-- Garante que a anon key não consegue ler nada sem autenticação.
-- =============================================================================

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'configuracoes','orcamentos','orcamento_itens','venda_itens',
    'produto_materias','categorias','acabamentos','materiais_impressao',
    'caixa_movimentos','producao','clientes','lancamentos','vendas',
    'produtos','materias_primas','estoque_movimentos','custos_fixos',
    'depreciacao','user_roles','audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('REVOKE ALL ON %I FROM anon', t);
  END LOOP;
END;
$$;


-- =============================================================================
-- SEÇÃO 9: VERIFICAÇÃO FINAL
-- Execute após aplicar para confirmar que tudo está correto.
-- =============================================================================
--
-- 1. Todas tabelas com RLS:
--    SELECT tablename, rowsecurity
--    FROM pg_tables WHERE schemaname = 'public'
--    ORDER BY tablename;
--    → rowsecurity deve ser TRUE em todas.
--
-- 2. Triggers de audit ativos:
--    SELECT trigger_name, event_object_table, event_manipulation
--    FROM information_schema.triggers
--    WHERE trigger_schema = 'public'
--    ORDER BY event_object_table;
--
-- 3. Testar como anon (deve falhar em todas):
--    SET ROLE anon;
--    SELECT * FROM vendas;   -- deve retornar 0 linhas ou erro de permissão
--    RESET ROLE;
--
-- 4. Confirmar operador_id na tabela:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'estoque_movimentos';
--    → deve incluir 'operador_id'
-- =============================================================================
