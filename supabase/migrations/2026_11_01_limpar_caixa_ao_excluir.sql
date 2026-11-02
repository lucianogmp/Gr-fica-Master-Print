-- Excluir pagamento/venda agora apaga também o que ficou no caixa/lançamentos (antes sobrava
-- e continuava somando no Dashboard). Aplicado no banco em 2026-11-01.
create or replace function public.fn_pagamento_venda_limpa_caixa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from caixa_movimentos where origem = 'pagamento_venda:' || old.id::text;
  return old;
end $$;
drop trigger if exists tg_pagamento_venda_limpa_caixa on pagamentos_venda;
create trigger tg_pagamento_venda_limpa_caixa before delete on pagamentos_venda
  for each row execute function public.fn_pagamento_venda_limpa_caixa();

create or replace function public.fn_venda_limpa_financeiro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from lancamentos where venda_id = old.id;
  delete from caixa_movimentos where venda_id = old.id;
  return old;
end $$;
drop trigger if exists tg_venda_limpa_financeiro on vendas;
create trigger tg_venda_limpa_financeiro before delete on vendas
  for each row execute function public.fn_venda_limpa_financeiro();

delete from caixa_movimentos c
 where c.origem like 'pagamento_venda:%'
   and not exists (select 1 from pagamentos_venda p where c.origem = 'pagamento_venda:' || p.id::text);
