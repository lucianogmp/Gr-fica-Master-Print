-- =============================================================================
-- Migration: 016_protect_owner_and_align_audit_log.sql
--
-- Aplicada em produção em 2026-08-02, resultado da auditoria de autenticação
-- (Login/Auth). Duas correções:
-- =============================================================================


-- =============================================================================
-- 1) definir_role_usuario: a Edge Function excluir-usuario já bloqueava um
--    admin de excluir o dono, mas essa função não tinha a mesma proteção
--    contra REBAIXAR a role do dono — mesmo efeito prático (tirar o dono
--    do controle do sistema), caminho diferente. Corrigido: só o próprio
--    dono pode alterar a role de outro usuário que já é dono.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.definir_role_usuario(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role TEXT;
  alvo_role TEXT;
BEGIN
  caller_role := (auth.jwt() -> 'app_metadata' ->> 'role');

  IF caller_role NOT IN ('dono', 'admin') THEN
    RAISE EXCEPTION 'Permissão negada: apenas dono ou admin podem definir roles.';
  END IF;

  IF p_role = 'dono' AND caller_role != 'dono' THEN
    RAISE EXCEPTION 'Apenas o dono pode criar outro dono.';
  END IF;

  IF p_role NOT IN ('dono', 'admin', 'vendedor', 'financeiro', 'producao') THEN
    RAISE EXCEPTION 'Role inválido: %', p_role;
  END IF;

  SELECT (raw_app_meta_data->>'role') INTO alvo_role
  FROM auth.users WHERE id = p_user_id;

  IF alvo_role = 'dono' AND caller_role != 'dono' THEN
    RAISE EXCEPTION 'Apenas o dono pode alterar a role de outro dono.';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', p_role)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', p_user_id;
  END IF;
END;
$function$;


-- =============================================================================
-- 2) audit_log: SELECT permitia 'dono' e 'admin' no banco, mas o frontend
--    (ROUTE_PERMISSIONS em src/types/roles.ts) só libera a rota /audit-log
--    pra 'dono'. Restringido o backend pra bater com a intenção original,
--    fechando a brecha de um admin ler via chamada direta à API.
-- =============================================================================
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['dono']));


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
-- SELECT policyname, qual::text FROM pg_policies
-- WHERE schemaname='public' AND tablename='audit_log' AND cmd='SELECT';
-- -- Deve retornar has_role(ARRAY['dono'::text])
-- =============================================================================
