import { supabase } from "../supabase/client.js";
import { fmtBRL } from "../format/brl.js";

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  view: "lista",          // "lista" | "detalhe"
  produtoAberto: null,
  abaDetalhe: "info",     // "info" | "precificacao" | "materiais" | "producao"
  busca: "",
  filtroCat: "",
  categorias: [],
  produtos: [],
  materias_primas: [],
  bom: [],                // produto_materias com join
};

// ─── Entry Point ──────────────────────────────────────────────────────────────
export async function Produtos(container) {
  container.innerHTML = `<div class="loading">Carregando produtos...</div>`;
  await carregarTudo();
  render(container);
}

// ─── Carregamento ─────────────────────────────────────────────────────────────
async function carregarTudo() {
  const [{ data: cats }, { data: prods }, { data: mps }, { data: bom }] = await Promise.all([
    supabase.from("categorias").select("*").order("nome"),
    supabase.from("produtos").select("*").order("nome"),
    supabase.from("materias_primas").select("*").order("nome"),
    supabase
      .from("produto_materias")
      .select("*, materias_primas(id, nome, unidade, custo_unitario)")
      .order("created_at"),
  ]);

  state.materias_primas = mps || [];
  state.bom = bom || [];
  state.categorias = cats || [];
  state.produtos = (prods || []).map(p => enriquecerProduto(p, bom || []));
}

// Calcula custo total do BOM e junta ao produto
function enriquecerProduto(prod, bom) {
  const materiais = bom.filter(b => b.produto_id === prod.id);
  const custoBOM = materiais.reduce((s, b) => {
    const custo = Number(b.materias_primas?.custo_unitario || 0);
    return s + custo * Number(b.quantidade || 0);
  }, 0);
  const precoVenda = Number(prod.preco_venda || 0);
  const margem = precoVenda > 0 && custoBOM > 0
    ? ((precoVenda - custoBOM) / precoVenda) * 100
    : precoVenda > 0 ? 100 : 0;
  return { ...prod, materiais, custoBOM, margem };
}

// ─── Render Principal ──────────────────────────────────────────────────────────
function render(container) {
  if (state.view === "detalhe" && state.produtoAberto) {
    renderDetalhe(container);
  } else {
    renderLista(container);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTA
// ══════════════════════════════════════════════════════════════════════════════
function renderLista(container) {
  const ativos     = state.produtos.filter(p => p.status !== "inativo");
  const maisVendido = state.produtos[0]; // placeholder — futuramente cruzar com venda_itens
  const maiorLucro  = [...state.produtos].sort((a, b) => b.margem - a.margem)[0];
  const totalCats   = state.categorias.length;

  // Filtro
  const filtrados = state.produtos.filter(p => {
    const matchBusca = !state.busca ||
      (p.nome?.toLowerCase().includes(state.busca.toLowerCase()) ||
       p.sku?.toLowerCase().includes(state.busca.toLowerCase()) ||
       p.descricao?.toLowerCase().includes(state.busca.toLowerCase()));
    const matchCat = !state.filtroCat || p.categoria_id === state.filtroCat;
    return matchBusca && matchCat;
  });

  container.innerHTML = `
    <style>${css()}</style>

    <!-- Topbar -->
    <div class="p-topbar">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:700">Produtos</h2>
        <span style="font-size:12px;color:var(--muted)">${state.produtos.length} produto${state.produtos.length !== 1 ? "s" : ""} cadastrados</span>
      </div>
      <div class="p-topbar-actions">
        <button class="btn-secondary" id="btn-nova-cat">
          <i class="fi fi-rr-apps"></i> Nova Categoria
        </button>
        <button class="btn-primary" id="btn-novo-prod">
          <i class="fi fi-rr-add"></i> Novo Produto
        </button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="p-kpis">
      <div class="p-kpi">
        <div class="p-kpi-icon" style="background:var(--primary-bg);color:var(--primary-light)">
          <i class="fi fi-rr-box-open"></i>
        </div>
        <div>
          <div class="p-kpi-val">${ativos.length}</div>
          <div class="p-kpi-lbl">Produtos ativos</div>
        </div>
      </div>
      <div class="p-kpi">
        <div class="p-kpi-icon" style="background:var(--warning-bg);color:var(--warning)">
          <i class="fi fi-rr-star"></i>
        </div>
        <div>
          <div class="p-kpi-val" style="font-size:14px;font-weight:700">${esc(maisVendido?.nome || "—")}</div>
          <div class="p-kpi-lbl">Mais vendido</div>
        </div>
      </div>
      <div class="p-kpi">
        <div class="p-kpi-icon" style="background:var(--success-bg);color:var(--success)">
          <i class="fi fi-rr-chart-histogram"></i>
        </div>
        <div>
          <div class="p-kpi-val" style="color:var(--success)">${maiorLucro ? maiorLucro.margem.toFixed(0) + "%" : "—"}</div>
          <div class="p-kpi-lbl">Maior margem • ${esc(maiorLucro?.nome || "—")}</div>
        </div>
      </div>
      <div class="p-kpi">
        <div class="p-kpi-icon" style="background:rgba(106,166,255,0.12);color:#6eb3ff">
          <i class="fi fi-rr-apps"></i>
        </div>
        <div>
          <div class="p-kpi-val">${totalCats}</div>
          <div class="p-kpi-lbl">Categorias</div>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="p-filtros">
      <div class="p-search-wrap">
        <i class="fi fi-rr-search p-search-icon"></i>
        <input id="busca" placeholder="Buscar produto, SKU ou descrição..." value="${esc(state.busca)}" />
      </div>
      <div class="p-cat-filtros">
        <button class="p-cat-btn ${!state.filtroCat ? "active" : ""}" data-fc="">Todos</button>
        ${state.categorias.map(c => `
          <button class="p-cat-btn ${state.filtroCat === c.id ? "active" : ""}" data-fc="${c.id}">
            ${esc(c.nome)}
          </button>`).join("")}
      </div>
    </div>

    <!-- Tabela -->
    <div class="p-table-wrap">
      <table class="p-table">
        <thead>
          <tr>
            <th style="width:44px"></th>
            <th>Produto</th>
            <th>Categoria</th>
            <th style="text-align:right">Custo BOM</th>
            <th style="text-align:right">Preço Venda</th>
            <th style="text-align:center">Margem</th>
            <th style="text-align:center">Status</th>
            <th style="width:80px"></th>
          </tr>
        </thead>
        <tbody>
          ${filtrados.length === 0
            ? `<tr><td colspan="8" class="p-vazio">
                <i class="fi fi-rr-inbox" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px"></i>
                ${state.busca || state.filtroCat ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}
               </td></tr>`
            : filtrados.map(p => {
                const cat = state.categorias.find(c => c.id === p.categoria_id);
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
                    <td>
                      <span class="p-cat-tag">${esc(cat?.nome || "Sem categoria")}</span>
                    </td>
                    <td style="text-align:right;font-size:12px;color:var(--muted)">
                      ${p.custoBOM > 0 ? fmtBRL(p.custoBOM) : "—"}
                    </td>
                    <td style="text-align:right;font-weight:700;color:var(--primary-light)">
                      ${p.preco_venda > 0 ? fmtBRL(p.preco_venda) : "—"}
                    </td>
                    <td style="text-align:center">
                      ${p.preco_venda > 0
                        ? `<span class="p-margem-badge" style="color:${margemCor};background:${margemCor}18">${p.margem.toFixed(1)}%</span>`
                        : `<span style="color:var(--muted);font-size:12px">—</span>`}
                    </td>
                    <td style="text-align:center">
                      <span class="p-status-pill" style="color:${statusCfg.cor};background:${statusCfg.cor}18">
                        ${statusCfg.label}
                      </span>
                    </td>
                    <td>
                      <div class="p-row-acoes">
                        <button class="btn-icon" data-editar="${p.id}" title="Editar">
                          <i class="fi fi-rr-pencil"></i>
                        </button>
                        <button class="btn-icon danger" data-del="${p.id}" data-del-nome="${esc(p.nome)}" title="Excluir">
                          <i class="fi fi-rr-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>`;
              }).join("")}
        </tbody>
      </table>
    </div>

    <div id="modal-area"></div>
  `;

  // Busca
  container.querySelector("#busca").addEventListener("input", e => {
    state.busca = e.target.value;
    renderLista(container);
  });

  // Filtro categoria
  container.querySelectorAll("[data-fc]").forEach(btn =>
    btn.addEventListener("click", () => {
      state.filtroCat = btn.dataset.fc;
      renderLista(container);
    })
  );

  // Botões topo
  container.querySelector("#btn-nova-cat").addEventListener("click", () =>
    abrirModalCategoria(container)
  );
  container.querySelector("#btn-novo-prod").addEventListener("click", () =>
    abrirDetalhe(container, null)
  );

  // Clique linha = abrir detalhe
  container.querySelectorAll(".p-row").forEach(row =>
    row.addEventListener("click", e => {
      if (e.target.closest("[data-editar],[data-del]")) return;
      const p = state.produtos.find(x => x.id === row.dataset.id);
      if (p) abrirDetalhe(container, p);
    })
  );

  container.querySelectorAll("[data-editar]").forEach(btn =>
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const p = state.produtos.find(x => x.id === btn.dataset.editar);
      if (p) abrirDetalhe(container, p);
    })
  );

  container.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      if (!confirm(`Excluir "${btn.dataset.delNome}"?`)) return;
      await supabase.from("produto_materias").delete().eq("produto_id", btn.dataset.del);
      await supabase.from("produtos").delete().eq("id", btn.dataset.del);
      await recarregar(container);
    })
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DETALHE DO PRODUTO
// ══════════════════════════════════════════════════════════════════════════════
function abrirDetalhe(container, prod) {
  state.view = "detalhe";
  state.produtoAberto = prod ? { ...prod } : {
    id: null, nome: "", sku: "", descricao: "", icone_svg: "",
    status: "ativo", categoria_id: "", preco_venda: 0,
    tempo_producao: "", maquina: "", acabamento: "", setor: "",
    checklist: "", custoBOM: 0, margem: 0, materiais: [],
  };
  state.abaDetalhe = "info";
  renderDetalhe(container);
}

function renderDetalhe(container) {
  const p = state.produtoAberto;
  const editando = !!p.id;
  const cat = state.categorias.find(c => c.id === p.categoria_id);
  const bom = state.bom.filter(b => b.produto_id === p.id);

  // Custo ao vivo (do BOM atual)
  const custoBOM = bom.reduce((s, b) => {
    return s + Number(b.materias_primas?.custo_unitario || 0) * Number(b.quantidade || 0);
  }, 0);
  const precoVenda = Number(p.preco_venda || 0);
  const margemCalc = precoVenda > 0 && custoBOM > 0
    ? ((precoVenda - custoBOM) / precoVenda) * 100
    : precoVenda > 0 ? 100 : 0;
  const lucroCalc = precoVenda - custoBOM;

  const ABAS = [
    { key: "info",          icon: "fi-rr-info",           label: "Informações"  },
    { key: "precificacao",  icon: "fi-rr-coins",          label: "Precificação" },
    { key: "materiais",     icon: "fi-rr-layers",         label: "Materiais"    },
    { key: "producao",      icon: "fi-rr-print",          label: "Produção"     },
  ];

  container.innerHTML = `
    <style>${css()}</style>

    <!-- Header -->
    <div class="p-detalhe-header">
      <button class="btn-secondary" id="btn-voltar">
        <i class="fi fi-rr-arrow-left"></i> Voltar
      </button>
      <div style="flex:1">
        <h2 style="margin:0;font-size:18px;font-weight:700">
          ${editando ? esc(p.nome) : "Novo Produto"}
        </h2>
        ${editando && cat ? `<span style="font-size:12px;color:var(--muted)">${esc(cat.nome)}</span>` : ""}
      </div>
      <button class="btn-primary" id="btn-salvar">
        <i class="fi fi-rr-disk"></i> Salvar
      </button>
    </div>

    <!-- Resumo preço (só exibe quando editando) -->
    ${editando ? `
    <div class="p-preco-banner">
      <div class="p-preco-item">
        <div class="p-preco-lbl">Custo BOM</div>
        <div class="p-preco-val" style="color:var(--error)">${fmtBRL(custoBOM)}</div>
      </div>
      <div class="p-preco-arrow"><i class="fi fi-rr-arrow-right"></i></div>
      <div class="p-preco-item">
        <div class="p-preco-lbl">Preço de Venda</div>
        <div class="p-preco-val" style="color:var(--primary-light)">${fmtBRL(precoVenda)}</div>
      </div>
      <div class="p-preco-arrow"><i class="fi fi-rr-arrow-right"></i></div>
      <div class="p-preco-item">
        <div class="p-preco-lbl">Lucro</div>
        <div class="p-preco-val" style="color:var(--success)">${fmtBRL(lucroCalc)}</div>
      </div>
      <div class="p-preco-item">
        <div class="p-preco-lbl">Margem</div>
        <div class="p-preco-val" style="color:${margemCalc >= 40 ? "var(--success)" : margemCalc >= 20 ? "var(--warning)" : "var(--error)"}">
          ${margemCalc.toFixed(1)}%
        </div>
      </div>
    </div>` : ""}

    <!-- Abas -->
    <div class="p-abas">
      ${ABAS.map(a => `
        <button class="p-aba ${state.abaDetalhe === a.key ? "active" : ""}" data-aba="${a.key}">
          <i class="fi ${a.icon}"></i> ${a.label}
        </button>`).join("")}
    </div>

    <!-- Corpo -->
    <div id="p-aba-body">
      ${renderAbaBody(p, bom, custoBOM, margemCalc, lucroCalc)}
    </div>

    <div id="modal-area"></div>
  `;

  container.querySelector("#btn-voltar").addEventListener("click", () => {
    state.view = "lista";
    state.produtoAberto = null;
    renderLista(container);
  });

  container.querySelectorAll("[data-aba]").forEach(btn =>
    btn.addEventListener("click", () => {
      // Coleta dados do formulário atual antes de trocar aba
      coletarFormulario(container);
      state.abaDetalhe = btn.dataset.aba;
      renderDetalhe(container);
    })
  );

  container.querySelector("#btn-salvar").addEventListener("click", () =>
    salvarProduto(container)
  );

  bindAbaEvents(container, p, bom);
}

function renderAbaBody(p, bom, custoBOM, margemCalc, lucroCalc) {
  switch (state.abaDetalhe) {
    case "info":        return renderAbaInfo(p);
    case "precificacao":return renderAbaPrecificacao(p, custoBOM, margemCalc, lucroCalc);
    case "materiais":   return renderAbaMateriais(p, bom);
    case "producao":    return renderAbaProducao(p);
    default:            return renderAbaInfo(p);
  }
}

// ─── ABA: INFORMAÇÕES ────────────────────────────────────────────────────────
function renderAbaInfo(p) {
  const catOptions = state.categorias.map(c =>
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
        <select id="f-cat">
          <option value="">Sem categoria</option>
          ${catOptions}
        </select>
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
            ${p.icone_svg ? p.icone_svg : `<i class="fi fi-rr-image" style="font-size:24px;color:var(--muted);opacity:.4"></i>`}
          </div>
        </div>
      </div>

    </div>
  </div>`;
}

// ─── ABA: PRECIFICAÇÃO ───────────────────────────────────────────────────────
function renderAbaPrecificacao(p, custoBOM, margemCalc, lucroCalc) {
  return `
  <div class="p-form-card">

    <!-- Cards calculados -->
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
        <div class="p-prec-card-val" style="color:${margemCalc >= 40 ? "var(--success)" : margemCalc >= 20 ? "var(--warning)" : "var(--error)"}">
          ${margemCalc.toFixed(1)}%
        </div>
        <div class="p-prec-card-hint">${margemCalc >= 40 ? "✅ Saudável" : margemCalc >= 20 ? "⚠️ Margem baixa" : "❌ Margem crítica"}</div>
      </div>
    </div>

    <div class="p-form-grid" style="margin-top:16px">

      <div class="p-field">
        <label>Preço de venda (R$)</label>
        <div class="p-price-input">
          <span>R$</span>
          <input id="f-preco" type="number" min="0" step="0.01"
            value="${Number(p.preco_venda || 0).toFixed(2)}"
            placeholder="0,00" />
        </div>
      </div>

      <div class="p-field">
        <label>Custo de mão de obra (R$) <span style="font-size:11px;color:var(--muted)">opcional</span></label>
        <div class="p-price-input">
          <span>R$</span>
          <input id="f-custo-mo" type="number" min="0" step="0.01"
            value="${Number(p.custo_mao_obra || 0).toFixed(2)}"
            placeholder="0,00" />
        </div>
      </div>

      <div class="p-field">
        <label>Custo de acabamento (R$) <span style="font-size:11px;color:var(--muted)">opcional</span></label>
        <div class="p-price-input">
          <span>R$</span>
          <input id="f-custo-acab" type="number" min="0" step="0.01"
            value="${Number(p.custo_acabamento || 0).toFixed(2)}"
            placeholder="0,00" />
        </div>
      </div>

      <div class="p-field">
        <label>Custo operacional (R$) <span style="font-size:11px;color:var(--muted)">opcional</span></label>
        <div class="p-price-input">
          <span>R$</span>
          <input id="f-custo-op" type="number" min="0" step="0.01"
            value="${Number(p.custo_operacional || 0).toFixed(2)}"
            placeholder="0,00" />
        </div>
      </div>

    </div>

    <div class="p-prec-info">
      <i class="fi fi-rr-info"></i>
      O custo do BOM é recalculado automaticamente sempre que o custo de uma matéria-prima no
      <strong>Estoque</strong> for alterado — mantendo seus preços sempre atualizados.
    </div>
  </div>`;
}

// ─── ABA: MATERIAIS (BOM) ────────────────────────────────────────────────────
function renderAbaMateriais(p, bom) {
  const mpOptions = state.materias_primas.map(mp =>
    `<option value="${mp.id}">${esc(mp.nome)} (${esc(mp.unidade)})</option>`
  ).join("");

  return `
  <div class="p-form-card">
    <div style="font-size:13px;color:var(--muted);margin-bottom:14px">
      Defina quais materiais do estoque compõem este produto.
      O custo total é calculado automaticamente.
    </div>

    ${bom.length > 0 ? `
    <table class="p-bom-table">
      <thead><tr>
        <th>Matéria-Prima</th>
        <th style="text-align:center">Unidade</th>
        <th style="text-align:right">Quantidade</th>
        <th style="text-align:right">Custo/un</th>
        <th style="text-align:right">Subtotal</th>
        <th style="width:40px"></th>
      </tr></thead>
      <tbody>
        ${bom.map(item => {
          const sub = Number(item.quantidade || 0) * Number(item.materias_primas?.custo_unitario || 0);
          return `
          <tr>
            <td><strong>${esc(item.materias_primas?.nome || "—")}</strong></td>
            <td style="text-align:center">
              <span class="p-unit-tag">${esc(item.materias_primas?.unidade || "un")}</span>
            </td>
            <td style="text-align:right">${Number(item.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
            <td style="text-align:right;color:var(--muted);font-size:12px">${fmtBRL(item.materias_primas?.custo_unitario || 0)}</td>
            <td style="text-align:right;font-weight:700;color:var(--primary-light)">${fmtBRL(sub)}</td>
            <td>
              <button class="btn-icon danger" data-del-bom="${item.id}" title="Remover">
                <i class="fi fi-rr-trash"></i>
              </button>
            </td>
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

    <!-- Adicionar matéria-prima -->
    ${p.id ? `
    <div class="p-bom-add">
      <select id="bom-mp-select" style="flex:2">
        <option value="">Selecionar matéria-prima...</option>
        ${mpOptions}
      </select>
      <div class="p-price-input" style="width:130px">
        <span>Qtd</span>
        <input id="bom-qtd" type="number" min="0.001" step="0.001" value="1" />
      </div>
      <button class="btn-primary" id="btn-add-bom">
        <i class="fi fi-rr-add"></i> Adicionar
      </button>
    </div>` : `
    <div class="p-prec-info" style="margin-top:12px">
      <i class="fi fi-rr-info"></i>
      Salve o produto primeiro para poder adicionar materiais.
    </div>`}
  </div>`;
}

// ─── ABA: PRODUÇÃO ───────────────────────────────────────────────────────────
function renderAbaProducao(p) {
  return `
  <div class="p-form-card">
    <div class="p-form-grid">

      <div class="p-field">
        <label>Tempo médio de produção</label>
        <input id="f-tempo" value="${esc(p.tempo_producao)}" placeholder="Ex: 2h, 30min, 1 dia" />
      </div>

      <div class="p-field">
        <label>Máquina / Equipamento</label>
        <input id="f-maquina" value="${esc(p.maquina)}" placeholder="Ex: Plotter, Impressora HP, Plotter de Recorte" />
      </div>

      <div class="p-field">
        <label>Setor</label>
        <input id="f-setor" value="${esc(p.setor)}" placeholder="Ex: Impressão, Acabamento, Sublimação" />
      </div>

      <div class="p-field">
        <label>Tipo de acabamento</label>
        <input id="f-acabamento" value="${esc(p.acabamento)}" placeholder="Ex: Laminação, Ilhós, Corte especial" />
      </div>

      <div class="p-field full">
        <label>Checklist de produção <span style="font-size:11px;color:var(--muted)">(cada item em uma linha)</span></label>
        <textarea id="f-checklist" rows="5"
          placeholder="Arte aprovada pelo cliente&#10;Arquivo em alta resolução&#10;Verificar dimensões&#10;Testar impressão&#10;Aplicar acabamento">${esc(p.checklist)}</textarea>
      </div>

    </div>
  </div>`;
}

// ─── Bind Eventos da Aba ──────────────────────────────────────────────────────
function bindAbaEvents(container, p, bom) {
  // Preview SVG ao vivo
  container.querySelector("#f-svg")?.addEventListener("input", e => {
    const prev = container.querySelector("#svg-preview");
    if (prev) prev.innerHTML = e.target.value || `<i class="fi fi-rr-image" style="font-size:24px;color:var(--muted);opacity:.4"></i>`;
  });

  // Preview preço ao vivo → atualiza banner
  container.querySelector("#f-preco")?.addEventListener("input", () => {
    coletarFormulario(container);
    const precoVenda = Number(state.produtoAberto.preco_venda || 0);
    const custoBOM = bom.reduce((s, b) => s + Number(b.materias_primas?.custo_unitario || 0) * Number(b.quantidade || 0), 0);
    const margem = precoVenda > 0 && custoBOM > 0
      ? ((precoVenda - custoBOM) / precoVenda) * 100
      : precoVenda > 0 ? 100 : 0;
    const lucro = precoVenda - custoBOM;

    const banner = container.querySelector(".p-preco-banner");
    if (banner) {
      banner.querySelectorAll(".p-preco-val")[1].textContent = fmtBRL(precoVenda);
      banner.querySelectorAll(".p-preco-val")[2].textContent = fmtBRL(lucro);
      banner.querySelectorAll(".p-preco-val")[2].style.color = lucro >= 0 ? "var(--success)" : "var(--error)";
      banner.querySelectorAll(".p-preco-val")[3].textContent = margem.toFixed(1) + "%";
    }
  });

  // Adicionar BOM
  container.querySelector("#btn-add-bom")?.addEventListener("click", async () => {
    const mpId = container.querySelector("#bom-mp-select")?.value;
    const qtd  = parseFloat(container.querySelector("#bom-qtd")?.value) || 1;
    if (!mpId) return;
    if (!p.id) return;
    await supabase.from("produto_materias").insert({
      produto_id: p.id,
      materia_prima_id: mpId,
      quantidade: qtd,
    });
    await recarregar(container);
    state.view = "detalhe";
    state.abaDetalhe = "materiais";
    renderDetalhe(container);
  });

  // Remover BOM
  container.querySelectorAll("[data-del-bom]").forEach(btn =>
    btn.addEventListener("click", async () => {
      await supabase.from("produto_materias").delete().eq("id", btn.dataset.delBom);
      await recarregar(container);
      state.view = "detalhe";
      state.abaDetalhe = "materiais";
      renderDetalhe(container);
    })
  );
}

// ─── Coletar formulário ───────────────────────────────────────────────────────
function coletarFormulario(container) {
  const p = state.produtoAberto;
  const get = id => container.querySelector(id)?.value?.trim() ?? null;

  if (state.abaDetalhe === "info") {
    p.nome        = get("#f-nome") || p.nome;
    p.categoria_id = container.querySelector("#f-cat")?.value || p.categoria_id;
    p.sku         = get("#f-sku") ?? p.sku;
    p.status      = container.querySelector("#f-status")?.value || p.status;
    p.descricao   = get("#f-descricao") ?? p.descricao;
    p.icone_svg   = container.querySelector("#f-svg")?.value?.trim() ?? p.icone_svg;
  }
  if (state.abaDetalhe === "precificacao") {
    p.preco_venda      = parseFloat(container.querySelector("#f-preco")?.value)    || p.preco_venda;
    p.custo_mao_obra   = parseFloat(container.querySelector("#f-custo-mo")?.value)  || p.custo_mao_obra;
    p.custo_acabamento = parseFloat(container.querySelector("#f-custo-acab")?.value) || p.custo_acabamento;
    p.custo_operacional = parseFloat(container.querySelector("#f-custo-op")?.value)  || p.custo_operacional;
  }
  if (state.abaDetalhe === "producao") {
    p.tempo_producao = get("#f-tempo")    ?? p.tempo_producao;
    p.maquina        = get("#f-maquina")  ?? p.maquina;
    p.setor          = get("#f-setor")    ?? p.setor;
    p.acabamento     = get("#f-acabamento") ?? p.acabamento;
    p.checklist      = container.querySelector("#f-checklist")?.value?.trim() ?? p.checklist;
  }
}

// ─── Salvar ───────────────────────────────────────────────────────────────────
async function salvarProduto(container) {
  coletarFormulario(container);
  const p = state.produtoAberto;

  if (!p.nome?.trim()) {
    alert("Informe o nome do produto.");
    state.abaDetalhe = "info";
    renderDetalhe(container);
    return;
  }

  const payload = {
    nome:              p.nome?.trim(),
    categoria_id:      p.categoria_id || null,
    sku:               p.sku          || null,
    status:            p.status       || "ativo",
    descricao:         p.descricao    || null,
    icone_svg:         p.icone_svg    || null,
    preco_venda:       Number(p.preco_venda      || 0),
    custo_mao_obra:    Number(p.custo_mao_obra   || 0),
    custo_acabamento:  Number(p.custo_acabamento || 0),
    custo_operacional: Number(p.custo_operacional|| 0),
    tempo_producao:    p.tempo_producao || null,
    maquina:           p.maquina       || null,
    setor:             p.setor         || null,
    acabamento:        p.acabamento    || null,
    checklist:         p.checklist     || null,
    updated_at:        new Date().toISOString(),
  };

  let error;
  if (p.id) {
    ({ error } = await supabase.from("produtos").update(payload).eq("id", p.id));
  } else {
    const { data: novo, error: err } = await supabase.from("produtos").insert(payload).select().single();
    error = err;
    if (novo) state.produtoAberto = { ...p, ...novo };
  }

  if (error) { alert("Erro ao salvar: " + error.message); return; }

  showToast(container, "✅ Produto salvo com sucesso!");
  await recarregar(container);
  state.view = "lista";
  state.produtoAberto = null;
  renderLista(container);
}

// ─── Modal Categoria ──────────────────────────────────────────────────────────
function abrirModalCategoria(container, edit = null) {
  const area = container.querySelector("#modal-area");
  const editando = !!edit?.id;
  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:380px">
        <h3>${editando ? "Editar Categoria" : "Nova Categoria"}</h3>
        <label>Nome *</label>
        <input id="cat-nome" value="${esc(edit?.nome || "")}" placeholder="Ex: Banner, Adesivo, Cartão..." autofocus />
        <div class="modal-btns">
          <button class="btn-secondary" id="mc-cancel">Cancelar</button>
          <button class="btn-primary" id="mc-ok">${editando ? "Salvar" : "Criar"}</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#mc-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });
  area.querySelector("#mc-ok").addEventListener("click", async () => {
    const nome = area.querySelector("#cat-nome").value.trim();
    if (!nome) { alert("Informe o nome."); return; }
    if (editando) {
      await supabase.from("categorias").update({ nome }).eq("id", edit.id);
    } else {
      await supabase.from("categorias").insert({ nome });
    }
    area.innerHTML = "";
    await recarregar(container);
    renderLista(container);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function recarregar(container) {
  await carregarTudo();
  // Atualiza o produtoAberto se ainda estiver em detalhe
  if (state.view === "detalhe" && state.produtoAberto?.id) {
    const atualizado = state.produtos.find(p => p.id === state.produtoAberto.id);
    if (atualizado) state.produtoAberto = { ...state.produtoAberto, ...atualizado };
  }
}

function showToast(container, msg) {
  const t = document.createElement("div");
  t.className = "p-toast";
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ══════════════════════════════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════════════════════════════
function css() { return `
/* ── Topbar ── */
.p-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:10px; }
.p-topbar-actions { display:flex; gap:8px; }

/* ── KPIs ── */
.p-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px; }
@media(max-width:800px){ .p-kpis { grid-template-columns:1fr 1fr; } }
.p-kpi {
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-lg); padding:14px;
  display:flex; align-items:center; gap:12px;
}
.p-kpi-icon {
  width:40px; height:40px; border-radius:var(--radius-md);
  display:flex; align-items:center; justify-content:center;
  font-size:17px; flex-shrink:0;
}
.p-kpi-val { font-size:22px; font-weight:800; line-height:1.1; color:var(--text); }
.p-kpi-lbl { font-size:11px; color:var(--muted); margin-top:2px; }

/* ── Filtros ── */
.p-filtros { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
.p-search-wrap {
  display:flex; align-items:center; gap:8px;
  background:var(--panel2); border:1px solid var(--border-md);
  border-radius:var(--radius-md); padding:0 12px;
  min-width:260px; flex:1; max-width:380px;
  transition:border-color var(--t);
}
.p-search-wrap:focus-within { border-color:var(--primary); }
.p-search-icon { color:var(--muted); font-size:13px; flex-shrink:0; }
.p-search-wrap input { border:none; background:transparent; padding:9px 0; font-size:13px; flex:1; color:var(--text); }
.p-search-wrap input:focus { outline:none; box-shadow:none; border:none; }
.p-cat-filtros { display:flex; gap:6px; flex-wrap:wrap; }
.p-cat-btn {
  padding:6px 12px; border-radius:999px; font-size:12px; font-weight:500;
  border:1px solid var(--border-md); background:transparent;
  color:var(--muted); cursor:pointer; transition:all var(--t);
}
.p-cat-btn:hover { background:var(--panel2); color:var(--text); }
.p-cat-btn.active { background:var(--primary-bg); border-color:var(--primary-border); color:var(--primary-light); font-weight:700; }

/* ── Tabela ── */
.p-table-wrap { overflow-x:auto; border-radius:var(--radius-lg); border:1px solid var(--border); background:var(--panel2); }
.p-table { width:100%; border-collapse:collapse; font-size:13px; }
.p-table th {
  text-align:left; font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.05em; color:var(--muted); padding:10px 14px;
  background:var(--panel); border-bottom:1px solid var(--border); white-space:nowrap;
}
.p-table td { padding:12px 14px; border-bottom:1px solid var(--border); vertical-align:middle; }
.p-table tr:last-child td { border-bottom:none; }
.p-row { cursor:pointer; transition:background var(--t); }
.p-row:hover td { background:rgba(0,196,154,0.04); }
.p-vazio { text-align:center; color:var(--muted); padding:40px; font-size:13px; }
.p-icon-cell { display:flex; align-items:center; justify-content:center; }
.p-icon-svg { width:34px; height:34px; display:flex; align-items:center; justify-content:center; }
.p-icon-svg svg { width:28px; height:28px; fill:var(--primary-light); }
.p-icon-placeholder {
  width:34px; height:34px; border-radius:var(--radius-sm);
  background:var(--panel); display:flex; align-items:center; justify-content:center;
  color:var(--muted); font-size:14px; opacity:.5;
}
.p-cat-tag {
  font-size:11px; font-weight:600; padding:2px 9px; border-radius:999px;
  background:var(--primary-bg); color:var(--primary-light);
  border:1px solid var(--primary-border);
}
.p-margem-badge { font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; }
.p-status-pill  { font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; }
.p-row-acoes { display:flex; gap:5px; justify-content:flex-end; }

/* ── Detalhe ── */
.p-detalhe-header {
  display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap;
}
.p-preco-banner {
  display:flex; align-items:center; gap:0;
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-lg); padding:12px 20px;
  margin-bottom:14px; flex-wrap:wrap; gap:8px;
}
.p-preco-item { text-align:center; padding:0 16px; }
.p-preco-lbl  { font-size:11px; color:var(--muted); font-weight:500; }
.p-preco-val  { font-size:20px; font-weight:800; margin-top:2px; }
.p-preco-arrow { color:var(--muted); font-size:14px; flex-shrink:0; }

/* ── Abas ── */
.p-abas { display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap; }
.p-aba {
  display:inline-flex; align-items:center; gap:7px;
  padding:8px 14px; border-radius:var(--radius-md);
  border:1px solid var(--border-md); background:transparent;
  color:var(--muted); cursor:pointer; font-family:var(--font);
  font-size:13px; font-weight:500; transition:all var(--t);
}
.p-aba:hover { background:var(--panel2); color:var(--text); }
.p-aba.active { background:var(--primary-bg); border-color:var(--primary-border); color:var(--primary-light); font-weight:700; }

/* ── Form card ── */
.p-form-card {
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-lg); padding:20px;
}
.p-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
@media(max-width:640px){ .p-form-grid { grid-template-columns:1fr; } }
.p-field { display:flex; flex-direction:column; gap:5px; }
.p-field.full { grid-column:1/-1; }
.p-field label { font-size:12px; color:var(--muted); font-weight:500; }

/* ── SVG preview ── */
.p-svg-wrap { display:flex; gap:12px; align-items:flex-start; }
.p-svg-wrap textarea { flex:1; min-height:80px; }
.p-svg-preview {
  width:72px; height:72px; border-radius:var(--radius-md);
  background:var(--panel); border:1px solid var(--border-md);
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0;
}
.p-svg-preview svg { width:48px; height:48px; fill:var(--primary-light); }

/* ── Price input ── */
.p-price-input {
  display:flex; align-items:center;
  background:var(--panel); border:1px solid var(--border-md);
  border-radius:var(--radius-md); overflow:hidden;
  transition:border-color var(--t);
}
.p-price-input:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px rgba(0,196,154,0.12); }
.p-price-input span {
  padding:0 10px; font-size:11px; font-weight:700; color:var(--muted);
  background:var(--panel2); border-right:1px solid var(--border);
  display:flex; align-items:center; white-space:nowrap; flex-shrink:0;
}
.p-price-input input {
  border:none; background:transparent; flex:1;
  padding:9px 10px; font-size:13px; color:var(--text);
  box-shadow:none;
}
.p-price-input input:focus { outline:none; box-shadow:none; border:none; }

/* ── Precificação cards ── */
.p-prec-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
@media(max-width:640px){ .p-prec-cards { grid-template-columns:1fr; } }
.p-prec-card {
  background:var(--panel); border:1px solid var(--border);
  border-radius:var(--radius-md); padding:14px; text-align:center;
}
.p-prec-card-lbl  { font-size:11px; color:var(--muted); margin-bottom:4px; }
.p-prec-card-val  { font-size:22px; font-weight:800; margin-bottom:2px; }
.p-prec-card-hint { font-size:11px; color:var(--muted); }
.p-prec-info {
  display:flex; align-items:flex-start; gap:8px; margin-top:16px;
  background:var(--primary-bg); border:1px solid var(--primary-border);
  border-radius:var(--radius-md); padding:12px 14px;
  font-size:12px; color:var(--muted); line-height:1.5;
}
.p-prec-info i { color:var(--primary); flex-shrink:0; margin-top:1px; }

/* ── BOM table ── */
.p-bom-table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:12px; }
.p-bom-table th {
  background:var(--panel); text-align:left; font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:.05em; color:var(--muted);
  padding:8px 12px; border-bottom:1px solid var(--border);
}
.p-bom-table td { padding:10px 12px; border-bottom:1px solid var(--border); vertical-align:middle; }
.p-bom-table tr:last-child td { border-bottom:none; }
.p-bom-table tr:hover td { background:rgba(0,196,154,0.04); }
.p-bom-total td {
  background:var(--panel) !important;
  border-top:2px solid var(--border-md) !important;
  padding:10px 12px;
}
.p-unit-tag {
  font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px;
  background:var(--panel3); color:var(--muted);
}
.p-bom-vazio {
  display:flex; flex-direction:column; align-items:center; gap:8px;
  color:var(--muted); font-size:13px; padding:32px 0; margin-bottom:12px;
}
.p-bom-add { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:4px; }
.p-bom-add select { flex:2; }

/* ── Botões globais ── */
.btn-primary {
  display:inline-flex; align-items:center; gap:6px;
  background:var(--primary); color:#fff; border:none;
  border-radius:var(--radius-md); padding:8px 16px;
  font-family:var(--font); font-size:13px; font-weight:600;
  cursor:pointer; transition:all var(--t);
}
.btn-primary:hover { opacity:.88; }
.btn-secondary {
  display:inline-flex; align-items:center; gap:6px;
  background:transparent; border:1px solid var(--border-md);
  color:var(--text-sub); border-radius:var(--radius-md);
  padding:8px 14px; font-family:var(--font); font-size:13px;
  font-weight:500; cursor:pointer; transition:all var(--t);
}
.btn-secondary:hover { background:var(--panel2); color:var(--text); }
.btn-icon {
  display:inline-flex; align-items:center; gap:5px;
  background:transparent; border:1px solid var(--border);
  color:var(--muted); border-radius:var(--radius-sm);
  padding:5px 9px; font-size:12px; cursor:pointer; transition:all var(--t);
}
.btn-icon:hover { border-color:var(--primary); color:var(--primary-light); background:var(--primary-bg); }
.btn-icon.danger:hover { border-color:var(--error-border); color:var(--error); background:var(--error-bg); }

/* ── Modal ── */
.modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:100; animation:fadeIn .12s ease; }
.modal { background:var(--panel); border:1px solid var(--border-md); border-radius:var(--radius-xl); padding:24px; min-width:320px; max-width:480px; width:92%; max-height:90vh; overflow-y:auto; box-shadow:var(--shadow-lg); animation:slideUp .15s ease; }
.modal h3 { font-size:16px; font-weight:700; margin-bottom:16px; }
.modal label { display:block; font-size:12px; font-weight:500; color:var(--muted); margin-bottom:5px; margin-top:12px; }
.modal label:first-of-type { margin-top:0; }
.modal-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; padding-top:14px; border-top:1px solid var(--border); }

/* ── Toast ── */
.p-toast {
  position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
  background:var(--panel); border:1px solid var(--border-md);
  color:var(--text); border-radius:var(--radius-lg); padding:12px 24px;
  font-size:13px; font-weight:600; box-shadow:var(--shadow-lg);
  z-index:999; animation:slideUp .2s ease; white-space:nowrap;
}
`; }