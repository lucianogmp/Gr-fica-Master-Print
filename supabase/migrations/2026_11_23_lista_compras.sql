-- Lista de compras (Estoque): matérias-primas marcadas para comprar, mesmo com estoque OK.
CREATE TABLE IF NOT EXISTS public.lista_compras (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_prima_id uuid REFERENCES public.materias_primas(id) ON DELETE SET NULL,
  nome             text NOT NULL,
  unidade          text,
  quantidade       numeric,
  observacao       text,
  comprar_ate      date,
  comprado         boolean NOT NULL DEFAULT false,
  comprado_em      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lista_compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lista_compras_all ON public.lista_compras;
CREATE POLICY lista_compras_all ON public.lista_compras
  FOR ALL TO authenticated
  USING (usuario_tem_permissao('/estoque/lista-compras'))
  WITH CHECK (usuario_tem_permissao('/estoque/lista-compras'));

INSERT INTO public.rota_permissoes_padrao (rota, role)
SELECT '/estoque/lista-compras', r
FROM (VALUES ('dono'), ('admin'), ('producao')) AS v(r)
WHERE NOT EXISTS (
  SELECT 1 FROM public.rota_permissoes_padrao WHERE rota = '/estoque/lista-compras' AND role = v.r
);
