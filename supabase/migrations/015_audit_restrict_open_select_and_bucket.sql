-- =============================================================================
-- Migration: 015_audit_restrict_open_select_and_bucket.sql
--
-- Aplicada em produção em 2026-08-01, resultado da auditoria de segurança
-- completa do Supabase (RLS, storage, RPCs, dados sensíveis).
-- =============================================================================


-- =============================================================================
-- 1) configuracoes: SELECT era liberado pra qualquer autenticado, sem checar
--    role. É onde ficam dados de conta bancária/PIX/taxas — restrito a
--    dono/admin.
-- =============================================================================
DROP POLICY IF EXISTS "config_select" ON configuracoes;
CREATE POLICY "config_select" ON configuracoes
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['dono','admin']));


-- =============================================================================
-- 2) 4 policies de SELECT com "USING (true)" — qualquer autenticado lia tudo
--    independente de role (não expostas a anon, mas sem filtro de role
--    nenhum). Restringidas espelhando os roles já usados nas policies de
--    escrita de cada tabela.
-- =============================================================================

DROP POLICY IF EXISTS "fin_read" ON financeiro;
CREATE POLICY "fin_read" ON financeiro
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['dono','admin','financeiro']));

DROP POLICY IF EXISTS "itens_orc_read" ON itens_orcamento;
CREATE POLICY "itens_orc_read" ON itens_orcamento
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['dono','admin','vendedor']));

DROP POLICY IF EXISTS "orc_itens_read" ON orcamento_itens;
CREATE POLICY "orc_itens_read" ON orcamento_itens
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['dono','admin','vendedor']));

DROP POLICY IF EXISTS "prod_mat_read" ON produto_materias;
CREATE POLICY "prod_mat_read" ON produto_materias
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['dono','admin','producao']));


-- =============================================================================
-- 3) get_caixa_kpis_dia(): só checava auth.uid() IS NOT NULL, sem role.
--    Adicionada checagem consistente com o resto do módulo financeiro.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_caixa_kpis_dia()
RETURNS TABLE(entradas_hoje numeric, saidas_hoje numeric, saldo_hoje numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) AS entradas_hoje,
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0) AS saidas_hoje,
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) - COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0) AS saldo_hoje
  FROM public.caixa_movimentos
  WHERE has_role(ARRAY['dono','admin','financeiro'])
    AND data = CURRENT_DATE;
$function$;


-- =============================================================================
-- 4) Bucket 'logos': sem limite de tamanho nem de tipo de arquivo.
--    Restrito a imagem, até 3MB.
-- =============================================================================
UPDATE storage.buckets
SET file_size_limit = 3145728, -- 3MB
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']
WHERE id = 'logos';


-- =============================================================================
-- NOTA: a auditoria também encontrou configuracoes.mp_access_token /
-- mp_pix_chave gravados em texto puro (não no Vault). Por decisão do
-- Luciano, essas colunas ficam como estão por enquanto — ele não vai
-- integrar a API do Mercado Pago (só registra pra qual conta o dinheiro
-- vai: MP, banco, caixa físico) e pretende remover essas colunas depois.
-- Não recriar/usar salvar_token/ler_token pra isso sem confirmar com ele.
-- =============================================================================


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
-- SELECT tablename, policyname, qual::text FROM pg_policies
-- WHERE schemaname='public' AND policyname IN
-- ('config_select','fin_read','itens_orc_read','orc_itens_read','prod_mat_read');
--
-- SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='logos';
-- =============================================================================
