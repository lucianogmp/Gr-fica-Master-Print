import { Dashboard } from "./dashboard.js";
import { Financeiro } from "./financeiro.js";
import { Orcamento } from "./orcamento.js";
import { Vendas } from "./vendas.js";
import { Clientes } from "./clientes.js";
import { Produtos } from "./produtos.js";
import { Estoque } from "./estoque.js";
import { Producao } from "./producao.js";
import { Configuracoes } from "./configuracoes.js";

export const pages = {
  dashboard: { label: "📊Dashboard", mount: Dashboard },
  financeiro: { label: "💰Gerente Financeiro", mount: Financeiro },
  orcamento: { label: "📋Orçamento", mount: Orcamento },
  vendas: { label: "🛒Vendas", mount: Vendas },
  clientes: { label: "👥Clientes", mount: Clientes },
  produtos: { label: "📦Produtos", mount: Produtos },
  estoque: { label: "📦Estoque", mount: Estoque },
  producao: { label: "📄Produção", mount: Producao },
  configuracoes: { label: "⚙️Configurações", mount: Configuracoes },
};
