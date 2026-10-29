// src/lib/custoEquipamento.ts
//
// Custo real por hora de UM equipamento, separado por componente.
//
// REGRAS (visíveis na tela, pra você saber de onde vem cada valor):
//
//  1. Depreciação  = (valor de compra − valor residual) ÷ (vida útil em anos × 12), por mês.
//  2. Manutenção   = cada serviço/peça/reparo registrado é RATEADO: valor_total ÷ meses_rateio
//                    por mês, durante `meses_rateio` meses a partir da data. Depois sai do custo.
//                    Assim um reparo caro não pesa num mês só e o mesmo gasto não é somado de novo.
//                    O histórico nunca é "somado outra vez" a cada cálculo.
//  3. Consumíveis  = só entram no custo/hora os que têm base de cálculo por hora/vida/periodicidade.
//                    Os marcados "cobrado por consumo" (tinta, toner no BOM/orçamento) ficam FORA,
//                    pra não cobrar duas vezes.
//  4. Energia      = custo/hora manual, ou potência (kW) × preço do kWh.
//  5. Outros       = custos recorrentes (R$/mês) ÷ horas produtivas.
//  6. Tudo ÷ horas PRODUTIVAS por mês da máquina (não as horas em que fica ligada).
//
//  O overhead geral (aluguel, salários...) NÃO entra aqui: ele continua rateado à parte
//  (custos fixos ÷ horas) em Produtos — assim nada é contado duas vezes.
import type { Equipamento, Consumivel, Manutencao } from '../types/equipamento';

export const HORAS_MES_PADRAO = 160;

export interface Componentes {
  depreciacao: number;
  manutencao: number;
  consumiveis: number;
  energia: number;
  outros: number;
  total: number;
}

export interface ConsumivelCalculado {
  id: string;
  nome: string;
  base: Consumivel['base_calculo'];
  /** Custo por hora que entra no custo da máquina (0 se cobrado por consumo). */
  porHora: number;
  /** Custo de UMA unidade de consumo (R$/unidade de consumo), quando dá pra calcular. */
  custoPorUso: number | null;
  /** Texto curto explicando a conta. */
  regra: string;
  foraDoCustoHora: boolean;
}

export interface ManutencaoCalculada {
  id: string;
  mensal: number;
  /** Meses que ainda faltam de rateio (0 = já terminou). */
  mesesRestantes: number;
  situacao: 'rateando' | 'concluido' | 'futuro';
}

export interface CustoEquipamento {
  horasMes: number;
  mensal: Componentes;
  hora: Componentes;
  consumiveis: ConsumivelCalculado[];
  manutencoes: ManutencaoCalculada[];
  acumulado: {
    manutencao: number;
    pecas: number;
    maoObra: number;
    adicional: number;
    depreciacao: number;
    /** Valor de aquisição + tudo que já foi gasto com manutenção/peças. */
    custoTotal: number;
  };
  ultimaManutencao: string | null;
  depreciacaoMensal: number;
}

const round = (n: number, casas = 4) => Number(n.toFixed(casas));
const num = (v: unknown) => { const n = Number(v); return isFinite(n) ? n : 0; };

function somarMeses(data: Date, meses: number): Date {
  const d = new Date(data.getTime());
  d.setMonth(d.getMonth() + meses);
  return d;
}

function mesesDecorridos(de: Date, ate: Date): number {
  return Math.max(0, (ate.getTime() - de.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
}

export function calcConsumivel(c: Consumivel, horasMes: number): ConsumivelCalculado {
  const qtd = num(c.quantidade_adquirida) > 0 ? num(c.quantidade_adquirida) : 1;
  const custoUnidadeCompra = num(c.preco_compra) / qtd;
  // custo de cada unidade de consumo: preço ÷ (quantidade comprada × rendimento por unidade)
  const rend = num(c.rendimento) > 0 ? num(c.rendimento) : null;
  const custoPorUso = rend ? num(c.preco_compra) / (qtd * rend) : null;

  let porHora = 0;
  let regra = '';
  switch (c.base_calculo) {
    case 'vida_horas': {
      const h = num(c.vida_horas);
      porHora = h > 0 ? custoUnidadeCompra / h : 0;
      regra = h > 0 ? `custo da unidade ÷ ${h} h de vida` : 'informe quantas horas dura';
      break;
    }
    case 'periodicidade': {
      const m = num(c.periodicidade_meses);
      porHora = m > 0 && horasMes > 0 ? (custoUnidadeCompra / m) / horasMes : 0;
      regra = m > 0 ? `custo da unidade ÷ ${m} meses ÷ ${horasMes} h/mês` : 'informe a cada quantos meses troca';
      break;
    }
    case 'consumo_hora': {
      const ch = num(c.consumo_hora);
      porHora = custoPorUso != null ? ch * custoPorUso : 0;
      regra = custoPorUso != null
        ? `${ch} ${c.unidade}/h × ${custoPorUso.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} R$/${c.unidade}`
        : 'informe o rendimento pra calcular o custo por unidade';
      break;
    }
    case 'manual_hora':
      porHora = num(c.custo_hora_manual);
      regra = 'valor por hora informado';
      break;
    case 'por_unidade':
    default:
      porHora = 0;
      regra = 'cobrado por consumo no orçamento/BOM — não entra no custo por hora';
  }
  return {
    id: c.id,
    nome: c.nome,
    base: c.base_calculo,
    porHora: round(porHora),
    custoPorUso: custoPorUso != null ? round(custoPorUso, 6) : null,
    regra,
    foraDoCustoHora: c.base_calculo === 'por_unidade',
  };
}

export function calcularCustoEquipamento(
  eq: Equipamento,
  consumiveis: Consumivel[] = [],
  manutencoes: Manutencao[] = [],
  hoje: Date = new Date(),
): CustoEquipamento {
  const horasMes = num(eq.horas_mes) > 0 ? num(eq.horas_mes) : HORAS_MES_PADRAO;

  // 1. Depreciação
  const base = Math.max(0, num(eq.valor) - num(eq.valor_residual));
  const meses = num(eq.vida_util_anos) * 12;
  const depreciacaoMensal = meses > 0 ? base / meses : 0;

  const mesesUso = eq.data_aquisicao ? mesesDecorridos(new Date(eq.data_aquisicao + 'T00:00:00'), hoje) : 0;
  const depreciacaoAcumulada = Math.min(base, depreciacaoMensal * mesesUso);

  // 2. Manutenção rateada
  const manutCalc: ManutencaoCalculada[] = manutencoes.map(m => {
    const rateio = Math.max(1, Math.round(num(m.meses_rateio) || 12));
    const mensal = num(m.valor_total) / rateio;
    const ini = new Date((m.data || '') + 'T00:00:00');
    const fim = somarMeses(ini, rateio);
    if (isNaN(ini.getTime())) return { id: m.id, mensal: 0, mesesRestantes: 0, situacao: 'concluido' as const };
    if (hoje < ini)  return { id: m.id, mensal, mesesRestantes: rateio, situacao: 'futuro' as const };
    if (hoje >= fim) return { id: m.id, mensal, mesesRestantes: 0, situacao: 'concluido' as const };
    return {
      id: m.id, mensal,
      mesesRestantes: Math.max(1, Math.ceil(mesesDecorridos(hoje, fim))),
      situacao: 'rateando' as const,
    };
  });
  const manutencaoMensal = manutCalc.filter(m => m.situacao === 'rateando').reduce((s, m) => s + m.mensal, 0);

  // 3. Consumíveis
  const consCalc = consumiveis.filter(c => c.ativo !== false).map(c => calcConsumivel(c, horasMes));
  const consumiveisHora = consCalc.reduce((s, c) => s + c.porHora, 0);

  // 4. Energia
  const energiaHoraManual = eq.energia_hora_manual != null ? num(eq.energia_hora_manual) : null;
  const energiaHora = energiaHoraManual != null && energiaHoraManual > 0
    ? energiaHoraManual
    : num(eq.potencia_kw) * num(eq.preco_kwh);

  // 5. Outros
  const outrosMensal = num(eq.outros_custos_mes);

  const mensal: Componentes = {
    depreciacao: depreciacaoMensal,
    manutencao:  manutencaoMensal,
    consumiveis: consumiveisHora * horasMes,
    energia:     energiaHora * horasMes,
    outros:      outrosMensal,
    total: 0,
  };
  mensal.total = mensal.depreciacao + mensal.manutencao + mensal.consumiveis + mensal.energia + mensal.outros;

  const hora: Componentes = {
    depreciacao: depreciacaoMensal / horasMes,
    manutencao:  manutencaoMensal / horasMes,
    consumiveis: consumiveisHora,
    energia:     energiaHora,
    outros:      outrosMensal / horasMes,
    total: 0,
  };
  hora.total = hora.depreciacao + hora.manutencao + hora.consumiveis + hora.energia + hora.outros;

  const acumulado = manutencoes.reduce((a, m) => ({
    ...a,
    manutencao: a.manutencao + num(m.valor_total),
    pecas:      a.pecas + num(m.valor_peca),
    maoObra:    a.maoObra + num(m.valor_mao_obra),
    adicional:  a.adicional + num(m.custo_adicional),
  }), { manutencao: 0, pecas: 0, maoObra: 0, adicional: 0, depreciacao: depreciacaoAcumulada, custoTotal: 0 });
  acumulado.custoTotal = num(eq.valor) + acumulado.manutencao;

  const ultimaManutencao = manutencoes.length > 0
    ? manutencoes.map(m => m.data).sort().slice(-1)[0]
    : null;

  return {
    horasMes,
    mensal, hora,
    consumiveis: consCalc,
    manutencoes: manutCalc,
    acumulado,
    ultimaManutencao,
    depreciacaoMensal,
  };
}
