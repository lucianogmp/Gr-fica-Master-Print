import { supabase } from "../supabase/client.js";

// ─── Preços por material (ocultos para o cliente) ─────────────────────────────
const MATERIAIS = [
  { id: "papel_comum",  label: "Papel Comum 75g",   preco: 30  },
  { id: "papel_matte",  label: "Papel Matte 108g",  preco: 50  },
  { id: "adesivo_vinil",label: "Adesivo Vinil",     preco: 90  },
  { id: "adesivo_papel",label: "Adesivo de Papel",  preco: 75  },
  { id: "lona",         label: "Lona",              preco: 90  },
];

const ACRESCIMO_SEM_ARTE = 0.20;

// ─── Papéis para calculadora de folhas ────────────────────────────────────────
const PAPEIS_CFG = {
  A4:  { w: 21,   h: 29.7, margem: 0.8, label: "A4",   desc: "21×29,7cm" },
  A3:  { w: 29.7, h: 42,   margem: 0.8, label: "A3",   desc: "29,7×42cm" },
  SRA3:{ w: 32,   h: 45,   margem: 2.0, label: "SRA3", desc: "32×45cm"   },
};

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  aba: "form",
  materialId: "adesivo_vinil",
  temArte: true,
  largura: "",
  altura: "",
  quantidade: 1,
  itens: [],
  observacoes: "",
  clientes: [],
  produtos: [],
  orcamentos: [],
  aberto: null,
  arredondar: false, // [ALTERAÇÃO 1] opção de arredondamento
  resultado: { area: 0, unitario: 0, total: 0, totalItens: 0, grand: 0, grandArredondado: 0 },
  // calculadora de folhas
  calcFolhasAberto: false,
  calcFolhas: { papel: "A4", larg: "", alt: "", qtd: "", tipo: "adesivo" },
};

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function Orcamento(container) {
  container.innerHTML = `<div class="loading">Carregando orçamentos...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const [{ data: orcs }, { data: clientes }, { data: produtos }] = await Promise.all([
    supabase.from("orcamentos").select("*, orcamento_itens(*)").order("created_at", { ascending: false }),
    supabase.from("clientes").select("id, nome, telefone, email").order("nome"),
    supabase.from("produtos").select("id, nome").order("nome"),
  ]);
  state.orcamentos = orcs || [];
  state.clientes   = clientes || [];
  state.produtos   = produtos || [];
}

// ─── Render principal ─────────────────────────────────────────────────────────
function render(container) {
  container.innerHTML = `
    <style>${css()}</style>

    <div class="orc-topbar">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:700">Orçamentos</h2>
        <span style="font-size:12px;color:var(--muted)">${state.orcamentos.length} orçamento${state.orcamentos.length!==1?"s":""} salvos</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${state.aba !== "historico" ? `
        <button class="btn-calc-folhas ${state.calcFolhasAberto?"active":""}" id="btn-calc-folhas">
          <i class="fi fi-rr-ruler-triangle"></i> Calc. Folhas
        </button>` : ""}
        <button class="btn-hist ${state.aba==="historico"?"active":""}" id="btn-historico">
          <i class="fi fi-rr-clock"></i> Histórico
          ${state.orcamentos.length>0?`<span class="hist-badge">${state.orcamentos.length}</span>`:""}
        </button>
        <button class="btn-novo-orc" id="btn-novo">
          <i class="fi fi-rr-add"></i> Novo Orçamento
        </button>
      </div>
    </div>

    ${state.aba === "historico" ? renderHistorico() : renderForm()}

    
  `;

  bindEvents(container);
}

// ══════════════════════════════════════════════════════════════════════════════
// CALCULADORA DE FOLHAS
// ══════════════════════════════════════════════════════════════════════════════
function calcularFolhas() {
  const cf = state.calcFolhas;
  const papel = PAPEIS_CFG[cf.papel];
  const m2 = papel.margem * 2;
  const uw = +(papel.w - m2).toFixed(2);
  const uh = +(papel.h - m2).toFixed(2);
  const iw = parseFloat(cf.larg) || 0;
  const ih = parseFloat(cf.alt) || 0;
  const qtd = parseInt(cf.qtd) || 0;
  // Espaçamento entre itens conforme tipo
  const esp = cf.tipo === "tag" ? 0.5 : 0.15;
  if (iw <= 0 || ih <= 0) return { uw, uh, esp, pronto: false };
  // Fórmula: (área_útil + 1_espaço) / (item + espaço)
  // Isso garante que o último item da fila não precisa de espaço após ele
  const c1 = Math.floor((uw + esp) / (iw + esp));
  const r1 = Math.floor((uh + esp) / (ih + esp));
  const p1 = c1 * r1;
  // Rotacionado
  const c2 = Math.floor((uw + esp) / (ih + esp));
  const r2 = Math.floor((uh + esp) / (iw + esp));
  const p2 = c2 * r2;
  const rotated = p2 > p1;
  const cols = rotated ? c2 : c1, rows = rotated ? r2 : r1;
  const perSheet = Math.max(p1, p2);
  const sheetsNeeded = (qtd > 0 && perSheet > 0) ? Math.ceil(qtd / perSheet) : 0;
  return { uw, uh, esp, cols, rows, perSheet, sheetsNeeded, rotated, qtd, pronto: true };
}

function atualizarCalcFolhasDOM(container) {
  const resEl = container.querySelector("#cf-resultado");
  if (!resEl) return;
  const res = calcularFolhas();
  const cf  = state.calcFolhas;
  // atualiza info área útil
  const papel = PAPEIS_CFG[cf.papel];
  const utilEl = container.querySelector(".cf-util-info");
  if (utilEl) utilEl.innerHTML = `Área útil: <strong>${res.uw}×${res.uh}cm</strong> · espaçamento entre itens: <strong>${res.esp}cm</strong>`;
  if (!res.pronto) {
    resEl.innerHTML = `<div class="cf-hint"><i class="fi fi-rr-info"></i> Preencha largura e altura para calcular automaticamente.</div>`;
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
        <div class="cf-res-label">folha${res.sheetsNeeded!==1?"s":""} p/ ${res.qtd} un.</div>
      </div>` : `<div class="cf-res-card muted"><div class="cf-res-num">—</div><div class="cf-res-label">informe qty</div></div>`}
    </div>`;
}

function renderCalculadoraFolhas() {
  const cf = state.calcFolhas;
  const res = calcularFolhas();
  const papel = PAPEIS_CFG[cf.papel];

  return `
  <div class="calc-folhas-wrap" id="calc-folhas-wrap">
    <div class="calc-folhas-header">
      <div style="display:flex;align-items:center;gap:8px">
        <i class="fi fi-rr-ruler-triangle" style="color:var(--primary-light)"></i>
        <span style="font-weight:700;font-size:14px">Calculadora de Folhas</span>
        <span style="font-size:11px;color:var(--muted)">Quantos adesivos / etiquetas cabem por folha</span>
      </div>
      <button class="cf-close-btn" id="cf-close" title="Fechar calculadora">✕</button>
    </div>

    <div class="calc-folhas-body">
      <!-- Seleção de papel -->
      <div class="cf-section">
        <div class="cf-section-label">Tamanho da folha</div>
        <div class="cf-papeis-row">
          ${Object.entries(PAPEIS_CFG).map(([k, p]) => `
            <button class="cf-papel-btn ${cf.papel===k?"active":""}" data-cf-papel="${k}">
              <div class="cf-papel-nome">${p.label}</div>
              <div class="cf-papel-dim">${p.desc}</div>
              <div class="cf-papel-margem">margem ${p.margem}cm</div>
            </button>`).join("")}
        </div>
        <div class="cf-util-info">
          Área útil: <strong>${res.uw}×${res.uh}cm</strong>
        </div>
      </div>

      <!-- Tipo + Inputs -->
      <div class="cf-section">
        <div class="cf-section-label">Tipo de material</div>
        <div class="cf-tipo-switch">
          <button class="cf-tipo-btn ${cf.tipo==="adesivo"?"active":""}" data-cf-tipo="adesivo">
            <span class="cf-tipo-icon">🏷️</span>
            <span class="cf-tipo-nome">Adesivo</span>
            <span class="cf-tipo-esp">esp. 0,15cm</span>
          </button>
          <button class="cf-tipo-btn ${cf.tipo==="tag"?"active tag":""}" data-cf-tipo="tag">
            <span class="cf-tipo-icon">🔖</span>
            <span class="cf-tipo-nome">Tag / Etiqueta</span>
            <span class="cf-tipo-esp">esp. 0,50cm</span>
          </button>
        </div>

        <div class="cf-section-label" style="margin-top:10px">Dimensões</div>
        <div class="cf-inputs-row">
          <div class="cf-field">
            <label>Largura (cm)</label>
            <input id="cf-larg" type="number" min="0.1" step="0.1" value="${esc(cf.larg)}" placeholder="5" />
          </div>
          <div class="cf-field">
            <label>Altura (cm)</label>
            <input id="cf-alt" type="number" min="0.1" step="0.1" value="${esc(cf.alt)}" placeholder="5" />
          </div>
          <div class="cf-field">
            <label>Quantidade total</label>
            <input id="cf-qtd" type="number" min="1" step="1" value="${esc(cf.qtd)}" placeholder="100" />
          </div>
        </div>
      </div>

      <!-- Resultado (sempre visível, atualizado via DOM) -->
      <div class="cf-section" id="cf-resultado">
        <div class="cf-hint"><i class="fi fi-rr-info"></i> Preencha largura e altura para calcular automaticamente.</div>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMULÁRIO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
function renderForm() {
  const r = state.resultado;
  const mat = MATERIAIS.find(m => m.id === state.materialId) || MATERIAIS[0];
  const podeAdicionarLista = state.largura && state.altura && r.unitario > 0;

  // [ALTERAÇÃO 1] valor exibido: arredondado ou normal
  const valorExibido = state.arredondar ? r.grandArredondado : r.grand;

  // [ALTERAÇÃO 3] total dos itens da tabela
  const totalItensTabela = state.itens.reduce((s, i) => s + i.preco * i.qtd, 0);

  return `
  ${state.calcFolhasAberto ? renderCalculadoraFolhas() : ""}

  <div class="orc-layout">

    <!-- ── COLUNA ESQUERDA ──────────────────────────────────────────────── -->
    <div class="orc-left">

      <!-- Materiais -->
      <div class="orc-card">
        <div class="orc-card-title"><i class="fi fi-rr-layers"></i> Material</div>
        <div class="mat-grid">
          ${MATERIAIS.map(m => `
            <button class="mat-btn ${state.materialId===m.id?"active":""}" data-mat="${m.id}">
              ${m.label}
            </button>`).join("")}
        </div>
      </div>

      <!-- Medidas -->
      <div class="orc-card">
        <div class="orc-card-title"><i class="fi fi-rr-ruler"></i> Medidas e Quantidade</div>
        <div class="med-grid">
          <div class="field-group">
            <label>Largura (cm)</label>
            <input id="f-larg" type="number" min="0" step="0.1" placeholder="0" value="${state.largura}" />
          </div>
          <div class="field-group">
            <label>Altura (cm)</label>
            <input id="f-alt" type="number" min="0" step="0.1" placeholder="0" value="${state.altura}" />
          </div>
          <div class="field-group">
            <label>Quantidade</label>
            <input id="f-qtd" type="number" min="1" step="1" value="${state.quantidade}" />
          </div>
        </div>

        <div class="arte-row">
          <span class="arte-label"><i class="fi fi-rr-pencil"></i> Tem arte?</span>
          <div class="arte-opts">
            <label class="arte-opt">
              <input type="radio" name="arte" value="sim" ${state.temArte?"checked":""} />
              <span class="arte-chip ${state.temArte?"active":""}">Sim</span>
            </label>
            <label class="arte-opt">
              <input type="radio" name="arte" value="nao" ${!state.temArte?"checked":""} />
              <span class="arte-chip ${!state.temArte?"active nao":""}">Não</span>
            </label>
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
          <div class="field-group" style="width:80px">
            <label>Preço R$</label>
            <input id="ai-preco" type="number" min="0" step="0.01" placeholder="0,00" />
          </div>
          <div class="field-group" style="width:70px">
            <label>Qtd</label>
            <input id="ai-qtd-item" type="number" min="1" step="1" value="1" />
          </div>
          <button class="btn-add-item" id="btn-add-item" title="Adicionar item">
            <i class="fi fi-rr-add"></i>
          </button>
        </div>

        ${state.itens.length > 0 ? `
        <div class="itens-tabela-wrap">
          <table class="itens-tabela">
            <thead>
              <tr>
                <th>Produto / Serviço</th>
                <th style="text-align:center">Preço</th>
                <th style="text-align:center">Qtd</th>
                <th style="text-align:right">Total</th>
                <th style="width:32px"></th>
              </tr>
            </thead>
            <tbody>
              ${state.itens.map((it, i) => `
                <tr>
                  <td>${esc(it.descricao)}</td>
                  <td style="text-align:center">R$ ${Number(it.preco).toFixed(2)}</td>
                  <td style="text-align:center">${it.qtd}</td>
                  <td style="text-align:right;font-weight:600;color:var(--primary)">R$ ${(it.preco*it.qtd).toFixed(2)}</td>
                  <td><button class="del-item" data-del="${i}">✕</button></td>
                </tr>`).join("")}
            </tbody>
            <!-- [ALTERAÇÃO 3] Linha de total em tempo real -->
            <tfoot>
              <tr class="itens-total-row">
                <td colspan="3" style="text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Total produtos/serviços</td>
                <td style="text-align:right;font-weight:800;font-size:15px;color:var(--primary-light)" id="itens-total-live">R$ ${totalItensTabela.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>` : `<div class="itens-vazio"><i class="fi fi-rr-inbox"></i> Nenhum item adicionado</div>`}
      </div>

      <!-- Observações -->
      <div class="orc-card">
        <div class="orc-card-title"><i class="fi fi-rr-comment"></i> Observações</div>
        <textarea id="f-obs" rows="3" placeholder="Prazo de entrega, acabamento, condições de pagamento...">${esc(state.observacoes)}</textarea>
      </div>

    </div>

    <!-- ── COLUNA DIREITA (sticky) ───────────────────────────────────────── -->
    <div class="orc-right">

      <!-- Resultado -->
      <div class="orc-card resultado-card">
        <div class="orc-card-title"><i class="fi fi-rr-chart-histogram"></i> Resultado</div>

        <div class="material-sel-info">
          <span class="mat-label-tag">${mat.label}</span>
          ${!state.temArte?`<span class="arte-tag">+ Arte 20%</span>`:""}
        </div>

        <div class="res-linhas">
          <div class="res-linha">
            <span>Área</span>
            <span id="r-area">${r.area.toFixed(4)} m²</span>
          </div>
          <div class="res-linha">
            <span>Valor unitário</span>
            <span id="r-unit">R$ ${r.unitario.toFixed(2)}</span>
          </div>
          ${state.itens.length > 0 ? `
          <div class="res-linha">
            <span>Subtotal impressão</span>
            <span>R$ ${r.total.toFixed(2)}</span>
          </div>
          <div class="res-linha">
            <span>Produtos/Serviços</span>
            <span>R$ ${r.totalItens.toFixed(2)}</span>
          </div>` : ""}
        </div>

        <div class="res-total">
          <span>Total</span>
          <span id="r-total">R$ ${valorExibido.toFixed(2)}</span>
        </div>

        <!-- [ALTERAÇÃO 1] Toggle de arredondamento -->
        <div class="arredondar-row">
          <span class="arredondar-label"><i class="fi fi-rr-arrows-repeat-1"></i> Arredondar valor?</span>
          <div class="arte-opts">
            <label class="arte-opt">
              <input type="radio" name="arredondar" value="sim" ${state.arredondar?"checked":""} />
              <span class="arte-chip ${state.arredondar?"active":""}">Sim</span>
            </label>
            <label class="arte-opt">
              <input type="radio" name="arredondar" value="nao" ${!state.arredondar?"checked":""} />
              <span class="arte-chip ${!state.arredondar?"active":""}">Não</span>
            </label>
          </div>
        </div>
        ${state.arredondar && r.grand !== r.grandArredondado ? `
        <div class="arredondar-info">
          <i class="fi fi-rr-info"></i>
          Valor original: <strong>R$ ${r.grand.toFixed(2)}</strong>
          → arredondado para <strong>R$ ${r.grandArredondado.toFixed(2)}</strong>
        </div>` : ""}

        <!-- Botão adicionar impressão à lista -->
        ${podeAdicionarLista ? `
        <button class="btn-add-m2-lista" id="btn-add-m2-lista">
          <i class="fi fi-rr-add"></i> Adicionar impressão à lista
        </button>` : `
        <div class="add-m2-hint">
          <i class="fi fi-rr-info"></i> Preencha as medidas para adicionar à lista
        </div>`}
      </div>

      <!-- Ações -->
      <div class="orc-card acoes-card">
        <div class="orc-card-title"><i class="fi fi-rr-cursor"></i> Ações</div>
        <div class="acoes-grid">
          <button class="btn-acao primary" id="btn-converter">
            <i class="fi fi-rr-arrow-right"></i> Converter em Venda
          </button>
          <button class="btn-acao success" id="btn-salvar">
            <i class="fi fi-rr-disk"></i> Salvar
          </button>
          <button class="btn-acao info" id="btn-pdf">
            <i class="fi fi-rr-file-pdf"></i> PDF
          </button>
          <button class="btn-acao warn" id="btn-imprimir">
            <i class="fi fi-rr-print"></i> Imprimir
          </button>
          <button class="btn-acao danger" id="btn-limpar">
            <i class="fi fi-rr-trash"></i> Limpar
          </button>
        </div>
      </div>

    </div>
  </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTÓRICO
// ══════════════════════════════════════════════════════════════════════════════
function renderHistorico() {
  if (state.orcamentos.length === 0) {
    return `<div class="hist-vazio"><i class="fi fi-rr-clock"></i><p>Nenhum orçamento salvo ainda.</p></div>`;
  }

  const STATUS_CFG = {
    rascunho: { cor: "var(--muted)",   label: "Rascunho" },
    enviado:  { cor: "var(--primary)", label: "Enviado"  },
    aprovado: { cor: "var(--success)", label: "Aprovado" },
    recusado: { cor: "var(--error)",   label: "Recusado" },
  };

  return `
  <div class="hist-lista">
    ${state.orcamentos.map(o => {
      const st = STATUS_CFG[o.status] || STATUS_CFG.rascunho;
      const data = new Date(o.created_at).toLocaleDateString("pt-BR");
      return `
        <div class="hist-card">
          <div class="hist-card-top">
            <div>
              <div class="hist-cliente">${esc(o.cliente_nome) || "Sem cliente"}</div>
              <div class="hist-data">${data}</div>
            </div>
            <div style="text-align:right">
              <div class="hist-valor">R$ ${Number(o.total||0).toFixed(2)}</div>
              <span class="hist-badge-st" style="color:${st.cor}">${st.label}</span>
            </div>
          </div>
          ${o.observacoes ? `<div class="hist-obs">${esc(o.observacoes)}</div>` : ""}
          <div class="hist-acoes">
            <button class="btn-icon" data-abrir="${o.id}"><i class="fi fi-rr-pencil"></i> Abrir</button>
            <button class="btn-icon" data-conv-hist="${o.id}"><i class="fi fi-rr-arrow-right"></i> Converter</button>
            <button class="btn-icon danger" data-del-orc="${o.id}" data-del-nome="${esc(o.cliente_nome||"este orçamento")}">
              <i class="fi fi-rr-trash"></i>
            </button>
          </div>
        </div>`;
    }).join("")}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// EVENTOS
// ══════════════════════════════════════════════════════════════════════════════
function bindEvents(container) {
  // Botão calculadora de folhas
  container.querySelector("#btn-calc-folhas")?.addEventListener("click", () => {
    state.calcFolhasAberto = !state.calcFolhasAberto;
    render(container);
    // após render, inicializar cálculo se tiver dados
    if (state.calcFolhasAberto) {
      atualizarCalcFolhasDOM(container);
    }
  });

  // Abas
  container.querySelector("#btn-historico")?.addEventListener("click", () => {
    state.aba = state.aba === "historico" ? "form" : "historico";
    render(container);
  });
  container.querySelector("#btn-novo")?.addEventListener("click", () => {
    limparForm();
    state.aba = "form";
    render(container);
  });

  if (state.aba === "historico") {
    bindHistoricoEvents(container);
    return;
  }

  // ── Calculadora de folhas (eventos internos) ──
  if (state.calcFolhasAberto) {
    bindCalcFolhasEvents(container);
    // Calcula resultado inicial se já tiver dados
    atualizarCalcFolhasDOM(container);
  }

  // ── Materiais ──
  container.querySelectorAll("[data-mat]").forEach(btn =>
    btn.addEventListener("click", () => {
      state.materialId = btn.dataset.mat;
      calcular(container);
      render(container);
    })
  );

  // ── Inputs de medidas ──
  ["f-larg","f-alt","f-qtd"].forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener("input", e => {
      if (id === "f-larg") state.largura = e.target.value;
      if (id === "f-alt")  state.altura  = e.target.value;
      if (id === "f-qtd")  state.quantidade = e.target.value;
      calcular(container);
    });
  });

  // ── Tem arte? ──
  container.querySelectorAll("input[name='arte']").forEach(inp =>
    inp.addEventListener("change", () => {
      state.temArte = inp.value === "sim";
      calcular(container);
      container.querySelectorAll(".arte-chip").forEach(c => c.classList.remove("active","nao"));
      const chips = container.querySelectorAll(".arte-chip");
      if (state.temArte) { chips[0].classList.add("active"); }
      else               { chips[1].classList.add("active","nao"); }
      atualizarResultadoDOM(container);
    })
  );

  // [ALTERAÇÃO 1] ── Arredondar? ──
  container.querySelectorAll("input[name='arredondar']").forEach(inp =>
    inp.addEventListener("change", () => {
      state.arredondar = inp.value === "sim";
      calcular(container);
      render(container);
    })
  );

  // ── Observações ──
  container.querySelector("#f-obs")?.addEventListener("input", e => {
    state.observacoes = e.target.value;
  });

  // ── Autocomplete de produtos ──
  const aiProd  = container.querySelector("#ai-prod");
  const acList  = container.querySelector("#ac-prod");
  if (aiProd) {
    aiProd.addEventListener("input", () => {
      const q = aiProd.value.trim().toLowerCase();
      if (!q) { acList.innerHTML = ""; acList.style.display = "none"; return; }
      const matches = state.produtos.filter(p => p.nome.toLowerCase().includes(q)).slice(0,6);
      if (!matches.length) { acList.style.display = "none"; return; }
      acList.innerHTML = matches.map(p =>
        `<div class="ac-item" data-nome="${esc(p.nome)}">${esc(p.nome)}</div>`
      ).join("");
      acList.style.display = "block";
    });
    acList.addEventListener("click", e => {
      const it = e.target.closest(".ac-item");
      if (!it) return;
      aiProd.value = it.dataset.nome;
      acList.style.display = "none";
    });
  }

  // ── Add item ──
  container.querySelector("#btn-add-item")?.addEventListener("click", () => {
    const desc  = container.querySelector("#ai-prod").value.trim();
    const preco = parseFloat(container.querySelector("#ai-preco").value) || 0;
    const qtd   = parseInt(container.querySelector("#ai-qtd-item").value) || 1;
    if (!desc)  { flashInput(container.querySelector("#ai-prod"));  return; }
    if (!preco) { flashInput(container.querySelector("#ai-preco")); return; }
    state.itens.push({ descricao: desc, preco, qtd });
    container.querySelector("#ai-prod").value  = "";
    container.querySelector("#ai-preco").value = "";
    container.querySelector("#ai-qtd-item").value = "1";
    calcular(container);
    render(container);
  });

  // ── Del item ──
  container.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => {
      state.itens.splice(parseInt(btn.dataset.del), 1);
      calcular(container);
      render(container);
    })
  );

  // ── Adicionar impressão m² à lista ──
  container.querySelector("#btn-add-m2-lista")?.addEventListener("click", () => {
    adicionarImpressaoNaLista(container);
  });

  // ── Ações ──
  container.querySelector("#btn-salvar")?.addEventListener("click", () => salvarOrcamento(container));
  container.querySelector("#btn-limpar")?.addEventListener("click", () => { limparForm(); render(container); });
  container.querySelector("#btn-pdf")?.addEventListener("click", () => gerarPDF());
  container.querySelector("#btn-imprimir")?.addEventListener("click", () => imprimir());
  container.querySelector("#btn-converter")?.addEventListener("click", () => abrirModalConverter(container));

  // ── Cálculo inicial ──
  calcular(container);
}

// ─── Eventos internos da calculadora de folhas ────────────────────────────────
function bindCalcFolhasEvents(container) {
  // Fechar
  container.querySelector("#cf-close")?.addEventListener("click", () => {
    state.calcFolhasAberto = false;
    render(container);
  });

  // Selecionar tipo (adesivo / tag)
  container.querySelectorAll("[data-cf-tipo]").forEach(btn =>
    btn.addEventListener("click", () => {
      state.calcFolhas.tipo = btn.dataset.cfTipo;
      container.querySelectorAll("[data-cf-tipo]").forEach(b => {
        b.classList.remove("active","tag");
      });
      btn.classList.add("active");
      if (btn.dataset.cfTipo === "tag") btn.classList.add("tag");
      atualizarCalcFolhasDOM(container);
    })
  );

  // Selecionar papel
  container.querySelectorAll("[data-cf-papel]").forEach(btn =>
    btn.addEventListener("click", () => {
      state.calcFolhas.papel = btn.dataset.cfPapel;
      // Atualiza botões ativos
      container.querySelectorAll("[data-cf-papel]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      atualizarCalcFolhasDOM(container);
    })
  );

  // Inputs largura / altura / qtd
  ["cf-larg", "cf-alt", "cf-qtd"].forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener("input", e => {
      const key = id.replace("cf-", ""); // larg | alt | qtd
      state.calcFolhas[key] = e.target.value;
      atualizarCalcFolhasDOM(container);
    });
  });
}

function bindHistoricoEvents(container) {
  container.querySelectorAll("[data-abrir]").forEach(btn =>
    btn.addEventListener("click", async () => {
      const orc = state.orcamentos.find(o => o.id === btn.dataset.abrir);
      if (!orc) return;
      const { data: itens } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", orc.id);
      state.itens = (itens||[]).map(i => ({ descricao: i.descricao, preco: Number(i.preco_unitario), qtd: Number(i.quantidade) }));
      state.observacoes = orc.observacoes || "";
      state.aberto = orc;
      state.aba = "form";
      render(container);
    })
  );

  container.querySelectorAll("[data-del-orc]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm(`Excluir orçamento de "${btn.dataset.delNome}"?`)) return;
      await supabase.from("orcamentos").delete().eq("id", btn.dataset.delOrc);
      await carregar();
      render(container);
    })
  );

  container.querySelectorAll("[data-conv-hist]").forEach(btn =>
    btn.addEventListener("click", () => {
      const orc = state.orcamentos.find(o => o.id === btn.dataset.convHist);
      if (orc) { state.aberto = orc; state.aba = "form"; render(container); abrirModalConverter(container); }
    })
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADICIONAR IMPRESSÃO M² À LISTA
// ══════════════════════════════════════════════════════════════════════════════
function adicionarImpressaoNaLista(container) {
  const r   = state.resultado;
  const mat = MATERIAIS.find(m => m.id === state.materialId) || MATERIAIS[0];
  if (!state.largura || !state.altura || r.unitario <= 0) return;

  // [ALTERAÇÃO 2] sem menção a arte na descrição do item da lista
  const descricao = `${mat.label} ${state.largura}×${state.altura}cm`;
  const qtd = parseInt(state.quantidade) || 1;

  // Tenta encontrar produto correspondente no catálogo
  const produtoMatch = state.produtos.find(p =>
    p.nome.toLowerCase().includes(mat.label.toLowerCase().split(" ")[0]) ||
    mat.label.toLowerCase().includes(p.nome.toLowerCase().slice(0, 8))
  );

  state.itens.push({
    descricao,
    produtoId: produtoMatch?.id || null,
    preco: r.unitario,
    qtd,
  });

  calcular(container);
  render(container);
  showToast(container, `✅ "${descricao}" adicionado à lista!`);
}

// ══════════════════════════════════════════════════════════════════════════════
// CÁLCULO EM TEMPO REAL
// ══════════════════════════════════════════════════════════════════════════════
function calcular(container) {
  const larg = parseFloat(state.largura) / 100 || 0;
  const alt  = parseFloat(state.altura)  / 100 || 0;
  const qtd  = parseInt(state.quantidade) || 1;

  const mat   = MATERIAIS.find(m => m.id === state.materialId) || MATERIAIS[0];
  const area  = larg * alt;
  let unitario = area * mat.preco;

  if (!state.temArte) unitario = unitario * (1 + ACRESCIMO_SEM_ARTE);

  const total      = unitario * qtd;
  const totalItens = state.itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  const grand      = total + totalItens;

  // [ALTERAÇÃO 1] arredondar para cima no múltiplo de 5 mais próximo
  const grandArredondado = Math.ceil(grand / 5) * 5;

  state.resultado = { area, unitario, total, totalItens, grand, grandArredondado };
  atualizarResultadoDOM(container);
}

function atualizarResultadoDOM(container) {
  const r = state.resultado;
  // [ALTERAÇÃO 1] exibe valor arredondado se ativo
  const valorExibido = state.arredondar ? r.grandArredondado : r.grand;
  const setEl = (id, val) => { const el = container?.querySelector(`#${id}`); if (el) el.textContent = val; };
  setEl("r-area",  r.area.toFixed(4) + " m²");
  setEl("r-unit",  "R$ " + r.unitario.toFixed(2));
  setEl("r-total", "R$ " + valorExibido.toFixed(2));
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: CONVERTER EM VENDA
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalConverter(container) {
  const area = document.getElementById("app-modal-root");
  const r    = state.resultado;
  const mat  = MATERIAIS.find(m => m.id === state.materialId);

  // [ALTERAÇÃO 1] usar valor arredondado se ativo
  const totalFinal = state.arredondar ? r.grandArredondado : r.grand;

  const clienteOptions = state.clientes.map(c =>
    `<option value="${esc(c.id)}" data-nome="${esc(c.nome)}">${esc(c.nome)}</option>`
  ).join("");

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:520px">
        <h3><i class="fi fi-rr-arrow-right" style="color:var(--primary)"></i> Converter em Venda</h3>

        <div class="conv-resumo">
          <div class="conv-res-linha"><span>Material</span><strong>${mat?.label||""}</strong></div>
          <div class="conv-res-linha"><span>Dimensões</span><strong>${state.largura||0}×${state.altura||0} cm</strong></div>
          <div class="conv-res-linha"><span>Quantidade</span><strong>${state.quantidade}</strong></div>
          ${state.itens.length>0?`<div class="conv-res-linha"><span>Itens adicionais</span><strong>${state.itens.length} item(s)</strong></div>`:""}
          <div class="conv-res-linha total"><span>Total</span><strong>R$ ${totalFinal.toFixed(2)}</strong></div>
        </div>

        <div class="modal-sep"></div>

        <div class="modal-section-label">Dados do Cliente</div>

        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-bottom:10px">
          <div>
            <label>Cliente</label>
            <div class="autocomplete-wrap">
              <input id="mc-cliente" placeholder="Buscar cliente cadastrado..." autocomplete="off"
                value="${state.aberto?.cliente_nome||""}" />
              <div class="autocomplete-list" id="ac-cli"></div>
            </div>
          </div>
          <button class="btn-mini-cad" id="btn-cad-cli" title="Cadastrar novo cliente">
            <i class="fi fi-rr-user-add"></i> Novo
          </button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label>Telefone</label>
            <input id="mc-tel" placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label>Vendedor</label>
            <input id="mc-vendedor" placeholder="Nome do vendedor" />
          </div>
        </div>

        <div>
          <label>Observações da venda</label>
          <textarea id="mc-obs" rows="2" placeholder="Prazo, condições...">${esc(state.observacoes)}</textarea>
        </div>

        <div class="modal-btns">
          <button class="btn-secondary" id="mc-cancel">Cancelar</button>
          <button class="btn-primary" id="mc-ok"><i class="fi fi-rr-check"></i> Confirmar Venda</button>
        </div>
      </div>
    </div>`;

  const mcCli  = area.querySelector("#mc-cliente");
  const acCli  = area.querySelector("#ac-cli");
  mcCli.addEventListener("input", () => {
    const q = mcCli.value.trim().toLowerCase();
    if (!q) { acCli.style.display = "none"; return; }
    const matches = state.clientes.filter(c => c.nome.toLowerCase().includes(q)).slice(0,6);
    if (!matches.length) { acCli.style.display = "none"; return; }
    acCli.innerHTML = matches.map(c =>
      `<div class="ac-item" data-nome="${esc(c.nome)}" data-tel="${esc(c.telefone||"")}">${esc(c.nome)}</div>`
    ).join("");
    acCli.style.display = "block";
  });
  acCli.addEventListener("click", e => {
    const it = e.target.closest(".ac-item");
    if (!it) return;
    mcCli.value = it.dataset.nome;
    area.querySelector("#mc-tel").value = it.dataset.tel || "";
    acCli.style.display = "none";
  });

  area.querySelector("#btn-cad-cli").addEventListener("click", () => {
    const nome = mcCli.value.trim();
    abrirModalCadCliente(container, nome, (c) => {
      mcCli.value = c.nome;
      area.querySelector("#mc-tel").value = c.telefone || "";
    });
  });

  area.querySelector("#mc-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id==="modal-bg") area.innerHTML=""; });

  area.querySelector("#mc-ok").addEventListener("click", async () => {
    const clienteNome = mcCli.value.trim();
    const obs   = area.querySelector("#mc-obs").value.trim();

    const mat = MATERIAIS.find(m => m.id === state.materialId);
    // [ALTERAÇÃO 2] sem info de arte na descrição do pedido confirmado
    const descricaoPrincipal = `${mat?.label||"Impressão"} ${state.largura||0}×${state.altura||0}cm`;

    const { data: venda, error } = await supabase.from("vendas").insert({
      cliente_nome: clienteNome||null,
      observacoes: obs||null,
      status: "pendente",
      total: totalFinal,
    }).select().single();

    if (error) { alert("Erro ao criar venda: "+error.message); return; }

    const vendaItens = [];
    if (state.resultado.total > 0) {
      vendaItens.push({
        venda_id: venda.id, produto_id: null,
        descricao: descricaoPrincipal,
        quantidade: parseInt(state.quantidade)||1,
        preco_unitario: state.resultado.unitario,
        total: state.resultado.total,
      });
    }
    state.itens.forEach(it => {
      vendaItens.push({
        venda_id: venda.id, produto_id: it.produtoId||null,
        descricao: it.descricao,
        quantidade: it.qtd,
        preco_unitario: it.preco,
        total: it.preco * it.qtd,
      });
    });
    if (vendaItens.length) await supabase.from("venda_itens").insert(vendaItens);

    await supabase.from("orcamentos").insert({
      cliente_nome: clienteNome||null,
      observacoes: obs||null,
      status: "aprovado",
      total: totalFinal,
      venda_id: venda.id,
    });

    area.innerHTML = "";
    alert(`✅ Venda criada com sucesso!\nCliente: ${clienteNome||"Não informado"}\nTotal: R$ ${totalFinal.toFixed(2)}`);
    limparForm();
    await carregar();
    render(container);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: CADASTRAR CLIENTE RÁPIDO
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalCadCliente(container, nomeInicial, callback) {
  const area = document.getElementById("app-modal-root");
  const prev = area.innerHTML;

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg-cli">
      <div class="modal" style="max-width:400px">
        <h3><i class="fi fi-rr-user-add"></i> Novo Cliente</h3>
        <label>Nome *</label>
        <input id="cc-nome" value="${esc(nomeInicial)}" placeholder="Nome completo" autofocus />
        <label>Telefone</label>
        <input id="cc-tel" placeholder="(00) 00000-0000" />
        <label>E-mail</label>
        <input id="cc-email" type="email" placeholder="email@exemplo.com" />
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
    const { data: c } = await supabase.from("clientes").insert({
      nome,
      telefone: area.querySelector("#cc-tel").value.trim()||null,
      email:    area.querySelector("#cc-email").value.trim()||null,
    }).select().single();
    state.clientes.push(c);
    area.innerHTML = prev;
    callback(c);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SALVAR ORÇAMENTO
// ══════════════════════════════════════════════════════════════════════════════
async function salvarOrcamento(container) {
  const mat = MATERIAIS.find(m => m.id === state.materialId);
  // [ALTERAÇÃO 2] sem info de arte na descrição salva
  const desc = `${mat?.label||"Impressão"} ${state.largura||0}×${state.altura||0}cm`;

  // [ALTERAÇÃO 1] usar valor arredondado se ativo
  const totalFinal = state.arredondar ? state.resultado.grandArredondado : state.resultado.grand;

  const { data: orc, error } = await supabase.from("orcamentos").insert({
    cliente_nome: null,
    observacoes:  state.observacoes||null,
    status:       "rascunho",
    total:        totalFinal,
  }).select().single();

  if (error) { alert("Erro ao salvar: "+error.message); return; }

  const itensDb = [];
  if (state.resultado.total > 0) {
    itensDb.push({
      orcamento_id: orc.id, produto_id: null,
      descricao: desc,
      tipo_calculo: "m2",
      largura_cm: parseFloat(state.largura)||0,
      altura_cm:  parseFloat(state.altura)||0,
      quantidade: parseInt(state.quantidade)||1,
      preco_unitario: state.resultado.unitario,
      total: state.resultado.total,
    });
  }
  state.itens.forEach(it => {
    itensDb.push({
      orcamento_id: orc.id, produto_id: it.produtoId||null,
      descricao: it.descricao,
      tipo_calculo: "unidade",
      quantidade: it.qtd,
      preco_unitario: it.preco,
      total: it.preco * it.qtd,
    });
  });
  if (itensDb.length) await supabase.from("orcamento_itens").insert(itensDb);

  await carregar();
  showToast(container, "✅ Orçamento salvo!");
  render(container);
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF / IMPRESSÃO
// ══════════════════════════════════════════════════════════════════════════════
function gerarPDF() {
  const r   = state.resultado;
  const mat = MATERIAIS.find(m => m.id === state.materialId);

  // [ALTERAÇÃO 1] usar valor arredondado se ativo
  const totalFinal = state.arredondar ? r.grandArredondado : r.grand;

  const linhas = [];
  if (r.total > 0) {
    // [ALTERAÇÃO 2] sem info de arte na descrição do PDF
    linhas.push({
      desc: `${mat?.label||"Impressão"} ${state.largura||0}×${state.altura||0}cm`,
      qtd: state.quantidade, preco: r.unitario, total: r.total,
    });
  }
  state.itens.forEach(it => linhas.push({ desc: it.descricao, qtd: it.qtd, preco: it.preco, total: it.preco*it.qtd }));

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Orçamento – Gráfica Master Print</title>
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
</style>
</head>
<body>
<h1>Gráfica Master Print</h1>
<div class="sub">R. Elieser Pena, 67, Centro – Poté/MG · (33) 99813-9539 · @gmasterprint</div>
<hr>
<strong>ORÇAMENTO</strong> — ${new Date().toLocaleDateString("pt-BR")}
<table>
  <thead><tr><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead>
  <tbody>
    ${linhas.map(l => `
      <tr>
        <td>${l.desc}</td>
        <td>${l.qtd}</td>
        <td>R$ ${l.preco.toFixed(2)}</td>
        <td>R$ ${l.total.toFixed(2)}</td>
      </tr>`).join("")}
    <tr class="total-row">
      <td colspan="3" style="text-align:right">TOTAL</td>
      <td>R$ ${totalFinal.toFixed(2)}</td>
    </tr>
  </tbody>
</table>
${state.observacoes ? `<div class="obs"><strong>Observações:</strong> ${esc(state.observacoes)}</div>` : ""}
<div class="footer">Este orçamento tem validade de 15 dias.</div>
</body></html>`;

  const win = window.open("", "_blank", "width=800,height=600");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

function imprimir() { gerarPDF(); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function limparForm() {
  state.materialId  = "adesivo_vinil";
  state.temArte     = true;
  state.largura     = "";
  state.altura      = "";
  state.quantidade  = 1;
  state.itens       = [];
  state.observacoes = "";
  state.aberto      = null;
  state.arredondar  = false; // [ALTERAÇÃO 1] resetar arredondamento
  state.resultado   = { area:0, unitario:0, total:0, totalItens:0, grand:0, grandArredondado:0 };
}

function flashInput(el) {
  if (!el) return;
  el.style.borderColor = "var(--error)";
  el.focus();
  setTimeout(() => el.style.borderColor = "", 1500);
}

function showToast(container, msg) {
  const t = document.createElement("div");
  t.className = "orc-toast";
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function css() { return `
/* ── Layout ── */
.orc-topbar {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:20px; flex-wrap:wrap; gap:10px;
}
.orc-layout {
  display:grid; grid-template-columns:1fr 280px; gap:16px; align-items:start;
}
@media(max-width:860px){ .orc-layout { grid-template-columns:1fr; } }

/* ── Cards ── */
.orc-card {
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-lg); padding:16px; margin-bottom:14px;
}
.orc-card-title {
  font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em; color:var(--muted); margin-bottom:14px;
  display:flex; align-items:center; gap:6px;
}
.orc-card-title i { font-size:13px; }

/* ── Header btns ── */
.btn-hist {
  display:inline-flex; align-items:center; gap:6px;
  background:transparent; border:1px solid var(--border-md);
  color:var(--muted); border-radius:var(--radius-md);
  padding:7px 13px; font-size:12px; font-weight:500; cursor:pointer;
  transition:all var(--t); position:relative;
}
.btn-hist:hover, .btn-hist.active { background:var(--panel2); color:var(--text); border-color:var(--primary); }
.btn-hist.active { color:var(--primary); }
.hist-badge {
  display:inline-flex; align-items:center; justify-content:center;
  background:var(--primary); color:#fff; font-size:10px; font-weight:700;
  min-width:18px; height:18px; border-radius:99px; padding:0 4px;
}
.btn-novo-orc {
  display:inline-flex; align-items:center; gap:6px;
  background:var(--primary); color:#fff; border:none;
  border-radius:var(--radius-md); padding:8px 14px;
  font-size:13px; font-weight:600; cursor:pointer; transition:all var(--t);
}
.btn-novo-orc:hover { opacity:.88; }

/* ── Botão calculadora de folhas ── */
.btn-calc-folhas {
  display:inline-flex; align-items:center; gap:6px;
  background:transparent; border:1px solid var(--border-md);
  color:var(--muted); border-radius:var(--radius-md);
  padding:7px 13px; font-size:12px; font-weight:500; cursor:pointer;
  transition:all var(--t);
}
.btn-calc-folhas:hover { background:rgba(0,172,23,0.08); color:var(--info); border-color:var(--info); }
.btn-calc-folhas.active { background:rgba(0,172,23,0.1); color:var(--info); border-color:var(--info); font-weight:700; }

/* ══════════════════════════════════════════════════════════════════════════════
   CALCULADORA DE FOLHAS
══════════════════════════════════════════════════════════════════════════════ */
.calc-folhas-wrap {
  background:var(--panel2);
  border:1px solid rgba(0,172,23,0.25);
  border-left:4px solid var(--info);
  border-radius:var(--radius-lg);
  margin-bottom:16px;
  overflow:hidden;
  animation:slideUp .15s ease;
}

.calc-folhas-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 16px;
  background:rgba(0,172,23,0.06);
  border-bottom:1px solid rgba(0,172,23,0.15);
}

.cf-close-btn {
  background:transparent; border:1px solid var(--border-md);
  color:var(--muted); border-radius:var(--radius-sm);
  padding:3px 8px; cursor:pointer; font-size:13px;
  transition:all var(--t);
}
.cf-close-btn:hover { background:var(--error-bg); color:var(--error); border-color:var(--error-border); }

.calc-folhas-body {
  padding:16px;
  display:grid;
  grid-template-columns:auto 1fr auto;
  gap:16px;
  align-items:start;
}
@media(max-width:900px){ .calc-folhas-body { grid-template-columns:1fr 1fr; } }
@media(max-width:600px){ .calc-folhas-body { grid-template-columns:1fr; } }

.cf-section { display:flex; flex-direction:column; gap:8px; }

.cf-section-label {
  font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.06em; color:var(--muted); margin-bottom:2px;
}

/* ── Tipo switch (adesivo / tag) ── */
.cf-tipo-switch {
  display:flex; gap:8px;
}
.cf-tipo-btn {
  display:flex; flex-direction:column; align-items:center; gap:3px;
  padding:10px 18px; border-radius:var(--radius-md);
  border:1px solid var(--border-md); background:var(--panel);
  color:var(--muted); cursor:pointer; transition:all var(--t);
  flex:1;
}
.cf-tipo-btn:hover { border-color:var(--primary); color:var(--text); }
.cf-tipo-btn.active {
  background:rgba(0,124,190,0.12); border-color:var(--primary);
  color:var(--primary-light);
  box-shadow:0 0 0 3px rgba(0,124,190,0.10);
}
.cf-tipo-btn.active.tag {
  background:rgba(232,160,16,0.10); border-color:var(--warning);
  color:var(--warning);
  box-shadow:0 0 0 3px rgba(232,160,16,0.10);
}
.cf-tipo-icon { font-size:18px; line-height:1; }
.cf-tipo-nome { font-size:13px; font-weight:700; }
.cf-tipo-esp  { font-size:10px; color:inherit; opacity:.75; }

/* ── Botões de papel ── */
.cf-papeis-row { display:flex; gap:6px; }
.cf-papel-btn {
  display:flex; flex-direction:column; align-items:center; gap:2px;
  padding:10px 14px; border-radius:var(--radius-md);
  border:1px solid var(--border-md); background:var(--panel);
  color:var(--muted); cursor:pointer; transition:all var(--t);
  min-width:80px;
}
.cf-papel-btn:hover { border-color:var(--info); color:var(--text); }
.cf-papel-btn.active {
  background:rgba(0,172,23,0.10); border-color:var(--info);
  color:var(--info);
  box-shadow:0 0 0 3px rgba(0,172,23,0.10);
}
.cf-papel-nome { font-size:14px; font-weight:800; }
.cf-papel-dim  { font-size:10px; color:inherit; opacity:.8; }
.cf-papel-margem { font-size:10px; color:var(--muted); }
.cf-papel-btn.active .cf-papel-margem { color:rgba(0,172,23,0.7); }

.cf-util-info {
  font-size:12px; color:var(--muted);
  background:var(--panel); border:1px solid var(--border);
  border-radius:var(--radius-sm); padding:5px 10px;
  display:inline-block;
}
.cf-util-info strong { color:var(--info); }

/* Inputs da calculadora */
.cf-inputs-row {
  display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;
}
.cf-field { display:flex; flex-direction:column; gap:4px; width:100px; }
.cf-field label { font-size:11px; color:var(--muted); font-weight:500; }
.cf-field input {
  background:var(--panel); border:1px solid var(--border-md);
  color:var(--text); border-radius:var(--radius-md);
  padding:9px 10px; font-size:14px; font-weight:700;
  text-align:center;
  transition:border-color var(--t);
}
.cf-field input:focus { border-color:var(--info); box-shadow:0 0 0 3px rgba(0,172,23,0.10); }

/* Resultado da calculadora */
.cf-hint {
  display:flex; align-items:center; gap:6px;
  font-size:12px; color:var(--muted); padding:12px;
  background:var(--panel); border-radius:var(--radius-md);
  border:1px dashed var(--border-md);
}

.cf-sem-fit {
  font-size:12px; color:var(--warning); padding:12px;
  background:var(--warning-bg); border-radius:var(--radius-md);
  border:1px solid rgba(232,160,16,0.25);
}

.cf-res-cards {
  display:flex; gap:10px; flex-wrap:wrap;
}
.cf-res-card {
  background:var(--panel); border:1px solid var(--border);
  border-radius:var(--radius-md); padding:12px 16px;
  text-align:center; min-width:90px; flex:1;
}
.cf-res-card.primary {
  background:rgba(0,172,23,0.10);
  border-color:rgba(0,172,23,0.3);
}
.cf-res-card.muted { opacity:.5; }
.cf-res-num {
  font-size:22px; font-weight:800; color:var(--text); line-height:1;
}
.cf-res-card.primary .cf-res-num { color:var(--info); font-size:26px; }
.cf-res-label {
  font-size:11px; color:var(--muted); margin-top:3px;
}
.cf-rotated {
  font-size:10px; color:var(--primary-light); margin-top:4px;
  display:flex; align-items:center; gap:3px; justify-content:center;
}

/* ── Botão adicionar impressão à lista ── */
.btn-add-m2-lista {
  display:flex; align-items:center; justify-content:center; gap:7px;
  width:100%; margin-top:10px; padding:10px 14px;
  background:rgba(0,124,190,0.12); border:1px solid var(--primary-border);
  color:var(--primary-light); border-radius:var(--radius-md);
  font-family:var(--font); font-size:13px; font-weight:600;
  cursor:pointer; transition:all var(--t);
}
.btn-add-m2-lista:hover { background:var(--primary); color:#fff; }

.add-m2-hint {
  display:flex; align-items:center; gap:6px; justify-content:center;
  margin-top:10px; font-size:11px; color:var(--muted);
  padding:8px; background:var(--panel); border-radius:var(--radius-sm);
  border:1px dashed var(--border-md);
}

/* ── Materiais ── */
.mat-grid {
  display:grid; grid-template-columns:repeat(3,1fr); gap:8px;
}
@media(max-width:500px){ .mat-grid { grid-template-columns:1fr 1fr; } }
.mat-btn {
  background:var(--panel); border:1px solid var(--border-md);
  color:var(--muted); border-radius:var(--radius-md);
  padding:10px 6px; font-size:12px; font-weight:500; cursor:pointer;
  transition:all var(--t); text-align:center; line-height:1.3;
}
.mat-btn:hover { border-color:var(--primary); color:var(--text); }
.mat-btn.active {
  background:var(--primary-bg); border-color:var(--primary);
  color:var(--primary-light); font-weight:700;
  box-shadow:0 0 0 3px rgba(0,124,190,0.1);
}

/* ── Medidas ── */
.med-grid {
  display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px;
}
@media(max-width:500px){ .med-grid { grid-template-columns:1fr 1fr; } }
.field-group { display:flex; flex-direction:column; gap:5px; }
.field-group label { font-size:12px; color:var(--muted); font-weight:500; }

/* ── Arte ── */
.arte-row {
  display:flex; align-items:center; justify-content:space-between;
  background:var(--panel); border:1px solid var(--border);
  border-radius:var(--radius-md); padding:10px 14px;
}
.arte-label { font-size:13px; font-weight:600; display:flex; align-items:center; gap:7px; }
.arte-opts  { display:flex; gap:8px; }
.arte-opt   { cursor:pointer; }
.arte-opt input { display:none; }
.arte-chip {
  display:inline-block; padding:5px 16px; border-radius:99px;
  border:1px solid var(--border-md); font-size:12px; font-weight:600;
  color:var(--muted); transition:all var(--t); cursor:pointer;
}
.arte-chip.active     { background:var(--success); border-color:var(--success); color:#fff; }
.arte-chip.active.nao { background:var(--error);   border-color:var(--error);   color:#fff; }

/* ── Add item ── */
.add-item-row {
  display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; margin-bottom:12px;
}
.btn-add-item {
  background:var(--primary); color:#fff; border:none;
  border-radius:var(--radius-md); padding:9px 12px;
  font-size:14px; cursor:pointer; transition:all var(--t); flex-shrink:0;
  display:flex; align-items:center; height:38px; margin-top:auto;
}
.btn-add-item:hover { opacity:.85; }

/* ── Autocomplete ── */
.autocomplete-wrap { position:relative; }
.autocomplete-list {
  display:none; position:absolute; top:100%; left:0; right:0; z-index:50;
  background:var(--panel); border:1px solid var(--border-md);
  border-radius:var(--radius-md); box-shadow:var(--shadow-md);
  max-height:180px; overflow-y:auto;
}
.ac-item {
  padding:9px 12px; font-size:13px; cursor:pointer; transition:background var(--t);
}
.ac-item:hover { background:var(--primary-bg); color:var(--primary-light); }

/* ── Tabela de itens ── */
.itens-tabela-wrap { overflow-x:auto; border-radius:var(--radius-md); border:1px solid var(--border); }
.itens-tabela { width:100%; border-collapse:collapse; font-size:13px; }
.itens-tabela th {
  background:var(--panel); padding:8px 12px; text-align:left;
  font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.05em; color:var(--muted); border-bottom:1px solid var(--border);
}
.itens-tabela td { padding:9px 12px; border-bottom:1px solid var(--border); color:var(--text-sub); }
.itens-tabela tr:last-child td { border-bottom:none; }
.itens-tabela tr:hover td { background:rgba(0,124,190,0.04); }
.del-item {
  background:transparent; border:none; color:var(--error);
  cursor:pointer; font-size:13px; padding:2px 6px; border-radius:4px;
  transition:background var(--t);
}
.del-item:hover { background:var(--error-bg); }
.itens-vazio {
  text-align:center; padding:20px; color:var(--muted); font-size:13px;
  display:flex; flex-direction:column; align-items:center; gap:8px;
}
.itens-vazio i { font-size:22px; opacity:.4; }

/* [ALTERAÇÃO 3] Linha de total da tabela */
.itens-total-row td {
  background:var(--primary-bg) !important;
  border-top:2px solid var(--primary-border) !important;
  border-bottom:none !important;
  padding:10px 12px;
}

/* ── Resultado ── */
.resultado-card { border-top:3px solid var(--primary); }
.material-sel-info { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
.mat-label-tag {
  font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px;
  background:var(--primary-bg); color:var(--primary-light); border:1px solid var(--primary-border);
}
.arte-tag {
  font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px;
  background:var(--error-bg); color:var(--error); border:1px solid var(--error-border);
}
.res-linhas { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
.res-linha {
  display:flex; justify-content:space-between; align-items:center;
  font-size:13px; color:var(--muted); padding:4px 0;
  border-bottom:1px solid var(--border);
}
.res-linha span:last-child { color:var(--text-sub); font-weight:500; }
.res-total {
  display:flex; justify-content:space-between; align-items:center;
  background:var(--primary-bg); border:1px solid var(--primary-border);
  border-radius:var(--radius-md); padding:12px 16px;
}
.res-total span:first-child { font-size:13px; color:var(--muted); font-weight:600; }
.res-total span:last-child  { font-size:22px; font-weight:800; color:var(--primary-light); }

/* [ALTERAÇÃO 1] Linha de arredondamento */
.arredondar-row {
  display:flex; align-items:center; justify-content:space-between;
  background:var(--panel); border:1px solid var(--border);
  border-radius:var(--radius-md); padding:8px 14px; margin-top:10px;
}
.arredondar-label {
  font-size:12px; font-weight:600; color:var(--muted);
  display:flex; align-items:center; gap:6px;
}
.arredondar-info {
  font-size:11px; color:var(--muted); margin-top:6px;
  padding:6px 10px; background:var(--panel); border-radius:var(--radius-sm);
  border:1px dashed var(--border-md); text-align:center;
}
.arredondar-info strong { color:var(--primary-light); }

/* ── Ações ── */
.acoes-grid { display:flex; flex-direction:column; gap:8px; }
.btn-acao {
  display:flex; align-items:center; justify-content:center; gap:8px;
  padding:10px 14px; border-radius:var(--radius-md);
  font-size:13px; font-weight:600; cursor:pointer;
  border:none; transition:all var(--t); width:100%;
  font-family:var(--font);
}
.btn-acao.primary { background:var(--primary);    color:#fff; }
.btn-acao.primary:hover { background:var(--primary-light); }
.btn-acao.success { background:var(--success);    color:#fff; }
.btn-acao.success:hover { opacity:.88; }
.btn-acao.info    { background:var(--info-bg);    color:var(--info); border:1px solid rgba(0,172,23,0.2); }
.btn-acao.info:hover { background:rgba(0,172,23,0.18); }
.btn-acao.warn    { background:var(--warning-bg); color:var(--warning); border:1px solid rgba(232,160,16,0.2); }
.btn-acao.warn:hover { background:rgba(232,160,16,0.2); }
.btn-acao.danger  { background:var(--error-bg);   color:var(--error);   border:1px solid var(--error-border); }
.btn-acao.danger:hover { background:rgba(171,0,0,0.18); }

/* ── Histórico ── */
.hist-lista { display:flex; flex-direction:column; gap:10px; }
.hist-card {
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-lg); padding:14px;
}
.hist-card-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
.hist-cliente { font-weight:700; font-size:14px; }
.hist-data    { font-size:12px; color:var(--muted); margin-top:2px; }
.hist-valor   { font-size:18px; font-weight:800; color:var(--primary-light); }
.hist-badge-st{ font-size:11px; font-weight:700; }
.hist-obs     { font-size:12px; color:var(--muted); margin-bottom:8px; }
.hist-acoes   { display:flex; gap:6px; }
.hist-vazio   {
  text-align:center; padding:60px 20px; color:var(--muted);
  display:flex; flex-direction:column; align-items:center; gap:12px;
}
.hist-vazio i { font-size:36px; opacity:.3; }
.hist-vazio p { font-size:14px; }

/* ── Modal converter ── */
.conv-resumo {
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-md); padding:12px; margin-bottom:16px;
}
.conv-res-linha {
  display:flex; justify-content:space-between;
  font-size:13px; padding:5px 0; border-bottom:1px solid var(--border);
  color:var(--muted);
}
.conv-res-linha:last-child { border-bottom:none; }
.conv-res-linha strong     { color:var(--text-sub); }
.conv-res-linha.total strong { font-size:16px; color:var(--primary-light); }
.modal-sep { border-top:1px solid var(--border); margin:16px 0; }
.modal-section-label {
  font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.07em; color:var(--muted); margin-bottom:10px;
}
.btn-mini-cad {
  display:inline-flex; align-items:center; gap:5px;
  background:var(--success-bg); color:var(--success); border:1px solid var(--success-border);
  border-radius:var(--radius-md); padding:7px 10px; font-size:12px; font-weight:600;
  cursor:pointer; transition:all var(--t); white-space:nowrap;
}
.btn-mini-cad:hover { opacity:.85; }
.modal label { display:block; font-size:12px; font-weight:500; color:var(--muted); margin-bottom:5px; margin-top:12px; }
.modal label:first-of-type { margin-top:0; }

/* ── Toast ── */
.orc-toast {
  position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
  background:var(--panel); border:1px solid var(--border-md);
  color:var(--text); border-radius:var(--radius-lg); padding:12px 24px;
  font-size:13px; font-weight:600; box-shadow:var(--shadow-lg);
  z-index:999; animation:slideUp .2s ease;
}
`; }