// Previsão de entrega a partir do prazo de cada produto (Produtos → prazo_entrega_dias).
// Regra: cada produto conta uma vez (o mesmo produto repetido não pesa mais);
// com mais de um produto distinto usa a média dos prazos, arredondada pra cima.
// Produtos sem prazo cadastrado ficam de fora; sem nenhum prazo, não há previsão.

export function prazoEstimadoDias(
  itens: { produto_id?: string | null }[],
  prazoPorProduto: Map<string, number | null | undefined>,
): number | null {
  const ids = Array.from(new Set(itens.map(i => i.produto_id).filter((x): x is string => !!x)));
  const prazos = ids.map(id => Number(prazoPorProduto.get(id) ?? 0)).filter(n => n > 0);
  if (prazos.length === 0) return null;
  return Math.ceil(prazos.reduce((a, b) => a + b, 0) / prazos.length);
}

/** Hoje + N dias, em AAAA-MM-DD no fuso local (sem o desvio de UTC do toISOString). */
export function dataEntregaPrevista(dias: number, base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
