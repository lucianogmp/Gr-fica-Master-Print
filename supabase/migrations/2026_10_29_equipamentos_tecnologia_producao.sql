-- Tecnologia do equipamento + produção mensal (base do custo por página / m²). Aditivo.
ALTER TABLE public.depreciacao
  ADD COLUMN IF NOT EXISTS tecnologia   text,
  ADD COLUMN IF NOT EXISTS producao_mes numeric CHECK (producao_mes IS NULL OR producao_mes > 0);
COMMENT ON COLUMN public.depreciacao.tecnologia IS 'laser | jato_tinta | plotter_impressao | plotter_recorte | acabamento | outro. Define consumiveis sugeridos e a unidade do custo (pagina, m2, hora).';
COMMENT ON COLUMN public.depreciacao.producao_mes IS 'Paginas (ou m2) produzidas por mes. Base do custo por pagina/m2. NULL = estimativa padrao da tecnologia.';
