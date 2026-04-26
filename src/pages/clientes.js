import { supabase } from "../supabase/client.js";

let state = {
  clientes: [],
  busca: "",
  aberto: null, // cliente sendo editado
};

export async function Clientes(container) {
  container.innerHTML = `<div class="loading">Carregando clientes...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .order("nome");
  state.clientes = data || [];
}

// ─── Lista ────────────────────────────────────────────────────────────────────
function render(container) {
  if (state.aberto !== null) { renderForm(container); return; }

  const filtrados = state.busca
    ? state.clientes.filter(c =>
        c.nome?.toLowerCase().includes(state.busca.toLowerCase()) ||
        c.telefone?.includes(state.busca) ||
        c.cpf_cnpj?.includes(state.busca) ||
        c.email?.toLowerCase().includes(state.busca.toLowerCase())
      )
    : state.clientes;

  container.innerHTML = `
    <style>
      .cli-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:8px; }
      .cli-header h2 { margin:0; }
      .busca-wrap { flex:1; max-width:320px; }
      .busca-wrap input { width:100%; background:var(--panel2); border:1px solid rgba(255,255,255,0.1); color:var(--text); border-radius:8px; padding:8px 12px; font-size:13px; box-sizing:border-box; }
      .cli-resumo { font-size:13px; color:var(--muted); margin-bottom:12px; }

      .cli-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:10px; }
      .cli-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; cursor:pointer; transition:border-color .15s; }
      .cli-card:hover { border-color:rgba(106,166,255,0.35); }
      .cli-avatar { width:36px; height:36px; border-radius:50%; background:rgba(106,166,255,0.15); color:var(--accent); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; margin-bottom:10px; }
      .cli-nome { font-weight:600; font-size:14px; margin-bottom:4px; }
      .cli-info { font-size:12px; color:var(--muted); display:flex; flex-direction:column; gap:2px; }
      .cli-info span { display:flex; align-items:center; gap:5px; }
      .cli-doc { margin-top:6px; font-size:11px; color:var(--muted); background:rgba(255,255,255,0.04); border-radius:4px; padding:2px 6px; display:inline-block; }

      .cli-vazio { color:var(--muted); text-align:center; padding:40px; }
      .btn-primary { background:var(--accent); color:#000; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px; font-weight:600; }
    </style>

    <div class="cli-header">
      <h2>Clientes</h2>
      <div class="busca-wrap">
        <input id="busca" placeholder="🔍 Buscar por nome, telefone, CPF/CNPJ..." value="${state.busca}" />
      </div>
      <button class="btn-primary" id="btn-novo">+ Novo Cliente</button>
    </div>

    <div class="cli-resumo">${filtrados.length} cliente${filtrados.length !== 1 ? "s" : ""}${state.busca ? " encontrado" + (filtrados.length !== 1 ? "s" : "") : " cadastrado" + (filtrados.length !== 1 ? "s" : "")}</div>

    <div class="cli-grid">
      ${filtrados.length === 0
        ? `<div class="cli-vazio">${state.busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</div>`
        : filtrados.map(c => {
            const inicial = (c.nome || "?")[0].toUpperCase();
            return `
              <div class="cli-card" data-id="${c.id}">
                <div class="cli-avatar">${inicial}</div>
                <div class="cli-nome">${c.nome}</div>
                <div class="cli-info">
                  ${c.telefone ? `<span>📞 ${c.telefone}</span>` : ""}
                  ${c.email    ? `<span>✉️ ${c.email}</span>` : ""}
                  ${c.cidade   ? `<span>📍 ${c.cidade}${c.estado ? ` — ${c.estado}` : ""}</span>` : ""}
                </div>
                ${c.cpf_cnpj  ? `<div class="cli-doc">📄 ${c.cpf_cnpj}</div>` : ""}
              </div>`;
          }).join("")
      }
    </div>
  `;

  container.querySelector("#busca").addEventListener("input", (e) => {
    state.busca = e.target.value;
    render(container);
  });

  container.querySelector("#btn-novo").addEventListener("click", () => {
    state.aberto = {};
    renderForm(container);
  });

  container.querySelectorAll("[data-id]").forEach(card =>
    card.addEventListener("click", () => {
      state.aberto = state.clientes.find(c => c.id === card.dataset.id);
      renderForm(container);
    })
  );
}

// ─── Formulário (novo / editar) ───────────────────────────────────────────────
function renderForm(container) {
  const c = state.aberto || {};
  const editando = !!c.id;

  container.innerHTML = `
    <style>
      .form-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
      .form-header h2 { margin:0; }
      .form-card { background:var(--panel2); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:20px; margin-bottom:12px; }
      .form-card h4 { margin:0 0 14px; font-size:13px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
      .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      @media(max-width:580px){ .form-grid { grid-template-columns:1fr; } }
      .form-group { display:flex; flex-direction:column; gap:5px; }
      .form-group.full { grid-column:1/-1; }
      .form-group label { font-size:12px; color:var(--muted); }
      .form-group input, .form-group textarea {
        background:var(--panel); border:1px solid rgba(255,255,255,0.1);
        color:var(--text); border-radius:8px; padding:9px 12px; font-size:13px;
      }
      .form-group textarea { resize:vertical; min-height:70px; }
      .form-acoes { display:flex; gap:8px; flex-wrap:wrap; }
      .btn-primary  { background:var(--accent); color:#000; border:none; border-radius:8px; padding:9px 20px; cursor:pointer; font-size:13px; font-weight:600; }
      .btn-secondary{ background:transparent; border:1px solid rgba(255,255,255,0.15); color:var(--text); border-radius:8px; padding:9px 16px; cursor:pointer; font-size:13px; }
      .btn-danger   { background:rgba(255,107,107,0.1); border:1px solid #ff6b6b44; color:#ff6b6b; border-radius:8px; padding:9px 16px; cursor:pointer; font-size:13px; }
    </style>

    <div class="form-header">
      <button class="btn-secondary" id="btn-voltar">← Voltar</button>
      <h2>${editando ? "Editar Cliente" : "Novo Cliente"}</h2>
    </div>

    <!-- Dados principais -->
    <div class="form-card">
      <h4>Dados principais</h4>
      <div class="form-grid">
        <div class="form-group full">
          <label>Nome *</label>
          <input id="f-nome" value="${c.nome||""}" placeholder="Nome completo ou razão social" autofocus />
        </div>
        <div class="form-group">
          <label>Telefone / WhatsApp</label>
          <input id="f-tel" value="${c.telefone||""}" placeholder="(11) 99999-9999" />
        </div>
        <div class="form-group">
          <label>E-mail</label>
          <input id="f-email" type="email" value="${c.email||""}" placeholder="email@exemplo.com" />
        </div>
        <div class="form-group full">
          <label>CPF / CNPJ</label>
          <input id="f-doc" value="${c.cpf_cnpj||""}" placeholder="000.000.000-00 ou 00.000.000/0000-00" />
        </div>
      </div>
    </div>

    <!-- Endereço -->
    <div class="form-card">
      <h4>Endereço</h4>
      <div class="form-grid">
        <div class="form-group full">
          <label>Endereço (rua, número, bairro)</label>
          <input id="f-end" value="${c.endereco||""}" placeholder="Rua Exemplo, 123 — Centro" />
        </div>
        <div class="form-group">
          <label>Cidade</label>
          <input id="f-cidade" value="${c.cidade||""}" placeholder="São Paulo" />
        </div>
        <div class="form-group">
          <label>Estado</label>
          <input id="f-estado" value="${c.estado||""}" placeholder="SP" maxlength="2" />
        </div>
        <div class="form-group">
          <label>CEP</label>
          <input id="f-cep" value="${c.cep||""}" placeholder="00000-000" />
        </div>
      </div>
    </div>

    <!-- Observações -->
    <div class="form-card">
      <h4>Observações</h4>
      <div class="form-group">
        <textarea id="f-obs" placeholder="Preferências, prazo de pagamento, observações gerais...">${c.observacoes||""}</textarea>
      </div>
    </div>

    <div class="form-acoes">
      <button class="btn-primary" id="btn-salvar">💾 Salvar</button>
      ${editando ? `<button class="btn-danger" id="btn-deletar">🗑 Deletar cliente</button>` : ""}
    </div>
  `;

  container.querySelector("#btn-voltar").addEventListener("click", () => {
    state.aberto = null;
    render(container);
  });

  container.querySelector("#btn-salvar").addEventListener("click", async () => {
    const nome = container.querySelector("#f-nome").value.trim();
    if (!nome) { alert("O nome é obrigatório."); return; }

    const dados = {
      nome,
      telefone:   container.querySelector("#f-tel").value.trim()||null,
      email:      container.querySelector("#f-email").value.trim()||null,
      cpf_cnpj:   container.querySelector("#f-doc").value.trim()||null,
      endereco:   container.querySelector("#f-end").value.trim()||null,
      cidade:     container.querySelector("#f-cidade").value.trim()||null,
      estado:     container.querySelector("#f-estado").value.trim().toUpperCase()||null,
      cep:        container.querySelector("#f-cep").value.trim()||null,
      observacoes:container.querySelector("#f-obs").value.trim()||null,
      updated_at: new Date(),
    };

    if (editando) {
      await supabase.from("clientes").update(dados).eq("id", c.id);
    } else {
      await supabase.from("clientes").insert(dados);
    }

    state.aberto = null;
    await carregar();
    render(container);
  });

  container.querySelector("#btn-deletar")?.addEventListener("click", async () => {
    if (!confirm(`Deletar o cliente "${c.nome}"?`)) return;
    await supabase.from("clientes").delete().eq("id", c.id);
    state.aberto = null;
    await carregar();
    render(container);
  });
}