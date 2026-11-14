// Forma de pagamento dos pedidos do site, com os mesmos nomes usados no resto do ERP (PIX, Cartão de Crédito...).
export type PagamentoRegistrado = { forma: string; valor: number; parcelas: number | null; origem: 'site' | 'loja' };

export const formaDoMetodoOnline = (metodo: string | null | undefined): string => {
  const m = (metodo ?? '').toLowerCase();
  if (m.includes('credit')) return 'Cartão de Crédito';
  if (m.includes('debit')) return 'Cartão de Débito';
  if (m.includes('pix')) return 'PIX';
  if (m.includes('bol') || m.includes('slip')) return 'Boleto';
  return 'Online (outro)';
};

/** Texto curto para a lista: "PIX", "Cartão de Crédito 3x", "PIX + Dinheiro"... ou null se ainda não há pagamento. */
export const resumoPagamento = (l: PagamentoRegistrado[]): string | null => {
  if (l.length === 0) return null;
  const partes: string[] = [];
  for (const p of l) {
    const t = p.parcelas && p.parcelas > 1 ? `${p.forma} ${p.parcelas}x` : p.forma;
    if (!partes.includes(t)) partes.push(t);
  }
  return partes.join(' + ');
};
