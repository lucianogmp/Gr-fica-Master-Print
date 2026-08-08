-- =============================================================================
-- Migration: 020_create_fornecedores.sql
--
-- Aplicada em produção em 2026-08-07, resultado da resposta final da
-- auditoria completa ("Teste Final"): tabela fornecedores estava ausente,
-- apesar de ser um dos cadastros que o Luciano quer confiar no sistema.
-- =============================================================================

CREATE TABLE fornecedores (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  razao_social        text,
  nome_fantasia       text,
  cpf_cnpj            text,
  inscricao_estadual  text,
  telefone            text,
  email               text,
  endereco            text,
  numero              text,
  bairro              text,
  cidade              text,
  estado              text,
  cep                 text,
  categoria           text,  -- ex: "papel", "tinta", "acabamento", "equipamento"
  observacoes         text,
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

CREATE INDEX idx_fornecedores_cpf_cnpj ON fornecedores (cpf_cnpj);
CREATE INDEX idx_fornecedores_ativo    ON fornecedores (ativo);

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_fornecedores_updated_at
  BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedores_select" ON fornecedores
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['dono','admin','producao']));

CREATE POLICY "fornecedores_insert" ON fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (has_role(ARRAY['dono','admin','producao']));

CREATE POLICY "fornecedores_update" ON fornecedores
  FOR UPDATE TO authenticated
  USING (has_role(ARRAY['dono','admin','producao']))
  WITH CHECK (has_role(ARRAY['dono','admin','producao']));

CREATE POLICY "fornecedores_delete" ON fornecedores
  FOR DELETE TO authenticated
  USING (has_role(ARRAY['dono','admin']));

-- Vínculo com materias_primas: "de quem eu compro essa matéria-prima"
ALTER TABLE materias_primas
  ADD COLUMN fornecedor_id uuid REFERENCES fornecedores(id) ON DELETE SET NULL;

CREATE INDEX idx_materias_primas_fornecedor ON materias_primas (fornecedor_id);


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode após aplicar
-- =============================================================================
-- SELECT count(*) FROM fornecedores; -- deve rodar sem erro
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='materias_primas' AND column_name='fornecedor_id';
-- =============================================================================
