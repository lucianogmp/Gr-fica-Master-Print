-- Garante que vendas criadas por telas antigas, importações ou RPCs sem título
-- não violem a constraint NOT NULL de vendas.tipo.

UPDATE vendas
SET tipo = 'Sem título'
WHERE tipo IS NULL OR btrim(tipo) = '';

ALTER TABLE vendas
  ALTER COLUMN tipo SET DEFAULT 'Sem título';
