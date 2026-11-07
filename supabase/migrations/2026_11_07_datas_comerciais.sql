-- Datas comerciais (campanhas sazonais): aviso antecipado + produtos sugeridos por data.
-- Já aplicada no banco de produção em 2026-11-07 (guardada aqui para histórico/backup).
create table if not exists public.datas_comerciais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  regra text not null default 'fixa'
    check (regra in ('fixa','pascoa','carnaval','dia_das_maes','dia_dos_pais','black_friday')),
  mes smallint check (mes between 1 and 12),
  dia smallint check (dia between 1 and 31),
  dias_antecedencia smallint not null default 30 check (dias_antecedencia between 1 and 365),
  ativa boolean not null default true,
  ideias text,
  palavras_chave text[] not null default '{}',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint datas_comerciais_fixa_exige_dia check (regra <> 'fixa' or (mes is not null and dia is not null))
);

create table if not exists public.datas_comerciais_produtos (
  id uuid primary key default gen_random_uuid(),
  data_id uuid not null references public.datas_comerciais(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  destacar_no_site boolean not null default false,
  destaque_aplicado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (data_id, produto_id)
);
create index if not exists datas_comerciais_produtos_data_idx on public.datas_comerciais_produtos(data_id);
create index if not exists datas_comerciais_produtos_produto_idx on public.datas_comerciais_produtos(produto_id);

alter table public.datas_comerciais enable row level security;
alter table public.datas_comerciais_produtos enable row level security;

create policy datas_comerciais_all on public.datas_comerciais
  for all to authenticated
  using (has_role(array['dono','admin']))
  with check (has_role(array['dono','admin']));

create policy datas_comerciais_produtos_all on public.datas_comerciais_produtos
  for all to authenticated
  using (has_role(array['dono','admin']))
  with check (has_role(array['dono','admin']));

-- Produtos mais vendidos num período (respeita o RLS de quem chama).
create or replace function public.produtos_mais_vendidos_periodo(p_ini date, p_fim date, p_limite int default 12)
returns table(produto_id uuid, nome text, quantidade numeric, faturamento numeric, vendas bigint)
language sql stable security invoker set search_path = public as $$
  select vi.produto_id, p.nome, sum(vi.quantidade), sum(vi.total), count(distinct vi.venda_id)
  from venda_itens vi
  join vendas v on v.id = vi.venda_id
  join produtos p on p.id = vi.produto_id
  where v.data_venda between p_ini and p_fim
    and vi.produto_id is not null
    and p.status = 'ativo'
  group by vi.produto_id, p.nome
  order by sum(vi.total) desc
  limit greatest(p_limite, 1)
$$;
revoke all on function public.produtos_mais_vendidos_periodo(date, date, int) from public, anon;
grant execute on function public.produtos_mais_vendidos_periodo(date, date, int) to authenticated;

-- Lista inicial (ajustável na tela): 12 datas com palavras para sugerir produtos do catálogo.
insert into public.datas_comerciais (nome, regra, mes, dia, ideias, palavras_chave, observacoes)
select * from (values
  ('Dia da Mulher', 'fixa', 3, 8, 'Lembranças e embalagens para presentear', array['caneca','sacola','tag','etiqueta','papel de seda','imã','ima'], null),
  ('Carnaval', 'carnaval', null::int, null::int, 'Adesivos, tags e decoração de bloco/evento', array['adesivo','tag','banner','etiqueta'], null),
  ('Páscoa', 'pascoa', null, null, 'Embalagens e etiquetas para ovos e caixas de chocolate', array['adesivo','tag','etiqueta','sacola','papel de seda','topo'], null),
  ('Dia das Mães', 'dia_das_maes', null, null, 'Presentes personalizados, fotos, canecas e embalagens', array['caneca','foto','quadro','sacola','papel de seda','tag','imã','ima','adesivo'], null),
  ('Dia dos Namorados', 'fixa', 6, 12, 'Presentes personalizados e embalagens', array['caneca','foto','quadro','sacola','tag','adesivo','papel de seda'], null),
  ('Dia dos Pais', 'dia_dos_pais', null, null, 'Presentes personalizados e embalagens', array['caneca','foto','quadro','sacola','tag','adesivo'], null),
  ('Dia do Cliente', 'fixa', 9, 15, 'Material de promoção e fidelização para lojas', array['banner','cartaz','cartão','tag','sacola','adesivo','imã','ima'], null),
  ('Dia das Crianças', 'fixa', 10, 12, 'Brindes, adesivos e embalagens para lojas de brinquedo e festas', array['adesivo','topo','tag','sacola','foto','caneca'], null),
  ('Black Friday', 'black_friday', null, null, 'Cartazes, banners e sacolas para o varejo na campanha', array['banner','cartaz','lona','sacola','adesivo','tag','display','plaquinha'], null),
  ('Natal', 'fixa', 12, 25, 'Embalagens, tags, cartões, calendários e presentes', array['sacola','tag','etiqueta','papel de seda','calendário','calendario','caneca','cartão','imã','ima','adesivo'], null),
  ('Volta às aulas', 'fixa', 2, 1, 'Etiquetas, apostilas, impressões e encadernação', array['impressão','apostila','encaderna','etiqueta','adesivo','pasta','plastifica','xerox','bloco'], 'Data aproximada (início do ano letivo) — ajuste se quiser.'),
  ('Formaturas (fim de ano)', 'fixa', 12, 1, 'Convites, fotos, canecas, banners e lembranças', array['foto','caneca','banner','quadro','adesivo','marcador','imã','ima'], 'Data aproximada (temporada de formaturas) — ajuste se quiser.')
) as t(nome, regra, mes, dia, ideias, palavras_chave, observacoes)
where not exists (select 1 from public.datas_comerciais);
