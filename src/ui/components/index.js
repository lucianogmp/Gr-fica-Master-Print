/**
 * UI COMPONENTS — Biblioteca de componentes e utilitários de interface.
 * Exporta helpers HTML, formatadores, modal e design system CSS.
 */

// ══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ══════════════════════════════════════════════════════════════════════════════

/** Escapa caracteres HTML para evitar XSS */
export function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Formata número para moeda BRL */
export function fmtBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Formata data ISO para DD/MM/AAAA */
export function fmtData(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES HTML (retornam strings HTML)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Cabeçalho de página padrão
 * @param {{ title: string, subtitle?: string, actions?: string }} opts
 */
export function PageHeader({ title, subtitle = "", actions = "" } = {}) {
  return `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">${esc(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${esc(subtitle)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-header-actions">${actions}</div>` : ""}
    </div>
  `;
}

/**
 * Grid de KPIs
 * @param {Array<{ label: string, value: string|number, icon?: string, color?: string }>} kpis
 */
export function KpiGrid(kpis = []) {
  return `
    <div class="kpi-grid">
      ${kpis.map(k => `
        <div class="kpi-card">
          ${k.icon ? `<div class="kpi-icon" style="${k.color ? `color:${k.color}` : ""}">${k.icon}</div>` : ""}
          <div class="kpi-value" style="${k.color ? `color:${k.color}` : ""}">${k.value ?? "—"}</div>
          <div class="kpi-label">${esc(k.label)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

/**
 * Abas de navegação
 * @param {{ tabs: Array<{ key: string, label: string }>, active: string }} opts
 */
export function Tabs({ tabs = [], active = "" } = {}) {
  return `
    <div class="tabs">
      ${tabs.map(t => `
        <button class="tab-btn ${active === t.key ? "active" : ""}" data-tab="${esc(t.key)}">
          ${esc(t.label)}
        </button>
      `).join("")}
    </div>
  `;
}

/**
 * Tabela de dados
 * @param {{ columns: Array<{ key: string, label: string, render?: fn }>, rows: Array, emptyMsg?: string }} opts
 */
export function DataTable({ columns = [], rows = [], emptyMsg = "Nenhum registro encontrado." } = {}) {
  if (!rows.length) {
    return `<div class="empty-state"><div class="empty-state-title">${esc(emptyMsg)}</div></div>`;
  }
  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${columns.map(c => `<td>${c.render ? c.render(row) : esc(row[c.key])}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Helpers de botões
 */
export const Btn = {
  primary: (label, id = "", extraClass = "") =>
    `<button class="btn btn-primary ${extraClass}" ${id ? `id="${id}"` : ""}>${label}</button>`,

  secondary: (label, id = "", extraClass = "") =>
    `<button class="btn btn-secondary ${extraClass}" ${id ? `id="${id}"` : ""}>${label}</button>`,

  danger: (label, id = "", extraClass = "") =>
    `<button class="btn btn-danger ${extraClass}" ${id ? `id="${id}"` : ""}>${label}</button>`,

  ghost: (label, id = "", extraClass = "") =>
    `<button class="btn btn-ghost ${extraClass}" ${id ? `id="${id}"` : ""}>${label}</button>`,
};

// ══════════════════════════════════════════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Abre um modal global
 * @param {{ title: string, body: string, actions?: string, onClose?: fn }} opts
 * @returns {{ close: fn }}
 */
export function openModal({ title = "", body = "", actions = "", onClose } = {}) {
  // Remove modal anterior se existir
  document.getElementById("__modal-overlay__")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "__modal-overlay__";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 class="modal-title">${esc(title)}</h2>
        <button class="modal-close btn-icon" id="__modal-close-x__" aria-label="Fechar">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${actions ? `<div class="modal-footer">${actions}</div>` : ""}
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  const close = () => {
    overlay.classList.remove("open");
    setTimeout(() => { overlay.remove(); onClose?.(); }, 200);
  };

  document.getElementById("__modal-close-x__")?.addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function handler(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", handler); }
  });

  return { close };
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Exibe uma notificação toast
 * @param {string} msg
 * @param {"ok"|"erro"|"warn"|"info"} tipo
 */
export function showToast(msg, tipo = "info") {
  let container = document.getElementById("__toast-container__");
  if (!container) {
    container = document.createElement("div");
    container.id = "__toast-container__";
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
// DESIGN SYSTEM CSS
// ══════════════════════════════════════════════════════════════════════════════

export function injectDesignSystemCSS() {
  if (document.getElementById("__design-system__")) return;
  const style = document.createElement("style");
  style.id = "__design-system__";
  style.textContent = `
    /* ── Reset & Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --bg: #0f0f13;
      --panel: #1a1a24;
      --panel2: #22222f;
      --border: #2e2e3e;
      --text: #e8e8f0;
      --muted: #8888a0;
      --error: #f87171;
      --error-bg: #2a1212;
      --error-border: #7f1d1d;
      --success: #4ade80;
      --warn: #facc15;
      --radius: 8px;
      --radius-lg: 12px;
      --shadow: 0 4px 24px rgba(0,0,0,.4);
    }
    body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5; }
    a { color: var(--primary); text-decoration: none; }
    input, select, textarea {
      background: var(--panel2); border: 1px solid var(--border); border-radius: var(--radius);
      color: var(--text); font-size: 14px; padding: 8px 10px; width: 100%; outline: none;
      transition: border-color .15s;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--primary); }
    label { color: var(--muted); font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .04em; }

    /* ── Buttons ── */
    .btn { border: none; border-radius: var(--radius); cursor: pointer; font-size: 13px; font-weight: 600; padding: 8px 16px; transition: all .15s; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-secondary { background: var(--panel2); border: 1px solid var(--border); color: var(--text); }
    .btn-secondary:hover { border-color: var(--primary); color: var(--primary); }
    .btn-danger { background: #7f1d1d; color: var(--error); }
    .btn-danger:hover { background: #991b1b; }
    .btn-ghost { background: transparent; color: var(--muted); }
    .btn-ghost:hover { color: var(--text); }
    .btn-icon { background: transparent; border: 1px solid var(--border); border-radius: var(--radius); color: var(--muted); cursor: pointer; padding: 6px 9px; transition: all .15s; font-size: 13px; }
    .btn-icon:hover { border-color: var(--primary); color: var(--primary); }
    .btn-icon.danger:hover { border-color: var(--error); color: var(--error); }

    /* ── Page Header ── */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .page-title { font-size: 22px; font-weight: 700; color: var(--text); }
    .page-subtitle { font-size: 13px; color: var(--muted); margin-top: 2px; }
    .page-header-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

    /* ── KPI Grid ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .kpi-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px; }
    .kpi-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .kpi-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
    .kpi-icon { font-size: 20px; margin-bottom: 8px; }

    /* ── Tabs ── */
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 0; }
    .tab-btn { background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--muted); cursor: pointer; font-size: 13px; font-weight: 600; padding: 8px 14px; transition: all .15s; }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active { border-bottom-color: var(--primary); color: var(--primary); }
    .tab-count { background: var(--panel2); border-radius: 999px; font-size: 11px; padding: 1px 6px; margin-left: 4px; }

    /* ── Table ── */
    .table-wrapper { overflow-x: auto; border-radius: var(--radius-lg); border: 1px solid var(--border); }
    .data-table { border-collapse: collapse; width: 100%; }
    .data-table th { background: var(--panel2); color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .06em; padding: 10px 14px; text-align: left; text-transform: uppercase; }
    .data-table td { border-top: 1px solid var(--border); color: var(--text); padding: 10px 14px; }
    .data-table tr:hover td { background: var(--panel2); }

    /* ── Form ── */
    .form-field { display: flex; flex-direction: column; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }

    /* ── Modal ── */
    .modal-overlay { align-items: center; background: rgba(0,0,0,.7); bottom: 0; display: flex; justify-content: center; left: 0; opacity: 0; padding: 16px; position: fixed; right: 0; top: 0; transition: opacity .2s; z-index: 1000; }
    .modal-overlay.open { opacity: 1; }
    .modal { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow); max-height: 90vh; max-width: 560px; overflow-y: auto; width: 100%; }
    .modal-header { align-items: center; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; padding: 16px 20px; }
    .modal-title { font-size: 16px; font-weight: 700; }
    .modal-body { padding: 20px; }
    .modal-footer { border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; padding: 14px 20px; }

    /* ── Toast ── */
    .toast-container { bottom: 24px; display: flex; flex-direction: column; gap: 8px; position: fixed; right: 24px; z-index: 2000; }
    .toast { align-items: center; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); display: flex; font-size: 13px; gap: 8px; max-width: 360px; opacity: 0; padding: 10px 16px; transform: translateX(20px); transition: all .3s; }
    .toast.show { opacity: 1; transform: translateX(0); }
    .toast-ok { border-color: var(--success); }
    .toast-erro { border-color: var(--error); }
    .toast-warn { border-color: var(--warn); }

    /* ── Empty / Loading ── */
    .empty-state { align-items: center; display: flex; flex-direction: column; gap: 10px; padding: 60px 20px; text-align: center; }
    .empty-state-icon { font-size: 40px; opacity: .4; }
    .empty-state-title { color: var(--muted); font-size: 15px; font-weight: 600; }
    .empty-state-subtitle { color: var(--muted); font-size: 13px; opacity: .7; }
    .loading-state { align-items: center; display: flex; flex-direction: column; gap: 12px; padding: 60px 20px; }
    .spinner { animation: spin 1s linear infinite; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; height: 32px; width: 32px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  const extra = document.createElement("style");
  extra.id = "__design-system-extra__";
  if (!document.getElementById("__design-system-extra__")) {
    extra.textContent = `
      .search-bar { position: relative; display: flex; align-items: center; }
      .search-icon { position: absolute; left: 10px; font-size: 14px; pointer-events: none; }
      .search-input { padding-left: 32px !important; }
      .status-badge { border-radius: 999px; font-size: 11px; font-weight: 700; padding: 2px 10px; white-space: nowrap; }
    `;
    document.head.appendChild(extra);
  }
  document.head.appendChild(style);
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES ADICIONAIS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Barra de busca
 * @param {{ id?: string, placeholder?: string, value?: string }} opts
 */
export function SearchBar({ id = "search-bar", placeholder = "Buscar...", value = "" } = {}) {
  return `
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        id="${id}"
        class="search-input"
        placeholder="${esc(placeholder)}"
        value="${esc(value)}"
        autocomplete="off"
      />
    </div>
  `;
}

/**
 * Badge de status colorido
 * @param {string} label
 * @param {string} color  cor CSS (hex, var, etc)
 */
export function StatusBadge(label, color = "var(--muted)") {
  return `<span class="status-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${esc(label)}</span>`;
}

/**
 * Estado vazio
 * @param {{ title?: string, subtitle?: string, icon?: string, action?: string }} opts
 */
export function EmptyState({ title = "Nenhum registro encontrado.", subtitle = "", icon = "📭", action = "" } = {}) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-title">${esc(title)}</div>
      ${subtitle ? `<div class="empty-state-subtitle">${esc(subtitle)}</div>` : ""}
      ${action ? `<div style="margin-top:12px">${action}</div>` : ""}
    </div>
  `;
}
