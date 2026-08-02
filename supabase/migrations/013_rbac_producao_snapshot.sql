-- =============================================================================
-- Migration: 013_rbac_producao_snapshot.sql
--
-- Estas funções já existiam em produção (criadas direto no SQL Editor em
-- algum momento) mas nunca tinham sido versionadas em nenhum arquivo deste
-- repositório. Corpo copiado fielmente do banco real em 2026-08-01, já
-- incluindo a correção de segurança aplicada nesta mesma data (ver seção 4).
--
-- Pré-requisitos: 004_security_hardening_complete.sql, 005_audit_estoque_tokens.sql
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: Numeração manual de vendas/orçamentos
-- =============================================================================

CREATE OR REPLACE FUNCTION public.definir_proxima_numeracao(p_tabela text, p_proximo_numero integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role TEXT;
BEGIN
  caller_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF caller_role IS NULL OR caller_role NOT IN ('dono', 'admin') THEN
    RAISE EXCEPTION 'Permissão negada: apenas dono ou admin podem alterar a numeração.';
  END IF;

  IF p_proximo_numero < 1 THEN
    RAISE EXCEPTION 'O próximo número deve ser 1 ou maior.';
  END IF;

  IF p_tabela = 'vendas' THEN
    PERFORM setval('public.vendas_numero_seq', p_proximo_numero, false);
  ELSIF p_tabela = 'orcamentos' THEN
    PERFORM setval('public.orcamentos_numero_seq', p_proximo_numero, false);
  ELSE
    RAISE EXCEPTION 'Tabela inválida: use "vendas" ou "orcamentos".';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.definir_proxima_numeracao FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_proxima_numeracao TO authenticated;


-- =============================================================================
-- SEÇÃO 2: Produção — timestamps automáticos de entrega + limpeza
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_producao_marcar_entregue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.etapa = 'entregue' AND (OLD.etapa IS DISTINCT FROM 'entregue') THEN
    NEW.entregue_em := now();
  ELSIF NEW.etapa <> 'entregue' THEN
    NEW.entregue_em := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_producao_marcar_entregue_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.etapa = 'entregue' AND NEW.entregue_em IS NULL THEN
    NEW.entregue_em := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_producao_marcar_entregue        ON producao;
DROP TRIGGER IF EXISTS tg_producao_marcar_entregue_insert  ON producao;

CREATE TRIGGER tg_producao_marcar_entregue
  BEFORE UPDATE ON producao
  FOR EACH ROW EXECUTE FUNCTION fn_producao_marcar_entregue();

CREATE TRIGGER tg_producao_marcar_entregue_insert
  BEFORE INSERT ON producao
  FOR EACH ROW EXECUTE FUNCTION fn_producao_marcar_entregue_insert();

-- Limpeza automática de ordens entregues há mais de 30 dias (chamada pelo pg_cron)
CREATE OR REPLACE FUNCTION public.fn_limpar_producao_entregue()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM public.producao
  WHERE etapa = 'entregue'
    AND entregue_em IS NOT NULL
    AND entregue_em < now() - interval '30 days';
$function$;


-- =============================================================================
-- SEÇÃO 3: KPIs de caixa do dia
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
  WHERE auth.uid() IS NOT NULL
    AND data = CURRENT_DATE;
$function$;

REVOKE ALL ON FUNCTION public.get_caixa_kpis_dia FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_caixa_kpis_dia TO authenticated;


-- =============================================================================
-- SEÇÃO 4: RBAC — get_my_role / has_role / user_role
--
-- ATENÇÃO: versões abaixo já incluem a correção de segurança de 2026-08-01.
-- As versões antigas (nunca versionadas) tinham fallback para user_metadata,
-- que é editável pelo próprio usuário via client SDK — abria caminho pra
-- auto-promoção de role caso app_metadata.role estivesse vazio. Removido.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '');
$function$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');
$function$;

CREATE OR REPLACE FUNCTION public.has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_my_role() = ANY(allowed_roles);
$function$;

REVOKE ALL ON FUNCTION public.get_my_role FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
-- user_role() é usada por policies antigas em estoque_movimentos, financeiro
-- e itens_orcamento e continua granted a anon/authenticated (RLS filtra pelo
-- retorno vazio de qualquer forma, é só a função de leitura de role em si).


-- =============================================================================
-- SEÇÃO 5: Definir role de usuário (chamada pelo front em useUsuarios.ts)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.definir_role_usuario(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role TEXT;
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

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', p_role)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', p_user_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.definir_role_usuario FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_role_usuario TO authenticated;


-- =============================================================================
-- SEÇÃO 6: Listagem de usuários (admin vê todos, usuário comum só a si mesmo)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.listar_usuarios()
RETURNS TABLE(id uuid, email text, nome text, role text, created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role text;
  caller_id uuid;
BEGIN
  caller_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  caller_id := auth.uid();

  IF caller_role IN ('dono', 'admin') THEN
    RETURN QUERY
      SELECT
        u.id,
        u.email::text,
        COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'name', u.email)::text,
        (u.raw_app_meta_data->>'role')::text,
        u.created_at,
        u.last_sign_in_at
      FROM auth.users u
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC;
  ELSE
    RETURN QUERY
      SELECT
        u.id,
        u.email::text,
        COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'name', u.email)::text,
        (u.raw_app_meta_data->>'role')::text,
        u.created_at,
        u.last_sign_in_at
      FROM auth.users u
      WHERE u.id = caller_id AND u.deleted_at IS NULL;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_usuarios FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_usuarios TO authenticated;


-- =============================================================================
-- SEÇÃO 7: BOM de produto (materiais que compõem cada produto)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.salvar_bom_produto(p_produto_id uuid, p_itens jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM produto_materias WHERE produto_id = p_produto_id;

  IF jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO produto_materias (produto_id, materia_prima_id, quantidade)
    SELECT
      p_produto_id,
      (item->>'materia_prima_id')::uuid,
      (item->>'quantidade')::numeric
    FROM jsonb_array_elements(p_itens) AS item
    WHERE (item->>'materia_prima_id') IS NOT NULL
      AND (item->>'quantidade')::numeric > 0;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.salvar_bom_produto FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_bom_produto TO authenticated;


-- =============================================================================
-- NOTA: convidar_usuario(text, text, text) existia em produção mas foi
-- removida (DROP) em 2026-08-01 por estar morta (sem uso no frontend — o
-- convite real passa pela Edge Function convidar-usuario via Admin API) e
-- por gravar a role no campo errado (raw_user_meta_data, editável pelo
-- próprio usuário, em vez de raw_app_meta_data). Não recriar.
-- =============================================================================


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema='public' AND routine_name IN
-- ('definir_proxima_numeracao','fn_producao_marcar_entregue',
--  'fn_producao_marcar_entregue_insert','fn_limpar_producao_entregue',
--  'get_caixa_kpis_dia','get_my_role','user_role','has_role',
--  'definir_role_usuario','listar_usuarios','salvar_bom_produto');
-- -- Deve retornar 11 linhas. convidar_usuario NÃO deve aparecer.
-- =============================================================================
