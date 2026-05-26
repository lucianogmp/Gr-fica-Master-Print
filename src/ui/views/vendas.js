/**
 * VENDAS VIEW — Tela de vendas com tabela melhorada e fluxo ERP completo.
 */

import { BaseView }       from "./baseView.js";
import { services }       from "../../core/services.js";
import { store, selectors, actions } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import { esc }            from "../../utils/sanitize.js";
import { fmtBRL, fmtData } from "../../utils/fmt.js";
import {
  PageHeader, KpiGrid, Tabs, DataTable, Btn, StatusBadge,
  openModal, SearchBar, EmptyState,
} from "../components/index.js";

const SITUACOES = [
  { id: "pendente",    label: "Pendente",    cor: "#F79009" },
  { id: "em_execucao", label: "Em execução", cor: "#007CBE" },
  { id: "pronto",      label: "Pronto",      cor: "#6B48FF" },
  { id: "entregue",    label: "Entregue",    cor: "#00AC17" },
  { id: "cancelado",   label: "Cancelado",   cor: "#AB0000" },
];

const TIPOS_VENDA = ["Venda/O.S.", "Orçamento", "Consignação", "Troca"];

export class VendasView extends BaseView {
  #subView       = "lista";
  #vendaEditando = null;
  #form          = null;
  #sortKey       = "created_at";
  #sortDir       = "desc";

  async _init() {
    this.#form = this.#novoForm();
    await services.venda.listar(selectors.vendas().filters);
    await Promise.allSettled([
      services.cliente.listar(),
      services.config.carregar(),
    ]);
    this.subscribe("vendas", () => {
      if (this.#subView === "lista") this.refresh();
    });
    this.listenTo(EVENTS.VENDA_CRIADA,     () => services.venda.listar());
    this.listenTo(EVENTS.VENDA_ATUALIZADA, () => services.venda.listar());
  }

  render()       { return this.#subView === "form" ? this.#renderForm() : this.#renderLista(); }
  afterRender()  { if (this.#subView === "lista") this.#bindListaEvents(); else this.#bindFormEvents(); }

  // ══════════════════════════════════════════════════════════════════════════
  // LISTA
  // ══════════════════════════════════════════════════════════════════════════
  #renderLista() {
    const state  = selectors.vendas();
    const list   = state.list;
    const filtro = state.filters;

    const total      = list.reduce((s, v) => s + Number(v.total || 0), 0);
    const pendentes  = list.filter(v => v.status === "pendente").length;
    const emExecucao = list.filter(v => v.status === "em_execucao").length;
    const entregues  = list.filter(v => v.status === "entregue").length;

    let filtradas = list.filter(v => {
      const ok1 = !filtro.status || v.status === filtro.status;
      const ok2 = !filtro.search ||
        (v.cliente_nome || "").toLowerCase().includes(filtro.search.toLowerCase());
      return ok1 && ok2;
    });

    // Ordenação
    filtradas = [...filtradas].sort((a, b) => {
      let va = a[this.#sortKey] ?? "";
      let vb = b[this.#sortKey] ?? "";
      if (this.#sortKey === "total") { va = Number(va); vb = Number(vb); }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return this.#sortDir === "asc" ? cmp : -cmp;
    });

    return `
      <style>${vendasCSS()}</style>

      ${PageHeader({
        title: "Vendas",
        subtitle: `${list.length} venda${list.length !== 1 ? "s" : ""} · ${fmtBRL(total)}`,
        actions: Btn.primary('<i class="fi fi-rr-add"></i> Nova Venda', "btn-nova-venda"),
      })}

      <div class="vendas-kpis">
      ${KpiGrid([
        { label: "Faturamento", value: fmtBRL(total),   sub: `${list.length} venda${list.length!==1?"s":""}`, color: "var(--primary-light)", icon: '<i class="fi fi-rr-money-bill-wave"></i>' },
        { label: "Pendentes",   value: pendentes,        sub: "aguardando",  color: "var(--warning)",        icon: '<i class="fi fi-rr-clock"></i>' },
        { label: "Em execução", value: emExecucao,       sub: "em produção", color: "var(--info)",           icon: '<i class="fi fi-rr-settings"></i>' },
        { label: "Entregues",   value: entregues,        sub: "concluídas",  color: "var(--success)",        icon: '<i class="fi fi-rr-check-circle"></i>' },
      ])}
      </div>

      <!-- Filtros -->
      <div class="venda-filtros">
        <div style="flex:1;max-width:340px">
          ${SearchBar({ id: "busca-vendas", placeholder: "Buscar por cliente...", value: filtro.search })}
        </div>
        <div class="status-chips">
          <button class="chip ${!filtro.status ? "active" : ""}" data-filtro-status="">Todas</button>
          ${SITUACOES.map(s => `
            <button class="chip ${filtro.status === s.id ? "active" : ""}" data-filtro-status="${s.id}"
              style="${filtro.status === s.id ? `--chip-cor:${s.cor}` : ""}">
              <span class="chip-dot" style="background:${s.cor}"></span>
              ${s.label}
            </button>`).join("")}
        </div>
      </div>

      <!-- Contagem -->
      <div class="result-count">${filtradas.length} venda${filtradas.length !== 1 ? "s" : ""} encontrada${filtradas.length !== 1 ? "s" : ""}</div>

      <!-- Tabela -->
      ${DataTable({
        columns: [
          { key: "numero",       label: "#",        style: "width:60px" },
          { key: "cliente_nome", label: "Cliente",  sortable: true },
          { key: "tipo",         label: "Tipo",     style: "width:130px" },
          { key: "created_at",   label: "Data",     style: "width:100px" },
          { key: "data_entrega", label: "Entrega",  style: "width:100px" },
          { key: "status",       label: "Situação", style: "width:140px" },
          { key: "total",        label: "Total",    style: "text-align:right;width:130px" },
          { key: "_actions",     label: "",         style: "width:80px" },
        ],
        rows: filtradas.length === 0 ? [] : filtradas.map((v, i) => {
          const sit = SITUACOES.find(s => s.id === v.status) || SITUACOES[0];
          const data = v.created_at ? new Date(v.created_at).toLocaleDateString("pt-BR") : "—";
          return `
            <tr class="clickable" data-abrir="${v.id}">
              <td class="num-cell">${String(filtradas.length - i).padStart(3,"0")}</td>
              <td>
                <div class="cli-cell-nome">${esc(v.cliente_nome) || "<span class='sem-cliente'>Sem cliente</span>"}</div>
                ${v.observacoes ? `<div class="cli-cell-obs">${esc(v.observacoes.slice(0,50))}${v.observacoes.length>50?"…":""}</div>` : ""}
              </td>
              <td class="tipo-cell">${esc(v.tipo || "Venda/O.S.")}</td>
              <td class="data-cell">${data}</td>
              <td class="data-cell">${v.data_entrega ? fmtData(v.data_entrega) : "—"}</td>
              <td>
                <span class="status-pill" style="--pill-cor:${sit.cor}">
                  <span class="status-pill-dot"></span>${sit.label}
                </span>
              </td>
              <td class="total-cell">${fmtBRL(v.total || 0)}</td>
              <td>
                <div class="row-actions">
                  ${Btn.icon('<i class="fi fi-rr-pencil"></i>', `edit-${v.id}`)}
                  ${Btn.icon('<i class="fi fi-rr-trash"></i>', `del-${v.id}`, true)}
                </div>
              </td>
            </tr>`;
        }),
        emptyMessage: filtro.search || filtro.status
          ? "Nenhuma venda com esses filtros."
          : "Nenhuma venda cadastrada. Clique em \"Nova Venda\" para começar.",
        sortKey:  this.#sortKey,
        sortDir:  this.#sortDir,
        onSort:   true,
      })}
    `;
  }

  #bindListaEvents() {
    this.$("#btn-nova-venda")?.addEventListener("click", () => {
      this.#vendaEditando = null;
      this.#form          = this.#novoForm();
      this.#subView       = "form";
      this.refresh();
    });

    this.$("#busca-vendas")?.addEventListener("input", e =>
      actions.setVendasFiltro({ search: e.target.value })
    );

    this.$$("[data-filtro-status]").forEach(btn =>
      btn.addEventListener("click", () =>
        actions.setVendasFiltro({ status: btn.dataset.filtroStatus })
      )
    );

    // Ordenação por colunas
    this.$$(".data-table th.sortable, th[data-sort]").forEach(th => {
      if (!th.dataset.sort) return;
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (this.#sortKey === key) {
          this.#sortDir = this.#sortDir === "asc" ? "desc" : "asc";
        } else {
          this.#sortKey = key;
          this.#sortDir = "asc";
        }
        this.refresh();
      });
    });

    this.$$("[data-abrir]").forEach(row =>
      row.addEventListener("click", async e => {
        if (e.target.closest("button")) return;
        await this.#abrirVenda(row.dataset.abrir);
      })
    );

    selectors.vendas().list.forEach(v => {
      this.$(`#edit-${v.id}`)?.addEventListener("click", async e => {
        e.stopPropagation();
        await this.#abrirVenda(v.id);
      });
      this.$(`#del-${v.id}`)?.addEventListener("click", async e => {
        e.stopPropagation();
        if (!confirm(`Excluir a venda de "${v.cliente_nome || "sem cliente"}"?`)) return;
        try {
          await services.venda.deletar(v.id);
        } catch (err) {
          this.toast(err.message, "erro");
        }
      });
    });
  }

  async #abrirVenda(id) {
    const venda = await services.venda.buscarPorId(id);
    this.#vendaEditando = venda;
    this.#form = {
      clienteNome:  venda.cliente_nome || "",
      tipo:         venda.tipo || "Venda/O.S.",
      data:         venda.data_venda || this.#hoje(),
      situacao:     venda.status || "pendente",
      entrega:      venda.data_entrega || "",
      vendedor:     venda.vendedor || "",
      observacoes:  venda.observacoes || "",
      itens: (venda.venda_itens || []).map(i => ({
        descricao: i.descricao,
        produtoId: i.produto_id,
        preco:     Number(i.preco_unitario),
        qtd:       Number(i.quantidade),
        desconto:  Number(i.desconto || 0),
        obs:       i.obs || "",
      })) || [this.#novoItem()],
    };
    if (!this.#form.itens.length) this.#form.itens = [this.#novoItem()];
    this.#subView = "form";
    this.refresh();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FORMULÁRIO
  // ══════════════════════════════════════════════════════════════════════════
  #renderForm() {
    const f       = this.#form;
    const t       = this.#calcularTotais();
    const isEdit  = !!this.#vendaEditando;
    const clientes = selectors.clientes().list || [];
    const produtos  = selectors.produtos().list || [];

    return `
      <style>${formCSS()}</style>
      ${PageHeader({
        title: isEdit ? `Editar Venda` : "Nova Venda",
        actions: `
          ${Btn.ghost('<i class="fi fi-rr-print"></i> Imprimir', "btn-imprimir")}
          ${Btn.secondary("← Voltar", "btn-voltar")}
          ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar', "btn-salvar")}
        `,
      })}

      <!-- Dados principais -->
      <div class="ds-card">
        <div class="ds-card-title"><i class="fi fi-rr-file-invoice"></i> Dados da Venda</div>
        <div class="form-grid" style="grid-template-columns:2fr 1fr 1fr">
          <div class="form-field" style="grid-column:1/-1">
            <label>Cliente</label>
            <div class="autocomplete-wrap">
              <input id="f-cliente" value="${esc(f.clienteNome)}" placeholder="Buscar ou digitar cliente..." autocomplete="off" />
              <div class="autocomplete-list" id="ac-cli"></div>
            </div>
          </div>
          <div class="form-field">
            <label>Tipo</label>
            <select id="f-tipo">${TIPOS_VENDA.map(t => `<option ${f.tipo===t?"selected":""}>${t}</option>`).join("")}</select>
          </div>
          <div class="form-field">
            <label>Situação</label>
            <select id="f-situacao">
              ${SITUACOES.map(s => `<option value="${s.id}" ${f.situacao===s.id?"selected":""}>${s.label}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Data</label>
            <input id="f-data" type="date" value="${f.data}" />
          </div>
          <div class="form-field">
            <label>Entrega</label>
            <input id="f-entrega" type="date" value="${f.entrega}" />
          </div>
          <div class="form-field">
            <label>Vendedor</label>
            <input id="f-vendedor" value="${esc(f.vendedor)}" placeholder="Nome do vendedor" />
          </div>
        </div>
      </div>

      <!-- Itens -->
      <div class="ds-card">
        <div class="ds-card-title"><i class="fi fi-rr-shopping-cart"></i> Itens do Pedido</div>
        <div class="itens-table-wrap">
          <table class="itens-table">
            <thead>
              <tr>
                <th>Produto / Serviço</th>
                <th style="width:130px;text-align:right">Preço R$</th>
                <th style="width:100px;text-align:center">Qtd</th>
                <th style="width:120px;text-align:right">Desconto</th>
                <th style="width:130px;text-align:right">Total</th>
                <th style="width:36px"></th>
              </tr>
            </thead>
            <tbody id="tbody-itens">
              ${f.itens.map((it, i) => this.#renderItemRow(it, i)).join("")}
            </tbody>
            <tfoot>
              <tr class="tfoot-row">
                <td colspan="3"></td>
                <td class="tfoot-desc-label">Descontos:</td>
                <td class="tfoot-desc-val" id="r-desc">${fmtBRL(t.descontoTotal)}</td>
                <td></td>
              </tr>
              <tr class="tfoot-total-row">
                <td colspan="3"></td>
                <td class="tfoot-total-label">TOTAL:</td>
                <td class="tfoot-total-val" id="r-total">${fmtBRL(t.totalGeral)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <button class="btn-add-item-row" id="btn-add-item">
          <i class="fi fi-rr-plus"></i> Adicionar item
        </button>
      </div>

      <!-- Observações -->
      <div class="ds-card">
        <div class="ds-card-title"><i class="fi fi-rr-comment"></i> Observações</div>
        <textarea id="f-obs" rows="3" placeholder="Detalhes do pedido, prazo, acabamento...">${esc(f.observacoes)}</textarea>
      </div>

      <!-- Barra total fixo -->
      <div class="bottom-bar">
        <div class="bottom-total">
          Total: <strong id="r-total-bottom">${fmtBRL(t.totalGeral)}</strong>
        </div>
        <div style="display:flex;gap:8px">
          ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar Venda', "btn-salvar2")}
          ${Btn.secondary("Cancelar", "btn-voltar2")}
        </div>
      </div>
    `;
  }

  #renderItemRow(it, i) {
    const total = (Number(it.preco) || 0) * (Number(it.qtd) || 0) - (Number(it.desconto) || 0);
    return `
      <tr data-row="${i}">
        <td>
          <div class="autocomplete-wrap">
            <input class="item-input item-desc" data-i="${i}" value="${esc(it.descricao)}"
              placeholder="Produto ou serviço..." autocomplete="off" />
            <div class="autocomplete-list" id="ac-item-${i}"></div>
          </div>
        </td>
        <td>
          <input type="number" class="item-input item-preco" data-i="${i}"
            value="${it.preco}" style="text-align:right" />
        </td>
        <td>
          <input type="number" class="item-input item-qtd" data-i="${i}"
            value="${Number(it.qtd).toFixed(3)}" min="0.001" step="0.001" style="text-align:center" />
        </td>
        <td>
          <input type="number" class="item-input item-desc-val" data-i="${i}"
            value="${it.desconto}" min="0" step="0.01" style="text-align:right" />
        </td>
        <td class="item-total-cell ${total > 0 ? "positivo" : ""}" data-row-total="${i}">
          ${fmtBRL(total)}
        </td>
        <td>
          <button class="del-item-btn btn-icon danger" data-del-item="${i}">
            <i class="fi fi-rr-cross-small"></i>
          </button>
        </td>
      </tr>`;
  }

  #bindFormEvents() {
    const f = this.#form;

    ["#btn-voltar","#btn-voltar2"].forEach(sel =>
      this.$(sel)?.addEventListener("click", () => {
        this.#subView = "lista";
        this.refresh();
      })
    );
    ["#btn-salvar","#btn-salvar2"].forEach(sel =>
      this.$(sel)?.addEventListener("click", () => this.#salvar())
    );
    this.$("#btn-imprimir")?.addEventListener("click", () => this.#imprimir());

    // Campos
    const bind = (sel, prop) =>
      this.$(sel)?.addEventListener("input", e => { f[prop] = e.target.value; });
    const bindChange = (sel, prop) =>
      this.$(sel)?.addEventListener("change", e => { f[prop] = e.target.value; });
    bind("#f-cliente",  "clienteNome");
    bind("#f-vendedor", "vendedor");
    bind("#f-obs",      "observacoes");
    bindChange("#f-tipo",     "tipo");
    bindChange("#f-data",     "data");
    bindChange("#f-entrega",  "entrega");
    bindChange("#f-situacao", "situacao");

    // Autocomplete clientes
    const clientes = selectors.clientes().list || [];
    this.#bindAC("f-cliente", "ac-cli", clientes, (item, inp) => {
      inp.value = item.dataset.nome;
      f.clienteNome = item.dataset.nome;
    });

    // Itens
    const tbody = this.$("#tbody-itens");
    tbody?.addEventListener("input", e => {
      const tgt = e.target, i = parseInt(tgt.dataset.i);
      if (isNaN(i)) return;
      if (tgt.classList.contains("item-desc"))     f.itens[i].descricao = tgt.value;
      if (tgt.classList.contains("item-preco"))    { f.itens[i].preco    = tgt.value; this.#atualizarTotais(); }
      if (tgt.classList.contains("item-qtd"))      { f.itens[i].qtd      = tgt.value; this.#atualizarTotais(); }
      if (tgt.classList.contains("item-desc-val")) { f.itens[i].desconto = tgt.value; this.#atualizarTotais(); }
    });
    tbody?.addEventListener("click", e => {
      const del = e.target.closest("[data-del-item]");
      if (!del) return;
      f.itens.splice(parseInt(del.dataset.delItem), 1);
      if (!f.itens.length) f.itens.push(this.#novoItem());
      this.refresh();
    });
    this.$("#btn-add-item")?.addEventListener("click", () => {
      f.itens.push(this.#novoItem());
      this.refresh();
      setTimeout(() => {
        const inputs = this.$$(".item-desc");
        inputs[inputs.length - 1]?.focus();
      }, 50);
    });

    // Autocomplete produtos por linha
    const produtos = selectors.produtos().list || [];
    f.itens.forEach((_, i) => this.#bindProdutoAC(i, produtos));
  }

  #bindAC(inputId, listId, data, onSelect) {
    const inp  = this.$(`#${inputId}`);
    const list = this.$(`#${listId}`);
    if (!inp || !list) return;
    inp.addEventListener("input", () => {
      const q = inp.value.toLowerCase();
      if (!q) { list.style.display = "none"; return; }
      const m = data.filter(c => c.nome?.toLowerCase().includes(q)).slice(0, 7);
      if (!m.length) { list.style.display = "none"; return; }
      list.innerHTML = m.map(c => `<div class="ac-item" data-nome="${esc(c.nome)}">${esc(c.nome)}</div>`).join("");
      list.style.display = "block";
    });
    list.addEventListener("click", e => {
      const item = e.target.closest(".ac-item");
      if (!item) return;
      onSelect(item, inp);
      list.style.display = "none";
    });
  }

  #bindProdutoAC(i, produtos) {
    const inp  = this.$(`[data-i="${i}"].item-desc`);
    const list = this.$(`#ac-item-${i}`);
    if (!inp || !list) return;
    inp.addEventListener("input", () => {
      const q = inp.value.toLowerCase();
      if (!q) { list.style.display = "none"; return; }
      const m = produtos.filter(p => p.nome?.toLowerCase().includes(q)).slice(0, 7);
      if (!m.length) { list.style.display = "none"; return; }
      list.innerHTML = m.map(p =>
        `<div class="ac-item" data-nome="${esc(p.nome)}" data-preco="${p.preco_venda||0}">${esc(p.nome)}</div>`
      ).join("");
      list.style.display = "block";
    });
    list.addEventListener("click", e => {
      const item = e.target.closest(".ac-item");
      if (!item) return;
      inp.value = item.dataset.nome;
      this.#form.itens[i].descricao = item.dataset.nome;
      this.#form.itens[i].preco     = parseFloat(item.dataset.preco) || 0;
      const precoInp = this.$(`[data-i="${i}"].item-preco`);
      if (precoInp) precoInp.value = this.#form.itens[i].preco;
      this.#atualizarTotais();
      list.style.display = "none";
    });
  }

  #atualizarTotais() {
    const t = this.#calcularTotais();
    const set = (id, v) => { const el = this.$(`#${id}`); if (el) el.textContent = v; };
    set("r-desc",         fmtBRL(t.descontoTotal));
    set("r-total",        fmtBRL(t.totalGeral));
    set("r-total-bottom", fmtBRL(t.totalGeral));
    this.#form.itens.forEach((it, i) => {
      const tot = (Number(it.preco)||0) * (Number(it.qtd)||0) - (Number(it.desconto)||0);
      const el  = this.$(`[data-row-total="${i}"]`);
      if (el) {
        el.textContent = fmtBRL(tot);
        el.classList.toggle("positivo", tot > 0);
      }
    });
  }

  async #salvar() {
    const f = this.#form;
    try {
      const dados = {
        cliente_nome: f.clienteNome || null,
        vendedor:     f.vendedor    || null,
        tipo:         f.tipo,
        data_venda:   f.data,
        data_entrega: f.entrega     || null,
        status:       f.situacao,
        observacoes:  f.observacoes || null,
      };
      if (this.#vendaEditando) {
        await services.venda.atualizar(this.#vendaEditando.id, dados, f.itens);
      } else {
        await services.venda.criar(dados, f.itens);
      }
      this.#subView = "lista";
      this.#vendaEditando = null;
      this.refresh();
    } catch (e) {
      this.toast(e.message || "Erro ao salvar.", "erro");
    }
  }

  #imprimir() {
    const f = this.#form;
    const t = this.#calcularTotais();
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Venda</title>
      <style>body{font-family:Arial,sans-serif;padding:28px;font-size:13px}
      h2{margin:0 0 4px}p{margin:0 0 16px;color:#666;font-size:12px}
      table{width:100%;border-collapse:collapse}
      th{background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;font-size:12px}
      td{padding:8px 10px;border-bottom:1px solid #eee}
      .total{font-weight:bold;font-size:15px}</style>
    </head><body>
      <h2>Gráfica Master Print</h2>
      <p>Cliente: ${esc(f.clienteNome)||"—"} · Data: ${fmtData(f.data)}</p>
      <table><thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Desc.</th><th>Total</th></tr></thead>
      <tbody>${f.itens.filter(it=>it.descricao).map(it => {
        const tot = (Number(it.preco)||0)*(Number(it.qtd)||0)-(Number(it.desconto)||0);
        return `<tr><td>${esc(it.descricao)}</td><td>${Number(it.qtd).toFixed(3)}</td>
          <td>${fmtBRL(it.preco)}</td><td>${fmtBRL(it.desconto)}</td><td>${fmtBRL(tot)}</td></tr>`;
      }).join("")}
      <tr><td colspan="4" style="text-align:right;font-weight:700">TOTAL</td>
          <td class="total">${fmtBRL(t.totalGeral)}</td></tr>
      </tbody></table>
      ${f.observacoes ? `<p style="margin-top:16px"><b>Obs:</b> ${esc(f.observacoes)}</p>` : ""}
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  #calcularTotais() {
    return this.#form.itens.reduce((acc, it) => {
      const sub = (Number(it.preco)||0) * (Number(it.qtd)||0);
      acc.descontoTotal += Number(it.desconto) || 0;
      acc.totalGeral    += sub - (Number(it.desconto) || 0);
      return acc;
    }, { descontoTotal: 0, totalGeral: 0 });
  }

  #novoItem() { return { descricao: "", produtoId: null, preco: 0, qtd: 1.000, desconto: 0, obs: "" }; }
  #novoForm() {
    return {
      clienteNome: "", tipo: "Venda/O.S.", data: this.#hoje(),
      situacao: "pendente", entrega: "", vendedor: "",
      observacoes: "", itens: [this.#novoItem()],
    };
  }
  #hoje() { return new Date().toISOString().split("T")[0]; }
}

// ─── CSS Vendas ───────────────────────────────────────────────────────────────
function vendasCSS() { return `
.page-header{margin-bottom:12px!important}
.page-title{line-height:1.12!important}
.page-subtitle{margin:1px 0 0!important;line-height:1.2!important}
.vendas-kpis .kpi-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}
.vendas-kpis .kpi-card{display:grid;grid-template-columns:30px minmax(0,1fr);grid-template-areas:"icon value" "label sub";align-items:center;column-gap:9px;row-gap:2px;padding:10px 12px;min-height:54px}
.vendas-kpis .kpi-card:hover{transform:none}
.vendas-kpis .kpi-card::before{height:2px;background:var(--kpi-accent,var(--primary))}
.vendas-kpis .kpi-icon{grid-area:icon;width:28px;height:28px;margin:0;border-radius:var(--radius-sm);background:color-mix(in srgb,var(--kpi-accent,var(--primary)) 14%,transparent);display:flex;align-items:center;justify-content:center;font-size:14px}
.vendas-kpis .kpi-value{grid-area:value;margin:0;font-size:17px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vendas-kpis .kpi-label{grid-area:label;font-size:9.5px;line-height:1.1;white-space:nowrap}
.vendas-kpis .kpi-sub{grid-area:sub;margin:0;font-size:10px;line-height:1.1;text-align:right;white-space:nowrap}
@media(max-width:900px){.vendas-kpis .kpi-grid{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.vendas-kpis .kpi-grid{grid-template-columns:1fr}.vendas-kpis .kpi-card{grid-template-columns:28px 1fr auto;grid-template-areas:"icon value sub" "icon label label"}}
.venda-filtros{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.status-chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{padding:5px 12px;border-radius:999px;font-size:12px;font-weight:500;border:1px solid var(--border-md);background:transparent;color:var(--muted);cursor:pointer;transition:all var(--t);display:flex;align-items:center;gap:5px;font-family:var(--font)}
.chip:hover{background:var(--panel2);color:var(--text)}
.chip.active{background:color-mix(in srgb,var(--chip-cor,var(--primary)) 15%,transparent);border-color:var(--chip-cor,var(--primary));color:var(--chip-cor,var(--primary));font-weight:700}
.chip-dot{width:7px;height:7px;border-radius:50%}
.result-count{font-size:12px;color:var(--muted);margin-bottom:10px}
.num-cell{font-weight:700;color:var(--muted);font-size:12px}
.cli-cell-nome{font-weight:600;font-size:13px}
.cli-cell-obs{font-size:11px;color:var(--muted);margin-top:2px}
.sem-cliente{color:var(--muted);font-style:italic;font-weight:400}
.tipo-cell{font-size:12px;color:var(--muted)}
.data-cell{font-size:12px}
.total-cell{text-align:right;font-weight:700;color:var(--primary-light)}
.row-actions{display:flex;gap:4px;justify-content:flex-end}
.status-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--pill-cor) 15%,transparent);color:var(--pill-cor);border:1px solid color-mix(in srgb,var(--pill-cor) 30%,transparent)}
.status-pill-dot{width:6px;height:6px;border-radius:50%;background:var(--pill-cor)}
`; }

function formCSS() { return `
.itens-table-wrap{overflow-x:auto;border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:10px}
.itens-table{width:100%;border-collapse:collapse;font-size:13px}
.itens-table th{background:var(--panel);padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border)}
.itens-table td{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:middle}
.itens-table tr:last-child td{border-bottom:none}
.item-input{width:100%;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:7px 9px;font-size:13px;font-family:var(--font)}
.item-input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 2px rgba(0,196,154,0.12)}
.item-total-cell{text-align:right;font-weight:600;color:var(--muted)}
.item-total-cell.positivo{color:var(--primary-light)}
.del-item-btn{padding:4px 6px}
.tfoot-row td,.tfoot-total-row td{padding:8px 12px;border-top:1px solid var(--border-md)}
.tfoot-desc-label,.tfoot-total-label{text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.tfoot-desc-val{text-align:right;font-weight:700;color:var(--error)}
.tfoot-total-row{background:var(--primary-bg)}
.tfoot-total-label{color:var(--text)}
.tfoot-total-val{text-align:right;font-weight:800;font-size:16px;color:var(--primary-light)}
.btn-add-item-row{width:100%;padding:10px;border:1.5px dashed var(--border-md);background:transparent;color:var(--muted);border-radius:var(--radius-md);cursor:pointer;font-family:var(--font);font-size:13px;transition:all var(--t);display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px}
.btn-add-item-row:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-bg)}
.autocomplete-wrap{position:relative}
.autocomplete-list{display:none;position:absolute;top:100%;left:0;right:0;z-index:50;background:var(--panel);border:1px solid var(--border-md);border-radius:var(--radius-md);box-shadow:var(--shadow-md);max-height:180px;overflow-y:auto}
.ac-item{padding:9px 12px;font-size:13px;cursor:pointer;transition:background var(--t)}
.ac-item:hover{background:var(--primary-bg);color:var(--primary-light)}
.bottom-bar{position:sticky;bottom:0;background:var(--panel);border-top:1px solid var(--border);padding:12px 0;margin-top:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.bottom-total{font-size:14px;color:var(--muted)}
.bottom-total strong{color:var(--primary-light);font-size:20px;font-weight:800;margin-left:8px}
`; }

