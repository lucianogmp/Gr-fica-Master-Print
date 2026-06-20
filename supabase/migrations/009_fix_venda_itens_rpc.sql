-- =============================================================================
-- Migration: 009_fix_venda_itens_rpc.sql
-- Remove "total" da instrução de INSERT pois a coluna é GENERATED ALWAYS no banco.
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
      desconto, obs, unidade
    )
    SELECT
      p_venda_id,
      (item->>'descricao'),
      (item->>'quantidade')::numeric,
      (item->>'preco_unitario')::numeric,
      COALESCE((item->>'desconto')::numeric, 0),
      (item->>'obs'),
      COALESCE(item->>'unidade', 'un')
    FROM jsonb_array_elements(p_itens) AS item;
  END IF;
END;
$$;
