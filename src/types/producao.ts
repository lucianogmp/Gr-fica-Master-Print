export type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export type Etapa =
  | 'fila'
  | 'arte'
  | 'impressao'
  | 'acabamento'
  | 'pronto'
  | 'entregue';

export interface OrdemProducao {
  id: string;
  venda_id?: string | null;
  titulo: string;
  descricao?: string | null;
  etapa: Etapa | string;
  prioridade: Prioridade | string;
  responsavel?: string | null;
  data_entrega?: string | null;
  entregue_em?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const ETAPAS: { key: Etapa; label: string; cor: string; bg: string }[] = [
  { key: 'fila',       label: 'Na Fila',    cor: '#94a3b8', bg: '#1e293b' },
  { key: 'arte',       label: 'Arte',       cor: '#a78bfa', bg: '#1e1b4b' },
  { key: 'impressao',  label: 'Impressão',  cor: '#60a5fa', bg: '#1e3a5f' },
  { key: 'acabamento', label: 'Acabamento', cor: '#fb923c', bg: '#431407' },
  { key: 'pronto',     label: 'Pronto',     cor: '#34d399', bg: '#022c22' },
  { key: 'entregue',   label: 'Entregue',   cor: '#86efac', bg: '#14532d' },
];

// `cor` continua em hex fixo porque também monta o fundo translúcido do
// selo (`cor + '20'`) — concatenar um alfa num var() não funciona. Já
// `corTexto` usa a variável de tema (ver index.css) só pro texto do selo,
// que senão fica claro/pastel demais pra ler no tema claro.
export const PRIORIDADES: { key: Prioridade; label: string; cor: string; corTexto: string }[] = [
  { key: 'baixa',   label: 'Baixa',   cor: '#64748b', corTexto: 'var(--chart-slate)' },
  { key: 'normal',  label: 'Normal',  cor: '#3b82f6', corTexto: 'var(--chart-blue)' },
  { key: 'alta',    label: 'Alta',    cor: '#f59e0b', corTexto: 'var(--chart-amber)' },
  { key: 'urgente', label: 'Urgente', cor: '#ef4444', corTexto: 'var(--chart-red)' },
];
