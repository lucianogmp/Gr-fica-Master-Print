-- Logo do sistema acessível antes do login (tela inicial). Só expõe as 2 URLs de imagem.
create or replace function public.logo_publico()
returns table(logo_escuro text, logo_claro text)
language sql stable security definer set search_path = public as $$
  select sistema_logo_url, sistema_logo_url_dark from configuracoes limit 1;
$$;
revoke all on function public.logo_publico() from public;
grant execute on function public.logo_publico() to anon, authenticated;
