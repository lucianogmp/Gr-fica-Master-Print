import { supabase } from "../supabase/client.js";

// ─── FOLHAS ─────────────────────────────────────────
const FOLHAS = {
  A4:   { w: 21.0,  h: 29.7 },
  A3:   { w: 29.7,  h: 42.0 },
  SRA3: { w: 32.0,  h: 45.0 },
};

// ─── ESTADO ─────────────────────────────────────────
let state = {
  orcamentos: [],
  produtos: [],
  aberto: null,
  itemForm: resetForm()
};

// ─── MOTOR DE CÁLCULO (NOVO) ───────────────────────
function calcItensPorFolha(l, a, tipo) {
  const f = FOLHAS[tipo];
  if (!f || !l || !a) return 0;

  const h = Math.floor(f.w / l) * Math.floor(f.h / a);
  const v = Math.floor(f.h / l) * Math.floor(f.w / a);

  return Math.max(h, v, 1);
}

function calcularPreco(dados) {
  const {
    tipo,
    largura,
    altura,
    precoM2,
    precoFolha,
    folhaTipo,
    custoUnitario,
    precoUnitario
  } = dados;

  if (tipo === "unidade") {
    return Number(precoUnitario) || 0;
  }

  if (tipo === "m2") {
    const m2 = (largura / 100) * (altura / 100);
    let preco = m2 * (precoM2 || 0);

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
    const ipf = calcItensPorFolha(largura, altura, folhaTipo);
    if (!ipf) return 0;
    return (precoFolha || 0) / ipf;
  }

  return 0;
}

// ─── LOAD ───────────────────────────────────────────
export async function Orcamento(container) {
  container.innerHTML = "Carregando...";
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

// ─── RENDER SIMPLES (RESUMIDO PRA FOCO NO CÁLCULO) ──
function render(container) {
  container.innerHTML = `
    <button id="novo">Novo</button>
    <div id="lista"></div>
  `;

  container.querySelector("#novo").onclick = () => {
    abrir(container);
  };
}

// ─── DETALHE ───────────────────────────────────────
function abrir(container) {
  container.innerHTML = `
    <h2>Orçamento</h2>

    <input id="desc" placeholder="Descrição">

    <input id="larg" placeholder="Largura cm">
    <input id="alt" placeholder="Altura cm">

    <input id="qtd" value="1">
    <input id="pm2" placeholder="Preço m²">

    <input id="custo" placeholder="Custo">

    <select id="tipo">
      <option value="m2">m²</option>
      <option value="unidade">Unidade</option>
      <option value="folha">Folha</option>
    </select>

    <button id="add">Adicionar</button>

    <button id="print">Imprimir</button>
    <button id="limpar">Limpar</button>
  `;

  container.querySelector("#print").onclick = () => window.print();

  container.querySelector("#limpar").onclick = async () => {
    if (!confirm("Limpar?")) return;
    await supabase.from("orcamento_itens").delete();
    alert("Limpo");
  };

  container.querySelector("#add").onclick = async () => {
    const tipo = container.querySelector("#tipo").value;

    const largura = parseFloat(container.querySelector("#larg").value) || 0;
    const altura  = parseFloat(container.querySelector("#alt").value) || 0;
    const qtd     = parseFloat(container.querySelector("#qtd").value) || 1;
    const pm2     = parseFloat(container.querySelector("#pm2").value) || 0;
    const custo   = parseFloat(container.querySelector("#custo").value) || 0;

    const preco = calcularPreco({
      tipo,
      largura,
      altura,
      precoM2: pm2,
      custoUnitario: custo
    });

    await supabase.from("orcamento_itens").insert({
      descricao: "Item",
      quantidade: qtd,
      preco_unitario: preco,
      total: preco * qtd
    });

    alert("Adicionado");
  };
}

function resetForm() {
  return {
    tipo: "m2",
    largura: 0,
    altura: 0
  };
}