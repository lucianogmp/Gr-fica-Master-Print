-- 026_produtos_prazo_entrega.sql
-- Prazo de entrega do produto (dias úteis). Campo só informativo: NÃO entra no custo.
-- (o "tempo_producao" é o tempo real de trabalho/máquina e é o que gera overhead)
alter table public.produtos add column if not exists prazo_entrega_dias integer;
alter table public.produtos drop constraint if exists produtos_prazo_entrega_dias_check;
alter table public.produtos add constraint produtos_prazo_entrega_dias_check
  check (prazo_entrega_dias is null or prazo_entrega_dias >= 0);
comment on column public.produtos.prazo_entrega_dias is
  'Prazo de entrega em dias úteis. Informativo: NÃO entra no custo (diferente de tempo_producao, que gera overhead).';
