-- Ao marcar a venda como 'entregue', a data de entrega vira o dia da marcação
-- (fuso de São Paulo), a menos que a própria alteração já traga outra data.
-- Também preenche a data quando a venda está entregue e sem data.
CREATE OR REPLACE FUNCTION public.vendas_data_entrega_auto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NEW.status = 'entregue' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.data_entrega IS NULL THEN NEW.data_entrega := hoje; END IF;
    ELSIF OLD.status IS DISTINCT FROM 'entregue' THEN
      IF NEW.data_entrega IS NOT DISTINCT FROM OLD.data_entrega THEN
        NEW.data_entrega := hoje;
      END IF;
    ELSIF NEW.data_entrega IS NULL THEN
      NEW.data_entrega := hoje;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendas_data_entrega_auto ON public.vendas;
CREATE TRIGGER trg_vendas_data_entrega_auto
  BEFORE INSERT OR UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.vendas_data_entrega_auto();
