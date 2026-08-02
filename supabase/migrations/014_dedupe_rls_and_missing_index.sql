-- =============================================================================
-- Migration: 014_dedupe_rls_and_missing_index.sql
--
-- Aplicada em produção em 2026-08-01 (parte da limpeza de performance do
-- checkup). Duas coisas:
--
-- 1) orcamentos tinha DUAS policies de SELECT ao mesmo tempo: "orc_read"
--    (qual = true, liberava leitura geral pra qualquer autenticado) e
--    "orcamentos_select" (restrita a dono/admin/vendedor). Como RLS é
--    permissivo (basta uma policy liberar), a policy restritiva nunca
--    tinha efeito de verdade. Removida "orc_read".
--
-- 2) 12 tabelas tinham uma policy "FOR ALL" cobrindo INSERT/UPDATE/DELETE/
--    SELECT ao mesmo tempo que uma policy de SELECT dedicada — duplicando
--    a checagem em toda leitura. O Postgres não aceita "FOR INSERT, UPDATE,
--    DELETE" numa policy só, então cada uma virou 3 policies separadas.
--    Nenhuma regra de acesso mudou, só parou de reavaliar a mesma condição
--    duas vezes por query.
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: orcamentos — remove policy de SELECT geral demais
-- =============================================================================
DROP POLICY IF EXISTS "orc_read" ON orcamentos;


-- =============================================================================
-- SEÇÃO 2: dedupe de policies ALL/SELECT sobrepostas
-- =============================================================================

-- acabamentos
DROP POLICY IF EXISTS "acabamentos_write" ON acabamentos;
CREATE POLICY "acabamentos_insert" ON acabamentos FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin']));
CREATE POLICY "acabamentos_update" ON acabamentos FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin'])) WITH CHECK (has_role(ARRAY['dono','admin']));
CREATE POLICY "acabamentos_delete" ON acabamentos FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin']));

-- configuracoes
DROP POLICY IF EXISTS "config_write" ON configuracoes;
CREATE POLICY "config_insert" ON configuracoes FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono']));
CREATE POLICY "config_update" ON configuracoes FOR UPDATE TO authenticated USING (has_role(ARRAY['dono'])) WITH CHECK (has_role(ARRAY['dono']));
CREATE POLICY "config_delete" ON configuracoes FOR DELETE TO authenticated USING (has_role(ARRAY['dono']));

-- financeiro (aproveitado pra trocar user_role() legado por has_role())
DROP POLICY IF EXISTS "fin_write" ON financeiro;
CREATE POLICY "fin_insert" ON financeiro FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin','financeiro']));
CREATE POLICY "fin_update" ON financeiro FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin','financeiro'])) WITH CHECK (has_role(ARRAY['dono','admin','financeiro']));
CREATE POLICY "fin_delete" ON financeiro FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin','financeiro']));

-- itens_orcamento (idem)
DROP POLICY IF EXISTS "itens_orc_write" ON itens_orcamento;
CREATE POLICY "itens_orc_insert" ON itens_orcamento FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin','vendedor']));
CREATE POLICY "itens_orc_update" ON itens_orcamento FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin','vendedor'])) WITH CHECK (has_role(ARRAY['dono','admin','vendedor']));
CREATE POLICY "itens_orc_delete" ON itens_orcamento FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin','vendedor']));

-- materiais_impressao
DROP POLICY IF EXISTS "mat_impressao_write" ON materiais_impressao;
CREATE POLICY "mat_impressao_insert" ON materiais_impressao FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin']));
CREATE POLICY "mat_impressao_update" ON materiais_impressao FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin'])) WITH CHECK (has_role(ARRAY['dono','admin']));
CREATE POLICY "mat_impressao_delete" ON materiais_impressao FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin']));

-- materias_primas
DROP POLICY IF EXISTS "mp_write" ON materias_primas;
CREATE POLICY "mp_insert" ON materias_primas FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin','producao']));
CREATE POLICY "mp_update" ON materias_primas FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin','producao'])) WITH CHECK (has_role(ARRAY['dono','admin','producao']));
CREATE POLICY "mp_delete" ON materias_primas FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin','producao']));

-- orcamento_itens
DROP POLICY IF EXISTS "orcamento_itens_all" ON orcamento_itens;
CREATE POLICY "orcamento_itens_insert" ON orcamento_itens FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin','vendedor']));
CREATE POLICY "orcamento_itens_update" ON orcamento_itens FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin','vendedor'])) WITH CHECK (has_role(ARRAY['dono','admin','vendedor']));
CREATE POLICY "orcamento_itens_delete" ON orcamento_itens FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin','vendedor']));

-- producao
DROP POLICY IF EXISTS "producao_write" ON producao;
CREATE POLICY "producao_insert" ON producao FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin','producao']));
CREATE POLICY "producao_update" ON producao FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin','producao'])) WITH CHECK (has_role(ARRAY['dono','admin','producao']));
CREATE POLICY "producao_delete" ON producao FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin','producao']));

-- produto_materias
DROP POLICY IF EXISTS "produto_materias_all" ON produto_materias;
CREATE POLICY "produto_materias_insert" ON produto_materias FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin','producao']));
CREATE POLICY "produto_materias_update" ON produto_materias FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin','producao'])) WITH CHECK (has_role(ARRAY['dono','admin','producao']));
CREATE POLICY "produto_materias_delete" ON produto_materias FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin','producao']));

-- produtos
DROP POLICY IF EXISTS "produtos_write" ON produtos;
CREATE POLICY "produtos_insert" ON produtos FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin','producao']));
CREATE POLICY "produtos_update" ON produtos FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin','producao'])) WITH CHECK (has_role(ARRAY['dono','admin','producao']));
CREATE POLICY "produtos_delete" ON produtos FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin','producao']));

-- vendedores
DROP POLICY IF EXISTS "vendedores_write" ON vendedores;
CREATE POLICY "vendedores_insert" ON vendedores FOR INSERT TO authenticated WITH CHECK (has_role(ARRAY['dono','admin']));
CREATE POLICY "vendedores_update" ON vendedores FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin'])) WITH CHECK (has_role(ARRAY['dono','admin']));
CREATE POLICY "vendedores_delete" ON vendedores FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin']));

-- estoque_movimentos: "est_mov_write" (ALL, legado com user_role()) sobrepunha
-- tanto o SELECT (estoque_mov_select) quanto o INSERT (estoque_mov_write).
-- Removida; UPDATE/DELETE recriados com has_role(), INSERT/SELECT já existiam.
DROP POLICY IF EXISTS "est_mov_write" ON estoque_movimentos;
CREATE POLICY "estoque_mov_update" ON estoque_movimentos FOR UPDATE TO authenticated USING (has_role(ARRAY['dono','admin','producao'])) WITH CHECK (has_role(ARRAY['dono','admin','producao']));
CREATE POLICY "estoque_mov_delete" ON estoque_movimentos FOR DELETE TO authenticated USING (has_role(ARRAY['dono','admin','producao']));


-- =============================================================================
-- SEÇÃO 3: índice faltando em FK (vendas.orcamento_origem_id)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_vendas_orcamento_origem
  ON vendas (orcamento_origem_id);


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
-- SELECT tablename, count(*) FROM pg_policies WHERE schemaname='public'
-- AND tablename IN ('acabamentos','configuracoes','financeiro','itens_orcamento',
-- 'materiais_impressao','materias_primas','orcamento_itens','orcamentos',
-- 'producao','produto_materias','produtos','vendedores','estoque_movimentos')
-- GROUP BY tablename;
-- -- Cada tabela deve ter exatamente 4 (INSERT/UPDATE/DELETE/SELECT).
-- =============================================================================
