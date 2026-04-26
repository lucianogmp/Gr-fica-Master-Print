import { supabase } from "../supabase/client.js";

const ETAPAS = {
  fila:        { label: "Fila",        cor: "#9fb0d0", emoji: "🕐" },
  imprimindo:  { label: "Imprimindo",  cor: "#74c0fc", emoji: "🖨️" },
  acabamento:  { label: "Acabamento",  cor: "#ffa94d", emoji: "✂️" },
  pronto:      { label: "Pronto",      cor: "#69db7c", emoji: "✅" },
};

const PRIORIDADES = {
  baixa:   { label: "Baixa",   cor: "#9fb0d0" },
  normal:  { label: "Normal",  cor: "#74c0fc" },
  alta:    { label: "Alta",    cor: "#ffa94d" },
  urgente: { label: "Urgente", cor: "#ff6b6b" },
};

let state = {
  itens: [],
  vendas: [],
  cfg: null,
  filtroEtapa: "",
  trelloStatus: null, // null | "ok" | "erro" | "sem_config"
};

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function Producao(container) {
  container.innerHTML = `<div class="loading">Carregando produção...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const [{ data: itens }, { data: vendas }, { data: cfg }] = await Promise.all([
    supabase.from("producao").select("*").order("data_entrega", { ascending: true, nullsFirst: false }),
    supabase.from("vendas").select("id, numero, cliente_nome, status")
      .in("status", ["pendente","em_producao","pronto"]),
    supabase.from("configuracoes").select("*").eq("id","global").single(),
  ]);
  state.itens  = itens || [];
  state.vendas = vendas || [];
  state.cfg    = cfg || {};
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render(container) {
  const cfg = state.cfg;
  const temTrello = cfg?.trello_api_key && cfg?.trello_token && cfg?.trello_board_id;

  const filtrados = state.filtroEtapa
    ? state.itens.filter(i => i.etapa === state.filtroEtapa)
    : state.itens;

  const porEtapa = Object.fromEntries(
    Object.keys(ETAPAS).map(e => [e, state.itens.filter(i=>i.etapa===e).length])
  );

  container.innerHTML = `
    <style>
      ${css()}
    </style>

    <div class="prod-header">
      <h2>Produção</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${temTrello
          ? `<button class="btn-trello" id="btn-sync">🔄 Sincronizar Trello</button>`
          : `<button class="btn-secondary" id="btn-cfg-trello">⚙️ Configurar Trello</button>`
        }
        <button class="btn-secondary" id="btn-de-venda">+ Da Venda</button>
        <button class="btn-primary"   id="btn-novo">+ Manual</button>
      </div>
    </div>

    <!-- Trello status -->
    ${state.trelloStatus === "ok"   ? `<div class="trello-ok">✅ Trello sincronizado com sucesso!</div>` : ""}
    ${state.trelloStatus === "erro" ? `<div class="trello-err">❌ Erro ao sincronizar com Trello. Verifique as configurações.</div>` : ""}
    ${!temTrello ? `<div class="trello-warn">⚙️ Trello não configurado. Configure em <b>Configurações → Trello</b> para ativar a integração.</div>` : ""}

    <!-- Contadores por etapa -->
    <div class="etapa-tabs">
      <button class="etapa-tab ${!state.filtroEtapa?"active":""}" data-etapa="">
        Todos <span class="etapa-num">${state.itens.length}</span>
      </button>
      ${Object.entries(ETAPAS).map(([key, e]) => `
        <button class="etapa-tab ${state.filtroEtapa===key?"active":""}" data-etapa="${key}" style="${state.filtroEtapa===key?`border-color:${e.cor};color:${e.cor}`:""}">
          ${e.emoji} ${e.label} <span class="etapa-num">${porEtapa[key]||0}</span>
        </button>`).join("")}
    </div>

    <!-- Lista -->
    <div id="prod-lista">
      ${filtrados.length === 0
        ? `<div class="prod-vazio">Nenhum item${state.filtroEtapa?" nessa etapa":""} ainda.</div>`
        : filtrados.map(item => renderItemHtml(item)).join("")
      }
    </div>

    <div id="modal-area"></div>
  `;

  // Filtros
  container.querySelectorAll("[data-etapa]").forEach(b =>
    b.addEventListener("click", () => { state.filtroEtapa = b.dataset.etapa; render(container); })
  );

  // Botões topo
  container.querySelector("#btn-novo").addEventListener("click", () => abrirModal(container, "manual"));
  container.querySelector("#btn-de-venda")?.addEventListener("click", () => abrirModal(container, "venda"));
  container.querySelector("#btn-sync")?.addEventListener("click", () => sincronizarTrello(container));
  container.querySelector("#btn-cfg-trello")?.addEventListener("click", () => abrirModalTrello(container));

  // Eventos dos cards
  bindCardEvents(container);
}

function renderItemHtml(item) {
  const etapa = ETAPAS[item.etapa];
  const prio  = PRIORIDADES[item.prioridade||"normal"];
  const hoje  = new Date().toISOString().split("T")[0];
  const atrasado = item.data_entrega && item.data_entrega < hoje && item.etapa !== "pronto";

  return `
    <div class="prod-card ${atrasado?"atrasado":""}" data-id="${item.id}">
      <div class="card-top">
        <span class="prio-badge" style="background:${prio.cor}22;color:${prio.cor}">${prio.label}</span>
        <span class="etapa-badge" style="background:${etapa.cor}22;color:${etapa.cor}">${etapa.emoji} ${etapa.label}</span>
        ${item.trello_card_id ? `<span class="trello-badge">🔗 Trello</span>` : ""}
        ${atrasado ? `<span style="color:#ff6b6b;font-size:11px;font-weight:700">⚠️ ATRASADO</span>` : ""}
        <div style="flex:1"></div>
        <button class="btn-icon" data-edit="${item.id}">✏️</button>
        <button class="btn-icon danger" data-del="${item.id}">🗑</button>
      </div>

      <div class="card-titulo">${item.titulo}</div>
      ${item.descricao ? `<div class="card-desc">${item.descricao}</div>` : ""}

      <div class="card-footer">
        ${item.responsavel ? `<span>👤 ${item.responsavel}</span>` : ""}
        ${item.data_entrega ? `<span ${atrasado?'style="color:#ff6b6b;font-weight:700"':""}>📅 ${formatData(item.data_entrega)}</span>` : ""}
      </div>

      <!-- Avançar/Voltar etapa -->
      <div class="card-etapas">
        ${Object.keys(ETAPAS).map(e => `
          <button class="etapa-pill ${item.etapa===e?"current":""}"
            data-mover="${item.id}" data-etapa="${e}"
            style="${item.etapa===e?`background:${ETAPAS[e].cor}22;border-color:${ETAPAS[e].cor};color:${ETAPAS[e].cor}`:""}">
            ${ETAPAS[e].emoji}
          </button>`).join("")}
      </div>
    </div>`;
}

function bindCardEvents(container) {
  container.querySelector("#prod-lista").addEventListener("click", async e => {
    // Mover etapa
    const mover = e.target.closest("[data-mover]");
    if (mover && !e.target.closest("[data-edit],[data-del]")) {
      const { id: itemId, etapa } = mover.dataset;
      if (!mover.dataset.etapa) return;
      await supabase.from("producao").update({ etapa: mover.dataset.etapa, updated_at: new Date() }).eq("id", itemId);

      // Sync Trello se tiver card vinculado
      const item = state.itens.find(i => i.id === itemId);
      if (item?.trello_card_id && state.cfg?.trello_api_key) {
        await moverCardTrello(item.trello_card_id, mover.dataset.etapa);
      }

      await recarregar(container);
      return;
    }

    const edit = e.target.closest("[data-edit]");
    if (edit) {
      const item = state.itens.find(i => i.id === edit.dataset.edit);
      abrirModal(container, "editar", item);
      return;
    }

    const del = e.target.closest("[data-del]");
    if (del) {
      if (!confirm("Remover da produção?")) return;
      await supabase.from("producao").delete().eq("id", del.dataset.del);
      await recarregar(container);
    }
  });
}

// ─── Modal novo/editar ────────────────────────────────────────────────────────
function abrirModal(container, tipo, dados = {}) {
  const area = container.querySelector("#modal-area");
  const editando = tipo === "editar";

  const etapaOptions = Object.entries(ETAPAS).map(([k,e]) =>
    `<option value="${k}" ${(dados.etapa||"fila")===k?"selected":""}>${e.emoji} ${e.label}</option>`
  ).join("");

  const prioOptions = Object.entries(PRIORIDADES).map(([k,p]) =>
    `<option value="${k}" ${(dados.prioridade||"normal")===k?"selected":""}>${p.label}</option>`
  ).join("");

  // Vendas disponíveis para vincular
  const vendasOptions = state.vendas.map(v =>
    `<option value="${v.id}">#${v.numero} — ${v.cliente_nome||"Sem cliente"}</option>`
  ).join("");

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3>${editando ? "Editar item" : tipo==="venda" ? "Adicionar da Venda" : "Novo item manual"}</h3>

        ${tipo === "venda" && !editando ? `
          <label>Venda</label>
          <select id="m-venda">
            <option value="">Selecionar venda...</option>
            ${vendasOptions}
          </select>` : ""}

        <label>Título *</label>
        <input id="m-titulo" value="${dados.titulo||""}" placeholder="Ex: Banner 1×2m — João Silva" autofocus />
        <label>Descrição</label>
        <textarea id="m-desc" placeholder="Detalhes do serviço...">${dados.descricao||""}</textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label>Etapa</label>
            <select id="m-etapa">${etapaOptions}</select>
          </div>
          <div>
            <label>Prioridade</label>
            <select id="m-prio">${prioOptions}</select>
          </div>
        </div>
        <label>Responsável</label>
        <input id="m-resp" value="${dados.responsavel||""}" placeholder="Nome do operador" />
        <label>Data de entrega</label>
        <input id="m-data" type="date" value="${dados.data_entrega||""}" />

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn-secondary" id="m-cancel">Cancelar</button>
          <button class="btn-primary" id="m-ok">Salvar</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#m-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id==="modal-bg") area.innerHTML=""; });

  // Auto-preenche título ao selecionar venda
  area.querySelector("#m-venda")?.addEventListener("change", e => {
    const v = state.vendas.find(v => v.id === e.target.value);
    if (v) area.querySelector("#m-titulo").value = `Pedido #${v.numero} — ${v.cliente_nome||"Sem cliente"}`;
  });

  area.querySelector("#m-ok").addEventListener("click", async () => {
    const titulo = area.querySelector("#m-titulo").value.trim();
    if (!titulo) { alert("Informe o título."); return; }

    const payload = {
      titulo,
      descricao:    area.querySelector("#m-desc").value.trim()||null,
      etapa:        area.querySelector("#m-etapa").value,
      prioridade:   area.querySelector("#m-prio").value,
      responsavel:  area.querySelector("#m-resp").value.trim()||null,
      data_entrega: area.querySelector("#m-data").value||null,
      updated_at:   new Date(),
    };

    if (tipo === "venda" && !editando) {
      payload.venda_id = area.querySelector("#m-venda")?.value || null;
    }

    if (editando) {
      await supabase.from("producao").update(payload).eq("id", dados.id);
    } else {
      const { data: novo } = await supabase.from("producao").insert(payload).select().single();

      // Cria card no Trello se configurado
      if (state.cfg?.trello_api_key && state.cfg?.trello_token) {
        const cardId = await criarCardTrello(novo, payload.etapa);
        if (cardId) await supabase.from("producao").update({ trello_card_id: cardId }).eq("id", novo.id);
      }
    }

    area.innerHTML = "";
    await recarregar(container);
  });
}

// ─── Trello helpers ───────────────────────────────────────────────────────────
function listIdParaEtapa(etapa) {
  const cfg = state.cfg;
  return {
    fila:       cfg.trello_list_fila,
    imprimindo: cfg.trello_list_imprimindo,
    acabamento: cfg.trello_list_acabamento,
    pronto:     cfg.trello_list_pronto,
  }[etapa];
}

async function criarCardTrello(item, etapa) {
  const cfg = state.cfg;
  const listId = listIdParaEtapa(etapa);
  if (!listId) return null;
  try {
    const res = await fetch(
      `https://api.trello.com/1/cards?key=${cfg.trello_api_key}&token=${cfg.trello_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idList: listId,
          name: item.titulo,
          desc: item.descricao || "",
          due: item.data_entrega || null,
        }),
      }
    );
    const data = await res.json();
    return data.id || null;
  } catch { return null; }
}

async function moverCardTrello(cardId, etapa) {
  const cfg = state.cfg;
  const listId = listIdParaEtapa(etapa);
  if (!listId || !cardId) return;
  try {
    await fetch(
      `https://api.trello.com/1/cards/${cardId}?key=${cfg.trello_api_key}&token=${cfg.trello_token}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idList: listId }),
      }
    );
  } catch {}
}

async function sincronizarTrello(container) {
  const cfg = state.cfg;
  if (!cfg?.trello_api_key || !cfg?.trello_token || !cfg?.trello_board_id) {
    state.trelloStatus = "erro"; render(container); return;
  }

  try {
    // Busca todos os cards do board
    const res = await fetch(
      `https://api.trello.com/1/boards/${cfg.trello_board_id}/cards?key=${cfg.trello_api_key}&token=${cfg.trello_token}`
    );
    const cards = await res.json();

    // Para cada item nosso com trello_card_id, atualiza a etapa
    const listMap = {
      [cfg.trello_list_fila]:       "fila",
      [cfg.trello_list_imprimindo]: "imprimindo",
      [cfg.trello_list_acabamento]: "acabamento",
      [cfg.trello_list_pronto]:     "pronto",
    };

    for (const item of state.itens.filter(i => i.trello_card_id)) {
      const card = cards.find(c => c.id === item.trello_card_id);
      if (card && listMap[card.idList] && listMap[card.idList] !== item.etapa) {
        await supabase.from("producao").update({ etapa: listMap[card.idList] }).eq("id", item.id);
      }
    }

    state.trelloStatus = "ok";
  } catch {
    state.trelloStatus = "erro";
  }

  await recarregar(container);
  setTimeout(() => { state.trelloStatus = null; render(container); }, 3000);
}

// ─── Modal configuração Trello ────────────────────────────────────────────────
function abrirModalTrello(container) {
  const area = container.querySelector("#modal-area");
  const cfg  = state.cfg || {};

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:500px">
        <h3>⚙️ Configurar Trello</h3>
        <p style="font-size:12px;color:var(--muted);margin:0 0 14px">
          Obtenha sua API Key em <b>trello.com/power-ups/admin</b> e gere o Token em seguida.
        </p>
        <label>API Key</label>
        <input id="t-key"   value="${cfg.trello_api_key||""}"   placeholder="API Key do Trello" />
        <label>Token</label>
        <input id="t-token" value="${cfg.trello_token||""}"     placeholder="Token do Trello" />
        <label>Board ID</label>
        <input id="t-board" value="${cfg.trello_board_id||""}"  placeholder="ID do quadro (URL do board)" />
        <hr style="border-color:rgba(255,255,255,0.06);margin:12px 0" />
        <p style="font-size:12px;color:var(--muted);margin:0 0 10px">IDs das listas (aba de cada etapa no Trello):</p>
        <label>Lista — Fila</label>
        <input id="t-l1" value="${cfg.trello_list_fila||""}"       placeholder="ID da lista Fila" />
        <label>Lista — Imprimindo</label>
        <input id="t-l2" value="${cfg.trello_list_imprimindo||""}" placeholder="ID da lista Imprimindo" />
        <label>Lista — Acabamento</label>
        <input id="t-l3" value="${cfg.trello_list_acabamento||""}" placeholder="ID da lista Acabamento" />
        <label>Lista — Pronto</label>
        <input id="t-l4" value="${cfg.trello_list_pronto||""}"     placeholder="ID da lista Pronto" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn-secondary" id="m-cancel">Cancelar</button>
          <button class="btn-primary"   id="m-ok">Salvar</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#m-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id==="modal-bg") area.innerHTML=""; });
  area.querySelector("#m-ok").addEventListener("click", async () => {
    await supabase.from("configuracoes").update({
      trello_api_key:          area.querySelector("#t-key").value.trim()||null,
      trello_token:            area.querySelector("#t-token").value.trim()||null,
      trello_board_id:         area.querySelector("#t-board").value.trim()||null,
      trello_list_fila:        area.querySelector("#t-l1").value.trim()||null,
      trello_list_imprimindo:  area.querySelector("#t-l2").value.trim()||null,
      trello_list_acabamento:  area.querySelector("#t-l3").value.trim()||null,
      trello_list_pronto:      area.querySelector("#t-l4").value.trim()||null,
      updated_at: new Date(),
    }).eq("id","global");
    area.innerHTML = "";
    await recarregar(container);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatData(d) {
  if (!d) return "";
  const [y,m,dia] = d.split("-");
  return `${dia}/${m}/${y}`;
}

function css() { return `
  .prod-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px; }
  .prod-header h2 { margin:0; }
  .trello-ok   { background:rgba(105,219,124,0.1);border:1px solid #69db7c44;border-radius:8px;padding:8px 14px;font-size:13px;color:#69db7c;margin-bottom:10px; }
  .trello-err  { background:rgba(255,107,107,0.1);border:1px solid #ff6b6b44;border-radius:8px;padding:8px 14px;font-size:13px;color:#ff6b6b;margin-bottom:10px; }
  .trello-warn { background:rgba(255,169,77,0.08);border:1px solid #ffa94d33;border-radius:8px;padding:8px 14px;font-size:13px;color:#ffa94d;margin-bottom:10px; }
  .etapa-tabs { display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px; }
  .etapa-tab { padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.1);background:var(--panel2);color:var(--muted);cursor:pointer;font-size:12px;display:flex;align-items:center;gap:6px; }
  .etapa-tab.active { border-color:var(--accent);background:rgba(106,166,255,0.1);color:var(--accent); }
  .etapa-num { background:rgba(255,255,255,0.08);border-radius:999px;padding:1px 7px;font-size:11px; }
  #prod-lista { display:flex;flex-direction:column;gap:10px; }
  .prod-card { background:var(--panel2);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px; }
  .prod-card.atrasado { border-color:#ff6b6b44;background:rgba(255,107,107,0.04); }
  .card-top { display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px; }
  .prio-badge,.etapa-badge,.trello-badge { font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px; }
  .trello-badge { background:rgba(0,121,191,0.15);color:#579ddb; }
  .card-titulo { font-weight:600;font-size:15px;margin-bottom:4px; }
  .card-desc { font-size:13px;color:var(--muted);margin-bottom:6px; }
  .card-footer { display:flex;gap:14px;font-size:12px;color:var(--muted);margin-bottom:8px; }
  .card-etapas { display:flex;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.05); }
  .etapa-pill { padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:var(--muted);cursor:pointer;font-size:13px; }
  .etapa-pill:hover { border-color:var(--accent); }
  .etapa-pill.current { font-weight:700; }
  .prod-vazio { color:var(--muted);text-align:center;padding:40px; }
  .btn-primary  { background:var(--accent);color:#000;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600; }
  .btn-secondary{ background:transparent;border:1px solid rgba(255,255,255,0.15);color:var(--text);border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px; }
  .btn-trello   { background:rgba(0,121,191,0.15);border:1px solid #579ddb44;color:#579ddb;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600; }
  .btn-icon     { background:transparent;border:1px solid rgba(255,255,255,0.1);color:var(--muted);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:12px; }
  .btn-icon.danger:hover { border-color:#ff6b6b;color:#ff6b6b; }
  .modal-bg { position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100; }
  .modal { background:var(--panel);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;min-width:320px;max-width:460px;width:92%;max-height:90vh;overflow-y:auto; }
  .modal h3 { margin:0 0 14px; }
  .modal label { font-size:12px;color:var(--muted);display:block;margin-bottom:4px; }
  .modal input,.modal select,.modal textarea { width:100%;background:var(--panel2);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;box-sizing:border-box;margin-bottom:10px; }
  .modal textarea { resize:vertical;min-height:60px; }
`; }

async function recarregar(container) {
  await carregar();
  render(container);
}