export type StatusEstoque = 'ok' | 'baixo' | 'zerado' | 'sem_controle';

export interface MateriaPrima {
  id: string;
  nome: string;
  categoria?: string | null;
  unidade: string;
  saldo: number;
  estoque_minimo: number;
  custo_unitario: number;
  /** false = item comprado sob medida/encomenda, sem saldo rastreado — não
   * entra em alertas de estoque baixo/zerado nem exige quantidade. Padrão
   * true pra manter o comportamento de sempre em itens já cadastrados. */
  controla_estoque: boolean;
  empresa_id?: string;
  created_at?: string;
}

export interface MovimentoEstoque {
  id: string;
  materia_prima_id: string;        // coluna real no banco
  tipo: 'entrada' | 'saida';
  quantidade: number;
  motivo?: string | null;
  origem?: string | null;
  referencia_id?: string | null;
  created_at: string;
  materias_primas?: {              // join
    nome: string;
    unidade: string;
  };
}

export function statusEstoque(mp: MateriaPrima): { key: StatusEstoque; label: string; cor: string } {
  if (mp.controla_estoque === false) {
    return { key: 'sem_controle', label: 'Sem controle', cor: '#6b7280' };
  }
  const saldo = Number(mp.saldo);
  const min   = Number(mp.estoque_minimo || 0);
  if (saldo <= 0)              return { key: 'zerado', label: 'Zerado', cor: '#ef4444' };
  if (min > 0 && saldo <= min) return { key: 'baixo',  label: 'Baixo',  cor: '#f59e0b' };
  return                               { key: 'ok',     label: 'OK',     cor: '#10b981' };
}
