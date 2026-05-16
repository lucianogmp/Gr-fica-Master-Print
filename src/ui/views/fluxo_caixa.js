/**
 * FLUXO DE CAIXA VIEW — Gestão de caixa físico.
 */

import { BaseView } from "./baseView.js";
import { services } from "../../core/services.js";
import { selectors, store, actions } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import {
  PageHeader, KpiGrid, DataTable, Btn, openModal,
  SearchBar, EmptyState, fmtBRL, esc,
} from "../components/index.js";

export class FluxoCaixaView extends BaseView {
  #filtroDia = new Date().toISOString().split("T")[0];
  #modalCtx = null;

  async _init() {
    await services.caixa.listar();
    await services.cliente.listar();
    await services.produto.listar();
    this.subscribe("caixa", () => this.refresh());
  }

  render() {
    const state = selectors.caixa();
    const movimentos = state.movimentos || [];
    const clientes = selectors.clientes().list || [];
    const produtos = selectors.produtos().list || [];

    const doDia = movimentos.filter(m => m.data === this.#filtroDia);

    let saldoCorrido = 0;
    const comSaldo = doDia.map(m => {
      const val = Number(m.valor);
      saldoCorrido += m.tipo === "entrada" ? val : -val;
      return { ...m, saldoCorrido };
    });

    const totalEntradas = doDia.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor), 0);
    const totalSaidas = doDia.filter(m => m.tipo === "saida").reduce((s, m) => s + Number(m.valor), 0);
    const saldoDia = totalEntradas - totalSaidas;

    const dataFormatada = new Date(this.#filtroDia + "T00:00:00")
      .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    return `
      <style>
        .cx-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:10px; }
        .cx-header-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .cx-header-actions input[type="date"] { background:var(--panel2); border:1px solid var(--border-md); color:var(--text); border-radius:var(--radius-md); padding:7px 10px; font-size:13px; width:auto; }
        .btn-entrada-cx { display:inline-flex; align-items:center; gap:6px; background:var(--info); color:#fff; border:none; border-radius:var(--radius-md); padding:8px 14px; font-family:var(--font); font-size:13px; font-weight:600; cursor:pointer; transition:all var(--t); }
        .btn-entrada-cx:hover { opacity:.88; }
        .btn-saida-cx { display:inline-flex; align-items:center; gap:6px; background:var(--error-bg); color:var(--error); border:1px solid var(--error-border); border-radius:var(--radius-md); padding:8px 14px; font-family:var(--font); font-size:13px; font-weight:600; cursor:pointer; transition:all var(--t); }
        .btn-saida-cx:hover { background:var(--error); color:#fff; }
        .btn-importar { display:inline-flex; align-items:center; gap:6px; background:var(--primary-bg); color:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); padding:8px 14px; font-family:var(--font); font-size:13px; font-weight:600; cursor:pointer; transition:all var(--t); }
        .btn-importar:hover { background:var(--primary); color:#fff; }
        .cx-kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
        @media(max-width:600px){ .cx-kpis { grid-template-columns:1fr; } }
        .cx-kpi { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px; }
        .cx-kpi.destaque { border-top:3px solid var(--primary); }
        .cx-kpi-label { font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
        .cx-kpi-val { font-size:22px; font-weight:800; line-height:1.1; margin:4px 0 2px; }
        .cx-kpi-val.entrada  { color:var(--info); }
        .cx-kpi-val.saida    { color:var(--error); }
        .cx-kpi-val.positivo { color:var(--info); }
        .cx-kpi-val.negativo { color:var(--error); }
        .cx-kpi-sub { font-size:11px; color:var(--muted); }
        .cx-table-wrap { overflow-x:auto; border-radius:var(--radius-lg); border:1px solid var(--border); background:var(--panel2); }
        .cx-table { width:100%; border-collapse:collapse; font-size:13px; }
        .cx-table th { text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); padding:10px 14px; background:var(--panel); border-bottom:1px solid var(--border); white-space:nowrap; }
        .cx-table td { padding:11px 14px; border-bottom:1px solid var(--border); vertical-align:middle; }
        .cx-table tr:last-child td { border-bottom:none; }
        .cx-row { transition:background var(--t); }
        .cx-row:hover td { background:rgba(0,124,190,0.04); }
        .cx-hora   { font-size:12px; color:var(--muted); font-variant-numeric:tabular-nums; }
        .cx-desc   { font-weight:600; font-size:13px; }
        .cx-sub    { font-size:11px; color:var(--muted); display:flex; align-items:center; gap:4px; margin-top:2px; }
        .cx-cliente{ font-size:12px; color:var(--muted); }
        .cx-valor  { font-weight:700; font-size:14px; font-variant-numeric:tabular-nums; }
        .cx-valor.entrada { color:var(--info); }
        .cx-valor.saida   { color:var(--error); }
        .cx-saldo  { font-weight:700; font-size:13px; text-align:right; font-variant-numeric:tabular-nums; }
        .cx-saldo.positivo { color:var(--text-sub); }
        .cx-saldo.negativo { color:var(--error); }
        .cx-acoes  { display:flex; gap:5px; justify-content:flex-end; }
        .cx-vazio  { text-align:center; padding:40px 20px; color:var(--muted); font-size:13px; }
        .tipo-pill { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; white-space:nowrap; }
        .tipo-pill.entrada { background:var(--info-bg);  color:var(--info); }
        .tipo-pill.saida   { background:var(--error-bg); color:var(--error); }
        .btn-icon-cx { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:var(--radius-sm); background:transparent; border:1px solid var(--border); color:var(--muted); cursor:pointer; font-size:12px; transition:all var(--t); }
        .btn-icon-cx:hover { border-color:var(--primary); color:var(--primary-light); background:var(--primary-bg); }
        .btn-icon-cx.danger:hover { border-color:var(--error-border); color:var(--error); background:var(--error-bg); }
        .modal-tipo-switch { display:flex; gap:0; border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--border-md); }
        .tipo-sw { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:9px; border:none; background:var(--panel2); color:var(--muted); font-family:var(--font); font-size:13px; font-weight:600; cursor:pointer; transition:all var(--t); }
        .tipo-sw.entrada.active { background:var(--info-bg); color:var(--info); }
        .tipo-sw.saida.active   { background:var(--error-bg); color:var(--error); }
        .preco-field { display:flex; align-items:center; background:var(--panel2); border:1px solid var(--border-md); border-radius:var(--radius-md); overflow:hidden; transition:border-color var(--t); }
        .preco-field:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px rgba(0,124,190,0.10); }
        .preco-field span { padding:0 10px; font-size:12px; font-weight:600; color:var(--muted); background:var(--panel); border-right:1px solid var(--border); display:flex; align-items:center; flex-shrink:0; }
        .preco-field input { border:none; background:transparent; flex:1; padding:9px 10px; font-size:13px; color:var(--text); font-family:var(--font); }
        .preco-field input:focus { outline:none; box-shadow:none; }
        .prod-search-wrap { display:flex; gap:8px; align-items:flex-start; }
        .prod-search-wrap .autocomplete-wrap { flex:1; }
        .btn-add-prod { display:inline-flex; align-items:center; gap:5px; flex-shrink:0; background:var(--success-bg); color:var(--success); border:1px solid var(--success-border); border-radius:var(--radius-md); padding:9px 12px; font-family:var(--font); font-size:12px; font-weight:600; cursor:pointer; transition:all var(--t); white-space:nowrap; margin-top:22px; }
        .btn-add-prod:hover { background:var(--success); color:#fff; }
        .autocomplete-wrap { position:relative; }
        .autocomplete-list { display:none; position:absolute; top:100%; left:0; right:0; z-index:50; background:var(--panel); border:1px solid var(--border-md); border-radius:var(--radius-md); box-shadow:var(--shadow-md); max-height:180px; overflow-y:auto; }
        .ac-item { padding:9px 12px; font-size:13px; cursor:pointer; transition:background var(--t); }
        .ac-item:hover { background:var(--primary-bg); color:var(--primary-light); }
        .imp-lista { display:flex; flex-direction:column; gap:6px; max-height:300px; overflow-y:auto; margin-bottom:4px; }
        .imp-item { display:flex; align-items:center; gap:12px; background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-md); padding:10px 14px; cursor:pointer; transition:border-color var(--t); }
        .imp-item:hover { border-color:var(--primary-border); }
        .imp-item input[type="checkbox"] { width:16px; height:16px; flex-shrink:0; cursor:pointer; accent-color:var(--primary); }
        .imp-info { flex:1; }
        .imp-valor { font-size:15px; font-weight:700; color:var(--info); white-space:nowrap; }
        .modal-title-row { border-left:4px solid var(--primary); padding-left:10px; margin-bottom:16px; transition:border-color .2s; }
      </style>

      <div class="cx-header">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Caixa Físico</h2>
          <span style="font-size:12px;color:var(--muted);text-transform:capitalize">${dataFormatada}</span>
        </div>
        <div class="cx-header-actions">
          <input type="date" id="filtro-dia" value="${this.#filtroDia}" title="Selecionar dia" />
          <button class="btn-importar" id="btn-importar" title="Importar vendas pagas em dinheiro">
            <i class="fi fi-rr-arrow-down-to-square"></i> Importar Vendas
          </button>
          <button class="btn-saida-cx" id="btn-saida">
            <i class="fi fi-rr-arrow-circle-down"></i> Saída
          </button>
          <button class="btn-entrada-cx" id="btn-entrada">
            <i class="fi fi-rr-arrow-circle-up"></i> Entrada
          </button>
        </div>
      </div>

      <div class="cx-kpis">
        <div class="cx-kpi">
          <div class="cx-kpi-label">Entradas do dia</div>
          <div class="cx-kpi-val entrada">${fmtBRL(totalEntradas)}</div>
          <div class="cx-kpi-sub">${doDia.filter(m=>m.tipo==="entrada").length} lançamento(s)</div>
        </div>
        <div class="cx-kpi">
          <div class="cx-kpi-label">Saídas do dia</div>
          <div class="cx-kpi-val saida">${fmtBRL(totalSaidas)}</div>
          <div class="cx-kpi-sub">${doDia.filter(m=>m.tipo==="saida").length} lançamento(s)</div>
        </div>
        <div class="cx-kpi destaque">
          <div class="cx-kpi-label">Saldo do caixa</div>
          <div class="cx-kpi-val ${saldoDia >= 0 ? "positivo" : "negativo"}">${fmtBRL(saldoDia)}</div>
          <div class="cx-kpi-sub">${saldoDia >= 0 ? "Positivo" : "Negativo"}</div>
        </div>
      </div>

      <div class="cx-table-wrap">
        <table class="cx-table">
          <thead>
            <tr>
              <th style="width:80px">Hora</th>
              <th style="width:110px">Tipo</th>
              <th>Descrição / Produto</th>
              <th style="width:160px">Cliente</th>
              <th style="text-align:right;width:130px">Valor</th>
              <th style="text-align:right;width:130px">Saldo</th>
              <th style="width:80px"></th>
            </tr>
          </thead>
          <tbody>
            ${comSaldo.length === 0
              ? `<tr><td colspan="7" class="cx-vazio">
                  <i class="fi fi-rr-inbox" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px"></i>
                  Nenhum lançamento neste dia.<br>
                  <span style="font-size:12px">Use os botões <strong>Entrada</strong> e <strong>Saída</strong> para registrar.</span>
                 </td></tr>`
              : comSaldo.map(m => `
                <tr class="cx-row ${m.tipo}">
                  <td class="cx-hora">${this.#formatHora(m.created_at)}</td>
                  <td>
                    <span class="tipo-pill ${m.tipo}">
                      ${m.tipo === "entrada"
                        ? `<i class="fi fi-rr-arrow-up"></i> Entrada`
                        : `<i class="fi fi-rr-arrow-down"></i> Saída`}
                    </span>
                  </td>
                  <td>
                    <div class="cx-desc">${esc(m.descricao)}</div>
                    ${m.origem === "venda" ? `<div class="cx-sub"><i class="fi fi-rr-shopping-cart"></i> Venda vinculada</div>` : ""}
                    ${m.observacoes ? `<div class="cx-sub">${esc(m.observacoes)}</div>` : ""}
                  </td>
                  <td class="cx-cliente">${esc(m.cliente_nome) || "—"}</td>
                  <td class="cx-valor ${m.tipo}">
                    ${m.tipo === "entrada" ? "+" : "−"}${fmtBRL(m.valor)}
                  </td>
                  <td class="cx-saldo ${m.saldoCorrido >= 0 ? "positivo" : "negativo"}">
                    ${fmtBRL(m.saldoCorrido)}
                  </td>
                  <td class="cx-acoes">
                    <button class="btn-icon-cx" data-edit="${m.id}" title="Editar">
                      <i class="fi fi-rr-pencil"></i>
                    </button>
                    <button class="btn-icon-cx danger" data-del="${m.id}" title="Excluir">
                      <i class="fi fi-rr-trash"></i>
                    </button>
                  </td>
                </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div id="modal-area"></div>
    `;
  }

  afterRender() {
    this.$("#filtro-dia")?.addEventListener("change", e => {
      this.#filtroDia = e.target.value;
      this.refresh();
    });
    this.$("#btn-entrada")?.addEventListener("click", () => this.#abrirModalLancamento("entrada"));
    this.$("#btn-saida")?.addEventListener("click", () => this.#abrirModalLancamento("saida"));
    this.$("#btn-importar")?.addEventListener("click", () => this.#abrirModalImportar());

    this.$$("[data-del]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm("Excluir este lançamento?")) return;
        await services.caixa.deletar(btn.dataset.del);
        this.refresh();
      })
    );
    this.$$("[data-edit]").forEach(btn =>
      btn.addEventListener("click", () => {
        const state = selectors.caixa();
        const m = state.movimentos?.find(x => x.id === btn.dataset.edit);
        if (m) this.#abrirModalLancamento(m.tipo, m);
      })
    );
  }

  #formatHora(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  async #abrirModalLancamento(tipo, dados = {}, ctx = null) {
    const state = selectors.caixa();
    const clientes = selectors.clientes().clientes || [];
    const produtos = selectors.produtos().produtos || [];

    const editando = !!dados.id;
    const isEnt = tipo === "entrada";
    const cor = isEnt ? "var(--info)" : "var(--error)";
    const icon = isEnt ? "fi-rr-arrow-up" : "fi-rr-arrow-down";

    const prodPreench = ctx?.produtoNome || dados.descricao || "";
    const clientePreench = ctx?.clienteNome || dados.cliente_nome || "";

    const modal = openModal({
      title: `<i class="fi ${icon}"></i> ${editando ? "Editar" : "Registrar"} ${isEnt ? "Entrada" : "Saída"}`,
      content: `
        <div class="modal-title-row" style="border-left:4px solid ${cor}">
          <h3 style="color:${cor};margin:0;font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px">
            <i class="fi ${icon}"></i>
            ${editando ? "Editar" : "Registrar"} ${isEnt ? "Entrada" : "Saída"}
          </h3>
        </div>

        <div class="modal-tipo-switch" style="margin-bottom:14px">
          <button class="tipo-sw ${isEnt ? "entrada active" : "entrada"}" data-sw="entrada">
            <i class="fi fi-rr-arrow-up"></i> Entrada
          </button>
          <button class="tipo-sw ${!isEnt ? "saida active" : "saida"}" data-sw="saida">
            <i class="fi fi-rr-arrow-down"></i> Saída
          </button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label>Data *</label>
            <input id="m-data" type="date" value="${dados.data || this.#filtroDia}" />
          </div>
          <div>
            <label>Valor (R$) *</label>
            <div class="preco-field">
              <span>R$</span>
              <input id="m-valor" type="number" min="0" step="0.01" value="${dados.valor || ""}" placeholder="0,00" autofocus />
            </div>
          </div>
        </div>

        <label>Produto / Descrição *</label>
        <div class="prod-search-wrap" style="margin-bottom:12px">
          <div class="autocomplete-wrap" style="flex:1">
            <input id="m-desc" value="${esc(prodPreench)}" placeholder="Buscar produto ou digitar livremente..." autocomplete="off" />
            <div class="autocomplete-list" id="ac-prod"></div>
          </div>
          <button class="btn-add-prod" id="btn-add-prod" title="Cadastrar novo produto">
            <i class="fi fi-rr-add"></i> Novo
          </button>
        </div>

        <label>Cliente <span style="font-size:11px;color:var(--muted2)">(opcional)</span></label>
        <div class="autocomplete-wrap" style="margin-bottom:12px">
          <input id="m-cliente" value="${esc(clientePreench)}" placeholder="Buscar cliente..." autocomplete="off" />
          <div class="autocomplete-list" id="ac-cli"></div>
        </div>

        <label>Observações <span style="font-size:11px;color:var(--muted2)">(opcional)</span></label>
        <textarea id="m-obs" rows="2" placeholder="Detalhe adicional, número de pedido...">${esc(dados.observacoes || "")}</textarea>
      `,
      buttons: [
        { text: "Cancelar", class: "btn-secondary", id: "m-cancel" },
        { text: `<i class="fi fi-rr-disk"></i> Salvar`, class: "btn-primary", id: "m-ok", style: `background:${cor};border-color:${cor}` }
      ]
    });

    let tipoAtual = tipo;
    modal.querySelectorAll("[data-sw]").forEach(btn =>
      btn.addEventListener("click", () => {
        tipoAtual = btn.dataset.sw;
        modal.querySelectorAll("[data-sw]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const nc = tipoAtual === "entrada" ? "var(--info)" : "var(--error)";
        modal.querySelector(".modal-title-row").style.borderColor = nc;
        modal.querySelector("h3").style.color = nc;
        modal.querySelector("#m-ok").style.background = nc;
        modal.querySelector("#m-ok").style.borderColor = nc;
      })
    );

    const mDesc = modal.querySelector("#m-desc");
    const acProd = modal.querySelector("#ac-prod");
    mDesc.addEventListener("input", () => {
      const q = mDesc.value.trim().toLowerCase();
      if (!q) { acProd.style.display = "none"; return; }
      const matches = produtos.filter(p => p.nome.toLowerCase().includes(q)).slice(0, 7);
      if (!matches.length) { acProd.style.display = "none"; return; }
      acProd.innerHTML = matches.map(p => `<div class="ac-item" data-nome="${esc(p.nome)}">${esc(p.nome)}</div>`).join("");
      acProd.style.display = "block";
    });
    acProd.addEventListener("click", e => {
      const it = e.target.closest(".ac-item"); if (!it) return;
      mDesc.value = it.dataset.nome; acProd.style.display = "none";
    });

    const mCli = modal.querySelector("#m-cliente");
    const acCli = modal.querySelector("#ac-cli");
    mCli.addEventListener("input", () => {
      const q = mCli.value.trim().toLowerCase();
      if (!q) { acCli.style.display = "none"; return; }
      const matches = clientes.filter(c => c.nome.toLowerCase().includes(q)).slice(0, 6);
      if (!matches.length) { acCli.style.display = "none"; return; }
      acCli.innerHTML = matches.map(c => `<div class="ac-item" data-nome="${esc(c.nome)}">${esc(c.nome)}</div>`).join("");
      acCli.style.display = "block";
    });
    acCli.addEventListener("click", e => {
      const it = e.target.closest(".ac-item"); if (!it) return;
      mCli.value = it.dataset.nome; acCli.style.display = "none";
    });

    modal.querySelector("#btn-add-prod").addEventListener("click", () => {
      const descAtual = mDesc.value.trim();
      const cliAtual = mCli.value.trim();
      const dataAtual = modal.querySelector("#m-data").value;
      const valAtual = modal.querySelector("#m-valor").value;
      const obsAtual = modal.querySelector("#m-obs").value;
      this.#modalCtx = { tipo: tipoAtual, descAtual, cliAtual, dataAtual, valAtual, obsAtual };
      modal.close();
      this.#abrirModalNovoProduto(descAtual);
    });

    modal.querySelector("#m-cancel").addEventListener("click", () => modal.close());
    modal.querySelector("#m-ok").addEventListener("click", async () => {
      const desc = modal.querySelector("#m-desc").value.trim();
      const valor = parseFloat(modal.querySelector("#m-valor").value);
      const data = modal.querySelector("#m-data").value;
      if (!desc) { this.#flashInput(modal.querySelector("#m-desc")); return; }
      if (!valor || valor <= 0) { this.#flashInput(modal.querySelector("#m-valor")); return; }
      if (!data) { this.#flashInput(modal.querySelector("#m-data")); return; }

      const payload = {
        tipo: tipoAtual, data,
        descricao: desc,
        cliente_nome: modal.querySelector("#m-cliente").value.trim() || null,
        valor,
        observacoes: modal.querySelector("#m-obs").value.trim() || null,
        origem: dados.origem || "manual",
      };

      if (editando) {
        await services.caixa.atualizar(dados.id, { ...payload, updated_at: new Date() });
      } else {
        await services.caixa.criar(payload);
      }

      modal.close();
      this.#filtroDia = data;
      this.refresh();
    });
  }

  async #abrirModalNovoProduto(nomeInicial = "") {
    const modal = openModal({
      title: `<i class="fi fi-rr-box-open" style="color:var(--primary)"></i> Cadastrar Produto`,
      content: `
        <p style="font-size:12px;color:var(--muted);margin:0 0 14px;background:var(--panel2);padding:10px 12px;border-radius:var(--radius-md);border-left:3px solid var(--primary)">
          Após salvar, o produto será selecionado automaticamente no lançamento.
        </p>
        <label>Nome do produto / serviço *</label>
        <input id="np-nome" value="${esc(nomeInicial)}" placeholder="Ex: Banner 1×2m, Cartão de visita..." autofocus />
        <label style="margin-top:12px">Preço de venda (R$) <span style="font-size:11px;color:var(--muted2)">opcional</span></label>
        <div class="preco-field">
          <span>R$</span>
          <input id="np-preco" type="number" min="0" step="0.01" placeholder="0,00" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          <div>
            <label>Categoria</label>
            <input id="np-cat" placeholder="Ex: Lona, Papel..." />
          </div>
          <div>
            <label>Unidade</label>
            <select id="np-un">
              ${["un","m²","m","folha","kg","rolo","caixa"].map(u => `<option value="${u}">${u}</option>`).join("")}
            </select>
          </div>
        </div>
      `,
      buttons: [
        { text: "← Voltar ao lançamento", class: "btn-secondary", id: "np-cancel" },
        { text: `<i class="fi fi-rr-add"></i> Cadastrar e selecionar`, class: "btn-primary", id: "np-ok" }
      ]
    });

    modal.querySelector("#np-cancel").addEventListener("click", () => {
      const ctx = this.#modalCtx || {};
      modal.close();
      this.#abrirModalLancamento(ctx.tipo || "entrada", {
        data: ctx.dataAtual, valor: ctx.valAtual, observacoes: ctx.obsAtual,
      }, { produtoNome: ctx.descAtual, clienteNome: ctx.cliAtual });
    });

    modal.querySelector("#np-ok").addEventListener("click", async () => {
      const nome = modal.querySelector("#np-nome").value.trim();
      if (!nome) { this.#flashInput(modal.querySelector("#np-nome")); return; }
      const preco = parseFloat(modal.querySelector("#np-preco").value) || null;
      const catNome = modal.querySelector("#np-cat").value.trim();
      
      await services.produto.criar({
        nome,
        preco_venda: preco,
        categoria: catNome || null,
        unidade: modal.querySelector("#np-un").value
      });

      const ctx = this.#modalCtx || {};
      modal.close();
      this.#abrirModalLancamento(ctx.tipo || "entrada", {
        data: ctx.dataAtual, valor: ctx.valAtual, observacoes: ctx.obsAtual,
      }, { produtoNome: nome, clienteNome: ctx.cliAtual });
    });
  }

  async #abrirModalImportar() {
    const modal = openModal({
      title: `<i class="fi fi-rr-arrow-down-to-square" style="color:var(--primary)"></i> Importar Vendas para o Caixa`,
      content: `<p style="font-size:12px;color:var(--muted);margin:0 0 14px">Carregando vendas disponíveis...</p>`
    });

    const vendas = await services.venda.listar();
    const state = selectors.caixa();
    const vendaIdsImportadas = new Set((state.movimentos || []).filter(m => m.venda_id).map(m => m.venda_id));
    const disponiveis = (vendas || []).filter(v => !vendaIdsImportadas.has(v.id) && ["entregue", "pronto"].includes(v.status));

    modal.querySelector(".modal-body").innerHTML = `
      <p style="font-size:12px;color:var(--muted);margin:0 0 14px;line-height:1.5">
        Selecione as vendas pagas em dinheiro físico para lançar no caixa.
      </p>
      ${disponiveis.length === 0
        ? `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">
            <i class="fi fi-rr-check-circle" style="font-size:24px;color:var(--info);display:block;margin-bottom:8px"></i>
            Nenhuma venda pendente de importação.
           </div>`
        : `<div class="imp-lista">
            ${disponiveis.map(v => {
              const data = new Date(v.created_at).toLocaleDateString("pt-BR");
              return `
                <label class="imp-item">
                  <input type="checkbox" class="imp-chk" data-id="${v.id}"
                    data-cliente="${esc(v.cliente_nome||"")}"
                    data-total="${v.total}"
                    data-desc="${esc(v.tipo||"Venda")} — ${esc(v.cliente_nome||"Sem cliente")}"
                    data-data="${v.created_at?.slice(0,10)||this.#filtroDia}" />
                  <div class="imp-info">
                    <div style="font-weight:600">${esc(v.cliente_nome)||"Sem cliente"}</div>
                    <div style="font-size:12px;color:var(--muted)">${data} · ${v.tipo||"Venda/O.S."}</div>
                  </div>
                  <div class="imp-valor">${fmtBRL(v.total||0)}</div>
                </label>`;
            }).join("")}
           </div>`}
    `;

    modal.querySelector("#imp-cancel")?.addEventListener("click", () => modal.close());
    modal.querySelector("#imp-ok")?.addEventListener("click", async () => {
      const selecionadas = [...modal.querySelectorAll(".imp-chk:checked")];
      if (!selecionadas.length) { alert("Selecione ao menos uma venda."); return; }
      const inserts = selecionadas.map(chk => ({
        tipo: "entrada", data: chk.dataset.data || this.#filtroDia,
        descricao: chk.dataset.desc, cliente_nome: chk.dataset.cliente || null,
        valor: parseFloat(chk.dataset.total) || 0, venda_id: chk.dataset.id, origem: "venda",
      }));
      for (const insert of inserts) {
        await services.caixa.criar(insert);
      }
      modal.close();
      this.refresh();
    });
  }

  #flashInput(el) {
    if (!el) return;
    el.style.borderColor = "var(--error)";
    el.focus();
    setTimeout(() => el.style.borderColor = "", 1500);
  }
}
