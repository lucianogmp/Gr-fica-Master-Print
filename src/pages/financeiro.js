import { supabase } from "../supabase/client.js";
import { fmtBRL, fmtBRL4, fmtBRLK, fmtQtd } from "../utils/fmt.js";

const CATEGORIAS_RECEITA = ["Venda","Serviço","Outros"];
const CATEGORIAS_DESPESA = ["Fornecedor","Aluguel","Salário","Material","Imposto","Outros"];

let state = {
  lancamentos: [],
  aba: "resumo",
  filtroStatus: "",
  filtroMes: mesAtual(),
};

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

export async function Financeiro(container) {
  container.innerHTML = `<div class="loading">Carregando financeiro...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const { data } = await supabase
    .from("lancamentos")
    .select("*")
    .order("data_vencimento", { ascending: true });
  state.lancamentos = data || [];
}

function render(container) {
  const hoje = new Date().toISOString().split("T")[0];

  const doMes = state.lancamentos.filter(l => {
    const ref = l.data_vencimento || l.created_at?.slice(0,10);
    return ref?.startsWith(state.filtroMes);
  });

  const receitas  = doMes.filter(l => l.tipo === "receita");
  const despesas  = doMes.filter(l => l.tipo === "despesa");
  const totalRec  = receitas.reduce((s,l) => s + Number(l.valor), 0);
  const totalDesp = despesas.reduce((s,l) => s + Number(l.valor), 0);
  const saldo     = totalRec - totalDesp;
  const recebido  = receitas.filter(l=>l.status==="pago").reduce((s,l)=>s+Number(l.valor),0);
  const pago      = despesas.filter(l=>l.status==="pago").reduce((s,l)=>s+Number(l.valor),0);
  const aReceber  = receitas.filter(l=>l.status==="pendente").reduce((s,l)=>s+Number(l.valor),0);
  const aPagar    = despesas.filter(l=>l.status==="pendente").reduce((s,l)=>s+Number(l.valor),0);

  const vencidos = state.lancamentos.filter(l =>
    l.status === "pendente" && l.data_vencimento && l.data_vencimento < hoje
  );

  container.innerHTML = `
    <style>
      ${css()}
    </style>

    <div class="fin-header">
      <h2>Gerente Financeiro</h2>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="month" id="filtro-mes" value="${state.filtroMes}"
          style="background:var(--panel2);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:8px;padding:7px 10px;font-size:13px" />
        <button class="btn-primary" id="btn-novo-rec">+ Receita</button>
        <button class="btn-desp"    id="btn-novo-dep">+ Despesa</button>
      </div>
    </div>

    ${vencidos.length ? `
      <div class="alerta-venc">
        ⚠️ <b>${vencidos.length} lançamento${vencidos.length>1?"s":""} vencido${vencidos.length>1?"s":""}</b> —
        ${vencidos.slice(0,3).map(l=>`${l.descricao} (R$ ${Number(l.valor).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})})`).join(", ")}
        ${vencidos.length>3?`e mais ${vencidos.length-3}...`:""}
      </div>` : ""}

    <div class="kpi-grid">
      <div class="kpi-card receita">
        <div class="k">Receitas do mês</div>
        <div class="v">R$ ${totalRec.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="sub">Recebido: R$ ${recebido.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})} · A receber: R$ ${aReceber.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      </div>
      <div class="kpi-card despesa">
        <div class="k">Despesas do mês</div>
        <div class="v">R$ ${totalDesp.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="sub">Pago: R$ ${pago.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})} · A pagar: R$ ${aPagar.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      </div>
      <div class="kpi-card ${saldo>=0?"saldo-pos":"saldo-neg"}">
        <div class="k">Saldo do mês</div>
        <div class="v">${saldo>=0?"+":""}R$ ${saldo.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="sub">Realizado: R$ ${(recebido-pago).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      </div>
    </div>

    <div class="fin-abas">
      ${["resumo","receitas","despesas","fluxo"].map(a => `
        <button class="aba-btn ${state.aba===a?"active":""}" data-aba="${a}">
          ${{resumo:"📊 Resumo",receitas:"📈 Receitas",despesas:"📉 Despesas",fluxo:"💧 Fluxo de Caixa"}[a]}
        </button>`).join("")}
    </div>

    <div id="fin-body"></div>
    <div id="modal-area"></div>
  `;

  container.querySelector("#filtro-mes").addEventListener("change", e => {
    state.filtroMes = e.target.value;
    render(container);
  });
  container.querySelector("#btn-novo-rec").addEventListener("click", () => abrirModal(container, "receita"));
  container.querySelector("#btn-novo-dep").addEventListener("click", () => abrirModal(container, "despesa"));
  container.querySelectorAll("[data-aba]").forEach(b =>
    b.addEventListener("click", () => { state.aba = b.dataset.aba; render(container); })
  );

  const body = container.querySelector("#fin-body");
  if (state.aba === "resumo")   renderResumo(body, doMes, receitas, despesas);
  if (state.aba === "receitas") renderTabela(body, container, receitas, "receita");
  if (state.aba === "despesas") renderTabela(body, container, despesas, "despesa");
  if (state.aba === "fluxo")    renderFluxo(body, container);
}

function renderResumo(body, doMes, receitas, despesas) {
  const fmtV = v => `R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const porCat = (lista) => {
    const map = {};
    lista.forEach(l => {
      const cat = l.categoria || "Outros";
      map[cat] = (map[cat]||0) + Number(l.valor);
    });
    return Object.entries(map).sort((a,b) => b[1]-a[1]);
  };

  const catRec  = porCat(receitas);
  const catDesp = porCat(despesas);
  const maxRec  = Math.max(...catRec.map(c=>c[1]), 1);
  const maxDesp = Math.max(...catDesp.map(c=>c[1]), 1);

  const barras = (lista, max, cor) => lista.map(([cat, val]) => `
    <div class="barra-row">
      <span class="barra-cat">${cat}</span>
      <div class="barra-wrap">
        <div class="barra-fill" style="width:${(val/max*100).toFixed(1)}%;background:${cor}"></div>
      </div>
      <span class="barra-val">${fmtV(val)}</span>
    </div>`).join("") || `<div style="color:var(--muted);font-size:13px">Nenhum lançamento.</div>`;

  const proximos = state.lancamentos
    .filter(l => l.status === "pendente" && l.data_vencimento)
    .sort((a,b) => a.data_vencimento.localeCompare(b.data_vencimento))
    .slice(0, 6);

  body.innerHTML = `
    <div class="resumo-grid">
      <div class="res-bloco">
        <h4>📈 Receitas por categoria</h4>
        ${barras(catRec, maxRec, "#69db7c")}
      </div>
      <div class="res-bloco">
        <h4>📉 Despesas por categoria</h4>
        ${barras(catDesp, maxDesp, "#ff6b6b")}
      </div>
    </div>

    <div class="res-bloco" style="margin-top:12px">
      <h4>🗓 Próximos vencimentos</h4>
      ${proximos.length === 0
        ? `<div style="color:var(--muted);font-size:13px">Nenhum vencimento pendente.</div>`
        : proximos.map(l => {
            const hoje = new Date().toISOString().split("T")[0];
            const atrasado = l.data_vencimento < hoje;
            return `
              <div class="venc-row">
                <span class="venc-tipo ${l.tipo}">${l.tipo === "receita" ? "▲" : "▼"}</span>
                <span class="venc-desc">${l.descricao}</span>
                <span class="venc-data ${atrasado?"atrasado":""}">${formatData(l.data_vencimento)}</span>
                <span class="venc-val">${fmtV(l.valor)}</span>
              </div>`;
          }).join("")
      }
    </div>
  `;
}

function renderTabela(body, container, lista, tipo) {
  const fmtV = v => `R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const hoje = new Date().toISOString().split("T")[0];

  body.innerHTML = `
    <div class="tab-filtros">
      ${["","pendente","pago","cancelado"].map(s => `
        <button class="filtro-btn ${state.filtroStatus===s?"active":""}" data-fs="${s}">
          ${s===""?"Todos":s==="pendente"?"🕐 Pendente":s==="pago"?"✅ Pago":"❌ Cancelado"}
        </button>`).join("")}
    </div>
    <table class="fin-table">
      <thead><tr>
        <th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${(state.filtroStatus ? lista.filter(l=>l.status===state.filtroStatus) : lista)
          .map(l => {
            const atrasado = l.status==="pendente" && l.data_vencimento && l.data_vencimento < hoje;
            return `
              <tr class="${atrasado?"row-atrasado":""}">
                <td>
                  <b>${l.descricao}</b>
                  ${l.cliente_nome?`<div style="font-size:11px;color:var(--muted)">${l.cliente_nome}</div>`:""}
                  ${l.venda_id?`<div style="font-size:11px;color:var(--accent)">vinculado à venda</div>`:""}
                </td>
                <td style="color:var(--muted);font-size:12px">${l.categoria||"—"}</td>
                <td style="font-size:12px${atrasado?";color:#ff6b6b;font-weight:700":""}">${l.data_vencimento?formatData(l.data_vencimento):"—"}</td>
                <td style="font-weight:600;color:${tipo==="receita"?"#69db7c":"#ff6b6b"}">${fmtV(l.valor)}</td>
                <td>${badgeStatus(l.status)}</td>
                <td style="display:flex;gap:4px">
                  ${l.status==="pendente"?`<button class="btn-pagar" data-pagar="${l.id}">✔ Baixar</button>`:""}
                  <button class="btn-edit" data-edit="${l.id}">✏️</button>
                  <button class="btn-del"  data-del="${l.id}">🗑</button>
                </td>
              </tr>`;
          }).join("") || `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Nenhum lançamento.</td></tr>`}
      </tbody>
    </table>
  `;

  body.querySelectorAll("[data-fs]").forEach(b =>
    b.addEventListener("click", () => { state.filtroStatus = b.dataset.fs; render(container); })
  );
  body.querySelectorAll("[data-pagar]").forEach(b =>
    b.addEventListener("click", async () => {
      await supabase.from("lancamentos").update({
        status: "pago", data_pagamento: new Date().toISOString().split("T")[0]
      }).eq("id", b.dataset.pagar);
      await recarregar(container);
    })
  );
  body.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => {
      const l = state.lancamentos.find(x => x.id === b.dataset.edit);
      abrirModal(container, l.tipo, l);
    })
  );
  body.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", async () => {
      if (!confirm("Deletar este lançamento?")) return;
      await supabase.from("lancamentos").delete().eq("id", b.dataset.del);
      await recarregar(container);
    })
  );
}

function renderFluxo(body, container) {
  const fmtV = v => `R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    meses.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }

  const dados = meses.map(mes => {
    const doMes = state.lancamentos.filter(l => {
      const ref = l.data_vencimento || l.created_at?.slice(0,10);
      return ref?.startsWith(mes);
    });
    const rec  = doMes.filter(l=>l.tipo==="receita").reduce((s,l)=>s+Number(l.valor),0);
    const desp = doMes.filter(l=>l.tipo==="despesa").reduce((s,l)=>s+Number(l.valor),0);
    const real_rec  = doMes.filter(l=>l.tipo==="receita"&&l.status==="pago").reduce((s,l)=>s+Number(l.valor),0);
    const real_desp = doMes.filter(l=>l.tipo==="despesa"&&l.status==="pago").reduce((s,l)=>s+Number(l.valor),0);
    return { mes, rec, desp, saldo: rec-desp, real: real_rec-real_desp };
  });

  const maxVal = Math.max(...dados.flatMap(d=>[d.rec, d.desp]), 1);
  const nomeMes = m => {
    const [y,mo] = m.split("-");
    return new Date(y,mo-1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
  };

  body.innerHTML = `
    <div class="res-bloco">
      <h4>💧 Fluxo dos últimos 6 meses</h4>
      <div class="fluxo-chart">
        ${dados.map(d => `
          <div class="fluxo-col">
            <div class="fluxo-barras">
              <div class="fb-rec"  style="height:${(d.rec /maxVal*120).toFixed(0)}px" title="Receita: ${fmtV(d.rec)}"></div>
              <div class="fb-desp" style="height:${(d.desp/maxVal*120).toFixed(0)}px" title="Despesa: ${fmtV(d.desp)}"></div>
            </div>
            <div class="fluxo-mes">${nomeMes(d.mes)}</div>
          </div>`).join("")}
      </div>
      <div class="fluxo-legenda">
        <span><span class="leg-dot" style="background:#69db7c"></span>Receita</span>
        <span><span class="leg-dot" style="background:#ff6b6b"></span>Despesa</span>
      </div>
    </div>

    <div class="res-bloco" style="margin-top:12px">
      <h4>Detalhamento mensal</h4>
      <table class="fin-table">
        <thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo previsto</th><th>Saldo realizado</th></tr></thead>
        <tbody>
          ${dados.map(d => `
            <tr>
              <td>${nomeMes(d.mes)}</td>
              <td style="color:#69db7c">${fmtV(d.rec)}</td>
              <td style="color:#ff6b6b">${fmtV(d.desp)}</td>
              <td style="font-weight:600;color:${d.saldo>=0?"#69db7c":"#ff6b6b"}">${d.saldo>=0?"+":""}${fmtV(d.saldo)}</td>
              <td style="color:var(--muted)">${fmtV(d.real)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function abrirModal(container, tipo, dados = {}) {
  const area = container.querySelector("#modal-area");
  const editando = !!dados.id;
  const cats = tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  const cor  = tipo === "receita" ? "#69db7c" : "#ff6b6b";

  area.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h3 style="color:${cor}">${editando?"Editar":"Novo"} ${tipo === "receita" ? "Receita ▲" : "Despesa ▼"}</h3>
        <label>Descrição *</label>
        <input id="m-desc" value="${dados.descricao||""}" placeholder="Ex: Venda banner, Compra papel..." autofocus />
        <label>Valor (R$) *</label>
        <input id="m-valor" type="number" min="0" step="0.01" value="${dados.valor||""}" />
        <label>Categoria</label>
        <select id="m-cat">
          ${cats.map(c=>`<option value="${c}" ${dados.categoria===c?"selected":""}>${c}</option>`).join("")}
        </select>
        <label>Vencimento</label>
        <input id="m-venc" type="date" value="${dados.data_vencimento||""}" />
        <label>Cliente / Fornecedor</label>
        <input id="m-cli" value="${dados.cliente_nome||""}" placeholder="Nome (opcional)" />
        <label>Status</label>
        <select id="m-status">
          <option value="pendente" ${(!dados.status||dados.status==="pendente")?"selected":""}>🕐 Pendente</option>
          <option value="pago"      ${dados.status==="pago"?"selected":""}>✅ Pago</option>
          <option value="cancelado" ${dados.status==="cancelado"?"selected":""}>❌ Cancelado</option>
        </select>
        <label>Observações</label>
        <textarea id="m-obs" style="height:50px">${dados.observacoes||""}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button class="btn-secondary" id="m-cancel">Cancelar</button>
          <button class="btn-primary" id="m-ok" style="background:${cor}">Salvar</button>
        </div>
      </div>
    </div>`;

  area.querySelector("#m-cancel").addEventListener("click", () => area.innerHTML = "");
  area.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id==="modal-bg") area.innerHTML=""; });
  area.querySelector("#m-ok").addEventListener("click", async () => {
    const desc  = area.querySelector("#m-desc").value.trim();
    const valor = parseFloat(area.querySelector("#m-valor").value);
    if (!desc)   { alert("Informe a descrição."); return; }
    if (!valor)  { alert("Informe o valor."); return; }

    const payload = {
      tipo, descricao: desc, valor,
      categoria:    area.querySelector("#m-cat").value,
      data_vencimento: area.querySelector("#m-venc").value || null,
      cliente_nome: area.querySelector("#m-cli").value.trim() || null,
      status:       area.querySelector("#m-status").value,
      observacoes:  area.querySelector("#m-obs").value.trim() || null,
    };

    if (editando) {
      await supabase.from("lancamentos").update(payload).eq("id", dados.id);
    } else {
      await supabase.from("lancamentos").insert(payload);
    }

    area.innerHTML = "";
    await recarregar(container);
  });
}

function badgeStatus(s) {
  const cfg = { pendente:["#ffa94d","🕐 Pendente"], pago:["#69db7c","✅ Pago"], cancelado:["#9fb0d0","❌ Cancelado"] };
  const [cor, label] = cfg[s] || ["#9fb0d0", s];
  return `<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${cor}22;color:${cor};font-weight:700">${label}</span>`;
}

function formatData(d) {
  if (!d) return "—";
  const [y,m,dia] = d.split("-");
  return `${dia}/${m}/${y}`;
}

function css() { return `
  .fin-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px; }
  .fin-header h2 { margin:0; }
  .alerta-venc { background:rgba(255,107,107,0.1);border:1px solid #ff6b6b44;border-radius:10px;padding:10px 14px;font-size:13px;color:#ff6b6b;margin-bottom:12px; }
  .kpi-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px; }
  @media(max-width:700px){.kpi-grid{grid-template-columns:1fr;}}
  .kpi-card { background:var(--panel2);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px; }
  .kpi-card .k { font-size:12px;color:var(--muted); }
  .kpi-card .v { font-size:24px;font-weight:700;margin:4px 0 2px; }
  .kpi-card .sub { font-size:11px;color:var(--muted); }
  .kpi-card.receita .v { color:#69db7c; }
  .kpi-card.despesa .v { color:#ff6b6b; }
  .kpi-card.saldo-pos .v { color:#69db7c; }
  .kpi-card.saldo-neg .v { color:#ff6b6b; }
  .fin-abas { display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap; }
  .aba-btn { padding:7px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.1);background:var(--panel2);color:var(--muted);cursor:pointer;font-size:13px; }
  .aba-btn.active { border-color:var(--accent);background:rgba(106,166,255,0.12);color:var(--accent); }
  .resumo-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
  @media(max-width:620px){.resumo-grid{grid-template-columns:1fr;}}
  .res-bloco { background:var(--panel2);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px; }
  .res-bloco h4 { margin:0 0 12px;font-size:13px;color:var(--muted); }
  .barra-row { display:flex;align-items:center;gap:8px;margin-bottom:6px; }
  .barra-cat { font-size:12px;width:90px;flex-shrink:0; }
  .barra-wrap { flex:1;background:rgba(255,255,255,0.04);border-radius:4px;height:8px;overflow:hidden; }
  .barra-fill { height:100%;border-radius:4px;transition:width .4s; }
  .barra-val { font-size:12px;color:var(--muted);white-space:nowrap; }
  .venc-row { display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px; }
  .venc-row:last-child{border-bottom:none;}
  .venc-tipo.receita{color:#69db7c;font-weight:700;}
  .venc-tipo.despesa{color:#ff6b6b;font-weight:700;}
  .venc-desc{flex:1;}
  .venc-data{font-size:12px;color:var(--muted);}
  .venc-data.atrasado{color:#ff6b6b;font-weight:700;}
  .venc-val{font-weight:600;}
  .tab-filtros{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;}
  .filtro-btn{padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.1);background:var(--panel2);color:var(--muted);cursor:pointer;font-size:12px;}
  .filtro-btn.active{border-color:var(--accent);color:var(--accent);}
  .fin-table{width:100%;border-collapse:collapse;font-size:13px;}
  .fin-table th{text-align:left;color:var(--muted);font-weight:500;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);}
  .fin-table td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle;}
  .fin-table tr:hover td{background:rgba(255,255,255,0.02);}
  .row-atrasado td{background:rgba(255,107,107,0.04);}
  .btn-pagar{background:rgba(105,219,124,0.15);border:1px solid #69db7c55;color:#69db7c;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;white-space:nowrap;}
  .btn-edit{background:transparent;border:1px solid rgba(255,255,255,0.1);color:var(--muted);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;}
  .btn-del{background:transparent;border:1px solid rgba(255,107,107,0.2);color:#ff6b6b;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;}
  .fluxo-chart{display:flex;gap:8px;align-items:flex-end;padding:10px 0;height:160px;}
  .fluxo-col{display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;}
  .fluxo-barras{display:flex;gap:3px;align-items:flex-end;height:130px;}
  .fb-rec{width:14px;background:#69db7c;border-radius:3px 3px 0 0;min-height:2px;transition:height .4s;}
  .fb-desp{width:14px;background:#ff6b6b;border-radius:3px 3px 0 0;min-height:2px;transition:height .4s;}
  .fluxo-mes{font-size:11px;color:var(--muted);}
  .fluxo-legenda{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-top:8px;}
  .leg-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;}
  .btn-primary{background:var(--accent);color:#000;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600;}
  .btn-desp{background:rgba(255,107,107,0.15);border:1px solid #ff6b6b55;color:#ff6b6b;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600;}
  .btn-secondary{background:transparent;border:1px solid rgba(255,255,255,0.15);color:var(--text);border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100;}
  .modal{background:var(--panel);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;min-width:320px;max-width:420px;width:92%;max-height:90vh;overflow-y:auto;}
  .modal h3{margin:0 0 14px;}
  .modal label{font-size:12px;color:var(--muted);display:block;margin-bottom:4px;}
  .modal input,.modal select,.modal textarea{width:100%;background:var(--panel2);border:1px solid rgba(255,255,255,0.1);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;box-sizing:border-box;margin-bottom:10px;}
`; }

async function recarregar(container) {
  await carregar();
  render(container);
}