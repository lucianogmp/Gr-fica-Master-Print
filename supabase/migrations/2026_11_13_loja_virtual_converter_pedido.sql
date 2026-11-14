-- Loja virtual: pedido do site vira venda por aqui (mesma conversão que o botão "Converter em Venda"
-- do Orçamento faz no navegador, mas dentro do banco, para o pagamento online poder aprovar sozinho).
--
--  loja_converter_pedido(orcamento_id)  -> só o servidor (service role) chama; sem checagem de usuário.
--  loja_aprovar_pedido(orcamento_id)    -> botão "Aprovar e virar venda" da aba Loja virtual (dono/admin/vendedor).
-- Os dois são idempotentes: se o pedido já virou venda, devolvem a venda que já existe.

create or replace function public.loja_converter_pedido(p_orcamento_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  o        record;
  v_id     uuid;
  v_prazo  integer;
  v_entr   date;
begin
  select * into o from public.orcamentos where id = p_orcamento_id and origem = 'loja' for update;
  if not found then
    raise exception 'Pedido da loja não encontrado.';
  end if;
  if o.venda_id is not null then
    return o.venda_id;
  end if;
  if o.status = 'recusado' then
    raise exception 'Pedido recusado não pode virar venda.';
  end if;

  -- Previsão de entrega: média (arredondada pra cima) dos prazos dos produtos distintos, como no ERP
  select ceil(avg(t.prazo_entrega_dias))::integer into v_prazo
  from (
    select distinct pr.id, pr.prazo_entrega_dias
    from public.orcamento_itens i
    join public.produtos pr on pr.id = i.produto_id
    where i.orcamento_id = o.id and coalesce(pr.prazo_entrega_dias, 0) > 0
  ) t;
  if v_prazo is not null then
    v_entr := ((now() at time zone 'America/Sao_Paulo')::date + v_prazo);
  end if;

  insert into public.vendas (
    cliente_nome, cliente_id, solicitante, consumidor_final, status, desconto, observacoes, tipo,
    vendedor, orcamento_origem_id, orcamento_origem_numero, vendedor_id, valor_total, data_venda, data_entrega
  ) values (
    case when o.cliente_id is null then 'Cliente sem cadastro' else o.cliente_nome end,
    o.cliente_id, o.solicitante, (o.cliente_id is null), 'aprovado', coalesce(o.desconto, 0), o.observacoes,
    coalesce(nullif(btrim(o.tipo), ''), 'Pedido da loja'),
    o.vendedor, o.id, o.numero, o.vendedor_id, coalesce(o.total, 0),
    (now() at time zone 'America/Sao_Paulo')::date, v_entr
  ) returning id into v_id;

  insert into public.venda_itens (
    venda_id, produto_id, descricao, quantidade, preco_unitario, desconto, desconto_valor, obs, unidade, acabamento_id,
    acabamento_qtd_estoque, detalhe_placa
  )
  select v_id, i.produto_id, i.descricao, i.quantidade, coalesce(i.preco_unitario, 0), coalesce(i.desconto, 0),
         i.desconto_valor, i.observacao_item, 'un', i.acabamento_id, i.acabamento_qtd_estoque, i.detalhe_placa
  from public.orcamento_itens i
  where i.orcamento_id = o.id
  order by i.created_at, i.id;

  update public.orcamentos set status = 'convertido', venda_id = v_id where id = o.id;
  return v_id;
end;
$$;

revoke all on function public.loja_converter_pedido(uuid) from public, anon, authenticated;

create or replace function public.loja_aprovar_pedido(p_orcamento_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.has_role(array['dono','admin','vendedor']) then
    raise exception 'Permissão negada: apenas dono, admin ou vendedor aprovam pedidos da loja.';
  end if;
  return public.loja_converter_pedido(p_orcamento_id);
end;
$$;

revoke all on function public.loja_aprovar_pedido(uuid) from public, anon;
grant execute on function public.loja_aprovar_pedido(uuid) to authenticated;
