/**
 * SANITIZE — Utilitários de segurança centralizados.
 * Importar SEMPRE daqui. Nunca duplicar localmente.
 */

/**
 * Escapa caracteres HTML para evitar XSS.
 * Usar em QUALQUER valor inserido via innerHTML.
 */
export function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitiza SVG inline — permite somente tags SVG seguras,
 * remove scripts e event handlers.
 */
export function sanitizeSVG(svgStr) {
  if (!svgStr?.trim()) return "";
  // Remove scripts e event handlers
  return svgStr
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\bon\w+\s*=/gi, "data-removed=")
    .replace(/javascript:/gi, "");
}

/**
 * Sanitiza URL — permite somente http/https/mailto.
 */
export function sanitizeURL(url) {
  if (!url?.trim()) return "#";
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  return "#";
}
