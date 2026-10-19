-- 024_realtime_tabelas.sql
--
-- Libera o Realtime do Supabase para as tabelas que o app escuta em
-- src/hooks/useRealtimeSync.ts (atualização automática das telas, sem F5).
--
-- Idempotente: só adiciona à publicação as tabelas que ainda não estão lá.
-- Para desfazer uma tabela:  alter publication supabase_realtime drop table public.<tabela>;
-- (as policies de RLS continuam valendo: cada usuário só recebe eventos do que pode ler)

do $$
declare
  t text;
  tabelas text[] := array[
    'acabamentos', 'atendimentos', 'caixa_movimentos', 'categorias', 'configuracoes',
    'contas_bancarias', 'contatos', 'custos_fixos', 'custos_variaveis', 'depreciacao',
    'estoque_movimentos', 'fornecedores', 'leads', 'materiais_impressao', 'metalon_tipos',
    'orcamento_itens', 'pagamentos_venda', 'permissoes_usuario', 'producao',
    'produto_materias', 'produtos', 'venda_itens',
    -- já estavam publicadas; mantidas aqui pra o script ser a "lista oficial"
    'clientes', 'lancamentos', 'materias_primas', 'orcamentos', 'vendas'
  ];
begin
  foreach t in array tabelas loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t)
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
