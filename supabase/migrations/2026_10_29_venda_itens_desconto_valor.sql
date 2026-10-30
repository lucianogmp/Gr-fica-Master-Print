-- Desconto do item de venda em R$ (a tela passa a trabalhar em reais).
-- Aditivo: `desconto` (percentual) continua existindo e sendo gravado, pra impressão e registros antigos.
ALTER TABLE public.venda_itens
  ADD COLUMN IF NOT EXISTS desconto_valor numeric(12,2) CHECK (desconto_valor IS NULL OR desconto_valor >= 0);
COMMENT ON COLUMN public.venda_itens.desconto_valor IS
  'Desconto do item em R$ (valor total da linha). NULL em registros antigos: nesse caso vale desconto (%) sobre quantidade x preco_unitario.';

CREATE OR REPLACE FUNCTION public.salvar_itens_venda(p_venda_id uuid, p_itens jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item        jsonb;
  v_produto_id  uuid;
  v_preco       numeric;
  v_quantidade  numeric;
  v_desconto    numeric;   -- percentual
  v_desc_rs     numeric;   -- desconto em R$ (o que vale pra regra dos 20%)
  v_custo       numeric;
  v_pode_excecao boolean := has_role(ARRAY['dono','admin']);
  v_resumo       text;
BEGIN
  IF NOT has_role(ARRAY['dono','admin','vendedor']) THEN
    RAISE EXCEPTION 'Permissão negada: apenas dono, admin ou vendedor podem editar itens de venda.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := NULLIF(v_item->>'produto_id', '')::uuid;
    v_preco      := (v_item->>'preco_unitario')::numeric;
    v_quantidade := (v_item->>'quantidade')::numeric;
    v_desconto   := COALESCE((v_item->>'desconto')::numeric, 0);
    -- antes a regra comparava o PERCENTUAL como se fosse R$; agora compara reais com reais
    v_desc_rs    := COALESCE(NULLIF(v_item->>'desconto_valor', '')::numeric,
                             v_quantidade * v_preco * v_desconto / 100);

    IF NOT v_pode_excecao THEN
      IF v_produto_id IS NOT NULL THEN
        v_custo := custo_total_produto(v_produto_id);
        IF v_custo IS NOT NULL AND v_preco < v_custo THEN
          RAISE EXCEPTION 'Preço unitário (R$ %) está abaixo do custo do produto (R$ %). Apenas dono ou admin podem vender abaixo do custo.',
            round(v_preco, 2), round(v_custo, 2);
        END IF;
      END IF;

      IF v_desc_rs > (v_quantidade * v_preco * 0.20) + 0.005 THEN
        RAISE EXCEPTION 'Desconto de R$ % excede o limite de 20%% do valor do item (R$ %). Apenas dono ou admin podem dar desconto maior.',
          round(v_desc_rs, 2), round(v_quantidade * v_preco * 0.20, 2);
      END IF;
    END IF;
  END LOOP;

  DELETE FROM venda_itens WHERE venda_id = p_venda_id;

  IF jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO venda_itens (
      venda_id, produto_id, descricao, quantidade, preco_unitario,
      custo_unitario, desconto, desconto_valor, obs, unidade, area_m2, acabamento_id, acabamento_qtd_estoque,
      detalhe_placa
    )
    SELECT
      p_venda_id,
      NULLIF(elem->>'produto_id', '')::uuid,
      (elem->>'descricao'),
      (elem->>'quantidade')::numeric,
      (elem->>'preco_unitario')::numeric,
      NULLIF(elem->>'custo_unitario', '')::numeric,
      COALESCE((elem->>'desconto')::numeric, 0),
      NULLIF(elem->>'desconto_valor', '')::numeric,
      (elem->>'obs'),
      COALESCE(elem->>'unidade', 'un'),
      NULLIF(elem->>'area_m2', '')::numeric,
      NULLIF(elem->>'acabamento_id', '')::uuid,
      NULLIF(elem->>'acabamento_qtd_estoque', '')::numeric,
      (elem->'detalhe_placa')
    FROM jsonb_array_elements(p_itens) AS elem;
  END IF;

  -- Resumo pra Produção — só a partir dos itens de Placa (detalhe_placa preenchido).
  SELECT string_agg(resumo, E'\n\n') INTO v_resumo
  FROM (
    SELECT
      vi.descricao || E'\n' ||
      'Dimensões: ' || (vi.detalhe_placa->>'largura') || ' × ' || (vi.detalhe_placa->>'altura') || ' m' ||
        CASE WHEN (vi.detalhe_placa->>'quantidade')::numeric > 1
             THEN ' (' || (vi.detalhe_placa->>'quantidade') || ' un.)' ELSE '' END || E'\n' ||
      'Material: ' || COALESCE(vi.detalhe_placa->'material'->>'nome', '—') || E'\n' ||
      CASE WHEN (vi.detalhe_placa->>'possui_armacao')::boolean
        THEN 'Estrutura: ' || COALESCE(vi.detalhe_placa->'serralheria'->>'metalon_nome', 'metalon') ||
             ' — ' || COALESCE(vi.detalhe_placa->'serralheria'->>'qtd_usada', '?') || ' m'
        ELSE 'Estrutura: sem armação (cliente já possui)'
      END ||
      CASE WHEN jsonb_array_length(COALESCE(vi.detalhe_placa->'acabamentos', '[]'::jsonb)) > 0
        THEN E'\n' || 'Acabamentos: ' || (
          SELECT string_agg((a->>'nome') || ' (' || (a->>'qtd_usada') || ')', ', ')
          FROM jsonb_array_elements(vi.detalhe_placa->'acabamentos') a
        )
        ELSE ''
      END || E'\n' ||
      'Instalação: ' || CASE vi.detalhe_placa->'instalacao'->>'tipo'
        WHEN 'sem' THEN 'sem instalação (retirada)'
        WHEN 'esticar' THEN 'esticar lona na estrutura do cliente'
        WHEN 'completa' THEN 'instalação completa'
        ELSE COALESCE(vi.detalhe_placa->'instalacao'->>'tipo', '—')
      END AS resumo
    FROM venda_itens vi
    WHERE vi.venda_id = p_venda_id
      AND vi.detalhe_placa IS NOT NULL
    ORDER BY vi.id
  ) t;

  IF v_resumo IS NOT NULL THEN
    UPDATE producao
    SET descricao = v_resumo
    WHERE venda_id = p_venda_id
      AND (descricao IS NULL OR btrim(descricao) = '');
  END IF;
END;
$function$;
