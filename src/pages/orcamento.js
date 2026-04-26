import { supabase } from "../supabase/client.js";

// ─── Medidas das folhas em cm ─────────────────────────────────────────────────
const FOLHAS = {
  A4:   { w: 21.0,  h: 29.7  },
  A3:   { w: 29.7,  h: 42.0  },
  SRA3: { w: 32.0,  h: 45.0  },
};

const STATUS = {
  rascunho:  { label: "Rascunho",  cor: "#9fb0d0", emoji: "📝" },
  enviado:   { label: "Enviado",   cor: "#74c0fc", emoji: "📤" },
  aprovado:  { label: "Aprovado",  cor: "#69db7c", emoji: "✅" },
  recusado:  { label: "Recusado",  cor: "#ff6b6b", emoji: "❌" },
};

const ORDEM_STATUS = ["rascunho","enviado","aprovado","recusado"];

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  orcamentos: [],
  produtos: [],        // com BOM carregado
  filtroStatus: "",
  aberto: null,
  itemForm: {          // estado do formulário de item
    tipo: "unidade",
    produtoId: "",
    descricao: "",
    largura: "",
    altura: "",
    folhaTipo: "A4",
    quantidade: 1,
    custoUnitario: 0,
    precoUnitario: 0,
  },
};

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function Orcamento(container) {
  container.innerHTML = `<div class="loading">Carregando orçamentos...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const [{ data: orcs }, { data: prods }, { data: bom }] = await Promise.all([
    supabase.from("orcamentos")
      .select("*, orcamento_itens(*)")
      .order("created_at", { ascending: false }),
    supabase.from("produtos").select("*"),
    supabase.from("produto_materias")
      .select("*, materias_primas(custo_unitario, unidade)"),
  ]);

  // Anexa BOM e custo total a cada produto
  state.produtos = (prods || []).map(p => {
    const itens = (bom || []).filter(b => b.produto_id === p.id);
    const custo = itens.reduce((s, b) =>
      s + (Number(b.quantidade) * Number(b.materias_primas?.custo_unitario || 0)), 0);
    return { ...p, bom: itens, custo_bom: custo };
  });

  state.orcamentos = orcs || [];
}

// ─── Helpers de cálculo ───────────────────────────────────────────────────────
function calcItensPorFolha(largCm, altCm, folhaTipo) {
  const f = FOLHAS[folhaTipo];
  if (!f || !largCm || !altCm) return 0;
  const h = Math.floor(f.w / largCm) * Math.floor(f.h / altCm);
  const v = Math.floor(f.h / largCm) * Math.floor(f.w / altCm);
  return Math.max(h, v, 1);
}

function calcPrecoUnitario(form) {
  const { tipo, largura, altura, quantidade, folhaTipo, precoUnitario } = form;
  if (tipo === "unidade") return Number(precoUnitario) || 0;
  if (tipo === "m2") {
    const m2 = (Number(largura) / 100) * (Number(altura) / 100);
    return m2 * (Number(precoUnitario) || 0); // precoUnitario = preço/m²
  }
  if (tipo === "folha") {
    const ipf = calcItensPorFolha(Number(largura), Number(altura), folhaTipo);
    if (!ipf) return 0;
    return (Number(form.precoFolha) || 0) / ipf;
  }
  return 0;
}

// ─── Render lista ─────────────────────────────────────────────────────────────
function render(container) {
  if (state.aberto) { renderDetalhe(container); return; }

  container.innerHTML = `
    <style>
      ${estilosComuns()}
      .orc-lista { display:flex; flex-direction:column; gap:8px; }
      .orc-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; cursor:pointer; }
      .orc-card:hover { border-color:rgba(106,166,255,0.3); }
      .orc-top { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
      .orc-num { font-size:12px; color:var(--muted); }
      .orc-cliente { font-weight:600; flex:1; }
      .orc-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; }
      .orc-total { font-size:20px; font-weight:700; }
      .orc-info { display:flex; gap:12px; font-size:12px; color:var(--muted); margin-top:4px; }
    </style>

    <div class="vnd-header">
      <h2>Orçamentos</h2>
      <button class="btn-primary" id="btn-novo">+ Novo Orçamento</button>
    </div>

    <div class="filtros" style="margin-bottom:12px">
      <button class="filtro-btn ${!state.filtroStatus ? "active" : ""}" data-f="">Todos</button>
      ${ORDEM_STATUS.map(s => `
        <button class="filtro-btn ${state.filtroStatus === s ? "active" : ""}" data-f="${s}">
          ${STATUS[s].emoji} ${STATUS[s].label}
        </button>`).join("")}
    </div>

    <div id="orc-body"></div>
    <div id="modal-area"></div>
  `;

  container.querySelectorAll("[data-f]").forEach(btn =>
    btn.addEventListener("click", () => { state.filtroStatus = btn.dataset.f; render(container); })
  );
  container.querySelector("#btn-novo").addEventListener("click", () => abrirModalNovo(container));

  const lista = state.filtroStatus
    ? state.orcamentos.filter(o => o.status === state.filtroStatus)
    : state.orcamentos;

  const body = container.querySelector("#orc-body");

  if (lista.length === 0) {
    body.innerHTML = `<div style="color:var(--muted);text-align:center;padding:32px">Nenhum orçamento encontrado.</div>`;
    return;
  }

  body.innerHTML = `<div class="orc-lista">
    ${lista.map(o => {
      const st = STATUS[o.status];
      const data = new Date(o.created_at).toLocaleDateString("pt-BR");
      const itens = o.orcamento_itens?.length ?? 0;
      return `
        <div class="orc-card" data-abrir="${o.id}">
          <div class="orc-top">
            <span class="orc-num">#${o.numero}</span>
            <span class="orc-cliente">${o.cliente_nome || "Cliente não informado"}</span>
            <span class="orc-badge" style="background:${st.cor}22;color:${st.cor}">${st.emoji} ${st.label}</span>
            ${o.venda_id ? `<span style="font-size:11px;color:#b197fc">💰 Venda gerada</span>` : ""}
          </div>
          <div class="orc-total">R$ ${Number(o.total||0).toFixed(2)}</div>
          <div class="orc-info">
            <span>📋 ${itens} item${itens!==1?"s":""}</span>
            <span>📅 ${data}</span>
          </div>
        </div>`;
    }).join("")}
  </div>`;

  body.querySelectorAll("[data-abrir]").forEach(card =>
    card.addEventListener("click", () => {
      state.aberto = state.orcamentos.find(o => o.id === card.dataset.abrir);
      renderDetalhe(container);
    })
  );
}

// ─── Detalhe ──────────────────────────────────────────────────────────────────
async function renderDetalhe(container) {
  const o = state.aberto;
  if (!o) { render(container); return; }

  const { data: itens } = await supabase
    .from("orcamento_itens").select("*, produtos(nome)")
    .eq("orcamento_id", o.id).order("created_at");

  const st = STATUS[o.status];
  const subtotal = (itens||[]).reduce((s,i) => s + Number(i.total||0), 0);
  const desconto = Number(o.desconto||0);
  const total    = subtotal - desconto;
  const custoTotal = (itens||[]).reduce((s,i) => s + (Number(i.custo_unitario||0) * Number(i.quantidade||0)), 0);
  const margem = total > 0 ? ((total - custoTotal) / total * 100).toFixed(1) : 0;

  const statusOptions = ORDEM_STATUS.map(s =>
    `<option value="${s}" ${o.status===s?"selected":""}>${STATUS[s].emoji} ${STATUS[s].label}</option>`
  ).join("");

  const prodOptions = state.produtos.map(p =>
    `<option value="${p.id}" data-custo="${p.custo_bom}">${p.nome}</option>`
  ).join("");

  const f = state.itemForm;

  // Preview do cálculo
  let previewHtml = "";
  if (f.tipo === "m2" && f.largura && f.altura) {
    const m2 = (Number(f.largura)/100) * (Number(f.altura)/100);
    const preco = m2 * Number(f.precoUnitario||0);
    previewHtml = `<div class="preview-calc">
      📐 ${Number(f.largura)}×${Number(f.altura)} cm = <b>${m2.toFixed(4)} m²</b>
      × R$ ${Number(f.precoUnitario||0).toFixed(2)}/m² = <b>R$ ${preco.toFixed(2)}/un</b>
    </div>`;
  } else if (f.tipo === "folha" && f.largura && f.altura) {
    const ipf = calcItensPorFolha(Number(f.largura), Number(f.altura), f.folhaTipo);
    const pf  = Number(f.precoFolha||0);
    const pu  = ipf > 0 ? pf / ipf : 0;
    const dim = FOLHAS[f.folhaTipo];
    previewHtml = `<div class="preview-calc">
      📄 Folha ${f.folhaTipo} (${dim.w}×${dim.h} cm) →
      <b>${ipf} peça${ipf!==1?"s":""} por folha</b>
      · R$ ${pf.toFixed(2)}/folha → <b>R$ ${pu.toFixed(4)}/un</b>
    </div>`;
  }

  container.innerHTML = `
    <style>
      ${estilosComuns()}
      .det-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
      @media(max-width:620px){ .det-grid2 { grid-template-columns:1fr; } }
      .det-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; }
      .det-card label { font-size:11px; color:var(--muted); display:block; margin-bottom:4px; }
      .det-card input,.det-card select,.det-card textarea {
        width:100%; background:var(--panel); border:1px solid rgba(255,255,255,0.1);
        color:var(--text); border-radius:8px; padding:8px 10px; font-size:13px; box-sizing:border-box; }
      .det-card textarea { resize:vertical; min-height:50px; }

      .itens-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; margin-bottom:12px; }
      .item-row { display:grid; grid-template-columns:1fr auto auto auto auto; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:13px; }
      .item-row:last-of-type { border-bottom:none; }
      .item-del { color:#ff6b6b; cursor:pointer; opacity:0; }
      .item-row:hover .item-del { opacity:1; }
      .tag-tipo { font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(106,166,255,0.1); color:var(--accent); }

      /* Formulário add item */
      .add-form { background:var(--panel); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:14px; margin-top:12px; }
      .add-form h5 { margin:0 0 10px; font-size:13px; color:var(--muted); }
      .tipo-tabs { display:flex; gap:6px; margin-bottom:12px; }
      .tipo-tab { padding:6px 14px; border-radius:7px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:var(--muted); cursor:pointer; font-size:12px; }
      .tipo-tab.active { border-color:var(--accent); color:var(--accent); background:rgba(106,166,255,0.1); }
      .form-row { display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; margin-bottom:8px; }
      .form-row .fg { display:flex; flex-direction:column; gap:4px; }
      .form-row label { font-size:11px; color:var(--muted); }
      .form-row input,.form-row select {
        background:var(--panel2); border:1px solid rgba(255,255,255,0.1);
        color:var(--text); border-radius:7px; padding:7px 10px; font-size:13px; }
      .fg.f-flex { flex:1; min-width:120px; }
      .fg.f-sm   { width:90px; }
      .fg.f-xs   { width:70px; }

      .preview-calc { font-size:12px; color:var(--muted); background:rgba(106,166,255,0.06); border-radius:7px; padding:8px 10px; margin-bottom:8px; }
      .preview-calc b { color:var(--accent); }

      .custo-row { display:flex; gap:10px; align-items:center; font-size:12px; margin-bottom:8px; }
      .custo-row span { color:var(--muted); }
      .custo-row b   { color:#69db7c; }

      .totais { text-align:right; padding:10px 0 4px; }
      .totais .linha { display:flex; justify-content:flex-end; gap:16px; font-size:13px; color:var(--muted); margin-bottom:4px; }
      .totais .t-final { font-size:22px; font-weight:700; }
      .margem-badge { display:inline-block; font-size:12px; padding:3px 10px; border-radius:999px; margin-left:10px; }

      .det-acoes { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .btn-aprovar { background:rgba(105,219,124,0.15); border:1px solid #69db7c55; color:#69db7c; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; font-weight:600; }
      .btn-aprovar:hover { background:rgba(105,219,124,0.25); }
      .btn-danger { background:rgba(255,107,107,0.1); border:1px solid #ff6b6b44; color:#ff6b6b; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:13px; }
    </style>

    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn-secondary" id="btn-voltar">← Voltar</button>
      <h2 style="margin:0;flex:1">#${o.numero} — ${o.cliente_nome||"Sem cliente"}</h2>
      <span style="font-size:13px;padding:4px 12px;border-radius:999px;background:${st.cor}22;color:${st.cor};font-weight:700">${st.emoji} ${st.label}</span>
    </div>

    <!-- Info -->
    <div class="det-grid2">
      <div class="det-card">
        <label>Cliente</label>
        <input id="d-cliente" value="${o.cliente_nome||""}" placeholder="Nome do cliente (opcional)" />
        <label style="margin-top:8px">Observações</label>
        <textarea id="d-obs">${o.observacoes||""}</textarea>
      </div>
      <div class="det-card">
        <label>Status</label>
        <select id="d-status">${statusOptions}</select>
        <label style="margin-top:8px">Desconto (R$)</label>
        <input id="d-desconto" type="number" min="0" step="0.01" value="${desconto}" />
        <button class="btn-primary" id="btn-salvar" style="width:100%;margin-top:10px">Salvar alterações</button>
      </div>
    </div>

    <!-- Itens -->
    <div class="itens-card">
      <h4 style="margin:0 0 10px">Itens do orçamento</h4>

      ${(itens||[]).length === 0
        ? `<div style="color:var(--muted);font-size:13px">Nenhum item ainda.</div>`
        : (itens||[]).map(i => {
            const tipoLabel = i.tipo_calculo === "m2" ? "m²" : i.tipo_calculo === "folha" ? "folha" : "un";
            const custo = Number(i.custo_unitario||0) * Number(i.quantidade||0);
            const mg    = Number(i.total||0) > 0 ? ((Number(i.total)-custo)/Number(i.total)*100).toFixed(0) : 0;
            return `
              <div class="item-row">
                <span>${i.descricao} ${i.produtos?`<span style="color:var(--muted);font-size:11px">(${i.produtos.nome})</span>`:""}</span>
                <span class="tag-tipo">${tipoLabel}</span>
                <span style="color:var(--muted);font-size:12px">${Number(i.quantidade)}×</span>
                <span style="font-weight:600">R$ ${Number(i.total||0).toFixed(2)}</span>
                <span style="font-size:11px;color:${mg>=30?"#69db7c":mg>=15?"#ffa94d":"#ff6b6b"}">${mg}%</span>
                <span class="item-del" data-del="${i.id}">✕</span>
              </div>`;
          }).join("")
      }

      <!-- Totais -->
      <div class="totais">
        <div class="linha"><span>Custo de produção</span><span style="color:#ffa94d">R$ ${custoTotal.toFixed(2)}</span></div>
        <div class="linha"><span>Subtotal</span><span>R$ ${subtotal.toFixed(2)}</span></div>
        ${desconto>0?`<div class="linha"><span>Desconto</span><span style="color:#ff6b6b">− R$ ${desconto.toFixed(2)}</span></div>`:""}
        <div class="t-final">
          R$ ${total.toFixed(2)}
          <span class="margem-badge" style="background:${margem>=30?"rgba(105,219,124,0.15)":margem>=15?"rgba(255,169,77,0.15)":"rgba(255,107,107,0.15)"};color:${margem>=30?"#69db7c":margem>=15?"#ffa94d":"#ff6b6b"}">
            ${margem}% margem
          </span>
        </div>
      </div>

      <!-- Formulário add item -->
      <div class="add-form">
        <h5>+ Adicionar item</h5>
        <div class="tipo-tabs">
          <button class="tipo-tab ${f.tipo==="unidade"?"active":""}" data-tipo="unidade">📦 Por unidade</button>
          <button class="tipo-tab ${f.tipo==="m2"?"active":""}" data-tipo="m2">📐 Por m²</button>
          <button class="tipo-tab ${f.tipo==="folha"?"active":""}" data-tipo="folha">📄 Por folha</button>
        </div>

        <!-- Produto -->
        <div class="form-row">
          <div class="fg f-flex">
            <label>Produto (opcional)</label>
            <select id="ai-produto">
              <option value="">Sem vínculo</option>
              ${prodOptions}
            </select>
          </div>
          <div class="fg f-flex">
            <label>Descrição</label>
            <input id="ai-desc" value="${f.descricao}" placeholder="Ex: Banner 1×2m full color" />
          </div>
        </div>

        <!-- Campos por tipo -->
        <div id="campos-tipo">
          ${renderCamposTipo(f)}
        </div>

        ${previewHtml}

        <!-- Custo e margem -->
        <div class="custo-row">
          <span>Custo/un:</span>
          <input id="ai-custo" type="number" min="0" step="0.0001" value="${f.custoUnitario}" style="width:100px;background:var(--panel2);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px" />
          <span style="margin-left:4px;color:#69db7c;font-size:11px">← preenchido auto pelo BOM</span>
        </div>

        <button class="btn-primary" id="btn-add-item" style="width:100%">+ Adicionar item</button>
      </div>
    </div>

    <div class="det-acoes">
      ${!o.venda_id && o.status !== "recusado" ? `
        <button class="btn-aprovar" id="btn-aprovar">✅ Aprovar e gerar venda</button>
      ` : ""}
      ${o.venda_id ? `<span style="color:#b197fc;font-size:13px">💰 Venda #gerada vinculada</span>` : ""}
      <button class="btn-danger" id="btn-deletar">🗑 Deletar</button>
    </div>
  `;

  // ── Eventos ──
  container.querySelector("#btn-voltar").addEventListener("click", () => {
    state.aberto = null; state.itemForm = resetForm();
    recarregar(container);
  });

  // Tabs de tipo
  container.querySelectorAll("[data-tipo]").forEach(btn =>
    btn.addEventListener("click", () => {
      state.itemForm.tipo = btn.dataset.tipo;
      renderDetalhe(container);
    })
  );

  // Produto selecionado → preenche custo do BOM
  container.querySelector("#ai-produto")?.addEventListener("change", (e) => {
    const prod = state.produtos.find(p => p.id === e.target.value);
    if (prod) {
      state.itemForm.custoUnitario = prod.custo_bom.toFixed(4);
      container.querySelector("#ai-custo").value = state.itemForm.custoUnitario;
    }
  });

  // Salvar info
  container.querySelector("#btn-salvar").addEventListener("click", async () => {
    const cliente = container.querySelector("#d-cliente").value.trim();
    const obs     = container.querySelector("#d-obs").value.trim();
    const status  = container.querySelector("#d-status").value;
    const desc    = parseFloat(container.querySelector("#d-desconto").value)||0;
    await supabase.from("orcamentos").update({
      cliente_nome: cliente||null, observacoes: obs||null,
      status, desconto: desc, total: subtotal-desc, updated_at: new Date(),
    }).eq("id", o.id);
    state.aberto = { ...state.aberto, cliente_nome: cliente, status, desconto: desc };
    await recarregar(container);
  });

  // Deletar item
  container.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm("Remover item?")) return;
      await supabase.from("orcamento_itens").delete().eq("id", btn.dataset.del);
      await atualizarTotal(o.id);
      await recarregar(container);
    })
  );

  // Deletar orçamento
  container.querySelector("#btn-deletar")?.addEventListener("click", async () => {
    if (!confirm("Deletar este orçamento?")) return;
    await supabase.from("orcamentos").delete().eq("id", o.id);
    state.aberto = null;
    await recarregar(container);
  });

  // Aprovar e gerar venda
  container.querySelector("#btn-aprovar")?.addEventListener("click", async () => {
    if (!confirm("Aprovar orçamento e gerar venda?")) return;
    // Cria venda
    const { data: venda } = await supabase.from("vendas").insert({
      cliente_nome: o.cliente_nome||null,
      observacoes: `Gerado do orçamento #${o.numero}`,
      status: "pendente",
      desconto: o.desconto||0,
      total: total,
    }).select().single();

    // Copia itens para venda
    if (itens?.length) {
      await supabase.from("venda_itens").insert(
        itens.map(i => ({
          venda_id: venda.id,
          produto_id: i.produto_id||null,
          descricao: i.descricao,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
        }))
      );
    }

    // Atualiza orçamento
    await supabase.from("orcamentos").update({
      status: "aprovado", venda_id: venda.id,
    }).eq("id", o.id);

    alert(`✅ Venda criada com sucesso!`);
    state.aberto = null;
    await recarregar(container);
  });

  // Add item
  container.querySelector("#btn-add-item").addEventListener("click", async () => {
    const desc  = container.querySelector("#ai-desc")?.value.trim();
    const prodId = container.querySelector("#ai-produto")?.value||null;
    const qtd   = parseFloat(container.querySelector("#ai-qtd")?.value)||1;
    const custo = parseFloat(container.querySelector("#ai-custo")?.value)||0;
    const tipo  = state.itemForm.tipo;

    if (!desc) { alert("Informe a descrição."); return; }

    let precoUn = 0;
    let largura = null, altura = null, folhaTipo = null, ipf = null, precoFolha = null;

    if (tipo === "unidade") {
      precoUn = parseFloat(container.querySelector("#ai-preco-un")?.value)||0;
    } else if (tipo === "m2") {
      largura = parseFloat(container.querySelector("#ai-larg")?.value)||0;
      altura  = parseFloat(container.querySelector("#ai-alt")?.value)||0;
      const pm2 = parseFloat(container.querySelector("#ai-pm2")?.value)||0;
      const m2  = (largura/100)*(altura/100);
      precoUn = m2 * pm2;
      state.itemForm.largura = largura; state.itemForm.altura = altura;
      state.itemForm.precoUnitario = pm2;
    } else if (tipo === "folha") {
      largura  = parseFloat(container.querySelector("#ai-larg")?.value)||0;
      altura   = parseFloat(container.querySelector("#ai-alt")?.value)||0;
      folhaTipo = container.querySelector("#ai-folha")?.value||"A4";
      precoFolha = parseFloat(container.querySelector("#ai-pfolha")?.value)||0;
      ipf      = calcItensPorFolha(largura, altura, folhaTipo);
      precoUn  = ipf > 0 ? precoFolha / ipf : 0;
      state.itemForm.largura = largura; state.itemForm.altura = altura;
      state.itemForm.folhaTipo = folhaTipo; state.itemForm.precoFolha = precoFolha;
    }

    if (precoUn <= 0) { alert("Preço não calculado. Verifique os campos."); return; }

    await supabase.from("orcamento_itens").insert({
      orcamento_id: o.id,
      produto_id: prodId||null,
      descricao: desc,
      tipo_calculo: tipo,
      largura_cm: largura, altura_cm: altura,
      folha_tipo: folhaTipo, itens_por_folha: ipf, preco_por_folha: precoFolha,
      quantidade: qtd,
      custo_unitario: custo,
      preco_unitario: precoUn,
      total: precoUn * qtd,
    });

    await atualizarTotal(o.id);
    state.itemForm.descricao = "";
    await recarregar(container);
  });
}

// ─── Campos dinâmicos por tipo ────────────────────────────────────────────────
function renderCamposTipo(f) {
  if (f.tipo === "unidade") return `
    <div class="form-row">
      <div class="fg f-sm"><label>Quantidade</label><input id="ai-qtd" type="number" min="0.001" step="0.001" value="1" /></div>
      <div class="fg f-sm"><label>Preço unit. (R$)</label><input id="ai-preco-un" type="number" min="0" step="0.01" value="0" /></div>
    </div>`;

  if (f.tipo === "m2") return `
    <div class="form-row">
      <div class="fg f-sm"><label>Largura (cm)</label><input id="ai-larg" type="number" min="0" step="0.1" value="${f.largura||""}" /></div>
      <div class="fg f-sm"><label>Altura (cm)</label><input id="ai-alt" type="number" min="0" step="0.1" value="${f.altura||""}" /></div>
      <div class="fg f-sm"><label>Qtd</label><input id="ai-qtd" type="number" min="1" step="1" value="1" /></div>
      <div class="fg f-sm"><label>Preço/m² (R$)</label><input id="ai-pm2" type="number" min="0" step="0.01" value="0" /></div>
    </div>`;

  if (f.tipo === "folha") return `
    <div class="form-row">
      <div class="fg f-sm"><label>Larg. peça (cm)</label><input id="ai-larg" type="number" min="0" step="0.1" value="${f.largura||""}" /></div>
      <div class="fg f-sm"><label>Alt. peça (cm)</label><input id="ai-alt" type="number" min="0" step="0.1" value="${f.altura||""}" /></div>
      <div class="fg f-sm">
        <label>Folha</label>
        <select id="ai-folha">
          ${Object.keys(FOLHAS).map(k=>`<option value="${k}" ${f.folhaTipo===k?"selected":""}>${k} (${FOLHAS[k].w}×${FOLHAS[k].h}cm)</option>`).join("")}
        </select>
      </div>
      <div class="fg f-sm"><label>Qtd</label><input id="ai-qtd" type="number" min="1" step="1" value="1" /></div>
      <div class="fg f-sm"><label>Preço/folha (R$)</label><input id="ai-pfolha" type="number" min="0" step="0.01" value="0" /></div>
    </div>`;

  return "";
}

function resetForm() {
  return { tipo:"unidade", produtoId:"", descricao:"", largura:"", altura:"", folhaTipo:"A4", quantidade:1, custoUnitario:0, precoUnitario:0 };
}

// ─── Modal novo orçamento ─────────────────────────────────────────────────────
function abrirModalNovo(container) {
  const area = container.querySelector("#modal-area");
  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>Novo Orçamento</h3>
        <label>Cliente (opcional)</label>
        <input id="m-cliente" placeholder="Nome do cliente..." autofocus />
        <label>Observações</label>
        <textarea id="m-obs" placeholder="Ex: prazo de entrega, acabamento..."></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button class="btn-secondary" id="m-cancel">Cancelar</button>
          <button class="btn-primary" id="m-ok">Criar</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#m-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id==="modal-bg") area.innerHTML=""; });
  area.querySelector("#m-ok").addEventListener("click", async () => {
    const cliente = area.querySelector("#m-cliente").value.trim();
    const obs     = area.querySelector("#m-obs").value.trim();
    const { data } = await supabase.from("orcamentos").insert({
      cliente_nome: cliente||null, observacoes: obs||null, status:"rascunho", total:0,
    }).select().single();
    area.innerHTML = "";
    await carregar();
    state.aberto = data;
    state.itemForm = resetForm();
    renderDetalhe(container);
  });
}

// ─── Atualiza total do orçamento ──────────────────────────────────────────────
async function atualizarTotal(orcId) {
  const { data: itens } = await supabase.from("orcamento_itens").select("total").eq("orcamento_id", orcId);
  const { data: orc }   = await supabase.from("orcamentos").select("desconto").eq("id", orcId).single();
  const sub   = (itens||[]).reduce((s,i) => s + Number(i.total||0), 0);
  const total = sub - Number(orc?.desconto||0);
  await supabase.from("orcamentos").update({ total }).eq("id", orcId);
}

// ─── Estilos comuns ───────────────────────────────────────────────────────────
function estilosComuns() {
  return `
    .vnd-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:8px; }
    .vnd-header h2 { margin:0; }
    .filtros { display:flex; gap:6px; flex-wrap:wrap; }
    .filtro-btn { padding:5px 12px; border-radius:999px; border:1px solid rgba(255,255,255,0.1); background:var(--panel2); color:var(--muted); cursor:pointer; font-size:12px; }
    .filtro-btn.active { border-color:var(--accent); color:var(--accent); background:rgba(106,166,255,0.1); }
    .btn-primary { background:var(--accent); color:#000; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; font-weight:600; }
    .btn-secondary { background:transparent; border:1px solid rgba(255,255,255,0.15); color:var(--text); border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; }
    .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:var(--panel); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:24px; min-width:320px; max-width:460px; width:92%; }
    .modal h3 { margin:0 0 16px; }
    .modal label { font-size:12px; color:var(--muted); display:block; margin-bottom:4px; }
    .modal input,.modal select,.modal textarea { width:100%; background:var(--panel2); border:1px solid rgba(255,255,255,0.1); color:var(--text); border-radius:8px; padding:10px 12px; font-size:14px; box-sizing:border-box; margin-bottom:12px; }
    .modal textarea { resize:vertical; min-height:60px; }
  `;
}

async function recarregar(container) {
  await carregar();
  if (state.aberto) {
    state.aberto = state.orcamentos.find(o => o.id === state.aberto?.id)||null;
  }
  render(container);
}