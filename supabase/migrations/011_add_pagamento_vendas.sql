-- =============================================================================
-- Migration: 011_add_pagamento_vendas.sql
-- Adiciona opções de pagamento e controle de saldo nas vendas
-- =============================================================================

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS valor_pago numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento text;
