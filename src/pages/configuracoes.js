import { supabase } from "../supabase/client.js";

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  aba: "empresa",
  cfg: {},
  vendedores: [],
  formasPagamento: [],
  taxasCartao: [],
  contasBancarias: [],
  categoriasFinanceiras: { receitas: [], despesas: [] },
  etapasProducao: [],
  maquinasProducao: [],
  custosFixos: [],
  // Produtos
  categorialProdutos: [],
  unidadesProdutos: [],
  // Estoque
  fornecedores: [],
  categoriasMateriais: [],
  // Clientes
  categoriasClientes: [],
  camposCustomClientes: [],
  // Usuários/Permissões
  perfisPermissao: [],
  salvando: false,
  msg: null,
};

const ABAS = [
  { key: "empresa",       emoji: "🏢", label: "Empresa"        },
  { key: "financeiro",    emoji: "💰", label: "Financeiro"     },
  { key: "precificacao",  emoji: "📈", label: "Precificação"   },
  { key: "producao",      emoji: "🏭", label: "Produção"       },
  { key: "orcamentos",    emoji: "🧾", label: "Orçamentos"     },
  { key: "produtos",      emoji: "📦", label: "Produtos"       },
  { key: "estoque",       emoji: "🗂️", label: "Estoque"        },
  { key: "clientes",      emoji: "👥", label: "Clientes"       },
  { key: "usuarios",      emoji: "🔐", label: "Usuários"       },
  { key: "vendedores",    emoji: "👤", label: "Vendedores"     },
  { key: "impressao",     emoji: "🖨️", label: "Impressão"      },
  { key: "integracoes",   emoji: "🔗", label: "Integrações"    },
  { key: "personalizacao",emoji: "🎨", label: "Personalização" },
  { key: "seguranca",     emoji: "🛡️", label: "Segurança"      },
];

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function Configuracoes(container) {
  container.innerHTML = `<div class="loading">Carregando configurações...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const [{ data: cfg }, { data: vends }] = await Promise.all([
    supabase.from("configuracoes").select("*").eq("id", "global").single(),
    supabase.from("vendedores").select("*").order("nome"),
  ]);
  state.cfg = cfg || {};
  state.vendedores = vends || [];

  state.formasPagamento    = parseJSON(state.cfg.formas_pagamento, []);
  state.taxasCartao        = parseJSON(state.cfg.taxas_cartao, []);
  state.contasBancarias    = parseJSON(state.cfg.contas_bancarias, []);
  state.categoriasFinanceiras = parseJSON(state.cfg.categorias_financeiras, {
    receitas: ["Impressão","Fachadas","Adesivos","Cartões","Brindes"],
    despesas: ["Energia","Aluguel","Tinta","Lona","Funcionários","Marketing"],
  });
  state.etapasProducao = parseJSON(state.cfg.etapas_producao, [
    { nome:"Fila",        cor:"#868e96", icone:"⏳", ordem:1 },
    { nome:"Conferência", cor:"#ffa94d", icone:"🔍", ordem:2 },
    { nome:"Impressão",   cor:"#4dabf7", icone:"🖨️", ordem:3 },
    { nome:"Recorte",     cor:"#a9e34b", icone:"✂️", ordem:4 },
    { nome:"Acabamento",  cor:"#da77f2", icone:"🔧", ordem:5 },
    { nome:"Pronto",      cor:"#69db7c", icone:"✅", ordem:6 },
  ]);
  state.maquinasProducao = parseJSON(state.cfg.maquinas_producao, []);
  state.custosFixos      = parseJSON(state.cfg.custos_fixos, [
    { nome:"Aluguel", valor:0 }, { nome:"Energia", valor:0 },
    { nome:"Internet", valor:0 }, { nome:"Salários", valor:0 },
  ]);
  // Produtos
  state.categoriasProdutos = parseJSON(state.cfg.categorias_produtos, [
    "Adesivos","Lonas","Fachadas","Acrílico","PVC","Cartões","Banners","Brindes",
  ]);
  state.unidadesProdutos = parseJSON(state.cfg.unidades_produtos, [
    { sigla:"m²", nome:"Metro quadrado" },
    { sigla:"un", nome:"Unidade"        },
    { sigla:"m",  nome:"Metro linear"   },
    { sigla:"cm", nome:"Centímetro"     },
    { sigla:"fl", nome:"Folha"          },
    { sigla:"kg", nome:"Quilograma"     },
  ]);
  state.tabelasPreco = parseJSON(state.cfg.tabelas_preco, [
    { nome:"Varejo",  multiplicador:1.0  },
    { nome:"Atacado", multiplicador:0.85 },
    { nome:"Revenda", multiplicador:0.75 },
  ]);
  // Estoque
  state.fornecedores        = parseJSON(state.cfg.fornecedores, []);
  state.categoriasMateriais = parseJSON(state.cfg.categorias_materiais, [
    "Lona","Vinil","PVC","Acrílico","Tinta","Papel","Insumos",
  ]);
  state.unidadesEstoque = parseJSON(state.cfg.unidades_estoque, [
    { sigla:"m",  nome:"Metro"      },
    { sigla:"m²", nome:"Metro²"     },
    { sigla:"fl", nome:"Folha"      },
    { sigla:"L",  nome:"Litro"      },
    { sigla:"kg", nome:"Quilograma" },
    { sigla:"un", nome:"Unidade"    },
  ]);
  // Clientes
  state.categoriasClientes   = parseJSON(state.cfg.categorias_clientes, [
    "Pessoa Física","Empresa","Revenda","VIP",
  ]);
  state.camposCustomClientes = parseJSON(state.cfg.campos_custom_clientes, [
    { nome:"Instagram",               tipo:"texto"  },
    { nome:"Preferência de contato",  tipo:"opcao", opcoes:"WhatsApp,Email,Telefone" },
  ]);
  // Usuários/Permissões
  state.perfisPermissao = parseJSON(state.cfg.perfis_permissao, [
    { nome:"Administrador", cor:"#ff6b6b",
      permissoes:{ editar_preco:true,  excluir_venda:true,  cancelar_pedido:true,  ver_lucro:true,  acessar_config:true,  ver_financeiro:true  } },
    { nome:"Financeiro",    cor:"#ffa94d",
      permissoes:{ editar_preco:true,  excluir_venda:false, cancelar_pedido:false, ver_lucro:true,  acessar_config:false, ver_financeiro:true  } },
    { nome:"Vendedor",      cor:"#4dabf7",
      permissoes:{ editar_preco:false, excluir_venda:false, cancelar_pedido:false, ver_lucro:false, acessar_config:false, ver_financeiro:false } },
    { nome:"Produção",      cor:"#69db7c",
      permissoes:{ editar_preco:false, excluir_venda:false, cancelar_pedido:false, ver_lucro:false, acessar_config:false, ver_financeiro:false } },
  ]);
}

function parseJSON(val, fallback) {
  try { return JSON.parse(val || "null") ?? fallback; }
  catch { return fallback; }
}

// ─── Render principal ─────────────────────────────────────────────────────────
function render(container) {
  container.innerHTML = `
    <style>${css()}</style>
    <div class="cfg-wrap">
      <aside class="cfg-sidebar">
        <div class="cfg-sidebar-title">Configurações</div>
        ${ABAS.map(a => `
          <button class="cfg-nav-btn ${state.aba === a.key ? "active" : ""}" data-aba="${a.key}">
            <span class="cfg-nav-emoji">${a.emoji}</span>
            <span>${a.label}</span>
          </button>`).join("")}
      </aside>
      <div class="cfg-body">
        ${state.msg ? `
          <div class="cfg-toast ${state.msg.tipo}">
            ${state.msg.tipo === "ok" ? "✅" : "❌"} ${state.msg.texto}
          </div>` : ""}
        <div id="cfg-content"></div>
        <div id="modal-area"></div>
      </div>
    </div>
  `;

  container.querySelectorAll("[data-aba]").forEach(btn =>
    btn.addEventListener("click", () => { state.aba = btn.dataset.aba; render(container); })
  );

  const content = container.querySelector("#cfg-content");
  ({
    empresa:        () => renderEmpresa(content, container),
    financeiro:     () => renderFinanceiro(content, container),
    precificacao:   () => renderPrecificacao(content, container),
    producao:       () => renderProducao(content, container),
    orcamentos:     () => renderOrcamentos(content, container),
    produtos:       () => renderProdutos(content, container),
    estoque:        () => renderEstoque(content, container),
    clientes:       () => renderClientes(content, container),
    usuarios:       () => renderUsuarios(content, container),
    vendedores:     () => renderVendedores(content, container),
    impressao:      () => renderImpressao(content, container),
    integracoes:    () => renderIntegracoes(content, container),
    personalizacao: () => renderPersonalizacao(content, container),
    seguranca:      () => renderSeguranca(content, container),
  })[state.aba]?.();

  if (state.msg) setTimeout(() => { state.msg = null; render(container); }, 3500);
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: EMPRESA
// ══════════════════════════════════════════════════════════════════════════════
function renderEmpresa(content, container) {
  const c = state.cfg;
  content.innerHTML = `
    <div class="cfg-section-title">🏢 Dados da Empresa</div>
    <div class="cfg-card">
      <div class="cfg-grid">
        <div class="cfg-group full">
          <label>Nome Fantasia *</label>
          <input id="e-nome" value="${esc(c.empresa_nome)}" placeholder="Ex: Gráfica Master Print" />
        </div>
        <div class="cfg-group full">
          <label>Razão Social</label>
          <input id="e-razao" value="${esc(c.empresa_razao_social)}" placeholder="Razão Social Ltda." />
        </div>
        <div class="cfg-group">
          <label>CNPJ</label>
          <input id="e-cnpj" value="${esc(c.empresa_cnpj)}" placeholder="00.000.000/0000-00" />
        </div>
        <div class="cfg-group">
          <label>Inscrição Estadual</label>
          <input id="e-ie" value="${esc(c.empresa_ie)}" placeholder="000.000.000.000" />
        </div>
        <div class="cfg-group">
          <label>Telefone</label>
          <input id="e-tel" value="${esc(c.empresa_telefone)}" placeholder="(11) 99999-9999" />
        </div>
        <div class="cfg-group">
          <label>WhatsApp</label>
          <input id="e-whats" value="${esc(c.empresa_whatsapp)}" placeholder="(11) 99999-9999" />
        </div>
        <div class="cfg-group">
          <label>E-mail</label>
          <input id="e-email" type="email" value="${esc(c.empresa_email)}" placeholder="contato@empresa.com" />
        </div>
        <div class="cfg-group">
          <label>Site / Instagram</label>
          <input id="e-site" value="${esc(c.empresa_site)}" placeholder="@empresa ou www.empresa.com" />
        </div>
        <div class="cfg-group full">
          <label>Endereço completo</label>
          <input id="e-end" value="${esc(c.empresa_endereco)}" placeholder="Rua Exemplo, 123 — Bairro — Cidade/UF" />
        </div>
        <div class="cfg-group full">
          <label>URL do Logotipo</label>
          <input id="e-logo" value="${esc(c.empresa_logo_url)}" placeholder="https://..." />
        </div>
        <div class="cfg-group full">
          <label>Observações padrão / Rodapé de orçamento</label>
          <textarea id="e-rodape" rows="3" placeholder="Ex: Validade: 15 dias. Prazo de produção: 3 dias úteis.">${esc(c.empresa_rodape)}</textarea>
        </div>
      </div>
      <div class="cfg-acoes">
        <button class="btn-primary" id="btn-salvar-empresa">💾 Salvar dados da empresa</button>
      </div>
    </div>
  `;
  content.querySelector("#btn-salvar-empresa").addEventListener("click", async () => {
    await salvarCfg(container, {
      empresa_nome:          v("#e-nome"),
      empresa_razao_social:  v("#e-razao"),
      empresa_cnpj:          v("#e-cnpj"),
      empresa_ie:            v("#e-ie"),
      empresa_telefone:      v("#e-tel"),
      empresa_whatsapp:      v("#e-whats"),
      empresa_email:         v("#e-email"),
      empresa_site:          v("#e-site"),
      empresa_endereco:      v("#e-end"),
      empresa_logo_url:      v("#e-logo"),
      empresa_rodape:        v("#e-rodape"),
    }, content);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: FINANCEIRO
// ══════════════════════════════════════════════════════════════════════════════
function renderFinanceiro(content, container) {
  // Sub-abas dentro de financeiro
  const sub = state._sub_financeiro || "fp";
  state._sub_financeiro = sub;

  const SUBS = [
    { key:"fp",      label:"💳 Formas de Pagamento" },
    { key:"cartao",  label:"🏦 Taxas de Cartão"     },
    { key:"contas",  label:"🏛️ Contas Bancárias"    },
    { key:"categ",   label:"📂 Categorias"           },
  ];

  content.innerHTML = `
    <div class="cfg-section-title">💰 Financeiro</div>
    <div class="sub-tabs">
      ${SUBS.map(s => `<button class="sub-tab ${sub===s.key?"active":""}" data-sub="${s.key}">${s.label}</button>`).join("")}
    </div>
    <div id="sub-content"></div>
  `;
  content.querySelectorAll("[data-sub]").forEach(btn =>
    btn.addEventListener("click", () => { state._sub_financeiro = btn.dataset.sub; renderFinanceiro(content, container); })
  );
  const sc = content.querySelector("#sub-content");
  if (sub === "fp")     renderFormasPagamento(sc, container);
  if (sub === "cartao") renderTaxasCartao(sc, container);
  if (sub === "contas") renderContasBancarias(sc, container);
  if (sub === "categ")  renderCategoriasFinanceiras(sc, container);
}

// ── Formas de Pagamento ───────────────────────────────────────────────────────
function renderFormasPagamento(sc, container) {
  const fps = state.formasPagamento;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <span class="cfg-hint" style="margin:0">Configure as formas de pagamento aceitas nos pedidos.</span>
      <button class="btn-primary" id="btn-nova-fp">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
      ${fps.length === 0 ? `<div class="cfg-vazio">Nenhuma forma de pagamento cadastrada.</div>`
      : `<table class="cfg-table">
          <thead><tr><th>Nome</th><th>Tipo</th><th>Parcelas máx.</th><th>Taxa (%)</th><th>Status</th><th></th></tr></thead>
          <tbody>${fps.map((fp,i) => `
            <tr>
              <td><strong>${esc(fp.nome)}</strong></td>
              <td><span class="tag-cargo">${esc(fp.tipo)||"—"}</span></td>
              <td>${fp.parcelas_max||1}×</td>
              <td>${fp.taxa?fp.taxa+"%":"—"}</td>
              <td><span class="tag-status ${fp.ativa!==false?"ativo":"inativo"}">${fp.ativa!==false?"● Ativa":"○ Inativa"}</span></td>
              <td class="tbl-acoes">
                <button class="btn-icon" data-edit-fp="${i}">✏️</button>
                <button class="btn-icon danger" data-del-fp="${i}">🗑</button>
              </td>
            </tr>`).join("")}</tbody>
        </table>`}
    </div>`;
  sc.querySelector("#btn-nova-fp").addEventListener("click", () => abrirModalFP(container, null, sc));
  sc.querySelectorAll("[data-edit-fp]").forEach(b => b.addEventListener("click", () => abrirModalFP(container, parseInt(b.dataset.editFp), sc)));
  sc.querySelectorAll("[data-del-fp]").forEach(b => b.addEventListener("click", async () => {
    const i = parseInt(b.dataset.delFp);
    if (!confirm(`Remover "${state.formasPagamento[i]?.nome}"?`)) return;
    state.formasPagamento.splice(i, 1);
    await salvarJSON(container, "formas_pagamento", state.formasPagamento);
    renderFormasPagamento(sc, container);
  }));
}

function abrirModalFP(container, idx, sc) {
  const area = container.querySelector("#modal-area");
  const fp = idx !== null ? state.formasPagamento[idx] : {};
  const editando = idx !== null;
  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando?"Editar":"Nova"} Forma de Pagamento</h3>
        <label>Nome *</label>
        <input id="fp-nome" value="${esc(fp.nome)}" placeholder="Ex: PIX, Dinheiro..." autofocus />
        <label>Tipo</label>
        <select id="fp-tipo">
          ${["Dinheiro","PIX","Cartão Crédito","Cartão Débito","Transferência","Boleto","Cheque","Outro"]
            .map(t=>`<option value="${t}" ${fp.tipo===t?"selected":""}>${t}</option>`).join("")}
        </select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label>Parcelas máximas</label><input id="fp-parc" type="number" min="1" max="36" value="${fp.parcelas_max||1}" /></div>
          <div><label>Taxa (%)</label><input id="fp-taxa" type="number" min="0" step="0.01" value="${fp.taxa||0}" /></div>
        </div>
        <label>Status</label>
        <select id="fp-ativa">
          <option value="true"  ${fp.ativa!==false?"selected":""}>● Ativa</option>
          <option value="false" ${fp.ativa===false ?"selected":""}>○ Inativa</option>
        </select>
        <div class="modal-btns">
          <button class="btn-secondary" id="fp-cancel">Cancelar</button>
          <button class="btn-primary"   id="fp-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#fp-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if(e.target.id==="modal-bg") area.innerHTML=""; });
  area.querySelector("#fp-ok").addEventListener("click", async () => {
    const nome = area.querySelector("#fp-nome").value.trim();
    if (!nome) { alert("Informe o nome."); return; }
    const dados = {
      nome,
      tipo:         area.querySelector("#fp-tipo").value,
      parcelas_max: parseInt(area.querySelector("#fp-parc").value)||1,
      taxa:         parseFloat(area.querySelector("#fp-taxa").value)||0,
      ativa:        area.querySelector("#fp-ativa").value==="true",
    };
    if (editando) state.formasPagamento[idx] = dados;
    else state.formasPagamento.push(dados);
    area.innerHTML = "";
    await salvarJSON(container, "formas_pagamento", state.formasPagamento);
    state.msg = { tipo:"ok", texto: editando?"Forma atualizada!":"Forma adicionada!" };
    render(container);
  });
}

// ── Taxas de Cartão ───────────────────────────────────────────────────────────
function renderTaxasCartao(sc, container) {
  const tc = state.taxasCartao;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <div>
        <div style="font-size:13px;font-weight:600;margin-bottom:2px">Taxas por maquininha e bandeira</div>
        <div class="cfg-hint" style="margin:0">Usadas no cálculo automático de custo ao parcelar.</div>
      </div>
      <button class="btn-primary" id="btn-nova-tc">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:0;overflow:hidden;overflow-x:auto;margin-top:10px">
      ${tc.length === 0 ? `<div class="cfg-vazio">Nenhuma taxa cadastrada. Clique em "+ Adicionar" para começar.</div>`
      : `<table class="cfg-table">
          <thead><tr>
            <th>Máquina</th><th>Bandeira</th>
            <th>Déb.</th><th>Créd. 1×</th><th>2×</th><th>3×</th><th>6×</th><th>12×</th>
            <th>Prazo (dias)</th><th></th>
          </tr></thead>
          <tbody>${tc.map((t,i) => `
            <tr>
              <td><strong>${esc(t.maquina)}</strong></td>
              <td><span class="tag-cargo">${esc(t.bandeira)||"Todas"}</span></td>
              <td>${fmt(t.debito)}%</td>
              <td>${fmt(t.credito_1)}%</td>
              <td>${fmt(t.credito_2)}%</td>
              <td>${fmt(t.credito_3)}%</td>
              <td>${fmt(t.credito_6)}%</td>
              <td>${fmt(t.credito_12)}%</td>
              <td>${t.prazo_dias||"—"} dias</td>
              <td class="tbl-acoes">
                <button class="btn-icon" data-edit-tc="${i}">✏️</button>
                <button class="btn-icon danger" data-del-tc="${i}">🗑</button>
              </td>
            </tr>`).join("")}</tbody>
        </table>`}
    </div>
    <div class="cfg-hint" style="margin-top:10px">💡 Exemplos comuns: Mercado Pago, InfinitePay, Stone, Ton, PagSeguro</div>
  `;
  sc.querySelector("#btn-nova-tc").addEventListener("click", () => abrirModalTC(container, null, sc));
  sc.querySelectorAll("[data-edit-tc]").forEach(b => b.addEventListener("click", () => abrirModalTC(container, parseInt(b.dataset.editTc), sc)));
  sc.querySelectorAll("[data-del-tc]").forEach(b => b.addEventListener("click", async () => {
    const i = parseInt(b.dataset.delTc);
    if (!confirm(`Remover taxa de "${state.taxasCartao[i]?.maquina}"?`)) return;
    state.taxasCartao.splice(i, 1);
    await salvarJSON(container, "taxas_cartao", state.taxasCartao);
    renderTaxasCartao(sc, container);
  }));
}

function abrirModalTC(container, idx, sc) {
  const area = container.querySelector("#modal-area");
  const t = idx !== null ? state.taxasCartao[idx] : {};
  const editando = idx !== null;
  const MAQUINAS = ["Mercado Pago","InfinitePay","Stone","Ton","PagSeguro","Cielo","Rede","GetNet","PagBank","Outro"];
  const BANDEIRAS = ["Todas","Visa","Mastercard","Elo","Amex","Hipercard","Cabal"];
  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:520px">
        <h3>${editando?"Editar":"Nova"} Taxa de Cartão</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label>Máquina / Operadora *</label>
            <select id="tc-maq">
              ${MAQUINAS.map(m=>`<option value="${m}" ${t.maquina===m?"selected":""}>${m}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Bandeira</label>
            <select id="tc-band">
              ${BANDEIRAS.map(b=>`<option value="${b}" ${(t.bandeira||"Todas")===b?"selected":""}>${b}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="tc-grid">
          <div><label>Débito (%)</label><input id="tc-deb"  type="number" min="0" step="0.01" value="${t.debito||""}"     placeholder="1.5" /></div>
          <div><label>Créd. 1× (%)</label><input id="tc-c1"  type="number" min="0" step="0.01" value="${t.credito_1||""}"  placeholder="2.5" /></div>
          <div><label>Créd. 2× (%)</label><input id="tc-c2"  type="number" min="0" step="0.01" value="${t.credito_2||""}"  placeholder="3.0" /></div>
          <div><label>Créd. 3× (%)</label><input id="tc-c3"  type="number" min="0" step="0.01" value="${t.credito_3||""}"  placeholder="3.5" /></div>
          <div><label>Créd. 6× (%)</label><input id="tc-c6"  type="number" min="0" step="0.01" value="${t.credito_6||""}"  placeholder="4.5" /></div>
          <div><label>Créd. 12× (%)</label><input id="tc-c12" type="number" min="0" step="0.01" value="${t.credito_12||""}" placeholder="6.0" /></div>
          <div style="grid-column:1/-1"><label>Prazo de recebimento (dias)</label><input id="tc-prazo" type="number" min="0" value="${t.prazo_dias||""}" placeholder="30" /></div>
        </div>
        <div class="modal-btns">
          <button class="btn-secondary" id="tc-cancel">Cancelar</button>
          <button class="btn-primary"   id="tc-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#tc-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if(e.target.id==="modal-bg") area.innerHTML=""; });
  area.querySelector("#tc-ok").addEventListener("click", async () => {
    const maquina = area.querySelector("#tc-maq").value;
    const dados = {
      maquina,
      bandeira:   area.querySelector("#tc-band").value,
      debito:     parseFloat(area.querySelector("#tc-deb").value)||0,
      credito_1:  parseFloat(area.querySelector("#tc-c1").value)||0,
      credito_2:  parseFloat(area.querySelector("#tc-c2").value)||0,
      credito_3:  parseFloat(area.querySelector("#tc-c3").value)||0,
      credito_6:  parseFloat(area.querySelector("#tc-c6").value)||0,
      credito_12: parseFloat(area.querySelector("#tc-c12").value)||0,
      prazo_dias: parseInt(area.querySelector("#tc-prazo").value)||null,
    };
    if (editando) state.taxasCartao[idx] = dados;
    else state.taxasCartao.push(dados);
    area.innerHTML = "";
    await salvarJSON(container, "taxas_cartao", state.taxasCartao);
    state.msg = { tipo:"ok", texto: editando?"Taxa atualizada!":"Taxa adicionada!" };
    render(container);
  });
}

// ── Contas Bancárias ──────────────────────────────────────────────────────────
function renderContasBancarias(sc, container) {
  const cb = state.contasBancarias;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <span class="cfg-hint" style="margin:0">Contas usadas para lançamentos financeiros.</span>
      <button class="btn-primary" id="btn-nova-cb">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
      ${cb.length===0 ? `<div class="cfg-vazio">Nenhuma conta cadastrada.</div>`
      : `<table class="cfg-table">
          <thead><tr><th>Banco</th><th>Tipo</th><th>Agência</th><th>Conta</th><th>Saldo Inicial</th><th></th></tr></thead>
          <tbody>${cb.map((c,i)=>`
            <tr>
              <td><strong>${esc(c.banco)}</strong></td>
              <td><span class="tag-cargo">${esc(c.tipo)||"—"}</span></td>
              <td>${esc(c.agencia)||"—"}</td>
              <td>${esc(c.conta)||"—"}</td>
              <td>R$ ${fmtMoeda(c.saldo_inicial)}</td>
              <td class="tbl-acoes">
                <button class="btn-icon" data-edit-cb="${i}">✏️</button>
                <button class="btn-icon danger" data-del-cb="${i}">🗑</button>
              </td>
            </tr>`).join("")}</tbody>
        </table>`}
    </div>`;
  sc.querySelector("#btn-nova-cb").addEventListener("click", () => abrirModalCB(container, null, sc));
  sc.querySelectorAll("[data-edit-cb]").forEach(b => b.addEventListener("click", () => abrirModalCB(container, parseInt(b.dataset.editCb), sc)));
  sc.querySelectorAll("[data-del-cb]").forEach(b => b.addEventListener("click", async () => {
    const i = parseInt(b.dataset.delCb);
    if (!confirm(`Remover a conta "${state.contasBancarias[i]?.banco}"?`)) return;
    state.contasBancarias.splice(i, 1);
    await salvarJSON(container, "contas_bancarias", state.contasBancarias);
    renderContasBancarias(sc, container);
  }));
}

function abrirModalCB(container, idx, sc) {
  const area = container.querySelector("#modal-area");
  const c = idx!==null ? state.contasBancarias[idx] : {};
  const editando = idx!==null;
  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando?"Editar":"Nova"} Conta Bancária</h3>
        <label>Banco *</label>
        <input id="cb-banco" value="${esc(c.banco)}" placeholder="Ex: Nubank, Itaú, Caixa..." autofocus />
        <label>Tipo de conta</label>
        <select id="cb-tipo">
          ${["Corrente","Poupança","Pagamento","Caixa","Outro"].map(t=>`<option value="${t}" ${c.tipo===t?"selected":""}>${t}</option>`).join("")}
        </select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label>Agência</label><input id="cb-ag" value="${esc(c.agencia)}" placeholder="0000-0" /></div>
          <div><label>Conta</label><input id="cb-conta" value="${esc(c.conta)}" placeholder="00000-0" /></div>
        </div>
        <label>Saldo inicial (R$)</label>
        <input id="cb-saldo" type="number" step="0.01" value="${c.saldo_inicial||0}" />
        <div class="modal-btns">
          <button class="btn-secondary" id="cb-cancel">Cancelar</button>
          <button class="btn-primary"   id="cb-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#cb-cancel").addEventListener("click", () => area.innerHTML="");
  area.querySelector("#modal-bg").addEventListener("click", e=>{if(e.target.id==="modal-bg") area.innerHTML="";});
  area.querySelector("#cb-ok").addEventListener("click", async () => {
    const banco = area.querySelector("#cb-banco").value.trim();
    if (!banco) { alert("Informe o banco."); return; }
    const dados = {
      banco,
      tipo:          area.querySelector("#cb-tipo").value,
      agencia:       area.querySelector("#cb-ag").value.trim()||null,
      conta:         area.querySelector("#cb-conta").value.trim()||null,
      saldo_inicial: parseFloat(area.querySelector("#cb-saldo").value)||0,
    };
    if (editando) state.contasBancarias[idx] = dados;
    else state.contasBancarias.push(dados);
    area.innerHTML="";
    await salvarJSON(container,"contas_bancarias",state.contasBancarias);
    state.msg={tipo:"ok",texto:editando?"Conta atualizada!":"Conta adicionada!"};
    render(container);
  });
}

// ── Categorias Financeiras ────────────────────────────────────────────────────
function renderCategoriasFinanceiras(sc, container) {
  const cat = state.categoriasFinanceiras;
  sc.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
      ${renderListaCategoria("receitas", "📥 Receitas", cat.receitas, sc, container)}
      ${renderListaCategoria("despesas", "📤 Despesas", cat.despesas, sc, container)}
    </div>`;
  // Bind add/remove
  ["receitas","despesas"].forEach(tipo => {
    sc.querySelector(`#btn-add-${tipo}`).addEventListener("click", async () => {
      const nome = prompt(`Nova categoria de ${tipo}:`);
      if (!nome?.trim()) return;
      state.categoriasFinanceiras[tipo].push(nome.trim());
      await salvarJSON(container,"categorias_financeiras",state.categoriasFinanceiras);
      renderCategoriasFinanceiras(sc, container);
    });
    sc.querySelectorAll(`[data-del-cat-${tipo}]`).forEach(b => b.addEventListener("click", async () => {
      const i = parseInt(b.dataset[`delCat${tipo.charAt(0).toUpperCase()+tipo.slice(1)}`]);
      state.categoriasFinanceiras[tipo].splice(i, 1);
      await salvarJSON(container,"categorias_financeiras",state.categoriasFinanceiras);
      renderCategoriasFinanceiras(sc, container);
    }));
  });
}
function renderListaCategoria(tipo, titulo, lista, sc, container) {
  return `
    <div class="cfg-card">
      <div class="cfg-section-header" style="margin-bottom:10px">
        <div class="cfg-card-title" style="margin:0">${titulo}</div>
        <button class="btn-primary" id="btn-add-${tipo}" style="padding:5px 12px;font-size:12px">+</button>
      </div>
      ${lista.map((cat,i)=>`
        <div class="categ-item">
          <span>${esc(cat)}</span>
          <button class="btn-icon danger" data-del-cat-${tipo}="${i}" style="padding:2px 7px;font-size:11px">✕</button>
        </div>`).join("") || `<div class="cfg-vazio" style="padding:12px">Sem categorias.</div>`}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: PRECIFICAÇÃO ⭐
// ══════════════════════════════════════════════════════════════════════════════
function renderPrecificacao(content, container) {
  const c = state.cfg;
  const cf = state.custosFixos;

  // Calcular custo hora automaticamente
  const totalFixo = cf.reduce((s,x)=>s+(parseFloat(x.valor)||0),0);
  const horasMes  = parseFloat(c.prec_horas_mes)||176;
  const custoHora = horasMes > 0 ? (totalFixo / horasMes).toFixed(2) : "—";

  content.innerHTML = `
    <div class="cfg-section-title">📈 Precificação Avançada</div>
    <div class="cfg-hint">Configure os custos reais do seu negócio para o sistema calcular margens corretas automaticamente.</div>

    <!-- Custos Fixos Mensais -->
    <div class="cfg-card">
      <div class="cfg-section-header" style="margin-bottom:12px">
        <div class="cfg-card-title" style="margin:0">🏗️ Custos Fixos Mensais</div>
        <button class="btn-primary" id="btn-add-cf" style="padding:6px 14px;font-size:12px">+ Adicionar</button>
      </div>
      <div id="lista-cf">
        ${cf.map((item,i)=>`
          <div class="cf-item">
            <input class="cf-nome" data-cf-i="${i}" value="${esc(item.nome)}" placeholder="Nome do custo" />
            <div class="cf-valor-wrap">
              <span class="cf-moeda">R$</span>
              <input class="cf-valor" data-cf-i="${i}" type="number" min="0" step="0.01" value="${item.valor||0}" />
            </div>
            <button class="btn-icon danger" data-del-cf="${i}" style="padding:4px 9px">✕</button>
          </div>`).join("")}
      </div>
      <div class="cf-total">
        <span>Total de custos fixos mensais:</span>
        <strong id="cf-total-val">R$ ${fmtMoeda(totalFixo)}</strong>
      </div>
    </div>

    <!-- Horas e Custo/hora -->
    <div class="cfg-card">
      <div class="cfg-card-title">⏱️ Custo por Hora Trabalhada</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Horas trabalhadas por mês</label>
          <input id="prec-horas" type="number" min="1" value="${c.prec_horas_mes||176}" />
          <span class="cfg-hint" style="margin-top:4px">Padrão: 22 dias × 8h = 176h</span>
        </div>
        <div class="cfg-group">
          <label>Custo hora calculado automaticamente</label>
          <div class="custo-hora-display" id="custo-hora-calc">
            R$ ${custoHora} / hora
          </div>
          <span class="cfg-hint" style="margin-top:4px">= Custos fixos ÷ horas do mês</span>
        </div>
      </div>
    </div>

    <!-- Margens -->
    <div class="cfg-card">
      <div class="cfg-card-title">📊 Margens de Lucro</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>🔴 Margem Mínima (%)</label>
          <input id="prec-marg-min" type="number" min="0" max="100" step="0.5" value="${c.prec_margem_minima||20}" />
          <span class="cfg-hint" style="margin-top:4px">Abaixo disso: prejuízo ou risco</span>
        </div>
        <div class="cfg-group">
          <label>🟡 Margem Ideal (%)</label>
          <input id="prec-marg-ideal" type="number" min="0" max="100" step="0.5" value="${c.prec_margem_ideal||40}" />
          <span class="cfg-hint" style="margin-top:4px">Ponto de equilíbrio saudável</span>
        </div>
        <div class="cfg-group">
          <label>🟢 Margem Premium (%)</label>
          <input id="prec-marg-prem" type="number" min="0" max="100" step="0.5" value="${c.prec_margem_premium||60}" />
          <span class="cfg-hint" style="margin-top:4px">Clientes premium / urgente</span>
        </div>
        <div class="cfg-group">
          <label>Desconto máximo permitido (%)</label>
          <input id="prec-desc-max" type="number" min="0" max="100" step="0.5" value="${c.prec_desconto_max||10}" />
          <span class="cfg-hint" style="margin-top:4px">Vendedor não pode ultrapassar isso</span>
        </div>
      </div>
    </div>

    <!-- Taxas e Regras Automáticas -->
    <div class="cfg-card">
      <div class="cfg-card-title">⚙️ Regras e Taxas Automáticas</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Valor mínimo por pedido (R$)</label>
          <input id="prec-min-pedido" type="number" min="0" step="0.01" value="${c.prec_min_pedido||0}" placeholder="0,00" />
        </div>
        <div class="cfg-group">
          <label>Taxa de arte / criação (%)</label>
          <input id="prec-taxa-arte" type="number" min="0" step="0.5" value="${c.prec_taxa_arte||0}" placeholder="0" />
        </div>
        <div class="cfg-group">
          <label>Taxa de urgência (%)</label>
          <input id="prec-taxa-urg" type="number" min="0" step="0.5" value="${c.prec_taxa_urgencia||30}" placeholder="30" />
        </div>
        <div class="cfg-group">
          <label>Taxa de instalação (%)</label>
          <input id="prec-taxa-inst" type="number" min="0" step="0.5" value="${c.prec_taxa_instalacao||15}" placeholder="15" />
        </div>
      </div>
    </div>

    <!-- Depreciação -->
    <div class="cfg-card">
      <div class="cfg-card-title">📉 Depreciação de Equipamentos</div>
      <div class="cfg-hint">Defina o custo mensal estimado de depreciação das máquinas (valor de compra ÷ vida útil em meses).</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Depreciação mensal total (R$)</label>
          <input id="prec-deprec" type="number" min="0" step="0.01" value="${c.prec_depreciacao_mensal||0}" placeholder="0,00" />
        </div>
        <div class="cfg-group">
          <label>Custo de energia por hora (R$/h)</label>
          <input id="prec-energia-h" type="number" min="0" step="0.01" value="${c.prec_energia_hora||0}" placeholder="0,00" />
        </div>
      </div>
    </div>

    <div class="cfg-acoes">
      <button class="btn-primary" id="btn-salvar-prec">💾 Salvar configurações de precificação</button>
    </div>
  `;

  // Bind custos fixos
  content.querySelector("#btn-add-cf").addEventListener("click", () => {
    state.custosFixos.push({ nome:"", valor:0 });
    renderPrecificacao(content, container);
  });
  content.querySelectorAll(".cf-nome").forEach(inp => inp.addEventListener("input", () => {
    const i = parseInt(inp.dataset.cfI);
    state.custosFixos[i].nome = inp.value;
    atualizarTotalCF(content);
  }));
  content.querySelectorAll(".cf-valor").forEach(inp => inp.addEventListener("input", () => {
    const i = parseInt(inp.dataset.cfI);
    state.custosFixos[i].valor = parseFloat(inp.value)||0;
    atualizarTotalCF(content);
  }));
  content.querySelectorAll("[data-del-cf]").forEach(b => b.addEventListener("click", () => {
    state.custosFixos.splice(parseInt(b.dataset.delCf), 1);
    renderPrecificacao(content, container);
  }));

  // Recalcular custo hora ao mudar horas
  content.querySelector("#prec-horas").addEventListener("input", function() {
    const horas = parseFloat(this.value)||1;
    const total = state.custosFixos.reduce((s,x)=>s+(parseFloat(x.valor)||0),0);
    content.querySelector("#custo-hora-calc").textContent = `R$ ${(total/horas).toFixed(2)} / hora`;
  });

  content.querySelector("#btn-salvar-prec").addEventListener("click", async () => {
    await salvarCfg(container, {
      custos_fixos:           JSON.stringify(state.custosFixos),
      prec_horas_mes:         v("#prec-horas", content),
      prec_margem_minima:     v("#prec-marg-min", content),
      prec_margem_ideal:      v("#prec-marg-ideal", content),
      prec_margem_premium:    v("#prec-marg-prem", content),
      prec_desconto_max:      v("#prec-desc-max", content),
      prec_min_pedido:        v("#prec-min-pedido", content),
      prec_taxa_arte:         v("#prec-taxa-arte", content),
      prec_taxa_urgencia:     v("#prec-taxa-urg", content),
      prec_taxa_instalacao:   v("#prec-taxa-inst", content),
      prec_depreciacao_mensal:v("#prec-deprec", content),
      prec_energia_hora:      v("#prec-energia-h", content),
    }, content);
  });
}

function atualizarTotalCF(content) {
  const total = state.custosFixos.reduce((s,x)=>s+(parseFloat(x.valor)||0),0);
  const el = content.querySelector("#cf-total-val");
  if (el) el.textContent = `R$ ${fmtMoeda(total)}`;
  const horas = parseFloat(content.querySelector("#prec-horas")?.value)||176;
  const elH = content.querySelector("#custo-hora-calc");
  if (elH) elH.textContent = `R$ ${(total/horas).toFixed(2)} / hora`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: PRODUÇÃO
// ══════════════════════════════════════════════════════════════════════════════
function renderProducao(content, container) {
  const sub = state._sub_producao || "etapas";
  state._sub_producao = sub;
  const SUBS = [
    { key:"etapas",   label:"⚙️ Etapas de Produção" },
    { key:"maquinas", label:"🖨️ Máquinas"            },
  ];
  content.innerHTML = `
    <div class="cfg-section-title">🏭 Produção</div>
    <div class="sub-tabs">
      ${SUBS.map(s=>`<button class="sub-tab ${sub===s.key?"active":""}" data-sub="${s.key}">${s.label}</button>`).join("")}
    </div>
    <div id="sub-content"></div>
  `;
  content.querySelectorAll("[data-sub]").forEach(btn =>
    btn.addEventListener("click", ()=>{ state._sub_producao=btn.dataset.sub; renderProducao(content,container); })
  );
  const sc = content.querySelector("#sub-content");
  if (sub==="etapas")   renderEtapas(sc, container);
  if (sub==="maquinas") renderMaquinas(sc, container);
}

// ── Etapas ────────────────────────────────────────────────────────────────────
function renderEtapas(sc, container) {
  const et = state.etapasProducao;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <div>
        <span class="cfg-hint" style="margin:0">Defina as etapas do fluxo de produção. A ordem importa.</span>
      </div>
      <button class="btn-primary" id="btn-nova-et">+ Nova Etapa</button>
    </div>
    <div id="lista-etapas" style="margin-top:12px">
      ${et.sort((a,b)=>a.ordem-b.ordem).map((e,i)=>`
        <div class="etapa-row" data-et-i="${i}">
          <div class="etapa-ordem">
            <button class="btn-icon" data-up="${i}" ${i===0?"disabled":""}>▲</button>
            <span class="etapa-num">${e.ordem}</span>
            <button class="btn-icon" data-dn="${i}" ${i===et.length-1?"disabled":""}>▼</button>
          </div>
          <div class="etapa-cor" style="background:${esc(e.cor)};border-radius:8px;width:32px;height:32px;flex-shrink:0"></div>
          <div class="etapa-icone">${esc(e.icone)||"⚙️"}</div>
          <div class="etapa-info">
            <div class="etapa-nome">${esc(e.nome)}</div>
            <div class="etapa-hex" style="color:var(--muted);font-size:11px">${esc(e.cor)}</div>
          </div>
          <div class="tbl-acoes" style="margin-left:auto">
            <button class="btn-icon" data-edit-et="${i}">✏️ Editar</button>
            <button class="btn-icon danger" data-del-et="${i}">🗑</button>
          </div>
        </div>`).join("")}
    </div>
    <div class="cfg-acoes" style="margin-top:14px">
      <button class="btn-primary" id="btn-salvar-etapas">💾 Salvar ordem e etapas</button>
    </div>
  `;
  sc.querySelector("#btn-nova-et").addEventListener("click", () => abrirModalEtapa(container, null, sc));
  sc.querySelectorAll("[data-edit-et]").forEach(b => b.addEventListener("click", () => abrirModalEtapa(container, parseInt(b.dataset.editEt), sc)));
  sc.querySelectorAll("[data-del-et]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Remover esta etapa?")) return;
    state.etapasProducao.splice(parseInt(b.dataset.delEt),1);
    reordenarEtapas();
    await salvarJSON(container,"etapas_producao",state.etapasProducao);
    renderEtapas(sc, container);
  }));
  sc.querySelectorAll("[data-up]").forEach(b => b.addEventListener("click", async () => {
    const i = parseInt(b.dataset.up); if(i===0) return;
    [state.etapasProducao[i], state.etapasProducao[i-1]] = [state.etapasProducao[i-1], state.etapasProducao[i]];
    reordenarEtapas();
    await salvarJSON(container,"etapas_producao",state.etapasProducao);
    renderEtapas(sc, container);
  }));
  sc.querySelectorAll("[data-dn]").forEach(b => b.addEventListener("click", async () => {
    const i = parseInt(b.dataset.dn); if(i>=state.etapasProducao.length-1) return;
    [state.etapasProducao[i], state.etapasProducao[i+1]] = [state.etapasProducao[i+1], state.etapasProducao[i]];
    reordenarEtapas();
    await salvarJSON(container,"etapas_producao",state.etapasProducao);
    renderEtapas(sc, container);
  }));
  sc.querySelector("#btn-salvar-etapas").addEventListener("click", async () => {
    reordenarEtapas();
    await salvarJSON(container,"etapas_producao",state.etapasProducao);
    state.msg={tipo:"ok",texto:"Etapas salvas!"};
    render(container);
  });
}

function reordenarEtapas() {
  state.etapasProducao.forEach((e,i)=>{ e.ordem=i+1; });
}

function abrirModalEtapa(container, idx, sc) {
  const area = container.querySelector("#modal-area");
  const et = idx!==null ? state.etapasProducao[idx] : { cor:"#4dabf7", icone:"⚙️" };
  const editando = idx!==null;
  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando?"Editar":"Nova"} Etapa</h3>
        <label>Nome da etapa *</label>
        <input id="et-nome" value="${esc(et.nome)}" placeholder="Ex: Impressão, Acabamento..." autofocus />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label>Ícone (emoji)</label>
            <input id="et-icone" value="${esc(et.icone)||"⚙️"}" placeholder="⚙️" style="font-size:22px;text-align:center" />
          </div>
          <div>
            <label>Cor da etapa</label>
            <input id="et-cor" type="color" value="${esc(et.cor)||"#4dabf7"}" style="height:42px;width:100%;border-radius:8px;cursor:pointer" />
          </div>
        </div>
        <div class="modal-btns">
          <button class="btn-secondary" id="et-cancel">Cancelar</button>
          <button class="btn-primary"   id="et-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#et-cancel").addEventListener("click",()=>area.innerHTML="");
  area.querySelector("#modal-bg").addEventListener("click",e=>{if(e.target.id==="modal-bg")area.innerHTML="";});
  area.querySelector("#et-ok").addEventListener("click", async () => {
    const nome = area.querySelector("#et-nome").value.trim();
    if (!nome) { alert("Informe o nome."); return; }
    const dados = {
      nome,
      icone: area.querySelector("#et-icone").value.trim()||"⚙️",
      cor:   area.querySelector("#et-cor").value,
      ordem: editando ? et.ordem : state.etapasProducao.length+1,
    };
    if (editando) state.etapasProducao[idx] = dados;
    else state.etapasProducao.push(dados);
    area.innerHTML="";
    await salvarJSON(container,"etapas_producao",state.etapasProducao);
    state.msg={tipo:"ok",texto:editando?"Etapa atualizada!":"Etapa adicionada!"};
    render(container);
  });
}

// ── Máquinas ──────────────────────────────────────────────────────────────────
function renderMaquinas(sc, container) {
  const mq = state.maquinasProducao;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <span class="cfg-hint" style="margin:0">Cadastre as máquinas com custo/hora para precificação automática.</span>
      <button class="btn-primary" id="btn-nova-mq">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
      ${mq.length===0 ? `<div class="cfg-vazio">Nenhuma máquina cadastrada.</div>`
      : `<table class="cfg-table">
          <thead><tr><th>Nome</th><th>Tipo</th><th>Largura máx.</th><th>Velocidade</th><th>Custo/h</th><th></th></tr></thead>
          <tbody>${mq.map((m,i)=>`
            <tr>
              <td><strong>${esc(m.nome)}</strong></td>
              <td><span class="tag-cargo">${esc(m.tipo)||"—"}</span></td>
              <td>${m.largura_max?m.largura_max+"m":"—"}</td>
              <td>${m.velocidade?m.velocidade+" m²/h":"—"}</td>
              <td>R$ ${fmtMoeda(m.custo_hora)}/h</td>
              <td class="tbl-acoes">
                <button class="btn-icon" data-edit-mq="${i}">✏️</button>
                <button class="btn-icon danger" data-del-mq="${i}">🗑</button>
              </td>
            </tr>`).join("")}</tbody>
        </table>`}
    </div>`;
  sc.querySelector("#btn-nova-mq").addEventListener("click",()=>abrirModalMQ(container,null,sc));
  sc.querySelectorAll("[data-edit-mq]").forEach(b=>b.addEventListener("click",()=>abrirModalMQ(container,parseInt(b.dataset.editMq),sc)));
  sc.querySelectorAll("[data-del-mq]").forEach(b=>b.addEventListener("click",async()=>{
    const i=parseInt(b.dataset.delMq);
    if(!confirm(`Remover "${state.maquinasProducao[i]?.nome}"?`))return;
    state.maquinasProducao.splice(i,1);
    await salvarJSON(container,"maquinas_producao",state.maquinasProducao);
    renderMaquinas(sc,container);
  }));
}

function abrirModalMQ(container,idx,sc){
  const area=container.querySelector("#modal-area");
  const m=idx!==null?state.maquinasProducao[idx]:{};
  const editando=idx!==null;
  const TIPOS=["Impressora UV","Plotter de Recorte","Plotter de Impressão","Laser","Router CNC","Laminadora","Outro"];
  area.innerHTML=`
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando?"Editar":"Nova"} Máquina</h3>
        <label>Nome *</label>
        <input id="mq-nome" value="${esc(m.nome)}" placeholder="Ex: Plotter Roland SP-300" autofocus />
        <label>Tipo</label>
        <select id="mq-tipo">${TIPOS.map(t=>`<option value="${t}" ${m.tipo===t?"selected":""}>${t}</option>`).join("")}</select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label>Largura máxima (m)</label><input id="mq-larg" type="number" min="0" step="0.01" value="${m.largura_max||""}" placeholder="1.60" /></div>
          <div><label>Velocidade (m²/h)</label><input id="mq-vel" type="number" min="0" step="0.1" value="${m.velocidade||""}" placeholder="20" /></div>
          <div><label>Custo por hora (R$)</label><input id="mq-ch" type="number" min="0" step="0.01" value="${m.custo_hora||""}" placeholder="15,00" /></div>
          <div><label>Consumo (kW/h)</label><input id="mq-kw" type="number" min="0" step="0.01" value="${m.consumo_kw||""}" placeholder="2.5" /></div>
        </div>
        <div class="modal-btns">
          <button class="btn-secondary" id="mq-cancel">Cancelar</button>
          <button class="btn-primary"   id="mq-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#mq-cancel").addEventListener("click",()=>area.innerHTML="");
  area.querySelector("#modal-bg").addEventListener("click",e=>{if(e.target.id==="modal-bg")area.innerHTML="";});
  area.querySelector("#mq-ok").addEventListener("click",async()=>{
    const nome=area.querySelector("#mq-nome").value.trim();
    if(!nome){alert("Informe o nome.");return;}
    const dados={
      nome,
      tipo:        area.querySelector("#mq-tipo").value,
      largura_max: parseFloat(area.querySelector("#mq-larg").value)||null,
      velocidade:  parseFloat(area.querySelector("#mq-vel").value)||null,
      custo_hora:  parseFloat(area.querySelector("#mq-ch").value)||0,
      consumo_kw:  parseFloat(area.querySelector("#mq-kw").value)||null,
    };
    if(editando) state.maquinasProducao[idx]=dados;
    else state.maquinasProducao.push(dados);
    area.innerHTML="";
    await salvarJSON(container,"maquinas_producao",state.maquinasProducao);
    state.msg={tipo:"ok",texto:editando?"Máquina atualizada!":"Máquina adicionada!"};
    render(container);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: ORÇAMENTOS
// ══════════════════════════════════════════════════════════════════════════════
function renderOrcamentos(content, container) {
  const c = state.cfg;
  content.innerHTML = `
    <div class="cfg-section-title">🧾 Configurações de Orçamentos</div>

    <div class="cfg-card">
      <div class="cfg-card-title">🔢 Numeração Automática</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Prefixo</label>
          <input id="orc-pref" value="${esc(c.orc_prefixo||"ORC")}" placeholder="ORC" />
        </div>
        <div class="cfg-group">
          <label>Número inicial</label>
          <input id="orc-num-ini" type="number" min="1" value="${c.orc_numero_inicial||1}" />
        </div>
        <div class="cfg-group full">
          <label>Exemplo de numeração:</label>
          <div id="orc-preview" class="custo-hora-display">${esc(c.orc_prefixo||"ORC")}-${String(c.orc_numero_inicial||1).padStart(4,"0")}</div>
        </div>
      </div>
    </div>

    <div class="cfg-card">
      <div class="cfg-card-title">⏱️ Validade e Prazos</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Validade padrão (dias)</label>
          <input id="orc-valid" type="number" min="1" value="${c.orc_validade_dias||10}" />
        </div>
        <div class="cfg-group">
          <label>Prazo de produção padrão (dias úteis)</label>
          <input id="orc-prazo-prod" type="number" min="1" value="${c.orc_prazo_producao||3}" />
        </div>
      </div>
    </div>

    <div class="cfg-card">
      <div class="cfg-card-title">📝 Modelo e Mensagens Padrão</div>
      <div class="cfg-grid">
        <div class="cfg-group full">
          <label>Observações padrão (pré-preenchidas em todo orçamento)</label>
          <textarea id="orc-obs" rows="3" placeholder="Ex: Aprovação de arte obrigatória. Arte em baixa resolução gera custo adicional.">${esc(c.orc_obs_padrao)}</textarea>
        </div>
        <div class="cfg-group full">
          <label>Texto de garantia</label>
          <textarea id="orc-garantia" rows="2" placeholder="Ex: Garantia de 90 dias para defeitos de fabricação.">${esc(c.orc_garantia)}</textarea>
        </div>
        <div class="cfg-group full">
          <label>Mensagem de rodapé</label>
          <textarea id="orc-rodape" rows="2" placeholder="Ex: Agradecemos a preferência! Dúvidas pelo WhatsApp.">${esc(c.orc_rodape)}</textarea>
        </div>
      </div>
    </div>

    <div class="cfg-acoes">
      <button class="btn-primary" id="btn-salvar-orc">💾 Salvar configurações de orçamento</button>
    </div>
  `;

  // Preview ao vivo
  const prev = () => {
    const pref  = content.querySelector("#orc-pref")?.value||"ORC";
    const num   = content.querySelector("#orc-num-ini")?.value||"1";
    const el    = content.querySelector("#orc-preview");
    if (el) el.textContent = `${pref}-${String(num).padStart(4,"0")}`;
  };
  content.querySelector("#orc-pref").addEventListener("input", prev);
  content.querySelector("#orc-num-ini").addEventListener("input", prev);

  content.querySelector("#btn-salvar-orc").addEventListener("click", async () => {
    await salvarCfg(container, {
      orc_prefixo:       v("#orc-pref",content),
      orc_numero_inicial: v("#orc-num-ini",content),
      orc_validade_dias:  v("#orc-valid",content),
      orc_prazo_producao: v("#orc-prazo-prod",content),
      orc_obs_padrao:     v("#orc-obs",content),
      orc_garantia:       v("#orc-garantia",content),
      orc_rodape:         v("#orc-rodape",content),
    }, content);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: VENDEDORES (sem alterações)
// ══════════════════════════════════════════════════════════════════════════════
function renderVendedores(content, container) {
  content.innerHTML = `
    <div class="cfg-section-header">
      <div class="cfg-section-title">👤 Vendedores / Usuários</div>
      <button class="btn-primary" id="btn-novo-vend">+ Novo Vendedor</button>
    </div>
    <div class="cfg-card" style="padding:0;overflow:hidden">
      ${state.vendedores.length === 0
        ? `<div class="cfg-vazio">Nenhum vendedor cadastrado ainda.</div>`
        : `<table class="cfg-table">
            <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Cargo</th><th>Status</th><th></th></tr></thead>
            <tbody>${state.vendedores.map(vd=>`
              <tr>
                <td><strong>${esc(vd.nome)}</strong></td>
                <td>${esc(vd.telefone)||"—"}</td>
                <td>${esc(vd.email)||"—"}</td>
                <td><span class="tag-cargo">${esc(vd.cargo)||"Vendedor"}</span></td>
                <td><span class="tag-status ${vd.ativo!==false?"ativo":"inativo"}">${vd.ativo!==false?"● Ativo":"○ Inativo"}</span></td>
                <td class="tbl-acoes">
                  <button class="btn-icon" data-edit-vend="${vd.id}">✏️ Editar</button>
                  <button class="btn-icon danger" data-del-vend="${vd.id}" data-del-nome="${esc(vd.nome)}">🗑</button>
                </td>
              </tr>`).join("")}</tbody>
          </table>`}
    </div>`;
  content.querySelector("#btn-novo-vend").addEventListener("click",()=>abrirModalVendedor(container,{}));
  content.querySelectorAll("[data-edit-vend]").forEach(btn=>{
    const vd=state.vendedores.find(v=>v.id===btn.dataset.editVend);
    btn.addEventListener("click",()=>abrirModalVendedor(container,vd));
  });
  content.querySelectorAll("[data-del-vend]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm(`Remover "${btn.dataset.delNome}"?`))return;
    await supabase.from("vendedores").delete().eq("id",btn.dataset.delVend);
    await recarregar(container);
    state.msg={tipo:"ok",texto:"Vendedor removido."};
    render(container);
  }));
}

function abrirModalVendedor(container, vd={}) {
  const area=container.querySelector("#modal-area");
  const editando=!!vd.id;
  area.innerHTML=`
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando?"Editar Vendedor":"Novo Vendedor"}</h3>
        <label>Nome *</label><input id="mv-nome" value="${esc(vd.nome)}" autofocus />
        <label>Cargo / Função</label><input id="mv-cargo" value="${esc(vd.cargo)}" placeholder="Vendedor, Gerente..." />
        <label>Telefone / WhatsApp</label><input id="mv-tel" value="${esc(vd.telefone)}" placeholder="(11) 99999-9999" />
        <label>E-mail</label><input id="mv-email" type="email" value="${esc(vd.email)}" />
        <label>Status</label>
        <select id="mv-ativo">
          <option value="true" ${vd.ativo!==false?"selected":""}>● Ativo</option>
          <option value="false" ${vd.ativo===false?"selected":""}>○ Inativo</option>
        </select>
        <div class="modal-btns">
          <button class="btn-secondary" id="mv-cancel">Cancelar</button>
          <button class="btn-primary"   id="mv-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#mv-cancel").addEventListener("click",()=>area.innerHTML="");
  area.querySelector("#modal-bg").addEventListener("click",e=>{if(e.target.id==="modal-bg")area.innerHTML="";});
  area.querySelector("#mv-ok").addEventListener("click",async()=>{
    const nome=area.querySelector("#mv-nome").value.trim();
    if(!nome){alert("Informe o nome.");return;}
    const payload={
      nome,
      cargo:    area.querySelector("#mv-cargo").value.trim()||null,
      telefone: area.querySelector("#mv-tel").value.trim()||null,
      email:    area.querySelector("#mv-email").value.trim()||null,
      ativo:    area.querySelector("#mv-ativo").value==="true",
    };
    if(editando) await supabase.from("vendedores").update(payload).eq("id",vd.id);
    else         await supabase.from("vendedores").insert(payload);
    area.innerHTML="";
    state.msg={tipo:"ok",texto:editando?"Vendedor atualizado!":"Vendedor cadastrado!"};
    await recarregar(container);
    render(container);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: IMPRESSÃO
// ══════════════════════════════════════════════════════════════════════════════
function renderImpressao(content, container) {
  const c=state.cfg;
  content.innerHTML=`
    <div class="cfg-section-title">🖨️ Configurações de Impressão</div>
    <div class="cfg-hint">Defina o que aparece nos documentos impressos — orçamentos, vendas e ordens de serviço.</div>
    <div class="cfg-card">
      <div class="cfg-card-title">⚙️ Geral</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Tamanho do papel</label>
          <select id="imp-papel">${["A4","A5","Letter"].map(p=>`<option value="${p}" ${(c.imp_papel||"A4")===p?"selected":""}>${p}</option>`).join("")}</select>
        </div>
        <div class="cfg-group">
          <label>Orientação</label>
          <select id="imp-orient">
            <option value="retrato"  ${(c.imp_orientacao||"retrato")==="retrato"?"selected":""}>Retrato</option>
            <option value="paisagem" ${c.imp_orientacao==="paisagem"?"selected":""}>Paisagem</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Exibir logo?</label>
          <select id="imp-logo">
            <option value="sim" ${(c.imp_mostrar_logo||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.imp_mostrar_logo==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Exibir dados da empresa?</label>
          <select id="imp-dados-emp">
            <option value="sim" ${(c.imp_mostrar_empresa||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.imp_mostrar_empresa==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
        <div class="cfg-group full"><label>Cabeçalho personalizado</label><textarea id="imp-cabecalho" rows="2">${esc(c.imp_cabecalho)}</textarea></div>
        <div class="cfg-group full"><label>Rodapé personalizado</label><textarea id="imp-rodape-imp" rows="2">${esc(c.imp_rodape)}</textarea></div>
      </div>
    </div>
    <div class="cfg-card">
      <div class="cfg-card-title">📋 Orçamento</div>
      <div class="cfg-grid">
        <div class="cfg-group full"><label>Título do documento</label><input id="imp-orc-titulo" value="${esc(c.imp_orc_titulo)||"ORÇAMENTO"}" /></div>
        <div class="cfg-group full"><label>Observações padrão</label><textarea id="imp-orc-obs" rows="3">${esc(c.imp_orc_obs)}</textarea></div>
        <div class="cfg-group">
          <label>Exibir custo de produção?</label>
          <select id="imp-orc-custo">
            <option value="nao" ${(c.imp_orc_custo||"nao")==="nao"?"selected":""}>❌ Não (recomendado)</option>
            <option value="sim" ${c.imp_orc_custo==="sim"?"selected":""}>✅ Sim</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Exibir margem?</label>
          <select id="imp-orc-margem">
            <option value="nao" ${(c.imp_orc_margem||"nao")==="nao"?"selected":""}>❌ Não</option>
            <option value="sim" ${c.imp_orc_margem==="sim"?"selected":""}>✅ Sim</option>
          </select>
        </div>
      </div>
    </div>
    <div class="cfg-card">
      <div class="cfg-card-title">📄 Ordem de Serviço</div>
      <div class="cfg-grid">
        <div class="cfg-group full"><label>Título do documento</label><input id="imp-os-titulo" value="${esc(c.imp_os_titulo)||"ORDEM DE SERVIÇO"}" /></div>
        <div class="cfg-group full"><label>Observações padrão</label><textarea id="imp-os-obs" rows="3">${esc(c.imp_os_obs)}</textarea></div>
        <div class="cfg-group">
          <label>Exibir assinatura?</label>
          <select id="imp-os-assin">
            <option value="sim" ${(c.imp_os_assinatura||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.imp_os_assinatura==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Exibir data de entrega?</label>
          <select id="imp-os-data">
            <option value="sim" ${(c.imp_os_data_entrega||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.imp_os_data_entrega==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
      </div>
    </div>
    <div class="cfg-acoes">
      <button class="btn-primary" id="btn-salvar-imp">💾 Salvar configurações de impressão</button>
    </div>
  `;
  content.querySelector("#btn-salvar-imp").addEventListener("click",async()=>{
    await salvarCfg(container,{
      imp_papel:           v("#imp-papel",content),
      imp_orientacao:      v("#imp-orient",content),
      imp_cabecalho:       v("#imp-cabecalho",content),
      imp_rodape:          v("#imp-rodape-imp",content),
      imp_mostrar_logo:    v("#imp-logo",content),
      imp_mostrar_empresa: v("#imp-dados-emp",content),
      imp_orc_titulo:      v("#imp-orc-titulo",content),
      imp_orc_obs:         v("#imp-orc-obs",content),
      imp_orc_custo:       v("#imp-orc-custo",content),
      imp_orc_margem:      v("#imp-orc-margem",content),
      imp_os_titulo:       v("#imp-os-titulo",content),
      imp_os_obs:          v("#imp-os-obs",content),
      imp_os_assinatura:   v("#imp-os-assin",content),
      imp_os_data_entrega: v("#imp-os-data",content),
    },content);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: INTEGRAÇÕES
// ══════════════════════════════════════════════════════════════════════════════
function renderIntegracoes(content, container) {
  const sub = state._sub_integ || "trello";
  state._sub_integ = sub;
  const SUBS = [
    { key:"trello",  label:"🔗 Trello"        },
    { key:"supabase",label:"🗄️ Supabase"      },
    { key:"mpago",   label:"💳 Mercado Pago"   },
  ];
  content.innerHTML = `
    <div class="cfg-section-title">🔗 Integrações</div>
    <div class="sub-tabs">
      ${SUBS.map(s=>`<button class="sub-tab ${sub===s.key?"active":""}" data-sub="${s.key}">${s.label}</button>`).join("")}
    </div>
    <div id="sub-content"></div>
  `;
  content.querySelectorAll("[data-sub]").forEach(btn=>
    btn.addEventListener("click",()=>{ state._sub_integ=btn.dataset.sub; renderIntegracoes(content,container); })
  );
  const sc = content.querySelector("#sub-content");
  if (sub==="trello")   renderTrello(sc, container);
  if (sub==="supabase") renderSupabase(sc, container);
  if (sub==="mpago")    renderMercadoPago(sc, container);
}

function renderTrello(sc, container) {
  const c=state.cfg;
  const temCredenciais=c.trello_api_key&&c.trello_token;
  const temConfig=temCredenciais&&c.trello_board_id;
  sc.innerHTML=`
    <div class="cfg-hint" style="margin-top:14px">
      Sincronize pedidos com cards do Trello automaticamente.
      API Key em <a href="https://trello.com/power-ups/admin" target="_blank" style="color:var(--accent)">trello.com/power-ups/admin</a>.
    </div>
    ${temConfig?`<div class="trello-ok">✅ Trello configurado e ativo.</div>`:`<div class="trello-warn">⚠️ Configure as credenciais abaixo.</div>`}
    <div class="cfg-card">
      <div class="cfg-card-title">🔑 Credenciais</div>
      <div class="cfg-grid">
        <div class="cfg-group"><label>API Key</label><input id="t-key" type="password" value="${esc(c.trello_api_key)}" /></div>
        <div class="cfg-group"><label>Token</label><input id="t-token" type="password" value="${esc(c.trello_token)}" /></div>
      </div>
      <div class="cfg-acoes" style="margin-top:10px">
        <button class="btn-primary" id="btn-carregar-quadros">🔄 Carregar Quadros</button>
      </div>
    </div>
    <div class="cfg-card" id="card-quadros" style="${temCredenciais?"":"display:none"}">
      <div class="cfg-card-title">📋 Quadro</div>
      <div class="cfg-group full">
        <label>Quadro do Trello</label>
        <select id="t-board">
          <option value="">Clique em "Carregar Quadros"...</option>
          ${c.trello_board_id?`<option value="${esc(c.trello_board_id)}" selected>Quadro atual: ${esc(c.trello_board_id)}</option>`:""}
        </select>
      </div>
      <div class="cfg-acoes" style="margin-top:10px">
        <button class="btn-primary" id="btn-carregar-listas" ${c.trello_board_id?"":"disabled"}>📋 Carregar Listas</button>
      </div>
    </div>
    <div class="cfg-card" id="card-listas" style="${c.trello_board_id?"":"display:none"}">
      <div class="cfg-card-title">📋 Mapeamento de Etapas → Listas</div>
      <div class="cfg-grid">
        <div class="cfg-group"><label>⏳ Fila</label><select id="t-l1"><option value="${esc(c.trello_list_fila||"")}">Carregue as listas...</option></select></div>
        <div class="cfg-group"><label>🖨️ Imprimindo</label><select id="t-l2"><option value="${esc(c.trello_list_imprimindo||"")}">Carregue as listas...</option></select></div>
        <div class="cfg-group"><label>✂️ Acabamento</label><select id="t-l3"><option value="${esc(c.trello_list_acabamento||"")}">Carregue as listas...</option></select></div>
        <div class="cfg-group"><label>✅ Pronto</label><select id="t-l4"><option value="${esc(c.trello_list_pronto||"")}">Carregue as listas...</option></select></div>
      </div>
    </div>
    <div class="cfg-acoes" style="gap:10px">
      <button class="btn-primary" id="btn-salvar-trello">💾 Salvar Trello</button>
      ${temConfig?`<button class="btn-danger" id="btn-limpar-trello">🗑 Remover integração</button>`:""}
    </div>
  `;
  sc.querySelector("#btn-carregar-quadros").addEventListener("click",async()=>{
    const key=sc.querySelector("#t-key").value.trim();
    const token=sc.querySelector("#t-token").value.trim();
    if(!key||!token){alert("Preencha API Key e Token.");return;}
    const btn=sc.querySelector("#btn-carregar-quadros");
    btn.textContent="⏳ Carregando...";btn.disabled=true;
    try{
      const res=await fetch(`https://api.trello.com/1/members/me/boards?key=${key}&token=${token}&filter=open&fields=id,name`);
      if(!res.ok) throw new Error("Credenciais inválidas.");
      const boards=await res.json();
      const sel=sc.querySelector("#t-board");
      sel.innerHTML=`<option value="">Selecione um quadro...</option>`+boards.map(b=>`<option value="${b.id}" ${b.id===c.trello_board_id?"selected":""}>${b.name}</option>`).join("");
      sc.querySelector("#card-quadros").style.display="";
      sc.querySelector("#btn-carregar-listas").disabled=false;
      if(c.trello_board_id) await carregarListas(key,token,c.trello_board_id,sc,c);
    }catch(err){alert("Erro: "+err.message);}
    finally{btn.textContent="🔄 Carregar Quadros";btn.disabled=false;}
  });
  sc.querySelector("#btn-carregar-listas").addEventListener("click",async()=>{
    const key=sc.querySelector("#t-key").value.trim();
    const token=sc.querySelector("#t-token").value.trim();
    const boardId=sc.querySelector("#t-board").value;
    if(!boardId){alert("Selecione um quadro.");return;}
    await carregarListas(key,token,boardId,sc,c);
  });
  sc.querySelector("#btn-salvar-trello").addEventListener("click",async()=>{
    await salvarCfg(container,{
      trello_api_key:         sc.querySelector("#t-key").value.trim()||null,
      trello_token:           sc.querySelector("#t-token").value.trim()||null,
      trello_board_id:        sc.querySelector("#t-board").value||null,
      trello_list_fila:       sc.querySelector("#t-l1").value||null,
      trello_list_imprimindo: sc.querySelector("#t-l2").value||null,
      trello_list_acabamento: sc.querySelector("#t-l3").value||null,
      trello_list_pronto:     sc.querySelector("#t-l4").value||null,
    },sc);
  });
  sc.querySelector("#btn-limpar-trello")?.addEventListener("click",async()=>{
    if(!confirm("Remover integração com Trello?"))return;
    await salvarCfg(container,{
      trello_api_key:null,trello_token:null,trello_board_id:null,
      trello_list_fila:null,trello_list_imprimindo:null,trello_list_acabamento:null,trello_list_pronto:null,
    },sc);
  });
}

function renderSupabase(sc, container) {
  const c=state.cfg;
  sc.innerHTML=`
    <div class="cfg-hint" style="margin-top:14px">Configurações da conexão com o Supabase.</div>
    <div class="cfg-card">
      <div class="cfg-card-title">🗄️ Conexão Supabase</div>
      <div class="cfg-grid">
        <div class="cfg-group full"><label>URL do projeto</label><input id="sb-url" value="${esc(c.supabase_url)}" placeholder="https://xxxx.supabase.co" /></div>
        <div class="cfg-group full"><label>API Key (anon / public)</label><input id="sb-key" type="password" value="${esc(c.supabase_anon_key)}" placeholder="eyJ..." /></div>
      </div>
      <div class="cfg-acoes" style="margin-top:10px">
        <button class="btn-primary" id="btn-salvar-sb">💾 Salvar configurações Supabase</button>
      </div>
    </div>`;
  sc.querySelector("#btn-salvar-sb").addEventListener("click",async()=>{
    await salvarCfg(container,{
      supabase_url:      sc.querySelector("#sb-url").value.trim()||null,
      supabase_anon_key: sc.querySelector("#sb-key").value.trim()||null,
    },sc);
  });
}

function renderMercadoPago(sc, container) {
  const c=state.cfg;
  sc.innerHTML=`
    <div class="cfg-hint" style="margin-top:14px">Configure o Mercado Pago para receber pagamentos via PIX e cartão.</div>
    <div class="cfg-card">
      <div class="cfg-card-title">💳 Mercado Pago</div>
      <div class="cfg-grid">
        <div class="cfg-group full"><label>Access Token</label><input id="mp-token" type="password" value="${esc(c.mp_access_token)}" placeholder="APP_USR-..." /></div>
        <div class="cfg-group full"><label>Webhook URL (para receber notificações)</label><input id="mp-webhook" value="${esc(c.mp_webhook_url)}" placeholder="https://seu-sistema.com/webhook/mp" /></div>
        <div class="cfg-group"><label>Chave PIX</label><input id="mp-pix" value="${esc(c.mp_pix_chave)}" placeholder="CPF, CNPJ, email ou chave aleatória" /></div>
        <div class="cfg-group">
          <label>Gerar QR Code automático?</label>
          <select id="mp-qr">
            <option value="sim" ${(c.mp_qr_auto||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.mp_qr_auto==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
      </div>
      <div class="cfg-acoes" style="margin-top:10px">
        <button class="btn-primary" id="btn-salvar-mp">💾 Salvar configurações Mercado Pago</button>
      </div>
    </div>`;
  sc.querySelector("#btn-salvar-mp").addEventListener("click",async()=>{
    await salvarCfg(container,{
      mp_access_token: sc.querySelector("#mp-token").value.trim()||null,
      mp_webhook_url:  sc.querySelector("#mp-webhook").value.trim()||null,
      mp_pix_chave:    sc.querySelector("#mp-pix").value.trim()||null,
      mp_qr_auto:      sc.querySelector("#mp-qr").value,
    },sc);
  });
}

async function carregarListas(key,token,boardId,content,cfgAtual){
  const btn=content.querySelector("#btn-carregar-listas");
  if(btn){btn.textContent="⏳ Carregando...";btn.disabled=true;}
  try{
    const res=await fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${key}&token=${token}&filter=open&fields=id,name`);
    if(!res.ok) throw new Error("Não foi possível carregar listas.");
    const listas=await res.json();
    const IDS=["t-l1","t-l2","t-l3","t-l4"];
    const VALS=[cfgAtual.trello_list_fila,cfgAtual.trello_list_imprimindo,cfgAtual.trello_list_acabamento,cfgAtual.trello_list_pronto];
    IDS.forEach((id,i)=>{
      const sel=content.querySelector(`#${id}`);
      if(!sel)return;
      sel.innerHTML=`<option value="">Selecione...</option>`+listas.map(l=>`<option value="${l.id}" ${l.id===VALS[i]?"selected":""}>${l.name}</option>`).join("");
    });
    content.querySelector("#card-listas").style.display="";
  }catch(err){alert("Erro ao carregar listas: "+err.message);}
  finally{if(btn){btn.textContent="📋 Carregar Listas";btn.disabled=false;}}
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: PRODUTOS E SERVIÇOS
// ══════════════════════════════════════════════════════════════════════════════
function renderProdutos(content, container) {
  const sub = state._sub_produtos || "categorias";
  state._sub_produtos = sub;
  const SUBS = [
    { key:"categorias", label:"📂 Categorias"       },
    { key:"unidades",   label:"📐 Unidades"          },
    { key:"tabelas",    label:"💲 Tabelas de Preço"  },
    { key:"formulas",   label:"🧮 Fórmulas"          },
  ];
  content.innerHTML = `
    <div class="cfg-section-title">📦 Produtos e Serviços</div>
    <div class="sub-tabs">
      ${SUBS.map(s=>`<button class="sub-tab ${sub===s.key?"active":""}" data-sub="${s.key}">${s.label}</button>`).join("")}
    </div>
    <div id="sub-content"></div>
  `;
  content.querySelectorAll("[data-sub]").forEach(btn=>
    btn.addEventListener("click",()=>{ state._sub_produtos=btn.dataset.sub; renderProdutos(content,container); })
  );
  const sc = content.querySelector("#sub-content");
  if (sub==="categorias") renderCategoriasProdutos(sc, container);
  if (sub==="unidades")   renderUnidadesProdutos(sc, container);
  if (sub==="tabelas")    renderTabelasPreco(sc, container);
  if (sub==="formulas")   renderFormulas(sc, container);
}

function renderCategoriasProdutos(sc, container) {
  const cats = state.categoriasProdutos;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <span class="cfg-hint" style="margin:0">Categorias usadas no cadastro de produtos/serviços.</span>
      <button class="btn-primary" id="btn-add-catprod" style="padding:6px 14px;font-size:12px">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:14px">
      <div id="lista-catprod">
        ${cats.map((c,i)=>`
          <div class="categ-item">
            <span>${esc(c)}</span>
            <button class="btn-icon danger" data-del-catprod="${i}" style="padding:2px 7px;font-size:11px">✕</button>
          </div>`).join("") || `<div class="cfg-vazio" style="padding:12px">Sem categorias.</div>`}
      </div>
    </div>`;
  sc.querySelector("#btn-add-catprod").addEventListener("click", async () => {
    const nome = prompt("Nome da categoria de produto:");
    if (!nome?.trim()) return;
    state.categoriasProdutos.push(nome.trim());
    await salvarJSON(container,"categorias_produtos",state.categoriasProdutos);
    renderCategoriasProdutos(sc, container);
  });
  sc.querySelectorAll("[data-del-catprod]").forEach(b => b.addEventListener("click", async () => {
    state.categoriasProdutos.splice(parseInt(b.dataset.delCatprod), 1);
    await salvarJSON(container,"categorias_produtos",state.categoriasProdutos);
    renderCategoriasProdutos(sc, container);
  }));
}

function renderUnidadesProdutos(sc, container) {
  const uns = state.unidadesProdutos;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <span class="cfg-hint" style="margin:0">Unidades de medida disponíveis ao cadastrar produtos.</span>
      <button class="btn-primary" id="btn-add-un" style="padding:6px 14px;font-size:12px">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
      <table class="cfg-table">
        <thead><tr><th>Sigla</th><th>Nome</th><th></th></tr></thead>
        <tbody>${uns.map((u,i)=>`
          <tr>
            <td><strong>${esc(u.sigla)}</strong></td>
            <td>${esc(u.nome)}</td>
            <td class="tbl-acoes"><button class="btn-icon danger" data-del-un="${i}">🗑</button></td>
          </tr>`).join("") || `<tr><td colspan="3" class="cfg-vazio">Sem unidades.</td></tr>`}
        </tbody>
      </table>
    </div>`;
  sc.querySelector("#btn-add-un").addEventListener("click", () => {
    const area = container.querySelector("#modal-area");
    area.innerHTML = `
      <div class="modal-bg" id="modal-bg">
        <div class="modal">
          <h3>Nova Unidade</h3>
          <label>Sigla *</label>
          <input id="un-sigla" placeholder="Ex: m², un, kg..." autofocus style="text-transform:lowercase" />
          <label>Nome completo *</label>
          <input id="un-nome" placeholder="Ex: Metro quadrado, Unidade..." />
          <div class="modal-btns">
            <button class="btn-secondary" id="un-cancel">Cancelar</button>
            <button class="btn-primary" id="un-ok">Salvar</button>
          </div>
        </div>
      </div>`;
    area.querySelector("#un-cancel").addEventListener("click",()=>area.innerHTML="");
    area.querySelector("#modal-bg").addEventListener("click",e=>{if(e.target.id==="modal-bg")area.innerHTML="";});
    area.querySelector("#un-ok").addEventListener("click",async()=>{
      const sigla=area.querySelector("#un-sigla").value.trim();
      const nome=area.querySelector("#un-nome").value.trim();
      if(!sigla||!nome){alert("Preencha sigla e nome.");return;}
      state.unidadesProdutos.push({sigla,nome});
      area.innerHTML="";
      await salvarJSON(container,"unidades_produtos",state.unidadesProdutos);
      state.msg={tipo:"ok",texto:"Unidade adicionada!"};
      render(container);
    });
  });
  sc.querySelectorAll("[data-del-un]").forEach(b=>b.addEventListener("click",async()=>{
    state.unidadesProdutos.splice(parseInt(b.dataset.delUn),1);
    await salvarJSON(container,"unidades_produtos",state.unidadesProdutos);
    renderUnidadesProdutos(sc,container);
  }));
}

function renderTabelasPreco(sc, container) {
  const tb = state.tabelasPreco;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <div>
        <div style="font-size:13px;font-weight:600;margin-bottom:2px">Tabelas de preço por perfil de cliente</div>
        <div class="cfg-hint" style="margin:0">O multiplicador é aplicado sobre o preço base do produto.</div>
      </div>
      <button class="btn-primary" id="btn-add-tb" style="padding:6px 14px;font-size:12px">+ Adicionar</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:12px">
      ${tb.map((t,i)=>`
        <div class="cfg-card" style="padding:14px;position:relative">
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">${esc(t.nome)}</div>
          <div style="font-size:28px;font-weight:800;color:var(--accent)">${(t.multiplicador*100).toFixed(0)}%</div>
          <div class="cfg-hint" style="margin:4px 0 8px">do preço base</div>
          <div style="display:flex;gap:6px">
            <button class="btn-icon" data-edit-tb="${i}" style="flex:1;justify-content:center">✏️ Editar</button>
            <button class="btn-icon danger" data-del-tb="${i}">🗑</button>
          </div>
        </div>`).join("")}
    </div>`;
  sc.querySelector("#btn-add-tb").addEventListener("click",()=>abrirModalTabela(container,null,sc));
  sc.querySelectorAll("[data-edit-tb]").forEach(b=>b.addEventListener("click",()=>abrirModalTabela(container,parseInt(b.dataset.editTb),sc)));
  sc.querySelectorAll("[data-del-tb]").forEach(b=>b.addEventListener("click",async()=>{
    if(!confirm(`Remover tabela "${state.tabelasPreco[parseInt(b.dataset.delTb)]?.nome}"?`))return;
    state.tabelasPreco.splice(parseInt(b.dataset.delTb),1);
    await salvarJSON(container,"tabelas_preco",state.tabelasPreco);
    renderTabelasPreco(sc,container);
  }));
}

function abrirModalTabela(container, idx, sc) {
  const area=container.querySelector("#modal-area");
  const t=idx!==null?state.tabelasPreco[idx]:{};
  const editando=idx!==null;
  area.innerHTML=`
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando?"Editar":"Nova"} Tabela de Preço</h3>
        <label>Nome *</label>
        <input id="tb-nome" value="${esc(t.nome)}" placeholder="Ex: Varejo, Atacado, Revenda..." autofocus />
        <label>Multiplicador (% do preço base)</label>
        <div style="display:flex;align-items:center;gap:8px">
          <input id="tb-mult" type="number" min="1" max="999" step="1" value="${Math.round((t.multiplicador||1)*100)}" style="flex:1" />
          <span style="color:var(--muted);font-size:13px">% do preço base</span>
        </div>
        <div class="cfg-hint" style="margin-top:6px">
          100% = preço cheio. 85% = 15% de desconto. 120% = 20% acima do preço base.
        </div>
        <div class="modal-btns">
          <button class="btn-secondary" id="tb-cancel">Cancelar</button>
          <button class="btn-primary"   id="tb-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#tb-cancel").addEventListener("click",()=>area.innerHTML="");
  area.querySelector("#modal-bg").addEventListener("click",e=>{if(e.target.id==="modal-bg")area.innerHTML="";});
  area.querySelector("#tb-ok").addEventListener("click",async()=>{
    const nome=area.querySelector("#tb-nome").value.trim();
    const mult=parseFloat(area.querySelector("#tb-mult").value)||100;
    if(!nome){alert("Informe o nome.");return;}
    const dados={nome,multiplicador:mult/100};
    if(editando) state.tabelasPreco[idx]=dados;
    else state.tabelasPreco.push(dados);
    area.innerHTML="";
    await salvarJSON(container,"tabelas_preco",state.tabelasPreco);
    state.msg={tipo:"ok",texto:editando?"Tabela atualizada!":"Tabela adicionada!"};
    render(container);
  });
}

function renderFormulas(sc, container) {
  const c = state.cfg;
  sc.innerHTML = `
    <div class="cfg-hint" style="margin-top:14px">
      Defina as fórmulas base para cada tipo de produto. Use as variáveis disponíveis abaixo.
    </div>
    <div class="formula-vars">
      <div class="formula-var-title">📌 Variáveis disponíveis:</div>
      <div class="formula-vars-list">
        <span class="fvar">{largura}</span> <span class="fvar">{altura}</span>
        <span class="fvar">{quantidade}</span> <span class="fvar">{valor_m2}</span>
        <span class="fvar">{custo_hora}</span> <span class="fvar">{tempo_h}</span>
        <span class="fvar">{margem}</span> <span class="fvar">{taxa_arte}</span>
      </div>
    </div>
    <div class="cfg-card">
      <div class="cfg-card-title">📐 Produtos por área (lona, adesivo, banner)</div>
      <div class="cfg-group full">
        <label>Fórmula de custo base</label>
        <input id="f-area" value="${esc(c.formula_area||"{largura} * {altura} * {quantidade} * {valor_m2}")}" />
        <span class="cfg-hint" style="margin-top:4px">Valor final = fórmula acima + margem de lucro configurada</span>
      </div>
    </div>
    <div class="cfg-card">
      <div class="cfg-card-title">🔤 Letras caixa / ACM / recorte</div>
      <div class="cfg-group full">
        <label>Fórmula de custo base</label>
        <input id="f-letra" value="${esc(c.formula_letra||"{altura} * {preco_cm} * {quantidade}")}" />
      </div>
    </div>
    <div class="cfg-card">
      <div class="cfg-card-title">🃏 Cartões, folhetos (por unidade)</div>
      <div class="cfg-group full">
        <label>Fórmula de custo base</label>
        <input id="f-unid" value="${esc(c.formula_unidade||"{quantidade} * {valor_unitario}")}" />
      </div>
    </div>
    <div class="cfg-card">
      <div class="cfg-card-title">⚙️ Serviço / hora trabalhada</div>
      <div class="cfg-group full">
        <label>Fórmula de custo base</label>
        <input id="f-hora" value="${esc(c.formula_hora||"{tempo_h} * {custo_hora}")}" />
      </div>
    </div>
    <div class="cfg-acoes">
      <button class="btn-primary" id="btn-salvar-form">💾 Salvar fórmulas</button>
    </div>
  `;
  sc.querySelector("#btn-salvar-form").addEventListener("click",async()=>{
    await salvarCfg(container,{
      formula_area:     sc.querySelector("#f-area").value.trim(),
      formula_letra:    sc.querySelector("#f-letra").value.trim(),
      formula_unidade:  sc.querySelector("#f-unid").value.trim(),
      formula_hora:     sc.querySelector("#f-hora").value.trim(),
    },sc);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: ESTOQUE
// ══════════════════════════════════════════════════════════════════════════════
function renderEstoque(content, container) {
  const sub = state._sub_estoque || "categorias";
  state._sub_estoque = sub;
  const SUBS = [
    { key:"categorias",  label:"📂 Categorias de Material" },
    { key:"unidades",    label:"📐 Unidades de Estoque"    },
    { key:"fornecedores",label:"🏭 Fornecedores"           },
    { key:"alertas",     label:"🔔 Alertas e Regras"       },
  ];
  content.innerHTML = `
    <div class="cfg-section-title">🗂️ Estoque</div>
    <div class="sub-tabs">
      ${SUBS.map(s=>`<button class="sub-tab ${sub===s.key?"active":""}" data-sub="${s.key}">${s.label}</button>`).join("")}
    </div>
    <div id="sub-content"></div>
  `;
  content.querySelectorAll("[data-sub]").forEach(btn=>
    btn.addEventListener("click",()=>{ state._sub_estoque=btn.dataset.sub; renderEstoque(content,container); })
  );
  const sc = content.querySelector("#sub-content");
  if (sub==="categorias")   renderCategoriasEstoque(sc, container);
  if (sub==="unidades")     renderUnidadesEstoque(sc, container);
  if (sub==="fornecedores") renderFornecedores(sc, container);
  if (sub==="alertas")      renderAlertasEstoque(sc, container);
}

function renderCategoriasEstoque(sc, container) {
  const cats = state.categoriasMateriais;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <span class="cfg-hint" style="margin:0">Tipos de material no estoque.</span>
      <button class="btn-primary" id="btn-add-catmat" style="padding:6px 14px;font-size:12px">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:14px">
      ${cats.map((c,i)=>`
        <div class="categ-item">
          <span>${esc(c)}</span>
          <button class="btn-icon danger" data-del-catmat="${i}" style="padding:2px 7px;font-size:11px">✕</button>
        </div>`).join("") || `<div class="cfg-vazio" style="padding:12px">Sem categorias.</div>`}
    </div>`;
  sc.querySelector("#btn-add-catmat").addEventListener("click",async()=>{
    const nome=prompt("Nome da categoria de material:");
    if(!nome?.trim())return;
    state.categoriasMateriais.push(nome.trim());
    await salvarJSON(container,"categorias_materiais",state.categoriasMateriais);
    renderCategoriasEstoque(sc,container);
  });
  sc.querySelectorAll("[data-del-catmat]").forEach(b=>b.addEventListener("click",async()=>{
    state.categoriasMateriais.splice(parseInt(b.dataset.delCatmat),1);
    await salvarJSON(container,"categorias_materiais",state.categoriasMateriais);
    renderCategoriasEstoque(sc,container);
  }));
}

function renderUnidadesEstoque(sc, container) {
  const uns = state.unidadesEstoque;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <span class="cfg-hint" style="margin:0">Unidades de medida para controle de estoque.</span>
      <button class="btn-primary" id="btn-add-unes" style="padding:6px 14px;font-size:12px">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
      <table class="cfg-table">
        <thead><tr><th>Sigla</th><th>Nome</th><th>Controle por rolo?</th><th></th></tr></thead>
        <tbody>${uns.map((u,i)=>`
          <tr>
            <td><strong>${esc(u.sigla)}</strong></td>
            <td>${esc(u.nome)}</td>
            <td>${u.rolo?`<span class="tag-status ativo">● Sim</span>`:`<span class="tag-status inativo">○ Não</span>`}</td>
            <td class="tbl-acoes"><button class="btn-icon danger" data-del-unes="${i}">🗑</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="cfg-hint" style="margin-top:8px">💡 Ative "controle por rolo" para unidades como metro/m² — permite rastrear largura e metragem restante por rolo.</div>
  `;
  sc.querySelector("#btn-add-unes").addEventListener("click",()=>{
    const area=container.querySelector("#modal-area");
    area.innerHTML=`
      <div class="modal-bg" id="modal-bg">
        <div class="modal">
          <h3>Nova Unidade de Estoque</h3>
          <label>Sigla *</label><input id="ue-sigla" placeholder="m, m², L, kg..." autofocus />
          <label>Nome *</label><input id="ue-nome" placeholder="Metro, Litro..." />
          <label>Controle por rolo?</label>
          <select id="ue-rolo">
            <option value="false">❌ Não</option>
            <option value="true">✅ Sim (metro, m²...)</option>
          </select>
          <div class="modal-btns">
            <button class="btn-secondary" id="ue-cancel">Cancelar</button>
            <button class="btn-primary" id="ue-ok">Salvar</button>
          </div>
        </div>
      </div>`;
    area.querySelector("#ue-cancel").addEventListener("click",()=>area.innerHTML="");
    area.querySelector("#modal-bg").addEventListener("click",e=>{if(e.target.id==="modal-bg")area.innerHTML="";});
    area.querySelector("#ue-ok").addEventListener("click",async()=>{
      const sigla=area.querySelector("#ue-sigla").value.trim();
      const nome=area.querySelector("#ue-nome").value.trim();
      if(!sigla||!nome){alert("Preencha sigla e nome.");return;}
      state.unidadesEstoque.push({sigla,nome,rolo:area.querySelector("#ue-rolo").value==="true"});
      area.innerHTML="";
      await salvarJSON(container,"unidades_estoque",state.unidadesEstoque);
      state.msg={tipo:"ok",texto:"Unidade adicionada!"};
      render(container);
    });
  });
  sc.querySelectorAll("[data-del-unes]").forEach(b=>b.addEventListener("click",async()=>{
    state.unidadesEstoque.splice(parseInt(b.dataset.delUnes),1);
    await salvarJSON(container,"unidades_estoque",state.unidadesEstoque);
    renderUnidadesEstoque(sc,container);
  }));
}

function renderFornecedores(sc, container) {
  const fns = state.fornecedores;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <span class="cfg-hint" style="margin:0">Fornecedores de materiais para o estoque.</span>
      <button class="btn-primary" id="btn-nova-fn">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
      ${fns.length===0?`<div class="cfg-vazio">Nenhum fornecedor cadastrado.</div>`
      :`<table class="cfg-table">
          <thead><tr><th>Nome</th><th>Contato</th><th>Prazo (dias)</th><th>Preço médio</th><th></th></tr></thead>
          <tbody>${fns.map((f,i)=>`
            <tr>
              <td><strong>${esc(f.nome)}</strong></td>
              <td>${esc(f.contato)||"—"}</td>
              <td>${f.prazo_dias?f.prazo_dias+"d":"—"}</td>
              <td>${f.preco_medio?`R$ ${fmtMoeda(f.preco_medio)}`:"—"}</td>
              <td class="tbl-acoes">
                <button class="btn-icon" data-edit-fn="${i}">✏️</button>
                <button class="btn-icon danger" data-del-fn="${i}">🗑</button>
              </td>
            </tr>`).join("")}</tbody>
        </table>`}
    </div>`;
  sc.querySelector("#btn-nova-fn").addEventListener("click",()=>abrirModalFornecedor(container,null,sc));
  sc.querySelectorAll("[data-edit-fn]").forEach(b=>b.addEventListener("click",()=>abrirModalFornecedor(container,parseInt(b.dataset.editFn),sc)));
  sc.querySelectorAll("[data-del-fn]").forEach(b=>b.addEventListener("click",async()=>{
    if(!confirm(`Remover "${state.fornecedores[parseInt(b.dataset.delFn)]?.nome}"?`))return;
    state.fornecedores.splice(parseInt(b.dataset.delFn),1);
    await salvarJSON(container,"fornecedores",state.fornecedores);
    renderFornecedores(sc,container);
  }));
}

function abrirModalFornecedor(container, idx, sc) {
  const area=container.querySelector("#modal-area");
  const f=idx!==null?state.fornecedores[idx]:{};
  const editando=idx!==null;
  area.innerHTML=`
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando?"Editar":"Novo"} Fornecedor</h3>
        <label>Nome / Razão Social *</label>
        <input id="fn-nome" value="${esc(f.nome)}" autofocus />
        <label>Contato (telefone ou email)</label>
        <input id="fn-contato" value="${esc(f.contato)}" placeholder="(11) 99999-9999 ou email@..." />
        <label>Site</label>
        <input id="fn-site" value="${esc(f.site)}" placeholder="www.fornecedor.com.br" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label>Prazo de entrega (dias)</label><input id="fn-prazo" type="number" min="0" value="${f.prazo_dias||""}" placeholder="5" /></div>
          <div><label>Preço médio (R$)</label><input id="fn-preco" type="number" min="0" step="0.01" value="${f.preco_medio||""}" placeholder="0,00" /></div>
        </div>
        <label>Observações</label>
        <textarea id="fn-obs" rows="2" placeholder="Notas sobre este fornecedor...">${esc(f.observacoes)}</textarea>
        <div class="modal-btns">
          <button class="btn-secondary" id="fn-cancel">Cancelar</button>
          <button class="btn-primary"   id="fn-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#fn-cancel").addEventListener("click",()=>area.innerHTML="");
  area.querySelector("#modal-bg").addEventListener("click",e=>{if(e.target.id==="modal-bg")area.innerHTML="";});
  area.querySelector("#fn-ok").addEventListener("click",async()=>{
    const nome=area.querySelector("#fn-nome").value.trim();
    if(!nome){alert("Informe o nome.");return;}
    const dados={
      nome,
      contato:     area.querySelector("#fn-contato").value.trim()||null,
      site:        area.querySelector("#fn-site").value.trim()||null,
      prazo_dias:  parseInt(area.querySelector("#fn-prazo").value)||null,
      preco_medio: parseFloat(area.querySelector("#fn-preco").value)||null,
      observacoes: area.querySelector("#fn-obs").value.trim()||null,
    };
    if(editando) state.fornecedores[idx]=dados;
    else state.fornecedores.push(dados);
    area.innerHTML="";
    await salvarJSON(container,"fornecedores",state.fornecedores);
    state.msg={tipo:"ok",texto:editando?"Fornecedor atualizado!":"Fornecedor adicionado!"};
    render(container);
  });
}

function renderAlertasEstoque(sc, container) {
  const c = state.cfg;
  sc.innerHTML = `
    <div class="cfg-hint" style="margin-top:14px">Configure como o sistema notifica quando o estoque estiver baixo.</div>
    <div class="cfg-card">
      <div class="cfg-card-title">🔔 Alertas de Estoque Mínimo</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Alerta no sistema?</label>
          <select id="alerta-sistema">
            <option value="sim" ${(c.estoque_alerta_sistema||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.estoque_alerta_sistema==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Baixa automática ao vender?</label>
          <select id="alerta-baixa">
            <option value="sim" ${(c.estoque_baixa_auto||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.estoque_baixa_auto==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Entrada automática ao comprar?</label>
          <select id="alerta-entrada">
            <option value="sim" ${(c.estoque_entrada_auto||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.estoque_entrada_auto==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Notificar via WhatsApp?</label>
          <select id="alerta-whats">
            <option value="nao" ${(c.estoque_alerta_whats||"nao")==="nao"?"selected":""}>❌ Não</option>
            <option value="sim" ${c.estoque_alerta_whats==="sim"?"selected":""}>✅ Sim</option>
          </select>
        </div>
      </div>
      <div class="cfg-acoes" style="margin-top:10px">
        <button class="btn-primary" id="btn-salvar-alerta">💾 Salvar configurações de estoque</button>
      </div>
    </div>
  `;
  sc.querySelector("#btn-salvar-alerta").addEventListener("click",async()=>{
    await salvarCfg(container,{
      estoque_alerta_sistema: sc.querySelector("#alerta-sistema").value,
      estoque_baixa_auto:     sc.querySelector("#alerta-baixa").value,
      estoque_entrada_auto:   sc.querySelector("#alerta-entrada").value,
      estoque_alerta_whats:   sc.querySelector("#alerta-whats").value,
    },sc);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: CLIENTES
// ══════════════════════════════════════════════════════════════════════════════
function renderClientes(content, container) {
  const c = state.cfg;
  const sub = state._sub_clientes || "categorias";
  state._sub_clientes = sub;
  const SUBS = [
    { key:"categorias", label:"📂 Categorias"        },
    { key:"campos",     label:"✏️ Campos Personalizados"},
    { key:"credito",    label:"💳 Crédito e Prazos"   },
  ];
  content.innerHTML = `
    <div class="cfg-section-title">👥 Clientes</div>
    <div class="sub-tabs">
      ${SUBS.map(s=>`<button class="sub-tab ${sub===s.key?"active":""}" data-sub="${s.key}">${s.label}</button>`).join("")}
    </div>
    <div id="sub-content"></div>
  `;
  content.querySelectorAll("[data-sub]").forEach(btn=>
    btn.addEventListener("click",()=>{ state._sub_clientes=btn.dataset.sub; renderClientes(content,container); })
  );
  const sc = content.querySelector("#sub-content");
  if (sub==="categorias") renderCategoriasClientes(sc, container);
  if (sub==="campos")     renderCamposClientes(sc, container);
  if (sub==="credito")    renderCreditoClientes(sc, container, c);
}

function renderCategoriasClientes(sc, container) {
  const cats = state.categoriasClientes;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <span class="cfg-hint" style="margin:0">Categorias para segmentar sua base de clientes.</span>
      <button class="btn-primary" id="btn-add-catcli" style="padding:6px 14px;font-size:12px">+ Adicionar</button>
    </div>
    <div class="cfg-card" style="padding:14px">
      ${cats.map((c,i)=>`
        <div class="categ-item">
          <span>${esc(c)}</span>
          <button class="btn-icon danger" data-del-catcli="${i}" style="padding:2px 7px;font-size:11px">✕</button>
        </div>`).join("") || `<div class="cfg-vazio" style="padding:12px">Sem categorias.</div>`}
    </div>`;
  sc.querySelector("#btn-add-catcli").addEventListener("click",async()=>{
    const nome=prompt("Nome da categoria:");
    if(!nome?.trim())return;
    state.categoriasClientes.push(nome.trim());
    await salvarJSON(container,"categorias_clientes",state.categoriasClientes);
    renderCategoriasClientes(sc,container);
  });
  sc.querySelectorAll("[data-del-catcli]").forEach(b=>b.addEventListener("click",async()=>{
    state.categoriasClientes.splice(parseInt(b.dataset.delCatcli),1);
    await salvarJSON(container,"categorias_clientes",state.categoriasClientes);
    renderCategoriasClientes(sc,container);
  }));
}

function renderCamposClientes(sc, container) {
  const campos = state.camposCustomClientes;
  sc.innerHTML = `
    <div class="cfg-section-header" style="margin-top:14px">
      <div>
        <div style="font-size:13px;font-weight:600;margin-bottom:2px">Campos adicionais no cadastro de clientes</div>
        <div class="cfg-hint" style="margin:0">Além dos campos padrão (nome, CPF/CNPJ, telefone, e-mail, endereço).</div>
      </div>
      <button class="btn-primary" id="btn-add-campo">+ Adicionar campo</button>
    </div>
    <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
      ${campos.length===0?`<div class="cfg-vazio">Nenhum campo personalizado.</div>`
      :`<table class="cfg-table">
          <thead><tr><th>Nome do campo</th><th>Tipo</th><th>Opções</th><th></th></tr></thead>
          <tbody>${campos.map((f,i)=>`
            <tr>
              <td><strong>${esc(f.nome)}</strong></td>
              <td><span class="tag-cargo">${esc(f.tipo)||"texto"}</span></td>
              <td>${esc(f.opcoes)||"—"}</td>
              <td class="tbl-acoes">
                <button class="btn-icon" data-edit-campo="${i}">✏️</button>
                <button class="btn-icon danger" data-del-campo="${i}">🗑</button>
              </td>
            </tr>`).join("")}</tbody>
        </table>`}
    </div>`;
  sc.querySelector("#btn-add-campo").addEventListener("click",()=>abrirModalCampo(container,null,sc));
  sc.querySelectorAll("[data-edit-campo]").forEach(b=>b.addEventListener("click",()=>abrirModalCampo(container,parseInt(b.dataset.editCampo),sc)));
  sc.querySelectorAll("[data-del-campo]").forEach(b=>b.addEventListener("click",async()=>{
    state.camposCustomClientes.splice(parseInt(b.dataset.delCampo),1);
    await salvarJSON(container,"campos_custom_clientes",state.camposCustomClientes);
    renderCamposClientes(sc,container);
  }));
}

function abrirModalCampo(container, idx, sc) {
  const area=container.querySelector("#modal-area");
  const f=idx!==null?state.camposCustomClientes[idx]:{};
  const editando=idx!==null;
  area.innerHTML=`
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando?"Editar":"Novo"} Campo</h3>
        <label>Nome do campo *</label>
        <input id="cm-nome" value="${esc(f.nome)}" placeholder="Ex: Instagram, Segmento..." autofocus />
        <label>Tipo de campo</label>
        <select id="cm-tipo">
          ${["texto","numero","opcao","data","booleano"].map(t=>
            `<option value="${t}" ${(f.tipo||"texto")===t?"selected":""}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`
          ).join("")}
        </select>
        <div id="cm-opcoes-wrap" style="${(f.tipo||"texto")==="opcao"?"":"display:none"}">
          <label>Opções (separadas por vírgula)</label>
          <input id="cm-opcoes" value="${esc(f.opcoes)}" placeholder="Opção 1,Opção 2,Opção 3" />
        </div>
        <div class="modal-btns">
          <button class="btn-secondary" id="cm-cancel">Cancelar</button>
          <button class="btn-primary"   id="cm-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#cm-tipo").addEventListener("change",function(){
    area.querySelector("#cm-opcoes-wrap").style.display=this.value==="opcao"?"":"none";
  });
  area.querySelector("#cm-cancel").addEventListener("click",()=>area.innerHTML="");
  area.querySelector("#modal-bg").addEventListener("click",e=>{if(e.target.id==="modal-bg")area.innerHTML="";});
  area.querySelector("#cm-ok").addEventListener("click",async()=>{
    const nome=area.querySelector("#cm-nome").value.trim();
    if(!nome){alert("Informe o nome.");return;}
    const tipo=area.querySelector("#cm-tipo").value;
    const dados={nome,tipo,opcoes:tipo==="opcao"?area.querySelector("#cm-opcoes").value.trim()||null:null};
    if(editando) state.camposCustomClientes[idx]=dados;
    else state.camposCustomClientes.push(dados);
    area.innerHTML="";
    await salvarJSON(container,"campos_custom_clientes",state.camposCustomClientes);
    state.msg={tipo:"ok",texto:editando?"Campo atualizado!":"Campo adicionado!"};
    render(container);
  });
}

function renderCreditoClientes(sc, container, c) {
  sc.innerHTML = `
    <div class="cfg-hint" style="margin-top:14px">Defina as regras padrão de crédito para novos clientes.</div>
    <div class="cfg-card">
      <div class="cfg-card-title">💳 Limites e Prazos Padrão</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Limite de crédito padrão (R$)</label>
          <input id="cred-limite" type="number" min="0" step="0.01" value="${c.cliente_limite_credito||0}" placeholder="0,00" />
          <span class="cfg-hint" style="margin-top:4px">0 = sem limite</span>
        </div>
        <div class="cfg-group">
          <label>Prazo de pagamento padrão (dias)</label>
          <input id="cred-prazo" type="number" min="0" value="${c.cliente_prazo_pagamento||0}" placeholder="0 = à vista" />
        </div>
        <div class="cfg-group">
          <label>Bloquear venda acima do limite?</label>
          <select id="cred-bloquear">
            <option value="nao" ${(c.cliente_bloquear_limite||"nao")==="nao"?"selected":""}>❌ Não (apenas alertar)</option>
            <option value="sim" ${c.cliente_bloquear_limite==="sim"?"selected":""}>✅ Sim (bloquear venda)</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Histórico automático de compras?</label>
          <select id="cred-hist">
            <option value="sim" ${(c.cliente_historico_auto||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.cliente_historico_auto==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
      </div>
      <div class="cfg-acoes" style="margin-top:10px">
        <button class="btn-primary" id="btn-salvar-cred">💾 Salvar</button>
      </div>
    </div>`;
  sc.querySelector("#btn-salvar-cred").addEventListener("click",async()=>{
    await salvarCfg(container,{
      cliente_limite_credito:  sc.querySelector("#cred-limite").value||null,
      cliente_prazo_pagamento: sc.querySelector("#cred-prazo").value||null,
      cliente_bloquear_limite: sc.querySelector("#cred-bloquear").value,
      cliente_historico_auto:  sc.querySelector("#cred-hist").value,
    },sc);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: USUÁRIOS E PERMISSÕES
// ══════════════════════════════════════════════════════════════════════════════
const TODAS_PERMISSOES = [
  { key:"editar_preco",     label:"✏️ Editar preço de produtos"       },
  { key:"excluir_venda",    label:"🗑️ Excluir vendas/pedidos"          },
  { key:"cancelar_pedido",  label:"❌ Cancelar pedido"                 },
  { key:"ver_lucro",        label:"📊 Visualizar lucro e margem"       },
  { key:"ver_financeiro",   label:"💰 Acessar módulo financeiro"       },
  { key:"acessar_config",   label:"⚙️ Acessar configurações do sistema"},
];

function renderUsuarios(content, container) {
  const perfis = state.perfisPermissao;
  content.innerHTML = `
    <div class="cfg-section-header">
      <div class="cfg-section-title">🔐 Perfis e Permissões</div>
      <button class="btn-primary" id="btn-novo-perfil">+ Novo Perfil</button>
    </div>
    <div class="cfg-hint">Defina quais ações cada perfil de usuário pode executar no sistema.</div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
      ${perfis.map((p,i)=>`
        <div class="cfg-card perfil-card">
          <div class="perfil-header">
            <div class="perfil-badge" style="background:${esc(p.cor)}22;border:1px solid ${esc(p.cor)}44;color:${esc(p.cor)}">
              ${esc(p.nome)}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn-icon" data-edit-perf="${i}">✏️</button>
              <button class="btn-icon danger" data-del-perf="${i}">🗑</button>
            </div>
          </div>
          <div class="perm-lista">
            ${TODAS_PERMISSOES.map(pm=>`
              <div class="perm-item ${p.permissoes?.[pm.key]?"perm-on":"perm-off"}">
                <span>${pm.label}</span>
                <span class="perm-badge">${p.permissoes?.[pm.key]?"✅":"❌"}</span>
              </div>`).join("")}
          </div>
        </div>`).join("")}
    </div>
  `;
  content.querySelector("#btn-novo-perfil").addEventListener("click",()=>abrirModalPerfil(container,null));
  content.querySelectorAll("[data-edit-perf]").forEach(b=>b.addEventListener("click",()=>abrirModalPerfil(container,parseInt(b.dataset.editPerf))));
  content.querySelectorAll("[data-del-perf]").forEach(b=>b.addEventListener("click",async()=>{
    const i=parseInt(b.dataset.delPerf);
    if(!confirm(`Remover perfil "${state.perfisPermissao[i]?.nome}"?`))return;
    state.perfisPermissao.splice(i,1);
    await salvarJSON(container,"perfis_permissao",state.perfisPermissao);
    state.msg={tipo:"ok",texto:"Perfil removido."};
    render(container);
  }));
}

function abrirModalPerfil(container, idx) {
  const area=container.querySelector("#modal-area");
  const p=idx!==null?state.perfisPermissao[idx]:{permissoes:{}};
  const editando=idx!==null;
  area.innerHTML=`
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:480px">
        <h3>${editando?"Editar":"Novo"} Perfil</h3>
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end">
          <div>
            <label>Nome do perfil *</label>
            <input id="pf-nome" value="${esc(p.nome)}" placeholder="Ex: Supervisor..." autofocus />
          </div>
          <div>
            <label>Cor</label>
            <input id="pf-cor" type="color" value="${esc(p.cor)||"#4dabf7"}" style="height:42px;width:50px;border-radius:8px;cursor:pointer" />
          </div>
        </div>
        <div style="margin-top:14px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px">Permissões</div>
        ${TODAS_PERMISSOES.map(pm=>`
          <div class="perm-toggle">
            <label for="pm-${pm.key}">${pm.label}</label>
            <label class="switch">
              <input type="checkbox" id="pm-${pm.key}" ${p.permissoes?.[pm.key]?"checked":""} />
              <span class="slider"></span>
            </label>
          </div>`).join("")}
        <div class="modal-btns">
          <button class="btn-secondary" id="pf-cancel">Cancelar</button>
          <button class="btn-primary"   id="pf-ok">Salvar</button>
        </div>
      </div>
    </div>`;
  area.querySelector("#pf-cancel").addEventListener("click",()=>area.innerHTML="");
  area.querySelector("#modal-bg").addEventListener("click",e=>{if(e.target.id==="modal-bg")area.innerHTML="";});
  area.querySelector("#pf-ok").addEventListener("click",async()=>{
    const nome=area.querySelector("#pf-nome").value.trim();
    if(!nome){alert("Informe o nome.");return;}
    const permissoes={};
    TODAS_PERMISSOES.forEach(pm=>{
      permissoes[pm.key]=area.querySelector(`#pm-${pm.key}`).checked;
    });
    const dados={nome,cor:area.querySelector("#pf-cor").value,permissoes};
    if(editando) state.perfisPermissao[idx]=dados;
    else state.perfisPermissao.push(dados);
    area.innerHTML="";
    await salvarJSON(container,"perfis_permissao",state.perfisPermissao);
    state.msg={tipo:"ok",texto:editando?"Perfil atualizado!":"Perfil criado!"};
    render(container);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: PERSONALIZAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
function renderPersonalizacao(content, container) {
  const c = state.cfg;
  content.innerHTML = `
    <div class="cfg-section-title">🎨 Personalização do Sistema</div>
    <div class="cfg-card">
      <div class="cfg-card-title">🖼️ Identidade Visual</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Nome do sistema</label>
          <input id="pers-nome-sys" value="${esc(c.sistema_nome||"ERP Gráfica")}" />
        </div>
        <div class="cfg-group">
          <label>Ícone do sistema (emoji ou URL)</label>
          <input id="pers-icone" value="${esc(c.sistema_icone||"🖨️")}" placeholder="🖨️ ou https://..." />
        </div>
        <div class="cfg-group full">
          <label>URL do logotipo do sistema</label>
          <input id="pers-logo-sys" value="${esc(c.sistema_logo_url)}" placeholder="https://..." />
        </div>
      </div>
    </div>
    <div class="cfg-card">
      <div class="cfg-card-title">🎨 Cores e Tema</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Cor de destaque (accent)</label>
          <div style="display:flex;gap:10px;align-items:center">
            <input id="pers-accent" type="color" value="${esc(c.tema_accent_color||"#6aa6ff")}" style="height:42px;width:60px;border-radius:8px;cursor:pointer" />
            <input id="pers-accent-hex" value="${esc(c.tema_accent_color||"#6aa6ff")}" style="flex:1;font-family:monospace" />
          </div>
        </div>
        <div class="cfg-group">
          <label>Tema padrão</label>
          <select id="pers-tema">
            <option value="escuro"  ${(c.tema_modo||"escuro")==="escuro"?"selected":""}>🌙 Escuro</option>
            <option value="claro"   ${c.tema_modo==="claro"?"selected":""}>☀️ Claro</option>
            <option value="sistema" ${c.tema_modo==="sistema"?"selected":""}>🖥️ Seguir sistema</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Sidebar recolhida por padrão?</label>
          <select id="pers-sidebar">
            <option value="nao" ${(c.sidebar_recolhida||"nao")==="nao"?"selected":""}>❌ Não (expandida)</option>
            <option value="sim" ${c.sidebar_recolhida==="sim"?"selected":""}>✅ Sim (recolhida)</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Layout do dashboard</label>
          <select id="pers-dash-layout">
            <option value="compacto"  ${(c.dashboard_layout||"compacto")==="compacto"?"selected":""}>📐 Compacto</option>
            <option value="confortavel" ${c.dashboard_layout==="confortavel"?"selected":""}>🖥️ Confortável</option>
          </select>
        </div>
      </div>
      <div id="pers-preview-accent" style="margin-top:14px;padding:12px 16px;border-radius:10px;background:rgba(106,166,255,0.08);border:1px solid rgba(106,166,255,0.2);font-size:13px">
        <span style="font-weight:600">Prévia da cor de destaque:</span>
        <span id="pers-btn-prev" style="display:inline-block;margin-left:12px;background:${esc(c.tema_accent_color||"#6aa6ff")};color:#000;padding:5px 14px;border-radius:7px;font-weight:600;font-size:12px">Botão exemplo</span>
      </div>
    </div>
    <div class="cfg-acoes">
      <button class="btn-primary" id="btn-salvar-pers">💾 Salvar personalização</button>
    </div>
  `;
  // Preview ao vivo da cor
  const syncCor = () => {
    const cor = content.querySelector("#pers-accent").value;
    content.querySelector("#pers-accent-hex").value = cor;
    content.querySelector("#pers-btn-prev").style.background = cor;
  };
  const syncHex = () => {
    const hex = content.querySelector("#pers-accent-hex").value;
    if(/^#[0-9a-fA-F]{6}$/.test(hex)) {
      content.querySelector("#pers-accent").value = hex;
      content.querySelector("#pers-btn-prev").style.background = hex;
    }
  };
  content.querySelector("#pers-accent").addEventListener("input", syncCor);
  content.querySelector("#pers-accent-hex").addEventListener("input", syncHex);

  content.querySelector("#btn-salvar-pers").addEventListener("click",async()=>{
    await salvarCfg(container,{
      sistema_nome:      content.querySelector("#pers-nome-sys").value.trim()||null,
      sistema_icone:     content.querySelector("#pers-icone").value.trim()||null,
      sistema_logo_url:  content.querySelector("#pers-logo-sys").value.trim()||null,
      tema_accent_color: content.querySelector("#pers-accent").value,
      tema_modo:         content.querySelector("#pers-tema").value,
      sidebar_recolhida: content.querySelector("#pers-sidebar").value,
      dashboard_layout:  content.querySelector("#pers-dash-layout").value,
    },content);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: SEGURANÇA
// ══════════════════════════════════════════════════════════════════════════════
function renderSeguranca(content, container) {
  const c = state.cfg;
  content.innerHTML = `
    <div class="cfg-section-title">🛡️ Segurança e Dados</div>

    <div class="cfg-card">
      <div class="cfg-card-title">💾 Backup Automático</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Frequência de backup</label>
          <select id="seg-backup-freq">
            <option value="diario"  ${(c.backup_frequencia||"diario")==="diario"?"selected":""}>📅 Diário</option>
            <option value="semanal" ${c.backup_frequencia==="semanal"?"selected":""}>📆 Semanal</option>
            <option value="mensal"  ${c.backup_frequencia==="mensal"?"selected":""}>🗓️ Mensal</option>
            <option value="nao"     ${c.backup_frequencia==="nao"?"selected":""}>❌ Desativado</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Horário do backup</label>
          <input id="seg-backup-hora" type="time" value="${esc(c.backup_horario||"02:00")}" />
        </div>
      </div>
    </div>

    <div class="cfg-card">
      <div class="cfg-card-title">📤 Exportação de Dados</div>
      <div class="cfg-hint">Exporte todos os dados do sistema nos formatos abaixo.</div>
      <div class="cfg-acoes">
        <button class="btn-secondary" id="seg-export-excel">📊 Exportar Excel (.xlsx)</button>
        <button class="btn-secondary" id="seg-export-csv">📄 Exportar CSV</button>
        <button class="btn-secondary" id="seg-export-json">🔧 Exportar JSON (backup completo)</button>
      </div>
    </div>

    <div class="cfg-card">
      <div class="cfg-card-title">🔒 Controle de Acesso</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Autenticação em 2 fatores (2FA)?</label>
          <select id="seg-2fa">
            <option value="nao" ${(c.seg_2fa||"nao")==="nao"?"selected":""}>❌ Não</option>
            <option value="sim" ${c.seg_2fa==="sim"?"selected":""}>✅ Sim (recomendado)</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Tempo de sessão (minutos)</label>
          <input id="seg-sessao" type="number" min="5" max="480" value="${c.seg_tempo_sessao||60}" />
          <span class="cfg-hint" style="margin-top:4px">Após inatividade, faz logout automaticamente</span>
        </div>
        <div class="cfg-group">
          <label>Log de ações dos usuários?</label>
          <select id="seg-logs">
            <option value="sim" ${(c.seg_logs||"sim")==="sim"?"selected":""}>✅ Sim (registrar tudo)</option>
            <option value="nao" ${c.seg_logs==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Log de exclusões e edições?</label>
          <select id="seg-log-edit">
            <option value="sim" ${(c.seg_log_edicoes||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.seg_log_edicoes==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
      </div>
    </div>

    <div class="cfg-card">
      <div class="cfg-card-title">🚨 Zona de Perigo</div>
      <div class="cfg-hint">Ações irreversíveis. Tenha certeza antes de executar.</div>
      <div class="cfg-acoes">
        <button class="btn-danger" id="seg-limpar-cache">🗑️ Limpar cache do sistema</button>
        <button class="btn-danger" id="seg-reset-cfg">⚠️ Resetar configurações padrão</button>
      </div>
    </div>

    <div class="cfg-acoes">
      <button class="btn-primary" id="btn-salvar-seg">💾 Salvar configurações de segurança</button>
    </div>
  `;
  content.querySelector("#btn-salvar-seg").addEventListener("click",async()=>{
    await salvarCfg(container,{
      backup_frequencia: content.querySelector("#seg-backup-freq").value,
      backup_horario:    content.querySelector("#seg-backup-hora").value,
      seg_2fa:           content.querySelector("#seg-2fa").value,
      seg_tempo_sessao:  content.querySelector("#seg-sessao").value,
      seg_logs:          content.querySelector("#seg-logs").value,
      seg_log_edicoes:   content.querySelector("#seg-log-edit").value,
    },content);
  });
  content.querySelector("#seg-export-excel").addEventListener("click",()=>alert("Exportação Excel: integre com sua API de relatórios."));
  content.querySelector("#seg-export-csv").addEventListener("click",()=>alert("Exportação CSV: integre com sua API de relatórios."));
  content.querySelector("#seg-export-json").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify(state.cfg,null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`backup-configuracoes-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });
  content.querySelector("#seg-limpar-cache").addEventListener("click",()=>{
    if(!confirm("Limpar o cache do sistema?"))return;
    localStorage.clear();
    sessionStorage.clear();
    state.msg={tipo:"ok",texto:"Cache limpo com sucesso!"};
    render(container);
  });
  content.querySelector("#seg-reset-cfg").addEventListener("click",()=>{
    if(!confirm("⚠️ Isso vai resetar TODAS as configurações para o padrão. Deseja continuar?"))return;
    if(!confirm("Tem absoluta certeza? Esta ação não pode ser desfeita."))return;
    alert("Implemente a lógica de reset conforme sua necessidade.");
  });
}
function v(sel, ctx=document) {
  const el=(ctx.querySelector||document.querySelector.bind(document)).call(ctx,sel);
  return el?.value?.trim()||null;
}
function esc(s) {
  if(s==null)return"";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function fmt(n) { return n!=null&&n!=""?Number(n).toFixed(2):"—"; }
function fmtMoeda(n) { return Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}); }

async function salvarJSON(container, campo, valor) {
  const { error } = await supabase.from("configuracoes").update({
    [campo]: JSON.stringify(valor),
    updated_at: new Date(),
  }).eq("id","global");
  if (error) { state.msg={tipo:"erro",texto:"Erro: "+error.message}; render(container); }
}

async function salvarCfg(container, dados, content) {
  const btn = content?.querySelector?.("[id^='btn-salvar']");
  if(btn){btn.disabled=true;btn.textContent="Salvando...";}
  const { error } = await supabase.from("configuracoes").update({
    ...dados, updated_at: new Date(),
  }).eq("id","global");
  if(btn) btn.disabled=false;
  if(error) state.msg={tipo:"erro",texto:"Erro ao salvar: "+error.message};
  else {
    state.msg={tipo:"ok",texto:"Configurações salvas com sucesso!"};
    await recarregar(container);
  }
  render(container);
}

async function recarregar(container) { await carregar(); }

// ─── CSS ──────────────────────────────────────────────────────────────────────
function css() { return `
  .cfg-wrap{display:flex;gap:0;min-height:calc(100vh - 80px)}
  .cfg-sidebar{width:210px;flex-shrink:0;background:var(--panel);border-right:1px solid rgba(255,255,255,0.06);padding:16px 10px;border-radius:14px 0 0 14px}
  .cfg-sidebar-title{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;padding:4px 8px;margin-bottom:10px}
  .cfg-nav-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:9px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:13px;text-align:left;transition:all .15s}
  .cfg-nav-btn:hover{background:rgba(255,255,255,0.04);color:var(--text)}
  .cfg-nav-btn.active{background:rgba(106,166,255,0.12);color:var(--accent);border:1px solid rgba(106,166,255,0.2)}
  .cfg-nav-emoji{font-size:16px}
  .cfg-body{flex:1;padding:20px 24px;overflow-y:auto}
  .cfg-toast{border-radius:10px;padding:10px 16px;font-size:13px;margin-bottom:16px}
  .cfg-toast.ok{background:rgba(105,219,124,0.12);border:1px solid #69db7c44;color:#69db7c}
  .cfg-toast.erro{background:rgba(255,107,107,0.12);border:1px solid #ff6b6b44;color:#ff6b6b}
  .cfg-section-title{font-size:18px;font-weight:700;margin-bottom:16px}
  .cfg-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .cfg-section-header .cfg-section-title{margin-bottom:0}
  .cfg-hint{font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5}
  .cfg-card{background:var(--panel2);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:14px}
  .cfg-card-title{font-size:12px;font-weight:700;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:.04em}
  .cfg-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:700px){.cfg-grid{grid-template-columns:1fr}}
  .cfg-group{display:flex;flex-direction:column;gap:5px}
  .cfg-group.full{grid-column:1/-1}
  .cfg-group label{font-size:12px;color:var(--muted)}
  .cfg-group input,.cfg-group select,.cfg-group textarea{background:var(--panel);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;transition:border-color .15s}
  .cfg-group input:focus,.cfg-group select:focus,.cfg-group textarea:focus{outline:none;border-color:rgba(106,166,255,0.4)}
  .cfg-group textarea{resize:vertical;min-height:70px}
  .cfg-acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
  .cfg-vazio{color:var(--muted);font-size:13px;padding:24px;text-align:center}
  .cfg-table{width:100%;border-collapse:collapse;font-size:13px}
  .cfg-table th{text-align:left;color:var(--muted);font-weight:500;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px}
  .cfg-table td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle}
  .cfg-table tr:last-child td{border-bottom:none}
  .cfg-table tr:hover td{background:rgba(255,255,255,0.02)}
  .tbl-acoes{display:flex;gap:5px;justify-content:flex-end}
  .tag-cargo{font-size:11px;background:rgba(106,166,255,0.12);color:var(--accent);padding:2px 8px;border-radius:999px}
  .tag-status{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
  .tag-status.ativo{background:rgba(105,219,124,0.12);color:#69db7c}
  .tag-status.inativo{background:rgba(255,255,255,0.06);color:var(--muted)}
  .trello-ok{background:rgba(105,219,124,0.1);border:1px solid #69db7c44;border-radius:8px;padding:10px 14px;font-size:13px;color:#69db7c;margin-bottom:14px}
  .trello-warn{background:rgba(255,169,77,0.08);border:1px solid #ffa94d33;border-radius:8px;padding:10px 14px;font-size:13px;color:#ffa94d;margin-bottom:14px}
  .btn-primary{background:var(--accent);color:#000;border:none;border-radius:8px;padding:9px 20px;cursor:pointer;font-size:13px;font-weight:600}
  .btn-primary:hover{opacity:.88}
  .btn-primary:disabled{opacity:.5;cursor:not-allowed}
  .btn-secondary{background:transparent;border:1px solid rgba(255,255,255,0.15);color:var(--text);border-radius:8px;padding:9px 16px;cursor:pointer;font-size:13px}
  .btn-danger{background:rgba(255,107,107,0.1);border:1px solid #ff6b6b44;color:#ff6b6b;border-radius:8px;padding:9px 16px;cursor:pointer;font-size:13px}
  .btn-icon{background:transparent;border:1px solid rgba(255,255,255,0.1);color:var(--muted);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px}
  .btn-icon:hover{border-color:var(--accent);color:var(--accent)}
  .btn-icon:disabled{opacity:.3;cursor:not-allowed}
  .btn-icon.danger:hover{border-color:#ff6b6b;color:#ff6b6b}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100}
  .modal{background:var(--panel);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;min-width:320px;max-width:480px;width:92%;max-height:90vh;overflow-y:auto}
  .modal h3{margin:0 0 16px;font-size:17px}
  .modal label{font-size:12px;color:var(--muted);display:block;margin-bottom:4px;margin-top:10px}
  .modal input,.modal select,.modal textarea{width:100%;background:var(--panel2);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;box-sizing:border-box}
  .modal-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
  /* Sub-tabs */
  .sub-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
  .sub-tab{background:transparent;border:1px solid rgba(255,255,255,0.1);color:var(--muted);border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;transition:all .15s}
  .sub-tab:hover{color:var(--text);border-color:rgba(255,255,255,0.2)}
  .sub-tab.active{background:rgba(106,166,255,0.12);color:var(--accent);border-color:rgba(106,166,255,0.3)}
  /* Taxas cartão */
  .tc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
  .tc-grid label{font-size:11px;color:var(--muted);display:block;margin-bottom:3px}
  .tc-grid input{width:100%;background:var(--panel2);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:7px;padding:7px 10px;font-size:13px;box-sizing:border-box}
  /* Custos fixos */
  .cf-item{display:flex;gap:10px;align-items:center;margin-bottom:8px}
  .cf-nome{flex:1;background:var(--panel);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:8px;padding:8px 12px;font-size:13px}
  .cf-valor-wrap{display:flex;align-items:center;background:var(--panel);border:1px solid rgba(255,255,255,0.1);border-radius:8px;overflow:hidden;width:130px;flex-shrink:0}
  .cf-moeda{padding:0 8px;color:var(--muted);font-size:12px;border-right:1px solid rgba(255,255,255,0.1)}
  .cf-valor{flex:1;background:transparent;border:none;color:var(--text);padding:8px 10px;font-size:13px;width:85px}
  .cf-valor:focus{outline:none}
  .cf-total{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(106,166,255,0.06);border-radius:8px;margin-top:12px;font-size:13px}
  /* Custo hora display */
  .custo-hora-display{background:rgba(105,219,124,0.08);border:1px solid rgba(105,219,124,0.2);border-radius:8px;padding:10px 14px;font-size:20px;font-weight:700;color:#69db7c}
  /* Etapas */
  .etapa-row{display:flex;align-items:center;gap:12px;background:var(--panel2);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 14px;margin-bottom:6px}
  .etapa-ordem{display:flex;align-items:center;gap:4px;flex-shrink:0}
  .etapa-num{font-size:12px;color:var(--muted);min-width:20px;text-align:center}
  .etapa-icone{font-size:20px;flex-shrink:0}
  .etapa-nome{font-size:13px;font-weight:600}
  /* Categorias */
  .categ-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:7px;font-size:13px;margin-bottom:4px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05)}
  @media(max-width:700px){
    .cfg-wrap{flex-direction:column}
    .cfg-sidebar{width:100%;border-radius:14px 14px 0 0;border-right:none;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;flex-wrap:wrap;gap:4px;padding:10px}
    .cfg-sidebar-title{display:none}
    .cfg-nav-btn{width:auto;flex:1;justify-content:center;font-size:11px}
    .cfg-nav-emoji{display:none}
    .cfg-body{padding:14px}
    .tc-grid{grid-template-columns:1fr 1fr}
  }
  /* Fórmulas */
  .formula-vars{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 16px;margin-bottom:14px}
  .formula-var-title{font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px}
  .formula-vars-list{display:flex;flex-wrap:wrap;gap:6px}
  .fvar{font-family:monospace;font-size:12px;background:rgba(106,166,255,0.1);color:var(--accent);border:1px solid rgba(106,166,255,0.2);border-radius:5px;padding:2px 8px}
  /* Perfis */
  .perfil-card{}
  .perfil-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .perfil-badge{display:inline-block;padding:4px 14px;border-radius:999px;font-size:13px;font-weight:700}
  .perm-lista{display:flex;flex-direction:column;gap:4px}
  .perm-item{display:flex;align-items:center;justify-content:space-between;font-size:12px;padding:5px 8px;border-radius:6px}
  .perm-on{background:rgba(105,219,124,0.05);color:var(--text)}
  .perm-off{background:rgba(255,255,255,0.02);color:var(--muted)}
  .perm-badge{font-size:13px}
  /* Perm toggle no modal */
  .perm-toggle{display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px}
  .perm-toggle:last-of-type{border-bottom:none}
  .switch{position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0}
  .switch input{opacity:0;width:0;height:0}
  .slider{position:absolute;cursor:pointer;inset:0;background:rgba(255,255,255,0.12);border-radius:22px;transition:.2s}
  .slider:before{position:absolute;content:"";height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
  input:checked+.slider{background:var(--accent)}
  input:checked+.slider:before{transform:translateX(18px)}
`;