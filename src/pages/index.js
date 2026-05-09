import { Dashboard } from "./dashboard.js";
import { Financeiro } from "./financeiro.js";
import { FluxoCaixa } from "./fluxo_caixa.js";
import { Orcamento } from "./orcamento.js";
import { Vendas } from "./vendas.js";
import { Clientes } from "./clientes.js";
import { Produtos } from "./produtos.js";
import { Estoque } from "./estoque.js";
import { Producao } from "./producao.js";
import { GestaoCustos } from "./gestao_custos.js";
import { Configuracoes } from "./configuracoes.js";

export const pages = {
  dashboard:     { label: "📊 Dashboard",         mount: Dashboard      },
  financeiro:    { label: "💸 Financeiro",         mount: Financeiro     },
  fluxo_caixa:   { label: "🏧 Caixa Físico",       mount: FluxoCaixa     },
  orcamento:     { label: "📋 Orçamento",          mount: Orcamento      },
  vendas:        { label: "🛒 Vendas",             mount: Vendas         },
  clientes:      { label: "👥 Clientes",           mount: Clientes       },
  produtos:      { label: "📦 Produtos",           mount: Produtos       },
  estoque:       { label: "📦 Estoque",            mount: Estoque        },
  producao:      { label: "📄 Produção",           mount: Producao       },
  gestao_custos: { label: "📉 Gestão de Custos",   mount: GestaoCustos   },
  configuracoes: { label: "⚙️ Configurações",      mount: Configuracoes  },
};