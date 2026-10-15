-- Permissão "Ver custos e gerar PDF de custos" nos orçamentos.
-- Padrão: dono e admin. Pode ser liberada/bloqueada por usuário em
-- Configurações > Usuários > Permissões (tabela permissoes_usuario).
INSERT INTO public.rota_permissoes_padrao (rota, role)
SELECT '/orcamentos/custos', r
FROM (VALUES ('dono'), ('admin')) AS v(r)
WHERE NOT EXISTS (
  SELECT 1 FROM public.rota_permissoes_padrao
  WHERE rota = '/orcamentos/custos' AND role = v.r
);
