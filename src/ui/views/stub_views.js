/**
 * STUB VIEWS — Implementações mínimas das views restantes.
 * Cada uma segue a mesma arquitetura BaseView e pode ser expandida.
 */

import { BaseView } from "./baseView.js";
import { services } from "../../core/services.js";
import { selectors, store } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import {
  PageHeader, KpiGrid, Tabs, DataTable, Btn, openModal, fmtBRL, fmtData, esc,
} from "../components/index.js";

// ══════════════════════════════════════════════════════════════════════════════
// PRODUÇÃO VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ETAPAS = {
  fila:       { label: "Fila",       cor: "#868e96", emoji: "⏳" },
  imprimindo: { label: "Imprimindo", cor: "#74c0fc", emoji: "🖨️" },
  acabamento: { label: "Acabamento", cor: "#ffa94d", emoji: "✂️" },
  pronto:     { label: "Pronto",     cor: "#69db7c", emoji: "✅" },
};

export class ProducaoView extends BaseView {
  #filtroEtapa = "";

  async _init() {
    await services.producao.listar();
    this.subscribe("producao", () => this.refresh());
    this.listenTo(EVENTS.PRODUCAO_ETAPA_MUDOU, () => {});
  }

  render() {
    const itens = store.getState("producao").itens || [];
    const hoje = new Date().toISOString().split("T")[0];

    const filtrados = this.#filtroEtapa
      ? itens.filter(i => i.etapa === this.#filtroEtapa)
      : itens;

    const porEtapa = Object.fromEntries(
      Object.keys(ETAPAS).map(e => [e, itens.filter(i => i.etapa === e).length])
    );

    return `
      <style>
        .prod-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:10px}
        .prod-card.atrasado{border-color:var(--error-border);background:var(--error-bg)}
        .etapa-pill-btn{padding:5px 11px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-size:13px;transition:all .15s}
        .etapa-pill-btn:hover{border-color:var(--primary)} .etapa-pill-btn.current{font-weight:700}
        .prio-badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
      </style>

      ${PageHeader({
        title: "Produção",
        subtitle: `${itens.length} item${itens.length !== 1 ? "s" : ""} em produção`,
        actions: `
          ${Btn.secondary("+ Da Venda", "btn-de-venda")}
          ${Btn.primary("+ Manual", "btn-novo-prod")}
        `,
      })}

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
        <button class="tab-btn ${!this.#filtroEtapa ? "active" : ""}" data-etapa="">
          Todos <span class="tab-count">${itens.length}</span>
        </button>
        ${Object.entries(ETAPAS).map(([key, e]) => `
          <button class="tab-btn ${this.#filtroEtapa === key ? "active" : ""}" data-etapa="${key}"
            style="${this.#filtroEtapa === key ? `border-color:${e.cor};color:${e.cor};background:${e.cor}12` : ""}">
            ${e.emoji} ${e.label} <span class="tab-count">${porEtapa[key] || 0}</span>
          </button>`).join("")}
      </div>

      <div id="prod-lista">
        ${filtrados.length === 0
          ? `<div style="color:var(--muted);text-align:center;padding:40px;font-size:13px">
               Nenhum item${this.#filtroEtapa ? " nessa etapa" : ""} ainda.
             </div>`
          : filtrados.map(item => this.#renderCard(item, hoje)).join("")}
      </div>
    `;
  }

  #renderCard(item, hoje) {
    const etapa = ETAPAS[item.etapa] || ETAPAS.fila;
    const prioColors = { baixa: "#9fb0d0", normal: "#74c0fc", alta: "#ffa94d", urgente: "#ff6b6b" };
    const prioCor = prioColors[item.prioridade || "normal"] || prioColors.normal;
    const atrasado = item.data_entrega && item.data_entrega < hoje && item.etapa !== "pronto";

    return `
      <div class="prod-card ${atrasado ? "atrasado" : ""}" data-item-id="${item.id}">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <span class="prio-badge" style="background:${prioCor}22;color:${prioCor}">${item.prioridade || "Normal"}</span>
          <span class="prio-badge" style="background:${etapa.cor}22;color:${etapa.cor}">${etapa.emoji} ${etapa.label}</span>
          ${atrasado ? `<span style="color:var(--error);font-size:11px;font-weight:700">⚠️ ATRASADO</span>` : ""}
          <div style="flex:1"></div>
          <button class="btn-icon" data-edit-item="${item.id}" style="padding:3px 7px;font-size:12px">✏️</button>
          <button class="btn-icon danger" data-del-item="${item.id}" style="padding:3px 7px;font-size:12px">🗑</button>
        </div>
        <div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(item.titulo)}</div>
        ${item.descricao ? `<div style="font-size:13px;color:var(--muted);margin-bottom:6px">${esc(item.descricao)}</div>` : ""}
        <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);margin-bottom:8px">
          ${item.responsavel ? `<span>👤 ${esc(item.responsavel)}</span>` : ""}
          ${item.data_entrega ? `<span ${atrasado ? 'style="color:var(--error);font-weight:700"' : ""}>📅 ${fmtData(item.data_entrega)}</span>` : ""}
        </div>
        <div style="display:flex;gap:6px;padding-top:8px;border-top:1px solid var(--border)">
          ${Object.entries(ETAPAS).map(([key, e]) => `
            <button class="etapa-pill-btn ${item.etapa === key ? "current" : ""}"
              data-mover="${item.id}" data-para="${key}"
              style="${item.etapa === key ? `background:${e.cor}22;border-color:${e.cor};color:${e.cor}` : ""}">
              ${e.emoji}
            </button>`).join("")}
        </div>
      </div>`;
  }

  afterRender() {
    this.$$("[data-etapa]").forEach(btn =>
      btn.addEventListener("click", () => { this.#filtroEtapa = btn.dataset.etapa; this.refresh(); })
    );
    this.$("#btn-novo-prod")?.addEventListener("click", () => this.#abrirModal(null));
    this.$("#btn-de-venda")?.addEventListener("click", () => this.#abrirModal(null, true));

    this.$$("[data-mover]").forEach(btn =>
      btn.addEventListener("click", async () => {
        await services.producao.moverEtapa(btn.dataset.mover, btn.dataset.para);
      })
    );
    this.$$("[data-edit-item]").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = (store.getState("producao").itens || []).find(i => i.id === btn.dataset.editItem);
        if (item) this.#abrirModal(item);
      });
    });
    this.$$("[data-del-item]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm("Remover da produção?")) return;
        await services.producao.deletar(btn.dataset.delItem);
      })
    );
  }

  #abrirModal(dados, deVenda = false) {
    const editando = !!dados?.id;
    const PRIO = ["baixa", "normal", "alta", "urgente"];
    const modalRef = openModal({
      title: editando ? "Editar Item" : deVenda ? "Adicionar da Venda" : "Novo Item Manual",
      body: `
        <div class="form-field"><label>Título *</label>
          <input id="p-titulo" value="${esc(dados?.titulo)}" placeholder="Ex: Banner 1×2m — João" autofocus />
        </div>
        <div class="form-field" style="margin-top:10px"><label>Descrição</label>
          <textarea id="p-desc" rows="2">${esc(dados?.descricao)}</textarea>
        </div>
        <div class="form-grid" style="margin-top:10px">
          <div class="form-field"><label>Etapa</label>
            <select id="p-etapa">${Object.entries(ETAPAS).map(([k, e]) => `<option value="${k}" ${(dados?.etapa || "fila") === k ? "selected" : ""}>${e.emoji} ${e.label}</option>`).join("")}</select>
          </div>
          <div class="form-field"><label>Prioridade</label>
            <select id="p-prio">${PRIO.map(p => `<option value="${p}" ${(dados?.prioridade || "normal") === p ? "selected" : ""}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join("")}</select>
          </div>
          <div class="form-field"><label>Responsável</label>
            <input id="p-resp" value="${esc(dados?.responsavel)}" placeholder="Nome do operador" />
          </div>
          <div class="form-field"><label>Data de entrega</label>
            <input id="p-data" type="date" value="${dados?.data_entrega || ""}" />
          </div>
        </div>`,
      actions: `
        ${Btn.secondary("Cancelar", "p-cancel")}
        ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar', "p-ok")}`,
    });
    document.getElementById("p-cancel")?.addEventListener("click", () => modalRef.close());
    document.getElementById("p-ok")?.addEventListener("click", async () => {
      const titulo = document.getElementById("p-titulo")?.value.trim();
      if (!titulo) { this.toast("Informe o título.", "warn"); return; }
      const payload = {
        titulo,
        descricao:    document.getElementById("p-desc")?.value.trim() || null,
        etapa:        document.getElementById("p-etapa")?.value,
        prioridade:   document.getElementById("p-prio")?.value,
        responsavel:  document.getElementById("p-resp")?.value.trim() || null,
        data_entrega: document.getElementById("p-data")?.value || null,
      };
      try {
        if (editando) await services.producao.atualizar(dados.id, payload);
        else          await services.producao.criar(payload);
        modalRef.close();
      } catch (e) { this.toast(e.message, "erro"); }
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ORÇAMENTO VIEW (stub que reutiliza o módulo legado)
// ══════════════════════════════════════════════════════════════════════════════
export class OrcamentoView extends BaseView {
  async _init() {
    await Promise.allSettled([
      services.cliente.listar(),
      services.config.carregar(),
    ]);
  }

  render() {
    return `<div id="orc-legacy-root"></div>`;
  }

  async afterRender() {
    // Monta o módulo legado de orçamentos que já funciona bem
    const { Orcamento } = await import("../../pages/orcamento.js");
    const container = this.$("#orc-legacy-root");
    if (container) await Orcamento(container);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUTOS VIEW (stub que reutiliza o módulo legado)
// ══════════════════════════════════════════════════════════════════════════════
export class ProdutosView extends BaseView {
  render() { return `<div id="prod-legacy-root"></div>`; }
  async afterRender() {
    const { Produtos } = await import("../../pages/produtos.js");
    const container = this.$("#prod-legacy-root");
    if (container) await Produtos(container);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FLUXO DE CAIXA VIEW (stub que reutiliza o módulo legado)
// ══════════════════════════════════════════════════════════════════════════════
export class FluxoCaixaView extends BaseView {
  render() { return `<div id="caixa-legacy-root"></div>`; }
  async afterRender() {
    const { FluxoCaixa } = await import("../../pages/fluxo_caixa.js");
    const container = this.$("#caixa-legacy-root");
    if (container) await FluxoCaixa(container);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GESTÃO DE CUSTOS VIEW (stub que reutiliza o módulo legado)
// ══════════════════════════════════════════════════════════════════════════════
export class GestaoCustosView extends BaseView {
  render() { return `<div id="custos-legacy-root"></div>`; }
  async afterRender() {
    const { GestaoCustos } = await import("../../pages/gestao_custos.js");
    const container = this.$("#custos-legacy-root");
    if (container) await GestaoCustos(container);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES VIEW (stub que reutiliza o módulo legado)
// ══════════════════════════════════════════════════════════════════════════════
export class ConfiguracoesView extends BaseView {
  render() { return `<div id="cfg-legacy-root"></div>`; }
  async afterRender() {
    const { Configuracoes } = await import("../../pages/configuracoes.js");
    const container = this.$("#cfg-legacy-root");
    if (container) await Configuracoes(container);
  }
}
