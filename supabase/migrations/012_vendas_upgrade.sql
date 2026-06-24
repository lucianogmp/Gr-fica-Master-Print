-- =============================================================================
-- Migration: 012_vendas_upgrade.sql
-- Adiciona suporte a pagamentos parciais, parcelamento, frete e taxa adicional.
-- Execute no Supabase SQL Editor.
-- =============================================================================

-- ── 1. Novas colunas em vendas ───────────────────────────────────────────────

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS cliente_id       uuid REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendedor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frete            numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_adicional   numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parcelas         integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS juros_parcelas   numeric(5,2) DEFAULT 0;

-- Índices para buscas
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id  ON vendas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor_id ON vendas (vendedor_id);

-- ── 2. Tabela de pagamentos parciais ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pagamentos_venda (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id         uuid         NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  valor            numeric(10,2) NOT NULL CHECK (valor > 0),
  forma_pagamento  text         NOT NULL,
  parcelas         integer,
  juros_pct        numeric(5,2),
  data_pagamento   date         NOT NULL DEFAULT CURRENT_DATE,
  observacoes      text,
  usuario_id       uuid         REFERENCES auth.users(id),
  usuario_nome     text,
  created_at       timestamptz  NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE pagamentos_venda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pagamentos_venda_all" ON pagamentos_venda;
CREATE POLICY "pagamentos_venda_all" ON pagamentos_venda
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON pagamentos_venda FROM anon;

-- Índices
CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_id
  ON pagamentos_venda (venda_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_data
  ON pagamentos_venda (data_pagamento);

-- ── 3. Coluna formas_pagamento em configuracoes ───────────────────────────────

ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS venda_prazo_entrega_dias      integer,
  ADD COLUMN IF NOT EXISTS venda_taxa_adicional_padrao   numeric(10,2),
  ADD COLUMN IF NOT EXISTS venda_frete_padrao            numeric(10,2),
  ADD COLUMN IF NOT EXISTS venda_max_parcelas            integer DEFAULT 12,
  ADD COLUMN IF NOT EXISTS venda_juros_parcela           numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS formas_pagamento              jsonb;

-- ── 4. Trigger de audit em pagamentos_venda ───────────────────────────────────

DROP TRIGGER IF EXISTS tg_audit_pagamentos ON pagamentos_venda;
CREATE TRIGGER tg_audit_pagamentos
  AFTER INSERT OR UPDATE OR DELETE ON pagamentos_venda
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- ── 5. Atualizar RPC salvar_itens_venda para incluir produto_id e area_m2 ────

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
      venda_id, produto_id, descricao, quantidade,
      preco_unitario, desconto, obs, unidade
    )
    SELECT
      p_venda_id,
      NULLIF(item->>'produto_id', '')::uuid,
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

GRANT EXECUTE ON FUNCTION salvar_itens_venda TO authenticated;

-- ── 6. Verificação ───────────────────────────────────────────────────────────
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'vendas' ORDER BY ordinal_position;
-- → deve incluir: cliente_id, vendedor_id, frete, taxa_adicional, parcelas, juros_parcelas
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'pagamentos_venda';
-- → deve existir a tabela com todas as colunas
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'configuracoes' AND column_name LIKE 'venda_%';
-- → deve retornar as colunas de configuração de vendas
-- =============================================================================
