-- =============================================================================
-- Gestão de Custos: custo real por hora de cada equipamento
--
-- 100% aditivo: só adiciona colunas (com default que mantém o cálculo atual)
-- e tabelas novas. Nenhum dado existente é alterado ou apagado.
--
--  * depreciacao (= cadastro de equipamentos) ganha: valor residual, horas
--    produtivas por mês, situação ativo/inativo e dados de energia/outros custos.
--      - horas_mes default 160  -> é exatamente a base que o Produtos já usava
--      - valor_residual default 0 -> depreciação igual à de hoje
--  * equipamento_consumiveis: consumíveis específicos de cada máquina
--  * equipamento_manutencoes: histórico de manutenção / troca de peça / reparo
--  * produtos.maquinas_tempo: tempo de uso de cada máquina no produto, ligado
--    ao equipamento pelo ID (o campo antigo "maquina" continua existindo)
-- =============================================================================

-- ── Equipamentos (ampliação da tabela depreciacao) ───────────────────────────
ALTER TABLE public.depreciacao
  ADD COLUMN IF NOT EXISTS valor_residual       numeric NOT NULL DEFAULT 0   CHECK (valor_residual >= 0),
  ADD COLUMN IF NOT EXISTS horas_mes            numeric NOT NULL DEFAULT 160 CHECK (horas_mes > 0),
  ADD COLUMN IF NOT EXISTS ativo                boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS potencia_kw          numeric CHECK (potencia_kw IS NULL OR potencia_kw >= 0),
  ADD COLUMN IF NOT EXISTS preco_kwh            numeric CHECK (preco_kwh IS NULL OR preco_kwh >= 0),
  ADD COLUMN IF NOT EXISTS energia_hora_manual  numeric CHECK (energia_hora_manual IS NULL OR energia_hora_manual >= 0),
  ADD COLUMN IF NOT EXISTS outros_custos_mes    numeric NOT NULL DEFAULT 0   CHECK (outros_custos_mes >= 0);

COMMENT ON COLUMN public.depreciacao.horas_mes IS
  'Horas PRODUTIVAS estimadas por mês (não as horas em que a máquina fica ligada). Base do custo por hora.';
COMMENT ON COLUMN public.depreciacao.valor_residual IS
  'Valor estimado ao fim da vida útil. Depreciação mensal = (valor - residual) / (vida_util_anos * 12).';

-- ── Consumíveis por equipamento ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipamento_consumiveis (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id        uuid NOT NULL REFERENCES public.depreciacao(id) ON DELETE CASCADE,
  nome                  text NOT NULL,
  unidade               text NOT NULL DEFAULT 'unidade',
  -- total pago pela quantidade_adquirida
  preco_compra          numeric NOT NULL DEFAULT 0 CHECK (preco_compra >= 0),
  quantidade_adquirida  numeric NOT NULL DEFAULT 1 CHECK (quantidade_adquirida > 0),
  -- unidades de consumo (páginas, ml, cortes...) que cada unidade adquirida rende
  rendimento            numeric CHECK (rendimento IS NULL OR rendimento > 0),
  -- como este item entra no custo por hora da máquina:
  --   vida_horas    : peça que dura X horas de uso (agulha, teflon, cabeça...)
  --   periodicidade : trocada a cada N meses
  --   consumo_hora  : consumo estimado por hora x custo por unidade de consumo
  --   manual_hora   : custo por hora informado na mão
  --   por_unidade   : cobrado por consumo no BOM/orçamento -> NÃO entra no custo/hora
  base_calculo          text NOT NULL DEFAULT 'por_unidade'
                        CHECK (base_calculo IN ('vida_horas','periodicidade','consumo_hora','manual_hora','por_unidade')),
  vida_horas            numeric CHECK (vida_horas IS NULL OR vida_horas > 0),
  periodicidade_meses   numeric CHECK (periodicidade_meses IS NULL OR periodicidade_meses > 0),
  consumo_hora          numeric CHECK (consumo_hora IS NULL OR consumo_hora >= 0),
  custo_hora_manual     numeric CHECK (custo_hora_manual IS NULL OR custo_hora_manual >= 0),
  ativo                 boolean NOT NULL DEFAULT true,
  observacoes           text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equip_consumiveis_equip ON public.equipamento_consumiveis(equipamento_id);

-- ── Manutenções e peças por equipamento ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipamento_manutencoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id   uuid NOT NULL REFERENCES public.depreciacao(id) ON DELETE CASCADE,
  tipo             text NOT NULL DEFAULT 'manutencao' CHECK (tipo IN ('manutencao','troca_peca','reparo')),
  descricao        text NOT NULL,
  data             date NOT NULL DEFAULT current_date,
  valor_peca       numeric NOT NULL DEFAULT 0 CHECK (valor_peca >= 0),
  valor_mao_obra   numeric NOT NULL DEFAULT 0 CHECK (valor_mao_obra >= 0),
  custo_adicional  numeric NOT NULL DEFAULT 0 CHECK (custo_adicional >= 0),
  valor_total      numeric GENERATED ALWAYS AS (valor_peca + valor_mao_obra + custo_adicional) STORED,
  -- Regra de distribuição: o valor_total é rateado em N meses a partir da data
  -- (padrão 12) e depois sai do custo por hora. Não gera lançamento no Financeiro.
  meses_rateio     integer NOT NULL DEFAULT 12 CHECK (meses_rateio BETWEEN 1 AND 120),
  observacoes      text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equip_manutencoes_equip ON public.equipamento_manutencoes(equipamento_id, data DESC);

-- ── RLS: mesmo padrão da tabela depreciacao ──────────────────────────────────
ALTER TABLE public.equipamento_consumiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamento_manutencoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equip_consumiveis_all" ON public.equipamento_consumiveis;
CREATE POLICY "equip_consumiveis_all" ON public.equipamento_consumiveis
  FOR ALL TO authenticated
  USING      (has_role(ARRAY['dono','admin','financeiro']))
  WITH CHECK (has_role(ARRAY['dono','admin','financeiro']));

DROP POLICY IF EXISTS "equip_manutencoes_all" ON public.equipamento_manutencoes;
CREATE POLICY "equip_manutencoes_all" ON public.equipamento_manutencoes
  FOR ALL TO authenticated
  USING      (has_role(ARRAY['dono','admin','financeiro']))
  WITH CHECK (has_role(ARRAY['dono','admin','financeiro']));

-- ── Produtos: tempo de cada máquina, ligado ao equipamento pelo ID ───────────
-- [{ "equipamento_id": "<uuid>", "nome": "Plotter...", "horas": 0.1667 }]
-- NULL = produto antigo -> cada máquina de "maquina" usa o tempo_producao do produto.
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS maquinas_tempo jsonb;
