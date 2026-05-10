import { supabase } from "../supabase/client.js";
import { fmtBRL, fmtBRL4, fmtBRLK, fmtQtd } from "../utils/fmt.js";

// ─── Constantes ───────────────────────────────────────────────────────────────
const SITUACOES = [
  { id: "pendente",    label: "Pendente",    cor: "#F79009" },
  { id: "em_execucao", label: "Em execução", cor: "#007CBE" },
  { id: "pronto",      label: "Pronto",      cor: "#0008FF" },
  { id: "entregue",    label: "Entregue",    cor: "#00AC17" },
  { id: "cancelado",   label: "Cancelado",   cor: "#AB0000" },
];

const TIPOS_VENDA = ["Venda/O.S.", "Orçamento", "Consignação", "Troca"];

const FORMAS_PAG_DEFAULT = [
  "Dinheiro","PIX","Cartão Crédito","Cartão Débito","Transferência","Boleto","Cheque","Fiado",
];

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  aba: "lista",
  vendas: [], clientes: [], produtos: [], formasPag: [],
  vendaAberta: null,
  form: novoForm(),
};

function novoForm() {
  return {
    clienteNome:"", clienteId:null, vendedor:"",
    tipo:"Venda/O.S.", data:hoje(),
    consumidorFinal:true, situacao:"pendente",
    entrega:"", palavraChave:"",
    itens:[novoItem()],
    observacoes:"", parcelas:[], gastos:[],
  };
}
function novoItem() { return { descricao:"", produtoId:null, preco:0, qtd:1.000, desconto:0, obs:"" }; }
function hoje() { return new Date().toISOString().split("T")[0]; }

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function Vendas(container) {
  container.innerHTML = `<div class="loading">Carregando vendas...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const [{ data: vendas }, { data: clientes }, { data: produtos }, { data: cfg }] = await Promise.all([
    supabase.from("vendas").select("*, venda_itens(*)").order("created_at", { ascending: false }),
    supabase.from("clientes").select("id, nome, telefone").order("nome"),
    supabase.from("produtos").select("id, nome").order("nome"),
    supabase.from("configuracoes").select("formas_pagamento").eq("id","global").single(),
  ]);
  state.vendas   = vendas   || [];
  state.clientes = clientes || [];
  state.produtos = produtos || [];
  try {
    state.formasPag = JSON.parse(cfg?.formas_pagamento||"[]").filter(f=>f.ativa!==false).map(f=>f.nome);
  } catch { state.formasPag = []; }
  if (!state.formasPag.length) state.formasPag = FORMAS_PAG_DEFAULT;
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════════════════
function render(container) {
  container.innerHTML = `<style>${css()}</style>
    <div id="vnd-root">${state.aba==="form" ? renderForm() : renderLista()}</div>
    `;
  bindEvents(container);
}

// ── Lista ─────────────────────────────────────────────────────────────────────
function renderLista() {
  const total = state.vendas.reduce((s,v)=>s+Number(v.total||0),0);
  return `
  <div class="vnd-topbar">
    <div>
      <h2 style="margin:0;font-size:18px;font-weight:700">Vendas</h2>
      <span style="font-size:12px;color:var(--muted)">${state.vendas.length} venda${state.vendas.length!==1?"s":""} · ${fmtBRL(total)}</span>
    </div>
    <button class="btn-nova-venda" id="btn-nova"><i class="fi fi-rr-add"></i> Nova Venda</button>
  </div>

  <div class="sit-filtros">
    <button class="sit-filtro active" data-sit="">Todas</button>
    ${SITUACOES.map(s=>`
      <button class="sit-filtro" data-sit="${s.id}">
        <span class="sit-dot" style="background:${s.cor}"></span>${s.label}
      </button>`).join("")}
  </div>

  <div class="lista-wrap">
    <table class="vnd-table">
      <thead><tr>
        <th>#</th><th>Cliente</th><th>Tipo</th><th>Data</th>
        <th>Entrega</th><th>Situação</th><th style="text-align:right">Total</th><th></th>
      </tr></thead>
      <tbody id="tbody-vendas">
        ${state.vendas.length===0
          ? `<tr><td colspan="8" class="td-vazio">Nenhuma venda. Clique em "Nova Venda" para começar.</td></tr>`
          : state.vendas.map((v,i)=>{
              const sit = SITUACOES.find(s=>s.id===v.status)||SITUACOES[0];
              const data = v.created_at ? new Date(v.created_at).toLocaleDateString("pt-BR") : "—";
              return `
              <tr class="vnd-row" data-abrir="${v.id}">
                <td class="td-num">${String(state.vendas.length-i).padStart(3,"0")}</td>
                <td><strong>${esc(v.cliente_nome)||"Sem cliente"}</strong></td>
                <td style="font-size:12px;color:var(--muted)">${esc(v.tipo||"Venda/O.S.")}</td>
                <td style="font-size:12px">${data}</td>
                <td style="font-size:12px;color:var(--muted)">${v.data_entrega?fmtData(v.data_entrega):"—"}</td>
                <td><span class="sit-badge" style="background:${sit.cor}22;color:${sit.cor}">${sit.label}</span></td>
                <td style="text-align:right;font-weight:700;color:var(--primary-light)">${fmtBRL(v.total||0)}</td>
                <td><div style="display:flex;gap:4px">
                  <button class="btn-icon" data-editar="${v.id}"><i class="fi fi-rr-pencil"></i></button>
                  <button class="btn-icon danger" data-del="${v.id}" data-del-nome="${esc(v.cliente_nome||"esta venda")}"><i class="fi fi-rr-trash"></i></button>
                </div></td>
              </tr>`;
            }).join("")}
      </tbody>
    </table>
  </div>`;
}

// ── Formulário ────────────────────────────────────────────────────────────────
function renderForm() {
  const f = state.form;
  const t = calcularTotais();
  return `
  <div class="vnd-topbar">
    <h2 style="margin:0;font-size:18px;font-weight:700">
      ${state.vendaAberta ? `Editar Venda #${state.vendaAberta.numero||""}` : "Nova Venda"}
    </h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-hist-vnd" id="btn-historico"><i class="fi fi-rr-clock"></i> Histórico</button>
      <button class="btn-imprimir-vnd" id="btn-imprimir"><i class="fi fi-rr-print"></i> Imprimir</button>
      <button class="btn-salvar-vnd" id="btn-salvar"><i class="fi fi-rr-disk"></i> Salvar</button>
      <button class="btn-secondary" id="btn-voltar">Voltar</button>
    </div>
  </div>

  <!-- DADOS -->
  <div class="vnd-card">
    <div class="vnd-card-title"><i class="fi fi-rr-file-invoice"></i> Dados da Venda</div>
    <div class="dados-grid">

      <div class="field-group span2">
        <label>Nome do cliente</label>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="autocomplete-wrap" style="flex:1">
            <div class="input-icon-wrap">
              <i class="fi fi-rr-user input-icon"></i>
              <input id="f-cliente" value="${esc(f.clienteNome)}" placeholder="Buscar cliente..." autocomplete="off" style="border:none;background:transparent" />
            </div>
            <div class="autocomplete-list" id="ac-cli"></div>
          </div>
          <button class="btn-mini-green" id="btn-cad-cli"><i class="fi fi-rr-user-add"></i> Novo</button>
        </div>
      </div>

      <div class="field-group">
        <label>Tipo</label>
        <div class="input-icon-wrap">
          <i class="fi fi-rr-shopping-cart input-icon"></i>
          <select id="f-tipo">${TIPOS_VENDA.map(t=>`<option ${f.tipo===t?"selected":""}>${t}</option>`).join("")}</select>
        </div>
      </div>

      <div class="field-group">
        <label>Data</label>
        <div class="input-icon-wrap">
          <i class="fi fi-rr-calendar input-icon"></i>
          <input id="f-data" type="date" value="${f.data}" style="border:none;background:transparent" />
        </div>
      </div>

      <div class="field-group span2">
        <label>Vendedor</label>
        <div class="input-icon-wrap">
          <i class="fi fi-rr-id-badge input-icon"></i>
          <input id="f-vendedor" value="${esc(f.vendedor)}" placeholder="Nome do vendedor" style="border:none;background:transparent" />
        </div>
      </div>

      <div class="field-group">
        <label>Consumidor final?</label>
        <button class="consumidor-btn ${f.consumidorFinal?"ativo":""}" id="btn-consumidor">
          ${f.consumidorFinal?"✔ Sim":"✖ Não"}
        </button>
      </div>

      <div class="field-group">
        <label>Situação</label>
        <div class="input-icon-wrap">
          <i class="fi fi-rr-flag input-icon"></i>
          <select id="f-situacao">${SITUACOES.map(s=>`<option value="${s.id}" ${f.situacao===s.id?"selected":""}>${s.label}</option>`).join("")}</select>
        </div>
      </div>

      <div class="field-group">
        <label>Entrega</label>
        <div class="input-icon-wrap">
          <i class="fi fi-rr-truck-side input-icon"></i>
          <input id="f-entrega" type="date" value="${f.entrega}" style="border:none;background:transparent" />
        </div>
      </div>

      <div class="field-group">
        <label>Palavra-chave / Tag</label>
        <div class="input-icon-wrap">
          <i class="fi fi-rr-tag input-icon"></i>
          <input id="f-tag" value="${esc(f.palavraChave)}" placeholder="Ex: urgente, arte..." style="border:none;background:transparent" />
        </div>
      </div>

    </div>
  </div>

  <!-- CARRINHO -->
  <div class="vnd-card">
    <div class="vnd-card-title"><i class="fi fi-rr-shopping-cart"></i> Carrinho</div>
    <div class="carrinho-wrap">
      <table class="carrinho-table">
        <thead><tr>
          <th style="min-width:260px">Produto ou serviço</th>
          <th style="width:130px;text-align:right">Preço R$</th>
          <th style="width:100px;text-align:center">Quantidade</th>
          <th style="width:110px;text-align:right">Desconto R$</th>
          <th style="width:110px;text-align:right">Total</th>
          <th style="width:32px"></th>
        </tr></thead>
        <tbody id="tbody-itens">
          ${f.itens.map((it,i)=>renderItemRow(it,i)).join("")}
        </tbody>
        <tfoot>
          <tr class="carrinho-total-row">
            <td colspan="2" style="text-align:right;color:var(--muted);font-size:12px;font-weight:600">TOTAL</td>
            <td style="text-align:center;font-weight:700" id="r-qtd">${t.qtdTotal.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})}</td>
            <td style="text-align:right;font-weight:700;color:var(--error)" id="r-desc">${fmtBRL(t.descontoTotal)}</td>
            <td style="text-align:right;font-weight:800;font-size:15px;color:var(--primary-light)" id="r-total">${fmtBRL(t.totalGeral)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <button class="btn-add-linha" id="btn-add-item"><i class="fi fi-rr-add"></i> Adicionar item</button>
  </div>

  <!-- OBSERVAÇÕES -->
  <div class="vnd-card">
    <div class="vnd-card-title"><i class="fi fi-rr-comment"></i> Observações gerais</div>
    <textarea id="f-obs" rows="3" placeholder="Descrição:&#10;Tamanho:&#10;Arte:&#10;Quantidade:">${esc(f.observacoes)}</textarea>
  </div>

  <!-- FINANCEIRO -->
  <div class="vnd-card">
    <div class="vnd-card-title"><i class="fi fi-rr-coins"></i> Financeiro — Parcelas</div>
    <div class="financeiro-wrap">
      <table class="financeiro-table">
        <thead><tr>
          <th style="width:70px">Parcela</th>
          <th style="width:130px">Valor R$</th>
          <th style="width:150px">Vencimento</th>
          <th>Forma de pagamento</th>
          <th style="width:130px">Status</th>
          <th style="width:32px"></th>
        </tr></thead>
        <tbody id="tbody-parcelas">
          ${f.parcelas.length===0
            ? `<tr><td colspan="6" class="td-vazio" style="padding:16px">Nenhuma parcela. Use os botões abaixo.</td></tr>`
            : f.parcelas.map((p,i)=>renderParcelaRow(p,i)).join("")}
        </tbody>
        <tfoot><tr class="financeiro-total-row">
          <td style="font-weight:600;color:var(--muted)">TOTAL</td>
          <td><strong id="r-parc-total">${fmtBRL(f.parcelas.reduce((s,p)=>s+Number(p.valor||0),0))}</strong></td>
          <td colspan="4"></td>
        </tr></tfoot>
      </table>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn-add-parcela" id="btn-add-parcela"><i class="fi fi-rr-add"></i> Adicionar parcela</button>
      <button class="btn-add-parcela secondary" id="btn-parcela-auto"><i class="fi fi-rr-magic-wand"></i> Gerar do total</button>
    </div>
  </div>

  <!-- GASTOS -->
  <div class="vnd-card">
    <div class="vnd-card-title"><i class="fi fi-rr-receipt"></i> Gastos na venda</div>
    <div id="gastos-lista">
      ${f.gastos.length===0
        ? `<div style="color:var(--muted);font-size:13px;padding:4px 0">Nenhum gasto adicionado.</div>`
        : f.gastos.map((g,i)=>`
          <div class="gasto-row">
            <input class="gasto-desc" data-gasto-desc="${i}" value="${esc(g.descricao)}" placeholder="Descrição do gasto" />
            <div class="input-icon-wrap" style="width:150px">
              <span class="input-icon" style="font-size:11px">R$</span>
              <input type="number" class="gasto-val" data-gasto-val="${i}" value="${g.valor}" min="0" step="0.01" style="border:none;background:transparent" />
            </div>
            <button class="del-row" data-del-gasto="${i}">✕</button>
          </div>`).join("")}
    </div>
    <button class="btn-add-linha" id="btn-add-gasto" style="margin-top:8px"><i class="fi fi-rr-add"></i> Adicionar gasto</button>
  </div>

  <!-- BARRA INFERIOR -->
  <div class="bottom-bar">
    <div style="display:flex;gap:8px">
      <button class="btn-hist-vnd" id="btn-historico2"><i class="fi fi-rr-clock"></i> Histórico</button>
      <button class="btn-imprimir-vnd" id="btn-imprimir2"><i class="fi fi-rr-print"></i> Imprimir</button>
      <button class="btn-troco" id="btn-troco"><i class="fi fi-rr-money-bill-wave"></i> Troco</button>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <div class="total-bottom">Total: <strong>${fmtBRL(t.totalGeral)}</strong></div>
      <button class="btn-salvar-vnd" id="btn-salvar2"><i class="fi fi-rr-disk"></i> Salvar</button>
      <button class="btn-secondary" id="btn-voltar2">Voltar</button>
    </div>
  </div>`;
}

function renderItemRow(it, i) {
  const total = (Number(it.preco)||0)*(Number(it.qtd)||0)-(Number(it.desconto)||0);
  return `
  <tr class="item-row" data-row="${i}">
    <td>
      <div class="autocomplete-wrap">
        <input class="item-input item-desc" data-item-desc="${i}" value="${esc(it.descricao)}" placeholder="Produto ou serviço..." autocomplete="off" />
        <div class="autocomplete-list" id="ac-item-${i}"></div>
      </div>
      <input class="item-obs" data-item-obs="${i}" value="${esc(it.obs)}" placeholder="Obs. adicionais..." />
    </td>
    <td><div class="input-icon-wrap td-inpwrap">
      <span class="input-icon" style="font-size:11px">R$</span>
      <input type="number" class="td-inp right" data-item-preco="${i}" value="${it.preco}" min="0" step="0.01" />
    </div></td>
    <td><input type="number" class="td-inp center" data-item-qtd="${i}" value="${Number(it.qtd).toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})}" min="0.001" step="0.001" /></td>
    <td><input type="number" class="td-inp right" data-item-desc-val="${i}" value="${it.desconto}" min="0" step="0.01" /></td>
    <td class="td-total" style="text-align:right;font-weight:700;color:${total>0?"var(--primary-light)":"var(--muted)"}">${fmtBRL(total)}</td>
    <td><button class="del-row" data-del-item="${i}">✕</button></td>
  </tr>`;
}

function renderParcelaRow(p, i) {
  const n = state.form.parcelas.length;
  return `
  <tr class="parcela-row">
    <td style="text-align:center;font-weight:600;color:var(--muted)">${i+1}/${n}</td>
    <td><div class="input-icon-wrap td-inpwrap">
      <span class="input-icon" style="font-size:11px">R$</span>
      <input type="number" class="td-inp right" data-parc-val="${i}" value="${p.valor}" min="0" step="0.01" />
    </div></td>
    <td><div class="input-icon-wrap td-inpwrap">
      <i class="fi fi-rr-calendar input-icon" style="font-size:11px"></i>
      <input type="date" class="td-inp" data-parc-data="${i}" value="${p.data||hoje()}" />
    </div></td>
    <td><select class="td-inp" data-parc-forma="${i}">
      ${state.formasPag.map(f=>`<option ${p.forma===f?"selected":""}>${f}</option>`).join("")}
    </select></td>
    <td><span class="parc-status ${p.recebido?"recebido":"pendente"}" data-parc-status="${i}" style="cursor:pointer">
      ${p.recebido?"✔ Recebido":"⏳ Pendente"}
    </span></td>
    <td><button class="del-row" data-del-parc="${i}">✕</button></td>
  </tr>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// CÁLCULOS
// ══════════════════════════════════════════════════════════════════════════════
function calcularTotais() {
  let qtdTotal=0, descontoTotal=0, totalGeral=0;
  state.form.itens.forEach(it=>{
    const p=Number(it.preco)||0, q=Number(it.qtd)||0, d=Number(it.desconto)||0;
    qtdTotal+=q; descontoTotal+=d; totalGeral+=p*q-d;
  });
  totalGeral += state.form.gastos.reduce((s,g)=>s+Number(g.valor||0),0);
  return { qtdTotal, descontoTotal, totalGeral };
}

function atualizarTotaisDOM(container) {
  const t = calcularTotais();
  const s = (id,v) => { const el=container.querySelector(id); if(el) el.textContent=v; };
  s("#r-qtd",   t.qtdTotal.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3}));
  s("#r-desc",  fmtBRL(t.descontoTotal));
  s("#r-total", fmtBRL(t.totalGeral));
  const tb = container.querySelector(".total-bottom strong");
  if (tb) tb.textContent = fmtBRL(t.totalGeral);
  state.form.itens.forEach((it,i)=>{
    const tot=(Number(it.preco)||0)*(Number(it.qtd)||0)-(Number(it.desconto)||0);
    const el=container.querySelector(`.item-row[data-row="${i}"] .td-total`);
    if(el){ el.textContent=fmtBRL(tot); el.style.color=tot>0?"var(--primary-light)":"var(--muted)"; }
  });
}

function atualizarParcelasDOM(container) {
  const total = state.form.parcelas.reduce((s,p)=>s+Number(p.valor||0),0);
  const el = container.querySelector("#r-parc-total");
  if (el) el.textContent = fmtBRL(total);
}

// ══════════════════════════════════════════════════════════════════════════════
// EVENTOS
// ══════════════════════════════════════════════════════════════════════════════
function bindEvents(container) {
  state.aba === "form" ? bindFormEvents(container) : bindListaEvents(container);
}

function bindListaEvents(container) {
  container.querySelector("#btn-nova")?.addEventListener("click", ()=>{ state.form=novoForm(); state.vendaAberta=null; state.aba="form"; render(container); });

  container.querySelectorAll(".sit-filtro").forEach(btn=>btn.addEventListener("click",()=>{
    container.querySelectorAll(".sit-filtro").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const sit=btn.dataset.sit;
    container.querySelectorAll(".vnd-row").forEach(row=>{
      const v=state.vendas.find(v=>v.id===row.dataset.abrir);
      row.style.display=(!sit||v?.status===sit)?"":"none";
    });
  }));

  container.querySelectorAll(".vnd-row").forEach(row=>row.addEventListener("click",()=>abrirVenda(container,row.dataset.abrir)));
  container.querySelectorAll("[data-editar]").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();abrirVenda(container,btn.dataset.editar);}));
  container.querySelectorAll("[data-del]").forEach(btn=>btn.addEventListener("click",async e=>{
    e.stopPropagation();
    if(!confirm(`Excluir venda de "${btn.dataset.delNome}"?`)) return;
    await supabase.from("vendas").delete().eq("id",btn.dataset.del);
    await carregar(); render(container);
  }));
}

async function abrirVenda(container, id) {
  const v = state.vendas.find(v=>v.id===id); if(!v) return;
  const { data: itens } = await supabase.from("venda_itens").select("*").eq("venda_id",id);
  state.form = {
    ...novoForm(),
    clienteNome:    v.cliente_nome||"",
    tipo:           v.tipo||"Venda/O.S.",
    data:           v.data_venda||hoje(),
    situacao:       v.status||"pendente",
    entrega:        v.data_entrega||"",
    palavraChave:   v.palavra_chave||"",
    vendedor:       v.vendedor||"",
    consumidorFinal:v.consumidor_final!==false,
    observacoes:    v.observacoes||"",
    itens:(itens||[]).map(i=>({ descricao:i.descricao, produtoId:i.produto_id, preco:Number(i.preco_unitario), qtd:Number(i.quantidade), desconto:Number(i.desconto||0), obs:i.obs||"" }))||[novoItem()],
    parcelas:[], gastos:[],
  };
  if(!state.form.itens.length) state.form.itens=[novoItem()];
  state.vendaAberta=v; state.aba="form"; render(container);
}

function bindFormEvents(container) {
  ["#btn-voltar","#btn-voltar2"].forEach(s=>container.querySelector(s)?.addEventListener("click",()=>{ state.aba="lista"; state.vendaAberta=null; render(container); }));
  ["#btn-historico","#btn-historico2"].forEach(s=>container.querySelector(s)?.addEventListener("click",()=>{ state.aba="lista"; render(container); }));
  ["#btn-salvar","#btn-salvar2"].forEach(s=>container.querySelector(s)?.addEventListener("click",()=>salvar(container)));
  ["#btn-imprimir","#btn-imprimir2"].forEach(s=>container.querySelector(s)?.addEventListener("click",()=>imprimir()));
  container.querySelector("#btn-troco")?.addEventListener("click",()=>abrirModalTroco(container));
  container.querySelector("#btn-consumidor")?.addEventListener("click",()=>{
    state.form.consumidorFinal=!state.form.consumidorFinal;
    const btn=container.querySelector("#btn-consumidor");
    btn.textContent=state.form.consumidorFinal?"✔ Sim":"✖ Não";
    btn.classList.toggle("ativo",state.form.consumidorFinal);
  });
  const si=(sel,fn)=>container.querySelector(sel)?.addEventListener("input",e=>fn(e.target.value));
  si("#f-cliente", v=>{ state.form.clienteNome=v; });
  si("#f-vendedor",v=>{ state.form.vendedor=v; });
  si("#f-obs",     v=>{ state.form.observacoes=v; });
  si("#f-tag",     v=>{ state.form.palavraChave=v; });
  container.querySelector("#f-data")?.addEventListener("change",e=>{ state.form.data=e.target.value; });
  container.querySelector("#f-entrega")?.addEventListener("change",e=>{ state.form.entrega=e.target.value; });
  container.querySelector("#f-tipo")?.addEventListener("change",e=>{ state.form.tipo=e.target.value; });
  container.querySelector("#f-situacao")?.addEventListener("change",e=>{ state.form.situacao=e.target.value; });

  bindAutocompleteCli(container);

  const tbodyItens = container.querySelector("#tbody-itens");
  tbodyItens?.addEventListener("input", e=>{
    const t=e.target;
    const i=parseInt(t.dataset.itemDesc??t.dataset.itemPreco??t.dataset.itemQtd??t.dataset.itemDescVal??t.dataset.itemObs);
    if(isNaN(i)) return;
    if(t.dataset.itemDesc    !==undefined){ state.form.itens[i].descricao=t.value; bindItemAC(container,i); }
    if(t.dataset.itemPreco   !==undefined){ state.form.itens[i].preco=t.value; atualizarTotaisDOM(container); }
    if(t.dataset.itemQtd     !==undefined){ state.form.itens[i].qtd=t.value;   atualizarTotaisDOM(container); }
    if(t.dataset.itemDescVal !==undefined){ state.form.itens[i].desconto=t.value; atualizarTotaisDOM(container); }
    if(t.dataset.itemObs     !==undefined){ state.form.itens[i].obs=t.value; }
  });
  tbodyItens?.addEventListener("click", e=>{
    const del=e.target.closest("[data-del-item]");
    if(del){ state.form.itens.splice(+del.dataset.delItem,1); if(!state.form.itens.length) state.form.itens.push(novoItem()); render(container); }
  });
  container.querySelector("#btn-add-item")?.addEventListener("click",()=>{ state.form.itens.push(novoItem()); render(container); setTimeout(()=>{ const ins=container.querySelectorAll(".item-desc"); ins[ins.length-1]?.focus(); },50); });

  state.form.itens.forEach((_,i)=>bindItemAC(container,i));

  const tbodyParc = container.querySelector("#tbody-parcelas");
  tbodyParc?.addEventListener("input",e=>{
    const t=e.target;
    if(t.dataset.parcVal  !==undefined){ state.form.parcelas[+t.dataset.parcVal].valor=t.value; atualizarParcelasDOM(container); }
    if(t.dataset.parcData !==undefined){ state.form.parcelas[+t.dataset.parcData].data=t.value; }
  });
  tbodyParc?.addEventListener("change",e=>{
    const t=e.target;
    if(t.dataset.parcForma!==undefined) state.form.parcelas[+t.dataset.parcForma].forma=t.value;
  });
  tbodyParc?.addEventListener("click",e=>{
    const st=e.target.closest("[data-parc-status]");
    if(st){ const i=+st.dataset.parcStatus; state.form.parcelas[i].recebido=!state.form.parcelas[i].recebido; st.className=`parc-status ${state.form.parcelas[i].recebido?"recebido":"pendente"}`; st.textContent=state.form.parcelas[i].recebido?"✔ Recebido":"⏳ Pendente"; }
    const del=e.target.closest("[data-del-parc]");
    if(del){ state.form.parcelas.splice(+del.dataset.delParc,1); render(container); }
  });
  container.querySelector("#btn-add-parcela")?.addEventListener("click",()=>{ state.form.parcelas.push({valor:0,data:hoje(),forma:state.formasPag[0]||"Dinheiro",recebido:false}); render(container); });
  container.querySelector("#btn-parcela-auto")?.addEventListener("click",()=>{ const t=calcularTotais(); state.form.parcelas=[{valor:t.totalGeral.toFixed(2),data:hoje(),forma:state.formasPag[0]||"Dinheiro",recebido:false}]; render(container); });

  container.querySelector("#btn-add-gasto")?.addEventListener("click",()=>{ state.form.gastos.push({descricao:"",valor:0}); render(container); });
  container.querySelector("#gastos-lista")?.addEventListener("input",e=>{
    const t=e.target;
    if(t.dataset.gastoDesc!==undefined){ state.form.gastos[+t.dataset.gastoDesc].descricao=t.value; }
    if(t.dataset.gastoVal !==undefined){ state.form.gastos[+t.dataset.gastoVal].valor=t.value; atualizarTotaisDOM(container); }
  });
  container.querySelector("#gastos-lista")?.addEventListener("click",e=>{
    const del=e.target.closest("[data-del-gasto]");
    if(del){ state.form.gastos.splice(+del.dataset.delGasto,1); render(container); }
  });
}

function bindAutocompleteCli(container) {
  const inp=container.querySelector("#f-cliente");
  const ac=container.querySelector("#ac-cli");
  if(!inp) return;
  inp.addEventListener("input",()=>{
    const q=inp.value.trim().toLowerCase();
    if(!q){ ac.style.display="none"; return; }
    const m=state.clientes.filter(c=>c.nome.toLowerCase().includes(q)).slice(0,6);
    if(!m.length){ ac.style.display="none"; return; }
    ac.innerHTML=m.map(c=>`<div class="ac-item" data-id="${c.id}" data-nome="${esc(c.nome)}">${esc(c.nome)}</div>`).join("");
    ac.style.display="block";
  });
  ac.addEventListener("click",e=>{ const it=e.target.closest(".ac-item"); if(!it) return; inp.value=it.dataset.nome; state.form.clienteNome=it.dataset.nome; state.form.clienteId=it.dataset.id; ac.style.display="none"; });
  container.querySelector("#btn-cad-cli")?.addEventListener("click",()=>abrirModalCadCliente(container,inp.value.trim(),c=>{ inp.value=c.nome; state.form.clienteNome=c.nome; state.form.clienteId=c.id; }));
}

function bindItemAC(container, i) {
  const inp=container.querySelector(`[data-item-desc="${i}"]`);
  const ac=container.querySelector(`#ac-item-${i}`);
  if(!inp||!ac) return;
  inp.addEventListener("input",()=>{
    const q=inp.value.trim().toLowerCase();
    if(!q){ ac.style.display="none"; return; }
    const m=state.produtos.filter(p=>p.nome.toLowerCase().includes(q)).slice(0,6);
    if(!m.length){ ac.style.display="none"; return; }
    ac.innerHTML=m.map(p=>`<div class="ac-item" data-nome="${esc(p.nome)}">${esc(p.nome)}</div>`).join("");
    ac.style.display="block";
  });
  ac.addEventListener("click",e=>{ const it=e.target.closest(".ac-item"); if(!it) return; inp.value=it.dataset.nome; state.form.itens[i].descricao=it.dataset.nome; ac.style.display="none"; });
}

// ══════════════════════════════════════════════════════════════════════════════
// SALVAR
// ══════════════════════════════════════════════════════════════════════════════
async function salvar(container) {
  const f=state.form, t=calcularTotais();
  const payload={
    cliente_nome:    f.clienteNome||null, vendedor:f.vendedor||null,
    tipo:            f.tipo, data_venda:f.data, data_entrega:f.entrega||null,
    status:          f.situacao, consumidor_final:f.consumidorFinal,
    palavra_chave:   f.palavraChave||null, observacoes:f.observacoes||null,
    total:           t.totalGeral, updated_at:new Date(),
  };
  let vendaId;
  if(state.vendaAberta){
    await supabase.from("vendas").update(payload).eq("id",state.vendaAberta.id);
    vendaId=state.vendaAberta.id;
    await supabase.from("venda_itens").delete().eq("venda_id",vendaId);
  } else {
    const { data:v, error }=await supabase.from("vendas").insert(payload).select().single();
    if(error){ alert("Erro: "+error.message); return; }
    vendaId=v.id;
  }
  const itensDb=f.itens.filter(it=>it.descricao).map(it=>({
    venda_id:vendaId, produto_id:it.produtoId||null, descricao:it.descricao,
    quantidade:Number(it.qtd)||1, preco_unitario:Number(it.preco)||0,
    desconto:Number(it.desconto)||0,
    total:(Number(it.preco)||0)*(Number(it.qtd)||0)-(Number(it.desconto)||0),
    obs:it.obs||null,
  }));
  if(itensDb.length) await supabase.from("venda_itens").insert(itensDb);
  await carregar();
  showToast(container,"✅ Venda salva com sucesso!");
  state.aba="lista"; state.vendaAberta=null; render(container);
}

// ══════════════════════════════════════════════════════════════════════════════
// IMPRIMIR
// ══════════════════════════════════════════════════════════════════════════════
function imprimir() {
  const f=state.form, t=calcularTotais(), sit=SITUACOES.find(s=>s.id===f.situacao);
  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Venda</title>
<style>body{font-family:Arial,sans-serif;padding:28px;color:#111;font-size:13px}
h1{font-size:20px;margin:0}.sub{font-size:11px;color:#666;margin-bottom:14px}
.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px}
.info-item label{font-size:10px;color:#888;display:block}.info-item span{font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:14px}
th{background:#283D3B;color:white;padding:7px 10px;font-size:11px;text-align:left}
td{padding:7px 10px;border-bottom:1px solid #eee}
.tr{font-weight:bold;background:#f5f5f5}
.obs{background:#f9f9f9;padding:10px;border-radius:6px;font-size:12px;margin-bottom:10px}
.footer{font-size:10px;color:#999;border-top:1px solid #eee;padding-top:8px;margin-top:14px}
</style></head><body>
<h1>Gráfica Master Print</h1>
<div class="sub">R. Elieser Pena, 67, Centro – Poté/MG · (33) 99813-9539 · @gmasterprint</div><hr>
<div class="info-grid">
<div class="info-item"><label>Cliente</label><span>${esc(f.clienteNome)||"—"}</span></div>
<div class="info-item"><label>Vendedor</label><span>${esc(f.vendedor)||"—"}</span></div>
<div class="info-item"><label>Data</label><span>${fmtData(f.data)}</span></div>
<div class="info-item"><label>Tipo</label><span>${f.tipo}</span></div>
<div class="info-item"><label>Situação</label><span>${sit?.label||f.situacao}</span></div>
<div class="info-item"><label>Entrega</label><span>${f.entrega?fmtData(f.entrega):"—"}</span></div>
</div>
<table><thead><tr><th>Produto/Serviço</th><th>Qtd</th><th>Preço</th><th>Desconto</th><th>Total</th></tr></thead>
<tbody>${f.itens.filter(it=>it.descricao).map(it=>{
  const tot=(Number(it.preco)||0)*(Number(it.qtd)||0)-(Number(it.desconto)||0);
  return `<tr><td>${esc(it.descricao)}${it.obs?`<br><small style="color:#888">${esc(it.obs)}</small>`:""}</td><td>${Number(it.qtd).toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})}</td><td>${fmtBRL(it.preco)}</td><td>${fmtBRL(it.desconto)}</td><td>${fmtBRL(tot)}</td></tr>`;
}).join("")}
<tr class="tr"><td colspan="4" style="text-align:right">TOTAL</td><td>${fmtBRL(t.totalGeral)}</td></tr>
</tbody></table>
${f.observacoes?`<div class="obs"><strong>Obs:</strong> ${esc(f.observacoes)}</div>`:""}
${f.parcelas.length?`<table><thead><tr><th>Parcela</th><th>Valor</th><th>Vencimento</th><th>Forma</th><th>Status</th></tr></thead><tbody>
${f.parcelas.map((p,i)=>`<tr><td>${i+1}/${f.parcelas.length}</td><td>${fmtBRL(p.valor)}</td><td>${fmtData(p.data)}</td><td>${p.forma}</td><td>${p.recebido?"✔ Recebido":"Pendente"}</td></tr>`).join("")}
</tbody></table>`:""}
<div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} · Gráfica Master Print</div>
</body></html>`;
  const win=window.open("","_blank","width=860,height=660");
  win.document.write(html); win.document.close();
  setTimeout(()=>win.print(),400);
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL TROCO
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalTroco(container) {
  const t=calcularTotais();
  const area=document.getElementById("app-modal-root");
  area.innerHTML=`
  <div class="modal-bg" id="modal-bg">
    <div class="modal" style="max-width:320px;text-align:center">
      <h3><i class="fi fi-rr-money-bill-wave"></i> Calcular Troco</h3>
      <div style="font-size:13px;color:var(--muted);margin-bottom:12px">
        Total: <strong style="color:var(--primary-light)">${fmtBRL(t.totalGeral)}</strong>
      </div>
      <label>Valor recebido (R$)</label>
      <input id="troco-inp" type="number" min="0" step="0.01" placeholder="0,00" autofocus style="font-size:18px;text-align:center;margin-bottom:12px" />
      <div id="troco-res" style="display:none;padding:14px;border-radius:var(--radius-md);margin-bottom:12px;font-size:16px"></div>
      <div class="modal-btns" style="justify-content:center">
        <button class="btn-secondary" id="t-cancel">Fechar</button>
        <button class="btn-primary" id="t-calc">Calcular</button>
      </div>
    </div>
  </div>`;
  area.querySelector("#t-cancel").addEventListener("click",()=>area.innerHTML="");
  area.querySelector("#modal-bg").addEventListener("click",e=>{ if(e.target.id==="modal-bg") area.innerHTML=""; });
  const calc=()=>{
    const rec=parseFloat(area.querySelector("#troco-inp").value)||0;
    const troco=rec-t.totalGeral;
    const el=area.querySelector("#troco-res");
    el.style.display="block";
    if(troco<0){ el.style.background="var(--error-bg)"; el.style.color="var(--error)"; el.innerHTML=`Faltam <strong>${fmtBRL(Math.abs(troco))}</strong>`; }
    else { el.style.background="var(--success-bg)"; el.style.color="var(--success)"; el.innerHTML=`Troco: <strong style="font-size:22px">${fmtBRL(troco)}</strong>`; }
  };
  area.querySelector("#t-calc").addEventListener("click",calc);
  area.querySelector("#troco-inp").addEventListener("keydown",e=>{ if(e.key==="Enter") calc(); });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL NOVO CLIENTE
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalCadCliente(container, nomeInicial, callback) {
  const area=document.getElementById("app-modal-root");
  area.innerHTML=`
  <div class="modal-bg" id="modal-bg-cli">
    <div class="modal" style="max-width:400px">
      <h3><i class="fi fi-rr-user-add"></i> Novo Cliente</h3>
      <label>Nome *</label><input id="cc-nome" value="${esc(nomeInicial)}" placeholder="Nome completo" autofocus />
      <label>Telefone</label><input id="cc-tel" placeholder="(00) 00000-0000" />
      <label>E-mail</label><input id="cc-email" type="email" placeholder="email@exemplo.com" />
      <div class="modal-btns">
        <button class="btn-secondary" id="cc-cancel">Cancelar</button>
        <button class="btn-primary" id="cc-ok">Cadastrar</button>
      </div>
    </div>
  </div>`;
  area.querySelector("#cc-cancel").addEventListener("click",()=>area.innerHTML="");
  area.querySelector("#cc-ok").addEventListener("click",async()=>{
    const nome=area.querySelector("#cc-nome").value.trim();
    if(!nome){ alert("Informe o nome."); return; }
    const { data:c }=await supabase.from("clientes").insert({ nome, telefone:area.querySelector("#cc-tel").value.trim()||null, email:area.querySelector("#cc-email").value.trim()||null }).select().single();
    state.clientes.push(c); area.innerHTML=""; callback(c);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtData(d){ if(!d) return "—"; const [y,m,dia]=d.split("-"); return `${dia}/${m}/${y}`; }
function showToast(container, msg){ const t=document.createElement("div"); t.className="vnd-toast"; t.textContent=msg; container.appendChild(t); setTimeout(()=>t.remove(),2800); }
function esc(s){ if(s==null) return ""; return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// ══════════════════════════════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════════════════════════════
function css(){ return `
.vnd-topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px}
.btn-nova-venda{display:inline-flex;align-items:center;gap:6px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius-md);padding:8px 16px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all var(--t)}
.btn-nova-venda:hover{opacity:.88}
.sit-filtros{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.sit-filtro{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:500;border:1px solid var(--border-md);background:transparent;color:var(--muted);cursor:pointer;transition:all var(--t)}
.sit-filtro:hover{background:var(--panel2);color:var(--text)}
.sit-filtro.active{background:var(--primary-bg);border-color:var(--primary-border);color:var(--primary-light);font-weight:700}
.sit-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.lista-wrap{overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border)}
.vnd-table{width:100%;border-collapse:collapse;font-size:13px}
.vnd-table th{text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:10px 14px;background:var(--panel2);border-bottom:1px solid var(--border)}
.vnd-table td{padding:11px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
.vnd-table tr:last-child td{border-bottom:none}
.vnd-row{cursor:pointer;transition:background var(--t)}
.vnd-row:hover td{background:rgba(0,124,190,0.04)}
.td-num{font-weight:700;color:var(--muted);font-size:12px}
.td-vazio{text-align:center;color:var(--muted);font-size:13px}
.sit-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px}
.vnd-card{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:14px}
.vnd-card-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:14px;display:flex;align-items:center;gap:6px}
.dados-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
@media(max-width:800px){.dados-grid{grid-template-columns:1fr 1fr}}
@media(max-width:500px){.dados-grid{grid-template-columns:1fr}}
.span2{grid-column:span 2}
.field-group{display:flex;flex-direction:column;gap:5px}
.field-group label{font-size:12px;color:var(--muted);font-weight:500}
.input-icon-wrap{display:flex;align-items:center;background:var(--panel);border:1px solid var(--border-md);border-radius:var(--radius-md);overflow:hidden;transition:border-color var(--t),box-shadow var(--t)}
.input-icon-wrap:focus-within{border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,124,190,0.10)}
.input-icon{padding:0 10px;color:var(--muted);font-size:14px;flex-shrink:0;display:flex;align-items:center}
.input-icon-wrap input,.input-icon-wrap select{border:none;border-radius:0;background:transparent;box-shadow:none;padding:9px 10px;flex:1;min-width:0;color:var(--text);font-family:var(--font);font-size:13px}
.input-icon-wrap input:focus,.input-icon-wrap select:focus{outline:none;box-shadow:none}
.consumidor-btn{padding:9px 16px;border-radius:var(--radius-md);border:1px solid var(--border-md);background:var(--panel);color:var(--muted);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all var(--t);text-align:center;width:100%}
.consumidor-btn.ativo{background:var(--primary);border-color:var(--primary);color:#fff}
.carrinho-wrap{overflow-x:auto;border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:10px}
.carrinho-table{width:100%;border-collapse:collapse;font-size:13px}
.carrinho-table th{background:var(--panel);padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border)}
.carrinho-table td{padding:7px 10px;border-bottom:1px solid var(--border);vertical-align:top}
.carrinho-table tr:last-child td{border-bottom:none}
.carrinho-total-row td{background:var(--panel);font-size:13px;font-weight:600;color:var(--text-sub);padding:10px 10px}
.item-input{width:100%;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:7px 9px;font-size:13px;font-family:var(--font);transition:border-color var(--t)}
.item-input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 2px rgba(0,124,190,0.10)}
.item-obs{display:block;width:100%;margin-top:4px;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--muted);font-size:11px;padding:3px 0;font-family:var(--font);font-style:italic}
.item-obs:focus{outline:none;border-color:var(--primary)}
.td-inpwrap{border:1px solid var(--border);border-radius:var(--radius-sm)}
.td-inpwrap:focus-within{border-color:var(--primary);box-shadow:0 0 0 2px rgba(0,124,190,0.08)}
.td-inp{background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:7px 8px;font-size:13px;width:100%;font-family:var(--font);transition:border-color var(--t)}
.td-inp:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 2px rgba(0,124,190,0.10)}
.td-inp.right{text-align:right}
.td-inp.center{text-align:center}
.td-inpwrap .td-inp{border:none;background:transparent;box-shadow:none}
.td-inpwrap .td-inp:focus{box-shadow:none}
.del-row{background:transparent;border:none;color:var(--error);cursor:pointer;font-size:13px;padding:4px 6px;border-radius:var(--radius-sm);transition:background var(--t)}
.del-row:hover{background:var(--error-bg)}
.btn-add-linha{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px dashed var(--border-md);color:var(--muted);border-radius:var(--radius-md);padding:8px 14px;font-size:12px;font-weight:500;cursor:pointer;transition:all var(--t);font-family:var(--font)}
.btn-add-linha:hover{border-color:var(--primary);color:var(--primary-light);background:var(--primary-bg)}
.financeiro-wrap{overflow-x:auto;border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:10px}
.financeiro-table{width:100%;border-collapse:collapse;font-size:13px}
.financeiro-table th{background:var(--panel);padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border)}
.financeiro-table td{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:middle}
.financeiro-table tr:last-child td{border-bottom:none}
.financeiro-total-row td{background:var(--panel);font-size:13px;color:var(--muted);font-weight:600}
.parc-status{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px}
.parc-status.recebido{background:var(--success-bg);color:var(--success)}
.parc-status.pendente{background:var(--warning-bg);color:var(--warning)}
.btn-add-parcela{display:inline-flex;align-items:center;gap:6px;background:var(--primary-bg);border:1px solid var(--primary-border);color:var(--primary-light);border-radius:var(--radius-md);padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all var(--t);font-family:var(--font)}
.btn-add-parcela:hover{background:var(--primary);color:#fff}
.btn-add-parcela.secondary{background:var(--panel);color:var(--muted);border-color:var(--border-md)}
.btn-add-parcela.secondary:hover{background:var(--panel2);color:var(--text)}
.gasto-row{display:flex;gap:8px;align-items:center;margin-bottom:6px}
.gasto-desc{flex:1;background:var(--panel);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:8px 10px;font-size:13px;font-family:var(--font)}
.bottom-bar{position:sticky;bottom:0;background:var(--panel);border-top:1px solid var(--border);padding:12px 0;margin-top:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;z-index:8}
.total-bottom{font-size:14px;color:var(--muted);padding:8px 16px;background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-md)}
.total-bottom strong{color:var(--primary-light);font-size:16px}
.btn-salvar-vnd{display:inline-flex;align-items:center;gap:6px;background:var(--success);color:#fff;border:none;border-radius:var(--radius-md);padding:8px 16px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all var(--t)}
.btn-salvar-vnd:hover{opacity:.88}
.btn-imprimir-vnd{display:inline-flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--border-md);color:var(--text-sub);border-radius:var(--radius-md);padding:8px 14px;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:all var(--t)}
.btn-imprimir-vnd:hover{background:var(--panel3);color:var(--text)}
.btn-hist-vnd{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid var(--border-md);color:var(--muted);border-radius:var(--radius-md);padding:8px 14px;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:all var(--t)}
.btn-hist-vnd:hover{color:var(--text);border-color:var(--primary)}
.btn-troco{display:inline-flex;align-items:center;gap:6px;background:var(--warning-bg);border:1px solid rgba(232,160,16,0.25);color:var(--warning);border-radius:var(--radius-md);padding:8px 14px;font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:all var(--t)}
.btn-troco:hover{background:rgba(232,160,16,0.2)}
.btn-mini-green{display:inline-flex;align-items:center;gap:5px;background:var(--success-bg);color:var(--success);border:1px solid var(--success-border);border-radius:var(--radius-md);padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer;transition:all var(--t);white-space:nowrap;flex-shrink:0}
.btn-mini-green:hover{opacity:.85}
.autocomplete-wrap{position:relative}
.autocomplete-list{display:none;position:absolute;top:100%;left:0;right:0;z-index:50;background:var(--panel);border:1px solid var(--border-md);border-radius:var(--radius-md);box-shadow:var(--shadow-md);max-height:180px;overflow-y:auto}
.ac-item{padding:9px 12px;font-size:13px;cursor:pointer;transition:background var(--t)}
.ac-item:hover{background:var(--primary-bg);color:var(--primary-light)}
.vnd-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--panel);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-lg);padding:12px 24px;font-size:13px;font-weight:600;box-shadow:var(--shadow-lg);z-index:999;animation:slideUp .2s ease}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:100;animation:fadeIn .12s ease}
.modal{background:var(--panel);border:1px solid var(--border-md);border-radius:var(--radius-xl);padding:24px;min-width:320px;max-width:480px;width:92%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);animation:slideUp .15s ease}
.modal h3{font-size:16px;font-weight:700;margin-bottom:16px}
.modal label{display:block;font-size:12px;font-weight:500;color:var(--muted);margin-bottom:5px;margin-top:12px}
.modal label:first-of-type{margin-top:0}
.modal-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}
`; }