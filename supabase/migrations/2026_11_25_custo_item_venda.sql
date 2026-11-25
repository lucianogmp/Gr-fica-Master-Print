-- Custo dos itens da venda: canônico = custo POR UNIDADE VENDIDA (total = custo_unitario × quantidade).
-- 1) helper que calcula o custo por unidade a partir do produto (× área quando o produto é por m² e o item é em peças)
-- 2) salvar_itens_venda passa a NUNCA gravar custo vazio: usa o enviado, senão o que o item já tinha, senão o calculado
-- 3) corrige itens antigos (custo por m² gravado como se fosse por peça) e preenche os que estavam sem custo

CREATE OR REPLACE FUNCTION public.area_m2_de_obs(p_obs text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_m text[];
BEGIN
  IF p_obs IS NULL THEN RETURN NULL; END IF;
  v_m := regexp_match(p_obs, '([0-9]+[.,]?[0-9]*)\s*[x×]\s*([0-9]+[.,]?[0-9]*)\s*cm', 'i');
  IF v_m IS NULL THEN RETURN NULL; END IF;
  RETURN (replace(v_m[1], ',', '.')::numeric / 100) * (replace(v_m[2], ',', '.')::numeric / 100);
END $$;

CREATE OR REPLACE FUNCTION public.custo_item_calculado(p_produto_id uuid, p_unidade text, p_obs text, p_area numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_custo numeric; v_um text; v_area numeric;
BEGIN
  IF p_produto_id IS NULL THEN RETURN NULL; END IF;
  v_custo := custo_total_produto(p_produto_id);
  IF v_custo IS NULL OR v_custo <= 0 THEN RETURN NULL; END IF;
  SELECT unidade_medida INTO v_um FROM produtos WHERE id = p_produto_id;
  IF v_um = 'm2' AND left(lower(COALESCE(p_unidade, 'un')), 1) <> 'm' THEN
    v_area := COALESCE(p_area, area_m2_de_obs(p_obs));
    IF v_area IS NULL THEN RETURN NULL; END IF;
    RETURN round(v_custo * v_area, 4);
  END IF;
  RETURN v_custo;
END $$;

DO $patch$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('public.salvar_itens_venda'::regproc);
  v_def := replace(v_def, E'  v_resumo       text;\nBEGIN', E'  v_resumo       text;\n  v_old          jsonb;\nBEGIN');
  v_def := replace(v_def, E'  DELETE FROM venda_itens WHERE venda_id = p_venda_id;',
$r$  -- custos que os itens já tinham (quem salva sem ver custos, ex. vendedor, não pode apagá-los)
  SELECT jsonb_agg(jsonb_build_object('produto_id', produto_id, 'preco', preco_unitario, 'descricao', descricao, 'custo', custo_unitario))
    INTO v_old FROM venda_itens WHERE venda_id = p_venda_id AND custo_unitario IS NOT NULL;

  DELETE FROM venda_itens WHERE venda_id = p_venda_id;$r$);
  v_def := replace(v_def, E'      NULLIF(elem->>''custo_unitario'', '''')::numeric,',
$r$      COALESCE(
        NULLIF(elem->>'custo_unitario', '')::numeric,
        (SELECT (o->>'custo')::numeric FROM jsonb_array_elements(COALESCE(v_old, '[]'::jsonb)) o
          WHERE o->>'produto_id' IS NOT DISTINCT FROM NULLIF(elem->>'produto_id', '')
            AND (o->>'preco')::numeric = (elem->>'preco_unitario')::numeric
            AND o->>'descricao' IS NOT DISTINCT FROM (elem->>'descricao')
          LIMIT 1),
        custo_item_calculado(NULLIF(elem->>'produto_id', '')::uuid, COALESCE(elem->>'unidade', 'un'),
                             elem->>'obs', NULLIF(elem->>'area_m2', '')::numeric)
      ),$r$);
  v_def := replace(v_def, E'      (elem->''detalhe_placa''),', E'      NULLIF(elem->''detalhe_placa'', ''null''::jsonb),');
  IF position('custo_item_calculado' IN v_def) = 0 OR position('v_old' IN v_def) = 0 THEN
    RAISE EXCEPTION 'patch de salvar_itens_venda não aplicou';
  END IF;
  EXECUTE v_def;
END
$patch$;

-- Itens antigos: custo por m² gravado em item em peças (un) -> custo por peça
UPDATE venda_itens vi
SET custo_unitario = round(vi.custo_unitario * area_m2_de_obs(vi.obs), 4)
FROM produtos p
WHERE p.id = vi.produto_id AND p.unidade_medida = 'm2'
  AND left(lower(COALESCE(vi.unidade, 'un')), 1) <> 'm'
  AND vi.custo_unitario IS NOT NULL
  AND (vi.detalhe_placa IS NULL OR vi.detalhe_placa = 'null'::jsonb)
  AND area_m2_de_obs(vi.obs) IS NOT NULL;

-- Itens sem custo: preenche com o custo atual do produto (estimativa)
UPDATE venda_itens vi
SET custo_unitario = custo_item_calculado(vi.produto_id, vi.unidade, vi.obs, vi.area_m2)
WHERE vi.custo_unitario IS NULL AND vi.produto_id IS NOT NULL
  AND (vi.detalhe_placa IS NULL OR vi.detalhe_placa = 'null'::jsonb);

-- detalhe_placa gravado como JSON null vira NULL de verdade
UPDATE venda_itens SET detalhe_placa = NULL WHERE detalhe_placa = 'null'::jsonb;
