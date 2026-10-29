// src/types/equipamento.ts
// Equipamento = linha da tabela `depreciacao` (cadastro original das máquinas),
// ampliada com horas produtivas, valor residual, energia etc.
import type { Depreciacao } from './financeiro';

export type Equipamento = Depreciacao;

/** Como um consumível entra no custo por hora da máquina. */
export type BaseCalculoConsumivel =
  | 'vida_horas'     // peça que dura X horas de uso (agulha, teflon, cabeça de impressão)
  | 'periodicidade'  // trocada a cada N meses
  | 'consumo_hora'   // consumo estimado por hora × custo da unidade de consumo
  | 'manual_hora'    // custo por hora informado na mão
  | 'por_unidade';   // cobrado por consumo (BOM/orçamento) — NÃO entra no custo por hora

export const BASE_CALCULO_LABEL: Record<BaseCalculoConsumivel, string> = {
  vida_horas:    'Dura X horas de uso',
  periodicidade: 'Troca a cada N meses',
  consumo_hora:  'Consumo por hora',
  manual_hora:   'Custo por hora (manual)',
  por_unidade:   'Cobrado por consumo (fora do custo/hora)',
};

export const UNIDADES_CONSUMO = [
  'unidade', 'litro', 'ml', 'kg', 'grama', 'metro', 'm²', 'folha', 'página', 'corte', 'frasco', 'rolo',
];

export interface Consumivel {
  id: string;
  equipamento_id: string;
  nome: string;
  unidade: string;
  preco_compra: number;
  quantidade_adquirida: number;
  rendimento?: number | null;
  base_calculo: BaseCalculoConsumivel;
  vida_horas?: number | null;
  periodicidade_meses?: number | null;
  consumo_hora?: number | null;
  custo_hora_manual?: number | null;
  ativo: boolean;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type TipoManutencao = 'manutencao' | 'troca_peca' | 'reparo';

export const TIPO_MANUTENCAO_LABEL: Record<TipoManutencao, string> = {
  manutencao: 'Manutenção',
  troca_peca: 'Troca de peça',
  reparo:     'Reparo',
};

export interface Manutencao {
  id: string;
  equipamento_id: string;
  tipo: TipoManutencao;
  descricao: string;
  data: string; // YYYY-MM-DD
  valor_peca: number;
  valor_mao_obra: number;
  custo_adicional: number;
  /** Coluna gerada no banco: peça + mão de obra + adicional. */
  valor_total: number;
  /** Em quantos meses o valor é rateado no custo por hora. */
  meses_rateio: number;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Tempo de uso de cada máquina dentro de um produto (produtos.maquinas_tempo). */
export interface MaquinaTempo {
  equipamento_id: string;
  nome: string;
  horas: number;
}
