-- Venda marcada como 'entregue' leva a ordem de produção para a etapa 'entregue' (Concluídos)
CREATE OR REPLACE FUNCTION public.vendas_sincroniza_producao_entregue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'entregue' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'entregue') THEN
    UPDATE public.producao
       SET etapa = 'entregue', updated_at = now()
     WHERE venda_id = NEW.id AND etapa IS DISTINCT FROM 'entregue';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendas_sync_producao_entregue ON public.vendas;
CREATE TRIGGER trg_vendas_sync_producao_entregue
  AFTER INSERT OR UPDATE OF status ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.vendas_sincroniza_producao_entregue();

-- Ordens antigas cuja venda já foi entregue
UPDATE public.producao p
   SET etapa = 'entregue', updated_at = now()
  FROM public.vendas v
 WHERE p.venda_id = v.id AND v.status = 'entregue' AND p.etapa IS DISTINCT FROM 'entregue';
