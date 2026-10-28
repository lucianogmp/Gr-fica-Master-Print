-- =============================================================================
-- Taxa da maquininha com 4 casas decimais (ex: 1,3649%)
--
-- pagamentos_venda.juros_pct era numeric(5,2): uma taxa de 1,3649% era gravada
-- como 1,36%. Alargar a precisão não altera nenhum valor já gravado.
-- =============================================================================
ALTER TABLE public.pagamentos_venda
  ALTER COLUMN juros_pct TYPE numeric(7,4);
