-- Logo público (login / carregamento): usa o logo do tema; se faltar, o da empresa.
create or replace function public.logo_publico()
returns table(logo_escuro text, logo_claro text)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(sistema_logo_url,''), nullif(empresa_logo_url,''), nullif(sistema_logo_url_dark,'')),
         coalesce(nullif(sistema_logo_url_dark,''), nullif(empresa_logo_url,''), nullif(sistema_logo_url,''))
  from configuracoes limit 1;
$$;
