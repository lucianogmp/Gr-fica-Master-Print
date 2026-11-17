-- Fechamento de fornecedor (adesivo / lona): separa itens vendidos por fornecedor e gera a despesa ao pagar.
ALTER TABLE public.venda_itens
  ADD COLUMN IF NOT EXISTS nome_arquivo text,
  ADD COLUMN IF NOT EXISTS fechamento_id uuid;

CREATE TABLE IF NOT EXISTS public.fechamentos_fornecedor (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome text NOT NULL,
  data          date NOT NULL DEFAULT current_date,
  total         numeric NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','pago')),
  itens         jsonb NOT NULL DEFAULT '[]'::jsonb,
  lancamento_id uuid REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  observacoes   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fechamentos_fornecedor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fechamentos_fornecedor_all ON public.fechamentos_fornecedor;
CREATE POLICY fechamentos_fornecedor_all ON public.fechamentos_fornecedor
  FOR ALL TO authenticated
  USING (usuario_tem_permissao('/financeiro/fornecedores-fechamento'))
  WITH CHECK (usuario_tem_permissao('/financeiro/fornecedores-fechamento'));

INSERT INTO public.rota_permissoes_padrao (rota, role)
SELECT '/financeiro/fornecedores-fechamento', r
FROM (VALUES ('dono'), ('admin'), ('financeiro')) AS v(r)
WHERE NOT EXISTS (
  SELECT 1 FROM public.rota_permissoes_padrao
  WHERE rota = '/financeiro/fornecedores-fechamento' AND role = v.r
);
