-- =============================================================================
-- Migration: 017_add_role_checks_to_rpcs.sql
--
-- Aplicada em produção em 2026-08-02, resultado de teste prático de
-- permissões (simulando cada role via request.jwt.claims em transações
-- com ROLLBACK).
--
-- ACHADO CRÍTICO: registrar_movimento_estoque, salvar_bom_produto,
-- salvar_itens_orcamento e salvar_itens_venda são SECURITY DEFINER (rodam
-- com privilégio do dono da função, ignorando completamente o RLS das
-- tabelas) e não tinham NENHUMA checagem de role interna. Confirmado com
-- teste real: um usuário com role 'vendedor' conseguiu alterar saldo de
-- estoque livremente via registrar_movimento_estoque (revertido com
-- ROLLBACK, nada foi alterado de verdade). Isso significava que qualquer
-- usuário autenticado, de qualquer função, podia:
--   - alterar saldo de estoque e criar movimentações falsas
--   - reescrever a composição de materiais (BOM) de qualquer produto
--   - reescrever itens de qualquer orçamento ou venda
-- independente de ter ou não acesso à tabela correspondente via RLS.
--
-- Corrigido adicionando has_role() em cada função, espelhando os mesmos
-- roles já usados nas policies de escrita das tabelas equivalentes.
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
  IF NOT has_role(ARRAY['dono','admin','producao']) THEN
    RAISE EXCEPTION 'Permissão negada: apenas dono, admin ou produção podem movimentar estoque.';
  END IF;

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


CREATE OR REPLACE FUNCTION salvar_bom_produto(p_produto_id uuid, p_itens jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(ARRAY['dono','admin','producao']) THEN
    RAISE EXCEPTION 'Permissão negada: apenas dono, admin ou produção podem editar composição de produtos.';
  END IF;

  DELETE FROM produto_materias WHERE produto_id = p_produto_id;

  IF jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO produto_materias (produto_id, materia_prima_id, quantidade)
    SELECT
      p_produto_id,
      (item->>'materia_prima_id')::uuid,
      (item->>'quantidade')::numeric
    FROM jsonb_array_elements(p_itens) AS item
    WHERE (item->>'materia_prima_id') IS NOT NULL
      AND (item->>'quantidade')::numeric > 0;
  END IF;
END;
$$;


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
  IF NOT has_role(ARRAY['dono','admin','vendedor']) THEN
    RAISE EXCEPTION 'Permissão negada: apenas dono, admin ou vendedor podem editar itens de venda.';
  END IF;

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
  IF NOT has_role(ARRAY['dono','admin','vendedor']) THEN
    RAISE EXCEPTION 'Permissão negada: apenas dono, admin ou vendedor podem editar itens de orçamento.';
  END IF;

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


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
-- SELECT proname,
--   (pg_get_functiondef(oid) ilike '%has_role%') as tem_checagem
-- FROM pg_proc WHERE pronamespace='public'::regnamespace
-- AND proname IN ('registrar_movimento_estoque','salvar_bom_produto',
--                  'salvar_itens_venda','salvar_itens_orcamento');
-- -- Todas devem retornar tem_checagem = true
-- =============================================================================
