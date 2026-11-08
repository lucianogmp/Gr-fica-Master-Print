-- Ofertas no site: as datas comerciais do ERP viram "Ofertas de {data}" na loja quando a data se aproxima.
alter table public.datas_comerciais
  add column if not exists site_mostrar boolean not null default true,
  add column if not exists site_titulo text,
  add column if not exists site_texto text,
  add column if not exists site_dias_antes smallint check (site_dias_antes between 1 and 365);

-- Função pública (visitantes): só o necessário das campanhas ativas e liberadas para o site,
-- com os produtos já ativos e publicados no catálogo.
create or replace function public.loja_ofertas()
returns table(
  id uuid, nome text, regra text, mes smallint, dia smallint,
  dias_antes smallint, titulo text, texto text, produtos uuid[]
)
language sql stable security definer set search_path = public as $$
  select d.id, d.nome, d.regra, d.mes, d.dia,
         coalesce(d.site_dias_antes, d.dias_antecedencia) as dias_antes,
         nullif(trim(d.site_titulo), '') as titulo,
         nullif(trim(d.site_texto), '') as texto,
         coalesce((
           select array_agg(dp.produto_id order by dp.created_at)
           from public.datas_comerciais_produtos dp
           join public.produtos p on p.id = dp.produto_id
           where dp.data_id = d.id and p.status = 'ativo' and p.publicar_no_catalogo
         ), '{}') as produtos
  from public.datas_comerciais d
  where d.ativa and d.site_mostrar
$$;
revoke all on function public.loja_ofertas() from public;
grant execute on function public.loja_ofertas() to anon, authenticated;

-- Banners animados (GIF) no site: o bucket das imagens da loja passa a aceitar GIF e até 8 MB.
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'],
    file_size_limit = 8388608
where id = 'loja-produtos';

-- Promoção só no site (preço "de/por" ou %). O "de" é sempre o preço de venda do ERP.
alter table public.loja_produtos
  add column if not exists promo_tipo text check (promo_tipo in ('percentual','preco')),
  add column if not exists promo_valor numeric;
alter table public.loja_produtos drop constraint if exists loja_produtos_promo_ok;
alter table public.loja_produtos add constraint loja_produtos_promo_ok check (
  (promo_tipo is null and promo_valor is null)
  or (promo_tipo = 'percentual' and promo_valor > 0 and promo_valor < 100)
  or (promo_tipo = 'preco' and promo_valor > 0)
);
create or replace function public.loja_promocoes()
returns table(produto_id uuid, tipo text, valor numeric)
language sql stable security definer set search_path = public as $$
  select lp.produto_id, lp.promo_tipo, lp.promo_valor
  from public.loja_produtos lp
  join public.produtos p on p.id = lp.produto_id
  where lp.promo_tipo is not null and p.status = 'ativo' and p.publicar_no_catalogo
$$;
revoke all on function public.loja_promocoes() from public;
grant execute on function public.loja_promocoes() to anon, authenticated;
-- Funções do pedido (loja-criar-pedido / loja-meus-pedidos): ver supabase/functions/.

-- Oferta no site passa a ser opt-in: só aparece depois de ativada (no ERP ou na aba Ofertas do site).
alter table public.datas_comerciais alter column site_mostrar set default false;
update public.datas_comerciais set site_mostrar = false;
