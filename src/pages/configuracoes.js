import { supabase } from "../supabase/client.js";

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  aba: "empresa",
  cfg: {},
  vendedores: [],
  formasPagamento: [],
  salvando: false,
  msg: null, // { tipo: "ok"|"erro", texto }
};

const ABAS = [
  { key: "empresa",       emoji: "🏢", label: "Empresa"           },
  { key: "vendedores",    emoji: "👤", label: "Vendedores"         },
  { key: "pagamento",     emoji: "💳", label: "Formas de Pagamento"},
  { key: "impressao",     emoji: "🖨️", label: "Impressão"          },
  { key: "trello",        emoji: "🔗", label: "Trello"             },
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

  // formas_pagamento pode estar como JSON no campo configuracoes
  try {
    state.formasPagamento = JSON.parse(state.cfg.formas_pagamento || "[]");
  } catch {
    state.formasPagamento = [];
  }
}

// ─── Render principal ─────────────────────────────────────────────────────────
function render(container) {
  container.innerHTML = `
    <style>${css()}</style>

    <div class="cfg-wrap">
      <!-- Sidebar de abas -->
      <aside class="cfg-sidebar">
        <div class="cfg-sidebar-title">Configurações</div>
        ${ABAS.map(a => `
          <button class="cfg-nav-btn ${state.aba === a.key ? "active" : ""}" data-aba="${a.key}">
            <span class="cfg-nav-emoji">${a.emoji}</span>
            <span>${a.label}</span>
          </button>`).join("")}
      </aside>

      <!-- Conteúdo -->
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
    btn.addEventListener("click", () => {
      state.aba = btn.dataset.aba;
      render(container);
    })
  );

  const content = container.querySelector("#cfg-content");
  const fns = {
    empresa:    () => renderEmpresa(content, container),
    vendedores: () => renderVendedores(content, container),
    pagamento:  () => renderPagamento(content, container),
    impressao:  () => renderImpressao(content, container),
    trello:     () => renderTrello(content, container),
  };
  fns[state.aba]?.();

  // Limpa msg depois de 3s
  if (state.msg) {
    setTimeout(() => { state.msg = null; render(container); }, 3000);
  }
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
          <label>Nome da Empresa *</label>
          <input id="e-nome" value="${esc(c.empresa_nome)}" placeholder="Ex: Gráfica Master Print" />
        </div>
        <div class="cfg-group">
          <label>CNPJ</label>
          <input id="e-cnpj" value="${esc(c.empresa_cnpj)}" placeholder="00.000.000/0000-00" />
        </div>
        <div class="cfg-group">
          <label>Telefone</label>
          <input id="e-tel" value="${esc(c.empresa_telefone)}" placeholder="(11) 99999-9999" />
        </div>
        <div class="cfg-group">
          <label>E-mail</label>
          <input id="e-email" type="email" value="${esc(c.empresa_email)}" placeholder="contato@empresa.com" />
        </div>
        <div class="cfg-group">
          <label>Site / Instagram</label>
          <input id="e-site" value="${esc(c.empresa_site)}" placeholder="www.empresa.com ou @empresa" />
        </div>
        <div class="cfg-group full">
          <label>Endereço completo</label>
          <input id="e-end" value="${esc(c.empresa_endereco)}" placeholder="Rua Exemplo, 123 — Bairro — Cidade/UF" />
        </div>
        <div class="cfg-group full">
          <label>URL do Logotipo (link de imagem)</label>
          <input id="e-logo" value="${esc(c.empresa_logo_url)}" placeholder="https://..." />
        </div>
        <div class="cfg-group full">
          <label>Mensagem de rodapé (notas fiscais / documentos)</label>
          <textarea id="e-rodape" rows="2" placeholder="Ex: Obrigado pela preferência! Volte sempre.">${esc(c.empresa_rodape)}</textarea>
        </div>
      </div>
      <div class="cfg-acoes">
        <button class="btn-primary" id="btn-salvar-empresa">💾 Salvar dados da empresa</button>
      </div>
    </div>
  `;

  content.querySelector("#btn-salvar-empresa").addEventListener("click", async () => {
    await salvarCfg(container, {
      empresa_nome:      v("#e-nome"),
      empresa_cnpj:      v("#e-cnpj"),
      empresa_telefone:  v("#e-tel"),
      empresa_email:     v("#e-email"),
      empresa_site:      v("#e-site"),
      empresa_endereco:  v("#e-end"),
      empresa_logo_url:  v("#e-logo"),
      empresa_rodape:    v("#e-rodape"),
    }, content);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: VENDEDORES
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
            <thead><tr>
              <th>Nome</th><th>Telefone</th><th>E-mail</th><th>Cargo</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              ${state.vendedores.map(vd => `
                <tr>
                  <td><strong>${esc(vd.nome)}</strong></td>
                  <td>${esc(vd.telefone) || "—"}</td>
                  <td>${esc(vd.email) || "—"}</td>
                  <td><span class="tag-cargo">${esc(vd.cargo) || "Vendedor"}</span></td>
                  <td>
                    <span class="tag-status ${vd.ativo !== false ? "ativo" : "inativo"}">
                      ${vd.ativo !== false ? "● Ativo" : "○ Inativo"}
                    </span>
                  </td>
                  <td class="tbl-acoes">
                    <button class="btn-icon" data-edit-vend="${vd.id}">✏️ Editar</button>
                    <button class="btn-icon danger" data-del-vend="${vd.id}" data-del-nome="${esc(vd.nome)}">🗑</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>`
      }
    </div>
  `;

  content.querySelector("#btn-novo-vend").addEventListener("click", () =>
    abrirModalVendedor(container, {})
  );
  content.querySelectorAll("[data-edit-vend]").forEach(btn => {
    const vd = state.vendedores.find(v => v.id === btn.dataset.editVend);
    btn.addEventListener("click", () => abrirModalVendedor(container, vd));
  });
  content.querySelectorAll("[data-del-vend]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm(`Remover o vendedor "${btn.dataset.delNome}"?`)) return;
      await supabase.from("vendedores").delete().eq("id", btn.dataset.delVend);
      await recarregar(container);
      state.msg = { tipo: "ok", texto: "Vendedor removido." };
      render(container);
    })
  );
}

function abrirModalVendedor(container, vd = {}) {
  const area = container.querySelector("#modal-area");
  const editando = !!vd.id;
  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando ? "Editar Vendedor" : "Novo Vendedor"}</h3>
        <label>Nome *</label>
        <input id="mv-nome" value="${esc(vd.nome)}" placeholder="Nome completo" autofocus />
        <label>Cargo / Função</label>
        <input id="mv-cargo" value="${esc(vd.cargo)}" placeholder="Ex: Vendedor, Gerente, Atendente..." />
        <label>Telefone / WhatsApp</label>
        <input id="mv-tel" value="${esc(vd.telefone)}" placeholder="(11) 99999-9999" />
        <label>E-mail</label>
        <input id="mv-email" type="email" value="${esc(vd.email)}" placeholder="email@empresa.com" />
        <label>Status</label>
        <select id="mv-ativo">
          <option value="true"  ${vd.ativo !== false ? "selected" : ""}>● Ativo</option>
          <option value="false" ${vd.ativo === false  ? "selected" : ""}>○ Inativo</option>
        </select>
        <div class="modal-btns">
          <button class="btn-secondary" id="mv-cancel">Cancelar</button>
          <button class="btn-primary"   id="mv-ok">Salvar</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#mv-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });
  area.querySelector("#mv-ok").addEventListener("click", async () => {
    const nome = area.querySelector("#mv-nome").value.trim();
    if (!nome) { alert("Informe o nome."); return; }
    const payload = {
      nome,
      cargo:    area.querySelector("#mv-cargo").value.trim() || null,
      telefone: area.querySelector("#mv-tel").value.trim()   || null,
      email:    area.querySelector("#mv-email").value.trim() || null,
      ativo:    area.querySelector("#mv-ativo").value === "true",
    };
    if (editando) {
      await supabase.from("vendedores").update(payload).eq("id", vd.id);
    } else {
      await supabase.from("vendedores").insert(payload);
    }
    area.innerHTML = "";
    state.msg = { tipo: "ok", texto: editando ? "Vendedor atualizado!" : "Vendedor cadastrado!" };
    await recarregar(container);
    render(container);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: FORMAS DE PAGAMENTO
// ══════════════════════════════════════════════════════════════════════════════
function renderPagamento(content, container) {
  const fps = state.formasPagamento;

  content.innerHTML = `
    <div class="cfg-section-header">
      <div class="cfg-section-title">💳 Formas de Pagamento</div>
      <button class="btn-primary" id="btn-nova-fp">+ Adicionar</button>
    </div>
    <div class="cfg-hint">Configure as formas de pagamento aceitas. Elas aparecerão ao registrar vendas e lançamentos.</div>

    <div class="cfg-card" style="padding:0;overflow:hidden">
      ${fps.length === 0
        ? `<div class="cfg-vazio">Nenhuma forma de pagamento cadastrada.</div>`
        : `<table class="cfg-table">
            <thead><tr><th>Nome</th><th>Tipo</th><th>Parcelas máx.</th><th>Taxa (%)</th><th>Ativa</th><th></th></tr></thead>
            <tbody>
              ${fps.map((fp, i) => `
                <tr>
                  <td><strong>${esc(fp.nome)}</strong></td>
                  <td><span class="tag-cargo">${esc(fp.tipo) || "—"}</span></td>
                  <td>${fp.parcelas_max || 1}×</td>
                  <td>${fp.taxa ? fp.taxa + "%" : "—"}</td>
                  <td><span class="tag-status ${fp.ativa !== false ? "ativo" : "inativo"}">${fp.ativa !== false ? "● Ativa" : "○ Inativa"}</span></td>
                  <td class="tbl-acoes">
                    <button class="btn-icon" data-edit-fp="${i}">✏️ Editar</button>
                    <button class="btn-icon danger" data-del-fp="${i}">🗑</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>`
      }
    </div>
  `;

  content.querySelector("#btn-nova-fp").addEventListener("click", () => abrirModalFP(container, null));
  content.querySelectorAll("[data-edit-fp]").forEach(btn =>
    btn.addEventListener("click", () => abrirModalFP(container, parseInt(btn.dataset.editFp)))
  );
  content.querySelectorAll("[data-del-fp]").forEach(btn =>
    btn.addEventListener("click", async () => {
      const i = parseInt(btn.dataset.delFp);
      if (!confirm(`Remover "${state.formasPagamento[i]?.nome}"?`)) return;
      state.formasPagamento.splice(i, 1);
      await salvarFormasPagamento(container);
      renderPagamento(content, container);
    })
  );
}

function abrirModalFP(container, idx) {
  const area = container.querySelector("#modal-area");
  const fp = idx !== null ? state.formasPagamento[idx] : {};
  const editando = idx !== null;

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando ? "Editar" : "Nova"} Forma de Pagamento</h3>
        <label>Nome *</label>
        <input id="fp-nome" value="${esc(fp.nome)}" placeholder="Ex: Dinheiro, PIX, Cartão Crédito..." autofocus />
        <label>Tipo</label>
        <select id="fp-tipo">
          ${["Dinheiro","PIX","Cartão Crédito","Cartão Débito","Transferência","Boleto","Cheque","Outro"].map(t =>
            `<option value="${t}" ${fp.tipo === t ? "selected" : ""}>${t}</option>`
          ).join("")}
        </select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label>Parcelas máximas</label>
            <input id="fp-parc" type="number" min="1" max="36" value="${fp.parcelas_max || 1}" />
          </div>
          <div>
            <label>Taxa (%)</label>
            <input id="fp-taxa" type="number" min="0" step="0.01" value="${fp.taxa || 0}" />
          </div>
        </div>
        <label>Status</label>
        <select id="fp-ativa">
          <option value="true"  ${fp.ativa !== false ? "selected" : ""}>● Ativa</option>
          <option value="false" ${fp.ativa === false  ? "selected" : ""}>○ Inativa</option>
        </select>
        <div class="modal-btns">
          <button class="btn-secondary" id="fp-cancel">Cancelar</button>
          <button class="btn-primary"   id="fp-ok">Salvar</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#fp-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") area.innerHTML = ""; });
  area.querySelector("#fp-ok").addEventListener("click", async () => {
    const nome = area.querySelector("#fp-nome").value.trim();
    if (!nome) { alert("Informe o nome."); return; }
    const dados = {
      nome,
      tipo:         area.querySelector("#fp-tipo").value,
      parcelas_max: parseInt(area.querySelector("#fp-parc").value) || 1,
      taxa:         parseFloat(area.querySelector("#fp-taxa").value) || 0,
      ativa:        area.querySelector("#fp-ativa").value === "true",
    };
    if (editando) {
      state.formasPagamento[idx] = dados;
    } else {
      state.formasPagamento.push(dados);
    }
    area.innerHTML = "";
    await salvarFormasPagamento(container);
    state.msg = { tipo: "ok", texto: editando ? "Forma de pagamento atualizada!" : "Forma de pagamento adicionada!" };
    render(container);
  });
}

async function salvarFormasPagamento(container) {
  await supabase.from("configuracoes").update({
    formas_pagamento: JSON.stringify(state.formasPagamento),
    updated_at: new Date(),
  }).eq("id", "global");
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: IMPRESSÃO
// ══════════════════════════════════════════════════════════════════════════════
function renderImpressao(content, container) {
  const c = state.cfg;
  content.innerHTML = `
    <div class="cfg-section-title">🖨️ Configurações de Impressão</div>
    <div class="cfg-hint">Defina o que aparece nos documentos impressos — orçamentos, vendas e ordens de serviço.</div>

    <!-- Geral -->
    <div class="cfg-card">
      <div class="cfg-card-title">⚙️ Geral</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>Tamanho do papel padrão</label>
          <select id="imp-papel">
            ${["A4","A5","Letter"].map(p => `<option value="${p}" ${(c.imp_papel||"A4")===p?"selected":""}>${p}</option>`).join("")}
          </select>
        </div>
        <div class="cfg-group">
          <label>Orientação padrão</label>
          <select id="imp-orient">
            <option value="retrato"   ${(c.imp_orientacao||"retrato")==="retrato"?"selected":""}>Retrato</option>
            <option value="paisagem"  ${c.imp_orientacao==="paisagem"?"selected":""}>Paisagem</option>
          </select>
        </div>
        <div class="cfg-group full">
          <label>Cabeçalho personalizado (HTML simples ou texto)</label>
          <textarea id="imp-cabecalho" rows="3" placeholder="Ex: Gráfica Master Print | Tel: (xx) xxxxx-xxxx">${esc(c.imp_cabecalho)}</textarea>
        </div>
        <div class="cfg-group full">
          <label>Rodapé personalizado</label>
          <textarea id="imp-rodape-imp" rows="2" placeholder="Ex: Obrigado pela preferência!">${esc(c.imp_rodape)}</textarea>
        </div>
        <div class="cfg-group">
          <label>Exibir logo no cabeçalho?</label>
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
      </div>
    </div>

    <!-- Orçamento -->
    <div class="cfg-card">
      <div class="cfg-card-title">📋 Orçamento</div>
      <div class="cfg-grid">
        <div class="cfg-group full">
          <label>Título do documento</label>
          <input id="imp-orc-titulo" value="${esc(c.imp_orc_titulo) || "ORÇAMENTO"}" placeholder="ORÇAMENTO" />
        </div>
        <div class="cfg-group full">
          <label>Observações padrão (pré-preenchidas em todo orçamento)</label>
          <textarea id="imp-orc-obs" rows="3" placeholder="Ex: Validade: 15 dias. Prazo de produção: 3 dias úteis.">${esc(c.imp_orc_obs)}</textarea>
        </div>
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

    <!-- Venda / Nota -->
    <div class="cfg-card">
      <div class="cfg-card-title">🛒 Venda / Nota de Venda</div>
      <div class="cfg-grid">
        <div class="cfg-group full">
          <label>Título do documento</label>
          <input id="imp-vnd-titulo" value="${esc(c.imp_vnd_titulo) || "NOTA DE VENDA"}" placeholder="NOTA DE VENDA" />
        </div>
        <div class="cfg-group full">
          <label>Observações padrão</label>
          <textarea id="imp-vnd-obs" rows="3" placeholder="Ex: Não nos responsabilizamos por erros após aprovação do cliente.">${esc(c.imp_vnd_obs)}</textarea>
        </div>
        <div class="cfg-group">
          <label>Exibir número do pedido?</label>
          <select id="imp-vnd-num">
            <option value="sim" ${(c.imp_vnd_numero||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.imp_vnd_numero==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Ordem de Serviço -->
    <div class="cfg-card">
      <div class="cfg-card-title">📄 Ordem de Serviço (OS)</div>
      <div class="cfg-grid">
        <div class="cfg-group full">
          <label>Título do documento</label>
          <input id="imp-os-titulo" value="${esc(c.imp_os_titulo) || "ORDEM DE SERVIÇO"}" placeholder="ORDEM DE SERVIÇO" />
        </div>
        <div class="cfg-group full">
          <label>Observações padrão</label>
          <textarea id="imp-os-obs" rows="3" placeholder="Ex: Arquivo de arte deve ser enviado em alta resolução (300dpi).">${esc(c.imp_os_obs)}</textarea>
        </div>
        <div class="cfg-group">
          <label>Exibir campos de assinatura?</label>
          <select id="imp-os-assin">
            <option value="sim" ${(c.imp_os_assinatura||"sim")==="sim"?"selected":""}>✅ Sim</option>
            <option value="nao" ${c.imp_os_assinatura==="nao"?"selected":""}>❌ Não</option>
          </select>
        </div>
        <div class="cfg-group">
          <label>Exibir campo de data de entrega?</label>
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

  content.querySelector("#btn-salvar-imp").addEventListener("click", async () => {
    await salvarCfg(container, {
      imp_papel:            v("#imp-papel"),
      imp_orientacao:       v("#imp-orient"),
      imp_cabecalho:        v("#imp-cabecalho"),
      imp_rodape:           v("#imp-rodape-imp"),
      imp_mostrar_logo:     v("#imp-logo"),
      imp_mostrar_empresa:  v("#imp-dados-emp"),
      imp_orc_titulo:       v("#imp-orc-titulo"),
      imp_orc_obs:          v("#imp-orc-obs"),
      imp_orc_custo:        v("#imp-orc-custo"),
      imp_orc_margem:       v("#imp-orc-margem"),
      imp_vnd_titulo:       v("#imp-vnd-titulo"),
      imp_vnd_obs:          v("#imp-vnd-obs"),
      imp_vnd_numero:       v("#imp-vnd-num"),
      imp_os_titulo:        v("#imp-os-titulo"),
      imp_os_obs:           v("#imp-os-obs"),
      imp_os_assinatura:    v("#imp-os-assin"),
      imp_os_data_entrega:  v("#imp-os-data"),
    }, content);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: TRELLO
// ══════════════════════════════════════════════════════════════════════════════
function renderTrello(content, container) {
  const c = state.cfg;
  const temCredenciais = c.trello_api_key && c.trello_token;
  const temConfig = temCredenciais && c.trello_board_id;

  content.innerHTML = `
    <div class="cfg-section-title">🔗 Integração Trello</div>
    <div class="cfg-hint">
      Integre a produção ao Trello para sincronizar cards automaticamente.
      Obtenha sua API Key em <a href="https://trello.com/power-ups/admin" target="_blank" style="color:var(--accent)">trello.com/power-ups/admin</a>.
    </div>

    ${temConfig
      ? `<div class="trello-ok">✅ Trello configurado e ativo.</div>`
      : `<div class="trello-warn">⚠️ Preencha as credenciais e clique em "Carregar Quadros".</div>`
    }

    <div class="cfg-card">
      <div class="cfg-card-title">🔑 Credenciais</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>API Key</label>
          <input id="t-key" type="password" value="${esc(c.trello_api_key)}" placeholder="Cole sua API Key aqui" />
        </div>
        <div class="cfg-group">
          <label>Token</label>
          <input id="t-token" type="password" value="${esc(c.trello_token)}" placeholder="Cole o Token aqui" />
        </div>
      </div>
      <div class="cfg-acoes" style="margin-top:10px">
        <button class="btn-primary" id="btn-carregar-quadros">
          🔄 Carregar Quadros
        </button>
      </div>
    </div>

    <div class="cfg-card" id="card-quadros" style="${temCredenciais ? "" : "display:none"}">
      <div class="cfg-card-title">📋 Selecionar Quadro</div>
      <div class="cfg-group full">
        <label>Quadro do Trello</label>
        <select id="t-board">
          <option value="">Clique em "Carregar Quadros" primeiro...</option>
          ${c.trello_board_id ? `<option value="${esc(c.trello_board_id)}" selected>Quadro atual: ${esc(c.trello_board_id)}</option>` : ""}
        </select>
      </div>
      <div class="cfg-acoes" style="margin-top:10px">
        <button class="btn-primary" id="btn-carregar-listas" ${c.trello_board_id ? "" : "disabled"}>
          📋 Carregar Listas do Quadro
        </button>
      </div>
    </div>

    <div class="cfg-card" id="card-listas" style="${c.trello_board_id ? "" : "display:none"}">
      <div class="cfg-card-title">📋 IDs das Listas (colunas do quadro)</div>
      <div class="cfg-hint" style="margin-bottom:12px">Selecione qual lista corresponde a cada etapa da produção.</div>
      <div class="cfg-grid">
        <div class="cfg-group">
          <label>🕐 Fila</label>
          <select id="t-l1"><option value="${esc(c.trello_list_fila||"")}">Carregar listas...</option></select>
        </div>
        <div class="cfg-group">
          <label>🖨️ Imprimindo</label>
          <select id="t-l2"><option value="${esc(c.trello_list_imprimindo||"")}">Carregar listas...</option></select>
        </div>
        <div class="cfg-group">
          <label>✂️ Acabamento</label>
          <select id="t-l3"><option value="${esc(c.trello_list_acabamento||"")}">Carregar listas...</option></select>
        </div>
        <div class="cfg-group">
          <label>✅ Pronto</label>
          <select id="t-l4"><option value="${esc(c.trello_list_pronto||"")}">Carregar listas...</option></select>
        </div>
      </div>
    </div>

    <div class="cfg-acoes" style="gap:10px">
      <button class="btn-primary" id="btn-salvar-trello">💾 Salvar integração Trello</button>
      ${temConfig ? `<button class="btn-danger" id="btn-limpar-trello">🗑 Remover integração</button>` : ""}
    </div>
  `;

  // ── Carregar quadros ──
  content.querySelector("#btn-carregar-quadros").addEventListener("click", async () => {
    const key   = content.querySelector("#t-key").value.trim();
    const token = content.querySelector("#t-token").value.trim();
    if (!key || !token) { alert("Preencha a API Key e o Token primeiro."); return; }

    const btn = content.querySelector("#btn-carregar-quadros");
    btn.textContent = "⏳ Carregando..."; btn.disabled = true;

    try {
      const res  = await fetch(`https://api.trello.com/1/members/me/boards?key=${key}&token=${token}&filter=open&fields=id,name`);
      if (!res.ok) throw new Error("Credenciais inválidas ou sem acesso.");
      const boards = await res.json();

      const select = content.querySelector("#t-board");
      select.innerHTML = `<option value="">Selecione um quadro...</option>` +
        boards.map(b => `<option value="${b.id}" ${b.id === c.trello_board_id ? "selected" : ""}>${b.name}</option>`).join("");

      content.querySelector("#card-quadros").style.display = "";
      content.querySelector("#btn-carregar-listas").disabled = false;

      // Se já tem board salvo, carregar listas automaticamente
      if (c.trello_board_id) {
        await carregarListas(key, token, c.trello_board_id, content, c);
      }
    } catch (err) {
      alert("Erro ao conectar com o Trello: " + err.message);
    } finally {
      btn.textContent = "🔄 Carregar Quadros"; btn.disabled = false;
    }
  });

  // ── Carregar listas ao selecionar quadro ──
  content.querySelector("#btn-carregar-listas").addEventListener("click", async () => {
    const key     = content.querySelector("#t-key").value.trim();
    const token   = content.querySelector("#t-token").value.trim();
    const boardId = content.querySelector("#t-board").value;
    if (!boardId) { alert("Selecione um quadro primeiro."); return; }
    await carregarListas(key, token, boardId, content, c);
  });

  // ── Salvar ──
  content.querySelector("#btn-salvar-trello").addEventListener("click", async () => {
    await salvarCfg(container, {
      trello_api_key:         content.querySelector("#t-key").value.trim()   || null,
      trello_token:           content.querySelector("#t-token").value.trim() || null,
      trello_board_id:        content.querySelector("#t-board").value        || null,
      trello_list_fila:       content.querySelector("#t-l1").value           || null,
      trello_list_imprimindo: content.querySelector("#t-l2").value           || null,
      trello_list_acabamento: content.querySelector("#t-l3").value           || null,
      trello_list_pronto:     content.querySelector("#t-l4").value           || null,
    }, content);
  });

  content.querySelector("#btn-limpar-trello")?.addEventListener("click", async () => {
    if (!confirm("Remover a integração com o Trello?")) return;
    await salvarCfg(container, {
      trello_api_key: null, trello_token: null, trello_board_id: null,
      trello_list_fila: null, trello_list_imprimindo: null,
      trello_list_acabamento: null, trello_list_pronto: null,
    }, content);
  });
}

async function carregarListas(key, token, boardId, content, cfgAtual) {
  const btn = content.querySelector("#btn-carregar-listas");
  if (btn) { btn.textContent = "⏳ Carregando..."; btn.disabled = true; }

  try {
    const res   = await fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${key}&token=${token}&filter=open&fields=id,name`);
    if (!res.ok) throw new Error("Não foi possível carregar as listas.");
    const listas = await res.json();

    const IDS = ["t-l1","t-l2","t-l3","t-l4"];
    const VALS = [cfgAtual.trello_list_fila, cfgAtual.trello_list_imprimindo, cfgAtual.trello_list_acabamento, cfgAtual.trello_list_pronto];

    IDS.forEach((id, i) => {
      const sel = content.querySelector(`#${id}`);
      if (!sel) return;
      sel.innerHTML = `<option value="">Selecione uma lista...</option>` +
        listas.map(l => `<option value="${l.id}" ${l.id === VALS[i] ? "selected" : ""}>${l.name}</option>`).join("");
    });

    content.querySelector("#card-listas").style.display = "";
  } catch (err) {
    alert("Erro ao carregar listas: " + err.message);
  } finally {
    if (btn) { btn.textContent = "📋 Carregar Listas do Quadro"; btn.disabled = false; }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function v(sel, container = document) {
  const el = container.querySelector ? container.querySelector(sel) : document.querySelector(sel);
  return el?.value?.trim() || null;
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function salvarCfg(container, dados, content) {
  const btn = content?.querySelector("[id^='btn-salvar']");
  if (btn) { btn.disabled = true; btn.textContent = "Salvando..."; }

  const { error } = await supabase.from("configuracoes").update({
    ...dados,
    updated_at: new Date(),
  }).eq("id", "global");

  if (btn) { btn.disabled = false; }

  if (error) {
    state.msg = { tipo: "erro", texto: "Erro ao salvar: " + error.message };
  } else {
    state.msg = { tipo: "ok", texto: "Configurações salvas com sucesso!" };
    await recarregar(container);
  }
  render(container);
}

async function recarregar(container) {
  await carregar();
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function css() { return `
  /* Layout */
  .cfg-wrap { display:flex; gap:0; min-height:calc(100vh - 80px); }

  /* Sidebar */
  .cfg-sidebar { width:220px; flex-shrink:0; background:var(--panel); border-right:1px solid rgba(255,255,255,0.06); padding:16px 10px; border-radius:14px 0 0 14px; }
  .cfg-sidebar-title { font-size:11px; font-weight:700; color:var(--muted); letter-spacing:.08em; text-transform:uppercase; padding:4px 8px; margin-bottom:10px; }
  .cfg-nav-btn { display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:9px; border:none; background:transparent; color:var(--muted); cursor:pointer; font-size:13px; text-align:left; transition:all .15s; }
  .cfg-nav-btn:hover { background:rgba(255,255,255,0.04); color:var(--text); }
  .cfg-nav-btn.active { background:rgba(106,166,255,0.12); color:var(--accent); border:1px solid rgba(106,166,255,0.2); }
  .cfg-nav-emoji { font-size:16px; }

  /* Body */
  .cfg-body { flex:1; padding:20px 24px; overflow-y:auto; }

  /* Toast */
  .cfg-toast { border-radius:10px; padding:10px 16px; font-size:13px; margin-bottom:16px; }
  .cfg-toast.ok  { background:rgba(105,219,124,0.12); border:1px solid #69db7c44; color:#69db7c; }
  .cfg-toast.erro{ background:rgba(255,107,107,0.12); border:1px solid #ff6b6b44; color:#ff6b6b; }

  /* Seção */
  .cfg-section-title { font-size:18px; font-weight:700; margin-bottom:16px; }
  .cfg-section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .cfg-section-header .cfg-section-title { margin-bottom:0; }
  .cfg-hint { font-size:12px; color:var(--muted); margin-bottom:14px; line-height:1.5; }

  /* Cards de conteúdo */
  .cfg-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:18px; margin-bottom:14px; }
  .cfg-card-title { font-size:13px; font-weight:700; color:var(--muted); margin-bottom:14px; text-transform:uppercase; letter-spacing:.04em; }

  /* Grid de campos */
  .cfg-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  @media(max-width:700px){ .cfg-grid { grid-template-columns:1fr; } }
  .cfg-group { display:flex; flex-direction:column; gap:5px; }
  .cfg-group.full { grid-column:1/-1; }
  .cfg-group label { font-size:12px; color:var(--muted); }
  .cfg-group input, .cfg-group select, .cfg-group textarea {
    background:var(--panel); border:1px solid rgba(255,255,255,0.1);
    color:var(--text); border-radius:8px; padding:9px 12px; font-size:13px;
    transition:border-color .15s;
  }
  .cfg-group input:focus, .cfg-group select:focus, .cfg-group textarea:focus {
    outline:none; border-color:rgba(106,166,255,0.4);
  }
  .cfg-group textarea { resize:vertical; min-height:70px; }

  .cfg-acoes { display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
  .cfg-vazio { color:var(--muted); font-size:13px; padding:24px; text-align:center; }

  /* Tabela */
  .cfg-table { width:100%; border-collapse:collapse; font-size:13px; }
  .cfg-table th { text-align:left; color:var(--muted); font-weight:500; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:12px; }
  .cfg-table td { padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.04); vertical-align:middle; }
  .cfg-table tr:last-child td { border-bottom:none; }
  .cfg-table tr:hover td { background:rgba(255,255,255,0.02); }
  .tbl-acoes { display:flex; gap:5px; justify-content:flex-end; }

  .tag-cargo { font-size:11px; background:rgba(106,166,255,0.12); color:var(--accent); padding:2px 8px; border-radius:999px; }
  .tag-status { font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; }
  .tag-status.ativo  { background:rgba(105,219,124,0.12); color:#69db7c; }
  .tag-status.inativo{ background:rgba(255,255,255,0.06); color:var(--muted); }

  /* Trello */
  .trello-ok   { background:rgba(105,219,124,0.1);border:1px solid #69db7c44;border-radius:8px;padding:10px 14px;font-size:13px;color:#69db7c;margin-bottom:14px; }
  .trello-warn { background:rgba(255,169,77,0.08);border:1px solid #ffa94d33;border-radius:8px;padding:10px 14px;font-size:13px;color:#ffa94d;margin-bottom:14px; }

  /* Botões */
  .btn-primary   { background:var(--accent);color:#000;border:none;border-radius:8px;padding:9px 20px;cursor:pointer;font-size:13px;font-weight:600; }
  .btn-primary:hover { opacity:.88; }
  .btn-primary:disabled { opacity:.5;cursor:not-allowed; }
  .btn-secondary { background:transparent;border:1px solid rgba(255,255,255,0.15);color:var(--text);border-radius:8px;padding:9px 16px;cursor:pointer;font-size:13px; }
  .btn-danger    { background:rgba(255,107,107,0.1);border:1px solid #ff6b6b44;color:#ff6b6b;border-radius:8px;padding:9px 16px;cursor:pointer;font-size:13px; }
  .btn-icon      { background:transparent;border:1px solid rgba(255,255,255,0.1);color:var(--muted);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px; }
  .btn-icon:hover { border-color:var(--accent);color:var(--accent); }
  .btn-icon.danger:hover { border-color:#ff6b6b;color:#ff6b6b; }

  /* Modal */
  .modal-bg  { position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100; }
  .modal     { background:var(--panel);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;min-width:320px;max-width:440px;width:92%;max-height:90vh;overflow-y:auto; }
  .modal h3  { margin:0 0 16px;font-size:17px; }
  .modal label { font-size:12px;color:var(--muted);display:block;margin-bottom:4px;margin-top:8px; }
  .modal input,.modal select,.modal textarea { width:100%;background:var(--panel2);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;box-sizing:border-box; }
  .modal-btns { display:flex;gap:8px;justify-content:flex-end;margin-top:16px; }

  @media(max-width:700px){
    .cfg-wrap { flex-direction:column; }
    .cfg-sidebar { width:100%;border-radius:14px 14px 0 0;border-right:none;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;flex-wrap:wrap;gap:4px;padding:10px; }
    .cfg-sidebar-title { display:none; }
    .cfg-nav-btn { width:auto;flex:1;justify-content:center; }
    .cfg-body { padding:14px; }
  }
`; }