-- minhas_permissoes() falhava com "column reference rota is ambiguous"; o app
-- escondia o erro usando o padrão do cargo. Corrigido com alias.
CREATE OR REPLACE FUNCTION public.minhas_permissoes()
 RETURNS TABLE(rota text, permitido boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role    text := public.get_my_role();
BEGIN
  RETURN QUERY
  SELECT rr.r,
    COALESCE(
      (SELECT pu.permitido FROM public.permissoes_usuario pu WHERE pu.usuario_id = v_user_id AND pu.rota = rr.r),
      EXISTS(SELECT 1 FROM public.rota_permissoes_padrao rp WHERE rp.rota = rr.r AND rp.role = v_role)
    ) AS permitido
  FROM (SELECT DISTINCT d.rota AS r FROM public.rota_permissoes_padrao d) rr;
END;
$function$;
