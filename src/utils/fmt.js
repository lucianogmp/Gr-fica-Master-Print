// ─── Formatação monetária brasileira ─────────────────────────────────────────
// Use sempre estas funções para exibir valores em R$

/**
 * Formata número como moeda brasileira.
 * Ex: fmtBRL(1000)    → "R$ 1.000,00"
 *     fmtBRL(43.9)    → "R$ 43,90"
 *     fmtBRL(2)       → "R$ 2,00"
 */
export function fmtBRL(valor) {
  return "R$ " + Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata com casas decimais variáveis (para preços unitários/hora com 4 casas).
 * Ex: fmtBRL4(0.0025) → "R$ 0,0025"
 */
export function fmtBRL4(valor) {
  return "R$ " + Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/**
 * Formata número compacto (K / M) com moeda.
 * Ex: fmtBRLK(1500) → "R$ 1,5K"
 *     fmtBRLK(50)   → "R$ 50,00"
 */
export function fmtBRLK(valor) {
  const abs = Math.abs(valor);
  const sign = valor < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (abs >= 1000) return `${sign}R$ ${(abs / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
  return fmtBRL(valor);
}

/**
 * Formata quantidade com 3 casas decimais no padrão BR.
 * Ex: fmtQtd(1.5) → "1,500"
 */
export function fmtQtd(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
