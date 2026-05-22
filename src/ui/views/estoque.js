/**
 * ESTOQUE VIEW — Gestão de matérias-primas com tabela melhorada e alertas visuais.
 */

import { BaseView }          from "./baseView.js";
import { services }          from "../../core/services.js";
import { selectors }         from "../../core/store.js";
import { EventBus, EVENTS }  from "../../core/eventBus.js";
import { esc }               from "../../utils/sanitize.js";
import { fmtBRL }            from "../../utils/fmt.js";
import {
  PageHeader, KpiGrid, Tabs, DataTable, Btn, openModal, SearchBar, EmptyState,
} from "../components/index.js";

export class EstoqueView extends BaseView {
  #aba       = "saldo";
  #busca     = "";
  #filtroCat = "";
  #sortKey   = "nome";
  #sortDir   = "asc";

  async _init() {
    await services.estoque.listar();
    this.subscribe("estoque", () => this.refresh());
  }

  render() {
    const state   = selectors.estoque();
    const materias = state.materias || [];

    const totAlertas = materias.filter(m => m.saldo > 0 && m.saldo <= Number(m.estoque_minimo||0)).length;
    const totZerados = materias.filter(m => m.saldo <= 0).length;
    const custoTotal = materias.reduce((s,m) => s + Math.max(m.saldo,0) * Number(m.custo_unitario||0), 0);

    return `
      <style>${estoqueCSS()}</style>

      ${PageHeader({
        title: "Estoque",
        subtitle: `${materias.length} matérias-primas · custo em estoque: ${fmtBRL(custoTotal)}`,
        actions: Btn.primary('<i class="fi fi-rr-add"></i> Nova Matéria-Prima', "btn-nova-mp"),
      })}

      ${KpiGrid([
        { label: "Itens cadastrados", value: materias.length,  icon: "📦", color: "var(--primary-light)" },
        { label: "Estoque baixo",     value: totAlertas,        icon: "⚠️", color: "var(--warning)" },
        { label: "Sem estoque",       value: totZerados,        icon: "🔴", color: "var(--error)" },
        { label: "Custo total",       value: fmtBRL(custoTotal),icon: "💰", color: "var(--success)" },
      ])}

      ${Tabs({
        tabs: [
          { key: "saldo",     label: "Saldo atual"   },
          { key: "materias",  label: "Gerenciar"     },
          { key: "historico", label: "Histórico"     },
        ],
        active: this.#aba,
      })}

      <div id="est-body">${this.#renderAba(materias, state)}</div>
    `;
  }

  // ── Renderiza aba ──────────────────────────────────────────────────────────
  #renderAba(materias, state) {
    if (this.#aba === "saldo")     return this.#renderSaldo(materias);
    if (this.#aba === "materias")  return this.#renderGerenciar(materias);
    if (this.#aba === "historico") return this.#renderHistorico(state.movimentos || []);
    return "";
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  #categorias(materias) {
    return [...new Set(materias.map(m => m.categoria).filter(Boolean))].sort();
  }

  #filtrar(materias) {
    return materias.filter(m => {
      const okNome = !this.#busca || m.nome?.toLowerCase().includes(this.#busca.toLowerCase());
      const okCat  = !this.#filtroCat || m.categoria === this.#filtroCat;
      return okNome && okCat;
    });
  }

  #status(mp) {
    const saldo = Number(mp.saldo);
    const min   = Number(mp.estoque_minimo || 0);
    if (saldo <= 0)              return { key: "zerado", label: "Zerado", cor: "var(--error)"  };
    if (min > 0 && saldo <= min) return { key: "baixo",  label: "Baixo",  cor: "var(--warning)"};
    return                               { key: "ok",     label: "OK",     cor: "var(--success)"};
  }

  #sortMaterias(list) {
    return [...list].sort((a, b) => {
      // Prioridade: zerado > baixo > ok
      const ord = { zerado: 0, baixo: 1, ok: 2 };
      if (this.#sortKey === "_status") {
        const diff = ord[this.#status(a).key] - ord[this.#status(b).key];
        return this.#sortDir === "asc" ? diff : -diff;
      }
      let va = a[this.#sortKey] ?? "";
      let vb = b[this.#sortKey] ?? "";
      if (["saldo","custo_unitario","estoque_minimo"].includes(this.#sortKey)) {
        va = Number(va); vb = Number(vb);
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return this.#sortDir === "asc" ? cmp : -cmp;
    });
  }

  // ── Filtros de categoria ──────────────────────────────────────────────────
  #catFiltros(materias) {
    const cats = this.#categorias(materias);
    if (!cats.length) return "";
    return `<div class="cat-chips">
      <button class="chip ${!this.#filtroCat?"active":""}" data-cat="">Todas</button>
      ${cats.map(c => `<button class="chip ${this.#filtroCat===c?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ABA SALDO
  // ══════════════════════════════════════════════════════════════════════════
  #renderSaldo(materias) {
    const filtradas = this.#sortMaterias(this.#filtrar(materias));

    return `
      ${this.#catFiltros(materias)}
      <div class="est-toolbar">
        <div style="flex:1;max-width:320px">
          ${SearchBar({ id: "busca-saldo", placeholder: "Buscar matéria-prima...", value: this.#busca })}
        </div>
        <span class="result-count">${filtradas.length} item${filtradas.length!==1?"s":""}</span>
      </div>

      ${DataTable({
        columns: [
          { key: "nome",           label: "Matéria-Prima" },
          { key: "unidade",        label: "Un.",     style: "width:60px;text-align:center" },
          { key: "saldo",          label: "Saldo",   style: "text-align:right;width:110px" },
          { key: "estoque_minimo", label: "Mínimo",  style: "text-align:right;width:90px" },
          { key: "custo_unitario", label: "Custo/un",style: "text-align:right;width:110px" },
          { key: "_valor",         label: "Valor",   style: "text-align:right;width:120px" },
          { key: "_status",        label: "Status",  style: "text-align:center;width:90px" },
          { key: "_actions",       label: "",        style: "width:110px" },
        ],
        rows: filtradas.length === 0 ? [] : filtradas.map(mp => {
          const st  = this.#status(mp);
          const val = Math.max(mp.saldo,0) * Number(mp.custo_unitario||0);
          return `
            <tr>
              <td>
                <div class="mp-nome">${esc(mp.nome)}</div>
                ${mp.categoria ? `<div class="mp-cat">${esc(mp.categoria)}</div>` : ""}
              </td>
              <td style="text-align:center">
                <span class="unit-tag">${esc(mp.unidade||"un")}</span>
              </td>
              <td style="text-align:right;font-weight:700;font-size:15px;color:${st.cor}">
                ${Number(mp.saldo).toFixed(3)}
              </td>
              <td style="text-align:right;font-size:12px;color:var(--muted)">
                ${Number(mp.estoque_minimo||0).toFixed(3)}
              </td>
              <td style="text-align:right;font-size:12px">${fmtBRL(mp.custo_unitario||0)}</td>
              <td style="text-align:right;font-weight:600;color:var(--primary-light)">${fmtBRL(val)}</td>
              <td style="text-align:center">
                <span class="status-pill-est" style="--sc:${st.cor}">${st.label}</span>
              </td>
              <td>
                <div style="display:flex;gap:4px;justify-content:flex-end">
                  <button class="btn-mov btn-ent" data-mov="entrada"
                    data-id="${mp.id}" data-nome="${esc(mp.nome)}"
                    data-un="${esc(mp.unidade||"un")}" data-saldo="${mp.saldo}"
                    title="Entrada">↑</button>
                  <button class="btn-mov btn-sai" data-mov="saida"
                    data-id="${mp.id}" data-nome="${esc(mp.nome)}"
                    data-un="${esc(mp.unidade||"un")}" data-saldo="${mp.saldo}"
                    title="Saída">↓</button>
                  <button class="btn-icon" data-edit-mp="${mp.id}" title="Editar"
                    style="width:28px;height:28px;padding:0;justify-content:center">
                    <i class="fi fi-rr-pencil"></i>
                  </button>
                </div>
              </td>
            </tr>`;
        }),
        emptyMessage: "Nenhuma matéria-prima encontrada.",
        sortKey: this.#sortKey,
        sortDir: this.#sortDir,
        onSort:  true,
      })}`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ABA GERENCIAR
  // ══════════════════════════════════════════════════════════════════════════
  #renderGerenciar(materias) {
    const filtradas = this.#sortMaterias(this.#filtrar(materias));

    return `
      ${this.#catFiltros(materias)}
      <div class="est-toolbar">
        <div style="flex:1;max-width:320px">
          ${SearchBar({ id: "busca-mats", placeholder: "Buscar matéria-prima...", value: this.#busca })}
        </div>
        ${Btn.primary('<i class="fi fi-rr-add"></i> Adicionar', "btn-nova-mp2", 'style="font-size:12px;padding:7px 12px"')}
      </div>

      ${DataTable({
        columns: [
          { key: "nome",           label: "Nome" },
          { key: "categoria",      label: "Categoria",  style: "width:120px" },
          { key: "unidade",        label: "Un.",        style: "width:60px;text-align:center" },
          { key: "estoque_minimo", label: "Est. mín.",  style: "text-align:right;width:100px" },
          { key: "custo_unitario", label: "Custo/un",   style: "text-align:right;width:120px" },
          { key: "saldo",          label: "Saldo atual",style: "text-align:right;width:120px" },
          { key: "_actions",       label: "",           style: "width:90px" },
        ],
        rows: filtradas.length === 0 ? [] : filtradas.map(mp => {
          const st  = this.#status(mp);
          return `
            <tr>
              <td><strong>${esc(mp.nome)}</strong></td>
              <td class="mp-cat-cell">${esc(mp.categoria)||"—"}</td>
              <td style="text-align:center"><span class="unit-tag">${esc(mp.unidade||"un")}</span></td>
              <td style="text-align:right;color:var(--muted)">${Number(mp.estoque_minimo||0).toFixed(3)}</td>
              <td style="text-align:right;font-weight:600;color:var(--primary-light)">${fmtBRL(mp.custo_unitario||0)}</td>
              <td style="text-align:right;font-weight:700;color:${st.cor}">
                ${Number(mp.saldo).toFixed(3)} <span style="font-size:11px;font-weight:400;color:var(--muted)">${esc(mp.unidade||"un")}</span>
              </td>
              <td>
                <div style="display:flex;gap:4px;justify-content:flex-end">
                  <button class="btn-icon" data-edit-mp="${mp.id}"><i class="fi fi-rr-pencil"></i></button>
                  <button class="btn-icon danger" data-del-mp="${mp.id}" data-del-nome="${esc(mp.nome)}">
                    <i class="fi fi-rr-trash"></i>
                  </button>
                </div>
              </td>
            </tr>`;
        }),
        emptyMessage: "Nenhuma matéria-prima cadastrada.",
      })}`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ABA HISTÓRICO
  // ══════════════════════════════════════════════════════════════════════════
  #renderHistorico(movimentos) {
    const filtrados = movimentos.slice(0, 200);

    return DataTable({
      columns: [
        { label: "Tipo",          style: "width:100px" },
        { label: "Matéria-Prima" },
        { label: "Quantidade",    style: "text-align:right;width:130px" },
        { label: "Motivo" },
        { label: "Data",          style: "width:140px" },
      ],
      rows: filtrados.length === 0 ? [] : filtrados.map(m => {
        const isEnt = m.tipo === "entrada";
        const data  = new Date(m.created_at).toLocaleString("pt-BR");
        return `
          <tr>
            <td>
              <span class="hist-tipo ${isEnt?"ent":"sai"}">
                ${isEnt ? "↑ Entrada" : "↓ Saída"}
              </span>
            </td>
            <td><strong>${esc(m.materias_primas?.nome || "—")}</strong></td>
            <td style="text-align:right;font-weight:700;color:${isEnt?"var(--success)":"var(--error)"}">
              ${isEnt?"+":"−"}${Number(m.quantidade).toFixed(3)} ${esc(m.materias_primas?.unidade||"")}
            </td>
            <td style="font-size:12px;color:var(--muted)">${esc(m.motivo)||"—"}</td>
            <td style="font-size:12px;color:var(--muted)">${data}</td>
          </tr>`;
      }),
      emptyMessage: "Nenhum movimento registrado.",
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EVENTOS
  // ══════════════════════════════════════════════════════════════════════════
  afterRender() {
    // Tabs
    this.$$(".tab-btn").forEach(btn =>
      btn.addEventListener("click", () => { this.#aba = btn.dataset.tab; this.refresh(); })
    );
    // Filtro categoria
    this.$$("[data-cat]").forEach(btn =>
      btn.addEventListener("click", () => { this.#filtroCat = btn.dataset.cat; this.refresh(); })
    );
    // Busca
    this.$("#busca-saldo")?.addEventListener("input", e => { this.#busca = e.target.value; this.refresh(); });
    this.$("#busca-mats")?.addEventListener("input",  e => { this.#busca = e.target.value; this.refresh(); });
    // Ordenação
    this.$$("th[data-sort]").forEach(th =>
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (this.#sortKey === key) {
          this.#sortDir = this.#sortDir === "asc" ? "desc" : "asc";
        } else {
          this.#sortKey = key;
          this.#sortDir = "asc";
        }
        this.refresh();
      })
    );
    // Nova MP
    ["#btn-nova-mp","#btn-nova-mp2"].forEach(sel =>
      this.$(sel)?.addEventListener("click", () => this.#abrirModalMP(null))
    );
    // Movimentações
    this.$$("[data-mov]").forEach(btn =>
      btn.addEventListener("click", () =>
        this.#abrirModalMov(btn.dataset.mov, {
          id:      btn.dataset.id,
          nome:    btn.dataset.nome,
          unidade: btn.dataset.un,
          saldo:   parseFloat(btn.dataset.saldo),
        })
      )
    );
    // Editar MP
    this.$$("[data-edit-mp]").forEach(btn =>
      btn.addEventListener("click", () => {
        const mp = (selectors.estoque().materias||[]).find(m => m.id === btn.dataset.editMp);
        if (mp) this.#abrirModalMP(mp);
      })
    );
    // Deletar MP
    this.$$("[data-del-mp]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm(`Excluir "${btn.dataset.delNome}"?`)) return;
        try {
          await services.estoque.deletarMateria(btn.dataset.delMp);
          this.toast("Matéria-prima removida.", "ok");
        } catch (e) { this.toast(e.message, "erro"); }
      })
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL NOVA / EDITAR MP
  // ══════════════════════════════════════════════════════════════════════════
  #abrirModalMP(mp) {
    const editando   = !!mp?.id;
    const categorias = this.#categorias(selectors.estoque().materias || []);

    const modalRef = openModal({
      title: editando ? "Editar Matéria-Prima" : "Nova Matéria-Prima",
      maxWidth: "500px",
      body: `
        <div class="form-grid">
          <div class="form-field" style="grid-column:1/-1">
            <label>Nome *</label>
            <input id="mp-nome" value="${esc(mp?.nome||"")}" placeholder="Ex: Adesivo Vinil A4..." autofocus />
          </div>
          <div class="form-field">
            <label>Categoria</label>
            <input id="mp-cat" value="${esc(mp?.categoria||"")}" placeholder="Ex: Papel, Vinil..."
              list="mp-cat-list" autocomplete="off" />
            <datalist id="mp-cat-list">
              ${categorias.map(c=>`<option value="${esc(c)}">`).join("")}
            </datalist>
          </div>
          <div class="form-field">
            <label>Unidade</label>
            <select id="mp-un">
              ${["un","m²","m","folha","kg","g","l","ml","rolo","caixa"].map(u =>
                `<option value="${u}" ${(mp?.unidade||"un")===u?"selected":""}>${u}</option>`
              ).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Estoque mínimo</label>
            <input id="mp-min" type="number" min="0" step="0.001" value="${mp?.estoque_minimo||0}" />
          </div>
          <div class="form-field">
            <label>Custo unitário (R$)</label>
            <input id="mp-custo" type="number" min="0" step="0.0001" value="${Number(mp?.custo_unitario||0).toFixed(4)}" />
          </div>
          ${!editando ? `
          <div class="form-field" style="grid-column:1/-1">
            <label>Saldo inicial</label>
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
        categoria:      document.getElementById("mp-cat")?.value.trim()   || null,
        unidade:        document.getElementById("mp-un")?.value,
        estoque_minimo: parseFloat(document.getElementById("mp-min")?.value)    || 0,
        custo_unitario: parseFloat(document.getElementById("mp-custo")?.value)  || 0,
        saldo_inicial:  parseFloat(document.getElementById("mp-saldo-ini")?.value) || 0,
      };
      try {
        if (editando) await services.estoque.atualizarMateria(mp.id, dados);
        else          await services.estoque.criarMateria(dados);
        modalRef.close();
      } catch (e) { this.toast(e.message, "erro"); }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL MOVIMENTAÇÃO
  // ══════════════════════════════════════════════════════════════════════════
  #abrirModalMov(tipo, mp) {
    const isEnt = tipo === "entrada";
    const cor   = isEnt ? "var(--success)" : "var(--error)";
    const icon  = isEnt ? "fi-rr-arrow-up" : "fi-rr-arrow-down";

    const modalRef = openModal({
      title: `<span style="color:${cor}"><i class="fi ${icon}"></i> ${isEnt ? "Entrada" : "Saída"} de Estoque</span>`,
      maxWidth: "420px",
      body: `
        <div class="mp-info-banner" style="border-color:${cor}">
          <div class="mp-info-nome">${esc(mp.nome)}</div>
          <div class="mp-info-saldo">
            Saldo atual:
            <strong style="color:${Number(mp.saldo)<=0?"var(--error)":"var(--success)"}">
              ${Number(mp.saldo).toFixed(3)} ${esc(mp.unidade)}
            </strong>
          </div>
        </div>
        <div class="form-field" style="margin-top:16px">
          <label>Quantidade (${esc(mp.unidade)}) *</label>
          <input id="mov-qtd" type="number" min="0.001" step="0.001"
            placeholder="0,000" autofocus
            style="font-size:20px;text-align:center;font-weight:700" />
        </div>
        <div class="form-field" style="margin-top:10px">
          <label>Motivo / Observação</label>
          <textarea id="mov-motivo" rows="2"
            placeholder="${isEnt?"Ex: Compra NF 123...":"Ex: Usado na produção..."}"></textarea>
        </div>
        ${!isEnt ? `
        <div id="mov-alerta" style="display:none;background:var(--warning-bg);border:1px solid rgba(255,179,0,.25);
          border-radius:var(--radius-md);padding:8px 12px;font-size:12px;color:var(--warning);margin-top:8px">
          ⚠️ Quantidade maior que o saldo disponível.
        </div>` : ""}`,
      actions: `
        ${Btn.secondary("Cancelar", "mov-cancel")}
        <button class="btn-primary" id="mov-ok"
          style="background:${cor};border-color:${cor}">
          ${isEnt ? "↑ Confirmar Entrada" : "↓ Confirmar Saída"}
        </button>`,
    });

    const qtdInp = document.getElementById("mov-qtd");
    if (!isEnt && qtdInp) {
      qtdInp.addEventListener("input", () => {
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
        this.toast(`${isEnt?"Entrada":"Saída"} registrada: ${qtd.toFixed(3)} ${mp.unidade}`, "ok");
      } catch (e) { this.toast(e.message, "erro"); }
    });
  }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function estoqueCSS() { return `
.cat-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.chip{padding:5px 12px;border-radius:999px;font-size:12px;font-weight:500;border:1px solid var(--border-md);background:transparent;color:var(--muted);cursor:pointer;transition:all var(--t);font-family:var(--font)}
.chip:hover{background:var(--panel2);color:var(--text)}
.chip.active{background:var(--primary-bg);border-color:var(--primary-border);color:var(--primary-light);font-weight:700}
.est-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.result-count{font-size:12px;color:var(--muted)}
.mp-nome{font-weight:600;font-size:13px}
.mp-cat{font-size:11px;color:var(--muted);margin-top:2px}
.mp-cat-cell{font-size:12px;color:var(--muted)}
.unit-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--panel3);color:var(--muted)}
.status-pill-est{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:color-mix(in srgb,var(--sc) 15%,transparent);color:var(--sc)}
.btn-mov{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);border:1px solid;cursor:pointer;font-size:13px;font-weight:700;transition:all var(--t)}
.btn-ent{background:var(--success-bg);border-color:var(--success-border);color:var(--success)}
.btn-ent:hover{background:var(--success);color:#fff}
.btn-sai{background:var(--error-bg);border-color:var(--error-border);color:var(--error)}
.btn-sai:hover{background:var(--error);color:#fff}
.hist-tipo{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px}
.hist-tipo.ent{background:var(--success-bg);color:var(--success)}
.hist-tipo.sai{background:var(--error-bg);color:var(--error)}
.mp-info-banner{background:var(--panel3);border:1px solid;border-radius:var(--radius-md);padding:12px 14px;margin-bottom:4px}
.mp-info-nome{font-weight:700;font-size:14px;margin-bottom:4px}
.mp-info-saldo{font-size:13px;color:var(--muted)}
`; }
