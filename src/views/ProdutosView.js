import { BaseView } from "../core/BaseView.js";
import { ProdutosService } from "../services/ProdutosService.js";
import { fmtBRL } from "../format/brl.js";

export class ProdutosView extends BaseView {
  #svc;
  #state = {
    view:         "lista",  // "lista" | "detalhe"
    produtoAberto: null,
    abaDetalhe:   "info",
    busca:        "",
    filtroCat:    "",
  };

  constructor(container) {
    super(container);
    this.#svc = new ProdutosService();
  }

  async mount() {
    this._container.innerHTML = `<div class="loading">Carregando produtos...</div>`;
    await this.#svc.loadAll();
    this._render();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ROTEADOR
  // ══════════════════════════════════════════════════════════════════════════
  _render() {
    if (this.#state.view === "detalhe" && this.#state.produtoAberto) {
      this._renderDetalhe();
    } else {
      this._renderLista();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LISTA
  // ══════════════════════════════════════════════════════════════════════════
  _renderLista() {
    this.cleanup();
    const { produtos, categorias } = this.#svc._cache;
    const { busca, filtroCat }     = this.#state;

    const ativos      = produtos.filter(p => p.status !== "inativo");
    const maiorLucro  = [...produtos].sort((a, b) => b.margem - a.margem)[0];
    const maisVendido = produtos[0];

    const filtrados = produtos.filter(p => {
      const matchBusca = !busca ||
        p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        p.sku?.toLowerCase().includes(busca.toLowerCase()) ||
        p.descricao?.toLowerCase().includes(busca.toLowerCase());
      const matchCat = !filtroCat || p.categoria_id === filtroCat;
      return matchBusca && matchCat;
    });

    this._container.innerHTML = `
      <style>${css()}</style>

      <div class="p-topbar">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Produtos</h2>
          <span style="font-size:12px;color:var(--muted)">${produtos.length} produto${produtos.length !== 1 ? "s" : ""} cadastrados</span>
        </div>
        <div class="p-topbar-actions">
          <button class="btn-secondary" id="btn-nova-cat"><i class="fi fi-rr-apps"></i> Nova Categoria</button>
          <button class="btn-primary"   id="btn-novo-prod"><i class="fi fi-rr-add"></i> Novo Produto</button>
        </div>
      </div>

      <div class="p-kpis">
        <div class="p-kpi">
          <div class="p-kpi-icon" style="background:var(--primary-bg);color:var(--primary-light)"><i class="fi fi-rr-box-open"></i></div>
          <div><div class="p-kpi-val">${ativos.length}</div><div class="p-kpi-lbl">Produtos ativos</div></div>
        </div>
        <div class="p-kpi">
          <div class="p-kpi-icon" style="background:var(--warning-bg);color:var(--warning)"><i class="fi fi-rr-star"></i></div>
          <div><div class="p-kpi-val" style="font-size:14px;font-weight:700">${esc(maisVendido?.nome || "—")}</div><div class="p-kpi-lbl">Mais vendido</div></div>
        </div>
        <div class="p-kpi">
          <div class="p-kpi-icon" style="background:var(--success-bg);color:var(--success)"><i class="fi fi-rr-chart-histogram"></i></div>
          <div>
            <div class="p-kpi-val" style="color:var(--success)">${maiorLucro ? maiorLucro.margem.toFixed(0) + "%" : "—"}</div>
            <div class="p-kpi-lbl">Maior margem · ${esc(maiorLucro?.nome || "—")}</div>
          </div>
        </div>
        <div class="p-kpi">
          <div class="p-kpi-icon" style="background:rgba(106,166,255,0.12);color:#6eb3ff"><i class="fi fi-rr-apps"></i></div>
          <div><div class="p-kpi-val">${categorias.length}</div><div class="p-kpi-lbl">Categorias</div></div>
        </div>
      </div>

      <div class="p-filtros">
        <div class="p-search-wrap">
          <i class="fi fi-rr-search p-search-icon"></i>
          <input id="busca" placeholder="Buscar produto, SKU ou descrição..." value="${esc(busca)}" />
        </div>
        <div class="p-cat-filtros">
          <button class="p-cat-btn ${!filtroCat ? "active" : ""}" data-fc="">Todos</button>
          ${categorias.map(c =>
            `<button class="p-cat-btn ${filtroCat === c.id ? "active" : ""}" data-fc="${c.id}">${esc(c.nome)}</button>`
          ).join("")}
        </div>
      </div>

      <div class="p-table-wrap">
        <table class="p-table">
          <thead><tr>
            <th style="width:44px"></th>
            <th>Produto</th><th>Categoria</th>
            <th style="text-align:right">Custo BOM</th>
            <th style="text-align:right">Preço Venda</th>
            <th style="text-align:center">Margem</th>
            <th style="text-align:center">Status</th>
            <th style="width:80px"></th>
          </tr></thead>
          <tbody>
            ${filtrados.length === 0
              ? `<tr><td colspan="8" class="p-vazio">
                   <i class="fi fi-rr-inbox" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px"></i>
                   ${busca || filtroCat ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}
                 </td></tr>`
              : filtrados.map(p => {
                  const cat       = categorias.find(c => c.id === p.categoria_id);
                  const statusCfg = p.status === "inativo"
                    ? { cor: "var(--muted)", label: "Inativo" }
                    : { cor: "var(--success)", label: "Ativo" };
                  const margemCor = p.margem >= 40 ? "var(--success)" : p.margem >= 20 ? "var(--warning)" : "var(--error)";
                  return `
                    <tr class="p-row" data-id="${p.id}">
                      <td>
                        <div class="p-icon-cell">
                          ${p.icone_svg
                            ? `<div class="p-icon-svg">${p.icone_svg}</div>`
                            : `<div class="p-icon-placeholder"><i class="fi fi-rr-box-open"></i></div>`}
                        </div>
                      </td>
                      <td>
                        <div style="font-weight:600">${esc(p.nome)}</div>
                        ${p.sku ? `<div style="font-size:11px;color:var(--muted)">SKU: ${esc(p.sku)}</div>` : ""}
                        ${p.descricao ? `<div style="font-size:11px;color:var(--muted);margin-top:1px">${esc(p.descricao.slice(0, 60))}${p.descricao.length > 60 ? "…" : ""}</div>` : ""}
                      </td>
                      <td><span class="p-cat-tag">${esc(cat?.nome || "Sem categoria")}</span></td>
                      <td style="text-align:right;font-size:12px;color:var(--muted)">${p.custoBOM > 0 ? fmtBRL(p.custoBOM) : "—"}</td>
                      <td style="text-align:right;font-weight:700;color:var(--primary-light)">${p.preco_venda > 0 ? fmtBRL(p.preco_venda) : "—"}</td>
                      <td style="text-align:center">
                        ${p.preco_venda > 0
                          ? `<span class="p-margem-badge" style="color:${margemCor};background:${margemCor}18">${p.margem.toFixed(1)}%</span>`
                          : `<span style="color:var(--muted);font-size:12px">—</span>`}
                      </td>
                      <td style="text-align:center">
                        <span class="p-status-pill" style="color:${statusCfg.cor};background:${statusCfg.cor}18">${statusCfg.label}</span>
                      </td>
                      <td>
                        <div class="p-row-acoes">
                          <button class="btn-icon" data-editar="${p.id}" title="Editar"><i class="fi fi-rr-pencil"></i></button>
                          <button class="btn-icon danger" data-del="${p.id}" data-del-nome="${esc(p.nome)}" title="Excluir"><i class="fi fi-rr-trash"></i></button>
                        </div>
                      </td>
                    </tr>`;
                }).join("")}
          </tbody>
        </table>
      </div>
      <div id="modal-area"></div>
    `;

    this._on("#busca", "input", e => {
      this.#state.busca = e.target.value;
      this._renderLista();
    });

    this._container.querySelectorAll("[data-fc]").forEach(btn =>
      this._on(btn, "click", () => {
        this.#state.filtroCat = btn.dataset.fc;
        this._renderLista();
      })
    );

    this._on("#btn-nova-cat", "click", () => this._modalCategoria(null));
    this._on("#btn-novo-prod", "click", () => this._abrirDetalhe(null));

    this._container.querySelectorAll(".p-row").forEach(row =>
      this._on(row, "click", e => {
        if (e.target.closest("[data-editar],[data-del]")) return;
        const p = this.#svc._cache.produtos.find(x => x.id === row.dataset.id);
        if (p) this._abrirDetalhe(p);
      })
    );

    this._container.querySelectorAll("[data-editar]").forEach(btn =>
      this._on(btn, "click", e => {
        e.stopPropagation();
        const p = this.#svc._cache.produtos.find(x => x.id === btn.dataset.editar);
        if (p) this._abrirDetalhe(p);
      })
    );

    this._container.querySelectorAll("[data-del]").forEach(btn =>
      this._on(btn, "click", async e => {
        e.stopPropagation();
        if (!confirm(`Excluir "${btn.dataset.delNome}"?`)) return;
        await this.#svc.deletar(btn.dataset.del);
        this._renderLista();
      })
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DETALHE
  // ══════════════════════════════════════════════════════════════════════════
  _abrirDetalhe(prod) {
    this.#state.view         = "detalhe";
    this.#state.abaDetalhe   = "info";
    this.#state.produtoAberto = prod ? { ...prod } : {
      id: null, nome: "", sku: "", descricao: "", icone_svg: "",
      status: "ativo", categoria_id: "", preco_venda: 0,
      tempo_producao: "", maquina: "", acabamento: "", setor: "",
      checklist: "", custoBOM: 0, margem: 0, materiais: [],
      custo_mao_obra: 0, custo_acabamento: 0, custo_operacional: 0,
    };
    this._renderDetalhe();
  }

  _renderDetalhe() {
    this.cleanup();
    const p   = this.#state.produtoAberto;
    const bom = this.#svc.getBomDoProduto(p.id);
    const { custoBOM, margem: margemCalc, lucro: lucroCalc } = this.#svc.calcPreco(p, bom);
    const cat = this.#svc._cache.categorias.find(c => c.id === p.categoria_id);
    const editando = !!p.id;

    const ABAS = [
      { key: "info",         icon: "fi-rr-info",     label: "Informações"  },
      { key: "precificacao", icon: "fi-rr-coins",    label: "Precificação" },
      { key: "materiais",    icon: "fi-rr-layers",   label: "Materiais"    },
      { key: "producao",     icon: "fi-rr-print",    label: "Produção"     },
    ];

    this._container.innerHTML = `
      <style>${css()}</style>

      <div class="p-detalhe-header">
        <button class="btn-secondary" id="btn-voltar"><i class="fi fi-rr-arrow-left"></i> Voltar</button>
        <div style="flex:1">
          <h2 style="margin:0;font-size:18px;font-weight:700">${editando ? esc(p.nome) : "Novo Produto"}</h2>
          ${editando && cat ? `<span style="font-size:12px;color:var(--muted)">${esc(cat.nome)}</span>` : ""}
        </div>
        <button class="btn-primary" id="btn-salvar"><i class="fi fi-rr-disk"></i> Salvar</button>
      </div>

      ${editando ? `
      <div class="p-preco-banner">
        <div class="p-preco-item"><div class="p-preco-lbl">Custo BOM</div><div class="p-preco-val" style="color:var(--error)">${fmtBRL(custoBOM)}</div></div>
        <div class="p-preco-arrow"><i class="fi fi-rr-arrow-right"></i></div>
        <div class="p-preco-item"><div class="p-preco-lbl">Preço de Venda</div><div class="p-preco-val" style="color:var(--primary-light)">${fmtBRL(Number(p.preco_venda || 0))}</div></div>
        <div class="p-preco-arrow"><i class="fi fi-rr-arrow-right"></i></div>
        <div class="p-preco-item"><div class="p-preco-lbl">Lucro</div><div class="p-preco-val" style="color:var(--success)">${fmtBRL(lucroCalc)}</div></div>
        <div class="p-preco-item"><div class="p-preco-lbl">Margem</div>
          <div class="p-preco-val" style="color:${margemCalc >= 40 ? "var(--success)" : margemCalc >= 20 ? "var(--warning)" : "var(--error)"}">${margemCalc.toFixed(1)}%</div>
        </div>
      </div>` : ""}

      <div class="p-abas">
        ${ABAS.map(a => `
          <button class="p-aba ${this.#state.abaDetalhe === a.key ? "active" : ""}" data-aba="${a.key}">
            <i class="fi ${a.icon}"></i> ${a.label}
          </button>`).join("")}
      </div>

      <div id="p-aba-body">
        ${this._renderAbaBody(p, bom, custoBOM, margemCalc, lucroCalc)}
      </div>
      <div id="modal-area"></div>
    `;

    this._on("#btn-voltar", "click", () => {
      this.#state.view         = "lista";
      this.#state.produtoAberto = null;
      this._renderLista();
    });

    this._container.querySelectorAll("[data-aba]").forEach(btn =>
      this._on(btn, "click", () => {
        this._coletarFormulario();
        this.#state.abaDetalhe = btn.dataset.aba;
        this._renderDetalhe();
      })
    );

    this._on("#btn-salvar", "click", () => this._salvar());
    this._bindAbaEvents(p, bom);
  }

  _renderAbaBody(p, bom, custoBOM, margemCalc, lucroCalc) {
    switch (this.#state.abaDetalhe) {
      case "info":         return this._abaInfo(p);
      case "precificacao": return this._abaPrecificacao(p, custoBOM, margemCalc, lucroCalc);
      case "materiais":    return this._abaMateriais(p, bom);
      case "producao":     return this._abaProducao(p);
      default:             return this._abaInfo(p);
    }
  }

  // ─── ABA: INFO ────────────────────────────────────────────────────────────
  _abaInfo(p) {
    const cats = this.#svc._cache.categorias;
    const catOptions = cats.map(c =>
      `<option value="${c.id}" ${p.categoria_id === c.id ? "selected" : ""}>${esc(c.nome)}</option>`
    ).join("");

    return `
    <div class="p-form-card">
      <div class="p-form-grid">
        <div class="p-field full">
          <label>Nome do produto *</label>
          <input id="f-nome" value="${esc(p.nome)}" placeholder="Ex: Banner 90×120, Adesivo A4..." autofocus />
        </div>
        <div class="p-field">
          <label>Categoria</label>
          <div class="p-cat-field-wrap">
            <select id="f-cat">
              <option value="">Sem categoria</option>${catOptions}
            </select>
            <button class="btn-icon" id="btn-inline-edit-cat" title="Editar categoria"
              ${!p.categoria_id ? 'disabled style="opacity:.4;cursor:not-allowed"' : ''}>
              <i class="fi fi-rr-pencil"></i>
            </button>
            <button class="btn-icon" id="btn-inline-add-cat" title="Nova categoria">
              <i class="fi fi-rr-add"></i>
            </button>
          </div>
        </div>
        <div class="p-field">
          <label>SKU / Código</label>
          <input id="f-sku" value="${esc(p.sku)}" placeholder="Ex: BAN-90120" />
        </div>
        <div class="p-field">
          <label>Status</label>
          <select id="f-status">
            <option value="ativo"   ${(p.status || "ativo") === "ativo"   ? "selected" : ""}>● Ativo</option>
            <option value="inativo" ${p.status === "inativo" ? "selected" : ""}>○ Inativo</option>
          </select>
        </div>
        <div class="p-field full">
          <label>Descrição</label>
          <textarea id="f-descricao" rows="3" placeholder="Descrição detalhada do produto...">${esc(p.descricao)}</textarea>
        </div>
        <div class="p-field full">
          <label>Ícone SVG <span style="font-size:11px;color:var(--muted)">(cole o código SVG inline)</span></label>
          <div class="p-svg-wrap">
            <textarea id="f-svg" rows="3" placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>'>${esc(p.icone_svg)}</textarea>
            <div class="p-svg-preview" id="svg-preview">
              ${p.icone_svg
                ? p.icone_svg
                : `<i class="fi fi-rr-image" style="font-size:24px;color:var(--muted);opacity:.4"></i>`}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ─── ABA: PRECIFICAÇÃO ────────────────────────────────────────────────────
  _abaPrecificacao(p, custoBOM, margemCalc, lucroCalc) {
    return `
    <div class="p-form-card">
      <div class="p-prec-cards">
        <div class="p-prec-card">
          <div class="p-prec-card-lbl">Custo de materiais (BOM)</div>
          <div class="p-prec-card-val" style="color:var(--error)">${fmtBRL(custoBOM)}</div>
          <div class="p-prec-card-hint">Calculado automaticamente dos materiais</div>
        </div>
        <div class="p-prec-card">
          <div class="p-prec-card-lbl">Lucro bruto</div>
          <div class="p-prec-card-val" style="color:${lucroCalc >= 0 ? "var(--success)" : "var(--error)"}">${fmtBRL(lucroCalc)}</div>
          <div class="p-prec-card-hint">Preço venda − Custo BOM</div>
        </div>
        <div class="p-prec-card">
          <div class="p-prec-card-lbl">Margem de lucro</div>
          <div class="p-prec-card-val" style="color:${margemCalc >= 40 ? "var(--success)" : margemCalc >= 20 ? "var(--warning)" : "var(--error)"}">${margemCalc.toFixed(1)}%</div>
          <div class="p-prec-card-hint">${margemCalc >= 40 ? "✅ Saudável" : margemCalc >= 20 ? "⚠️ Margem baixa" : "❌ Margem crítica"}</div>
        </div>
      </div>
      <div class="p-form-grid" style="margin-top:16px">
        ${[
          ["f-preco",     "Preço de venda (R$)",                     p.preco_venda,       ""],
          ["f-custo-mo",  "Custo de mão de obra (R$)",               p.custo_mao_obra,    " opcional"],
          ["f-custo-acab","Custo de acabamento (R$)",                p.custo_acabamento,  " opcional"],
          ["f-custo-op",  "Custo operacional (R$)",                  p.custo_operacional, " opcional"],
        ].map(([id, label, val, hint]) => `
          <div class="p-field">
            <label>${label}${hint ? `<span style="font-size:11px;color:var(--muted)">${hint}</span>` : ""}</label>
            <div class="p-price-input">
              <span>R$</span>
              <input id="${id}" type="number" min="0" step="0.01" value="${Number(val || 0).toFixed(2)}" placeholder="0,00" />
            </div>
          </div>`).join("")}
      </div>
      <div class="p-prec-info">
        <i class="fi fi-rr-info"></i>
        O custo do BOM é recalculado automaticamente sempre que o custo de uma matéria-prima no
        <strong>Estoque</strong> for alterado — mantendo seus preços sempre atualizados.
      </div>
    </div>`;
  }

  // ─── ABA: MATERIAIS (BOM) ─────────────────────────────────────────────────
  _abaMateriais(p, bom) {
    const mps = this.#svc._cache.materias_primas;
    const mpOptions = mps.map(mp =>
      `<option value="${mp.id}">${esc(mp.nome)} (${esc(mp.unidade)})</option>`
    ).join("");

    return `
    <div class="p-form-card">
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px">
        Defina quais materiais do estoque compõem este produto. O custo total é calculado automaticamente.
      </div>
      ${bom.length > 0 ? `
      <table class="p-bom-table">
        <thead><tr>
          <th>Matéria-Prima</th><th style="text-align:center">Unidade</th>
          <th style="text-align:right">Quantidade</th><th style="text-align:right">Custo/un</th>
          <th style="text-align:right">Subtotal</th><th style="width:40px"></th>
        </tr></thead>
        <tbody>
          ${bom.map(item => {
            const sub = Number(item.quantidade || 0) * Number(item.materias_primas?.custo_unitario || 0);
            return `
              <tr>
                <td><strong>${esc(item.materias_primas?.nome || "—")}</strong></td>
                <td style="text-align:center"><span class="p-unit-tag">${esc(item.materias_primas?.unidade || "un")}</span></td>
                <td style="text-align:right">${Number(item.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                <td style="text-align:right;color:var(--muted);font-size:12px">${fmtBRL(item.materias_primas?.custo_unitario || 0)}</td>
                <td style="text-align:right;font-weight:700;color:var(--primary-light)">${fmtBRL(sub)}</td>
                <td><button class="btn-icon danger" data-del-bom="${item.id}" title="Remover"><i class="fi fi-rr-trash"></i></button></td>
              </tr>`;
          }).join("")}
        </tbody>
        <tfoot>
          <tr class="p-bom-total">
            <td colspan="4" style="text-align:right;font-size:12px;font-weight:700;color:var(--muted)">CUSTO TOTAL BOM</td>
            <td style="text-align:right;font-weight:800;font-size:15px;color:var(--error)">
              ${fmtBRL(bom.reduce((s, b) => s + Number(b.quantidade || 0) * Number(b.materias_primas?.custo_unitario || 0), 0))}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>` : `
      <div class="p-bom-vazio">
        <i class="fi fi-rr-layers" style="font-size:22px;opacity:.3"></i>
        <span>Nenhuma matéria-prima adicionada ainda.</span>
      </div>`}
      ${p.id ? `
      <div class="p-bom-add">
        <select id="bom-mp-select">
          <option value="">Selecionar matéria-prima...</option>${mpOptions}
        </select>
        <div class="p-price-input" style="width:130px">
          <span>Qtd</span>
          <input id="bom-qtd" type="number" min="0.001" step="0.001" value="1" />
        </div>
        <button class="btn-primary" id="btn-add-bom"><i class="fi fi-rr-add"></i> Adicionar</button>
      </div>` : `
      <div class="p-prec-info" style="margin-top:12px">
        <i class="fi fi-rr-info"></i> Salve o produto primeiro para poder adicionar materiais.
      </div>`}
    </div>`;
  }

  // ─── ABA: PRODUÇÃO ────────────────────────────────────────────────────────
  _abaProducao(p) {
    return `
    <div class="p-form-card">
      <div class="p-form-grid">
        <div class="p-field">
          <label>Tempo médio de produção</label>
          <input id="f-tempo" value="${esc(p.tempo_producao)}" placeholder="Ex: 2h, 30min, 1 dia" />
        </div>
        <div class="p-field">
          <label>Máquina / Equipamento</label>
          <input id="f-maquina" value="${esc(p.maquina)}" placeholder="Ex: Plotter, Impressora HP..." />
        </div>
        <div class="p-field">
          <label>Setor</label>
          <input id="f-setor" value="${esc(p.setor)}" placeholder="Ex: Impressão, Acabamento..." />
        </div>
        <div class="p-field">
          <label>Tipo de acabamento</label>
          <input id="f-acabamento" value="${esc(p.acabamento)}" placeholder="Ex: Laminação, Ilhós..." />
        </div>
        <div class="p-field full">
          <label>Checklist de produção <span style="font-size:11px;color:var(--muted)">(cada item em uma linha)</span></label>
          <textarea id="f-checklist" rows="5"
            placeholder="Arte aprovada pelo cliente&#10;Arquivo em alta resolução&#10;Verificar dimensões">${esc(p.checklist)}</textarea>
        </div>
      </div>
    </div>`;
  }

  // ─── Bind eventos da aba atual ────────────────────────────────────────────
  _bindAbaEvents(p, bom) {
    const c = this._container;

    // SVG preview ao vivo
    c.querySelector("#f-svg")?.addEventListener("input", e => {
      const preview = c.querySelector("#svg-preview");
      if (preview) preview.innerHTML = e.target.value.trim() ||
        `<i class="fi fi-rr-image" style="font-size:24px;color:var(--muted);opacity:.4"></i>`;
    });

    // Adicionar categoria inline
    this._on("#btn-inline-add-cat", "click", () => {
      this._coletarFormulario();
      this._modalCategoria(null, novaId => {
        if (novaId) this.#state.produtoAberto.categoria_id = novaId;
        this.#state.abaDetalhe = "info";
        this._renderDetalhe();
      });
    });

    const editCatBtn = c.querySelector("#btn-inline-edit-cat");
    if (editCatBtn && !editCatBtn.disabled) {
      this._on(editCatBtn, "click", () => {
        this._coletarFormulario();
        const catAtual = this.#svc._cache.categorias.find(
          cat => cat.id === this.#state.produtoAberto.categoria_id
        );
        this._modalCategoria(catAtual, () => {
          this.#state.abaDetalhe = "info";
          this._renderDetalhe();
        });
      });
    }

    // BOM: remover item
    c.querySelectorAll("[data-del-bom]").forEach(btn =>
      this._on(btn, "click", async () => {
        await this.#svc.removerBOM(btn.dataset.delBom, p.id);
        this.#state.abaDetalhe = "materiais";
        this._renderDetalhe();
      })
    );

    // BOM: adicionar item
    this._on("#btn-add-bom", "click", async () => {
      const mpId = c.querySelector("#bom-mp-select")?.value;
      const qtd  = parseFloat(c.querySelector("#bom-qtd")?.value);
      if (!mpId)  { flashInput(c.querySelector("#bom-mp-select")); return; }
      if (!qtd || qtd <= 0) { flashInput(c.querySelector("#bom-qtd")); return; }
      await this.#svc.adicionarBOM(p.id, mpId, qtd);
      this.#state.abaDetalhe = "materiais";
      this._renderDetalhe();
    });
  }

  // ─── Coleta formulário → state.produtoAberto ──────────────────────────────
  _coletarFormulario() {
    const c   = this._container;
    const p   = this.#state.produtoAberto;
    const aba = this.#state.abaDetalhe;
    const get = sel => c.querySelector(sel)?.value?.trim() ?? null;

    if (aba === "info") {
      p.nome        = get("#f-nome")    || p.nome;
      p.categoria_id = c.querySelector("#f-cat")?.value || p.categoria_id;
      p.sku         = get("#f-sku")     ?? p.sku;
      p.status      = c.querySelector("#f-status")?.value || p.status;
      p.descricao   = get("#f-descricao") ?? p.descricao;
      p.icone_svg   = c.querySelector("#f-svg")?.value?.trim() ?? p.icone_svg;
    }
    if (aba === "precificacao") {
      p.preco_venda       = parseFloat(c.querySelector("#f-preco")?.value)     || p.preco_venda;
      p.custo_mao_obra    = parseFloat(c.querySelector("#f-custo-mo")?.value)   || p.custo_mao_obra;
      p.custo_acabamento  = parseFloat(c.querySelector("#f-custo-acab")?.value) || p.custo_acabamento;
      p.custo_operacional = parseFloat(c.querySelector("#f-custo-op")?.value)   || p.custo_operacional;
    }
    if (aba === "producao") {
      p.tempo_producao = get("#f-tempo")      ?? p.tempo_producao;
      p.maquina        = get("#f-maquina")    ?? p.maquina;
      p.setor          = get("#f-setor")      ?? p.setor;
      p.acabamento     = get("#f-acabamento") ?? p.acabamento;
      p.checklist      = c.querySelector("#f-checklist")?.value?.trim() ?? p.checklist;
    }
  }

  // ─── Salvar ───────────────────────────────────────────────────────────────
  async _salvar() {
    this._coletarFormulario();
    const p = this.#state.produtoAberto;
    try {
      let saved;
      if (p.id) {
        saved = await this.#svc.atualizar(p.id, p);
      } else {
        saved = await this.#svc.criar(p);
        this.#state.produtoAberto = { ...p, ...saved };
      }
      this._toast("✅ Produto salvo com sucesso!");
      this.#state.view         = "lista";
      this.#state.produtoAberto = null;
      this._renderLista();
    } catch (err) {
      alert(err.message);
      if (err.message.includes("nome")) {
        this.#state.abaDetalhe = "info";
        this._renderDetalhe();
      }
    }
  }

  // ─── Modal Categoria ──────────────────────────────────────────────────────
  _modalCategoria(edit = null, onSuccess = null) {
    const area    = this._container.querySelector("#modal-area");
    const editando = !!edit?.id;
    area.innerHTML = `
      <div class="modal-bg" id="modal-bg">
        <div class="modal" style="max-width:380px">
          <h3>${editando ? "Editar Categoria" : "Nova Categoria"}</h3>
          <label>Nome *</label>
          <input id="cat-nome" value="${esc(edit?.nome || "")}" placeholder="Ex: Banner, Adesivo, Cartão..." autofocus />
          <div class="modal-btns">
            <button class="btn-secondary" id="mc-cancel">Cancelar</button>
            <button class="btn-primary"   id="mc-ok">${editando ? "Salvar" : "Criar"}</button>
          </div>
        </div>
      </div>`;

    area.querySelector("#mc-cancel").addEventListener("click", () => area.innerHTML = "");
    area.querySelector("#modal-bg").addEventListener("click", e => {
      if (e.target.id === "modal-bg") area.innerHTML = "";
    });
    area.querySelector("#mc-ok").addEventListener("click", async () => {
      const nome = area.querySelector("#cat-nome").value.trim();
      if (!nome) { alert("Informe o nome."); return; }
      try {
        let savedId;
        if (editando) {
          await this.#svc.atualizarCategoria(edit.id, nome);
          savedId = edit.id;
        } else {
          const nova = await this.#svc.criarCategoria(nome);
          savedId = nova.id;
        }
        area.innerHTML = "";
        if (onSuccess) onSuccess(savedId);
        else this._renderLista();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  _toast(msg) {
    const t = document.createElement("div");
    t.className = "p-toast";
    t.textContent = msg;
    this._container.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }
}

// ─── Entrypoint (compatível com o router legado) ──────────────────────────────
export async function Produtos(container) {
  const view = new ProdutosView(container);
  await view.mount();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── CSS ─────────────────────────────────────────────────────────────────────
function css() { return `
.p-topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.p-topbar-actions{display:flex;gap:8px}
.p-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
@media(max-width:800px){.p-kpis{grid-template-columns:1fr 1fr}}
.p-kpi{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;display:flex;align-items:center;gap:12px}
.p-kpi-icon{width:40px;height:40px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.p-kpi-val{font-size:22px;font-weight:800;line-height:1.1;color:var(--text)}
.p-kpi-lbl{font-size:11px;color:var(--muted);margin-top:2px}
.p-filtros{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.p-search-wrap{display:flex;align-items:center;gap:8px;background:var(--panel2);border:1px solid var(--border-md);border-radius:var(--radius-md);padding:0 12px;min-width:260px;flex:1;max-width:380px;transition:border-color var(--t)}
.p-search-wrap:focus-within{border-color:var(--primary)}
.p-search-icon{color:var(--muted);font-size:13px;flex-shrink:0}
.p-search-wrap input{border:none;background:transparent;padding:9px 0;font-size:13px;flex:1;color:var(--text)}
.p-search-wrap input:focus{outline:none;box-shadow:none;border:none}
.p-cat-filtros{display:flex;gap:6px;flex-wrap:wrap}
.p-cat-btn{padding:6px 12px;border-radius:999px;font-size:12px;font-weight:500;border:1px solid var(--border-md);background:transparent;color:var(--muted);cursor:pointer;transition:all var(--t)}
.p-cat-btn:hover{background:var(--panel2);color:var(--text)}
.p-cat-btn.active{background:var(--primary-bg);border-color:var(--primary-border);color:var(--primary-light);font-weight:700}
.p-table-wrap{overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border);background:var(--panel2)}
.p-table{width:100%;border-collapse:collapse;font-size:13px}
.p-table th{text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--border);white-space:nowrap}
.p-table td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
.p-table tr:last-child td{border-bottom:none}
.p-row{cursor:pointer;transition:background var(--t)}
.p-row:hover td{background:rgba(0,196,154,0.04)}
.p-vazio{text-align:center;color:var(--muted);padding:40px;font-size:13px}
.p-icon-cell{display:flex;align-items:center;justify-content:center}
.p-icon-svg{width:34px;height:34px;display:flex;align-items:center;justify-content:center}
.p-icon-svg svg{width:28px;height:28px;fill:var(--primary-light)}
.p-icon-placeholder{width:34px;height:34px;border-radius:var(--radius-sm);background:var(--panel);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;opacity:.5}
.p-cat-tag{font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px;background:var(--primary-bg);color:var(--primary-light);border:1px solid var(--primary-border)}
.p-margem-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px}
.p-status-pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px}
.p-row-acoes{display:flex;gap:5px;justify-content:flex-end}
.p-detalhe-header{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.p-preco-banner{display:flex;align-items:center;background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 20px;margin-bottom:14px;flex-wrap:wrap;gap:8px}
.p-preco-item{text-align:center;padding:0 16px}
.p-preco-lbl{font-size:11px;color:var(--muted);font-weight:500}
.p-preco-val{font-size:20px;font-weight:800;margin-top:2px}
.p-preco-arrow{color:var(--muted);font-size:14px;flex-shrink:0}
.p-abas{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.p-aba{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:var(--radius-md);border:1px solid var(--border-md);background:transparent;color:var(--muted);cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500;transition:all var(--t)}
.p-aba:hover{background:var(--panel2);color:var(--text)}
.p-aba.active{background:var(--primary-bg);border-color:var(--primary-border);color:var(--primary-light);font-weight:700}
.p-form-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px}
.p-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:640px){.p-form-grid{grid-template-columns:1fr}}
.p-field{display:flex;flex-direction:column;gap:5px}
.p-field.full{grid-column:1/-1}
.p-field label{font-size:12px;color:var(--muted);font-weight:500}
.p-cat-field-wrap{display:flex;align-items:center;gap:6px}
.p-cat-field-wrap select{flex:1}
.p-svg-wrap{display:flex;gap:12px;align-items:flex-start}
.p-svg-wrap textarea{flex:1;min-height:80px}
.p-svg-preview{width:72px;height:72px;border-radius:var(--radius-md);background:var(--panel);border:1px solid var(--border-md);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.p-svg-preview svg{width:48px;height:48px;fill:var(--primary-light)}
.p-price-input{display:flex;align-items:center;background:var(--panel);border:1px solid var(--border-md);border-radius:var(--radius-md);overflow:hidden;transition:border-color var(--t)}
.p-price-input:focus-within{border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,196,154,0.12)}
.p-price-input span{padding:0 10px;font-size:11px;font-weight:700;color:var(--muted);background:var(--panel2);border-right:1px solid var(--border);display:flex;align-items:center;white-space:nowrap;flex-shrink:0}
.p-price-input input{border:none;background:transparent;flex:1;padding:9px 10px;font-size:13px;color:var(--text);box-shadow:none}
.p-price-input input:focus{outline:none;box-shadow:none;border:none}
.p-prec-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media(max-width:640px){.p-prec-cards{grid-template-columns:1fr}}
.p-prec-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;text-align:center}
.p-prec-card-lbl{font-size:11px;color:var(--muted);margin-bottom:4px}
.p-prec-card-val{font-size:22px;font-weight:800;margin-bottom:2px}
.p-prec-card-hint{font-size:11px;color:var(--muted)}
.p-prec-info{display:flex;align-items:flex-start;gap:8px;margin-top:16px;background:var(--primary-bg);border:1px solid var(--primary-border);border-radius:var(--radius-md);padding:12px 14px;font-size:12px;color:var(--muted);line-height:1.5}
.p-prec-info i{color:var(--primary);flex-shrink:0;margin-top:1px}
.p-bom-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px}
.p-bom-table th{background:var(--panel);text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:8px 12px;border-bottom:1px solid var(--border)}
.p-bom-table td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle}
.p-bom-table tr:last-child td{border-bottom:none}
.p-bom-table tr:hover td{background:rgba(0,196,154,0.04)}
.p-bom-total td{background:var(--panel) !important;border-top:2px solid var(--border-md) !important;padding:10px 12px}
.p-unit-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--panel3);color:var(--muted)}
.p-bom-vazio{display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--muted);font-size:13px;padding:32px 0;margin-bottom:12px}
.p-bom-add{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px}
.p-bom-add select{flex:2}
.btn-primary{display:inline-flex;align-items:center;gap:6px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius-md);padding:8px 16px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all var(--t)}
.btn-primary:hover{opacity:.88}
.btn-secondary{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid var(--border-md);color:var(--text-sub);border-radius:var(--radius-md);padding:8px 14px;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:all var(--t)}
.btn-secondary:hover{background:var(--panel2);color:var(--text)}
.btn-icon{display:inline-flex;align-items:center;gap:5px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:var(--radius-sm);padding:5px 9px;font-size:12px;cursor:pointer;transition:all var(--t)}
.btn-icon:hover{border-color:var(--primary);color:var(--primary-light);background:var(--primary-bg)}
.btn-icon.danger:hover{border-color:var(--error-border);color:var(--error);background:var(--error-bg)}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:100;animation:fadeIn .12s ease}
.modal{background:var(--panel);border:1px solid var(--border-md);border-radius:var(--radius-xl);padding:24px;min-width:320px;max-width:480px;width:92%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);animation:slideUp .15s ease}
.modal h3{font-size:16px;font-weight:700;margin-bottom:16px}
.modal label{display:block;font-size:12px;font-weight:500;color:var(--muted);margin-bottom:5px;margin-top:12px}
.modal label:first-of-type{margin-top:0}
.modal-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}
.p-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--panel);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-lg);padding:12px 24px;font-size:13px;font-weight:600;box-shadow:var(--shadow-lg);z-index:999;animation:slideUp .2s ease;white-space:nowrap}
`; }
