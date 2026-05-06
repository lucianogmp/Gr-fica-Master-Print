import { supabase } from "../supabase/client.js";

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
  movimentos: [],
  clientes:   [],
  produtos:   [],
  filtroDia:  hoje(),
  // contexto para "voltar ao modal após cadastrar produto"
  _modalCtx:  null,
};

function hoje() {
  return new Date().toISOString().split("T")[0];
}

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function FluxoCaixa(container) {
  container.innerHTML = `<div class="loading">Carregando caixa...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const [{ data: movs }, { data: clientes }, { data: produtos }] = await Promise.all([
    supabase
      .from("caixa_movimentos")
      .select("*")
      .order("data",        { ascending: true })
      .order("created_at",  { ascending: true }),
    supabase.from("clientes").select("id, nome, telefone").order("nome"),
    supabase.from("produtos").select("id, nome").order("nome"),
  ]);
  state.movimentos = movs    || [];
  state.clientes   = clientes || [];
  state.produtos   = produtos || [];
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
function render(container) {
  const doDia = state.movimentos.filter(m => m.data === state.filtroDia);

  // Saldo acumulado corrido
  let saldoCorrido = 0;
  const comSaldo = doDia.map(m => {
    const val = Number(m.valor);
    saldoCorrido += m.tipo === "entrada" ? val : -val;
    return { ...m, saldoCorrido };
  });

  const totalEntradas = doDia.filter(m => m.tipo === "entrada")
    .reduce((s, m) => s + Number(m.valor), 0);
  const totalSaidas = doDia.filter(m => m.tipo === "saida")
    .reduce((s, m) => s + Number(m.valor), 0);
  const saldoDia = totalEntradas - totalSaidas;

  const dataFormatada = new Date(state.filtroDia + "T00:00:00")
    .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  container.innerHTML = `
    <style>${css()}</style>

    <!-- Cabeçalho -->
    <div class="cx-header">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:700">Caixa Físico</h2>
        <span style="font-size:12px;color:var(--muted);text-transform:capitalize">${dataFormatada}</span>
      </div>
      <div class="cx-header-actions">
        <input type="date" id="filtro-dia" value="${state.filtroDia}" title="Selecionar dia" />
        <button class="btn-importar" id="btn-importar" title="Importar vendas pagas em dinheiro">
          <i class="fi fi-rr-arrow-down-to-square"></i> Importar Vendas
        </button>
        <button class="btn-saida-cx"  id="btn-saida">
          <i class="fi fi-rr-arrow-circle-down"></i> Saída
        </button>
        <button class="btn-entrada-cx" id="btn-entrada">
          <i class="fi fi-rr-arrow-circle-up"></i> Entrada
        </button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="cx-kpis">
      <div class="cx-kpi">
        <div class="cx-kpi-label">Entradas do dia</div>
        <div class="cx-kpi-val entrada">R$ ${totalEntradas.toFixed(2)}</div>
        <div class="cx-kpi-sub">${doDia.filter(m=>m.tipo==="entrada").length} lançamento(s)</div>
      </div>
      <div class="cx-kpi">
        <div class="cx-kpi-label">Saídas do dia</div>
        <div class="cx-kpi-val saida">R$ ${totalSaidas.toFixed(2)}</div>
        <div class="cx-kpi-sub">${doDia.filter(m=>m.tipo==="saida").length} lançamento(s)</div>
      </div>
      <div class="cx-kpi destaque">
        <div class="cx-kpi-label">Saldo do caixa</div>
        <div class="cx-kpi-val ${saldoDia >= 0 ? "positivo" : "negativo"}">
          R$ ${saldoDia.toFixed(2)}
        </div>
        <div class="cx-kpi-sub">${saldoDia >= 0 ? "Positivo" : "Negativo"}</div>
      </div>
    </div>

    <!-- Tabela de movimentos -->
    <div class="cx-table-wrap">
      <table class="cx-table">
        <thead>
          <tr>
            <th style="width:80px">Hora</th>
            <th style="width:110px">Tipo</th>
            <th>Descrição / Produto</th>
            <th style="width:160px">Cliente</th>
            <th style="text-align:right;width:130px">Valor</th>
            <th style="text-align:right;width:130px">Saldo</th>
            <th style="width:80px"></th>
          </tr>
        </thead>
        <tbody>
          ${comSaldo.length === 0
            ? `<tr><td colspan="7" class="cx-vazio">
                <i class="fi fi-rr-inbox" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px"></i>
                Nenhum lançamento neste dia.<br>
                <span style="font-size:12px">Use os botões <strong>Entrada</strong> e <strong>Saída</strong> para registrar.</span>
               </td></tr>`
            : comSaldo.map(m => `
              <tr class="cx-row ${m.tipo}">
                <td class="cx-hora">${formatHora(m.created_at)}</td>
                <td>
                  <span class="tipo-pill ${m.tipo}">
                    ${m.tipo === "entrada"
                      ? `<i class="fi fi-rr-arrow-up"></i> Entrada`
                      : `<i class="fi fi-rr-arrow-down"></i> Saída`}
                  </span>
                </td>
                <td>
                  <div class="cx-desc">${esc(m.descricao)}</div>
                  ${m.origem === "venda"
                    ? `<div class="cx-sub"><i class="fi fi-rr-shopping-cart"></i> Venda vinculada</div>`
                    : ""}
                  ${m.observacoes
                    ? `<div class="cx-sub">${esc(m.observacoes)}</div>`
                    : ""}
                </td>
                <td class="cx-cliente">${esc(m.cliente_nome) || "—"}</td>
                <td class="cx-valor ${m.tipo}">
                  ${m.tipo === "entrada" ? "+" : "−"}R$ ${Number(m.valor).toFixed(2)}
                </td>
                <td class="cx-saldo ${m.saldoCorrido >= 0 ? "positivo" : "negativo"}">
                  R$ ${Number(m.saldoCorrido).toFixed(2)}
                </td>
                <td class="cx-acoes">
                  <button class="btn-icon-cx" data-edit="${m.id}" title="Editar">
                    <i class="fi fi-rr-pencil"></i>
                  </button>
                  <button class="btn-icon-cx danger" data-del="${m.id}" title="Excluir">
                    <i class="fi fi-rr-trash"></i>
                  </button>
                </td>
              </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div id="modal-area"></div>
  `;

  // ── Eventos ────────────────────────────────────────────────────────────────
  container.querySelector("#filtro-dia").addEventListener("change", e => {
    state.filtroDia = e.target.value;
    render(container);
  });

  container.querySelector("#btn-entrada").addEventListener("click", () =>
    abrirModalLancamento(container, "entrada")
  );
  container.querySelector("#btn-saida").addEventListener("click", () =>
    abrirModalLancamento(container, "saida")
  );
  container.querySelector("#btn-importar").addEventListener("click", () =>
    abrirModalImportar(container)
  );

  container.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir este lançamento?")) return;
      await supabase.from("caixa_movimentos").delete().eq("id", btn.dataset.del);
      await carregar();
      render(container);
    })
  );

  container.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => {
      const m = state.movimentos.find(x => x.id === btn.dataset.edit);
      if (m) abrirModalLancamento(container, m.tipo, m);
    })
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: NOVO / EDITAR LANÇAMENTO
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalLancamento(container, tipo, dados = {}, ctx = null) {
  const area = container.querySelector("#modal-area");
  const editando = !!dados.id;
  const isEnt = tipo === "entrada";
  const cor   = isEnt ? "var(--info)" : "var(--error)";
  const icon  = isEnt ? "fi-rr-arrow-up" : "fi-rr-arrow-down";

  // Produto pré-selecionado (vindo do cadastro rápido)
  const prodPreench = ctx?.produtoNome || dados.descricao || "";
  const clientePreench = ctx?.clienteNome || dados.cliente_nome || "";

  const prodOptions = state.produtos
    .map(p => `<option value="${esc(p.id)}" data-nome="${esc(p.nome)}">${esc(p.nome)}</option>`)
    .join("");

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" style="max-width:480px">

        <div class="modal-title-row" style="border-left:4px solid ${cor}">
          <h3 style="color:${cor}">
            <i class="fi ${icon}"></i>
            ${editando ? "Editar" : "Registrar"} ${isEnt ? "Entrada" : "Saída"}
          </h3>
        </div>

        <!-- Tipo (pode trocar no modal) -->
        <div class="modal-tipo-switch" style="margin-bottom:14px">
          <button class="tipo-sw ${isEnt ? "entrada active" : "entrada"}" data-sw="entrada">
            <i class="fi fi-rr-arrow-up"></i> Entrada
          </button>
          <button class="tipo-sw ${!isEnt ? "saida active" : "saida"}" data-sw="saida">
            <i class="fi fi-rr-arrow-down"></i> Saída
          </button>
        </div>

        <!-- Data -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label>Data *</label>
            <input id="m-data" type="date" value="${dados.data || state.filtroDia}" />
          </div>
          <div>
            <label>Valor (R$) *</label>
            <div class="preco-field">
              <span>R$</span>
              <input id="m-valor" type="number" min="0" step="0.01"
                value="${dados.valor || ""}" placeholder="0,00" autofocus />
            </div>
          </div>
        </div>

        <!-- Produto / Descrição -->
        <label>Produto / Descrição *</label>
        <div class="prod-search-wrap" style="margin-bottom:12px">
          <div class="autocomplete-wrap" style="flex:1">
            <input id="m-desc" value="${esc(prodPreench)}"
              placeholder="Buscar produto ou digitar livremente..." autocomplete="off" />
            <div class="autocomplete-list" id="ac-prod"></div>
          </div>
          <button class="btn-add-prod" id="btn-add-prod" title="Cadastrar novo produto">
            <i class="fi fi-rr-add"></i> Novo
          </button>
        </div>

        <!-- Cliente -->
        <label>Cliente <span style="font-size:11px;color:var(--muted2)">(opcional)</span></label>
        <div class="autocomplete-wrap" style="margin-bottom:12px">
          <input id="m-cliente" value="${esc(clientePreench)}"
            placeholder="Buscar cliente..." autocomplete="off" />
          <div class="autocomplete-list" id="ac-cli"></div>
        </div>

        <!-- Observações -->
        <label>Observações <span style="font-size:11px;color:var(--muted2)">(opcional)</span></label>
        <textarea id="m-obs" rows="2"
          placeholder="Detalhe adicional, número de pedido...">${esc(dados.observacoes)}</textarea>

        <div class="modal-btns">
          <button class="btn-secondary" id="m-cancel">Cancelar</button>
          <button class="btn-primary" id="m-ok"
            style="background:${cor};border-color:${cor}">
            <i class="fi fi-rr-disk"></i> Salvar
          </button>
        </div>
      </div>
    </div>`;

  // ── Troca de tipo no modal ──────────────────────────────────────────────────
  let tipoAtual = tipo;
  area.querySelectorAll("[data-sw]").forEach(btn =>
    btn.addEventListener("click", () => {
      tipoAtual = btn.dataset.sw;
      area.querySelectorAll("[data-sw]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const nc = tipoAtual === "entrada" ? "var(--info)" : "var(--error)";
      area.querySelector(".modal-title-row").style.borderColor = nc;
      area.querySelector("h3").style.color = nc;
      area.querySelector("#m-ok").style.background = nc;
      area.querySelector("#m-ok").style.borderColor = nc;
    })
  );

  // ── Autocomplete produto ────────────────────────────────────────────────────
  const mDesc = area.querySelector("#m-desc");
  const acProd = area.querySelector("#ac-prod");
  mDesc.addEventListener("input", () => {
    const q = mDesc.value.trim().toLowerCase();
    if (!q) { acProd.style.display = "none"; return; }
    const matches = state.produtos
      .filter(p => p.nome.toLowerCase().includes(q)).slice(0, 7);
    if (!matches.length) { acProd.style.display = "none"; return; }
    acProd.innerHTML = matches
      .map(p => `<div class="ac-item" data-nome="${esc(p.nome)}">${esc(p.nome)}</div>`).join("");
    acProd.style.display = "block";
  });
  acProd.addEventListener("click", e => {
    const it = e.target.closest(".ac-item"); if (!it) return;
    mDesc.value = it.dataset.nome;
    acProd.style.display = "none";
  });

  // ── Autocomplete cliente ────────────────────────────────────────────────────
  const mCli = area.querySelector("#m-cliente");
  const acCli = area.querySelector("#ac-cli");
  mCli.addEventListener("input", () => {
    const q = mCli.value.trim().toLowerCase();
    if (!q) { acCli.style.display = "none"; return; }
    const matches = state.clientes
      .filter(c => c.nome.toLowerCase().includes(q)).slice(0, 6);
    if (!matches.length) { acCli.style.display = "none"; return; }
    acCli.innerHTML = matches
      .map(c => `<div class="ac-item" data-nome="${esc(c.nome)}">${esc(c.nome)}</div>`).join("");
    acCli.style.display = "block";
  });
  acCli.addEventListener("click", e => {
    const it = e.target.closest(".ac-item"); if (!it) return;
    mCli.value = it.dataset.nome;
    acCli.style.display = "none";
  });

  // ── Botão novo produto ──────────────────────────────────────────────────────
  area.querySelector("#btn-add-prod").addEventListener("click", () => {
    const descAtual = mDesc.value.trim();
    const cliAtual  = mCli.value.trim();
    const dataAtual = area.querySelector("#m-data").value;
    const valAtual  = area.querySelector("#m-valor").value;
    const obsAtual  = area.querySelector("#m-obs").value;
    // Salva contexto para retomar o modal
    state._modalCtx = {
      tipo: tipoAtual, descAtual, cliAtual,
      dataAtual, valAtual, obsAtual,
    };
    abrirModalNovoProduto(container, descAtual);
  });

  // ── Fechar ──────────────────────────────────────────────────────────────────
  area.querySelector("#m-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => {
    if (e.target.id === "modal-bg") area.innerHTML = "";
  });

  // ── Salvar ──────────────────────────────────────────────────────────────────
  area.querySelector("#m-ok").addEventListener("click", async () => {
    const desc  = area.querySelector("#m-desc").value.trim();
    const valor = parseFloat(area.querySelector("#m-valor").value);
    const data  = area.querySelector("#m-data").value;

    if (!desc)  { flashInput(area.querySelector("#m-desc"));  return; }
    if (!valor || valor <= 0) { flashInput(area.querySelector("#m-valor")); return; }
    if (!data)  { flashInput(area.querySelector("#m-data"));  return; }

    const payload = {
      tipo:         tipoAtual,
      data,
      descricao:    desc,
      cliente_nome: area.querySelector("#m-cliente").value.trim() || null,
      valor,
      observacoes:  area.querySelector("#m-obs").value.trim() || null,
      origem:       dados.origem || "manual",
    };

    if (editando) {
      await supabase.from("caixa_movimentos").update({ ...payload, updated_at: new Date() }).eq("id", dados.id);
    } else {
      await supabase.from("caixa_movimentos").insert(payload);
    }

    area.innerHTML = "";
    state.filtroDia = data; // navega para o dia do lançamento
    await carregar();
    render(container);
    showToast(container, `✅ ${tipoAtual === "entrada" ? "Entrada" : "Saída"} registrada!`);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: NOVO PRODUTO RÁPIDO (sem sair do caixa)
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalNovoProduto(container, nomeInicial = "") {
  const area = container.querySelector("#modal-area");

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg-prod">
      <div class="modal" style="max-width:400px">
        <h3><i class="fi fi-rr-box-open" style="color:var(--primary)"></i> Cadastrar Produto</h3>
        <p style="font-size:12px;color:var(--muted);margin:0 0 14px;background:var(--panel2);padding:10px 12px;border-radius:var(--radius-md);border-left:3px solid var(--primary)">
          Após salvar, o produto será selecionado automaticamente no lançamento.
        </p>

        <label>Nome do produto / serviço *</label>
        <input id="np-nome" value="${esc(nomeInicial)}" placeholder="Ex: Banner 1×2m, Cartão de visita..." autofocus />

        <label style="margin-top:12px">Preço de venda (R$) <span style="font-size:11px;color:var(--muted2)">opcional</span></label>
        <div class="preco-field">
          <span>R$</span>
          <input id="np-preco" type="number" min="0" step="0.01" placeholder="0,00" />
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          <div>
            <label>Categoria</label>
            <input id="np-cat" placeholder="Ex: Lona, Papel..." />
          </div>
          <div>
            <label>Unidade</label>
            <select id="np-un">
              ${["un","m²","m","folha","kg","rolo","caixa"].map(u =>
                `<option value="${u}">${u}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="modal-btns">
          <button class="btn-secondary" id="np-cancel">← Voltar ao lançamento</button>
          <button class="btn-primary" id="np-ok">
            <i class="fi fi-rr-add"></i> Cadastrar e selecionar
          </button>
        </div>
      </div>
    </div>`;

  area.querySelector("#np-cancel").addEventListener("click", () => {
    // Volta ao modal de lançamento com contexto salvo
    const ctx = state._modalCtx || {};
    area.innerHTML = "";
    abrirModalLancamento(container, ctx.tipo || "entrada", {
      data:        ctx.dataAtual,
      valor:       ctx.valAtual,
      observacoes: ctx.obsAtual,
    }, { produtoNome: ctx.descAtual, clienteNome: ctx.cliAtual });
  });

  area.querySelector("#modal-bg-prod").addEventListener("click", e => {
    if (e.target.id === "modal-bg-prod") area.querySelector("#np-cancel").click();
  });

  area.querySelector("#np-ok").addEventListener("click", async () => {
    const nome = area.querySelector("#np-nome").value.trim();
    if (!nome) { flashInput(area.querySelector("#np-nome")); return; }

    const preco = parseFloat(area.querySelector("#np-preco").value) || null;
    // Busca ou cria categoria
    let catId = null;
    const catNome = area.querySelector("#np-cat").value.trim();
    if (catNome) {
      const { data: cats } = await supabase.from("categorias")
        .select("id").ilike("nome", catNome).single();
      if (cats) {
        catId = cats.id;
      } else {
        const { data: novaCat } = await supabase.from("categorias")
          .insert({ nome: catNome }).select().single();
        catId = novaCat?.id || null;
      }
    }

    const { data: novoProd } = await supabase.from("produtos")
      .insert({ nome, preco_venda: preco, categoria_id: catId,
                unidade: area.querySelector("#np-un").value })
      .select().single();

    if (novoProd) state.produtos.push(novoProd);

    // Volta ao modal com o produto já preenchido
    const ctx = state._modalCtx || {};
    area.innerHTML = "";
    abrirModalLancamento(container, ctx.tipo || "entrada", {
      data:        ctx.dataAtual,
      valor:       ctx.valAtual,
      observacoes: ctx.obsAtual,
    }, { produtoNome: nome, clienteNome: ctx.cliAtual });

    showToast(container, `✅ Produto "${nome}" cadastrado!`);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: IMPORTAR VENDAS PAGAS EM DINHEIRO
// ══════════════════════════════════════════════════════════════════════════════
async function abrirModalImportar(container) {
  const area = container.querySelector("#modal-area");

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg-imp">
      <div class="modal" style="max-width:540px">
        <h3><i class="fi fi-rr-arrow-down-to-square" style="color:var(--primary)"></i> Importar Vendas para o Caixa</h3>
        <p style="font-size:12px;color:var(--muted);margin:0 0 14px">
          Carregando vendas disponíveis...
        </p>
      </div>
    </div>`;

  // Busca vendas entregues/prontas que ainda não foram importadas para o caixa
  const { data: vendas } = await supabase
    .from("vendas")
    .select("id, cliente_nome, total, status, created_at, tipo")
    .in("status", ["entregue", "pronto"])
    .order("created_at", { ascending: false })
    .limit(50);

  // Descobre quais já foram importadas
  const vendaIdsImportadas = new Set(
    state.movimentos.filter(m => m.venda_id).map(m => m.venda_id)
  );

  const disponiveis = (vendas || []).filter(v => !vendaIdsImportadas.has(v.id));

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg-imp">
      <div class="modal" style="max-width:560px">
        <h3><i class="fi fi-rr-arrow-down-to-square" style="color:var(--primary)"></i> Importar Vendas para o Caixa</h3>
        <p style="font-size:12px;color:var(--muted);margin:0 0 14px;line-height:1.5">
          Selecione as vendas pagas em dinheiro físico para lançar no caixa.
          Vendas já importadas não aparecem aqui.
        </p>

        ${disponiveis.length === 0
          ? `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">
              <i class="fi fi-rr-check-circle" style="font-size:24px;color:var(--info);display:block;margin-bottom:8px"></i>
              Nenhuma venda pendente de importação.<br>
              Todas as vendas prontas/entregues já foram lançadas no caixa.
             </div>`
          : `<div class="imp-lista">
              ${disponiveis.map(v => {
                const data = new Date(v.created_at).toLocaleDateString("pt-BR");
                return `
                  <label class="imp-item">
                    <input type="checkbox" class="imp-chk" data-id="${v.id}"
                      data-cliente="${esc(v.cliente_nome||"")}"
                      data-total="${v.total}"
                      data-desc="${esc(v.tipo||"Venda")} — ${esc(v.cliente_nome||"Sem cliente")}"
                      data-data="${v.created_at?.slice(0,10)||state.filtroDia}" />
                    <div class="imp-info">
                      <div style="font-weight:600">${esc(v.cliente_nome)||"Sem cliente"}</div>
                      <div style="font-size:12px;color:var(--muted)">${data} · ${v.tipo||"Venda/O.S."}</div>
                    </div>
                    <div class="imp-valor">R$ ${Number(v.total||0).toFixed(2)}</div>
                  </label>`;
              }).join("")}
             </div>`}

        <div class="modal-btns">
          <button class="btn-secondary" id="imp-cancel">Cancelar</button>
          ${disponiveis.length > 0
            ? `<button class="btn-primary" id="imp-ok">
                <i class="fi fi-rr-check"></i> Importar selecionadas
               </button>`
            : ""}
        </div>
      </div>
    </div>`;

  area.querySelector("#imp-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg-imp").addEventListener("click", e => {
    if (e.target.id === "modal-bg-imp") area.innerHTML = "";
  });

  area.querySelector("#imp-ok")?.addEventListener("click", async () => {
    const selecionadas = [...area.querySelectorAll(".imp-chk:checked")];
    if (!selecionadas.length) { showToast(container, "⚠️ Selecione ao menos uma venda.", "warn"); return; }

    const inserts = selecionadas.map(chk => ({
      tipo:         "entrada",
      data:         chk.dataset.data || state.filtroDia,
      descricao:    chk.dataset.desc,
      cliente_nome: chk.dataset.cliente || null,
      valor:        parseFloat(chk.dataset.total) || 0,
      venda_id:     chk.dataset.id,
      origem:       "venda",
    }));

    await supabase.from("caixa_movimentos").insert(inserts);

    area.innerHTML = "";
    await carregar();
    render(container);
    showToast(container, `✅ ${inserts.length} venda(s) importada(s) para o caixa!`);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatHora(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function flashInput(el) {
  if (!el) return;
  el.style.borderColor = "var(--error)";
  el.focus();
  setTimeout(() => el.style.borderColor = "", 1500);
}

function showToast(container, msg, tipo = "ok") {
  const t = document.createElement("div");
  t.className = `cx-toast ${tipo}`;
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
/* ── Header ── */
.cx-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  margin-bottom:16px; flex-wrap:wrap; gap:10px;
}
.cx-header-actions {
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
}
.cx-header-actions input[type="date"] {
  background:var(--panel2); border:1px solid var(--border-md);
  color:var(--text); border-radius:var(--radius-md);
  padding:7px 10px; font-size:13px; width:auto;
}

/* ── Botões de ação ── */
.btn-entrada-cx {
  display:inline-flex; align-items:center; gap:6px;
  background:var(--info); color:#fff; border:none;
  border-radius:var(--radius-md); padding:8px 14px;
  font-family:var(--font); font-size:13px; font-weight:600;
  cursor:pointer; transition:all var(--t);
}
.btn-entrada-cx:hover { opacity:.88; }

.btn-saida-cx {
  display:inline-flex; align-items:center; gap:6px;
  background:var(--error-bg); color:var(--error);
  border:1px solid var(--error-border); border-radius:var(--radius-md);
  padding:8px 14px; font-family:var(--font); font-size:13px; font-weight:600;
  cursor:pointer; transition:all var(--t);
}
.btn-saida-cx:hover { background:var(--error); color:#fff; }

.btn-importar {
  display:inline-flex; align-items:center; gap:6px;
  background:var(--primary-bg); color:var(--primary-light);
  border:1px solid var(--primary-border); border-radius:var(--radius-md);
  padding:8px 14px; font-family:var(--font); font-size:13px; font-weight:600;
  cursor:pointer; transition:all var(--t);
}
.btn-importar:hover { background:var(--primary); color:#fff; }

/* ── KPIs ── */
.cx-kpis {
  display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px;
}
@media(max-width:600px){ .cx-kpis { grid-template-columns:1fr; } }

.cx-kpi {
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-lg); padding:14px;
}
.cx-kpi.destaque { border-top:3px solid var(--primary); }
.cx-kpi-label { font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
.cx-kpi-val { font-size:22px; font-weight:800; line-height:1.1; margin:4px 0 2px; }
.cx-kpi-val.entrada  { color:var(--info); }
.cx-kpi-val.saida    { color:var(--error); }
.cx-kpi-val.positivo { color:var(--info); }
.cx-kpi-val.negativo { color:var(--error); }
.cx-kpi-sub { font-size:11px; color:var(--muted); }

/* ── Tabela ── */
.cx-table-wrap {
  overflow-x:auto; border-radius:var(--radius-lg);
  border:1px solid var(--border); background:var(--panel2);
}
.cx-table { width:100%; border-collapse:collapse; font-size:13px; }
.cx-table th {
  text-align:left; font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.05em; color:var(--muted); padding:10px 14px;
  background:var(--panel); border-bottom:1px solid var(--border); white-space:nowrap;
}
.cx-table td { padding:11px 14px; border-bottom:1px solid var(--border); vertical-align:middle; }
.cx-table tr:last-child td { border-bottom:none; }
.cx-row { transition:background var(--t); }
.cx-row:hover td { background:rgba(0,124,190,0.04); }
.cx-row.entrada { border-left:3px solid transparent; }
.cx-row.entrada:hover { border-left-color:var(--info); }
.cx-row.saida:hover   { border-left-color:var(--error); }

.cx-hora   { font-size:12px; color:var(--muted); font-variant-numeric:tabular-nums; }
.cx-desc   { font-weight:600; font-size:13px; }
.cx-sub    { font-size:11px; color:var(--muted); display:flex; align-items:center; gap:4px; margin-top:2px; }
.cx-cliente{ font-size:12px; color:var(--muted); }
.cx-valor  { font-weight:700; font-size:14px; font-variant-numeric:tabular-nums; }
.cx-valor.entrada { color:var(--info); }
.cx-valor.saida   { color:var(--error); }
.cx-saldo  { font-weight:700; font-size:13px; text-align:right; font-variant-numeric:tabular-nums; }
.cx-saldo.positivo { color:var(--text-sub); }
.cx-saldo.negativo { color:var(--error); }
.cx-acoes  { display:flex; gap:5px; justify-content:flex-end; }
.cx-vazio  { text-align:center; padding:40px 20px; color:var(--muted); font-size:13px; }

/* ── Tipo pill ── */
.tipo-pill {
  display:inline-flex; align-items:center; gap:5px;
  font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; white-space:nowrap;
}
.tipo-pill.entrada { background:var(--info-bg);  color:var(--info); }
.tipo-pill.saida   { background:var(--error-bg); color:var(--error); }

/* ── Botões icon na tabela ── */
.btn-icon-cx {
  display:inline-flex; align-items:center; justify-content:center;
  width:28px; height:28px; border-radius:var(--radius-sm);
  background:transparent; border:1px solid var(--border);
  color:var(--muted); cursor:pointer; font-size:12px; transition:all var(--t);
}
.btn-icon-cx:hover { border-color:var(--primary); color:var(--primary-light); background:var(--primary-bg); }
.btn-icon-cx.danger:hover { border-color:var(--error-border); color:var(--error); background:var(--error-bg); }

/* ── Modal ── */
.modal-bg {
  position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  z-index:100; animation:fadeIn .12s ease;
}
.modal {
  background:var(--panel); border:1px solid var(--border-md);
  border-radius:var(--radius-xl); padding:24px;
  min-width:340px; max-width:480px; width:92%;
  max-height:90vh; overflow-y:auto;
  box-shadow:var(--shadow-lg); animation:slideUp .15s ease;
}
.modal h3 { font-size:16px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
.modal-title-row { border-left:4px solid var(--primary); padding-left:10px; margin-bottom:16px; transition:border-color .2s; }
.modal label { display:block; font-size:12px; font-weight:500; color:var(--muted); margin-bottom:5px; margin-top:14px; }
.modal label:first-of-type { margin-top:0; }
.modal-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:20px; padding-top:16px; border-top:1px solid var(--border); }

/* ── Tipo switch no modal ── */
.modal-tipo-switch { display:flex; gap:0; border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--border-md); }
.tipo-sw {
  flex:1; display:flex; align-items:center; justify-content:center; gap:6px;
  padding:9px; border:none; background:var(--panel2); color:var(--muted);
  font-family:var(--font); font-size:13px; font-weight:600; cursor:pointer;
  transition:all var(--t);
}
.tipo-sw.entrada.active { background:var(--info-bg); color:var(--info); }
.tipo-sw.saida.active   { background:var(--error-bg); color:var(--error); }

/* ── Campo preço ── */
.preco-field {
  display:flex; align-items:center;
  background:var(--panel2); border:1px solid var(--border-md);
  border-radius:var(--radius-md); overflow:hidden;
  transition:border-color var(--t);
}
.preco-field:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px rgba(0,124,190,0.10); }
.preco-field span {
  padding:0 10px; font-size:12px; font-weight:600; color:var(--muted);
  background:var(--panel); border-right:1px solid var(--border);
  display:flex; align-items:center; flex-shrink:0;
}
.preco-field input { border:none; background:transparent; flex:1; padding:9px 10px; font-size:13px; color:var(--text); font-family:var(--font); }
.preco-field input:focus { outline:none; box-shadow:none; }

/* ── Produto search ── */
.prod-search-wrap { display:flex; gap:8px; align-items:flex-start; }
.prod-search-wrap .autocomplete-wrap { flex:1; }
.btn-add-prod {
  display:inline-flex; align-items:center; gap:5px; flex-shrink:0;
  background:var(--success-bg); color:var(--success);
  border:1px solid var(--success-border); border-radius:var(--radius-md);
  padding:9px 12px; font-family:var(--font); font-size:12px; font-weight:600;
  cursor:pointer; transition:all var(--t); white-space:nowrap;
  margin-top:22px; /* alinha com o input após o label */
}
.btn-add-prod:hover { background:var(--success); color:#fff; }

/* ── Autocomplete ── */
.autocomplete-wrap { position:relative; }
.autocomplete-list {
  display:none; position:absolute; top:100%; left:0; right:0; z-index:50;
  background:var(--panel); border:1px solid var(--border-md);
  border-radius:var(--radius-md); box-shadow:var(--shadow-md);
  max-height:180px; overflow-y:auto;
}
.ac-item { padding:9px 12px; font-size:13px; cursor:pointer; transition:background var(--t); }
.ac-item:hover { background:var(--primary-bg); color:var(--primary-light); }

/* ── Importar vendas ── */
.imp-lista {
  display:flex; flex-direction:column; gap:6px;
  max-height:300px; overflow-y:auto; margin-bottom:4px;
}
.imp-item {
  display:flex; align-items:center; gap:12px;
  background:var(--panel2); border:1px solid var(--border);
  border-radius:var(--radius-md); padding:10px 14px;
  cursor:pointer; transition:border-color var(--t);
}
.imp-item:hover { border-color:var(--primary-border); }
.imp-item input[type="checkbox"] { width:16px; height:16px; flex-shrink:0; cursor:pointer; accent-color:var(--primary); }
.imp-info { flex:1; }
.imp-valor { font-size:15px; font-weight:700; color:var(--info); white-space:nowrap; }

/* ── Botões globais ── */
.btn-primary {
  display:inline-flex; align-items:center; gap:6px;
  background:var(--primary); color:#fff; border:1px solid var(--primary);
  border-radius:var(--radius-md); padding:9px 18px;
  font-family:var(--font); font-size:13px; font-weight:600;
  cursor:pointer; transition:all var(--t);
}
.btn-primary:hover { opacity:.88; }
.btn-secondary {
  display:inline-flex; align-items:center; gap:6px;
  background:transparent; border:1px solid var(--border-md);
  color:var(--text-sub); border-radius:var(--radius-md);
  padding:9px 16px; font-family:var(--font); font-size:13px; font-weight:500;
  cursor:pointer; transition:all var(--t);
}
.btn-secondary:hover { background:var(--panel2); color:var(--text); }

/* ── Toast ── */
.cx-toast {
  position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
  background:var(--panel); border:1px solid var(--border-md);
  color:var(--text); border-radius:var(--radius-lg); padding:12px 24px;
  font-size:13px; font-weight:600; box-shadow:var(--shadow-lg);
  z-index:999; animation:slideUp .2s ease; white-space:nowrap;
}
.cx-toast.warn { border-color:var(--warning-bg); color:var(--warning); }
`; }