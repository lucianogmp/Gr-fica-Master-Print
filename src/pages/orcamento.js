import { supabase } from "../supabase/client.js";

// ─── FOLHAS ─────────────────────────────────────────
const FOLHAS = {
  A4:   { w: 21.0,  h: 29.7  },
  A3:   { w: 29.7,  h: 42.0  },
  SRA3: { w: 32.0,  h: 45.0  },
};

// ─── ESTADO ─────────────────────────────────────────
let state = {
  orcamentos: [],
  produtos: [],
  aberto: null,
  itemForm: {
    tipo: "unidade",
    descricao: "",
    largura: "",
    altura: "",
    folhaTipo: "A4",
    quantidade: 1,
    custoUnitario: 0,
    precoUnitario: 0,
  },
};

// ─── CÁLCULOS ───────────────────────────────────────
function calcItensPorFolha(largCm, altCm, folhaTipo) {
  const f = FOLHAS[folhaTipo];
  if (!f || !largCm || !altCm) return 0;

  const h = Math.floor(f.w / largCm) * Math.floor(f.h / altCm);
  const v = Math.floor(f.h / largCm) * Math.floor(f.w / altCm);

  return Math.max(h, v, 1);
}

// 🔥 CORRIGIDO
function calcPrecoUnitario(form) {
  const {
    tipo,
    largura,
    altura,
    precoUnitario,
    precoFolha,
    folhaTipo,
    custoUnitario
  } = form;

  if (tipo === "unidade") {
    return Number(precoUnitario) || 0;
  }

  if (tipo === "m2") {
    const m2 = (Number(largura) / 100) * (Number(altura) / 100);

    let preco = m2 * (Number(precoUnitario) || 0);

    const PRECO_MINIMO = 10;
    if (preco < PRECO_MINIMO) preco = PRECO_MINIMO;

    const MARGEM_MIN = 0.3;
    if (custoUnitario > 0) {
      const minimo = custoUnitario / (1 - MARGEM_MIN);
      if (preco < minimo) preco = minimo;
    }

    return preco;
  }

  if (tipo === "folha") {
    const ipf = calcItensPorFolha(Number(largura), Number(altura), folhaTipo);
    if (!ipf) return 0;
    return (Number(precoFolha) || 0) / ipf;
  }

  return 0;
}

// ─── ENTRY ──────────────────────────────────────────
export async function Orcamento(container) {
  container.innerHTML = `<div>Carregando...</div>`;
  await carregar();
  render(container);
}

async function carregar() {
  const { data: orcs } = await supabase
    .from("orcamentos")
    .select("*, orcamento_itens(*)");

  const { data: prods } = await supabase
    .from("produtos")
    .select("*");

  state.orcamentos = orcs || [];
  state.produtos = prods || [];
}

// ─── RENDER LISTA ───────────────────────────────────
function render(container) {
  if (state.aberto) return renderDetalhe(container);

  container.innerHTML = `
    <div class="vnd-header">
      <h2>Orçamentos</h2>
      <button class="btn-primary" id="novo">+ Novo</button>
    </div>
    <div id="lista"></div>
  `;

  container.querySelector("#novo").onclick = async () => {
    const { data } = await supabase.from("orcamentos")
      .insert({ status: "rascunho", total: 0 })
      .select().single();

    state.aberto = data;
    renderDetalhe(container);
  };

  const lista = container.querySelector("#lista");

  lista.innerHTML = state.orcamentos.map(o => `
    <div class="orc-card" data-id="${o.id}">
      <b>#${o.numero || "-"}</b>
      <div>R$ ${Number(o.total||0).toFixed(2)}</div>
    </div>
  `).join("");

  lista.querySelectorAll("[data-id]").forEach(el => {
    el.onclick = () => {
      state.aberto = state.orcamentos.find(o => o.id === el.dataset.id);
      renderDetalhe(container);
    };
  });
}

// ─── DETALHE ───────────────────────────────────────
async function renderDetalhe(container) {
  const o = state.aberto;

  const { data: itens } = await supabase
    .from("orcamento_itens")
    .select("*")
    .eq("orcamento_id", o.id);

  container.innerHTML = `
    <button id="voltar">← Voltar</button>

    <h2>Orçamento</h2>

    <div>
      <input id="desc" placeholder="Descrição">
      <input id="larg" placeholder="Largura">
      <input id="alt" placeholder="Altura">
      <input id="qtd" value="1">
      <input id="preco" placeholder="Preço/m²">
      <input id="custo" placeholder="Custo">

      <select id="tipo">
        <option value="m2">m²</option>
        <option value="unidade">Unidade</option>
        <option value="folha">Folha</option>
      </select>

      <button id="add">Adicionar</button>
    </div>

    <hr>

    <div>
      ${itens.map(i => `
        <div>
          ${i.descricao} - R$ ${i.total}
        </div>
      `).join("")}
    </div>

    <hr>

    <button id="print">🖨 Imprimir</button>
    <button id="limpar">🧹 Limpar</button>
  `;

  container.querySelector("#voltar").onclick = () => {
    state.aberto = null;
    render(container);
  };

  // PRINT
  container.querySelector("#print").onclick = () => window.print();

  // LIMPAR
  container.querySelector("#limpar").onclick = async () => {
    if (!confirm("Limpar orçamento?")) return;

    await supabase
      .from("orcamento_itens")
      .delete()
      .eq("orcamento_id", o.id);

    renderDetalhe(container);
  };

  // ADD ITEM
  container.querySelector("#add").onclick = async () => {
    const tipo = container.querySelector("#tipo").value;

    const largura = parseFloat(container.querySelector("#larg").value) || 0;
    const altura  = parseFloat(container.querySelector("#alt").value) || 0;
    const qtd     = parseFloat(container.querySelector("#qtd").value) || 1;
    const preco   = parseFloat(container.querySelector("#preco").value) || 0;
    const custo   = parseFloat(container.querySelector("#custo").value) || 0;

    const precoFinal = calcPrecoUnitario({
      tipo,
      largura,
      altura,
      precoUnitario: preco,
      custoUnitario: custo
    });

    await supabase.from("orcamento_itens").insert({
      orcamento_id: o.id,
      descricao: "Item",
      quantidade: qtd,
      preco_unitario: precoFinal,
      total: precoFinal * qtd
    });

    renderDetalhe(container);
  };
}