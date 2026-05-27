/**
 * PRODUTOS VIEW — Gestão completa com BOM, categorias e precificação inteligente.
 * Cada produto tem: matérias-primas vinculadas, cálculo de custo BOM,
 * custos adicionais, overhead da Gestão de Custos e margem de lucro.
 */

import { BaseView }           from "./baseView.js";
import { services }           from "../../core/services.js";
import { selectors }          from "../../core/store.js";
import { supabase }           from "../../supabase/client.js";
import { EVENTS }             from "../../core/eventBus.js";
import { esc }                from "../../utils/sanitize.js";
import { fmtBRL }             from "../../utils/fmt.js";
import { PageHeader, Btn, openModal } from "../components/index.js";

export class ProdutosView extends BaseView {
  #subView   = "lista";   // "lista" | "detalhe"
  #produto   = null;      // produto sendo criado/editado (objeto local)
  #bom       = [];        // BOM do produto atual
  #busca     = "";
  #filtroCat = "";
  #filtroSt  = "";

  // Cache local
  #categorias = [];
  #materias   = [];       // matérias-primas com saldo
  #gc         = { depr: 0, fixos: 0, total: 0, porHora: 0 }; // gestão de custos

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async _init() {
    await this.#carregar();
  }

  async #carregar() {
    const [cats, mats, depr, fixos] = await Promise.all([
      supabase.from("categorias").select("*").order("nome"),
      supabase.from("materias_primas").select("*").order("nome"),
      supabase.from("depreciacao").select("valor,vida_util_anos").catch(() => ({ data: [] })),
      supabase.from("custos_fixos").select("valor_mensal,ativo").catch(() => ({ data: [] })),
    ]);

    this.#categorias = cats.data || [];
    this.#materias   = mats.data || [];

    const totalDepr = (depr.data || []).reduce((s, e) => {
      const meses = Number(e.vida_util_anos || 1) * 12;
      return s + (meses > 0 ? Number(e.valor || 0) / meses : 0);
    }, 0);
    const totalFixos = (fixos.data || []).filter(c => c.ativo !== false)
      .reduce((s, c) => s + Number(c.valor_mensal || 0), 0);
    const total = totalDepr + totalFixos;

    this.#gc = { depr: totalDepr, fixos: totalFixos, total, porHora: total / 30 / 8 };

    await services.produto.listar();
  }

  // ── Render dispatch ────────────────────────────────────────────────────────
  render()      { return this.#subView === "detalhe" ? this.#renderDetalhe() : this.#renderLista(); }
  afterRender() { this.#subView === "detalhe" ? this.#bindDetalhe() : this.#bindLista(); }

  // ══════════════════════════════════════════════════════════════════════════
  // LISTA
  // ══════════════════════════════════════════════════════════════════════════
  #renderLista() {
    const todos = selectors.produtos().list || [];
    const filtrados = todos.filter(p => {
      const okN  = !this.#busca     || p.nome?.toLowerCase().includes(this.#busca.toLowerCase());
      const okC  = !this.#filtroCat || p.categoria_id === this.#filtroCat;
      const okSt = !this.#filtroSt  || (p.status || "ativo") === this.#filtroSt;
      return okN && okC && okSt;
    });

    return `
      <style>${CSS_PRODUTOS}</style>

      ${PageHeader({
        title:    "Produtos",
        subtitle: `${todos.length} produto${todos.length !== 1 ? "s" : ""} cadastrados`,
        actions:  `
          <button class="btn-secondary" id="btn-cats">
            <i class="fi fi-rr-tags"></i> Categorias
          </button>
          ${Btn.primary('<i class="fi fi-rr-add"></i> Novo Produto', "btn-novo")}
        `,
      })}

      <div class="prod-filtros">
        <div class="prod-search-wrap">
          <i class="fi fi-rr-search prod-si"></i>
          <input id="prod-busca" class="prod-search" placeholder="Buscar produto..." value="${esc(this.#busca)}" />
        </div>
        <select id="filtro-cat" class="prod-sel">
          <option value="">Todas as categorias</option>
          ${this.#categorias.map(c =>
            `<option value="${esc(c.id)}" ${this.#filtroCat === c.id ? "selected" : ""}>${esc(c.nome)}</option>`
          ).join("")}
        </select>
        <select id="filtro-st" class="prod-sel">
          <option value="">Todos os status</option>
          <option value="ativo"    ${this.#filtroSt === "ativo"    ? "selected" : ""}>Ativo</option>
          <option value="inativo"  ${this.#filtroSt === "inativo"  ? "selected" : ""}>Inativo</option>
          <option value="rascunho" ${this.#filtroSt === "rascunho" ? "selected" : ""}>Rascunho</option>
        </select>
      </div>

      ${filtrados.length === 0
        ? `<div class="empty-state">
             <div class="empty-state-icon"><i class="fi fi-rr-box-open"></i></div>
             <div class="empty-state-title">${todos.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado."}</div>
             ${todos.length === 0 ? `${Btn.primary('<i class="fi fi-rr-add"></i> Criar primeiro produto', "btn-novo-empty")}` : ""}
           </div>`
        : `<div class="prod-list-wrap">
             <div class="prod-list-head">
               <span>Produto</span>
               <span>Categoria</span>
               <span>Status</span>
               <span class="r">Custo BOM</span>
               <span class="r">Preço Venda</span>
               <span class="r">Margem</span>
               <span></span>
             </div>
             ${filtrados.map(p => this.#renderRow(p)).join("")}
           </div>`
      }
    `;
  }

  #renderRow(p) {
    const cat      = this.#categorias.find(c => c.id === p.categoria_id);
    const stClass  = { ativo: "st-ativo", inativo: "st-inativo", rascunho: "st-rascunho" }[p.status || "ativo"] || "st-ativo";
    const stLabel  = { ativo: "Ativo", inativo: "Inativo", rascunho: "Rascunho" }[p.status || "ativo"];
    const custo    = Number(p.custo_producao || 0);
    const preco    = Number(p.preco_venda    || 0);
    const margem   = preco > 0 && custo > 0
      ? (preco - custo) / preco * 100
      : (preco > 0 ? 100 : 0);
    const margemCls = margem >= 30 ? "mg-ok" : margem > 0 ? "mg-warn" : "";

    return `
      <div class="prod-row" data-id="${esc(p.id)}">
        <div class="prod-info">
          <div class="prod-icone"><i class="fi fi-rr-box-open"></i></div>
          <div>
            <div class="prod-nome">${esc(p.nome)}</div>
            ${p.sku ? `<div class="prod-sku">SKU: ${esc(p.sku)}</div>` : ""}
          </div>
        </div>
        <div class="prod-cell">${cat ? esc(cat.nome) : "—"}</div>
        <div><span class="prod-st ${stClass}">${stLabel}</span></div>
        <div class="prod-num">${custo > 0 ? fmtBRL(custo) : "—"}</div>
        <div class="prod-num">${preco > 0 ? fmtBRL(preco) : "—"}</div>
        <div class="prod-num ${margemCls}">${preco > 0 ? margem.toFixed(1) + "%" : "—"}</div>
        <div class="prod-acoes">
          <button class="btn-icon" data-abrir="${esc(p.id)}" title="Editar">
            <i class="fi fi-rr-pencil"></i>
          </button>
          <button class="btn-icon danger" data-del="${esc(p.id)}" data-nome="${esc(p.nome)}">
            <i class="fi fi-rr-trash"></i>
          </button>
        </div>
      </div>`;
  }

  #bindLista() {
    const abrirNovo = () => {
      this.#produto = {};
      this.#bom     = [];
      this.#subView = "detalhe";
      this.refresh();
    };

    this.$("#btn-novo")?.addEventListener("click",       abrirNovo);
    this.$("#btn-novo-empty")?.addEventListener("click", abrirNovo);

    this.$("#prod-busca")?.addEventListener("input", e => {
      this.#busca = e.target.value; this.refresh();
    });
    this.$("#filtro-cat")?.addEventListener("change", e => {
      this.#filtroCat = e.target.value; this.refresh();
    });
    this.$("#filtro-st")?.addEventListener("change", e => {
      this.#filtroSt = e.target.value; this.refresh();
    });

    this.$("#btn-cats")?.addEventListener("click", () => this.#modalCategorias());

    const lista = selectors.produtos().list || [];

    this.$$("[data-abrir]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const p = lista.find(x => x.id === btn.dataset.abrir);
        if (!p) return;
        this.#produto = { ...p };
        this.#bom     = await this.#loadBOM(p.id);
        this.#subView = "detalhe";
        this.refresh();
      })
    );

    this.$$("[data-del]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (!confirm(`Excluir "${btn.dataset.nome}"?`)) return;
        try {
          await services.produto.deletar(btn.dataset.del);
          this.toast("Produto removido.", "ok");
          this.refresh();
        } catch (e) { this.toast(e.message, "erro"); }
      })
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DETALHE
  // ══════════════════════════════════════════════════════════════════════════
  #renderDetalhe() {
    const p     = this.#produto || {};
    const isNew = !p.id;

    // ── Calcular custos ──
    const custoBOM = this.#calcCustoBOM();
    const maoObra  = Number(p.custo_mao_obra    || 0);
    const acab     = Number(p.custo_acabamento  || 0);
    const outros   = Number(p.custo_operacional || 0);
    const tempo    = Number(p.tempo_producao    || 0); // horas
    const overhead = tempo * this.#gc.porHora;
    const custoCompleto = custoBOM + maoObra + acab + outros + overhead;

    const preco  = Number(p.preco_venda || 0);
    const margem = preco > 0 && custoCompleto > 0
      ? (preco - custoCompleto) / preco * 100
      : (preco > 0 ? 100 : 0);

    // ── Sugestões de preço ──
    const sug = (m) => custoCompleto > 0 ? custoCompleto / (1 - m / 100) : 0;
    const s30 = sug(30), s40 = sug(40), s50 = sug(50);

    return `
      <style>${CSS_PRODUTOS}</style>

      ${PageHeader({
        title:   isNew ? "Novo Produto" : `Editar: ${esc(p.nome || "Produto")}`,
        actions: `
          ${Btn.secondary("← Voltar", "btn-voltar")}
          ${Btn.primary('<i class="fi fi-rr-disk"></i> Salvar Produto', "btn-salvar")}
        `,
      })}

      <div class="det-layout">

        <!-- ── COLUNA ESQUERDA ── -->
        <div class="det-left">

          <!-- DADOS BÁSICOS -->
          <div class="ds-card">
            <div class="ds-card-title"><i class="fi fi-rr-info"></i> Dados do Produto</div>
            <div class="form-grid">
              <div class="form-field" style="grid-column:1/-1">
                <label>Nome *</label>
                <input id="p-nome" value="${esc(p.nome || "")}" placeholder="Ex: Banner Lona 1×2m" autofocus />
              </div>
              <div class="form-field">
                <label>SKU / Código</label>
                <input id="p-sku" value="${esc(p.sku || "")}" placeholder="Ex: BAN-LONA-1x2" />
              </div>
              <div class="form-field">
                <label>
                  Categoria
                  <button class="btn-cat-inline" id="btn-cat-inline" title="Gerenciar categorias">
                    <i class="fi fi-rr-settings"></i>
                  </button>
                </label>
                <select id="p-cat">
                  <option value="">Sem categoria</option>
                  ${this.#categorias.map(c =>
                    `<option value="${esc(c.id)}" ${p.categoria_id === c.id ? "selected" : ""}>${esc(c.nome)}</option>`
                  ).join("")}
                </select>
              </div>
              <div class="form-field">
                <label>Status</label>
                <select id="p-status">
                  <option value="ativo"    ${(p.status || "ativo") === "ativo"    ? "selected" : ""}>Ativo</option>
                  <option value="inativo"  ${p.status === "inativo"               ? "selected" : ""}>Inativo</option>
                  <option value="rascunho" ${p.status === "rascunho"              ? "selected" : ""}>Rascunho</option>
                </select>
              </div>
              <div class="form-field" style="grid-column:1/-1">
                <label>Descrição</label>
                <textarea id="p-desc" rows="2" placeholder="Descrição opcional...">${esc(p.descricao || "")}</textarea>
              </div>
            </div>
          </div>

          <!-- BOM -->
          <div class="ds-card">
            <div class="bom-header">
              <div class="ds-card-title" style="margin:0"><i class="fi fi-rr-layers"></i> Matérias-Primas (BOM)</div>
              <button class="btn-primary" id="btn-add-mp" style="padding:5px 12px;font-size:12px">
                <i class="fi fi-rr-plus"></i> Adicionar Matéria-Prima
              </button>
            </div>

            ${this.#bom.length === 0
              ? `<div class="bom-vazio">
                   <i class="fi fi-rr-layers"></i>
                   <div>Nenhuma matéria-prima adicionada.</div>
                   <div class="bom-vazio-hint">Adicione os insumos necessários para produzir este produto.<br>O custo BOM será calculado automaticamente.</div>
                 </div>`
              : `<div class="bom-table-wrap">
                   <table class="bom-table">
                     <thead>
                       <tr>
                         <th>Matéria-Prima</th>
                         <th class="c">Un.</th>
                         <th class="r" style="width:110px">Qtd.</th>
                         <th class="r">Custo/un</th>
                         <th class="r">Subtotal</th>
                         <th style="width:40px"></th>
                       </tr>
                     </thead>
                     <tbody>
                       ${this.#bom.map((b, i) => {
                         const mp  = b.materias_primas || {};
                         const cu  = Number(mp.custo_unitario || 0);
                         const qtd = Number(b.quantidade || 0);
                         return `
                           <tr>
                             <td><strong>${esc(mp.nome || "—")}</strong></td>
                             <td class="c bom-un">${esc(mp.unidade || "un")}</td>
                             <td class="r">
                               <input type="number" class="bom-qtd" data-i="${i}"
                                 value="${qtd}" min="0.001" step="0.001" />
                             </td>
                             <td class="r muted">${fmtBRL(cu)}</td>
                             <td class="r bold primary" id="bom-sub-${i}">${fmtBRL(cu * qtd)}</td>
                             <td>
                               <button class="btn-icon danger" data-del-bom="${i}" style="padding:3px 6px">
                                 <i class="fi fi-rr-trash"></i>
                               </button>
                             </td>
                           </tr>`;
                       }).join("")}
                     </tbody>
                     <tfoot>
                       <tr class="bom-tfoot">
                         <td colspan="4" class="r" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">
                           Custo Total BOM
                         </td>
                         <td class="r" id="bom-total" style="font-size:16px;font-weight:800;color:var(--primary-light)">
                           ${fmtBRL(custoBOM)}
                         </td>
                         <td></td>
                       </tr>
                     </tfoot>
                   </table>
                 </div>`}
          </div>

          <!-- CUSTOS ADICIONAIS -->
          <div class="ds-card">
            <div class="ds-card-title"><i class="fi fi-rr-coins"></i> Custos Adicionais de Produção</div>
            <div class="form-grid" style="grid-template-columns:repeat(4,1fr)">
              <div class="form-field">
                <label>Mão de Obra (R$)</label>
                <input id="p-mao" type="number" min="0" step="0.01" value="${p.custo_mao_obra || 0}" />
              </div>
              <div class="form-field">
                <label>Acabamento (R$)</label>
                <input id="p-acab" type="number" min="0" step="0.01" value="${p.custo_acabamento || 0}" />
              </div>
              <div class="form-field">
                <label>Outros Custos (R$)</label>
                <input id="p-outros" type="number" min="0" step="0.01" value="${p.custo_operacional || 0}" />
              </div>
              <div class="form-field">
                <label>
                  Tempo de Produção (h)
                  <span class="hint-inline" title="Usado para calcular o overhead de Gestão de Custos">?</span>
                </label>
                <input id="p-tempo" type="number" min="0" step="0.1" value="${p.tempo_producao || 0}" />
              </div>
            </div>
            ${this.#gc.total > 0 ? `
            <div class="gc-hint-box">
              <i class="fi fi-rr-chart-pie-alt"></i>
              <span>Custo/hora da empresa (Gestão de Custos): <strong>${fmtBRL(this.#gc.porHora)}/h</strong>
              — depr. ${fmtBRL(this.#gc.depr)}/mês + fixos ${fmtBRL(this.#gc.fixos)}/mês</span>
            </div>` : `
            <div class="gc-hint-box gc-hint-box--off">
              <i class="fi fi-rr-info"></i>
              <span>Cadastre equipamentos e custos fixos em <strong>Gestão de Custos</strong> para calcular o overhead automaticamente.</span>
            </div>`}
          </div>
        </div>

        <!-- ── COLUNA DIREITA: PRECIFICAÇÃO ── -->
        <div class="det-right">

          <!-- COMPOSIÇÃO DE CUSTOS -->
          <div class="prec-panel custo-panel">
            <div class="prec-panel-title"><i class="fi fi-rr-calculator"></i> Composição de Custos</div>
            <div class="custo-linha"><span>BOM (matérias-primas)</span><strong id="pc-bom">${fmtBRL(custoBOM)}</strong></div>
            <div class="custo-linha"><span>Mão de obra</span><strong id="pc-mao">${fmtBRL(maoObra)}</strong></div>
            <div class="custo-linha"><span>Acabamento</span><strong id="pc-acab">${fmtBRL(acab)}</strong></div>
            <div class="custo-linha"><span>Outros</span><strong id="pc-outros">${fmtBRL(outros)}</strong></div>
            <div class="custo-linha ${overhead > 0 ? "overhead-on" : "overhead-off"}">
              <span>
                <i class="fi fi-rr-clock" style="font-size:10px"></i>
                Overhead${tempo > 0 ? ` (${tempo}h)` : ""}
              </span>
              <strong id="pc-overhead">${fmtBRL(overhead)}</strong>
            </div>
            <div class="custo-sep"></div>
            <div class="custo-linha custo-total">
              <span>Custo Total</span>
              <strong id="pc-total">${fmtBRL(custoCompleto)}</strong>
            </div>
          </div>

          <!-- SUGESTÃO POR GESTÃO DE CUSTOS -->
          <div class="prec-panel sug-panel ${this.#gc.total > 0 ? "" : "sug-panel--off"}">
            <div class="prec-panel-title"><i class="fi fi-rr-chart-pie-alt"></i> Preço Sugerido</div>
            ${custoCompleto > 0
              ? `<div class="sug-grid">
                   ${[
                     { label: "30% margem", v: s30 },
                     { label: "40% ★",      v: s40, dest: true },
                     { label: "50% margem", v: s50 },
                   ].map(s => `
                     <div class="sug-item ${s.dest ? "sug-dest" : ""}">
                       <div class="sug-label">${s.label}</div>
                       <div class="sug-preco">${fmtBRL(s.v)}</div>
                       <button class="btn-usar-sug" data-val="${s.v.toFixed(2)}">Usar</button>
                     </div>`).join("")}
                 </div>
                 <div style="font-size:10.5px;color:var(--muted);margin-top:8px;line-height:1.5">
                   Baseado em custo total ${fmtBRL(custoCompleto)}${this.#gc.total > 0 && tempo > 0 ? ` + overhead ${fmtBRL(overhead)}` : ""}
                 </div>`
              : `<div class="sug-vazio">Preencha os custos acima para ver sugestões de preço.</div>`}
          </div>

          <!-- PREÇO DE VENDA + MARGEM -->
          <div class="prec-panel venda-panel">
            <div class="prec-panel-title"><i class="fi fi-rr-tag"></i> Preço de Venda</div>
            <div class="form-field">
              <label>Preço de Venda (R$)</label>
              <div class="prec-input-wrap">
                <span>R$</span>
                <input id="p-preco" type="number" min="0" step="0.01"
                  value="${preco > 0 ? preco : ""}" placeholder="0,00" />
              </div>
            </div>
            <div id="margem-display">
              ${this.#renderMargemDisplay(preco, custoCompleto)}
            </div>
          </div>

        </div>
      </div>
    `;
  }

  #renderMargemDisplay(preco, custo) {
    if (!preco || preco <= 0) return `
      <div class="margem-vazio">Informe o preço de venda para ver a margem.</div>`;

    const lucro  = preco - custo;
    const margem = custo > 0 ? lucro / preco * 100 : 100;
    const cls    = margem >= 30 ? "mg-ok" : margem > 0 ? "mg-warn" : "mg-bad";
    const pct    = Math.min(Math.max(margem, 0), 100).toFixed(0);

    return `
      <div class="margem-linhas">
        <div class="margem-l"><span>Custo total</span><span>${fmtBRL(custo)}</span></div>
        <div class="margem-l"><span>Lucro bruto</span>
          <span style="color:${lucro >= 0 ? "var(--success)" : "var(--error)"};font-weight:700">
            ${fmtBRL(lucro)}
          </span>
        </div>
      </div>
      <div class="margem-badge ${cls}">
        <span>Margem de Lucro</span>
        <strong>${margem.toFixed(1)}%</strong>
      </div>
      <div class="margem-bar-wrap">
        <div class="margem-bar-fill" style="width:${pct}%;background:${margem >= 30 ? "var(--success)" : margem > 0 ? "var(--warning)" : "var(--error)"}"></div>
      </div>
      <div class="margem-legenda">
        <span class="mg-ok-dot">● ≥30% ótimo</span>
        <span class="mg-warn-dot">● ≥0% ok</span>
        <span class="mg-bad-dot">● &lt;0% prejuízo</span>
      </div>`;
  }

  #calcCustoBOM() {
    return this.#bom.reduce((s, b) =>
      s + Number(b.materias_primas?.custo_unitario || 0) * Number(b.quantidade || 0), 0);
  }

  #atualizarPainelCustos() {
    const bom    = this.#calcCustoBOM();
    const mao    = parseFloat(this.$("#p-mao")?.value)    || 0;
    const acab   = parseFloat(this.$("#p-acab")?.value)   || 0;
    const outros = parseFloat(this.$("#p-outros")?.value) || 0;
    const tempo  = parseFloat(this.$("#p-tempo")?.value)  || 0;
    const over   = tempo * this.#gc.porHora;
    const total  = bom + mao + acab + outros + over;
    const preco  = parseFloat(this.$("#p-preco")?.value)  || 0;

    const set = (id, v) => { const el = this.$(`#${id}`); if (el) el.textContent = fmtBRL(v); };
    set("pc-bom",      bom);
    set("bom-total",   bom);
    set("pc-mao",      mao);
    set("pc-acab",     acab);
    set("pc-outros",   outros);
    set("pc-overhead", over);
    set("pc-total",    total);

    const md = this.$("#margem-display");
    if (md) md.innerHTML = this.#renderMargemDisplay(preco, total);
  }

  #bindDetalhe() {
    this.$("#btn-voltar")?.addEventListener("click", () => {
      this.#subView = "lista"; this.refresh();
    });
    this.$("#btn-salvar")?.addEventListener("click", () => this.#salvar());

    // Gerenciar categorias inline (mantém a view de detalhe)
    this.$("#btn-cat-inline")?.addEventListener("click", () => this.#modalCategorias(true));

    // Adicionar matéria-prima ao BOM
    this.$("#btn-add-mp")?.addEventListener("click", () => this.#modalAddMP());

    // Remover item do BOM
    this.$$("[data-del-bom]").forEach(btn =>
      btn.addEventListener("click", () => {
        this.#bom.splice(parseInt(btn.dataset.delBom), 1);
        // Salva os dados dos inputs antes de re-renderizar
        this.#capturarCampos();
        this.refresh();
      })
    );

    // Atualizar quantidade no BOM
    this.$$(".bom-qtd").forEach(inp =>
      inp.addEventListener("input", () => {
        const i   = parseInt(inp.dataset.i);
        const qtd = parseFloat(inp.value) || 0;
        this.#bom[i].quantidade = qtd;
        const cu = Number(this.#bom[i].materias_primas?.custo_unitario || 0);
        const subEl = this.$(`#bom-sub-${i}`);
        if (subEl) subEl.textContent = fmtBRL(cu * qtd);
        this.#atualizarPainelCustos();
      })
    );

    // Custos adicionais e preço — atualizar painel em tempo real
    ["#p-mao","#p-acab","#p-outros","#p-tempo","#p-preco"].forEach(sel =>
      this.$(sel)?.addEventListener("input", () => this.#atualizarPainelCustos())
    );

    // Usar sugestão de preço
    this.$$(".btn-usar-sug").forEach(btn =>
      btn.addEventListener("click", () => {
        const inp = this.$("#p-preco");
        if (inp) { inp.value = btn.dataset.val; this.#atualizarPainelCustos(); }
      })
    );
  }

  // Captura os valores dos inputs e atualiza #produto (para não perder ao re-renderizar BOM)
  #capturarCampos() {
    this.#produto = {
      ...(this.#produto || {}),
      nome:              this.$("#p-nome")?.value.trim(),
      sku:               this.$("#p-sku")?.value.trim()  || null,
      categoria_id:      this.$("#p-cat")?.value         || null,
      status:            this.$("#p-status")?.value      || "ativo",
      descricao:         this.$("#p-desc")?.value.trim() || null,
      preco_venda:       parseFloat(this.$("#p-preco")?.value)  || 0,
      custo_mao_obra:    parseFloat(this.$("#p-mao")?.value)    || 0,
      custo_acabamento:  parseFloat(this.$("#p-acab")?.value)   || 0,
      custo_operacional: parseFloat(this.$("#p-outros")?.value) || 0,
      tempo_producao:    parseFloat(this.$("#p-tempo")?.value)  || 0,
    };
  }

  async #salvar() {
    this.#capturarCampos();
    const p = this.#produto;

    if (!p.nome) { this.toast("Informe o nome do produto.", "warn"); return; }

    // Calcular custo_producao para salvar (custo BOM + adicionais)
    const custoBOM  = this.#calcCustoBOM();
    const overhead  = (p.tempo_producao || 0) * this.#gc.porHora;
    const custoTotal = custoBOM + (p.custo_mao_obra || 0) + (p.custo_acabamento || 0) + (p.custo_operacional || 0) + overhead;

    const dados = {
      nome:              p.nome,
      sku:               p.sku               || null,
      categoria_id:      p.categoria_id      || null,
      status:            p.status            || "ativo",
      descricao:         p.descricao         || null,
      preco_venda:       p.preco_venda       || 0,
      custo_mao_obra:    p.custo_mao_obra    || 0,
      custo_acabamento:  p.custo_acabamento  || 0,
      custo_operacional: p.custo_operacional || 0,
      tempo_producao:    p.tempo_producao    || 0,
      custo_producao:    custoTotal,
    };

    const btn = this.$("#btn-salvar");
    if (btn) { btn.disabled = true; btn.textContent = "Salvando..."; }

    try {
      let prodId;
      if (p.id) {
        await services.produto.atualizar(p.id, dados);
        prodId = p.id;
      } else {
        const novo = await services.produto.criar(dados);
        prodId = novo.id;
        this.#produto = { ...this.#produto, id: prodId };
      }

      await this.#salvarBOM(prodId);

      this.toast("Produto salvo!", "ok");
      this.#subView = "lista";
      await services.produto.listar();
      this.refresh();
    } catch (e) {
      this.toast(e.message || "Erro ao salvar.", "erro");
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fi fi-rr-disk"></i> Salvar Produto'; }
    }
  }

  async #salvarBOM(produtoId) {
    // Apaga tudo e reinsere (simples e seguro)
    await supabase.from("produto_materias").delete().eq("produto_id", produtoId);
    const inserts = this.#bom
      .filter(b => b.materias_primas?.id && Number(b.quantidade) > 0)
      .map(b => ({
        produto_id: produtoId,
        materia_id: b.materias_primas.id,
        quantidade: Number(b.quantidade),
      }));
    if (inserts.length) {
      const { error } = await supabase.from("produto_materias").insert(inserts);
      if (error) throw new Error(error.message);
    }
  }

  async #loadBOM(produtoId) {
    const { data } = await supabase
      .from("produto_materias")
      .select("*, materias_primas(id, nome, unidade, custo_unitario)")
      .eq("produto_id", produtoId);
    return data || [];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: ADICIONAR MATÉRIA-PRIMA AO BOM
  // ══════════════════════════════════════════════════════════════════════════
  #modalAddMP() {
    const usadas     = new Set(this.#bom.map(b => b.materias_primas?.id));
    const disponiveis = this.#materias.filter(m => !usadas.has(m.id));

    let selecionada = null;

    const renderLista = (filtro = "") => {
      const lista = !filtro
        ? disponiveis.slice(0, 10)
        : disponiveis.filter(m => m.nome?.toLowerCase().includes(filtro.toLowerCase())).slice(0, 10);
      return lista.map(m => `
        <div class="mp-item" data-id="${esc(m.id)}" data-nome="${esc(m.nome)}"
             data-un="${esc(m.unidade || "un")}" data-custo="${m.custo_unitario || 0}">
          <div>
            <div class="mp-item-nome">${esc(m.nome)}</div>
            <div class="mp-item-info">${esc(m.unidade || "un")} · ${fmtBRL(m.custo_unitario || 0)}/un</div>
          </div>
          <i class="fi fi-rr-arrow-small-right"></i>
        </div>`).join("") || `<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px">Nenhuma matéria-prima encontrada.</div>`;
    };

    const modal = openModal({
      title:    "Adicionar Matéria-Prima ao Produto",
      maxWidth: "460px",
      body: `
        <div class="form-field">
          <label>Buscar matéria-prima *</label>
          <input id="mp-busca" placeholder="Digite para filtrar..." autocomplete="off" autofocus />
        </div>
        <div class="mp-lista" id="mp-lista">${renderLista()}</div>
        <div id="mp-sel-info" style="display:none;margin-top:10px;padding:10px 12px;
          background:var(--primary-bg);border:1px solid var(--primary-border);
          border-radius:var(--radius-md);font-size:13px"></div>
        <div class="form-field" style="margin-top:12px" id="mp-qtd-wrap" style="display:none">
          <label>Quantidade *</label>
          <div class="mp-qtd-row">
            <input id="mp-qtd" type="number" min="0.001" step="0.001" placeholder="0,000" style="flex:1" />
            <span id="mp-qtd-un" class="mp-un-tag">un</span>
          </div>
        </div>`,
      actions: `
        <button class="btn-secondary" id="mp-cancel">Cancelar</button>
        <button class="btn-primary"   id="mp-ok" disabled>Adicionar</button>`,
    });

    const inpBusca = modal.querySelector("#mp-busca");
    const listaEl  = modal.querySelector("#mp-lista");
    const selInfo  = modal.querySelector("#mp-sel-info");
    const qtdWrap  = modal.querySelector("#mp-qtd-wrap");
    const okBtn    = modal.querySelector("#mp-ok");

    const selecionar = (item) => {
      selecionada = {
        id:           item.dataset.id,
        nome:         item.dataset.nome,
        unidade:      item.dataset.un,
        custo_unitario: parseFloat(item.dataset.custo) || 0,
      };
      selInfo.style.display = "block";
      selInfo.innerHTML = `<strong>${esc(selecionada.nome)}</strong> · ${esc(selecionada.unidade)} · ${fmtBRL(selecionada.custo_unitario)}/un`;
      qtdWrap.style.display = "block";
      modal.querySelector("#mp-qtd-un").textContent = selecionada.unidade;
      modal.querySelector("#mp-qtd").focus();
      okBtn.disabled = false;
      listaEl.style.display = "none";
    };

    inpBusca?.addEventListener("input", () => {
      listaEl.innerHTML = renderLista(inpBusca.value);
      listaEl.style.display = "block";
    });
    listaEl?.addEventListener("click", e => {
      const item = e.target.closest(".mp-item");
      if (item) selecionar(item);
    });

    modal.querySelector("#mp-cancel")?.addEventListener("click", () => modal.close());
    okBtn?.addEventListener("click", () => {
      if (!selecionada) { this.toast("Selecione uma matéria-prima.", "warn"); return; }
      const qtd = parseFloat(modal.querySelector("#mp-qtd")?.value);
      if (!qtd || qtd <= 0) { this.toast("Informe uma quantidade válida.", "warn"); return; }

      this.#bom.push({
        produto_id:      this.#produto?.id || null,
        materia_id:      selecionada.id,
        quantidade:      qtd,
        materias_primas: { ...selecionada },
      });
      this.#capturarCampos();
      modal.close();
      this.refresh();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: GERENCIAR CATEGORIAS
  // ══════════════════════════════════════════════════════════════════════════
  #modalCategorias(modoDetalhe = false) {
    const modal = openModal({
      title:    "Gerenciar Categorias de Produtos",
      maxWidth: "420px",
      body:     `<div id="cat-body"></div>`,
      onClose: async () => {
        // Recarregar categorias após fechar
        const { data } = await supabase.from("categorias").select("*").order("nome");
        this.#categorias = data || [];
        if (modoDetalhe) {
          // Atualizar o select de categorias no detalhe sem re-renderizar tudo
          const sel = this.$("#p-cat");
          if (sel) {
            const valorAtual = sel.value;
            sel.innerHTML = `<option value="">Sem categoria</option>
              ${this.#categorias.map(c => `<option value="${esc(c.id)}" ${c.id === valorAtual ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}`;
          }
        } else {
          this.refresh();
        }
      },
    });

    const renderCats = () => {
      const body = modal.querySelector("#cat-body");
      if (!body) return;
      body.innerHTML = `
        <div class="cat-add-row">
          <input id="cat-nova" placeholder="Nome da nova categoria..." />
          <button class="btn-primary" id="cat-add" style="padding:8px 12px;font-size:12px;white-space:nowrap">
            <i class="fi fi-rr-plus"></i> Adicionar
          </button>
        </div>
        <div class="cat-lista">
          ${this.#categorias.length === 0
            ? `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">
                 Nenhuma categoria cadastrada ainda.
               </div>`
            : this.#categorias.map(c => `
                <div class="cat-item">
                  <input class="cat-inp" data-id="${esc(c.id)}" value="${esc(c.nome)}" />
                  <button class="btn-icon" data-save-cat="${esc(c.id)}" title="Salvar edição">
                    <i class="fi fi-rr-disk"></i>
                  </button>
                  <button class="btn-icon danger" data-del-cat="${esc(c.id)}" data-del-cat-n="${esc(c.nome)}">
                    <i class="fi fi-rr-trash"></i>
                  </button>
                </div>`).join("")}
        </div>`;

      body.querySelector("#cat-add")?.addEventListener("click", async () => {
        const nome = body.querySelector("#cat-nova")?.value.trim();
        if (!nome) return;
        try {
          const { data, error } = await supabase.from("categorias").insert({ nome }).select().single();
          if (error) throw error;
          this.#categorias.push(data);
          this.#categorias.sort((a, b) => a.nome.localeCompare(b.nome));
          renderCats();
        } catch (e) { this.toast(e.message, "erro"); }
      });

      body.querySelectorAll("[data-save-cat]").forEach(btn =>
        btn.addEventListener("click", async () => {
          const id   = btn.dataset.saveCat;
          const nome = body.querySelector(`[data-id="${id}"]`)?.value.trim();
          if (!nome) return;
          try {
            await supabase.from("categorias").update({ nome }).eq("id", id);
            const idx = this.#categorias.findIndex(c => c.id === id);
            if (idx !== -1) this.#categorias[idx].nome = nome;
            this.toast("Categoria salva!", "ok");
          } catch (e) { this.toast(e.message, "erro"); }
        })
      );

      body.querySelectorAll("[data-del-cat]").forEach(btn =>
        btn.addEventListener("click", async () => {
          if (!confirm(`Excluir categoria "${btn.dataset.delCatN}"?`)) return;
          try {
            const { error } = await supabase.from("categorias").delete().eq("id", btn.dataset.delCat);
            if (error) throw error;
            this.#categorias = this.#categorias.filter(c => c.id !== btn.dataset.delCat);
            renderCats();
          } catch (e) { this.toast(e.message, "erro"); }
        })
      );
    };

    renderCats();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════════════════════════════
const CSS_PRODUTOS = `
/* ─── Layout ─────────────────────────────── */
.det-layout{display:grid;grid-template-columns:1fr 290px;gap:16px;align-items:start}
@media(max-width:960px){.det-layout{grid-template-columns:1fr}}

/* ─── Lista ──────────────────────────────── */
.prod-filtros{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.prod-search-wrap{position:relative;display:flex;align-items:center;flex:1;min-width:200px;max-width:320px}
.prod-si{position:absolute;left:10px;font-size:13px;color:var(--muted);pointer-events:none}
.prod-search{width:100%;padding:8px 10px 8px 32px;border:1px solid var(--border-md);border-radius:var(--radius-md);background:var(--panel2);color:var(--text);font-size:12.5px;font-family:var(--font);outline:none;box-sizing:border-box;transition:border-color var(--t)}
.prod-search:focus{border-color:var(--primary)}
[data-theme="light"] .prod-search{background:#fff}
.prod-sel{padding:8px 12px;border:1px solid var(--border-md);border-radius:var(--radius-md);background:var(--panel2);color:var(--text);font-size:12.5px;font-family:var(--font);cursor:pointer;outline:none}
[data-theme="light"] .prod-sel{background:#fff}
.prod-list-wrap{border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;background:var(--panel2);box-shadow:var(--shadow-xs)}
[data-theme="light"] .prod-list-wrap{box-shadow:var(--shadow-sm)}
.prod-list-head{display:grid;grid-template-columns:minmax(180px,1fr) 130px 90px 115px 115px 80px 70px;gap:10px;padding:9px 14px;background:var(--panel3);border-bottom:1px solid var(--border);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--muted)}
.prod-list-head .r{text-align:right}
.prod-row{display:grid;grid-template-columns:minmax(180px,1fr) 130px 90px 115px 115px 80px 70px;gap:10px;align-items:center;padding:12px 14px;border-top:1px solid var(--border);transition:background var(--t)}
.prod-row:first-child{border-top:none}
.prod-row:hover{background:var(--panel3)}
.prod-info{display:flex;align-items:center;gap:10px;min-width:0}
.prod-icone{width:32px;height:32px;border-radius:var(--radius-sm);background:var(--panel3);display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--muted);flex-shrink:0}
.prod-nome{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prod-sku{font-size:10.5px;color:var(--muted)}
.prod-cell{font-size:12px;color:var(--text-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prod-num{font-size:12.5px;font-weight:600;text-align:right;white-space:nowrap}
.mg-ok{color:var(--success)}
.mg-warn{color:var(--warning)}
.prod-st{font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap}
.st-ativo{background:rgba(0,196,154,.12);color:var(--success)}
.st-inativo{background:var(--panel3);color:var(--muted)}
.st-rascunho{background:rgba(255,179,0,.12);color:var(--warning)}
.prod-acoes{display:flex;justify-content:flex-end;gap:5px}
@media(max-width:860px){.prod-list-head{display:none}.prod-row{grid-template-columns:1fr auto;gap:8px}.prod-info{grid-column:1/-1}}

/* ─── Detalhe: categoria inline ──────────── */
.btn-cat-inline{background:transparent;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px 6px;font-size:10px;color:var(--muted);vertical-align:middle;margin-left:5px;transition:all var(--t)}
.btn-cat-inline:hover{border-color:var(--primary);color:var(--primary-light)}

/* ─── BOM ────────────────────────────────── */
.bom-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:8px;flex-wrap:wrap}
.bom-vazio{text-align:center;padding:24px 16px;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:8px}
.bom-vazio i{font-size:28px;opacity:.3}
.bom-vazio-hint{font-size:11px;opacity:.7;line-height:1.5}
.bom-table-wrap{overflow-x:auto;border-radius:var(--radius-md);border:1px solid var(--border)}
.bom-table{width:100%;border-collapse:collapse;font-size:12.5px}
.bom-table th{text-align:left;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:8px 10px;border-bottom:1px solid var(--border);background:var(--panel3)}
.bom-table th.c{text-align:center}.bom-table th.r{text-align:right}
.bom-table td{padding:8px 10px;border-bottom:.5px solid var(--border);vertical-align:middle}
.bom-table td.c{text-align:center}.bom-table td.r{text-align:right}
.bom-table td.muted{color:var(--muted)}
.bom-table td.bold{font-weight:700}
.bom-table td.primary{color:var(--primary-light)}
.bom-table tr:hover td{background:var(--panel3)}
.bom-tfoot td{background:var(--primary-bg)!important;border-top:1px solid var(--primary-border)!important;padding:10px 10px}
.bom-qtd{padding:5px 8px;border:1px solid var(--border-md);border-radius:var(--radius-sm);background:var(--panel);color:var(--text);font-size:12px;font-family:var(--font);width:90px;text-align:right}
.bom-qtd:focus{outline:none;border-color:var(--primary)}

/* ─── Gestão de custos hint ──────────────── */
.gc-hint-box{display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border-radius:var(--radius-md);margin-top:12px;font-size:11.5px;line-height:1.5;background:rgba(0,196,154,.07);border:1px solid rgba(0,196,154,.2);color:var(--text-sub)}
.gc-hint-box i{color:var(--primary-light);flex-shrink:0;margin-top:2px;font-size:13px}
.gc-hint-box--off{background:var(--panel3);border-color:var(--border);color:var(--muted)}
.gc-hint-box--off i{color:var(--muted)}
.hint-inline{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:var(--panel3);border:1px solid var(--border);font-size:9px;color:var(--muted);cursor:default;margin-left:4px;vertical-align:middle}

/* ─── Painel de precificação ─────────────── */
.det-right{display:flex;flex-direction:column;gap:12px;position:sticky;top:12px}
.prec-panel{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px}
[data-theme="light"] .prec-panel{box-shadow:var(--shadow-xs)}
.prec-panel-title{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:12px;display:flex;align-items:center;gap:6px}
.custo-panel{border-top:3px solid var(--primary-light)}
.custo-linha{display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px;border-bottom:.5px solid var(--border)}
.custo-linha:last-child{border-bottom:none}
.custo-linha span{color:var(--muted)}
.custo-linha strong{font-weight:700;color:var(--text);white-space:nowrap}
.overhead-on span{color:var(--warning)}.overhead-on strong{color:var(--warning)!important}
.overhead-off{opacity:.45}
.custo-sep{height:1px;background:var(--border-md);margin:8px 0}
.custo-total{padding:8px 0!important}
.custo-total span{color:var(--text);font-weight:600;font-size:13px}
.custo-total strong{font-size:16px;color:var(--primary-light)!important}
.sug-panel{border-top:3px solid var(--warning)}
.sug-panel--off{opacity:.6;border-top-color:var(--border-md)}
.sug-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:6px}
.sug-item{border:1px solid var(--border);border-radius:var(--radius-md);padding:8px 6px;text-align:center;transition:border-color var(--t)}
.sug-dest{border-color:var(--warning);background:rgba(255,179,0,.06)}
.sug-label{font-size:9.5px;font-weight:600;color:var(--muted);margin-bottom:4px}
.sug-preco{font-size:12.5px;font-weight:800;color:var(--text);margin-bottom:6px;line-height:1.1}
.btn-usar-sug{background:var(--panel3);border:1px solid var(--border-md);color:var(--muted);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;font-family:var(--font);transition:all var(--t)}
.btn-usar-sug:hover{background:var(--primary-bg);border-color:var(--primary);color:var(--primary-light)}
.sug-vazio{font-size:12px;color:var(--muted);text-align:center;padding:10px 0}
.venda-panel{border-top:3px solid var(--success)}
.prec-input-wrap{display:flex;align-items:center;background:var(--panel3);border:1px solid var(--border-md);border-radius:var(--radius-md);overflow:hidden;transition:border-color var(--t)}
[data-theme="light"] .prec-input-wrap{background:#f8f9fc}
.prec-input-wrap:focus-within{border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,196,154,.12)}
.prec-input-wrap span{padding:0 10px;font-size:12px;font-weight:600;color:var(--muted);background:var(--panel2);border-right:1px solid var(--border);display:flex;align-items:center;flex-shrink:0}
.prec-input-wrap input{border:none;background:transparent;flex:1;padding:9px 10px;font-size:15px;color:var(--text);font-family:var(--font);font-weight:700}
.prec-input-wrap input:focus{outline:none}
.margem-vazio{font-size:12px;color:var(--muted);text-align:center;padding:10px 0}
.margem-linhas{display:flex;flex-direction:column;gap:4px;margin-top:10px}
.margem-l{display:flex;justify-content:space-between;font-size:12px;padding:3px 0}
.margem-l span:first-child{color:var(--muted)}
.margem-badge{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-radius:var(--radius-md);margin-top:8px}
.margem-badge span{font-size:11px;font-weight:600}
.margem-badge strong{font-size:20px;font-weight:800}
.mg-ok.margem-badge{background:var(--success-bg);color:var(--success)}
.mg-warn.margem-badge{background:var(--warning-bg);color:var(--warning)}
.mg-bad.margem-badge{background:var(--error-bg);color:var(--error)}
.margem-bar-wrap{height:6px;background:var(--panel3);border-radius:99px;overflow:hidden;margin-top:6px}
.margem-bar-fill{height:100%;border-radius:99px;transition:width .4s}
.margem-legenda{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:9.5px}
.mg-ok-dot{color:var(--success)}.mg-warn-dot{color:var(--warning)}.mg-bad-dot{color:var(--error)}

/* ─── Modal: lista de MPs ─────────────────── */
.mp-lista{border:1px solid var(--border);border-radius:var(--radius-md);max-height:200px;overflow-y:auto;margin-top:6px}
.mp-item{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;cursor:pointer;border-bottom:.5px solid var(--border);transition:background var(--t)}
.mp-item:last-child{border-bottom:none}
.mp-item:hover{background:var(--primary-bg)}
.mp-item:hover i{color:var(--primary-light)}
.mp-item-nome{font-weight:600;font-size:13px}
.mp-item-info{font-size:11px;color:var(--muted);margin-top:1px}
.mp-qtd-row{display:flex;align-items:center;gap:8px}
.mp-un-tag{font-size:13px;font-weight:600;color:var(--muted);min-width:24px}

/* ─── Modal: categorias ──────────────────── */
.cat-add-row{display:flex;gap:8px;margin-bottom:12px}
.cat-add-row input{flex:1}
.cat-lista{display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto}
.cat-item{display:flex;gap:6px;align-items:center}
.cat-inp{flex:1;padding:7px 10px;border:1px solid var(--border-md);border-radius:var(--radius-md);background:var(--panel2);color:var(--text);font-size:12.5px;font-family:var(--font);outline:none}
.cat-inp:focus{border-color:var(--primary)}
[data-theme="light"] .cat-inp{background:#fff}
`;
