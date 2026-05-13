/**
 * DASHBOARD VIEW — Painel principal com dados agregados em tempo real.
 */

import { BaseView } from "./baseView.js";
import { services } from "../../core/services.js";
import { selectors, actions } from "../../core/store.js";
import { EventBus, EVENTS } from "../../core/eventBus.js";
import { PageHeader, KpiGrid, fmtBRL, esc } from "../components/index.js";

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtData(d) {
  if (!d) return "—";
  const [y, m, dia] = d.slice(0, 10).split("-");
  return `${dia}/${m}/${y}`;
}

export class DashboardView extends BaseView {
  #mes = mesAtual();
  #resumo = null;
  #loading = true;

  async _init() {
    await this.#carregar();

    // Reage a mudanças de vendas/financeiro para atualizar KPIs
    this.listenTo(EVENTS.VENDA_CRIADA,      () => this.#carregar());
    this.listenTo(EVENTS.VENDA_ATUALIZADA,  () => this.#carregar());
    this.listenTo(EVENTS.LANCAMENTO_CRIADO, () => this.#carregar());
    this.listenTo(EVENTS.LANCAMENTO_PAGO,   () => this.#carregar());
    this.listenTo(EVENTS.ESTOQUE_ENTRADA,   () => this.#carregar());
    this.listenTo(EVENTS.ESTOQUE_SAIDA,     () => this.#carregar());
  }

  async #carregar() {
    this.#loading = true;
    try {
      this.#resumo = await services.dashboard.getResumo(this.#mes);
    } catch (e) {
      console.error("[Dashboard] erro:", e);
    } finally {
      this.#loading = false;
      this.refresh();
    }
  }

  render() {
    if (this.#loading || !this.#resumo) return this._loading("Carregando dashboard...");

    const r = this.#resumo;
    const fin = r.financeiro;
    const hoje = new Date().toISOString().split("T")[0];
    const vencidos = r.lancamentos.filter(l =>
      l.status === "pendente" && l.data_vencimento && l.data_vencimento < hoje
    );

    return `
      <style>
        .dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:860px){.dash-grid{grid-template-columns:1fr}}
        .aviso-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:var(--radius-md);margin-bottom:7px}
        .aviso-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;margin-top:1px}
        .aviso-title{font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px}
        .aviso-body{font-size:11px;color:var(--muted)}
        .prog-track{background:var(--panel);border-radius:99px;height:6px;overflow:hidden;margin-top:4px}
        .prog-fill{height:100%;border-radius:99px;transition:width .5s}
        .est-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:.5px solid var(--border)}
        .est-row:last-child{border-bottom:none}
        .dre-table{width:100%;font-size:12px;border-collapse:collapse}
        .dre-table tr{border-bottom:.5px solid var(--border)}
        .dre-table td{padding:5px 2px;vertical-align:middle}
        .dre-result td{font-weight:700;border-top:2px solid var(--border-md)!important;padding-top:8px}
      </style>

      ${PageHeader({
        title: "Dashboard",
        subtitle: "Visão geral do período selecionado",
        actions: `<input type="month" id="filtro-mes" value="${this.#mes}"
          style="background:var(--panel2);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:7px 12px;font-size:13px" />`,
      })}

      ${KpiGrid([
        { label: "Faturamento", value: fmtBRL(r.faturamento), sub: `${r.vendas.total} venda${r.vendas.total !== 1 ? "s" : ""} no mês`, color: "var(--primary-light)", icon: "💰" },
        { label: "Receitas",    value: fmtBRL(fin.receitas), sub: `Margem: ${fin.margem}%`, color: "var(--success)", icon: "📈" },
        { label: "Despesas",    value: fmtBRL(fin.despesas), sub: fin.despesas > 0 ? "Custos do período" : "Nenhuma despesa", color: "var(--error)", icon: "📉" },
        { label: "Lucro Líquido", value: fmtBRL(fin.lucro), sub: `${fin.lucro >= 0 ? "Resultado positivo" : "Resultado negativo"}`, color: fin.lucro >= 0 ? "var(--success)" : "var(--error)", icon: fin.lucro >= 0 ? "✅" : "⚠️" },
      ])}

      <div class="dash-grid">

        <!-- Resultado Consolidado -->
        <div class="ds-card">
          <div class="ds-card-title">📋 Resultado Consolidado</div>
          <table class="dre-table">
            <tr><td style="color:var(--muted)">+ Receita bruta</td><td style="text-align:right;color:var(--success)">${fmtBRL(fin.receitas)}</td></tr>
            <tr><td style="color:var(--muted)">— Despesas operacionais</td><td style="text-align:right;color:var(--error)">- ${fmtBRL(fin.despesas)}</td></tr>
            <tr class="dre-result"><td><strong>= Lucro / Prejuízo</strong></td><td style="text-align:right;font-size:14px;${fin.lucro >= 0 ? "color:var(--success)" : "color:var(--error)"}">${fmtBRL(fin.lucro)}</td></tr>
          </table>

          <div style="margin-top:14px">
            <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Ponto de equilíbrio</div>
            ${this.#renderPontoEquilibrio(fin)}
          </div>
        </div>

        <!-- Quadro de Avisos -->
        <div class="ds-card">
          <div class="ds-card-title">🔔 Quadro de Avisos</div>
          ${this.#renderAvisos(r, vencidos)}
        </div>

        <!-- Vendas por Status -->
        <div class="ds-card">
          <div class="ds-card-title">🛒 Vendas por Situação</div>
          ${this.#renderVendasStatus(r.vendas.lista)}
        </div>

        <!-- Estoque em Alerta -->
        ${(r.estoque.alertas.length + r.estoque.zerados.length) > 0 ? `
        <div class="ds-card">
          <div class="ds-card-title">⚠️ Estoque em Alerta</div>
          ${[...r.estoque.zerados.slice(0, 3), ...r.estoque.alertas.slice(0, 5)].map(m => `
            <div class="est-row">
              <span>${m.saldo <= 0 ? "🔴" : "🟡"}</span>
              <span style="flex:1;font-size:12px">${esc(m.nome)}</span>
              <span style="font-size:11px;color:var(--muted)">mín: ${m.estoque_minimo || 0}</span>
              <span style="font-weight:700;font-size:12px;color:${m.saldo <= 0 ? "var(--error)" : "var(--warning)"}">${Number(m.saldo).toFixed(2)}</span>
            </div>`).join("")}
        </div>` : ""}

        <!-- Próximos vencimentos -->
        ${r.lancamentos.length > 0 ? `
        <div class="ds-card">
          <div class="ds-card-title">📅 Próximos Vencimentos</div>
          ${r.lancamentos
            .filter(l => l.status === "pendente" && l.data_vencimento)
            .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
            .slice(0, 6)
            .map(l => {
              const atrasado = l.data_vencimento < hoje;
              return `
              <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:.5px solid var(--border)">
                <span style="font-size:13px;font-weight:700;color:${l.tipo === "receita" ? "var(--success)" : "var(--error)"}">${l.tipo === "receita" ? "▲" : "▼"}</span>
                <span style="flex:1;font-size:12px">${esc(l.descricao)}</span>
                <span style="font-size:11px;color:${atrasado ? "var(--error)" : "var(--muted)"};font-weight:${atrasado ? "700" : "400"}">${fmtData(l.data_vencimento)}</span>
                <span style="font-size:12px;font-weight:600">${fmtBRL(l.valor)}</span>
              </div>`;
            }).join("") || `<div style="color:var(--muted);font-size:13px;padding:8px 0">Nenhum vencimento pendente.</div>`}
        </div>` : ""}

      </div>
    `;
  }

  afterRender() {
    this.$("#filtro-mes")?.addEventListener("change", async e => {
      this.#mes = e.target.value;
      actions.setCache(`dashboard_${this.#mes}`, null);
      await this.#carregar();
    });
  }

  #renderPontoEquilibrio(fin) {
    const pontEq = fin.despesas > 0 ? fin.despesas : 1;
    const pct = Math.min((fin.receitas / pontEq) * 100, 100);
    const atingido = fin.receitas >= pontEq;
    return `
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">
        <span>Receita: ${fmtBRL(fin.receitas)}</span>
        <span style="font-weight:700;color:${atingido ? "var(--success)" : "var(--primary-light)"}">${pct.toFixed(0)}% ${atingido ? "✅" : "⏳"}</span>
      </div>
      <div class="prog-track">
        <div class="prog-fill" style="width:${pct}%;background:${atingido ? "var(--success)" : "var(--primary)"}"></div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:3px">
        Meta: ${fmtBRL(pontEq)} · ${atingido ? "Ponto de equilíbrio atingido" : "Faltam " + fmtBRL(pontEq - fin.receitas)}
      </div>`;
  }

  #renderAvisos(r, vencidos) {
    const items = [];
    vencidos.slice(0, 3).forEach(l => {
      const dias = Math.floor((new Date() - new Date(l.data_vencimento)) / 86400000);
      items.push({ tipo: "danger", icon: "!", title: `${l.tipo === "receita" ? "Recebimento" : "Pagamento"} em atraso — ${l.descricao}`, body: `${fmtBRL(l.valor)} · venceu há ${dias} dia${dias !== 1 ? "s" : ""}` });
    });
    r.estoque.zerados.slice(0, 2).forEach(m =>
      items.push({ tipo: "danger", icon: "!", title: `Estoque zerado — ${m.nome}`, body: "Repor imediatamente" })
    );
    r.estoque.alertas.slice(0, 2).forEach(m =>
      items.push({ tipo: "warn", icon: "▲", title: `Estoque baixo — ${m.nome}`, body: `Saldo: ${Number(m.saldo).toFixed(2)} / Mínimo: ${m.estoque_minimo}` })
    );
    if (!items.length)
      items.push({ tipo: "success", icon: "✓", title: "Tudo em dia!", body: "Nenhum alerta no momento." });

    const cfg = {
      danger:  { bg: "rgba(171,0,0,.08)", border: "rgba(171,0,0,.25)", iconBg: "var(--error)" },
      warn:    { bg: "rgba(232,160,16,.08)", border: "rgba(232,160,16,.25)", iconBg: "var(--warning)" },
      success: { bg: "rgba(0,172,23,.08)", border: "rgba(0,172,23,.25)", iconBg: "var(--success)" },
    };
    return items.map(it => {
      const c = cfg[it.tipo];
      return `<div class="aviso-item" style="background:${c.bg};border:.5px solid ${c.border}">
        <div class="aviso-icon" style="background:${c.iconBg}">${it.icon}</div>
        <div>
          <div class="aviso-title">${esc(it.title)}</div>
          <div class="aviso-body">${esc(it.body)}</div>
        </div>
      </div>`;
    }).join("");
  }

  #renderVendasStatus(lista) {
    const STATUS = [
      { id: "pendente",    label: "Pendente",    cor: "#F79009" },
      { id: "em_execucao", label: "Em execução", cor: "#007CBE" },
      { id: "pronto",      label: "Pronto",      cor: "#0008FF" },
      { id: "entregue",    label: "Entregue",    cor: "#00AC17" },
      { id: "cancelado",   label: "Cancelado",   cor: "#AB0000" },
    ];
    const total = lista.length || 1;
    return STATUS.map(s => {
      const count = lista.filter(v => v.status === s.id).length;
      const pct   = ((count / total) * 100).toFixed(0);
      return `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span style="color:var(--muted)">${s.label}</span>
            <span style="font-weight:700;color:${s.cor}">${count} (${pct}%)</span>
          </div>
          <div class="prog-track">
            <div class="prog-fill" style="width:${pct}%;background:${s.cor}"></div>
          </div>
        </div>`;
    }).join("");
  }
}
