/**
 * Exibe valores em Real com separadores brasileiros (ex.: R$ 1.234,56).
 * @param {number|string} value
 * @param {number} [fractionDigits=2]
 */
export function fmtBRL(value, fractionDigits = 2) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe);
}
