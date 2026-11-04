// Regras únicas dos totais "do mês" do financeiro (Lançamentos e Resumo Financeiro usam as mesmas),
// pra os números baterem entre as telas e entre si.
//
// - Receita/despesa REALIZADA do mês = lançamentos pagos cuja data de pagamento cai no mês
//   + movimentos MANUAIS do Fluxo de Caixa do mês.
// - Movimento de caixa que veio de pagamento de venda, de lançamento pago ou de transferência
//   NÃO soma de novo: o mesmo dinheiro já está nos lançamentos (senão contava em dobro).
// - Pendente do mês = lançamentos ainda não pagos/cancelados com vencimento no mês.

export interface LancMin { tipo: string; status: string; valor: number | string; data_vencimento?: string | null; data_pagamento?: string | null; created_at?: string | null }
export interface MovMin { tipo: string; valor: number | string; data?: string | null; origem?: string | null }

export function movimentoManual(m: MovMin) {
  const o = String(m.origem ?? '');
  return !(o === 'transferencia' || o === 'lancamento' || o.startsWith('pagamento_venda'));
}

const soma = (l: { valor: number | string }[]) => l.reduce((s, x) => s + Number(x.valor ?? 0), 0);

export function totaisDoMes(lancs: LancMin[], movs: MovMin[], mes: string) {
  const pagoNoMes = (l: LancMin) => l.status === 'pago' && (l.data_pagamento ?? l.data_vencimento ?? '').startsWith(mes);
  const manuaisMes = movs.filter(m => movimentoManual(m) && (m.data ?? '').startsWith(mes));
  const receitas = soma(lancs.filter(l => l.tipo === 'receita' && pagoNoMes(l))) + soma(manuaisMes.filter(m => m.tipo === 'entrada'));
  const despesas = soma(lancs.filter(l => l.tipo === 'despesa' && pagoNoMes(l))) + soma(manuaisMes.filter(m => m.tipo === 'saida'));
  const pendente = (tipo: string) => lancs.filter(l =>
    l.tipo === tipo && !['pago', 'cancelado'].includes(l.status) && (l.data_vencimento ?? l.created_at ?? '').startsWith(mes));
  return {
    receitas, despesas, resultado: receitas - despesas,
    aReceber: soma(pendente('receita')), aPagar: soma(pendente('despesa')),
  };
}
