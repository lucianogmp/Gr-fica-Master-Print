-- =============================================================================
-- Migration: 006_fix_produtos_categorias_fk.sql
-- Cria a Foreign Key de produtos.categoria_id → categorias.id
-- Isso é necessário para o PostgREST reconhecer o relacionamento
-- e para resolver o erro:
-- "Could not find the 'categorias' column of 'produtos' in the schema cache"
-- =============================================================================

-- 1. Garante que a tabela categorias existe com a estrutura correta
CREATE TABLE IF NOT EXISTS categorias (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text         NOT NULL,
  empresa_id uuid,
  created_at timestamptz  NOT NULL DEFAULT now()
);

-- 2. Garante que a coluna categoria_id existe em produtos
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS categoria_id uuid;

-- 3. Remove a FK antiga caso já exista com nome diferente (seguro)
ALTER TABLE produtos
  DROP CONSTRAINT IF EXISTS produtos_categoria_id_fkey;

-- 4. Cria a Foreign Key correta
ALTER TABLE produtos
  ADD CONSTRAINT produtos_categoria_id_fkey
  FOREIGN KEY (categoria_id)
  REFERENCES categorias(id)
  ON DELETE SET NULL;

-- 5. Índice para performance nas queries de join
CREATE INDEX IF NOT EXISTS idx_produtos_categoria_id
  ON produtos (categoria_id);

-- =============================================================================
-- VERIFICAÇÃO — rode após aplicar:
--
-- SELECT
--   tc.constraint_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table,
--   ccu.column_name AS foreign_column
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name = 'produtos';
-- → deve retornar: produtos_categoria_id_fkey | categoria_id | categorias | id
-- =============================================================================
