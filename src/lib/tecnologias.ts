// src/lib/tecnologias.ts
// Tecnologia da máquina: define (1) quais consumíveis costumam existir, pra sugerir ao cadastrar,
// e (2) em que unidade o custo final é medido (página, m² ou hora).
//
// Os valores de rendimento NÃO vêm preenchidos: variam por modelo e por fornecedor. Quem preenche é você,
// com o que comprou. A produção mensal padrão abaixo é só uma estimativa pra já mostrar um custo por
// página/m² antes de você informar o seu volume real.
import type { BaseCalculoConsumivel } from '../types/equipamento';

export type UnidadeProducao = 'página' | 'm²' | 'hora';

export interface ConsumivelSugerido {
  nome: string;
  unidade: string;
  base_calculo: BaseCalculoConsumivel;
  dica?: string;
}

export interface Tecnologia {
  key: string;
  label: string;
  exemplos: string;
  unidadeProducao: UnidadeProducao;
  /** Produção mensal estimada quando você ainda não informou a sua. */
  producaoPadrao: number | null;
  sugeridos: ConsumivelSugerido[];
}

const porPagina = (nome: string, dica?: string): ConsumivelSugerido =>
  ({ nome, unidade: 'página', base_calculo: 'por_unidade', dica });

export const TECNOLOGIAS: Tecnologia[] = [
  {
    key: 'laser', label: 'Laser / toner', exemplos: 'Konica Minolta, Xerox',
    unidadeProducao: 'página', producaoPadrao: 10000,
    sugeridos: [
      porPagina('Toner preto', 'Rendimento = páginas que o toner imprime'),
      porPagina('Toner ciano'), porPagina('Toner magenta'), porPagina('Toner amarelo'),
      porPagina('Cilindro / Drum'), porPagina('Unidade de fusão'),
      porPagina('Correia de transferência'), porPagina('Lâmina de limpeza / resíduo'),
    ],
  },
  {
    key: 'jato_tinta', label: 'Jato de tinta', exemplos: 'impressoras de mesa',
    unidadeProducao: 'página', producaoPadrao: 2000,
    sugeridos: [
      porPagina('Tinta (conjunto de cores)', 'Rendimento = páginas que o refil/cartucho imprime'),
      porPagina('Cabeça de impressão'), porPagina('Caixa de manutenção'),
    ],
  },
  {
    key: 'plotter_impressao', label: 'Plotter de impressão (ecossolvente / UV)', exemplos: 'Roland, Mimaki, Holland',
    unidadeProducao: 'm²', producaoPadrao: 200,
    sugeridos: [
      { nome: 'Tinta', unidade: 'm²', base_calculo: 'por_unidade', dica: 'Rendimento = m² que um litro (ou cartucho) imprime' },
      { nome: 'Cabeça de impressão', unidade: 'unidade', base_calculo: 'vida_horas', dica: 'Informe quantas horas ela dura' },
      { nome: 'Damper', unidade: 'unidade', base_calculo: 'periodicidade' },
      { nome: 'Líquido de limpeza', unidade: 'litro', base_calculo: 'periodicidade' },
      { nome: 'Lâmpada UV', unidade: 'unidade', base_calculo: 'vida_horas', dica: 'Só se for UV' },
    ],
  },
  {
    key: 'plotter_recorte', label: 'Plotter de recorte', exemplos: 'sem tinta',
    unidadeProducao: 'hora', producaoPadrao: null,
    sugeridos: [
      { nome: 'Lâmina', unidade: 'unidade', base_calculo: 'vida_horas' },
      { nome: 'Agulha / ponta', unidade: 'unidade', base_calculo: 'vida_horas' },
      { nome: 'Teflon / tapete de corte', unidade: 'unidade', base_calculo: 'periodicidade' },
    ],
  },
  { key: 'acabamento', label: 'Acabamento', exemplos: 'laminadora, guilhotina, refiladora...', unidadeProducao: 'hora', producaoPadrao: null, sugeridos: [] },
  { key: 'outro', label: 'Outro', exemplos: '', unidadeProducao: 'hora', producaoPadrao: null, sugeridos: [] },
];

export const tecnologiaDe = (key?: string | null): Tecnologia | undefined =>
  TECNOLOGIAS.find(t => t.key === key);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTO POR PÁGINA / m²  (só relatório — NÃO alimenta Produtos nem Orçamento)
//
//   custo por página = (custo mensal da máquina ÷ páginas/mês)  +  consumíveis cobrados por página
//
//  • custo mensal da máquina = depreciação + manutenção + energia + outros + consumíveis por hora
//    (é o mesmo total do custo por hora; manutenção nova ou preço novo mudam o resultado na hora).
//  • consumíveis por página = os marcados "cobrado por consumo" cuja unidade é a da máquina
//    (página ou m²): preço ÷ (qtd comprada × rendimento).
// ─────────────────────────────────────────────────────────────────────────────
export interface CustoPorUnidade {
  unidade: UnidadeProducao;
  producaoMes: number;
  /** true = você ainda não informou a produção; usando a estimativa da tecnologia. */
  estimada: boolean;
  maquina: number;
  consumiveis: { nome: string; custo: number }[];
  consumiveisTotal: number;
  /** Itens sem rendimento/preço, que ainda não entram na conta. */
  incompletos: string[];
  /** Só preto e branco: o mesmo total sem os toners coloridos (ciano, magenta, amarelo). null se não há. */
  totalPB: number | null;
  /** Itens "por consumo" em outra unidade (ex: ml), ignorados aqui. */
  outraUnidade: string[];
  total: number;
}

export function calcCustoPorUnidade(
  eq: { tecnologia?: string | null; producao_mes?: number | null },
  mensalTotal: number,
  consumiveis: { nome: string; unidade: string; custoPorUso: number | null; foraDoCustoHora: boolean }[],
): CustoPorUnidade | null {
  const tec = tecnologiaDe(eq.tecnologia);
  if (!tec || tec.unidadeProducao === 'hora') return null;
  const informada = Number(eq.producao_mes) > 0;
  const producaoMes = informada ? Number(eq.producao_mes) : (tec.producaoPadrao ?? 0);
  const maquina = producaoMes > 0 ? mensalTotal / producaoMes : 0;

  const lista: CustoPorUnidade['consumiveis'] = [];
  const incompletos: string[] = [];
  const outraUnidade: string[] = [];
  for (const c of consumiveis.filter(x => x.foraDoCustoHora)) {
    if (c.unidade !== tec.unidadeProducao) { outraUnidade.push(c.nome); continue; }
    if (c.custoPorUso == null || c.custoPorUso <= 0) { incompletos.push(c.nome); continue; }
    lista.push({ nome: c.nome, custo: c.custoPorUso });
  }
  const consumiveisTotal = lista.reduce((s, c) => s + c.custo, 0);
  const colorido = (n: string) => /ciano|magenta|amarelo|cyan|yellow/i.test(n);
  const temCor = lista.some(c => colorido(c.nome));
  const totalPB = temCor ? maquina + lista.filter(c => !colorido(c.nome)).reduce((s, c) => s + c.custo, 0) : null;
  return {
    unidade: tec.unidadeProducao, producaoMes, estimada: !informada,
    maquina, consumiveis: lista, consumiveisTotal, incompletos, totalPB, outraUnidade,
    total: maquina + consumiveisTotal,
  };
}
