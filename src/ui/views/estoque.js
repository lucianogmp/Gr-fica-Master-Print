/**
 * ESTOQUE VIEW — Gestão de matérias-primas e movimentações.
 */

import { BaseView } from "./baseView.js";
import { services } from "../../core/services.js";
import { selectors, store } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import {
  PageHeader, KpiGrid, Tabs, DataTable, Btn, openModal,
  SearchBar, EmptyState, fmtBRL, esc,
} from "../components/index.js";

export class EstoqueView extends BaseView {
  #aba = "saldo";
  #busca = "";
  #filtroCat = "";
  #modalMov = null;

  async _init() {
    await services.estoque.listar();
    this.subscribe("estoque", () => this.refresh());
    this.listenTo(EVENTS.ESTOQUE_ENTRADA, () => {});
    this.listenTo(EVENTS.ESTOQUE_SAIDA, () => {});
  }

  render() {
    const state = selectors.estoque();
    const materias = state.materias || [];

    const totAlertas = materias.filter(m => m.saldo > 0 && m.saldo <= Number(m.estoque_minimo || 0)).length;
    const totZerados = materias.filter(m => m.saldo <= 0).length;
    const custoTotal = materias.reduce((s, m) => s + Math.max(m.saldo, 0) * Number(m.custo_unitario || 0), 0);

    return `
      <style>
        .cat-btn{padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--border-md);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s;font-family:var(--font)}
        .cat-btn:hover{background:var(--panel2);color:var(--text)}
        .cat-btn.active{background:var(--primary-bg);border-color:var(--primary-border);color:var(--primary-light)}
        .unit-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--panel3);color:var(--muted)}
        .status-pill-est{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap}
        .btn-mov{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);border:1px solid;cursor:pointer;font-size:12px;transition:all .15s}
        .btn-ent{background:var(--success-bg);border-color:var(--success-border);color:var(--success)} .btn-ent:hover{background:var(--success);color:#fff}
        .btn-sai{background:var(--error-bg);border-color:var(--error-border);color:var(--error)} .btn-sai:hover{background:var(--error);color:#fff}
      </style>

      ${PageHeader({
        title: "Estoque",
        subtitle: `${materias.length} matérias-primas · Custo total: ${fmtBRL(custoTotal)}`,
        actions: Btn.primary('<i class="fi fi-rr-add"></i> Nova Matéria-Prima', "btn-nova-mp"),
      })}

      ${KpiGrid([
        { label: "Itens cadastrados", value: materias.length, icon: "📦" },
        { label: "Estoque baixo",     value: totAlertas, color: "var(--warning)", icon: "⚠️" },
        { label: "Sem estoque",       value: totZerados, color: "var(--error)",   icon: "🔴" },
        { label: "Custo em estoque",  value: fmtBRL(custoTotal), color: "var(--primary-light)", icon: "💰" },
      ])}

      ${Tabs({
        tabs: [
          { key: "saldo",    label: "Saldo Atual",          icon: "fi-rr-shelves"  },
          { key: "materias", label: "Gerenciar",            icon: "fi-rr-box-open" },
          { key: "historico",label: "Histórico",            icon: "fi-rr-clock"    },
        ],
        active: this.#aba,
      })}

      <div id="est-body">${this.#renderAba(materias, state)}</div>
    `;
  }

  #renderAba(materias, state) {
    if (this.#aba === "saldo")     return this.#renderSaldo(materias);
    if (this.#aba === "materias")  return this.#renderMaterias(materias);
    if (this.#aba === "historico") return this.#renderHistorico(state.movimentos || []);
    return "";
  }

  #categorias(materias) {
    return [...new Set(materias.map(m => m.categoria).filter(Boolean))].sort();
  }

  #filtrarMaterias(materias) {
    return materias.filter(m => {
      const okNome = !this.#busca || m.nome?.toLowerCase().includes(this.#busca.toLowerCase());
      const okCat  = !this.#filtroCat || m.categoria === this.#filtroCat;
      return okNome && okCat;
    });
  }

  #statusSaldo(mp) {
    const saldo = Number(mp.saldo), min = Number(mp.estoque_minimo || 0);
    if (saldo <= 0) return "zerado";
    if (min > 0 && saldo <= min) return "baixo";
    return "ok";
  }

  #renderCatFiltros(materias) {
    const cats = this.#categorias(materias);
    if (!cats.length) return "";
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      <button class="cat-btn ${!this.#filtroCat ? "active" : ""}" data-cat="">Todas</button>
      ${cats.map(c => `<button class="cat-btn ${this.#filtroCat === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
    </div>`;
  }

  #renderSaldo(materias) {
    const STATUS_CFG = {
      ok:     { cor: "var(--success)", icon: "●", label: "OK"     },
      baixo:  { cor: "var(--warning)", icon: "▲", label: "Baixo"  },
      zerado: { cor: "var(--error)",   icon: "✕", label: "Zerado" },
    };
    const filtradas = this.#filtrarMaterias(materias).sort((a, b) => {
      const order = { zerado: 0, baixo: 1, ok: 2 };
      return order[this.#statusSaldo(a)] - order[this.#statusSaldo(b)];
    });

    return `
      ${this.#renderCatFiltros(materias)}
      <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:220px;max-width:360px">
          ${SearchBar({ id: "busca-saldo", placeholder: "Buscar matéria-prima...", value: this.#busca })}
        </div>
        <span style="font-size:12px;color:var(--muted)">${filtradas.length} item${filtradas.length !== 1 ? "s" : ""}</span>
      </div>
      ${DataTable({
        columns: [
          { label: "Matéria-Prima" },
          { label: "Unidade", style: "text-align:center;width:80px" },
          { label: "Saldo", style: "text-align:right;width:100px" },
          { label: "Mínimo", style: "text-align:right;width:90px" },
          { label: "Custo/un", style: "text-align:right;width:100px" },
          { label: "Valor", style: "text-align:right;width:110px" },
          { label: "Status", style: "text-align:center;width:90px" },
          { label: "", style: "width:110px" },
        ],
        rows: filtradas.map(mp => {
          const st  = this.#statusSaldo(mp);
          const cfg = STATUS_CFG[st];
          const val = Math.max(mp.saldo, 0) * Number(mp.custo_unitario || 0);
          return `
            <tr>
              <td>
                <div style="font-weight:600">${esc(mp.nome)}</div>
                ${mp.categoria ? `<div style="font-size:11px;color:var(--muted)">${esc(mp.categoria)}</div>` : ""}
              </td>
              <td style="text-align:center"><span class="unit-tag">${esc(mp.unidade || "un")}</span></td>
              <td style="text-align:right;font-weight:700;font-size:15px;color:${cfg.cor}">${Number(mp.saldo).toFixed(3)}</td>
              <td style="text-align:right;font-size:12px;color:var(--muted)">${Number(mp.estoque_minimo || 0).toFixed(3)}</td>
              <td style="text-align:right;font-size:12px">${fmtBRL(mp.custo_unitario || 0)}</td>
              <td style="text-align:right;font-weight:600;color:var(--primary-light)">${fmtBRL(val)}</td>
              <td style="text-align:center">
                <span class="status-pill-est" style="background:${cfg.cor}22;color:${cfg.cor}">${cfg.icon} ${cfg.label}</span>
              </td>
              <td>
                <div style="display:flex;gap:4px;justify-content:center">
                  <button class="btn-mov btn-ent" data-mov="entrada" data-id="${mp.id}" data-nome="${esc(mp.nome)}" data-un="${esc(mp.unidade || "un")}" data-saldo="${mp.saldo}" title="Entrada">↑</button>
                  <button class="btn-mov btn-sai" data-mov="saida" data-id="${mp.id}" data-nome="${esc(mp.nome)}" data-un="${esc(mp.unidade || "un")}" data-saldo="${mp.saldo}" title="Saída">↓</button>
                  <button class="btn-icon" data-edit-mp="${mp.id}" title="Editar" style="width:28px;height:28px;padding:0;justify-content:center">✏️</button>
                </div>
              </td>
            </tr>`;
        }),
        emptyMessage: "Nenhuma matéria-prima encontrada.",
      })}`;
  }

  #renderMaterias(materias) {
    const filtradas = this.#filtrarMaterias(materias);
    return `
      ${this.#renderCatFiltros(materias)}
      <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:220px;max-width:360px">
          ${SearchBar({ id: "busca-mats", placeholder: "Buscar matéria-prima...", value: this.#busca })}
        </div>
        ${Btn.primary('<i class="fi fi-rr-add"></i> Adicionar', "btn-nova-mp2", 'style="font-size:12px;padding:7px 12px"')}
      </div>
      ${DataTable({
        columns: [
          { label: "Nome" },
          { label: "Categoria" },
          { label: "Unidade", style: "text-align:center;width:80px" },
          { label: "Estoque mín.", style: "text-align:right;width:120px" },
          { label: "Custo/un", style: "text-align:right;width:110px" },
          { label: "Saldo atual", style: "text-align:right;width:110px" },
          { label: "", style: "width:80px" },
        ],
        rows: filtradas.map(mp => {
          const st = this.#statusSaldo(mp);
          const cores = { ok: "var(--success)", baixo: "var(--warning)", zerado: "var(--error)" };
          return `
            <tr>
              <td><strong>${esc(mp.nome)}</strong></td>
              <td style="color:var(--muted);font-size:12px">${esc(mp.categoria) || "—"}</td>
              <td style="text-align:center"><span class="unit-tag">${esc(mp.unidade || "un")}</span></td>
              <td style="text-align:right;color:var(--muted)">${Number(mp.estoque_minimo || 0).toFixed(3)}</td>
              <td style="text-align:right;font-weight:600;color:var(--primary-light)">${fmtBRL(mp.custo_unitario || 0)}</td>
              <td style="text-align:right;font-weight:700;color:${cores[st]}">${Number(mp.saldo).toFixed(3)} ${esc(mp.unidade || "un")}</td>
              <td>
                <div style="display:flex;gap:4px;justify-content:flex-end">
                  <button class="btn-icon" data-edit-mp="${mp.id}" title="Editar" style="padding:4px 8px">✏️</button>
                  <button class="btn-icon danger" data-del-mp="${mp.id}" data-del-nome="${esc(mp.nome)}" title="Excluir" style="padding:4px 8px">🗑</button>
                </div>
              </td>
            </tr>`;
        }),
        emptyMessage: "Nenhuma matéria-prima cadastrada.",
      })}`;
  }

  #renderHistorico(movimentos) {
    const filtrados = movimentos.slice(0, 200);
    return DataTable({
      columns: [
        { label: "Tipo", style: "width:100px" },
        { label: "Matéria-Prima" },
        { label: "Quantidade", style: "text-align:right;width:120px" },
        { label: "Motivo" },
        { label: "Data", style: "width:130px" },
      ],
      rows: filtrados.map(m => {
        const isEnt = m.tipo === "entrada";
        const data  = new Date(m.created_at).toLocaleString("pt-BR");
        return `
          <tr>
            <td>
              <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:${isEnt ? "var(--success-bg)" : "var(--error-bg)"};color:${isEnt ? "var(--success)" : "var(--error)"}">
                ${isEnt ? "↑ Entrada" : "↓ Saída"}
              </span>
            </td>
            <td><strong>${esc(m.materias_primas?.nome || "—")}</strong></td>
            <td style="text-align:right;font-weight:700;color:${isEnt ? "var(--success)" : "var(--error)"}">
              ${isEnt ? "+" : "−"}${Number(m.quantidade).toFixed(3)} ${esc(m.materias_primas?.unidade || "")}
            </td>
            <td style="font-size:12px;color:var(--muted)">${esc(m.motivo) || "—"}</td>
            <td style="font-size:12px;color:var(--muted)">${data}</td>
          </tr>`;
      }),
      emptyMessage: "Nenhum movimento registrado.",
    });
  }

  afterRender() {
    // Tabs
    this.$$(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.#aba = btn.dataset.tab;
        this.refresh();
      });
    });

    // Filtros de categoria
    this.$$("[data-cat]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.#filtroCat = btn.dataset.cat;
        this.refresh();
      });
    });

    // Busca
    this.$("#busca-saldo")?.addEventListener("input", e => { this.#busca = e.target.value; this.#renderAbaDOM(); });
    this.$("#busca-mats")?.addEventListener("input",  e => { this.#busca = e.target.value; this.#renderAbaDOM(); });

    // Nova MP
    ["#btn-nova-mp", "#btn-nova-mp2"].forEach(sel => {
      this.$(sel)?.addEventListener("click", () => this.#abrirModalMP(null));
    });

    // Movimentações
    this.$$("[data-mov]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.#abrirModalMov(btn.dataset.mov, {
          id: btn.dataset.id, nome: btn.dataset.nome,
          unidade: btn.dataset.un, saldo: parseFloat(btn.dataset.saldo),
        });
      });
    });

    // Editar MP
    this.$$("[data-edit-mp]").forEach(btn => {
      btn.addEventListener("click", () => {
        const mp = (selectors.estoque().materias || []).find(m => m.id === btn.dataset.editMp);
        if (mp) this.#abrirModalMP(mp);
      });
    });

    // Deletar MP
    this.$$("[data-del-mp]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm(`Excluir "${btn.dataset.delNome}"?`)) return;
        try {
          await services.estoque.deletarMateria(btn.dataset.delMp);
          this.toast("Matéria-prima removida.", "ok");
        } catch (e) { this.toast(e.message, "erro"); }
      });
    });
  }

  #renderAbaDOM() {
    const body = this.$("#est-body");
    if (!body) return;
    const materias = selectors.estoque().materias || [];
    body.innerHTML = this.#renderAba(materias, selectors.estoque());
    this.afterRender();
  }

  // ── Modal Nova/Editar MP ──────────────────────────────────────────────────
  #abrirModalMP(mp) {
    const editando = !!mp?.id;
    const categorias = this.#categorias(selectors.estoque().materias || []);
    const modalRef = openModal({
      title: editando ? "Editar Matéria-Prima" : "Nova Matéria-Prima",
      maxWidth: "480px",
      body: `
        <div class="form-grid">
          <div class="form-field full"><label>Nome *</label>
            <input id="mp-nome" value="${esc(mp?.nome)}" placeholder="Ex: Adesivo Vinil A4..." autofocus />
          </div>
          <div class="form-field"><label>Categoria</label>
            <input id="mp-cat" value="${esc(mp?.categoria)}" placeholder="Ex: Papel, Vinil..." list="mp-cat-list" autocomplete="off" />
            <datalist id="mp-cat-list">${categorias.map(c => `<option value="${esc(c)}">`).join("")}</datalist>
          </div>
          <div class="form-field"><label>Unidade</label>
            <select id="mp-un">${["un","m²","m","folha","kg","g","l","ml","rolo","caixa"].map(u => `<option value="${u}" ${(mp?.unidade || "un") === u ? "selected" : ""}>${u}</option>`).join("")}</select>
          </div>
          <div class="form-field"><label>Estoque mínimo</label>
            <input id="mp-min" type="number" min="0" step="0.001" value="${mp?.estoque_minimo || 0}" />
          </div>
          <div class="form-field"><label>Custo unitário (R$)</label>
            <input id="mp-custo" type="number" min="0" step="0.0001" value="${Number(mp?.custo_unitario || 0).toFixed(4)}" />
          </div>
          ${!editando ? `
          <div class="form-field"><label>Saldo inicial</label>
            <input id="mp-saldo-ini" type="number" min="0" step="0.001" value="0" />
          </div>` : ""}
        </div>`,
      actions: `
        ${Btn.secondary("Cancelar", "mp-cancel")}
        ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar', "mp-ok")}`,
    });

    document.getElementById("mp-cancel")?.addEventListener("click", () => modalRef.close());
    document.getElementById("mp-ok")?.addEventListener("click", async () => {
      const nome = document.getElementById("mp-nome")?.value.trim();
      if (!nome) { this.toast("Informe o nome.", "warn"); return; }
      const dados = {
        nome,
        categoria:      document.getElementById("mp-cat")?.value.trim() || null,
        unidade:        document.getElementById("mp-un")?.value,
        estoque_minimo: parseFloat(document.getElementById("mp-min")?.value) || 0,
        custo_unitario: parseFloat(document.getElementById("mp-custo")?.value) || 0,
        saldo_inicial:  parseFloat(document.getElementById("mp-saldo-ini")?.value) || 0,
      };
      try {
        if (editando) await services.estoque.atualizarMateria(mp.id, dados);
        else          await services.estoque.criarMateria(dados);
        modalRef.close();
        this.toast(editando ? "Matéria-prima atualizada!" : "Matéria-prima cadastrada!", "ok");
      } catch (e) { this.toast(e.message, "erro"); }
    });
  }

  // ── Modal Movimentação ────────────────────────────────────────────────────
  #abrirModalMov(tipo, mp) {
    const isEnt = tipo === "entrada";
    const cor   = isEnt ? "var(--success)" : "var(--error)";
    const modalRef = openModal({
      title: `${isEnt ? "↑ Entrada" : "↓ Saída"} de Estoque`,
      maxWidth: "420px",
      body: `
        <div style="background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:14px">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(mp.nome)}</div>
          <div style="font-size:12px;color:var(--muted)">Saldo atual: <strong style="color:${Number(mp.saldo) <= 0 ? "var(--error)" : "var(--success)"}">${Number(mp.saldo).toFixed(3)} ${esc(mp.unidade)}</strong></div>
        </div>
        <div class="form-field">
          <label>Quantidade (${esc(mp.unidade)}) *</label>
          <input id="mov-qtd" type="number" min="0.001" step="0.001" placeholder="0,000" autofocus style="font-size:18px;text-align:center" />
        </div>
        <div class="form-field" style="margin-top:10px">
          <label>Motivo / Observação</label>
          <textarea id="mov-motivo" rows="2" placeholder="${isEnt ? "Ex: Compra NF 123..." : "Ex: Usado na produção..."}"></textarea>
        </div>
        ${!isEnt ? `<div id="mov-alerta" style="display:none;background:var(--warning-bg);border:1px solid rgba(255,179,0,.25);border-radius:var(--radius-md);padding:8px 12px;font-size:12px;color:var(--warning);margin-top:8px">
          ⚠️ Quantidade maior que o saldo disponível.
        </div>` : ""}`,
      actions: `
        ${Btn.secondary("Cancelar", "mov-cancel")}
        <button class="btn" id="mov-ok" style="background:${cor};color:#fff;border-color:${cor};display:inline-flex;align-items:center;gap:6px;border-radius:var(--radius-md);padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer">
          ${isEnt ? "↑ Confirmar Entrada" : "↓ Confirmar Saída"}
        </button>`,
    });

    const qtdInp = document.getElementById("mov-qtd");
    if (!isEnt) {
      qtdInp?.addEventListener("input", () => {
        const alerta = document.getElementById("mov-alerta");
        if (alerta) alerta.style.display = parseFloat(qtdInp.value) > mp.saldo ? "block" : "none";
      });
    }

    document.getElementById("mov-cancel")?.addEventListener("click", () => modalRef.close());
    document.getElementById("mov-ok")?.addEventListener("click", async () => {
      const qtd = parseFloat(qtdInp?.value);
      if (!qtd || qtd <= 0) { this.toast("Informe uma quantidade válida.", "warn"); return; }
      if (!isEnt && qtd > mp.saldo) {
        if (!confirm(`Saldo insuficiente (${mp.saldo} ${mp.unidade}). Continuar mesmo assim?`)) return;
      }
      const motivo = document.getElementById("mov-motivo")?.value.trim() || null;
      try {
        if (isEnt) await services.estoque.registrarEntrada(mp.id, qtd, motivo);
        else       await services.estoque.registrarSaida(mp.id, qtd, motivo, true);
        modalRef.close();
        this.toast(`${isEnt ? "Entrada" : "Saída"} registrada: ${qtd.toFixed(3)} ${mp.unidade}`, "ok");
      } catch (e) { this.toast(e.message, "erro"); }
    });
  }
}
