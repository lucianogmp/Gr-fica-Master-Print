/**
 * FINANCEIRO VIEW — Gestão financeira com lançamentos e fluxo de caixa.
 */

import { BaseView } from "./baseView.js";
import { services } from "../../core/services.js";
import { selectors, actions } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import { PageHeader, KpiGrid, Tabs, DataTable, Btn, openModal, fmtBRL, fmtData, esc } from "../components/index.js";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export class FinanceiroView extends BaseView {
  #aba = "resumo";
  #filtroStatus = "";

  async _init() {
    const mes = selectors.financeiro().mes || mesAtual();
    await services.lancamento.listar(mes);
    this.subscribe("financeiro", () => this.refresh());
    this.listenTo(EVENTS.LANCAMENTO_CRIADO, () => {});
    this.listenTo(EVENTS.LANCAMENTO_PAGO,   () => {});
  }

  render() {
    const state  = selectors.financeiro();
    const mes    = state.mes || mesAtual();
    const lancs  = state.lancamentos || [];
    const resumo = state.resumo || {};
    const hoje   = new Date().toISOString().split("T")[0];
    const vencidos = lancs.filter(l => l.status === "pendente" && l.data_vencimento && l.data_vencimento < hoje);

    return `
      <style>
        .barra-row{display:flex;align-items:center;gap:8px;margin-bottom:7px}
        .barra-cat{font-size:12px;width:120px;flex-shrink:0;color:var(--muted)}
        .barra-wrap{flex:1;background:var(--panel3);border-radius:4px;height:8px;overflow:hidden}
        .barra-fill{height:100%;border-radius:4px}
        .barra-val{font-size:12px;font-weight:600;white-space:nowrap}
        .venc-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:.5px solid var(--border);font-size:13px}
        .venc-row:last-child{border-bottom:none}
        .parc-status{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;cursor:pointer}
        .parc-pendente{background:var(--warning-bg);color:var(--warning)}
        .parc-recebido{background:var(--success-bg);color:var(--success)}
      </style>

      ${PageHeader({
        title: "Financeiro",
        subtitle: "Lançamentos e fluxo de caixa",
        actions: `
          <input type="month" id="filtro-mes" value="${mes}"
            style="background:var(--panel2);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:7px 10px;font-size:13px" />
          ${Btn.primary("+ Receita", "btn-nova-rec", 'style="background:var(--success)"')}
          ${Btn.danger("+ Despesa", "btn-nova-dep")}
        `,
      })}

      ${vencidos.length ? `
        <div style="background:var(--error-bg);border:1px solid var(--error-border);border-radius:var(--radius-md);padding:10px 14px;font-size:13px;color:var(--error);margin-bottom:14px">
          ⚠️ <strong>${vencidos.length} lançamento${vencidos.length > 1 ? "s" : ""} vencido${vencidos.length > 1 ? "s" : ""}</strong> —
          ${vencidos.slice(0, 2).map(l => `${l.descricao} (${fmtBRL(l.valor)})`).join(", ")}
          ${vencidos.length > 2 ? ` e mais ${vencidos.length - 2}...` : ""}
        </div>` : ""}

      ${KpiGrid([
        { label: "Receitas do mês",  value: fmtBRL(resumo.receitas || 0), sub: `Recebido: ${fmtBRL(resumo.recebido || 0)}`, color: "var(--success)", icon: "📈" },
        { label: "Despesas do mês",  value: fmtBRL(resumo.despesas || 0), sub: `A pagar: ${fmtBRL(resumo.aPagar || 0)}`, color: "var(--error)", icon: "📉" },
        { label: "Saldo do mês",     value: fmtBRL((resumo.saldo || 0)), sub: `A receber: ${fmtBRL(resumo.aReceber || 0)}`, color: (resumo.saldo || 0) >= 0 ? "var(--success)" : "var(--error)", icon: "💰" },
      ])}

      ${Tabs({ tabs: [
        { key: "resumo",   label: "📊 Resumo"   },
        { key: "receitas", label: "📈 Receitas"  },
        { key: "despesas", label: "📉 Despesas"  },
        { key: "fluxo",    label: "💧 Fluxo"    },
      ], active: this.#aba })}

      <div id="fin-body">
        ${this.#renderAba(lancs, mes)}
      </div>
    `;
  }

  #renderAba(lancs, mes) {
    const receitas = lancs.filter(l => l.tipo === "receita");
    const despesas = lancs.filter(l => l.tipo === "despesa");

    if (this.#aba === "resumo")   return this.#renderResumo(receitas, despesas, lancs);
    if (this.#aba === "receitas") return this.#renderTabela(receitas, "receita");
    if (this.#aba === "despesas") return this.#renderTabela(despesas, "despesa");
    if (this.#aba === "fluxo")    return this.#renderFluxo(mes);
    return "";
  }

  #renderResumo(receitas, despesas, lancs) {
    const porCat = lista => {
      const map = {};
      lista.forEach(l => { const c = l.categoria || "Outros"; map[c] = (map[c] || 0) + Number(l.valor); });
      return Object.entries(map).sort((a, b) => b[1] - a[1]);
    };
    const catRec  = porCat(receitas);
    const catDesp = porCat(despesas);
    const maxRec  = Math.max(...catRec.map(c => c[1]), 1);
    const maxDesp = Math.max(...catDesp.map(c => c[1]), 1);

    const barras = (lista, max, cor) => lista.length === 0
      ? `<div style="color:var(--muted);font-size:13px">Nenhum lançamento.</div>`
      : lista.map(([cat, val]) => `
        <div class="barra-row">
          <span class="barra-cat">${esc(cat)}</span>
          <div class="barra-wrap"><div class="barra-fill" style="width:${(val/max*100).toFixed(1)}%;background:${cor}"></div></div>
          <span class="barra-val">${fmtBRL(val)}</span>
        </div>`).join("");

    const proximos = lancs
      .filter(l => l.status === "pendente" && l.data_vencimento)
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
      .slice(0, 6);
    const hoje = new Date().toISOString().split("T")[0];

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="ds-card">
          <div class="ds-card-title">📈 Receitas por categoria</div>
          ${barras(catRec, maxRec, "var(--success)")}
        </div>
        <div class="ds-card">
          <div class="ds-card-title">📉 Despesas por categoria</div>
          ${barras(catDesp, maxDesp, "var(--error)")}
        </div>
      </div>
      <div class="ds-card" style="margin-top:14px">
        <div class="ds-card-title">📅 Próximos vencimentos</div>
        ${proximos.length === 0
          ? `<div style="color:var(--muted);font-size:13px">Nenhum vencimento pendente.</div>`
          : proximos.map(l => {
            const atrasado = l.data_vencimento < hoje;
            return `<div class="venc-row">
              <span style="font-weight:700;color:${l.tipo === "receita" ? "var(--success)" : "var(--error)"}">${l.tipo === "receita" ? "▲" : "▼"}</span>
              <span style="flex:1">${esc(l.descricao)}</span>
              <span style="font-size:12px;${atrasado ? "color:var(--error);font-weight:700" : "color:var(--muted)"}">${fmtData(l.data_vencimento)}</span>
              <span style="font-weight:600">${fmtBRL(l.valor)}</span>
            </div>`;
          }).join("")}
      </div>`;
  }

  #renderTabela(lista, tipo) {
    const hoje = new Date().toISOString().split("T")[0];
    const filtrados = this.#filtroStatus ? lista.filter(l => l.status === this.#filtroStatus) : lista;

    return `
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
        ${["", "pendente", "pago", "cancelado"].map(s => `
          <button class="tab-btn ${this.#filtroStatus === s ? "active" : ""}" data-fs="${s}">
            ${s === "" ? "Todos" : s === "pendente" ? "⏳ Pendente" : s === "pago" ? "✅ Pago" : "❌ Cancelado"}
          </button>`).join("")}
      </div>
      ${DataTable({
        columns: [
          { label: "Descrição" },
          { label: "Categoria", style: "width:120px" },
          { label: "Vencimento", style: "width:110px" },
          { label: "Valor", style: "text-align:right;width:120px" },
          { label: "Status", style: "width:120px" },
          { label: "", style: "width:130px" },
        ],
        rows: filtrados.map(l => {
          const atrasado = l.status === "pendente" && l.data_vencimento && l.data_vencimento < hoje;
          const statusColors = { pendente: "#F79009", pago: "var(--success)", cancelado: "var(--muted)" };
          const statusLabels = { pendente: "⏳ Pendente", pago: "✅ Pago", cancelado: "❌ Cancelado" };
          return `
            <tr style="${atrasado ? "background:var(--error-bg)" : ""}">
              <td>
                <strong>${esc(l.descricao)}</strong>
                ${l.cliente_nome ? `<div style="font-size:11px;color:var(--muted)">${esc(l.cliente_nome)}</div>` : ""}
                ${l.grupo_recorrencia ? `<div style="font-size:11px;color:#a78bfa">🔁 Recorrente parcela ${l.parcela_num || ""}${l.total_parcelas ? "/" + l.total_parcelas : ""}</div>` : ""}
              </td>
              <td style="font-size:12px;color:var(--muted)">${esc(l.categoria) || "—"}</td>
              <td style="font-size:12px${atrasado ? ";color:var(--error);font-weight:700" : ""}">
                ${l.data_vencimento ? fmtData(l.data_vencimento) : "—"}
              </td>
              <td style="text-align:right;font-weight:600;color:${tipo === "receita" ? "var(--success)" : "var(--error)"}">${fmtBRL(l.valor)}</td>
              <td>
                <span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:${statusColors[l.status] || "var(--muted)"}20;color:${statusColors[l.status] || "var(--muted)"}">
                  ${statusLabels[l.status] || l.status}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  ${l.status === "pendente" ? `<button class="btn-icon" data-pagar="${l.id}" style="padding:3px 8px;font-size:11px;color:var(--success);border-color:var(--success-border)">✔ Baixar</button>` : ""}
                  <button class="btn-icon" data-edit-lanc="${l.id}" style="padding:3px 7px;font-size:11px">✏️</button>
                  <button class="btn-icon danger" data-del-lanc="${l.id}" ${l.grupo_recorrencia ? `data-grupo="${l.grupo_recorrencia}"` : ""} style="padding:3px 7px;font-size:11px">🗑</button>
                </div>
              </td>
            </tr>`;
        }),
        emptyMessage: `Nenhum lançamento de ${tipo === "receita" ? "receita" : "despesa"}.`,
      })}`;
  }

  #renderFluxo(mes) {
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const lancs = selectors.financeiro().lancamentos || [];
    const dados = meses.map(m => {
      const doMes = lancs.filter(l => {
        const ref = l.data_vencimento || l.created_at?.slice(0, 10);
        return ref?.startsWith(m);
      });
      const rec  = doMes.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
      const desp = doMes.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);
      return { mes: m, rec, desp, saldo: rec - desp };
    });
    const maxVal = Math.max(...dados.flatMap(d => [d.rec, d.desp]), 1);
    const nomeMes = m => { const [y, mo] = m.split("-"); return new Date(y, mo - 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };

    return `
      <div class="ds-card">
        <div class="ds-card-title">💧 Fluxo dos últimos 6 meses</div>
        <div style="display:flex;gap:8px;align-items:flex-end;padding:10px 0;height:160px">
          ${dados.map(d => `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px">
              <div style="display:flex;gap:3px;align-items:flex-end;height:130px">
                <div style="width:14px;background:var(--success);border-radius:3px 3px 0 0;min-height:2px;height:${(d.rec/maxVal*120).toFixed(0)}px;transition:height .4s" title="Receita: ${fmtBRL(d.rec)}"></div>
                <div style="width:14px;background:var(--error);border-radius:3px 3px 0 0;min-height:2px;height:${(d.desp/maxVal*120).toFixed(0)}px;transition:height .4s" title="Despesa: ${fmtBRL(d.desp)}"></div>
              </div>
              <div style="font-size:10px;color:var(--muted)">${nomeMes(d.mes)}</div>
            </div>`).join("")}
        </div>
        <div style="display:flex;gap:14px;font-size:11px;color:var(--muted);margin-top:4px">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--success);margin-right:4px"></span>Receita</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--error);margin-right:4px"></span>Despesa</span>
        </div>
      </div>
      ${DataTable({
        columns: [
          { label: "Mês" },
          { label: "Receitas", style: "text-align:right" },
          { label: "Despesas", style: "text-align:right" },
          { label: "Saldo", style: "text-align:right" },
        ],
        rows: dados.map(d => `
          <tr>
            <td>${nomeMes(d.mes)}</td>
            <td style="text-align:right;color:var(--success)">${fmtBRL(d.rec)}</td>
            <td style="text-align:right;color:var(--error)">${fmtBRL(d.desp)}</td>
            <td style="text-align:right;font-weight:700;color:${d.saldo >= 0 ? "var(--success)" : "var(--error)"}">${d.saldo >= 0 ? "+" : ""}${fmtBRL(d.saldo)}</td>
          </tr>`),
      })}`;
  }

  afterRender() {
    // Filtro de mês
    this.$("#filtro-mes")?.addEventListener("change", async e => {
      actions.setMesFinanceiro(e.target.value);
      await services.lancamento.listar(e.target.value);
    });

    // Botões novo
    this.$("#btn-nova-rec")?.addEventListener("click", () => this.#abrirModal("receita"));
    this.$("#btn-nova-dep")?.addEventListener("click", () => this.#abrirModal("despesa"));

    // Tabs
    this.$$(".tab-btn").forEach(btn => {
      if (btn.dataset.tab) {
        btn.addEventListener("click", () => { this.#aba = btn.dataset.tab; this.refresh(); });
      }
      if (btn.dataset.fs !== undefined) {
        btn.addEventListener("click", () => { this.#filtroStatus = btn.dataset.fs; this.refresh(); });
      }
    });

    // Baixar
    this.$$("[data-pagar]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await services.lancamento.marcarPago(btn.dataset.pagar);
      });
    });

    // Editar
    this.$$("[data-edit-lanc]").forEach(btn => {
      btn.addEventListener("click", () => {
        const l = (selectors.financeiro().lancamentos || []).find(x => x.id === btn.dataset.editLanc);
        if (l) this.#abrirModal(l.tipo, l);
      });
    });

    // Deletar
    this.$$("[data-del-lanc]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const grupo = btn.dataset.grupo;
        if (grupo) {
          const opcao = confirm("Deletar TODOS os futuros desta série recorrente? (Cancelar = deletar só este)");
          if (opcao === null) return;
          await services.lancamento.deletar(btn.dataset.delLanc, opcao);
        } else {
          if (!confirm("Deletar este lançamento?")) return;
          await services.lancamento.deletar(btn.dataset.delLanc);
        }
      });
    });
  }

  #abrirModal(tipo, dados = {}) {
    const cats = tipo === "receita"
      ? ["Venda", "Serviço", "Outros"]
      : ["Fornecedor", "Aluguel", "Salário", "Material", "Imposto", "Outros"];
    const cor = tipo === "receita" ? "var(--success)" : "var(--error)";
    const editando = !!dados.id;

    const modalRef = openModal({
      title: `${editando ? "Editar" : "Novo"} ${tipo === "receita" ? "Receita ▲" : "Despesa ▼"}`,
      maxWidth: "440px",
      body: `
        <div class="form-field"><label>Descrição *</label>
          <input id="m-desc" value="${esc(dados.descricao)}" placeholder="Ex: Aluguel, Venda..." autofocus />
        </div>
        <div class="form-field" style="margin-top:10px"><label>Valor (R$) *</label>
          <input id="m-valor" type="number" min="0" step="0.01" value="${dados.valor || ""}" />
        </div>
        <div class="form-grid" style="margin-top:10px">
          <div class="form-field"><label>Categoria</label>
            <select id="m-cat">${cats.map(c => `<option value="${c}" ${dados.categoria === c ? "selected" : ""}>${c}</option>`).join("")}</select>
          </div>
          <div class="form-field"><label>Vencimento</label>
            <input id="m-venc" type="date" value="${dados.data_vencimento || ""}" />
          </div>
          <div class="form-field"><label>Status</label>
            <select id="m-status">
              <option value="pendente" ${(!dados.status || dados.status === "pendente") ? "selected" : ""}>⏳ Pendente</option>
              <option value="pago" ${dados.status === "pago" ? "selected" : ""}>✅ Pago</option>
            </select>
          </div>
          <div class="form-field"><label>Cliente / Fornecedor</label>
            <input id="m-cli" value="${esc(dados.cliente_nome)}" placeholder="Nome (opcional)" />
          </div>
        </div>
        ${!editando ? `
        <div style="background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.2);border-radius:var(--radius-md);padding:12px;margin-top:12px">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#a78bfa;cursor:pointer;font-weight:600">
            <input type="checkbox" id="m-recorrente" />
            🔁 Lançamento recorrente
          </label>
          <div id="rec-opts" style="display:none;margin-top:10px">
            <div class="form-field"><label>Quantidade de parcelas</label>
              <input id="m-parcelas" type="number" min="2" max="360" value="12" />
            </div>
          </div>
        </div>` : ""}`,
      actions: `
        ${Btn.secondary("Cancelar", "m-cancel")}
        <button class="btn" id="m-ok" style="background:${cor};color:#fff;border-color:${cor};display:inline-flex;align-items:center;gap:6px;border-radius:var(--radius-md);padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer">Salvar</button>`,
    });

    document.getElementById("m-recorrente")?.addEventListener("change", function() {
      document.getElementById("rec-opts").style.display = this.checked ? "block" : "none";
    });
    document.getElementById("m-cancel")?.addEventListener("click", () => modalRef.close());
    document.getElementById("m-ok")?.addEventListener("click", async () => {
      const desc  = document.getElementById("m-desc")?.value.trim();
      const valor = parseFloat(document.getElementById("m-valor")?.value);
      if (!desc || !valor) { this.toast("Preencha descrição e valor.", "warn"); return; }

      const payload = {
        tipo,
        descricao:       desc,
        valor,
        categoria:       document.getElementById("m-cat")?.value,
        data_vencimento: document.getElementById("m-venc")?.value || null,
        status:          document.getElementById("m-status")?.value,
        cliente_nome:    document.getElementById("m-cli")?.value.trim() || null,
        isRecorrente:    document.getElementById("m-recorrente")?.checked || false,
        qtdParcelas:     document.getElementById("m-parcelas")?.value || 12,
        tipoParc:        "fixo",
      };

      try {
        if (editando) await services.lancamento.atualizar(dados.id, payload);
        else          await services.lancamento.criar(payload);
        modalRef.close();
      } catch (e) { this.toast(e.message, "erro"); }
    });
  }
}
