import { supabase } from "../supabase/client.js";

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  aba: "saldo",        // "saldo" | "historico" | "materias"
  materias: [],        // matérias-primas com saldo calculado
  movimentos: [],
  filtroMp: "",
  buscaSaldo: "",
  buscaMaterias: "",
};

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function Estoque(container) {
  container.innerHTML = `<div class="loading">Carregando estoque...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const [{ data: mps }, { data: movs }] = await Promise.all([
    supabase.from("materias_primas").select("*").order("nome"),
    supabase.from("estoque_movimentos")
      .select("*, materias_primas(nome, unidade)")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const movimentos = movs || [];
  state.materias = (mps || []).map(mp => {
    const movsMp = movimentos.filter(m => m.materia_prima_id === mp.id);
    const entradas = movsMp.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.quantidade), 0);
    const saidas   = movsMp.filter(m => m.tipo === "saida").reduce((s, m)   => s + Number(m.quantidade), 0);
    return { ...mp, saldo: entradas - saidas, entradas, saidas };
  });
  state.movimentos = movimentos;
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
function render(container) {
  const totAlerta  = state.materias.filter(m => m.saldo > 0 && m.saldo <= Number(m.estoque_minimo || 0)).length;
  const totZerado  = state.materias.filter(m => m.saldo <= 0).length;
  const custoTotal = state.materias.reduce((s, m) => s + Math.max(m.saldo, 0) * Number(m.custo_unitario || 0), 0);

  container.innerHTML = `
    <style>${css()}</style>

    <!-- Topbar -->
    <div class="est-topbar">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:700">Estoque</h2>
        <span style="font-size:12px;color:var(--muted)">${state.materias.length} matérias-primas · Custo total: R$ ${custoTotal.toFixed(2)}</span>
      </div>
      <button class="btn-nova-mp" id="btn-nova-mp">
        <i class="fi fi-rr-add"></i> Nova Matéria-Prima
      </button>
    </div>

    <!-- KPIs -->
    <div class="est-kpis">
      <div class="kpi-card">
        <div class="kpi-k">Itens cadastrados</div>
        <div class="kpi-v">${state.materias.length}</div>
      </div>
      <div class="kpi-card warn">
        <div class="kpi-k">Estoque baixo</div>
        <div class="kpi-v" style="color:var(--warning)">${totAlerta}</div>
      </div>
      <div class="kpi-card danger">
        <div class="kpi-k">Sem estoque</div>
        <div class="kpi-v" style="color:var(--error)">${totZerado}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-k">Custo em estoque</div>
        <div class="kpi-v" style="color:var(--primary-light)">R$ ${custoTotal.toFixed(2)}</div>
      </div>
    </div>

    <!-- Abas -->
    <div class="est-abas">
      <button class="est-aba ${state.aba==="saldo"?"active":""}" data-aba="saldo">
        <i class="fi fi-rr-shelves"></i> Saldo Atual
      </button>
      <button class="est-aba ${state.aba==="materias"?"active":""}" data-aba="materias">
        <i class="fi fi-rr-box-open"></i> Gerenciar Matérias
      </button>
      <button class="est-aba ${state.aba==="historico"?"active":""}" data-aba="historico">
        <i class="fi fi-rr-clock"></i> Histórico de Movimentos
      </button>
    </div>

    <!-- Conteúdo da aba -->
    <div id="est-body"></div>
    <div id="modal-area"></div>
  `;

  container.querySelectorAll("[data-aba]").forEach(btn =>
    btn.addEventListener("click", () => { state.aba = btn.dataset.aba; render(container); })
  );

  container.querySelector("#btn-nova-mp").addEventListener("click", () =>
    abrirModalMP(container, null)
  );

  const body = container.querySelector("#est-body");
  if      (state.aba === "saldo")    renderSaldo(body, container);
  else if (state.aba === "materias") renderMaterias(body, container);
  else                               renderHistorico(body, container);
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: SALDO ATUAL
// ══════════════════════════════════════════════════════════════════════════════
function renderSaldo(body, container) {
  const filtradas = state.buscaSaldo
    ? state.materias.filter(m => m.nome.toLowerCase().includes(state.buscaSaldo.toLowerCase()))
    : state.materias;

  // Ordena: zerados → baixos → ok
  const ordenadas = [...filtradas].sort((a, b) => {
    const sa = statusSaldo(a), sb = statusSaldo(b);
    const order = { zerado: 0, baixo: 1, ok: 2 };
    return order[sa] - order[sb];
  });

  body.innerHTML = `
    <div class="table-actions">
      <div class="search-wrap">
        <i class="fi fi-rr-search search-icon"></i>
        <input id="busca-saldo" placeholder="Buscar matéria-prima..." value="${esc(state.buscaSaldo)}" />
      </div>
      <span style="font-size:12px;color:var(--muted)">${filtradas.length} item${filtradas.length!==1?"s":""}</span>
    </div>

    <div class="table-wrap">
      <table class="est-table">
        <thead>
          <tr>
            <th>Matéria-Prima</th>
            <th style="text-align:center">Unidade</th>
            <th style="text-align:right">Saldo</th>
            <th style="text-align:right">Mínimo</th>
            <th style="text-align:right">Custo/un</th>
            <th style="text-align:right">Valor em estoque</th>
            <th style="text-align:center">Status</th>
            <th style="text-align:center;width:120px">Movimentar</th>
          </tr>
        </thead>
        <tbody>
          ${ordenadas.length === 0
            ? `<tr><td colspan="8" class="td-vazio">Nenhuma matéria-prima encontrada.</td></tr>`
            : ordenadas.map(mp => {
                const st   = statusSaldo(mp);
                const val  = Math.max(mp.saldo, 0) * Number(mp.custo_unitario || 0);
                const cfg  = STATUS_CFG[st];
                return `
                <tr class="est-row">
                  <td>
                    <div style="font-weight:600">${esc(mp.nome)}</div>
                    ${mp.categoria ? `<div style="font-size:11px;color:var(--muted)">${esc(mp.categoria)}</div>` : ""}
                  </td>
                  <td style="text-align:center">
                    <span class="unit-tag">${esc(mp.unidade||"un")}</span>
                  </td>
                  <td style="text-align:right;font-weight:700;font-size:15px;color:${cfg.cor}">
                    ${Number(mp.saldo).toFixed(3)}
                  </td>
                  <td style="text-align:right;color:var(--muted);font-size:12px">
                    ${Number(mp.estoque_minimo||0).toFixed(3)}
                  </td>
                  <td style="text-align:right;font-size:12px">
                    R$ ${Number(mp.custo_unitario||0).toFixed(4)}
                  </td>
                  <td style="text-align:right;font-weight:600;color:var(--primary-light)">
                    R$ ${val.toFixed(2)}
                  </td>
                  <td style="text-align:center">
                    <span class="status-pill" style="background:${cfg.cor}22;color:${cfg.cor}">
                      ${cfg.icon} ${cfg.label}
                    </span>
                  </td>
                  <td style="text-align:center">
                    <div style="display:flex;gap:5px;justify-content:center">
                      <button class="btn-entrada" data-mov="entrada" data-id="${mp.id}" data-nome="${esc(mp.nome)}" data-un="${esc(mp.unidade||"un")}" data-saldo="${mp.saldo}" title="Entrada">
                        <i class="fi fi-rr-arrow-up"></i>
                      </button>
                      <button class="btn-saida" data-mov="saida" data-id="${mp.id}" data-nome="${esc(mp.nome)}" data-un="${esc(mp.unidade||"un")}" data-saldo="${mp.saldo}" title="Saída">
                        <i class="fi fi-rr-arrow-down"></i>
                      </button>
                      <button class="btn-icon-sm" data-edit-mp="${mp.id}" title="Editar">
                        <i class="fi fi-rr-pencil"></i>
                      </button>
                    </div>
                  </td>
                </tr>`;
              }).join("")}
        </tbody>
      </table>
    </div>
  `;

  body.querySelector("#busca-saldo")?.addEventListener("input", e => {
    state.buscaSaldo = e.target.value;
    renderSaldo(body, container);
  });

  body.querySelectorAll("[data-mov]").forEach(btn =>
    btn.addEventListener("click", () =>
      abrirModalMov(container, btn.dataset.mov, {
        id: btn.dataset.id, nome: btn.dataset.nome,
        unidade: btn.dataset.un, saldo: parseFloat(btn.dataset.saldo),
      })
    )
  );

  body.querySelectorAll("[data-edit-mp]").forEach(btn =>
    btn.addEventListener("click", () => {
      const mp = state.materias.find(m => m.id === btn.dataset.editMp);
      if (mp) abrirModalMP(container, mp);
    })
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: GERENCIAR MATÉRIAS-PRIMAS
// ══════════════════════════════════════════════════════════════════════════════
function renderMaterias(body, container) {
  const filtradas = state.buscaMaterias
    ? state.materias.filter(m => m.nome.toLowerCase().includes(state.buscaMaterias.toLowerCase()))
    : state.materias;

  body.innerHTML = `
    <div class="table-actions">
      <div class="search-wrap">
        <i class="fi fi-rr-search search-icon"></i>
        <input id="busca-mats" placeholder="Buscar matéria-prima..." value="${esc(state.buscaMaterias)}" />
      </div>
      <button class="btn-nova-mp-sm" id="btn-nova-mp2">
        <i class="fi fi-rr-add"></i> Adicionar
      </button>
    </div>

    <div class="table-wrap">
      <table class="est-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th style="text-align:center">Unidade</th>
            <th style="text-align:right">Estoque mínimo</th>
            <th style="text-align:right">Custo unitário</th>
            <th style="text-align:right">Saldo atual</th>
            <th style="text-align:center;width:100px">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${filtradas.length === 0
            ? `<tr><td colspan="7" class="td-vazio">Nenhuma matéria-prima cadastrada.</td></tr>`
            : filtradas.map(mp => `
              <tr class="est-row">
                <td><strong>${esc(mp.nome)}</strong></td>
                <td style="color:var(--muted);font-size:12px">${esc(mp.categoria)||"—"}</td>
                <td style="text-align:center"><span class="unit-tag">${esc(mp.unidade||"un")}</span></td>
                <td style="text-align:right;color:var(--muted)">${Number(mp.estoque_minimo||0).toFixed(3)}</td>
                <td style="text-align:right;font-weight:600;color:var(--primary-light)">
                  R$ ${Number(mp.custo_unitario||0).toFixed(4)}
                </td>
                <td style="text-align:right;font-weight:700;color:${STATUS_CFG[statusSaldo(mp)].cor}">
                  ${Number(mp.saldo).toFixed(3)} ${esc(mp.unidade||"un")}
                </td>
                <td>
                  <div style="display:flex;gap:5px;justify-content:center">
                    <button class="btn-icon-sm" data-edit-mp="${mp.id}" title="Editar">
                      <i class="fi fi-rr-pencil"></i>
                    </button>
                    <button class="btn-icon-sm danger" data-del-mp="${mp.id}" data-del-nome="${esc(mp.nome)}" title="Excluir">
                      <i class="fi fi-rr-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;

  body.querySelector("#busca-mats")?.addEventListener("input", e => {
    state.buscaMaterias = e.target.value;
    renderMaterias(body, container);
  });

  body.querySelector("#btn-nova-mp2")?.addEventListener("click", () => abrirModalMP(container, null));

  body.querySelectorAll("[data-edit-mp]").forEach(btn =>
    btn.addEventListener("click", () => {
      const mp = state.materias.find(m => m.id === btn.dataset.editMp);
      if (mp) abrirModalMP(container, mp);
    })
  );

  body.querySelectorAll("[data-del-mp]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm(`Excluir "${btn.dataset.delNome}"?\n\nOs movimentos relacionados também serão removidos.`)) return;
      await supabase.from("estoque_movimentos").delete().eq("materia_prima_id", btn.dataset.delMp);
      await supabase.from("materias_primas").delete().eq("id", btn.dataset.delMp);
      await carregar();
      render(container);
    })
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: HISTÓRICO
// ══════════════════════════════════════════════════════════════════════════════
function renderHistorico(body, container) {
  const filtrados = state.filtroMp
    ? state.movimentos.filter(m => m.materia_prima_id === state.filtroMp)
    : state.movimentos;

  const mpOptions = state.materias.map(mp =>
    `<option value="${mp.id}" ${state.filtroMp===mp.id?"selected":""}>${esc(mp.nome)}</option>`
  ).join("");

  body.innerHTML = `
    <div class="table-actions">
      <div class="search-wrap" style="max-width:280px">
        <i class="fi fi-rr-filter search-icon"></i>
        <select id="filtro-mp" style="border:none;background:transparent;flex:1;color:var(--text);padding:8px 4px;font-size:13px">
          <option value="">Todas as matérias-primas</option>
          ${mpOptions}
        </select>
      </div>
      <span style="font-size:12px;color:var(--muted)">${filtrados.length} movimento${filtrados.length!==1?"s":""}</span>
    </div>

    <div class="table-wrap">
      <table class="est-table">
        <thead>
          <tr>
            <th style="width:90px">Tipo</th>
            <th>Matéria-Prima</th>
            <th style="text-align:right">Quantidade</th>
            <th>Motivo</th>
            <th>Origem</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          ${filtrados.length === 0
            ? `<tr><td colspan="6" class="td-vazio">Nenhum movimento registrado.</td></tr>`
            : filtrados.map(m => {
                const data = new Date(m.created_at).toLocaleString("pt-BR");
                const isEnt = m.tipo === "entrada";
                return `
                <tr class="est-row">
                  <td>
                    <span class="mov-tipo ${isEnt?"entrada":"saida"}">
                      <i class="fi fi-rr-arrow-${isEnt?"up":"down"}"></i>
                      ${isEnt?"Entrada":"Saída"}
                    </span>
                  </td>
                  <td><strong>${m.materias_primas?.nome || "—"}</strong></td>
                  <td style="text-align:right;font-weight:700;color:${isEnt?"var(--success)":"var(--error)"}">
                    ${isEnt?"+":"−"}${Number(m.quantidade).toFixed(3)} ${m.materias_primas?.unidade||""}
                  </td>
                  <td style="font-size:12px;color:var(--muted)">${esc(m.motivo)||"—"}</td>
                  <td>
                    <span class="origem-tag ${m.origem||"manual"}">
                      ${m.origem==="venda"?"🛒 Venda":"✏️ Manual"}
                    </span>
                  </td>
                  <td style="font-size:12px;color:var(--muted)">${data}</td>
                </tr>`;
              }).join("")}
        </tbody>
      </table>
    </div>
  `;

  body.querySelector("#filtro-mp")?.addEventListener("change", e => {
    state.filtroMp = e.target.value;
    renderHistorico(body, container);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: NOVA / EDITAR MATÉRIA-PRIMA
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalMP(container, mp) {
  const area = container.querySelector("#modal-area");
  const editando = !!mp?.id;

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:500px">
        <h3>
          <i class="fi fi-rr-${editando?"pencil":"add"}" style="color:var(--primary)"></i>
          ${editando ? "Editar Matéria-Prima" : "Nova Matéria-Prima"}
        </h3>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

          <div class="modal-field full">
            <label>Nome *</label>
            <input id="mp-nome" value="${esc(mp?.nome)}" placeholder="Ex: Adesivo Vinil A4, Lona..." autofocus />
          </div>

          <div class="modal-field">
            <label>Categoria</label>
            <input id="mp-cat" value="${esc(mp?.categoria)}" placeholder="Ex: Papel, Vinil, Lona..." />
          </div>

          <div class="modal-field">
            <label>Unidade de medida</label>
            <select id="mp-un">
              ${["un","m²","m","folha","kg","g","l","ml","rolo","caixa"].map(u =>
                `<option value="${u}" ${(mp?.unidade||"un")===u?"selected":""}>${u}</option>`
              ).join("")}
            </select>
          </div>

          <div class="modal-field">
            <label>Estoque mínimo</label>
            <div class="modal-input-icon">
              <input id="mp-min" type="number" min="0" step="0.001" value="${mp?.estoque_minimo||0}" />
              <span id="mp-un-label" class="input-suffix">${mp?.unidade||"un"}</span>
            </div>
          </div>

          <div class="modal-field">
            <label>Custo unitário (R$)</label>
            <div class="modal-input-icon">
              <span class="input-prefix">R$</span>
              <input id="mp-custo" type="number" min="0" step="0.0001" value="${Number(mp?.custo_unitario||0).toFixed(4)}" />
            </div>
          </div>

          ${editando ? `
          <div class="modal-field">
            <label>Saldo atual</label>
            <div class="modal-input-icon readonly">
              <input type="text" value="${Number(mp?.saldo||0).toFixed(3)} ${esc(mp?.unidade||"un")}" readonly style="opacity:.7" />
            </div>
          </div>` : `
          <div class="modal-field">
            <label>Saldo inicial (opcional)</label>
            <div class="modal-input-icon">
              <input id="mp-saldo-ini" type="number" min="0" step="0.001" value="0" placeholder="0" />
              <span class="input-suffix">${mp?.unidade||"un"}</span>
            </div>
          </div>`}

        </div>

        ${editando ? `
        <div class="modal-sep"></div>
        <div style="display:flex;gap:8px">
          <button class="btn-mov-modal entrada" id="mp-entrada">
            <i class="fi fi-rr-arrow-up"></i> Lançar Entrada
          </button>
          <button class="btn-mov-modal saida" id="mp-saida">
            <i class="fi fi-rr-arrow-down"></i> Lançar Saída
          </button>
        </div>` : ""}

        <div class="modal-btns">
          ${editando ? `<button class="btn-danger" id="mp-del">
            <i class="fi fi-rr-trash"></i> Excluir
          </button>` : ""}
          <div style="flex:1"></div>
          <button class="btn-secondary" id="mp-cancel">Cancelar</button>
          <button class="btn-primary" id="mp-ok">
            <i class="fi fi-rr-disk"></i> Salvar
          </button>
        </div>
      </div>
    </div>`;

  // Atualiza label da unidade ao mudar select
  area.querySelector("#mp-un")?.addEventListener("change", e => {
    const lbl = area.querySelector("#mp-un-label");
    if (lbl) lbl.textContent = e.target.value;
  });

  area.querySelector("#mp-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id==="modal-bg") area.innerHTML=""; });

  // Excluir
  area.querySelector("#mp-del")?.addEventListener("click", async () => {
    if (!confirm(`Excluir "${mp.nome}"?\n\nTodos os movimentos serão removidos.`)) return;
    await supabase.from("estoque_movimentos").delete().eq("materia_prima_id", mp.id);
    await supabase.from("materias_primas").delete().eq("id", mp.id);
    area.innerHTML = "";
    await carregar();
    render(container);
  });

  // Entrada/Saída direto do modal
  area.querySelector("#mp-entrada")?.addEventListener("click", () => {
    area.innerHTML = "";
    abrirModalMov(container, "entrada", { id: mp.id, nome: mp.nome, unidade: mp.unidade||"un", saldo: mp.saldo });
  });
  area.querySelector("#mp-saida")?.addEventListener("click", () => {
    area.innerHTML = "";
    abrirModalMov(container, "saida", { id: mp.id, nome: mp.nome, unidade: mp.unidade||"un", saldo: mp.saldo });
  });

  // Salvar
  area.querySelector("#mp-ok").addEventListener("click", async () => {
    const nome  = area.querySelector("#mp-nome").value.trim();
    const un    = area.querySelector("#mp-un").value;
    const cat   = area.querySelector("#mp-cat").value.trim() || null;
    const min   = parseFloat(area.querySelector("#mp-min").value) || 0;
    const custo = parseFloat(area.querySelector("#mp-custo").value) || 0;

    if (!nome) { flashInput(area.querySelector("#mp-nome")); return; }

    const payload = { nome, unidade: un, categoria: cat, estoque_minimo: min, custo_unitario: custo };

    if (editando) {
      await supabase.from("materias_primas").update({ ...payload, updated_at: new Date() }).eq("id", mp.id);
    } else {
      const { data: nova } = await supabase.from("materias_primas").insert(payload).select().single();
      // Saldo inicial
      const saldoIni = parseFloat(area.querySelector("#mp-saldo-ini")?.value) || 0;
      if (saldoIni > 0) {
        await supabase.from("estoque_movimentos").insert({
          materia_prima_id: nova.id, tipo: "entrada",
          quantidade: saldoIni, motivo: "Saldo inicial", origem: "manual",
        });
      }
    }

    area.innerHTML = "";
    showToast(container, editando ? "✅ Matéria-prima atualizada!" : "✅ Matéria-prima cadastrada!");
    await carregar();
    render(container);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: MOVIMENTO (ENTRADA / SAÍDA)
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalMov(container, tipo, mp) {
  const area = container.querySelector("#modal-area");
  const isEnt = tipo === "entrada";
  const cor   = isEnt ? "var(--success)" : "var(--error)";
  const icon  = isEnt ? "fi-rr-arrow-up" : "fi-rr-arrow-down";

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:420px">
        <h3 style="color:${cor}">
          <i class="fi ${icon}"></i> ${isEnt ? "Entrada" : "Saída"} de Estoque
        </h3>

        <div class="mov-info-mp">
          <div class="mov-mp-nome">${esc(mp.nome)}</div>
          <div class="mov-mp-saldo">
            Saldo atual:
            <strong style="color:${Number(mp.saldo)<=0?"var(--error)":Number(mp.saldo)<=(Number(mp.estoque_minimo||0))?"var(--warning)":"var(--success)"}">${Number(mp.saldo).toFixed(3)} ${esc(mp.unidade)}</strong>
          </div>
        </div>

        <label>Quantidade (${esc(mp.unidade)}) *</label>
        <input id="mov-qtd" type="number" min="0.001" step="0.001" placeholder="0,000" autofocus
          style="font-size:18px;text-align:center;margin-bottom:12px" />

        <label>Motivo / Observação</label>
        <textarea id="mov-motivo" rows="2"
          placeholder="${isEnt ? "Ex: Compra NF 123, Ajuste de inventário..." : "Ex: Usado na produção de 50 banners..."}"></textarea>

        ${!isEnt ? `
        <div class="mov-alerta" id="mov-alerta" style="display:none">
          ⚠️ Quantidade maior que o saldo disponível. Deseja continuar mesmo assim?
        </div>` : ""}

        <div class="modal-btns">
          <button class="btn-secondary" id="mov-cancel">Cancelar</button>
          <button class="btn-primary" id="mov-ok" style="background:${cor}">
            <i class="fi ${icon}"></i> Confirmar ${isEnt ? "Entrada" : "Saída"}
          </button>
        </div>
      </div>
    </div>`;

  const qtdInput = area.querySelector("#mov-qtd");

  if (!isEnt) {
    qtdInput.addEventListener("input", () => {
      const qtd = parseFloat(qtdInput.value) || 0;
      const alerta = area.querySelector("#mov-alerta");
      if (alerta) alerta.style.display = qtd > mp.saldo ? "block" : "none";
    });
  }

  area.querySelector("#mov-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id==="modal-bg") area.innerHTML=""; });

  area.querySelector("#mov-ok").addEventListener("click", async () => {
    const qtd = parseFloat(qtdInput.value);
    if (!qtd || qtd <= 0) { flashInput(qtdInput); return; }

    if (!isEnt && qtd > mp.saldo) {
      if (!confirm(`Saldo insuficiente (${Number(mp.saldo).toFixed(3)} ${mp.unidade}).\nDeseja lançar mesmo assim?`)) return;
    }

    const motivo = area.querySelector("#mov-motivo").value.trim();
    await supabase.from("estoque_movimentos").insert({
      materia_prima_id: mp.id, tipo, quantidade: qtd,
      motivo: motivo || null, origem: "manual",
    });

    area.innerHTML = "";
    showToast(container, `✅ ${isEnt ? "Entrada" : "Saída"} de ${qtd.toFixed(3)} ${mp.unidade} registrada!`);
    await carregar();
    render(container);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  ok:     { cor: "var(--success)", icon: "●", label: "OK"         },
  baixo:  { cor: "var(--warning)", icon: "▲", label: "Baixo"      },
  zerado: { cor: "var(--error)",   icon: "✕", label: "Zerado"     },
};

function statusSaldo(mp) {
  const saldo = Number(mp.saldo);
  const min   = Number(mp.estoque_minimo || 0);
  if (saldo <= 0)            return "zerado";
  if (min > 0 && saldo <= min) return "baixo";
  return "ok";
}

function flashInput(el) {
  if (!el) return;
  el.style.borderColor = "var(--error)";
  el.focus();
  setTimeout(() => el.style.borderColor = "", 1500);
}

function showToast(container, msg) {
  const t = document.createElement("div");
  t.className = "est-toast";
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
.est-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:10px; }
.btn-nova-mp {
  display:inline-flex; align-items:center; gap:6px;
  background:var(--primary); color:#fff; border:none;
  border-radius:var(--radius-md); padding:8px 16px;
  font-family:var(--font); font-size:13px; font-weight:600;
  cursor:pointer; transition:all var(--t);
}
.btn-nova-mp:hover { opacity:.88; }
.btn-nova-mp-sm {
  display:inline-flex; align-items:center; gap:5px;
  background:var(--primary-bg); color:var(--primary-light);
  border:1px solid var(--primary-border); border-radius:var(--radius-md);
  padding:7px 12px; font-size:12px; font-weight:600;
  cursor:pointer; transition:all var(--t); font-family:var(--font);
}
.btn-nova-mp-sm:hover { background:var(--primary); color:#fff; }

/* ── KPIs ── */
.est-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px; }
@media(max-width:700px){ .est-kpis { grid-template-columns:1fr 1fr; } }
.kpi-card {
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-lg); padding:14px;
}
.kpi-card.warn  { border-left:3px solid var(--warning); }
.kpi-card.danger{ border-left:3px solid var(--error); }
.kpi-k { font-size:11px; color:var(--muted); font-weight:500; margin-bottom:4px; }
.kpi-v { font-size:22px; font-weight:800; color:var(--text); }

/* ── Abas ── */
.est-abas { display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap; }
.est-aba {
  display:inline-flex; align-items:center; gap:7px;
  padding:8px 14px; border-radius:var(--radius-md);
  border:1px solid var(--border-md); background:transparent;
  color:var(--muted); cursor:pointer; font-family:var(--font);
  font-size:13px; font-weight:500; transition:all var(--t);
}
.est-aba:hover { background:var(--panel2); color:var(--text); }
.est-aba.active {
  background:var(--primary-bg); border-color:var(--primary-border);
  color:var(--primary-light); font-weight:700;
}

/* ── Table actions ── */
.table-actions {
  display:flex; align-items:center; justify-content:space-between;
  gap:10px; margin-bottom:10px; flex-wrap:wrap;
}
.search-wrap {
  display:flex; align-items:center; gap:8px;
  background:var(--panel2); border:1px solid var(--border-md);
  border-radius:var(--radius-md); padding:0 12px;
  flex:1; max-width:320px;
  transition:border-color var(--t);
}
.search-wrap:focus-within { border-color:var(--primary); }
.search-icon { color:var(--muted); font-size:13px; flex-shrink:0; }
.search-wrap input {
  border:none; background:transparent; flex:1;
  padding:9px 0; font-size:13px; color:var(--text);
}
.search-wrap input:focus { outline:none; }

/* ── Table ── */
.table-wrap { overflow-x:auto; border-radius:var(--radius-lg); border:1px solid var(--border); }
.est-table { width:100%; border-collapse:collapse; font-size:13px; }
.est-table th {
  text-align:left; font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.05em; color:var(--muted); padding:10px 14px;
  background:var(--panel2); border-bottom:1px solid var(--border);
  white-space:nowrap;
}
.est-table td { padding:11px 14px; border-bottom:1px solid var(--border); vertical-align:middle; }
.est-table tr:last-child td { border-bottom:none; }
.est-row { transition:background var(--t); }
.est-row:hover td { background:rgba(0,124,190,0.04); }
.td-vazio { text-align:center; color:var(--muted); padding:32px; font-size:13px; }

/* ── Badges / Tags ── */
.unit-tag {
  display:inline-block; font-size:11px; font-weight:700;
  padding:2px 8px; border-radius:999px;
  background:var(--panel3); color:var(--muted);
}
.status-pill {
  display:inline-flex; align-items:center; gap:4px;
  font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px;
  white-space:nowrap;
}
.mov-tipo {
  display:inline-flex; align-items:center; gap:5px;
  font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px;
}
.mov-tipo.entrada { background:var(--success-bg); color:var(--success); }
.mov-tipo.saida   { background:var(--error-bg);   color:var(--error); }
.origem-tag {
  font-size:11px; color:var(--muted);
}

/* ── Botões de movimentação ── */
.btn-entrada {
  display:inline-flex; align-items:center; justify-content:center;
  width:30px; height:30px; border-radius:var(--radius-sm);
  background:var(--success-bg); border:1px solid var(--success-border);
  color:var(--success); cursor:pointer; transition:all var(--t); font-size:12px;
}
.btn-entrada:hover { background:var(--success); color:#fff; }
.btn-saida {
  display:inline-flex; align-items:center; justify-content:center;
  width:30px; height:30px; border-radius:var(--radius-sm);
  background:var(--error-bg); border:1px solid var(--error-border);
  color:var(--error); cursor:pointer; transition:all var(--t); font-size:12px;
}
.btn-saida:hover { background:var(--error); color:#fff; }
.btn-icon-sm {
  display:inline-flex; align-items:center; justify-content:center;
  width:30px; height:30px; border-radius:var(--radius-sm);
  background:transparent; border:1px solid var(--border);
  color:var(--muted); cursor:pointer; transition:all var(--t); font-size:12px;
}
.btn-icon-sm:hover { border-color:var(--primary); color:var(--primary-light); background:var(--primary-bg); }
.btn-icon-sm.danger:hover { border-color:var(--error-border); color:var(--error); background:var(--error-bg); }

/* ── Modal matéria-prima ── */
.modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:100; animation:fadeIn .12s ease; }
.modal { background:var(--panel); border:1px solid var(--border-md); border-radius:var(--radius-xl); padding:24px; min-width:340px; max-width:520px; width:92%; max-height:90vh; overflow-y:auto; box-shadow:var(--shadow-lg); animation:slideUp .15s ease; }
.modal h3 { font-size:16px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
.modal label, .modal-field label { display:block; font-size:12px; font-weight:500; color:var(--muted); margin-bottom:5px; margin-top:12px; }
.modal-field { display:flex; flex-direction:column; }
.modal-field.full { grid-column:1/-1; }
.modal-input-icon {
  display:flex; align-items:center;
  background:var(--panel2); border:1px solid var(--border-md);
  border-radius:var(--radius-md); overflow:hidden;
  transition:border-color var(--t);
}
.modal-input-icon:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px rgba(0,124,190,0.10); }
.modal-input-icon.readonly { opacity:.6; }
.input-prefix, .input-suffix {
  padding:0 10px; font-size:11px; font-weight:600; color:var(--muted);
  background:var(--panel3); border-right:1px solid var(--border); flex-shrink:0;
  display:flex; align-items:center; white-space:nowrap;
}
.input-suffix { border-right:none; border-left:1px solid var(--border); }
.modal-input-icon input {
  border:none; background:transparent; flex:1;
  padding:9px 10px; font-size:13px; color:var(--text);
  font-family:var(--font);
}
.modal-input-icon input:focus { outline:none; box-shadow:none; }
.modal-sep { border-top:1px solid var(--border); margin:16px 0; }
.btn-mov-modal {
  display:inline-flex; align-items:center; gap:6px;
  flex:1; justify-content:center;
  padding:9px 14px; border-radius:var(--radius-md);
  font-family:var(--font); font-size:13px; font-weight:600;
  cursor:pointer; transition:all var(--t); border:1px solid;
}
.btn-mov-modal.entrada { background:var(--success-bg); color:var(--success); border-color:var(--success-border); }
.btn-mov-modal.entrada:hover { background:var(--success); color:#fff; }
.btn-mov-modal.saida   { background:var(--error-bg);   color:var(--error);   border-color:var(--error-border); }
.btn-mov-modal.saida:hover   { background:var(--error);   color:#fff; }
.modal-btns { display:flex; gap:8px; align-items:center; margin-top:20px; padding-top:16px; border-top:1px solid var(--border); }

/* ── Modal movimento ── */
.mov-info-mp {
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-md); padding:12px 14px; margin-bottom:14px;
}
.mov-mp-nome   { font-weight:700; font-size:14px; margin-bottom:4px; }
.mov-mp-saldo  { font-size:12px; color:var(--muted); }
.mov-alerta {
  background:var(--warning-bg); border:1px solid rgba(232,160,16,0.25);
  border-radius:var(--radius-md); padding:10px 12px;
  font-size:12px; color:var(--warning); margin-top:8px;
}

/* ── Toast ── */
.est-toast {
  position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
  background:var(--panel); border:1px solid var(--border-md);
  color:var(--text); border-radius:var(--radius-lg); padding:12px 24px;
  font-size:13px; font-weight:600; box-shadow:var(--shadow-lg);
  z-index:999; animation:slideUp .2s ease; white-space:nowrap;
}
`; }