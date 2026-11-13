// Regras únicas dos totais "do mês" do financeiro (Lançamentos e Resumo Financeiro usam as mesmas),
// pra os números baterem entre as telas e entre si.
//
// - Receita/despesa REALIZADA do mês = lançamentos pagos cuja data de pagamento cai no mês
//   + movimentos MANUAIS do Fluxo de Caixa do mês.
// - Movimento de caixa que veio de pagamento de venda, de lançamento pago ou de transferência
//   NÃO soma de novo: o mesmo dinheiro já está nos lançamentos (senão contava em dobro).
// - Pendente do mês = lançamentos ainda não pagos/cancelados com vencimento no mês.

export interface LancMin { categoria?: string | null; descricao?: string | null; tipo: string; status: string; valor: number | string; data_vencimento?: string | null; data_pagamento?: string | null; created_at?: string | null }
export interface MovMin { descricao?: string | null; tipo: string; valor: number | string; data?: string | null; origem?: string | null }

/** Ajuste de saldo = correção para a conta bater com o dinheiro real ("Diferença de conta/caixa").
 *  Mexe no saldo das contas, mas NÃO é receita nem despesa do negócio — fica fora dos resultados. */
export function ehAjusteSaldo(x: { categoria?: string | null; descricao?: string | null }) {
  return (x.categoria ?? '') === 'Ajuste de Saldo' || /^\s*diferen[cç]a\b/i.test(x.descricao ?? '');
}

/** Retirada de sócios / divisão de lucro: é o dono tirando o lucro, não custo do negócio.
 *  Sai do caixa/conta (mexe no saldo), mas fica fora de Despesas, Resultado e margem. */
export function ehRetirada(x: { categoria?: string | null; descricao?: string | null }) {
  return (x.categoria ?? '') === 'Retirada de Sócios'
    || /^\s*(divis[aã]o de lucros?|retiradas?( de)? s[oó]cios?|distribui[cç][aã]o de lucros?)\b/i.test(x.descricao ?? '');
}

/** Fora do resultado do negócio (ajuste de saldo ou retirada de sócios). */
export const foraDoResultado = (x: { categoria?: string | null; descricao?: string | null }) => ehAjusteSaldo(x) || ehRetirada(x);

export function movimentoManual(m: MovMin) {
  const o = String(m.origem ?? '');
  return !(o === 'transferencia' || o === 'lancamento' || o.startsWith('pagamento_venda')) && !foraDoResultado(m);
}

const soma = (l: { valor: number | string }[]) => l.reduce((s, x) => s + Number(x.valor ?? 0), 0);

export function totaisDoMes(lancsTodos: LancMin[], movs: MovMin[], mes: string) {
  const ajustes = lancsTodos.filter(ehAjusteSaldo);
  const retiradasL = lancsTodos.filter(ehRetirada);
  const lancs = lancsTodos.filter(l => !foraDoResultado(l));
  const pagoNoMes = (l: LancMin) => l.status === 'pago' && (l.data_pagamento ?? l.data_vencimento ?? '').startsWith(mes);
  const manuaisMes = movs.filter(m => movimentoManual(m) && (m.data ?? '').startsWith(mes));
  const receitas = soma(lancs.filter(l => l.tipo === 'receita' && pagoNoMes(l))) + soma(manuaisMes.filter(m => m.tipo === 'entrada'));
  const despesas = soma(lancs.filter(l => l.tipo === 'despesa' && pagoNoMes(l))) + soma(manuaisMes.filter(m => m.tipo === 'saida'));
  const pendente = (tipo: string) => lancs.filter(l =>
    l.tipo === tipo && !['pago', 'cancelado'].includes(l.status) && (l.data_vencimento ?? l.created_at ?? '').startsWith(mes));
  return {
    receitas, despesas, resultado: receitas - despesas,
    retiradas: soma(retiradasL.filter(l => l.tipo === 'despesa' && l.status === 'pago' && (l.data_pagamento ?? l.data_vencimento ?? '').startsWith(mes)))
      + soma(movs.filter(m => m.tipo === 'saida' && ehRetirada(m) && !['transferencia', 'lancamento'].includes(String(m.origem ?? '')) && (m.data ?? '').startsWith(mes))),
    ajustes: soma(ajustes.filter(l => l.tipo === 'receita' && l.status === 'pago' && (l.data_pagamento ?? l.data_vencimento ?? '').startsWith(mes)))
      - soma(ajustes.filter(l => l.tipo === 'despesa' && l.status === 'pago' && (l.data_pagamento ?? l.data_vencimento ?? '').startsWith(mes))),
    aReceber: soma(pendente('receita')), aPagar: soma(pendente('despesa')),
  };
}
