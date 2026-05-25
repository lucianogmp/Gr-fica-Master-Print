/**
 * FLUXO DE CAIXA VIEW — Gestão de caixa físico.
 * Corrigido: openModal usa body/actions (não content/buttons),
 * close() funciona, modais não fecham sozinhos, querySelector robusto.
 */

import { BaseView } from "./baseView.js";
import { services } from "../../core/services.js";
import { selectors } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import {
  PageHeader, KpiGrid, DataTable, Btn, openModal,
  SearchBar, EmptyState, fmtBRL, esc,
} from "../components/index.js";

export class FluxoCaixaView extends BaseView {
  #filtroDia = new Date().toISOString().split("T")[0];
  #modalCtx  = null;

  async _init() {
    await services.caixa.listar();
    await services.cliente.listar();
    await services.produto.listar();
    this.subscribe("caixa", () => this.refresh());
  }

  render() {
    const movimentos = selectors.caixa().movimentos || [];
    const doDia      = movimentos.filter(m => m.data === this.#filtroDia);

    let saldoCorrido = 0;
    const comSaldo = doDia.map(m => {
      const val = Number(m.valor);
      saldoCorrido += m.tipo === "entrada" ? val : -val;
      return { ...m, saldoCorrido };
    });

    const totalEntradas = doDia.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor), 0);
    const totalSaidas   = doDia.filter(m => m.tipo === "saida").reduce((s, m)   => s + Number(m.valor), 0);
    const saldoDia      = totalEntradas - totalSaidas;

    const dataFormatada = new Date(this.#filtroDia + "T00:00:00")
      .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    return `
      <style>${cxCSS()}</style>

      <div class="cx-header">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Caixa Físico</h2>
          <span style="font-size:12px;color:var(--muted);text-transform:capitalize">${dataFormatada}</span>
        </div>
        <div class="cx-header-actions">
          <input type="date" id="filtro-dia" value="${this.#filtroDia}" title="Selecionar dia" />
          <button class="btn-importar" id="btn-importar">
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
              <th style="width:150px">Cliente</th>
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
                  <span style="font-size:11px">Use os botões <strong>Entrada</strong> e <strong>Saída</strong>.</span>
                 </td></tr>`
              : comSaldo.map(m => `
                <tr class="cx-row">
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
    `;
  }

  afterRender() {
    this.$("#filtro-dia")?.addEventListener("change", e => {
      this.#filtroDia = e.target.value;
      this.refresh();
    });
    this.$("#btn-entrada")?.addEventListener("click",  () => this.#abrirModalLancamento("entrada"));
    this.$("#btn-saida")?.addEventListener("click",    () => this.#abrirModalLancamento("saida"));
    this.$("#btn-importar")?.addEventListener("click", () => this.#abrirModalImportar());

    this.$$("[data-del]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm("Excluir este lançamento?")) return;
        try { await services.caixa.deletar(btn.dataset.del); }
        catch (e) { this.toast(e.message, "erro"); }
      })
    );
    this.$$("[data-edit]").forEach(btn =>
      btn.addEventListener("click", () => {
        const m = selectors.caixa().movimentos?.find(x => x.id === btn.dataset.edit);
        if (m) this.#abrirModalLancamento(m.tipo, m);
      })
    );
  }

  #formatHora(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL LANÇAMENTO
  // ══════════════════════════════════════════════════════════════════════════
  #abrirModalLancamento(tipo, dados = {}, ctx = null) {
    const clientes  = selectors.clientes().list || [];
    const produtos  = selectors.produtos().list || [];
    const editando  = !!dados.id;
    const isEnt     = tipo === "entrada";
    const cor       = isEnt ? "var(--primary)" : "var(--error)";

    const prodPreench   = ctx?.produtoNome   || dados.descricao     || "";
    const clientePreench = ctx?.clienteNome  || dados.cliente_nome  || "";

    // ── Monta o modal ──────────────────────────────────────────────────────
    const modalPanel = openModal({
      title:    `<i class="fi fi-rr-arrow-${isEnt?"up":"down"}" style="color:${cor}"></i> ${editando?"Editar":"Registrar"} ${isEnt?"Entrada":"Saída"}`,
      maxWidth: "520px",
      body: `
        <div class="cx-tipo-switch" style="margin-bottom:14px">
          <button class="cx-tipo-btn ${isEnt?"ent active":"ent"}" data-sw="entrada">
            <i class="fi fi-rr-arrow-up"></i> Entrada
          </button>
          <button class="cx-tipo-btn ${!isEnt?"sai active":"sai"}" data-sw="saida">
            <i class="fi fi-rr-arrow-down"></i> Saída
          </button>
        </div>

        <div class="form-grid" style="grid-template-columns:1fr 1fr;margin-bottom:12px">
          <div class="form-field">
            <label>Data *</label>
            <input id="m-data" type="date" value="${dados.data || this.#filtroDia}" />
          </div>
          <div class="form-field">
            <label>Valor (R$) *</label>
            <div class="preco-field">
              <span>R$</span>
              <input id="m-valor" type="number" min="0" step="0.01"
                     value="${dados.valor || ""}" placeholder="0,00" />
            </div>
          </div>
        </div>

        <div class="form-field" style="margin-bottom:12px">
          <label>Produto / Descrição *</label>
          <div class="autocomplete-wrap">
            <input id="m-desc" value="${esc(prodPreench)}"
                   placeholder="Buscar produto ou digitar livremente..." autocomplete="off" />
            <div class="autocomplete-list" id="ac-prod-cx"></div>
          </div>
        </div>

        <div class="form-field" style="margin-bottom:12px">
          <label>Cliente <span style="font-size:10px;color:var(--muted2)">(opcional)</span></label>
          <div class="autocomplete-wrap">
            <input id="m-cliente" value="${esc(clientePreench)}"
                   placeholder="Buscar cliente..." autocomplete="off" />
            <div class="autocomplete-list" id="ac-cli-cx"></div>
          </div>
        </div>

        <div class="form-field">
          <label>Observações <span style="font-size:10px;color:var(--muted2)">(opcional)</span></label>
          <textarea id="m-obs" rows="2"
                    placeholder="Detalhe, número de pedido...">${esc(dados.observacoes || "")}</textarea>
        </div>`,
      actions: `
        <button class="btn-secondary" id="m-cancel">Cancelar</button>
        <button class="btn-primary"   id="m-ok"
                style="background:${cor};border-color:${cor}">
          <i class="fi fi-rr-disk"></i> Salvar
        </button>`,
    });

    let tipoAtual = tipo;

    // Toggle entrada/saída
    modalPanel.querySelectorAll("[data-sw]").forEach(btn =>
      btn.addEventListener("click", () => {
        tipoAtual = btn.dataset.sw;
        modalPanel.querySelectorAll("[data-sw]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const nc = tipoAtual === "entrada" ? "var(--primary)" : "var(--error)";
        const okBtn = modalPanel.querySelector("#m-ok");
        if (okBtn) { okBtn.style.background = nc; okBtn.style.borderColor = nc; }
      })
    );

    // Autocomplete produtos
    const mDesc  = modalPanel.querySelector("#m-desc");
    const acProd = modalPanel.querySelector("#ac-prod-cx");
    if (mDesc && acProd) {
      mDesc.addEventListener("input", () => {
        const q = mDesc.value.trim().toLowerCase();
        if (!q) { acProd.style.display = "none"; return; }
        const matches = produtos.filter(p => p.nome?.toLowerCase().includes(q)).slice(0, 7);
        if (!matches.length) { acProd.style.display = "none"; return; }
        acProd.innerHTML = matches.map(p =>
          `<div class="ac-item" data-nome="${esc(p.nome)}">${esc(p.nome)}</div>`
        ).join("");
        acProd.style.display = "block";
      });
      acProd.addEventListener("click", e => {
        const it = e.target.closest(".ac-item");
        if (!it) return;
        mDesc.value = it.dataset.nome;
        acProd.style.display = "none";
      });
    }

    // Autocomplete clientes
    const mCli  = modalPanel.querySelector("#m-cliente");
    const acCli = modalPanel.querySelector("#ac-cli-cx");
    if (mCli && acCli) {
      mCli.addEventListener("input", () => {
        const q = mCli.value.trim().toLowerCase();
        if (!q) { acCli.style.display = "none"; return; }
        const matches = clientes.filter(c => c.nome?.toLowerCase().includes(q)).slice(0, 6);
        if (!matches.length) { acCli.style.display = "none"; return; }
        acCli.innerHTML = matches.map(c =>
          `<div class="ac-item" data-nome="${esc(c.nome)}">${esc(c.nome)}</div>`
        ).join("");
        acCli.style.display = "block";
      });
      acCli.addEventListener("click", e => {
        const it = e.target.closest(".ac-item");
        if (!it) return;
        mCli.value = it.dataset.nome;
        acCli.style.display = "none";
      });
    }

    // Cancelar
    modalPanel.querySelector("#m-cancel")?.addEventListener("click", () => modalPanel.close());

    // Salvar
    modalPanel.querySelector("#m-ok")?.addEventListener("click", async () => {
      const desc  = modalPanel.querySelector("#m-desc")?.value.trim();
      const valor = parseFloat(modalPanel.querySelector("#m-valor")?.value);
      const data  = modalPanel.querySelector("#m-data")?.value;

      if (!desc)         { this.#flash(modalPanel.querySelector("#m-desc"));  return; }
      if (!valor || valor <= 0) { this.#flash(modalPanel.querySelector("#m-valor")); return; }
      if (!data)         { this.#flash(modalPanel.querySelector("#m-data"));  return; }

      const payload = {
        tipo:        tipoAtual,
        data,
        descricao:   desc,
        cliente_nome: modalPanel.querySelector("#m-cliente")?.value.trim() || null,
        valor,
        observacoes: modalPanel.querySelector("#m-obs")?.value.trim() || null,
        origem:      dados.origem || "manual",
      };

      const okBtn = modalPanel.querySelector("#m-ok");
      if (okBtn) { okBtn.disabled = true; okBtn.textContent = "Salvando..."; }

      try {
        if (editando) await services.caixa.atualizar(dados.id, payload);
        else          await services.caixa.criar(payload);
        this.#filtroDia = data;
        modalPanel.close();
      } catch (e) {
        this.toast(e.message || "Erro ao salvar.", "erro");
        if (okBtn) { okBtn.disabled = false; okBtn.innerHTML = '<i class="fi fi-rr-disk"></i> Salvar'; }
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL IMPORTAR VENDAS
  // ══════════════════════════════════════════════════════════════════════════
  async #abrirModalImportar() {
    const modalPanel = openModal({
      title:    `<i class="fi fi-rr-arrow-down-to-square" style="color:var(--primary)"></i> Importar Vendas para o Caixa`,
      maxWidth: "520px",
      body:     `<div class="loading-state" style="padding:24px"><div class="spinner"></div><span>Carregando vendas...</span></div>`,
      actions:  `
        <button class="btn-secondary" id="imp-cancel">Cancelar</button>
        <button class="btn-primary"   id="imp-ok">Importar selecionadas</button>`,
    });

    modalPanel.querySelector("#imp-cancel")?.addEventListener("click", () => modalPanel.close());

    // Carrega vendas disponíveis
    try {
      const vendas   = await services.venda.listar();
      const caixaMov = selectors.caixa().movimentos || [];
      const vendaIdsImportadas = new Set(caixaMov.filter(m => m.venda_id).map(m => m.venda_id));
      const disponiveis = (vendas || []).filter(v =>
        !vendaIdsImportadas.has(v.id) && ["entregue", "pronto"].includes(v.status)
      );

      const bodyEl = modalPanel.querySelector(".modal-body");
      if (!bodyEl) return;

      bodyEl.innerHTML = `
        <p style="font-size:12px;color:var(--muted);margin:0 0 12px;line-height:1.5">
          Selecione as vendas pagas em dinheiro físico para lançar no caixa.
        </p>
        ${disponiveis.length === 0
          ? `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">
              <i class="fi fi-rr-check-circle" style="font-size:24px;color:var(--success);display:block;margin-bottom:8px"></i>
              Nenhuma venda pendente de importação.
             </div>`
          : `<div class="imp-lista">
              ${disponiveis.map(v => {
                const data = new Date(v.created_at).toLocaleDateString("pt-BR");
                return `
                  <label class="imp-item">
                    <input type="checkbox" class="imp-chk"
                      data-id="${v.id}"
                      data-cliente="${esc(v.cliente_nome||"")}"
                      data-total="${v.total}"
                      data-desc="${esc((v.tipo||"Venda") + " — " + (v.cliente_nome||"Sem cliente"))}"
                      data-data="${v.created_at?.slice(0,10)||this.#filtroDia}" />
                    <div class="imp-info">
                      <div style="font-weight:600">${esc(v.cliente_nome)||"Sem cliente"}</div>
                      <div style="font-size:11px;color:var(--muted)">${data} · ${v.tipo||"Venda/O.S."}</div>
                    </div>
                    <div style="font-size:15px;font-weight:700;color:var(--primary)">${fmtBRL(v.total||0)}</div>
                  </label>`;
              }).join("")}
            </div>`}`;

      modalPanel.querySelector("#imp-ok")?.addEventListener("click", async () => {
        const selecionadas = [...(modalPanel.querySelectorAll(".imp-chk:checked") || [])];
        if (!selecionadas.length) { alert("Selecione ao menos uma venda."); return; }

        const okBtn = modalPanel.querySelector("#imp-ok");
        if (okBtn) { okBtn.disabled = true; okBtn.textContent = "Importando..."; }

        try {
          for (const chk of selecionadas) {
            await services.caixa.criar({
              tipo:        "entrada",
              data:         chk.dataset.data || this.#filtroDia,
              descricao:    chk.dataset.desc,
              cliente_nome: chk.dataset.cliente || null,
              valor:         parseFloat(chk.dataset.total) || 0,
              venda_id:      chk.dataset.id,
              origem:        "venda",
            });
          }
          modalPanel.close();
        } catch (e) {
          this.toast(e.message || "Erro ao importar.", "erro");
          if (okBtn) { okBtn.disabled = false; okBtn.textContent = "Importar selecionadas"; }
        }
      });

    } catch (e) {
      const bodyEl = modalPanel.querySelector(".modal-body");
      if (bodyEl) bodyEl.innerHTML = `<div style="color:var(--error);padding:16px">Erro ao carregar vendas: ${esc(e.message)}</div>`;
    }
  }

  // ─── Flash de erro num input ──────────────────────────────────────────────
  #flash(el) {
    if (!el) return;
    el.style.borderColor = "var(--error)";
    el.focus();
    setTimeout(() => el.style.borderColor = "", 1500);
  }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function cxCSS() { return `
.cx-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.cx-header-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cx-header-actions input[type="date"]{background:var(--panel2);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:7px 10px;font-size:12.5px;width:auto;font-family:var(--font)}
[data-theme="light"] .cx-header-actions input[type="date"]{background:#fff}

.btn-entrada-cx{display:inline-flex;align-items:center;gap:6px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius-md);padding:8px 14px;font-family:var(--font);font-size:12.5px;font-weight:600;cursor:pointer;transition:all var(--t)}
.btn-entrada-cx:hover{opacity:.88}
.btn-saida-cx{display:inline-flex;align-items:center;gap:6px;background:var(--error-bg);color:var(--error);border:1px solid var(--error-border);border-radius:var(--radius-md);padding:8px 14px;font-family:var(--font);font-size:12.5px;font-weight:600;cursor:pointer;transition:all var(--t)}
.btn-saida-cx:hover{background:var(--error);color:#fff}
.btn-importar{display:inline-flex;align-items:center;gap:6px;background:var(--primary-bg);color:var(--primary-light);border:1px solid var(--primary-border);border-radius:var(--radius-md);padding:8px 14px;font-family:var(--font);font-size:12.5px;font-weight:600;cursor:pointer;transition:all var(--t)}
.btn-importar:hover{background:var(--primary);color:#fff}

.cx-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
@media(max-width:600px){.cx-kpis{grid-template-columns:1fr}}
.cx-kpi{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;box-shadow:var(--shadow-xs)}
[data-theme="light"] .cx-kpi{box-shadow:var(--shadow-sm)}
.cx-kpi.destaque{border-top:3px solid var(--primary)}
.cx-kpi-label{font-size:10.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.cx-kpi-val{font-size:21px;font-weight:800;line-height:1.1;margin:4px 0 2px}
.cx-kpi-val.entrada,.cx-kpi-val.positivo{color:var(--primary)}
.cx-kpi-val.saida,.cx-kpi-val.negativo{color:var(--error)}
.cx-kpi-sub{font-size:10.5px;color:var(--muted)}

.cx-table-wrap{overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border);background:var(--panel2);box-shadow:var(--shadow-xs)}
[data-theme="light"] .cx-table-wrap{box-shadow:var(--shadow-sm)}
.cx-table{width:100%;border-collapse:collapse;font-size:12.5px}
.cx-table th{text-align:left;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:9px 13px;background:var(--panel3);border-bottom:1px solid var(--border);white-space:nowrap}
.cx-table td{padding:10px 13px;border-bottom:1px solid var(--border);vertical-align:middle}
.cx-table tr:last-child td{border-bottom:none}
.cx-row:hover td{background:color-mix(in srgb,var(--primary) 4%,var(--panel2))}
.cx-hora{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.cx-desc{font-weight:600;font-size:12.5px}
.cx-sub{font-size:10.5px;color:var(--muted);display:flex;align-items:center;gap:4px;margin-top:2px}
.cx-cliente{font-size:11.5px;color:var(--muted)}
.cx-valor{font-weight:700;font-size:13.5px;text-align:right;font-variant-numeric:tabular-nums}
.cx-valor.entrada{color:var(--primary)}
.cx-valor.saida{color:var(--error)}
.cx-saldo{font-weight:700;font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums}
.cx-saldo.positivo{color:var(--text-sub)}
.cx-saldo.negativo{color:var(--error)}
.cx-acoes{display:flex;gap:5px;justify-content:flex-end}
.cx-vazio{text-align:center;padding:36px 20px;color:var(--muted);font-size:12.5px}
.tipo-pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}
.tipo-pill.entrada{background:var(--primary-bg);color:var(--primary-light)}
.tipo-pill.saida{background:var(--error-bg);color:var(--error)}
.btn-icon-cx{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);background:transparent;border:1px solid var(--border);color:var(--muted);cursor:pointer;font-size:12px;transition:all var(--t)}
.btn-icon-cx:hover{border-color:var(--primary);color:var(--primary-light);background:var(--primary-bg)}
.btn-icon-cx.danger:hover{border-color:var(--error-border);color:var(--error);background:var(--error-bg)}

/* Modal switches */
.cx-tipo-switch{display:flex;border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--border-md)}
.cx-tipo-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:none;background:var(--panel2);color:var(--muted);font-family:var(--font);font-size:12.5px;font-weight:600;cursor:pointer;transition:all var(--t)}
.cx-tipo-btn.ent.active{background:var(--primary-bg);color:var(--primary-light)}
.cx-tipo-btn.sai.active{background:var(--error-bg);color:var(--error)}

/* Preco field */
.preco-field{display:flex;align-items:center;background:var(--panel3);border:1px solid var(--border-md);border-radius:var(--radius-md);overflow:hidden;transition:border-color var(--t)}
[data-theme="light"] .preco-field{background:#f8f9fc}
.preco-field:focus-within{border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,196,154,.1)}
.preco-field span{padding:0 10px;font-size:11.5px;font-weight:600;color:var(--muted);background:var(--panel);border-right:1px solid var(--border);display:flex;align-items:center;flex-shrink:0}
.preco-field input{border:none;background:transparent;flex:1;padding:8px 10px;font-size:12.5px;color:var(--text);font-family:var(--font)}
.preco-field input:focus{outline:none;box-shadow:none}

/* Autocomplete */
.autocomplete-wrap{position:relative}
.autocomplete-list{display:none;position:absolute;top:100%;left:0;right:0;z-index:200;background:var(--panel);border:1px solid var(--border-md);border-radius:var(--radius-md);box-shadow:var(--shadow-md);max-height:180px;overflow-y:auto}
.ac-item{padding:8px 12px;font-size:12.5px;cursor:pointer;transition:background var(--t)}
.ac-item:hover{background:var(--primary-bg);color:var(--primary-light)}

/* Importar */
.imp-lista{display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto}
.imp-item{display:flex;align-items:center;gap:12px;background:var(--panel3);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 14px;cursor:pointer;transition:border-color var(--t)}
.imp-item:hover{border-color:var(--primary-border)}
.imp-item input[type="checkbox"]{width:16px;height:16px;flex-shrink:0;cursor:pointer;accent-color:var(--primary)}
.imp-info{flex:1}
`; }
