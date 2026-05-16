/**
 * ORÇAMENTOS VIEW — Calculadora de impressão m², histórico e conversão em venda.
 * Arquitetura: class-based view consumindo OrcamentoService.
 */

import { services }        from "../core/services.js";
import { fmtBRL }          from "../utils/fmt.js";
import { Btn, StatusBadge } from "./components/index.js";

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES DE DOMÍNIO
// ══════════════════════════════════════════════════════════════════════════════
const MATERIAIS = [
  { id: "papel_comum",   label: "Papel Comum 75g",  preco: 30 },
  { id: "papel_matte",   label: "Papel Matte 108g", preco: 50 },
  { id: "adesivo_vinil", label: "Adesivo Vinil",    preco: 90 },
  { id: "adesivo_papel", label: "Adesivo de Papel", preco: 75 },
  { id: "lona",          label: "Lona",             preco: 90 },
];

const ACRESCIMO_SEM_ARTE = 0.20;

const PAPEIS_CFG = {
  A4:   { w: 21,  h: 29.7, margem: 1.0, label: "A4",   desc: "21×29,7cm" },
  A3:   { w: 42,  h: 29.7, margem: 1.0, label: "A3",   desc: "42×29,7cm" },
  SRA3: { w: 32,  h: 45,   margem: 1.0, label: "SRA3", desc: "32×45cm"   },
};

// ══════════════════════════════════════════════════════════════════════════════
// VIEW
// ══════════════════════════════════════════════════════════════════════════════
export class OrcamentosView {
  constructor() {
    this._container = null;
    this._state = {
      aba: "form",
      materialId: "adesivo_vinil",
      temArte: true,
      largura: "",
      altura: "",
      quantidade: 1,
      itens: [],
      observacoes: "",
      arredondar: false,
      calcFolhasAberto: false,
      calcFolhas: { papel: "A4", larg: "", alt: "", qtd: "", tipo: "adesivo" },
      resultado: { area: 0, unitario: 0, total: 0, acrescimoCustoOp: 0, totalItens: 0, grand: 0, grandArredondado: 0 },
      // dados do servidor
      orcamentos: [],
      clientes: [],
      produtos: [],
      custoOperacionalPct: 0,
      aberto: null,
      loading: true,
    };
  }

  // ─── Entry point (compatível com router.mount) ───────────────────────────
  async mount(container) {
    this._container = container;
    container.innerHTML = `<div class="loading-view"><i class="fi fi-rr-file-invoice"></i><span>Carregando orçamentos…</span></div>`;
    await this._carregar();
    this._render();
  }

  // ─── Busca dados ─────────────────────────────────────────────────────────
  async _carregar() {
    try {
      const [orcamentos, clientes, produtos, cfg] = await Promise.all([
        services.orcamento.listar(),
        services.cliente.listar(),
        services.produto ? services.produto.listar() : [],
        services.config.carregar().catch(() => ({})),
      ]);
      this._state.orcamentos          = orcamentos  || [];
      this._state.clientes            = clientes    || [];
      this._state.produtos            = produtos    || [];
      this._state.custoOperacionalPct = Number(cfg?.empresa?.custo_operacional_pct || 0);
    } catch (e) {
      console.error("[Orçamentos] Erro ao carregar:", e);
    } finally {
      this._state.loading = false;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  _render() {
    const s = this._state;
    const c = this._container;
    c.innerHTML = `
      <style>${this._css()}</style>

      <div class="orc-topbar">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Orçamentos</h2>
          <span style="font-size:12px;color:var(--muted)">${s.orcamentos.length} orçamento${s.orcamentos.length !== 1 ? "s" : ""} salvos</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${s.aba !== "historico" ? `
          <button class="btn-calc-folhas ${s.calcFolhasAberto ? "active" : ""}" id="btn-calc-folhas">
            <i class="fi fi-rr-ruler-triangle"></i> Calc. Folhas
          </button>` : ""}
          <button class="btn-hist ${s.aba === "historico" ? "active" : ""}" id="btn-historico">
            <i class="fi fi-rr-clock"></i> Histórico
            ${s.orcamentos.length > 0 ? `<span class="hist-badge">${s.orcamentos.length}</span>` : ""}
          </button>
          <button class="btn-novo-orc" id="btn-novo">
            <i class="fi fi-rr-add"></i> Novo Orçamento
          </button>
        </div>
      </div>

      ${s.aba === "historico" ? this._renderHistorico() : this._renderForm()}
    `;
    this._bindEvents();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CALCULADORA DE FOLHAS
  // ══════════════════════════════════════════════════════════════════════════
  _calcularFolhas() {
    const cf = this._state.calcFolhas;
    const papel = PAPEIS_CFG[cf.papel];
    const m2 = papel.margem * 2;
    const uw = +(papel.w - m2).toFixed(2);
    const uh = +(papel.h - m2).toFixed(2);
    const iw = parseFloat(cf.larg) || 0;
    const ih = parseFloat(cf.alt)  || 0;
    const qtd = parseInt(cf.qtd)   || 0;
    const esp = cf.tipo === "tag" ? 0.30 : 0.15;
    if (iw <= 0 || ih <= 0) return { uw, uh, esp, pronto: false };
    const c1 = Math.floor((uw + esp) / (iw + esp));
    const r1 = Math.floor((uh + esp) / (ih + esp));
    const p1 = c1 * r1;
    const c2 = Math.floor((uw + esp) / (ih + esp));
    const r2 = Math.floor((uh + esp) / (iw + esp));
    const p2 = c2 * r2;
    const rotated = p2 > p1;
    const cols = rotated ? c2 : c1, rows = rotated ? r2 : r1;
    const perSheet = Math.max(p1, p2);
    const sheetsNeeded = (qtd > 0 && perSheet > 0) ? Math.ceil(qtd / perSheet) : 0;
    return { uw, uh, esp, cols, rows, perSheet, sheetsNeeded, rotated, qtd, pronto: true };
  }

  _atualizarCalcFolhasDOM() {
    const c = this._container;
    const resEl = c.querySelector("#cf-resultado");
    if (!resEl) return;
    const res  = this._calcularFolhas();
    const cf   = this._state.calcFolhas;
    const util = c.querySelector(".cf-util-info");
    if (util) util.innerHTML = `Área útil: <strong>${res.uw}×${res.uh}cm</strong> · espaçamento: <strong>${res.esp}cm</strong>`;
    if (!res.pronto) {
      resEl.innerHTML = `<div class="cf-hint"><i class="fi fi-rr-info"></i> Preencha largura e altura para calcular.</div>`;
      return;
    }
    if (res.perSheet === 0) {
      resEl.innerHTML = `<div class="cf-sem-fit">⚠️ O item é maior que a área útil desta folha.</div>`;
      return;
    }
    resEl.innerHTML = `
      <div class="cf-res-cards">
        <div class="cf-res-card">
          <div class="cf-res-num">${res.cols} × ${res.rows}</div>
          <div class="cf-res-label">colunas × linhas</div>
          ${res.rotated ? `<div class="cf-rotated"><i class="fi fi-rr-rotate-right"></i> melhor rotacionado</div>` : ""}
        </div>
        <div class="cf-res-card primary">
          <div class="cf-res-num">${res.perSheet}</div>
          <div class="cf-res-label">por folha</div>
        </div>
        ${res.qtd > 0 ? `
        <div class="cf-res-card">
          <div class="cf-res-num">${res.sheetsNeeded}</div>
          <div class="cf-res-label">folha${res.sheetsNeeded !== 1 ? "s" : ""} p/ ${res.qtd} un.</div>
        </div>` : `<div class="cf-res-card muted"><div class="cf-res-num">—</div><div class="cf-res-label">informe qty</div></div>`}
      </div>`;
  }

  _renderCalculadoraFolhas() {
    const cf    = this._state.calcFolhas;
    const res   = this._calcularFolhas();
    const papel = PAPEIS_CFG[cf.papel];
    return `
    <div class="calc-folhas-wrap" id="calc-folhas-wrap">
      <div class="calc-folhas-header">
        <div style="display:flex;align-items:center;gap:8px">
          <i class="fi fi-rr-ruler-triangle" style="color:var(--primary-light)"></i>
          <span style="font-weight:700;font-size:14px">Calculadora de Folhas</span>
          <span style="font-size:11px;color:var(--muted)">Quantos adesivos / etiquetas cabem por folha</span>
        </div>
        <button class="cf-close-btn" id="cf-close">✕</button>
      </div>
      <div class="calc-folhas-body">
        <div class="cf-section">
          <div class="cf-section-label">Tamanho da folha</div>
          <div class="cf-papeis-row">
            ${Object.entries(PAPEIS_CFG).map(([k, p]) => `
              <button class="cf-papel-btn ${cf.papel === k ? "active" : ""}" data-cf-papel="${k}">
                <div class="cf-papel-nome">${p.label}</div>
                <div class="cf-papel-dim">${p.desc}</div>
                <div class="cf-papel-margem">margem ${p.margem}cm</div>
              </button>`).join("")}
          </div>
          <div class="cf-util-info">
            Área útil: <strong>${res.uw}×${res.uh}cm</strong>
          </div>
        </div>
        <div class="cf-section">
          <div class="cf-section-label">Tipo de material</div>
          <div class="cf-tipo-switch">
            <button class="cf-tipo-btn ${cf.tipo === "adesivo" ? "active" : ""}" data-cf-tipo="adesivo">
              <span class="cf-tipo-icon">🏷️</span>
              <span class="cf-tipo-nome">Adesivo</span>
              <span class="cf-tipo-esp">esp. 0,15cm</span>
            </button>
            <button class="cf-tipo-btn ${cf.tipo === "tag" ? "active tag" : ""}" data-cf-tipo="tag">
              <span class="cf-tipo-icon">🔖</span>
              <span class="cf-tipo-nome">Tag / Etiqueta</span>
              <span class="cf-tipo-esp">esp. 0,30cm</span>
            </button>
          </div>
          <div class="cf-section-label" style="margin-top:10px">Dimensões</div>
          <div class="cf-inputs-row">
            <div class="cf-field"><label>Largura (cm)</label><input id="cf-larg" type="number" min="0.1" step="0.1" value="${esc(cf.larg)}" placeholder="5" /></div>
            <div class="cf-field"><label>Altura (cm)</label><input id="cf-alt"  type="number" min="0.1" step="0.1" value="${esc(cf.alt)}"  placeholder="5" /></div>
            <div class="cf-field"><label>Qtd total</label>  <input id="cf-qtd"  type="number" min="1"   step="1"   value="${esc(cf.qtd)}"  placeholder="100" /></div>
          </div>
        </div>
        <div class="cf-section" id="cf-resultado">
          <div class="cf-hint"><i class="fi fi-rr-info"></i> Preencha largura e altura para calcular automaticamente.</div>
        </div>
      </div>
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FORMULÁRIO PRINCIPAL
  // ══════════════════════════════════════════════════════════════════════════
  _renderForm() {
    const s   = this._state;
    const r   = s.resultado;
    const mat = MATERIAIS.find(m => m.id === s.materialId) || MATERIAIS[0];
    const totalItensTabela = s.itens.reduce((sum, i) => sum + i.preco * i.qtd, 0);
    const valorExibido = s.arredondar ? r.grandArredondado : r.grand;

    return `
    ${s.calcFolhasAberto ? this._renderCalculadoraFolhas() : ""}

    <div class="orc-layout">
      <!-- ── COLUNA ESQUERDA ──────────────────────────────────────────────── -->
      <div class="orc-left">

        <!-- Materiais -->
        <div class="orc-card">
          <div class="orc-card-title"><i class="fi fi-rr-layers"></i> Material</div>
          <div class="mat-grid">
            ${MATERIAIS.map(m => `
              <button class="mat-btn ${s.materialId === m.id ? "active" : ""}" data-mat="${m.id}">
                ${m.label}
              </button>`).join("")}
          </div>
        </div>

        <!-- Medidas -->
        <div class="orc-card">
          <div class="orc-card-title"><i class="fi fi-rr-ruler"></i> Medidas e Quantidade</div>
          <div class="med-grid">
            <div class="field-group"><label>Largura (cm)</label><input id="f-larg" type="number" min="0" step="0.1" placeholder="0" value="${s.largura}" /></div>
            <div class="field-group"><label>Altura (cm)</label> <input id="f-alt"  type="number" min="0" step="0.1" placeholder="0" value="${s.altura}" /></div>
            <div class="field-group"><label>Quantidade</label>  <input id="f-qtd"  type="number" min="1" step="1"   value="${s.quantidade}" /></div>
          </div>
          <div class="arte-row">
            <span class="arte-label"><i class="fi fi-rr-pencil"></i> Tem arte?</span>
            <div class="arte-opts">
              <label class="arte-opt"><input type="radio" name="arte" value="sim" ${s.temArte  ? "checked" : ""} /><span class="arte-chip ${s.temArte  ? "active" : ""}">Sim</span></label>
              <label class="arte-opt"><input type="radio" name="arte" value="nao" ${!s.temArte ? "checked" : ""} /><span class="arte-chip ${!s.temArte ? "active nao" : ""}">Não</span></label>
            </div>
          </div>
        </div>

        <!-- Produtos / Serviços -->
        <div class="orc-card">
          <div class="orc-card-title"><i class="fi fi-rr-box-open"></i> Produtos / Serviços</div>
          <div class="add-item-row">
            <div class="field-group" style="flex:2;min-width:0">
              <label>Produto / Serviço</label>
              <div class="autocomplete-wrap">
                <input id="ai-prod" placeholder="Digite para buscar ou adicionar..." autocomplete="off" />
                <div class="autocomplete-list" id="ac-prod"></div>
              </div>
            </div>
            <div class="field-group" style="width:80px"><label>Preço R$</label><input id="ai-preco" type="number" min="0" step="0.01" placeholder="0,00" /></div>
            <div class="field-group" style="width:70px"><label>Qtd</label><input id="ai-qtd-item" type="number" min="1" step="1" value="1" /></div>
            <button class="btn-add-item" id="btn-add-item"><i class="fi fi-rr-add"></i></button>
          </div>

          ${s.itens.length > 0 ? `
          <div class="itens-tabela-wrap">
            <table class="itens-tabela">
              <thead><tr><th>Produto / Serviço</th><th style="text-align:center">Preço</th><th style="text-align:center">Qtd</th><th style="text-align:right">Total</th><th style="width:32px"></th></tr></thead>
              <tbody>
                ${s.itens.map((it, i) => `
                  <tr>
                    <td>${esc(it.descricao)}</td>
                    <td style="text-align:center">${fmtBRL(it.preco)}</td>
                    <td style="text-align:center">${it.qtd}</td>
                    <td style="text-align:right;font-weight:600;color:var(--primary)">${fmtBRL(it.preco * it.qtd)}</td>
                    <td><button class="del-item" data-del="${i}">✕</button></td>
                  </tr>`).join("")}
              </tbody>
              <tfoot>
                <tr class="itens-total-row">
                  <td colspan="3" style="text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Total produtos/serviços</td>
                  <td style="text-align:right;font-weight:800;font-size:15px;color:var(--primary-light)">${fmtBRL(totalItensTabela)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>` : `<div class="itens-vazio"><i class="fi fi-rr-inbox"></i> Nenhum item adicionado</div>`}
        </div>

        <!-- Observações -->
        <div class="orc-card">
          <div class="orc-card-title"><i class="fi fi-rr-comment"></i> Observações</div>
          <textarea id="f-obs" rows="3" placeholder="Prazo de entrega, acabamento, condições de pagamento...">${esc(s.observacoes)}</textarea>
        </div>
      </div>

      <!-- ── COLUNA DIREITA ─────────────────────────────────────────────── -->
      <div class="orc-right">

        <!-- Resultado -->
        <div class="orc-card resultado-card">
          <div class="orc-card-title"><i class="fi fi-rr-chart-histogram"></i> Resultado</div>
          <div class="material-sel-info">
            <span class="mat-label-tag">${mat.label}</span>
            ${!s.temArte ? `<span class="arte-tag">+ Arte 20%</span>` : ""}
          </div>
          <div class="res-linhas">
            <div class="res-linha"><span>Área</span><span id="r-area">${r.area.toFixed(4)} m²</span></div>
            <div class="res-linha"><span>Unitário</span><span id="r-unit">${fmtBRL(r.unitario)}</span></div>
            <div class="res-linha"><span>Subtotal impressão</span><span id="r-subtotal">${fmtBRL(r.total)}</span></div>
            ${s.custoOperacionalPct > 0 ? `
            <div class="res-linha custo-op-linha">
              <span><i class="fi fi-rr-settings"></i> Custo operacional (${s.custoOperacionalPct}%)</span>
              <span class="custo-op-val" id="r-custo-op">${fmtBRL(r.acrescimoCustoOp)}</span>
            </div>` : ""}
            ${s.itens.length > 0 ? `<div class="res-linha"><span>Produtos/Serviços</span><span id="r-itens">${fmtBRL(r.totalItens)}</span></div>` : ""}
          </div>

          <div class="arredondar-row">
            <span class="arredondar-label"><i class="fi fi-rr-arrows-alt-h"></i> Arredondar total</span>
            <div class="arte-opts">
              <label class="arte-opt"><input type="radio" name="arredondar" value="nao" ${ !s.arredondar ? "checked" : ""} /><span class="arte-chip ${ !s.arredondar ? "active" : ""}">Não</span></label>
              <label class="arte-opt"><input type="radio" name="arredondar" value="sim" ${  s.arredondar ? "checked" : ""} /><span class="arte-chip ${  s.arredondar ? "active" : ""}">Sim</span></label>
            </div>
          </div>
          ${s.arredondar ? `<div class="arredondar-info">Valor arredondado para múltiplo de <strong>R$&nbsp;5</strong></div>` : ""}

          <div class="res-total">
            <span>TOTAL</span>
            <span id="r-total">${fmtBRL(valorExibido)}</span>
          </div>
        </div>

        <!-- Ações -->
        <div class="orc-card">
          <div class="orc-card-title"><i class="fi fi-rr-cursor"></i> Ações</div>
          <div class="acoes-grid">
            ${r.total > 0 ? `<button class="btn-acao info" id="btn-add-m2-lista"><i class="fi fi-rr-plus"></i> Adicionar impressão à lista</button>` : ""}
            <button class="btn-acao primary" id="btn-salvar"><i class="fi fi-rr-disk"></i> Salvar Orçamento</button>
            <button class="btn-acao warn"    id="btn-pdf">   <i class="fi fi-rr-file-pdf"></i> Gerar PDF / Imprimir</button>
            ${s.aberto ? `<button class="btn-acao success" id="btn-converter"><i class="fi fi-rr-arrow-right"></i> Converter em Venda</button>` : ""}
            <button class="btn-acao danger"  id="btn-limpar"><i class="fi fi-rr-trash"></i> Limpar</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HISTÓRICO
  // ══════════════════════════════════════════════════════════════════════════
  _renderHistorico() {
    const s = this._state;
    if (!s.orcamentos.length) {
      return `<div class="hist-vazio"><i class="fi fi-rr-file-invoice"></i><p>Nenhum orçamento salvo ainda.</p></div>`;
    }
    return `
    <div class="hist-lista">
      ${s.orcamentos.map(o => `
        <div class="hist-card">
          <div class="hist-card-top">
            <div>
              <div class="hist-cliente">${esc(o.cliente_nome || "Sem cliente")}</div>
              <div class="hist-data">${new Date(o.created_at).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" })}</div>
            </div>
            <div style="text-align:right">
              <div class="hist-valor">${fmtBRL(o.total)}</div>
              <span class="hist-badge-st">${StatusBadge(o.status)}</span>
            </div>
          </div>
          ${o.observacoes ? `<div class="hist-obs">${esc(o.observacoes)}</div>` : ""}
          <div class="hist-acoes">
            ${Btn.ghost(`<i class="fi fi-rr-edit"></i> Abrir`, `abrir-${o.id}`)}
            ${Btn.primary(`<i class="fi fi-rr-arrow-right"></i> Converter`, `conv-${o.id}`)}
            ${Btn.icon(`<i class="fi fi-rr-trash"></i>`, `del-orc-${o.id}`, true)}
          </div>
        </div>`).join("")}
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CÁLCULO
  // ══════════════════════════════════════════════════════════════════════════
  _calcular() {
    const s   = this._state;
    const larg = parseFloat(s.largura) / 100 || 0;
    const alt  = parseFloat(s.altura)  / 100 || 0;
    const qtd  = parseInt(s.quantidade) || 1;
    const mat  = MATERIAIS.find(m => m.id === s.materialId) || MATERIAIS[0];
    const area = larg * alt;
    let unitario = area * mat.preco;
    if (!s.temArte) unitario *= (1 + ACRESCIMO_SEM_ARTE);
    const total           = unitario * qtd;
    const totalItens      = s.itens.reduce((sum, i) => sum + i.preco * i.qtd, 0);
    const acrescimoCustoOp = s.custoOperacionalPct > 0 && total > 0
      ? total * (s.custoOperacionalPct / 100) : 0;
    const grand           = total + acrescimoCustoOp + totalItens;
    const grandArredondado = Math.ceil(grand / 5) * 5;
    s.resultado = { area, unitario, total, acrescimoCustoOp, totalItens, grand, grandArredondado };
    this._atualizarResultadoDOM();
  }

  _atualizarResultadoDOM() {
    const r  = this._state.resultado;
    const s  = this._state;
    const c  = this._container;
    const set = (id, v) => { const el = c?.querySelector(`#${id}`); if (el) el.textContent = v; };
    set("r-area",     r.area.toFixed(4) + " m²");
    set("r-unit",     fmtBRL(r.unitario));
    set("r-subtotal", fmtBRL(r.total));
    set("r-custo-op", "+ " + fmtBRL(r.acrescimoCustoOp));
    set("r-itens",    fmtBRL(r.totalItens));
    set("r-total",    fmtBRL(s.arredondar ? r.grandArredondado : r.grand));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EVENTOS
  // ══════════════════════════════════════════════════════════════════════════
  _bindEvents() {
    const c = this._container;
    const s = this._state;

    // Cabeçalho
    c.querySelector("#btn-calc-folhas")?.addEventListener("click", () => {
      s.calcFolhasAberto = !s.calcFolhasAberto;
      this._render();
      if (s.calcFolhasAberto) this._atualizarCalcFolhasDOM();
    });
    c.querySelector("#btn-historico")?.addEventListener("click", () => {
      s.aba = s.aba === "historico" ? "form" : "historico";
      this._render();
    });
    c.querySelector("#btn-novo")?.addEventListener("click", () => {
      this._limparForm(); s.aba = "form"; this._render();
    });

    if (s.aba === "historico") { this._bindHistoricoEvents(); return; }

    // Calculadora de folhas
    if (s.calcFolhasAberto) {
      this._bindCalcFolhasEvents();
      this._atualizarCalcFolhasDOM();
    }

    // Materiais
    c.querySelectorAll("[data-mat]").forEach(btn =>
      btn.addEventListener("click", () => {
        s.materialId = btn.dataset.mat;
        this._calcular();
        this._render();
      })
    );

    // Inputs medidas
    ["f-larg", "f-alt", "f-qtd"].forEach(id => {
      c.querySelector(`#${id}`)?.addEventListener("input", e => {
        if (id === "f-larg") s.largura   = e.target.value;
        if (id === "f-alt")  s.altura    = e.target.value;
        if (id === "f-qtd")  s.quantidade = e.target.value;
        this._calcular();
      });
    });

    // Arte
    c.querySelectorAll("input[name='arte']").forEach(inp =>
      inp.addEventListener("change", () => {
        s.temArte = inp.value === "sim";
        this._calcular();
        this._render();
      })
    );

    // Arredondar
    c.querySelectorAll("input[name='arredondar']").forEach(inp =>
      inp.addEventListener("change", () => {
        s.arredondar = inp.value === "sim";
        this._calcular();
        this._render();
      })
    );

    // Observações
    c.querySelector("#f-obs")?.addEventListener("input", e => { s.observacoes = e.target.value; });

    // Autocomplete produtos
    const aiProd = c.querySelector("#ai-prod");
    const acList = c.querySelector("#ac-prod");
    if (aiProd) {
      aiProd.addEventListener("input", () => {
        const q = aiProd.value.trim().toLowerCase();
        if (!q) { acList.innerHTML = ""; acList.style.display = "none"; return; }
        const matches = s.produtos.filter(p => p.nome.toLowerCase().includes(q)).slice(0, 6);
        if (!matches.length) { acList.style.display = "none"; return; }
        acList.innerHTML = matches.map(p => `<div class="ac-item" data-nome="${esc(p.nome)}">${esc(p.nome)}</div>`).join("");
        acList.style.display = "block";
      });
      acList.addEventListener("click", e => {
        const it = e.target.closest(".ac-item");
        if (!it) return;
        aiProd.value = it.dataset.nome;
        acList.style.display = "none";
      });
    }

    // Adicionar item
    c.querySelector("#btn-add-item")?.addEventListener("click", () => {
      const desc  = c.querySelector("#ai-prod").value.trim();
      const preco = parseFloat(c.querySelector("#ai-preco").value) || 0;
      const qtd   = parseInt(c.querySelector("#ai-qtd-item").value) || 1;
      if (!desc)  { flashInput(c.querySelector("#ai-prod"));  return; }
      if (!preco) { flashInput(c.querySelector("#ai-preco")); return; }
      s.itens.push({ descricao: desc, preco, qtd });
      c.querySelector("#ai-prod").value          = "";
      c.querySelector("#ai-preco").value         = "";
      c.querySelector("#ai-qtd-item").value      = "1";
      this._calcular();
      this._render();
    });

    // Remover item
    c.querySelectorAll("[data-del]").forEach(btn =>
      btn.addEventListener("click", () => {
        s.itens.splice(parseInt(btn.dataset.del), 1);
        this._calcular();
        this._render();
      })
    );

    // Adicionar impressão à lista
    c.querySelector("#btn-add-m2-lista")?.addEventListener("click", () => this._adicionarImpressaoNaLista());

    // Ações
    c.querySelector("#btn-salvar")?.addEventListener("click",    () => this._salvar());
    c.querySelector("#btn-limpar")?.addEventListener("click",    () => { this._limparForm(); this._render(); });
    c.querySelector("#btn-pdf")?.addEventListener("click",       () => this._gerarPDF());
    c.querySelector("#btn-converter")?.addEventListener("click", () => this._abrirModalConverter());

    // Cálculo inicial
    this._calcular();
  }

  _bindCalcFolhasEvents() {
    const c = this._container;
    const s = this._state;
    c.querySelector("#cf-close")?.addEventListener("click", () => {
      s.calcFolhasAberto = false; this._render();
    });
    c.querySelectorAll("[data-cf-tipo]").forEach(btn =>
      btn.addEventListener("click", () => {
        s.calcFolhas.tipo = btn.dataset.cfTipo;
        c.querySelectorAll("[data-cf-tipo]").forEach(b => b.classList.remove("active", "tag"));
        btn.classList.add("active");
        if (btn.dataset.cfTipo === "tag") btn.classList.add("tag");
        this._atualizarCalcFolhasDOM();
      })
    );
    c.querySelectorAll("[data-cf-papel]").forEach(btn =>
      btn.addEventListener("click", () => {
        s.calcFolhas.papel = btn.dataset.cfPapel;
        c.querySelectorAll("[data-cf-papel]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this._atualizarCalcFolhasDOM();
      })
    );
    ["cf-larg", "cf-alt", "cf-qtd"].forEach(id => {
      c.querySelector(`#${id}`)?.addEventListener("input", e => {
        s.calcFolhas[id.replace("cf-", "")] = e.target.value;
        this._atualizarCalcFolhasDOM();
      });
    });
  }

  _bindHistoricoEvents() {
    const c = this._container;
    const s = this._state;

    // Abrir
    s.orcamentos.forEach(o => {
      c.querySelector(`#abrir-${o.id}`)?.addEventListener("click", async () => {
        const itens = await services.orcamento.buscarItens(o.id);
        s.itens       = (itens || []).map(i => ({ descricao: i.descricao, preco: Number(i.preco_unitario), qtd: Number(i.quantidade) }));
        s.observacoes = o.observacoes || "";
        s.aberto      = o;
        s.aba         = "form";
        this._render();
      });

      // Converter do histórico
      c.querySelector(`#conv-${o.id}`)?.addEventListener("click", () => {
        s.aberto = o; s.aba = "form"; this._render();
        this._abrirModalConverter();
      });

      // Excluir
      c.querySelector(`#del-orc-${o.id}`)?.addEventListener("click", async () => {
        if (!confirm(`Excluir orçamento de "${o.cliente_nome || "sem cliente"}"?`)) return;
        await services.orcamento.deletar(o.id);
        await this._carregar();
        this._render();
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AÇÕES
  // ══════════════════════════════════════════════════════════════════════════
  _adicionarImpressaoNaLista() {
    const s   = this._state;
    const r   = s.resultado;
    const mat = MATERIAIS.find(m => m.id === s.materialId) || MATERIAIS[0];
    if (!s.largura || !s.altura || r.unitario <= 0) return;
    const descricao = `${mat.label} ${s.largura}×${s.altura}cm`;
    const qtd = parseInt(s.quantidade) || 1;
    const produtoMatch = s.produtos.find(p =>
      p.nome.toLowerCase().includes(mat.label.toLowerCase().split(" ")[0])
    );
    s.itens.push({ descricao, produtoId: produtoMatch?.id || null, preco: r.unitario, qtd });
    this._calcular();
    this._render();
    this._showToast(`✅ "${descricao}" adicionado à lista!`);
  }

  async _salvar() {
    const s   = this._state;
    const mat = MATERIAIS.find(m => m.id === s.materialId);
    const desc = `${mat?.label || "Impressão"} ${s.largura || 0}×${s.altura || 0}cm`;
    const totalFinal = s.arredondar ? s.resultado.grandArredondado : s.resultado.grand;

    const itensDb = [];
    if (s.resultado.total > 0) {
      itensDb.push({
        produto_id: null, descricao: desc, tipo_calculo: "m2",
        largura_cm: parseFloat(s.largura) || 0, altura_cm: parseFloat(s.altura) || 0,
        quantidade: parseInt(s.quantidade) || 1,
        preco_unitario: s.resultado.unitario, total: s.resultado.total,
      });
    }
    s.itens.forEach(it => itensDb.push({
      produto_id: it.produtoId || null, descricao: it.descricao,
      tipo_calculo: "unidade", quantidade: it.qtd,
      preco_unitario: it.preco, total: it.preco * it.qtd,
    }));

    try {
      await services.orcamento.criar({ cliente_nome: null, observacoes: s.observacoes || null, status: "rascunho", total: totalFinal }, itensDb);
      await this._carregar();
      this._showToast("✅ Orçamento salvo!");
      this._render();
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
  }

  _gerarPDF() {
    const s   = this._state;
    const r   = s.resultado;
    const mat = MATERIAIS.find(m => m.id === s.materialId);
    const totalFinal = s.arredondar ? r.grandArredondado : r.grand;
    const linhas = [];
    if (r.total > 0) linhas.push({ desc: `${mat?.label || "Impressão"} ${s.largura || 0}×${s.altura || 0}cm`, qtd: s.quantidade, preco: r.unitario, total: r.total });
    s.itens.forEach(it => linhas.push({ desc: it.descricao, qtd: it.qtd, preco: it.preco, total: it.preco * it.qtd }));

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Orçamento – Gráfica Master Print</title>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
  h1 { font-size: 22px; margin: 0; }
  .sub { font-size: 12px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #283D3B; color: white; padding: 8px 12px; text-align: left; font-size: 12px; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  .total-row td { font-weight: bold; background: #f9f9f9; }
  .obs { margin-top: 20px; padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 12px; }
  .footer { margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
</style></head><body>
<h1>Gráfica Master Print</h1>
<div class="sub">R. Elieser Pena, 67, Centro – Poté/MG · (33) 99813-9539 · @gmasterprint</div>
<hr>
<strong>ORÇAMENTO</strong> — ${new Date().toLocaleDateString("pt-BR")}
<table>
  <thead><tr><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead>
  <tbody>
    ${linhas.map(l => `<tr><td>${l.desc}</td><td>${l.qtd}</td><td>${fmtBRL(l.preco)}</td><td>${fmtBRL(l.total)}</td></tr>`).join("")}
    <tr class="total-row"><td colspan="3" style="text-align:right">TOTAL</td><td>${fmtBRL(totalFinal)}</td></tr>
  </tbody>
</table>
${s.observacoes ? `<div class="obs"><strong>Observações:</strong> ${esc(s.observacoes)}</div>` : ""}
<div class="footer">Este orçamento tem validade de 15 dias.</div>
</body></html>`;

    const win = window.open("", "_blank", "width=800,height=600");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  _abrirModalConverter() {
    const s   = this._state;
    const r   = s.resultado;
    const mat = MATERIAIS.find(m => m.id === s.materialId);
    const totalFinal = s.arredondar ? r.grandArredondado : r.grand;
    const area = document.getElementById("app-modal-root");
    if (!area) return;

    area.innerHTML = `
      <div class="modal-bg" id="modal-bg">
        <div class="modal" style="max-width:520px">
          <h3><i class="fi fi-rr-arrow-right" style="color:var(--primary)"></i> Converter em Venda</h3>
          <div class="conv-resumo">
            <div class="conv-res-linha"><span>Material</span><strong>${mat?.label || ""}</strong></div>
            <div class="conv-res-linha"><span>Dimensões</span><strong>${s.largura || 0}×${s.altura || 0} cm</strong></div>
            <div class="conv-res-linha"><span>Quantidade</span><strong>${s.quantidade}</strong></div>
            ${s.itens.length > 0 ? `<div class="conv-res-linha"><span>Itens adicionais</span><strong>${s.itens.length} item(s)</strong></div>` : ""}
            <div class="conv-res-linha total"><span>Total</span><strong>${fmtBRL(totalFinal)}</strong></div>
          </div>
          <div class="modal-sep"></div>
          <div class="modal-section-label">Dados do Cliente</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-bottom:10px">
            <div>
              <label>Cliente</label>
              <div class="autocomplete-wrap">
                <input id="mc-cliente" placeholder="Buscar cliente cadastrado..." autocomplete="off" value="${esc(s.aberto?.cliente_nome || "")}" />
                <div class="autocomplete-list" id="ac-cli"></div>
              </div>
            </div>
            <button class="btn-mini-cad" id="btn-cad-cli"><i class="fi fi-rr-user-add"></i> Novo</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div><label>Telefone</label><input id="mc-tel" placeholder="(00) 00000-0000" /></div>
            <div><label>Vendedor</label><input id="mc-vendedor" placeholder="Nome do vendedor" /></div>
          </div>
          <div><label>Observações da venda</label><textarea id="mc-obs" rows="2">${esc(s.observacoes)}</textarea></div>
          <div class="modal-btns">
            <button class="btn-secondary" id="mc-cancel">Cancelar</button>
            <button class="btn-primary"   id="mc-ok"><i class="fi fi-rr-check"></i> Confirmar Venda</button>
          </div>
        </div>
      </div>`;

    const mcCli = area.querySelector("#mc-cliente");
    const acCli = area.querySelector("#ac-cli");
    mcCli.addEventListener("input", () => {
      const q = mcCli.value.trim().toLowerCase();
      if (!q) { acCli.style.display = "none"; return; }
      const matches = s.clientes.filter(c => c.nome.toLowerCase().includes(q)).slice(0, 6);
      acCli.innerHTML = matches.map(c => `<div class="ac-item" data-nome="${esc(c.nome)}" data-tel="${esc(c.telefone || "")}">${esc(c.nome)}</div>`).join("");
      acCli.style.display = matches.length ? "block" : "none";
    });
    acCli.addEventListener("click", e => {
      const it = e.target.closest(".ac-item");
      if (!it) return;
      mcCli.value = it.dataset.nome;
      area.querySelector("#mc-tel").value = it.dataset.tel || "";
      acCli.style.display = "none";
    });

    area.querySelector("#btn-cad-cli").addEventListener("click", () => {
      this._abrirModalCadCliente(mcCli.value.trim(), c => {
        mcCli.value = c.nome;
        area.querySelector("#mc-tel").value = c.telefone || "";
      });
    });
    area.querySelector("#mc-cancel").addEventListener("click", () => { area.innerHTML = ""; });
    area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });

    area.querySelector("#mc-ok").addEventListener("click", async () => {
      const clienteNome = mcCli.value.trim();
      const obs         = area.querySelector("#mc-obs").value.trim();
      const vendaItens  = [];
      if (r.total > 0) vendaItens.push({
        produto_id: null,
        descricao: `${mat?.label || "Impressão"} ${s.largura || 0}×${s.altura || 0}cm`,
        quantidade: parseInt(s.quantidade) || 1, preco: r.unitario,
      });
      s.itens.forEach(it => vendaItens.push({ produto_id: it.produtoId || null, descricao: it.descricao, quantidade: it.qtd, preco: it.preco }));

      try {
        await services.venda.criar({ cliente_nome: clienteNome || null, observacoes: obs || null, status: "pendente", total: totalFinal }, vendaItens);
        await services.orcamento.criar({ cliente_nome: clienteNome || null, observacoes: obs || null, status: "aprovado", total: totalFinal }, []);
        area.innerHTML = "";
        this._showToast(`✅ Venda criada! Cliente: ${clienteNome || "Não informado"} · ${fmtBRL(totalFinal)}`);
        this._limparForm();
        await this._carregar();
        this._render();
      } catch (e) {
        alert("Erro ao criar venda: " + e.message);
      }
    });
  }

  _abrirModalCadCliente(nomeInicial, callback) {
    const area = document.getElementById("app-modal-root");
    const prev = area.innerHTML;
    area.innerHTML = `
      <div class="modal-bg" id="modal-bg-cli">
        <div class="modal" style="max-width:400px">
          <h3><i class="fi fi-rr-user-add"></i> Novo Cliente</h3>
          <label>Nome *</label><input id="cc-nome" value="${esc(nomeInicial)}" placeholder="Nome completo" autofocus />
          <label>Telefone</label><input id="cc-tel" placeholder="(00) 00000-0000" />
          <label>E-mail</label><input id="cc-email" type="email" placeholder="email@exemplo.com" />
          <div class="modal-btns">
            <button class="btn-secondary" id="cc-cancel">Cancelar</button>
            <button class="btn-primary"   id="cc-ok">Cadastrar</button>
          </div>
        </div>
      </div>`;
    area.querySelector("#cc-cancel").addEventListener("click", () => { area.innerHTML = prev; });
    area.querySelector("#cc-ok").addEventListener("click", async () => {
      const nome = area.querySelector("#cc-nome").value.trim();
      if (!nome) { alert("Informe o nome."); return; }
      try {
        const c = await services.cliente.criar({
          nome,
          telefone: area.querySelector("#cc-tel").value.trim() || null,
          email:    area.querySelector("#cc-email").value.trim() || null,
        });
        this._state.clientes.push(c);
        area.innerHTML = prev;
        callback(c);
      } catch (e) { alert("Erro: " + e.message); }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  _limparForm() {
    const s = this._state;
    s.materialId = "adesivo_vinil"; s.temArte = true;
    s.largura = ""; s.altura = ""; s.quantidade = 1;
    s.itens = []; s.observacoes = ""; s.aberto = null; s.arredondar = false;
    s.resultado = { area: 0, unitario: 0, total: 0, acrescimoCustoOp: 0, totalItens: 0, grand: 0, grandArredondado: 0 };
  }

  _showToast(msg) {
    const t = document.createElement("div");
    t.className = "orc-toast";
    t.textContent = msg;
    this._container.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CSS
  // ══════════════════════════════════════════════════════════════════════════
  _css() { return `
.orc-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:10px; }
.orc-layout { display:grid; grid-template-columns:1fr 280px; gap:16px; align-items:start; }
@media(max-width:860px){ .orc-layout { grid-template-columns:1fr; } }
.orc-card { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:16px; margin-bottom:14px; }
.orc-card-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin-bottom:14px; display:flex; align-items:center; gap:6px; }
.btn-hist { display:inline-flex; align-items:center; gap:6px; background:transparent; border:1px solid var(--border-md); color:var(--muted); border-radius:var(--radius-md); padding:7px 13px; font-size:12px; font-weight:500; cursor:pointer; transition:all var(--t); position:relative; }
.btn-hist:hover, .btn-hist.active { background:var(--panel2); color:var(--text); border-color:var(--primary); }
.btn-hist.active { color:var(--primary); }
.hist-badge { display:inline-flex; align-items:center; justify-content:center; background:var(--primary); color:#fff; font-size:10px; font-weight:700; min-width:18px; height:18px; border-radius:99px; padding:0 4px; }
.btn-novo-orc { display:inline-flex; align-items:center; gap:6px; background:var(--primary); color:#fff; border:none; border-radius:var(--radius-md); padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer; transition:all var(--t); }
.btn-calc-folhas { display:inline-flex; align-items:center; gap:6px; background:transparent; border:1px solid var(--border-md); color:var(--muted); border-radius:var(--radius-md); padding:7px 13px; font-size:12px; cursor:pointer; transition:all var(--t); }
.btn-calc-folhas.active, .btn-calc-folhas:hover { background:var(--primary-bg); color:var(--primary-light); border-color:var(--primary); }
.mat-grid { display:flex; flex-wrap:wrap; gap:8px; }
.mat-btn { padding:7px 12px; border-radius:var(--radius-md); font-size:12px; font-weight:500; cursor:pointer; border:1px solid var(--border-md); background:var(--panel); color:var(--muted); transition:all var(--t); }
.mat-btn.active, .mat-btn:hover { background:var(--primary-bg); color:var(--primary-light); border-color:var(--primary); }
.med-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:12px; }
@media(max-width:480px){ .med-grid { grid-template-columns:1fr 1fr; } }
.field-group { display:flex; flex-direction:column; gap:4px; }
.field-group label { font-size:11px; font-weight:500; color:var(--muted); }
.field-group input, .field-group select { padding:7px 10px; border:1px solid var(--border-md); border-radius:var(--radius-md); background:var(--panel); color:var(--text); font-size:13px; }
textarea { width:100%; padding:8px 10px; border:1px solid var(--border-md); border-radius:var(--radius-md); background:var(--panel); color:var(--text); font-size:13px; resize:vertical; box-sizing:border-box; }
.arte-row { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:6px; }
.arte-label { font-size:12px; font-weight:500; color:var(--muted); display:flex; align-items:center; gap:5px; }
.arte-opts { display:flex; gap:6px; }
.arte-opt { cursor:pointer; }
.arte-opt input { display:none; }
.arte-chip { padding:5px 14px; border-radius:99px; font-size:12px; font-weight:600; border:1px solid var(--border-md); background:var(--panel); color:var(--muted); transition:all var(--t); display:block; }
.arte-chip.active { background:var(--primary-bg); color:var(--primary-light); border-color:var(--primary); }
.arte-chip.active.nao { background:var(--error-bg); color:var(--error); border-color:var(--error-border); }
.add-item-row { display:flex; gap:8px; align-items:flex-end; margin-bottom:12px; flex-wrap:wrap; }
.btn-add-item { background:var(--primary); color:#fff; border:none; border-radius:var(--radius-md); cursor:pointer; padding:0 12px; display:flex; align-items:center; height:38px; margin-top:auto; }
.btn-add-item:hover { opacity:.85; }
.autocomplete-wrap { position:relative; }
.autocomplete-list { display:none; position:absolute; top:100%; left:0; right:0; z-index:50; background:var(--panel); border:1px solid var(--border-md); border-radius:var(--radius-md); box-shadow:var(--shadow-md); max-height:180px; overflow-y:auto; }
.ac-item { padding:9px 12px; font-size:13px; cursor:pointer; transition:background var(--t); }
.ac-item:hover { background:var(--primary-bg); color:var(--primary-light); }
.itens-tabela-wrap { overflow-x:auto; border-radius:var(--radius-md); border:1px solid var(--border); }
.itens-tabela { width:100%; border-collapse:collapse; font-size:13px; }
.itens-tabela th { background:var(--panel); padding:8px 12px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); border-bottom:1px solid var(--border); }
.itens-tabela td { padding:9px 12px; border-bottom:1px solid var(--border); color:var(--text-sub); }
.itens-tabela tr:last-child td { border-bottom:none; }
.itens-tabela tr:hover td { background:rgba(0,124,190,0.04); }
.del-item { background:transparent; border:none; color:var(--error); cursor:pointer; font-size:13px; padding:2px 6px; border-radius:4px; transition:background var(--t); }
.del-item:hover { background:var(--error-bg); }
.itens-vazio { text-align:center; padding:20px; color:var(--muted); font-size:13px; display:flex; flex-direction:column; align-items:center; gap:8px; }
.itens-total-row td { background:var(--primary-bg) !important; border-top:2px solid var(--primary-border) !important; border-bottom:none !important; padding:10px 12px; }
.resultado-card { border-top:3px solid var(--primary); }
.material-sel-info { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
.mat-label-tag { font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px; background:var(--primary-bg); color:var(--primary-light); border:1px solid var(--primary-border); }
.arte-tag { font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px; background:var(--error-bg); color:var(--error); border:1px solid var(--error-border); }
.res-linhas { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
.res-linha { display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--muted); padding:4px 0; border-bottom:1px solid var(--border); }
.res-linha span:last-child { color:var(--text-sub); font-weight:500; }
.res-total { display:flex; justify-content:space-between; align-items:center; background:var(--primary-bg); border:1px solid var(--primary-border); border-radius:var(--radius-md); padding:12px 16px; margin-top:12px; }
.res-total span:first-child { font-size:13px; color:var(--muted); font-weight:600; }
.res-total span:last-child  { font-size:22px; font-weight:800; color:var(--primary-light); }
.custo-op-linha { background:rgba(232,160,16,0.06); border-radius:var(--radius-sm); padding:5px 8px !important; border-bottom:1px solid rgba(232,160,16,0.2) !important; }
.custo-op-val { color:var(--warning) !important; font-weight:700 !important; }
.arredondar-row { display:flex; align-items:center; justify-content:space-between; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius-md); padding:8px 14px; margin-top:10px; }
.arredondar-info { font-size:11px; color:var(--muted); margin-top:6px; padding:6px 10px; background:var(--panel); border-radius:var(--radius-sm); border:1px dashed var(--border-md); text-align:center; }
.arredondar-info strong { color:var(--primary-light); }
.acoes-grid { display:flex; flex-direction:column; gap:8px; }
.btn-acao { display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 14px; border-radius:var(--radius-md); font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all var(--t); width:100%; font-family:var(--font); }
.btn-acao.primary { background:var(--primary); color:#fff; }
.btn-acao.primary:hover { background:var(--primary-light); }
.btn-acao.success { background:var(--success); color:#fff; }
.btn-acao.info    { background:var(--info-bg); color:var(--info); border:1px solid rgba(0,172,23,0.2); }
.btn-acao.warn    { background:var(--warning-bg); color:var(--warning); border:1px solid rgba(232,160,16,0.2); }
.btn-acao.danger  { background:var(--error-bg); color:var(--error); border:1px solid var(--error-border); }
.hist-lista { display:flex; flex-direction:column; gap:10px; }
.hist-card { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px; }
.hist-card-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
.hist-cliente { font-weight:700; font-size:14px; }
.hist-data { font-size:12px; color:var(--muted); margin-top:2px; }
.hist-valor { font-size:18px; font-weight:800; color:var(--primary-light); }
.hist-obs { font-size:12px; color:var(--muted); margin-bottom:8px; }
.hist-acoes { display:flex; gap:6px; }
.hist-vazio { text-align:center; padding:60px 20px; color:var(--muted); display:flex; flex-direction:column; align-items:center; gap:12px; }
.hist-vazio i { font-size:36px; opacity:.3; }
.conv-resumo { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; margin-bottom:16px; }
.conv-res-linha { display:flex; justify-content:space-between; font-size:13px; padding:5px 0; border-bottom:1px solid var(--border); color:var(--muted); }
.conv-res-linha:last-child { border-bottom:none; }
.conv-res-linha strong { color:var(--text-sub); }
.conv-res-linha.total strong { font-size:16px; color:var(--primary-light); }
.modal-sep { border-top:1px solid var(--border); margin:16px 0; }
.modal-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin-bottom:10px; }
.btn-mini-cad { display:inline-flex; align-items:center; gap:5px; background:var(--success-bg); color:var(--success); border:1px solid var(--success-border); border-radius:var(--radius-md); padding:7px 10px; font-size:12px; font-weight:600; cursor:pointer; transition:all var(--t); white-space:nowrap; }
.modal label { display:block; font-size:12px; font-weight:500; color:var(--muted); margin-bottom:5px; margin-top:12px; }
.orc-toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:var(--panel); border:1px solid var(--border-md); color:var(--text); border-radius:var(--radius-lg); padding:12px 24px; font-size:13px; font-weight:600; box-shadow:var(--shadow-lg); z-index:999; animation:slideUp .2s ease; }
.calc-folhas-wrap { background:var(--panel2); border:1px solid var(--border); border-radius:var(--radius-lg); margin-bottom:16px; overflow:hidden; }
.calc-folhas-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--panel); border-bottom:1px solid var(--border); }
.calc-folhas-body { padding:16px; display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media(max-width:600px){ .calc-folhas-body { grid-template-columns:1fr; } }
.cf-close-btn { background:transparent; border:none; color:var(--muted); cursor:pointer; font-size:16px; padding:4px 8px; border-radius:var(--radius-sm); }
.cf-section { display:flex; flex-direction:column; gap:8px; }
.cf-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
.cf-papeis-row { display:flex; gap:8px; flex-wrap:wrap; }
.cf-papel-btn { padding:8px 12px; border:1px solid var(--border-md); border-radius:var(--radius-md); background:var(--panel); cursor:pointer; text-align:center; transition:all var(--t); }
.cf-papel-btn.active { background:var(--primary-bg); border-color:var(--primary); }
.cf-papel-nome { font-size:13px; font-weight:700; }
.cf-papel-dim { font-size:11px; color:var(--muted); }
.cf-papel-margem { font-size:10px; color:var(--muted); }
.cf-tipo-switch { display:flex; gap:8px; }
.cf-tipo-btn { flex:1; padding:10px; border:1px solid var(--border-md); border-radius:var(--radius-md); background:var(--panel); cursor:pointer; text-align:center; transition:all var(--t); }
.cf-tipo-btn.active { background:var(--primary-bg); border-color:var(--primary); }
.cf-tipo-btn.tag.active { background:rgba(232,160,16,0.1); border-color:var(--warning); }
.cf-tipo-icon { display:block; font-size:18px; margin-bottom:4px; }
.cf-tipo-nome { display:block; font-size:12px; font-weight:700; }
.cf-tipo-esp { display:block; font-size:10px; color:var(--muted); }
.cf-inputs-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
.cf-field { display:flex; flex-direction:column; gap:4px; }
.cf-field label { font-size:11px; color:var(--muted); }
.cf-field input { padding:7px 10px; border:1px solid var(--border-md); border-radius:var(--radius-md); background:var(--panel); color:var(--text); font-size:13px; }
.cf-util-info { font-size:11px; color:var(--muted); }
.cf-hint { font-size:12px; color:var(--muted); display:flex; align-items:center; gap:6px; padding:8px; background:var(--panel); border-radius:var(--radius-sm); }
.cf-sem-fit { font-size:12px; color:var(--warning); padding:8px; }
.cf-res-cards { display:flex; gap:8px; flex-wrap:wrap; }
.cf-res-card { flex:1; min-width:80px; padding:10px; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius-md); text-align:center; }
.cf-res-card.primary { background:var(--primary-bg); border-color:var(--primary); }
.cf-res-num { font-size:22px; font-weight:800; color:var(--primary-light); }
.cf-res-label { font-size:11px; color:var(--muted); margin-top:2px; }
.cf-rotated { font-size:10px; color:var(--warning); margin-top:4px; }
`; }
}

// ── helper local ────────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function flashInput(el) {
  if (!el) return;
  el.style.borderColor = "var(--error)";
  el.focus();
  setTimeout(() => el.style.borderColor = "", 1500);
}
