/**
 * UI COMPONENTS — Biblioteca de componentes e utilitários de interface.
 * Usa sanitize.js centralizado — sem duplicação de esc().
 */

export { esc } from "../../utils/sanitize.js";
import { esc } from "../../utils/sanitize.js";
import { fmtBRL, fmtData } from "../../utils/fmt.js";

// ── Re-exporta formatadores para não quebrar imports existentes ───────────────
export { fmtBRL, fmtData };

// ══════════════════════════════════════════════════════════════════════════════
// PAGE HEADER
// ══════════════════════════════════════════════════════════════════════════════
export function PageHeader({ title = "", subtitle = "", actions = "" } = {}) {
  return `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">${esc(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${esc(subtitle)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-header-actions">${actions}</div>` : ""}
    </div>
    <style>
      .page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px;flex-wrap:wrap}
      .page-title{font-size:20px;font-weight:800;color:var(--text);margin:0}
      .page-subtitle{font-size:13px;color:var(--muted);margin-top:3px}
      .page-header-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    </style>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// KPI GRID
// ══════════════════════════════════════════════════════════════════════════════
export function KpiGrid(kpis = []) {
  return `
    <div class="kpi-grid">
      ${kpis.map(k => `
        <div class="kpi-card" style="${k.color ? `--kpi-accent:${k.color}` : ""}">
          ${k.icon ? `<div class="kpi-icon" style="${k.color ? `color:${k.color}` : ""}">${k.icon}</div>` : ""}
          <div class="kpi-value" style="${k.color ? `color:${k.color}` : ""}">${k.value ?? "—"}</div>
          <div class="kpi-label">${esc(k.label)}</div>
          ${k.sub ? `<div class="kpi-sub">${esc(k.sub)}</div>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════════════════════
export function Tabs({ tabs = [], active = "" } = {}) {
  return `
    <div class="tabs">
      ${tabs.map(t => `
        <button class="tab-btn ${active === t.key ? "active" : ""}" data-tab="${esc(t.key)}">
          ${t.icon ? `<i class="fi ${t.icon}"></i> ` : ""}${esc(t.label)}
        </button>
      `).join("")}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// DATA TABLE — com suporte a ordenação e paginação
// ══════════════════════════════════════════════════════════════════════════════
export function DataTable({
  columns = [],
  rows = [],
  emptyMessage = "Nenhum registro encontrado.",
  sortKey = "",
  sortDir = "asc",
  onSort = null,
  striped = false,
} = {}) {
  if (!rows.length) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fi fi-rr-inbox"></i></div>
        <div class="empty-state-title">${esc(emptyMessage)}</div>
      </div>`;
  }

  const thead = columns.map(c => {
    const isSorted  = sortKey === c.key;
    const sortClass = c.key && onSort ? "sortable" : "";
    const dirClass  = isSorted ? `sort-${sortDir}` : "";
    const style     = c.style ? `style="${c.style}"` : "";
    return `
      <th class="${sortClass} ${dirClass}" ${style}
          ${c.key && onSort ? `data-sort="${esc(c.key)}"` : ""}>
        ${esc(c.label)}
        ${c.key && onSort ? `<i class="fi fi-rr-sort sort-icon"></i>` : ""}
      </th>`;
  }).join("");

  // rows pode ser array de HTML strings OU de objetos
  const tbody = rows.map((row, idx) => {
    if (typeof row === "string") return row;
    const cells = columns.map(c => {
      const val = c.render ? c.render(row) : esc(row[c.key]);
      const style = c.style ? `style="${c.style}"` : "";
      return `<td ${style}>${val}</td>`;
    }).join("");
    return `<tr class="${striped && idx % 2 ? "row-alt" : ""}">${cells}</tr>`;
  }).join("");

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
    <style>
      .row-alt td{background:rgba(255,255,255,0.02)}
    </style>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// BOTÕES
// ══════════════════════════════════════════════════════════════════════════════
export const Btn = {
  primary: (label, id = "", extraClass = "") =>
    `<button class="btn-primary ${extraClass}" ${id ? `id="${id}"` : ""}>${label}</button>`,
  secondary: (label, id = "", extraClass = "") =>
    `<button class="btn-secondary ${extraClass}" ${id ? `id="${id}"` : ""}>${label}</button>`,
  danger: (label, id = "", extraClass = "") =>
    `<button class="btn-danger ${extraClass}" ${id ? `id="${id}"` : ""}>${label}</button>`,
  ghost: (label, id = "", extraClass = "") =>
    `<button class="btn btn-ghost ${extraClass}" ${id ? `id="${id}"` : ""}>${label}</button>`,
  icon: (content, id = "", danger = false) =>
    `<button class="btn-icon${danger ? " danger" : ""}" ${id ? `id="${id}"` : ""}>${content}</button>`,
};

// ══════════════════════════════════════════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════════════════════════════════════════
export function openModal({ title = "", body = "", actions = "", maxWidth = "480px", onClose } = {}) {
  document.getElementById("__modal-overlay__")?.remove();

  const overlay = document.createElement("div");
  overlay.id        = "__modal-overlay__";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-panel" style="max-width:${maxWidth}" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close btn-icon" id="__modal-close-x__" aria-label="Fechar">
          <i class="fi fi-rr-cross-small"></i>
        </button>
      </div>
      <div class="modal-body">${body}</div>
      ${actions ? `<div class="modal-footer">${actions}</div>` : ""}
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  const close = () => {
    overlay.classList.remove("open");
    setTimeout(() => { overlay.remove(); onClose?.(); }, 200);
  };

  document.getElementById("__modal-close-x__")?.addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  const onEsc = e => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); } };
  document.addEventListener("keydown", onEsc);

  return { close };
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════════
export function showToast(msg, tipo = "info") {
  let container = document.getElementById("__toast-container__");
  if (!container) {
    container = document.createElement("div");
    container.id        = "__toast-container__";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const icons = { ok: "✅", erro: "❌", warn: "⚠️", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<span>${icons[tipo] || "ℹ️"}</span><span>${esc(msg)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ══════════════════════════════════════════════════════════════════════════════
// SEARCH BAR
// ══════════════════════════════════════════════════════════════════════════════
export function SearchBar({ id = "search-bar", placeholder = "Buscar...", value = "" } = {}) {
  return `
    <div class="search-bar">
      <i class="fi fi-rr-search search-icon"></i>
      <input type="text" id="${id}" class="search-input"
        placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off" />
    </div>
    <style>
      .search-bar{position:relative;display:flex;align-items:center}
      .search-icon{position:absolute;left:10px;font-size:13px;color:var(--muted);pointer-events:none}
      .search-input{padding-left:32px !important}
    </style>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ══════════════════════════════════════════════════════════════════════════════
export function StatusBadge(label, color = "var(--muted)") {
  return `<span class="status-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">
    ${esc(label)}
  </span>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════════════════════════════════════
export function EmptyState({ title = "Nenhum registro encontrado.", subtitle = "", icon = "fi-rr-inbox", action = "" } = {}) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><i class="fi ${icon}"></i></div>
      <div class="empty-state-title">${esc(title)}</div>
      ${subtitle ? `<div class="empty-state-subtitle">${esc(subtitle)}</div>` : ""}
      ${action ? `<div style="margin-top:12px">${action}</div>` : ""}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM CSS (injeta estilos base extras)
// ══════════════════════════════════════════════════════════════════════════════
export function injectDesignSystemCSS() {
  if (document.getElementById("__design-system__")) return;
  const s = document.createElement("style");
  s.id = "__design-system__";
  s.textContent = `
    .form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
    .form-field{display:flex;flex-direction:column;gap:4px}
    .form-field label{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
    .form-field.full{grid-column:1/-1}

    .ds-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:14px}
    .ds-card-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:14px;display:flex;align-items:center;gap:6px}

    .clickable{cursor:pointer}
    .clickable:hover td{background:var(--primary-bg) !important}

    .data-table th.sortable:hover{color:var(--primary);cursor:pointer}
    .data-table th.sort-asc .sort-icon::before{content:"↑"}
    .data-table th.sort-desc .sort-icon::before{content:"↓"}
  `;
  document.head.appendChild(s);
}
