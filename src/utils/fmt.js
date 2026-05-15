/**
 * Formatadores monetários e de data usados em todo o ERP.
 * Importar de: src/utils/fmt.js
 */

/** Formata como R$ 1.234,56 */
export function fmtBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style:                 "currency",
    currency:              "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formata com 4 casas decimais — para custos por hora/unidade */
export function fmtBRL4(value) {
  return "R$ " + Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/** Formata data ISO → dd/mm/aaaa */
export function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : ""))
    .toLocaleDateString("pt-BR");
}

/** Formata data e hora ISO → dd/mm/aaaa HH:MM */
export function fmtDataHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

/** Retorna a data de hoje no formato yyyy-mm-dd */
export function hoje() {
  return new Date().toISOString().split("T")[0];
}

/** Escapa HTML para uso em innerHTML */
export function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
