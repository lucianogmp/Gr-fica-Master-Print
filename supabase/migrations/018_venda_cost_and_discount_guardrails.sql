-- =============================================================================
-- Migration: 018_venda_cost_and_discount_guardrails.sql
--
-- Aplicada em produção em 2026-08-03/04, resultado da auditoria de Produtos
-- (manipulação de preço/desconto/custo pelo navegador).
--
-- Duas coisas nesta migration:
--
-- 1) BUG CRÍTICO DE FUNCIONALIDADE (achado no caminho, não relacionado a
--    segurança): venda_itens.total é GENERATED ALWAYS AS (quantidade *
--    preco_unitario), mas salvar_itens_venda tentava inserir um valor
--    explícito nela — o que o Postgres rejeita para colunas geradas.
--    Isso quebrava TODO salvamento de item de venda, mesmo com dados
--    normais. Corrigido removendo "total" do INSERT.
--
-- 2) Travas de regra de negócio (por decisão do Luciano, após teste real
--    confirmar que preço/desconto podiam ser manipulados livremente via
--    DevTools/chamada direta à API, sem nenhuma validação server-side):
--    a) venda_itens ganhou produto_id (o frontend já mandava esse campo,
--       a tabela nunca tinha sido atualizada pra recebê-lo)
--    b) nova função custo_total_produto() soma custo_mao_obra +
--       custo_acabamento + custo_operacional + soma dos materiais do BOM
--    c) salvar_itens_venda agora bloqueia, para quem não é dono/admin:
--       - vender abaixo do custo do produto (quando produto_id é informado)
--       - desconto acima de 20% do valor do item
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: venda_itens ganha produto_id e area_m2 (já mandados pelo front)
-- =============================================================================
ALTER TABLE venda_itens
  ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES produtos(id),
  ADD COLUMN IF NOT EXISTS area_m2 numeric;

CREATE INDEX IF NOT EXISTS idx_venda_itens_produto ON venda_itens (produto_id);


-- =============================================================================
-- SEÇÃO 2: custo_total_produto — soma custos fixos + materiais do BOM
-- =============================================================================
CREATE OR REPLACE FUNCTION custo_total_produto(p_produto_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(p.custo_mao_obra, 0)
    + COALESCE(p.custo_acabamento, 0)
    + COALESCE(p.custo_operacional, 0)
    + COALESCE((
        SELECT SUM(pm.quantidade * mp.custo_unitario)
        FROM produto_materias pm
        JOIN materias_primas mp ON mp.id = pm.materia_prima_id
        WHERE pm.produto_id = p.id
      ), 0)
  FROM produtos p
  WHERE p.id = p_produto_id;
$$;


-- =============================================================================
-- SEÇÃO 3: salvar_itens_venda — coluna gerada corrigida + travas de negócio
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
DECLARE
  v_item        jsonb;
  v_produto_id  uuid;
  v_preco       numeric;
  v_quantidade  numeric;
  v_desconto    numeric;
  v_custo       numeric;
  v_pode_excecao boolean := has_role(ARRAY['dono','admin']);
BEGIN
  IF NOT has_role(ARRAY['dono','admin','vendedor']) THEN
    RAISE EXCEPTION 'Permissão negada: apenas dono, admin ou vendedor podem editar itens de venda.';
  END IF;

  -- Valida cada item ANTES de apagar/regravar qualquer coisa
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := NULLIF(v_item->>'produto_id', '')::uuid;
    v_preco      := (v_item->>'preco_unitario')::numeric;
    v_quantidade := (v_item->>'quantidade')::numeric;
    v_desconto   := COALESCE((v_item->>'desconto')::numeric, 0);

    IF NOT v_pode_excecao THEN
      -- (a) preço abaixo do custo do produto
      IF v_produto_id IS NOT NULL THEN
        v_custo := custo_total_produto(v_produto_id);
        IF v_custo IS NOT NULL AND v_preco < v_custo THEN
          RAISE EXCEPTION 'Preço unitário (R$ %) está abaixo do custo do produto (R$ %). Apenas dono ou admin podem vender abaixo do custo.',
            round(v_preco, 2), round(v_custo, 2);
        END IF;
      END IF;

      -- (b) desconto acima de 20% do valor do item
      IF v_desconto > (v_quantidade * v_preco * 0.20) THEN
        RAISE EXCEPTION 'Desconto de R$ % excede o limite de 20%% do valor do item (R$ %). Apenas dono ou admin podem dar desconto maior.',
          round(v_desconto, 2), round(v_quantidade * v_preco * 0.20, 2);
      END IF;
    END IF;
  END LOOP;

  DELETE FROM venda_itens WHERE venda_id = p_venda_id;

  IF jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO venda_itens (
      venda_id, produto_id, descricao, quantidade, preco_unitario,
      desconto, obs, unidade, area_m2
    )
    SELECT
      p_venda_id,
      NULLIF(elem->>'produto_id', '')::uuid,
      (elem->>'descricao'),
      (elem->>'quantidade')::numeric,
      (elem->>'preco_unitario')::numeric,
      COALESCE((elem->>'desconto')::numeric, 0),
      (elem->>'obs'),
      COALESCE(elem->>'unidade', 'un'),
      NULLIF(elem->>'area_m2', '')::numeric
    FROM jsonb_array_elements(p_itens) AS elem;
    -- Nota: "total" NÃO entra aqui de propósito — é coluna gerada
    -- (quantidade * preco_unitario), calculada automaticamente pelo banco.
  END IF;
END;
$$;


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='venda_itens' AND column_name IN ('produto_id','area_m2');
-- -- Deve retornar as 2 linhas
--
-- SELECT custo_total_produto(id) FROM produtos LIMIT 1;
-- -- Deve retornar um número (não erro)
-- =============================================================================
