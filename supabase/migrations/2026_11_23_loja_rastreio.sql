-- Código de rastreio do pedido da loja + cache do andamento dos Correios (lido só pela função do servidor)
alter table public.orcamentos add column if not exists codigo_rastreio text;

create table if not exists public.loja_rastreio_cache (
  orcamento_id uuid primary key references public.orcamentos(id) on delete cascade,
  codigo text not null,
  eventos jsonb not null default '[]'::jsonb,
  entregue boolean not null default false,
  previsto text,
  atualizado_em timestamptz not null default now()
);
alter table public.loja_rastreio_cache enable row level security;
