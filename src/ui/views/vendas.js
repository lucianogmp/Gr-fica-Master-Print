/**
 * VENDAS VIEW — Tela de vendas refatorada com arquitetura em camadas.
 * View → Service → Repository → Supabase
 */

import { BaseView } from "./baseView.js";
import { services } from "../../core/services.js";
import { store, selectors, actions } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import {
  PageHeader, KpiGrid, Tabs, DataTable, Btn, StatusBadge,
  openModal, SearchBar, EmptyState, fmtBRL, fmtData, esc,
} from "../components/index.js";

const SITUACOES = [
  { id: "pendente",    label: "Pendente",    cor: "#F79009" },
  { id: "em_execucao", label: "Em execução", cor: "#007CBE" },
  { id: "pronto",      label: "Pronto",      cor: "#0008FF" },
  { id: "entregue",    label: "Entregue",    cor: "#00AC17" },
  { id: "cancelado",   label: "Cancelado",   cor: "#AB0000" },
];

const TIPOS_VENDA = ["Venda/O.S.", "Orçamento", "Consignação", "Troca"];

export class VendasView extends BaseView {
  #subView = "lista"; // "lista" | "form"
  #vendaEditando = null;
  #form = null;

  async _init() {
    this.#form = this.#novoForm();

    // Carrega dados
    await services.venda.listar(selectors.vendas().filters);

    // Carrega lookups em paralelo
    await Promise.allSettled([
      services.cliente.listar(),
      services.config.carregar(),
    ]);

    // Reatividade: quando vendas mudam no store, atualiza a lista
    this.subscribe("vendas", () => {
      if (this.#subView === "lista") this.refresh();
    });

    // Quando uma venda é criada/atualizada de outro módulo
    this.listenTo(EVENTS.VENDA_CRIADA,     () => services.venda.listar());
    this.listenTo(EVENTS.VENDA_ATUALIZADA, () => services.venda.listar());
  }

  render() {
    return this.#subView === "form" ? this.#renderForm() : this.#renderLista();
  }

  afterRender() {
    if (this.#subView === "lista") this.#bindListaEvents();
    else this.#bindFormEvents();
  }

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

    const filtradas = list.filter(v => {
      const matchStatus = !filtro.status || v.status === filtro.status;
      const matchBusca  = !filtro.search ||
        (v.cliente_nome || "").toLowerCase().includes(filtro.search.toLowerCase());
      return matchStatus && matchBusca;
    });

    return `
      ${PageHeader({
        title: "Vendas",
        subtitle: `${list.length} venda${list.length !== 1 ? "s" : ""} · ${fmtBRL(total)}`,
        actions: Btn.primary('<i class="fi fi-rr-add"></i> Nova Venda', "btn-nova-venda"),
      })}

      ${KpiGrid([
        { label: "Faturamento", value: fmtBRL(total),     color: "var(--primary-light)",  icon: "💰" },
        { label: "Pendentes",   value: pendentes,          color: "var(--warning)",         icon: "⏳" },
        { label: "Em execução", value: emExecucao,         color: "var(--primary-light)",   icon: "🔄" },
        { label: "Entregues",   value: entregues,          color: "var(--success)",          icon: "✅" },
      ])}

      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:220px;max-width:340px">
          ${SearchBar({ id: "busca-vendas", placeholder: "Buscar por cliente...", value: filtro.search })}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="tab-btn ${!filtro.status ? "active" : ""}" data-filtro-status="">Todas</button>
          ${SITUACOES.map(s => `
            <button class="tab-btn ${filtro.status === s.id ? "active" : ""}" data-filtro-status="${s.id}"
              style="${filtro.status === s.id ? `border-color:${s.cor};color:${s.cor};background:${s.cor}12` : ""}">
              <span style="width:7px;height:7px;background:${s.cor};border-radius:50%;display:inline-block"></span>
              ${s.label}
            </button>`).join("")}
        </div>
      </div>

      ${DataTable({
        columns: [
          { label: "#",        style: "width:60px" },
          { label: "Cliente" },
          { label: "Tipo",     style: "width:130px" },
          { label: "Data",     style: "width:100px" },
          { label: "Entrega",  style: "width:100px" },
          { label: "Situação", style: "width:130px" },
          { label: "Total",    style: "text-align:right;width:120px" },
          { label: "",         style: "width:80px" },
        ],
        rows: filtradas.length === 0 ? [] : filtradas.map((v, i) => {
          const sit = SITUACOES.find(s => s.id === v.status) || SITUACOES[0];
          const data = v.created_at ? new Date(v.created_at).toLocaleDateString("pt-BR") : "—";
          return `
            <tr class="clickable" data-abrir="${v.id}">
              <td style="font-weight:700;color:var(--muted);font-size:12px">${String(filtradas.length - i).padStart(3, "0")}</td>
              <td><strong>${esc(v.cliente_nome) || "Sem cliente"}</strong></td>
              <td style="font-size:12px;color:var(--muted)">${esc(v.tipo || "Venda/O.S.")}</td>
              <td style="font-size:12px">${data}</td>
              <td style="font-size:12px;color:var(--muted)">${v.data_entrega ? fmtData(v.data_entrega) : "—"}</td>
              <td>
                <span class="status-badge" style="background:${sit.cor}20;color:${sit.cor};border:1px solid ${sit.cor}40">
                  ${sit.label}
                </span>
              </td>
              <td style="text-align:right;font-weight:700;color:var(--primary-light)">${fmtBRL(v.total || 0)}</td>
              <td>
                <div style="display:flex;gap:4px">
                  ${Btn.icon('<i class="fi fi-rr-pencil"></i>', `edit-${v.id}`)}
                  ${Btn.icon('<i class="fi fi-rr-trash"></i>', `del-${v.id}`, true)}
                </div>
              </td>
            </tr>`;
        }),
        emptyMessage: "Nenhuma venda. Clique em \"Nova Venda\" para começar.",
      })}
    `;
  }

  #bindListaEvents() {
    this.$(`#btn-nova-venda`)?.addEventListener("click", () => {
      this.#vendaEditando = null;
      this.#form = this.#novoForm();
      this.#subView = "form";
      this.refresh();
    });

    this.$(`#busca-vendas`)?.addEventListener("input", e => {
      actions.setVendasFiltro({ search: e.target.value });
    });

    this.$$("[data-filtro-status]").forEach(btn => {
      btn.addEventListener("click", () => {
        actions.setVendasFiltro({ status: btn.dataset.filtroStatus });
      });
    });

    this.$$("[data-abrir]").forEach(row => {
      row.addEventListener("click", async (e) => {
        if (e.target.closest("button")) return;
        await this.#abrirVenda(row.dataset.abrir);
      });
    });

    selectors.vendas().list.forEach(v => {
      this.$(`#edit-${v.id}`)?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.#abrirVenda(v.id);
      });

      this.$(`#del-${v.id}`)?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Excluir venda de "${v.cliente_nome || "este cliente"}"?`)) return;
        await services.venda.deletar(v.id);
      });
    });
  }

  async #abrirVenda(id) {
    const venda = await services.venda.buscarPorId(id);
    this.#vendaEditando = venda;
    this.#form = {
      clienteNome:     venda.cliente_nome || "",
      tipo:            venda.tipo || "Venda/O.S.",
      data:            venda.data_venda || this.#hoje(),
      situacao:        venda.status || "pendente",
      entrega:         venda.data_entrega || "",
      palavraChave:    venda.palavra_chave || "",
      vendedor:        venda.vendedor || "",
      consumidorFinal: venda.consumidor_final !== false,
      observacoes:     venda.observacoes || "",
      itens: (venda.venda_itens || []).map(i => ({
        descricao: i.descricao, produtoId: i.produto_id,
        preco: Number(i.preco_unitario), qtd: Number(i.quantidade),
        desconto: Number(i.desconto || 0), obs: i.obs || "",
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
    const f = this.#form;
    const t = this.#calcularTotais();
    const isEdit = !!this.#vendaEditando;

    return `
      ${PageHeader({
        title: isEdit ? `Editar Venda #${this.#vendaEditando?.numero || ""}` : "Nova Venda",
        actions: `
          ${Btn.secondary('<i class="fi fi-rr-clock"></i> Histórico', "btn-historico")}
          ${Btn.ghost('<i class="fi fi-rr-print"></i> Imprimir', "btn-imprimir")}
          ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar', "btn-salvar")}
          ${Btn.secondary("← Voltar", "btn-voltar")}
        `,
      })}

      <!-- Dados principais -->
      <div class="ds-card">
        <div class="ds-card-title"><i class="fi fi-rr-file-invoice"></i> Dados da Venda</div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="form-field full">
            <label>Cliente</label>
            <div class="autocomplete-wrap">
              <input id="f-cliente" value="${esc(f.clienteNome)}" placeholder="Buscar cliente..." autocomplete="off" />
              <div class="autocomplete-list" id="ac-cli"></div>
            </div>
          </div>
          <div class="form-field">
            <label>Tipo</label>
            <select id="f-tipo">${TIPOS_VENDA.map(t => `<option ${f.tipo === t ? "selected" : ""}>${t}</option>`).join("")}</select>
          </div>
          <div class="form-field">
            <label>Data</label>
            <input id="f-data" type="date" value="${f.data}" />
          </div>
          <div class="form-field">
            <label>Vendedor</label>
            <input id="f-vendedor" value="${esc(f.vendedor)}" placeholder="Nome do vendedor" />
          </div>
          <div class="form-field">
            <label>Situação</label>
            <select id="f-situacao">
              ${SITUACOES.map(s => `<option value="${s.id}" ${f.situacao === s.id ? "selected" : ""}>${s.label}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Data de entrega</label>
            <input id="f-entrega" type="date" value="${f.entrega}" />
          </div>
        </div>
      </div>

      <!-- Itens -->
      <div class="ds-card">
        <div class="ds-card-title"><i class="fi fi-rr-shopping-cart"></i> Itens</div>
        <div style="overflow-x:auto;border-radius:var(--radius-md);border:1px solid var(--border)">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--panel)">
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border)">Produto / Serviço</th>
                <th style="padding:9px 12px;text-align:right;width:120px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border)">Preço R$</th>
                <th style="padding:9px 12px;text-align:center;width:90px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border)">Qtd</th>
                <th style="padding:9px 12px;text-align:right;width:110px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border)">Desconto</th>
                <th style="padding:9px 12px;text-align:right;width:110px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border)">Total</th>
                <th style="width:32px;border-bottom:1px solid var(--border)"></th>
              </tr>
            </thead>
            <tbody id="tbody-itens">
              ${f.itens.map((it, i) => this.#renderItemRow(it, i)).join("")}
            </tbody>
            <tfoot>
              <tr style="background:var(--panel)">
                <td colspan="3" style="padding:10px 12px;text-align:right;font-size:12px;font-weight:700;color:var(--muted)">TOTAL</td>
                <td style="padding:10px 12px;text-align:right;font-weight:700;color:var(--error)" id="r-desc">${fmtBRL(t.descontoTotal)}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:800;font-size:15px;color:var(--primary-light)" id="r-total">${fmtBRL(t.totalGeral)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <button class="btn btn-ghost" id="btn-add-item" style="margin-top:10px;border:1px dashed var(--border-md)">
          <i class="fi fi-rr-add"></i> Adicionar item
        </button>
      </div>

      <!-- Observações -->
      <div class="ds-card">
        <div class="ds-card-title"><i class="fi fi-rr-comment"></i> Observações</div>
        <textarea id="f-obs" rows="3" placeholder="Detalhes do pedido...">${esc(f.observacoes)}</textarea>
      </div>

      <!-- Total fixo no bottom -->
      <div style="position:sticky;bottom:0;background:var(--panel);border-top:1px solid var(--border);padding:12px 0;margin-top:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <span style="font-size:14px;color:var(--muted)">Total: <strong style="color:var(--primary-light);font-size:18px" id="r-total-bottom">${fmtBRL(t.totalGeral)}</strong></span>
        <div style="display:flex;gap:8px">
          ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar', "btn-salvar2")}
          ${Btn.secondary("Voltar", "btn-voltar2")}
        </div>
      </div>
    `;
  }

  #renderItemRow(it, i) {
    const total = (Number(it.preco) || 0) * (Number(it.qtd) || 0) - (Number(it.desconto) || 0);
    return `
      <tr data-row="${i}" style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 10px">
          <div class="autocomplete-wrap">
            <input class="item-desc" data-i="${i}" value="${esc(it.descricao)}"
              placeholder="Produto ou serviço..."
              style="width:100%;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:7px 9px;font-size:13px" />
            <div class="autocomplete-list" id="ac-item-${i}"></div>
          </div>
        </td>
        <td style="padding:7px 10px;text-align:right">
          <input type="number" class="item-preco" data-i="${i}" value="${it.preco}"
            style="width:100%;text-align:right;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:7px 9px;font-size:13px" />
        </td>
        <td style="padding:7px 10px;text-align:center">
          <input type="number" class="item-qtd" data-i="${i}" value="${Number(it.qtd).toFixed(3)}" min="0.001" step="0.001"
            style="width:100%;text-align:center;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:7px 9px;font-size:13px" />
        </td>
        <td style="padding:7px 10px;text-align:right">
          <input type="number" class="item-desc-val" data-i="${i}" value="${it.desconto}" min="0" step="0.01"
            style="width:100%;text-align:right;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:7px 9px;font-size:13px" />
        </td>
        <td style="padding:7px 10px;text-align:right;font-weight:700;color:${total > 0 ? "var(--primary-light)" : "var(--muted)"}" data-row-total="${i}">${fmtBRL(total)}</td>
        <td style="padding:7px 10px">
          <button class="del-item btn-icon danger" data-del-item="${i}" style="padding:4px 7px">✕</button>
        </td>
      </tr>`;
  }

  #bindFormEvents() {
    const f = this.#form;

    // Voltar
    ["#btn-voltar", "#btn-voltar2"].forEach(sel => {
      this.$(sel)?.addEventListener("click", () => {
        this.#subView = "lista";
        this.refresh();
      });
    });

    // Histórico
    ["#btn-historico"].forEach(sel => {
      this.$(sel)?.addEventListener("click", () => {
        this.#subView = "lista";
        this.refresh();
      });
    });

    // Salvar
    ["#btn-salvar", "#btn-salvar2"].forEach(sel => {
      this.$(sel)?.addEventListener("click", () => this.#salvar());
    });

    // Imprimir
    this.$("#btn-imprimir")?.addEventListener("click", () => this.#imprimir());

    // Campos simples
    const bind = (sel, prop) => {
      this.$(sel)?.addEventListener("input", e => { f[prop] = e.target.value; });
    };
    const bindChange = (sel, prop) => {
      this.$(sel)?.addEventListener("change", e => { f[prop] = e.target.value; });
    };
    bind("#f-cliente", "clienteNome");
    bind("#f-vendedor", "vendedor");
    bind("#f-obs", "observacoes");
    bindChange("#f-tipo", "tipo");
    bindChange("#f-data", "data");
    bindChange("#f-entrega", "entrega");
    bindChange("#f-situacao", "situacao");

    // Autocomplete cliente
    const clientes = selectors.clientes().list;
    this.#bindAC("f-cliente", "ac-cli", clientes,
      (item, inp) => { inp.value = item.dataset.nome; f.clienteNome = item.dataset.nome; }
    );

    // Itens
    const tbody = this.$("#tbody-itens");
    tbody?.addEventListener("input", e => {
      const t = e.target, i = parseInt(t.dataset.i);
      if (isNaN(i)) return;
      if (t.classList.contains("item-desc"))    f.itens[i].descricao = t.value;
      if (t.classList.contains("item-preco"))   { f.itens[i].preco = t.value; this.#atualizarTotais(); }
      if (t.classList.contains("item-qtd"))     { f.itens[i].qtd = t.value; this.#atualizarTotais(); }
      if (t.classList.contains("item-desc-val")){ f.itens[i].desconto = t.value; this.#atualizarTotais(); }
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

    // Autocomplete produtos para cada item
    const produtos = selectors.produtos().list;
    f.itens.forEach((_, i) => {
      this.#bindProdutoAC(i, produtos);
    });
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
      list.innerHTML = m.map(p => `<div class="ac-item" data-nome="${esc(p.nome)}" data-preco="${p.preco_venda || p.preco || 0}">${esc(p.nome)}</div>`).join("");
      list.style.display = "block";
    });
    list.addEventListener("click", e => {
      const item = e.target.closest(".ac-item");
      if (!item) return;
      inp.value = item.dataset.nome;
      this.#form.itens[i].descricao = item.dataset.nome;
      this.#form.itens[i].preco = parseFloat(item.dataset.preco) || 0;
      const precoInp = this.$(`[data-i="${i}"].item-preco`);
      if (precoInp) precoInp.value = this.#form.itens[i].preco;
      this.#atualizarTotais();
      list.style.display = "none";
    });
  }

  #atualizarTotais() {
    const t = this.#calcularTotais();
    const set = (id, v) => { const el = this.$(`#${id}`); if (el) el.textContent = v; };
    set("r-desc", fmtBRL(t.descontoTotal));
    set("r-total", fmtBRL(t.totalGeral));
    set("r-total-bottom", fmtBRL(t.totalGeral));
    this.#form.itens.forEach((it, i) => {
      const tot = (Number(it.preco) || 0) * (Number(it.qtd) || 0) - (Number(it.desconto) || 0);
      const el  = this.$(`[data-row-total="${i}"]`);
      if (el) { el.textContent = fmtBRL(tot); el.style.color = tot > 0 ? "var(--primary-light)" : "var(--muted)"; }
    });
  }

  async #salvar() {
    const f = this.#form;
    const itensValidos = f.itens.filter(it => it.descricao?.trim());
    if (!itensValidos.length) { this.toast("Adicione ao menos um item.", "warn"); return; }

    const dados = {
      cliente_nome:     f.clienteNome || null,
      vendedor:         f.vendedor || null,
      tipo:             f.tipo,
      data_venda:       f.data,
      data_entrega:     f.entrega || null,
      status:           f.situacao,
      consumidor_final: f.consumidorFinal,
      palavra_chave:    f.palavraChave || null,
      observacoes:      f.observacoes || null,
    };

    try {
      if (this.#vendaEditando) {
        await services.venda.atualizar(this.#vendaEditando.id, dados, itensValidos);
      } else {
        await services.venda.criar(dados, itensValidos);
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
      table{width:100%;border-collapse:collapse}th{background:#283D3B;color:#fff;padding:7px 10px;text-align:left}
      td{padding:7px 10px;border-bottom:1px solid #eee}.tr{font-weight:bold;background:#f5f5f5}</style>
    </head><body>
      <h2>Gráfica Master Print</h2>
      <p><strong>Cliente:</strong> ${esc(f.clienteNome) || "—"} · <strong>Data:</strong> ${fmtData(f.data)}</p>
      <table><thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Desc.</th><th>Total</th></tr></thead>
      <tbody>${f.itens.filter(it => it.descricao).map(it => {
        const tot = (Number(it.preco) || 0) * (Number(it.qtd) || 0) - (Number(it.desconto) || 0);
        return `<tr><td>${esc(it.descricao)}</td><td>${Number(it.qtd).toFixed(3)}</td><td>${fmtBRL(it.preco)}</td><td>${fmtBRL(it.desconto)}</td><td>${fmtBRL(tot)}</td></tr>`;
      }).join("")}
      <tr class="tr"><td colspan="4" style="text-align:right">TOTAL</td><td>${fmtBRL(t.totalGeral)}</td></tr>
      </tbody></table>
      ${f.observacoes ? `<p><strong>Obs:</strong> ${esc(f.observacoes)}</p>` : ""}
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  #calcularTotais() {
    return this.#form.itens.reduce((acc, it) => {
      const sub = (Number(it.preco) || 0) * (Number(it.qtd) || 0);
      acc.descontoTotal += Number(it.desconto) || 0;
      acc.totalGeral    += sub - (Number(it.desconto) || 0);
      return acc;
    }, { descontoTotal: 0, totalGeral: 0 });
  }

  #novoItem() { return { descricao: "", produtoId: null, preco: 0, qtd: 1.000, desconto: 0, obs: "" }; }
  #novoForm() {
    return {
      clienteNome: "", tipo: "Venda/O.S.", data: this.#hoje(),
      situacao: "pendente", entrega: "", palavraChave: "",
      vendedor: "", consumidorFinal: true, observacoes: "",
      itens: [this.#novoItem()],
    };
  }
  #hoje() { return new Date().toISOString().split("T")[0]; }
}
