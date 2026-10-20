-- 025_obter_config_comercial.sql
--
-- PROBLEMA: `configuracoes` só pode ser lida por dono/admin (policy config_select, migração 015),
-- porque a tabela guarda tokens/chaves (Mercado Pago, PIX...). Resultado: para o VENDEDOR (e
-- qualquer outro usuário que não seja dono/admin) a leitura volta vazia, e o sistema usa a mensagem
-- padrão do WhatsApp, documentos sem os dados/logo da empresa, etc.
--
-- SOLUÇÃO: função que devolve SÓ os campos não sensíveis (lista fixa abaixo — o que já sai impresso
-- nos documentos e na mensagem do orçamento). Nunca devolve mp_*, chaves PIX, taxas, etc.
-- Campos novos na tabela NÃO são expostos automaticamente (só entram se forem adicionados à lista).

create or replace function public.obter_config_comercial()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  from (select * from public.configuracoes limit 1) c,
       lateral jsonb_each(to_jsonb(c)) e
  where e.key = any (array[
    -- empresa (cabeçalho/rodapé dos documentos)
    'empresa_nome', 'empresa_razao_social', 'empresa_cnpj', 'empresa_ie', 'empresa_telefone',
    'empresa_whatsapp', 'empresa_email', 'empresa_site', 'empresa_endereco', 'empresa_logo_url',
    'empresa_rodape',
    -- orçamento (texto que acompanha o documento e a mensagem de WhatsApp)
    'orc_validade_dias', 'orc_obs_padrao', 'orc_garantia', 'orc_rodape', 'mensagem_whatsapp_orcamento',
    -- layout dos documentos impressos
    'layout_impressao_venda', 'layout_impressao_orcamento', 'layout_impressao_catalogo',
    -- aparência do sistema
    'sistema_logo_url', 'sistema_logo_url_dark', 'tema_modo'
  ]);
$$;

revoke all on function public.obter_config_comercial() from public, anon;
grant execute on function public.obter_config_comercial() to authenticated;
