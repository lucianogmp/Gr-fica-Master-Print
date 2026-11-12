// src/lib/exportarPlanilhas.ts
//
// Exporta os dados do sistema em planilhas Excel (.xlsx) legíveis: cabeçalhos em português,
// datas dd/mm/aaaa, valores como números formatados em R$, colunas largas, filtro e cabeçalho
// destacado. As abas de cadastros (Clientes, Fornecedores, Estoque, Contas) usam os MESMOS nomes
// de coluna da importação, então a planilha exportada pode ser importada de volta.

import * as XLSX from 'xlsx';
import { supabase } from './supabase';

type Tipo = 'txt' | 'num' | 'moeda' | 'int' | 'data' | 'dh' | 'sn';
interface Col { h: string; v: (r: any, c: Ctx) => any; t?: Tipo; w?: number }

export interface Periodo { de: string | null; ate: string | null } // yyyy-mm-dd

interface Ctx {
  contas: Map<string, string>;
  clientes: Map<string, string>;
  fornecedores: Map<string, string>;
  materias: Map<string, string>;
  categorias: Map<string, string>;
  vendaNum: Map<string, any>;      // id -> { numero, cliente_nome, data_venda }
  orcNum: Map<string, any>;        // id -> { numero, cliente_nome }
  hoje: string;
}

export interface Conjunto {
  id: string;
  grupo: 'Financeiro' | 'Vendas' | 'Orçamentos' | 'Cadastros' | 'Produtos e Estoque' | 'Produção' | 'Custos';
  aba: string;               // nome da aba no Excel (máx. 31 caracteres)
  descricao: string;
  tabela: string;
  filtro?: { campo: string; tipo: 'data' | 'dh' } | { pai: 'vendas' | 'orcamentos'; fk: string };
  onde?: (q: any) => any;    // filtros fixos (ex.: só despesas pendentes)
  ordem?: { campo: string; asc: boolean };
  cols: Col[];
}

// ───────────────────────── helpers de formatação ─────────────────────────

const cap = (s: any) => { const t = String(s ?? '').replace(/_/g, ' ').trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
const num = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));
const taxaRS = (p: any) => Math.round(Number(p.valor || 0) * Number(p.juros_pct || 0)) / 100;

function diasAtraso(venc: string | null, hoje: string): number {
  if (!venc || venc >= hoje) return 0;
  return Math.round((Date.parse(hoje) - Date.parse(venc)) / 86400000);
}

// ───────────────────────── definição das abas ─────────────────────────

export const CONJUNTOS: Conjunto[] = [
  // ── Financeiro ──
  {
    id: 'lancamentos', grupo: 'Financeiro', aba: 'Lançamentos', tabela: 'lancamentos',
    descricao: 'Todas as receitas e despesas (pagas e pendentes)',
    filtro: { campo: 'data_vencimento', tipo: 'data' }, ordem: { campo: 'data_vencimento', asc: false },
    cols: [
      { h: 'Vencimento', v: r => r.data_vencimento, t: 'data' },
      { h: 'Data do pagamento', v: r => r.data_pagamento, t: 'data' },
      { h: 'Tipo', v: r => cap(r.tipo) },
      { h: 'Descrição', v: r => r.descricao, w: 42 },
      { h: 'Categoria', v: r => r.categoria },
      { h: 'Cliente / Fornecedor', v: r => r.cliente_nome, w: 28 },
      { h: 'Valor', v: r => num(r.valor), t: 'moeda' },
      { h: 'Situação', v: r => cap(r.status) },
      { h: 'Forma de pagamento', v: r => r.forma_pagamento },
      { h: 'Conta', v: (r, c) => c.contas.get(r.conta_id) ?? '' },
      { h: 'Parcela', v: r => (r.parcela_num && r.total_parcelas ? `${r.parcela_num}/${r.total_parcelas}` : '') },
      { h: 'Venda nº', v: (r, c) => c.vendaNum.get(r.venda_id)?.numero ?? '' },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  },
  ...(['despesa', 'receita'] as const).map((tipo): Conjunto => ({
    id: tipo === 'despesa' ? 'contas_pagar' : 'contas_receber', grupo: 'Financeiro',
    aba: tipo === 'despesa' ? 'Contas a Pagar' : 'Contas a Receber', tabela: 'lancamentos',
    descricao: tipo === 'despesa' ? 'Despesas ainda não pagas (com dias de atraso)' : 'Receitas ainda não recebidas (com dias de atraso)',
    onde: q => q.eq('tipo', tipo).eq('status', 'pendente'),
    ordem: { campo: 'data_vencimento', asc: true },
    cols: [
      { h: 'Vencimento', v: r => r.data_vencimento, t: 'data' },
      { h: 'Descrição', v: r => r.descricao, w: 42 },
      { h: tipo === 'despesa' ? 'Fornecedor / Favorecido' : 'Cliente', v: r => r.cliente_nome, w: 28 },
      { h: 'Categoria', v: r => r.categoria },
      { h: 'Valor', v: r => num(r.valor), t: 'moeda' },
      { h: 'Situação', v: (r, c) => (diasAtraso(r.data_vencimento, c.hoje) > 0 ? 'Vencida' : 'Em dia') },
      { h: 'Dias de atraso', v: (r, c) => diasAtraso(r.data_vencimento, c.hoje), t: 'int' },
      { h: 'Parcela', v: r => (r.parcela_num && r.total_parcelas ? `${r.parcela_num}/${r.total_parcelas}` : '') },
      { h: 'Venda nº', v: (r, c) => c.vendaNum.get(r.venda_id)?.numero ?? '' },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  })),
  {
    id: 'fluxo_caixa', grupo: 'Financeiro', aba: 'Fluxo de Caixa', tabela: 'caixa_movimentos',
    descricao: 'Entradas e saídas de todas as contas (caixa, bancos, Pix...)',
    filtro: { campo: 'data', tipo: 'data' }, ordem: { campo: 'data', asc: false },
    cols: [
      { h: 'Data', v: r => r.data, t: 'data' },
      { h: 'Tipo', v: r => (r.tipo === 'entrada' ? 'Entrada' : r.tipo === 'saida' ? 'Saída' : cap(r.tipo)) },
      { h: 'Descrição', v: r => r.descricao, w: 42 },
      { h: 'Cliente', v: r => r.cliente_nome, w: 26 },
      { h: 'Valor', v: r => num(r.valor), t: 'moeda' },
      { h: 'Conta', v: (r, c) => c.contas.get(r.conta_id) ?? '' },
      { h: 'Venda nº', v: (r, c) => c.vendaNum.get(r.venda_id)?.numero ?? '' },
      { h: 'Lançado por', v: r => r.criado_por_email },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  },
  {
    id: 'contas_bancarias', grupo: 'Financeiro', aba: 'Contas Bancárias', tabela: 'contas_bancarias',
    descricao: 'Caixa, bancos e carteiras cadastrados', ordem: { campo: 'ordem', asc: true },
    cols: [
      { h: 'Nome', v: r => r.nome, w: 28 },
      { h: 'Tipo (caixa/corrente/poupanca/cartao/pix/outro)', v: r => r.tipo, w: 22 },
      { h: 'Banco', v: r => r.banco },
      { h: 'Agência', v: r => r.agencia },
      { h: 'Conta', v: r => r.conta },
      { h: 'Saldo inicial', v: r => num(r.saldo_inicial), t: 'moeda' },
      { h: 'Ativa', v: r => r.ativo, t: 'sn' },
      { h: 'Formas aceitas', v: r => (Array.isArray(r.formas_aceitas) ? r.formas_aceitas.join(', ') : ''), w: 30 },
    ],
  },

  // ── Vendas ──
  {
    id: 'vendas', grupo: 'Vendas', aba: 'Vendas', tabela: 'vendas',
    descricao: 'Pedidos de venda com valores, pagamentos e situação',
    filtro: { campo: 'data_venda', tipo: 'data' }, ordem: { campo: 'numero', asc: false },
    cols: [
      { h: 'Nº', v: r => r.numero, t: 'int' },
      { h: 'Data da venda', v: r => r.data_venda, t: 'data' },
      { h: 'Cliente', v: r => r.cliente_nome, w: 30 },
      { h: 'Solicitante', v: r => r.solicitante, w: 22 },
      { h: 'Vendedor', v: r => r.vendedor },
      { h: 'Situação', v: r => cap(r.status) },
      { h: 'Tipo', v: r => cap(r.tipo) },
      { h: 'Valor da venda (bruto)', v: r => num(r.valor_original ?? r.valor_total), t: 'moeda' },
      { h: 'Desconto (%)', v: r => num(r.desconto), t: 'num' },
      { h: 'Frete', v: r => num(r.frete), t: 'moeda' },
      { h: 'Taxa adicional', v: r => num(r.taxa_adicional), t: 'moeda' },
      { h: 'Valor líquido (após taxa da maquininha)', v: r => num(r.valor_total), t: 'moeda', w: 22 },
      { h: 'Valor recebido', v: r => num(r.valor_pago), t: 'moeda' },
      { h: 'Falta receber', v: r => Math.max(0, Number(r.valor_total || 0) - Number(r.valor_pago || 0)), t: 'moeda' },
      { h: 'Forma de pagamento', v: r => r.forma_pagamento },
      { h: 'Data de entrega', v: r => r.data_entrega, t: 'data' },
      { h: 'Orçamento de origem nº', v: r => r.orcamento_origem_numero, t: 'int' },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
      { h: 'Criada em', v: r => r.created_at, t: 'dh' },
    ],
  },
  {
    id: 'venda_itens', grupo: 'Vendas', aba: 'Itens das Vendas', tabela: 'venda_itens',
    descricao: 'Cada item vendido, com a data em que foi adicionado',
    filtro: { pai: 'vendas', fk: 'venda_id' },
    cols: [
      { h: 'Venda nº', v: (r, c) => c.vendaNum.get(r.venda_id)?.numero, t: 'int' },
      { h: 'Data da venda', v: (r, c) => c.vendaNum.get(r.venda_id)?.data_venda, t: 'data' },
      { h: 'Cliente', v: (r, c) => c.vendaNum.get(r.venda_id)?.cliente_nome, w: 28 },
      { h: 'Item', v: r => r.descricao, w: 48 },
      { h: 'Unidade', v: r => r.unidade },
      { h: 'Quantidade', v: r => num(r.quantidade), t: 'num' },
      { h: 'Preço unitário', v: r => num(r.preco_unitario), t: 'moeda' },
      { h: 'Desconto (%)', v: r => num(r.desconto), t: 'num' },
      { h: 'Desconto (R$)', v: r => num(r.desconto_valor), t: 'moeda' },
      { h: 'Total do item', v: r => num(r.total), t: 'moeda' },
      { h: 'Área (m²)', v: r => num(r.area_m2), t: 'num' },
      { h: 'Item adicionado em', v: r => r.created_at, t: 'dh' },
      { h: 'Observações', v: r => r.obs, w: 30 },
    ],
  },
  {
    id: 'pagamentos_venda', grupo: 'Vendas', aba: 'Pagamentos das Vendas', tabela: 'pagamentos_venda',
    descricao: 'Pagamentos recebidos, com taxa da maquininha e valor líquido',
    filtro: { campo: 'data_pagamento', tipo: 'data' }, ordem: { campo: 'data_pagamento', asc: false },
    cols: [
      { h: 'Venda nº', v: (r, c) => c.vendaNum.get(r.venda_id)?.numero, t: 'int' },
      { h: 'Cliente', v: (r, c) => c.vendaNum.get(r.venda_id)?.cliente_nome, w: 28 },
      { h: 'Data do pagamento', v: r => r.data_pagamento, t: 'data' },
      { h: 'Forma de pagamento', v: r => r.forma_pagamento },
      { h: 'Parcelas', v: r => r.parcelas, t: 'int' },
      { h: 'Valor pago pelo cliente', v: r => num(r.valor), t: 'moeda' },
      { h: 'Taxa da maquininha (%)', v: r => num(r.juros_pct), t: 'num' },
      { h: 'Taxa da maquininha (R$)', v: r => taxaRS(r), t: 'moeda' },
      { h: 'Valor líquido recebido', v: r => Number(r.valor || 0) - taxaRS(r), t: 'moeda' },
      { h: 'Conta', v: (r, c) => c.contas.get(r.conta_id) ?? '' },
      { h: 'Registrado por', v: r => r.usuario_nome },
      { h: 'Observações', v: r => r.observacoes, w: 30 },
    ],
  },

  // ── Orçamentos ──
  {
    id: 'orcamentos', grupo: 'Orçamentos', aba: 'Orçamentos', tabela: 'orcamentos',
    descricao: 'Orçamentos e situação (aprovado, convertido...)',
    filtro: { campo: 'created_at', tipo: 'dh' }, ordem: { campo: 'numero', asc: false },
    cols: [
      { h: 'Nº', v: r => r.numero, t: 'int' },
      { h: 'Criado em', v: r => r.created_at, t: 'dh' },
      { h: 'Cliente', v: r => r.cliente_nome, w: 30 },
      { h: 'Solicitante', v: r => r.solicitante, w: 22 },
      { h: 'Vendedor', v: r => r.vendedor },
      { h: 'Situação', v: r => cap(r.status) },
      { h: 'Tipo', v: r => cap(r.tipo) },
      { h: 'Desconto (%)', v: r => num(r.desconto), t: 'num' },
      { h: 'Total', v: r => num(r.total), t: 'moeda' },
      { h: 'Venda gerada nº', v: (r, c) => c.vendaNum.get(r.venda_id)?.numero ?? '' },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  },
  {
    id: 'orcamento_itens', grupo: 'Orçamentos', aba: 'Itens dos Orçamentos', tabela: 'orcamento_itens',
    descricao: 'Itens de cada orçamento (medidas, material, acabamento)',
    filtro: { pai: 'orcamentos', fk: 'orcamento_id' },
    cols: [
      { h: 'Orçamento nº', v: (r, c) => c.orcNum.get(r.orcamento_id)?.numero, t: 'int' },
      { h: 'Cliente', v: (r, c) => c.orcNum.get(r.orcamento_id)?.cliente_nome, w: 28 },
      { h: 'Item', v: r => r.descricao, w: 48 },
      { h: 'Cálculo', v: r => cap(r.tipo_calculo) },
      { h: 'Largura (cm)', v: r => num(r.largura_cm), t: 'num' },
      { h: 'Altura (cm)', v: r => num(r.altura_cm), t: 'num' },
      { h: 'Quantidade', v: r => num(r.quantidade), t: 'num' },
      { h: 'Preço unitário', v: r => num(r.preco_unitario), t: 'moeda' },
      { h: 'Desconto (%)', v: r => num(r.desconto), t: 'num' },
      { h: 'Total do item', v: r => num(r.total), t: 'moeda' },
      { h: 'Material', v: r => r.material_nome },
      { h: 'Acabamento', v: r => r.acabamento_nome },
      { h: 'Arte inclusa', v: r => r.arte_inclusa, t: 'sn' },
      { h: 'Observações', v: r => r.observacao_item ?? r.observacoes, w: 30 },
    ],
  },

  // ── Cadastros (mesmas colunas da importação) ──
  {
    id: 'clientes', grupo: 'Cadastros', aba: 'Clientes', tabela: 'clientes',
    descricao: 'Clientes e empresas (pode ser importada de volta)', ordem: { campo: 'nome', asc: true },
    cols: [
      { h: 'Nome', v: r => r.nome, w: 32 },
      { h: 'CPF / CNPJ', v: r => r.cpf_cnpj, w: 20 },
      { h: 'E-mail', v: r => r.email, w: 28 },
      { h: 'Telefone', v: r => r.telefone, w: 16 },
      { h: 'Endereço', v: r => r.endereco, w: 30 },
      { h: 'Número', v: r => r.numero },
      { h: 'Bairro', v: r => r.bairro },
      { h: 'Cidade', v: r => r.cidade },
      { h: 'Estado (UF)', v: r => r.estado },
      { h: 'CEP', v: r => r.cep },
      { h: 'Data de nascimento', v: r => r.data_nascimento, t: 'data' },
      { h: 'Razão social', v: r => r.razao_social, w: 28 },
      { h: 'Nome fantasia', v: r => r.nome_fantasia, w: 26 },
      { h: 'Inscrição estadual', v: r => r.inscricao_estadual },
      { h: 'Situação cadastral', v: r => r.situacao_cadastral },
      { h: 'CNAE principal', v: r => r.cnae_principal },
      { h: 'Como conheceu', v: r => r.como_conheceu },
      { h: 'Produto de interesse', v: r => r.produto_interesse },
      { h: 'Vinculado à empresa', v: (r, c) => c.clientes.get(r.empresa_id) ?? '', w: 28 },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  },
  {
    id: 'contatos', grupo: 'Cadastros', aba: 'Contatos', tabela: 'contatos',
    descricao: 'Pessoas de contato de cada empresa', ordem: { campo: 'nome', asc: true },
    cols: [
      { h: 'Empresa / Cliente', v: (r, c) => c.clientes.get(r.cliente_id) ?? '', w: 30 },
      { h: 'Nome', v: r => r.nome, w: 28 },
      { h: 'Cargo', v: r => r.cargo },
      { h: 'Telefone', v: r => r.telefone },
      { h: 'WhatsApp', v: r => r.whatsapp },
      { h: 'E-mail', v: r => r.email, w: 28 },
      { h: 'Data de nascimento', v: r => r.data_nascimento, t: 'data' },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  },
  {
    id: 'fornecedores', grupo: 'Cadastros', aba: 'Fornecedores', tabela: 'fornecedores',
    descricao: 'Fornecedores (pode ser importada de volta)', ordem: { campo: 'nome', asc: true },
    cols: [
      { h: 'Nome', v: r => r.nome, w: 32 },
      { h: 'CPF / CNPJ', v: r => r.cpf_cnpj, w: 20 },
      { h: 'E-mail', v: r => r.email, w: 28 },
      { h: 'Telefone', v: r => r.telefone },
      { h: 'Endereço', v: r => r.endereco, w: 30 },
      { h: 'Número', v: r => r.numero },
      { h: 'Bairro', v: r => r.bairro },
      { h: 'Cidade', v: r => r.cidade },
      { h: 'Estado (UF)', v: r => r.estado },
      { h: 'CEP', v: r => r.cep },
      { h: 'Razão social', v: r => r.razao_social, w: 28 },
      { h: 'Nome fantasia', v: r => r.nome_fantasia, w: 26 },
      { h: 'Inscrição estadual', v: r => r.inscricao_estadual },
      { h: 'Categoria', v: r => (Array.isArray(r.categorias) && r.categorias.length ? r.categorias.join(', ') : r.categoria) },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  },
  {
    id: 'leads', grupo: 'Cadastros', aba: 'Leads', tabela: 'leads',
    descricao: 'Potenciais clientes e andamento', ordem: { campo: 'created_at', asc: false },
    cols: [
      { h: 'Nome', v: r => r.nome, w: 28 },
      { h: 'Telefone', v: r => r.telefone },
      { h: 'Empresa', v: r => r.empresa, w: 26 },
      { h: 'Como conheceu', v: r => r.como_conheceu },
      { h: 'Produto de interesse', v: r => r.produto_interesse },
      { h: 'Situação', v: r => cap(r.status) },
      { h: 'Convertido em', v: r => r.convertido_em, t: 'dh' },
      { h: 'Criado em', v: r => r.created_at, t: 'dh' },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  },

  // ── Produtos e estoque ──
  {
    id: 'produtos', grupo: 'Produtos e Estoque', aba: 'Produtos', tabela: 'produtos',
    descricao: 'Catálogo de produtos com preços e custos', ordem: { campo: 'nome', asc: true },
    cols: [
      { h: 'Nome', v: r => r.nome, w: 38 },
      { h: 'SKU', v: r => r.sku },
      { h: 'Categoria', v: (r, c) => c.categorias.get(r.categoria_id) ?? '' },
      { h: 'Preço de venda', v: r => num(r.preco_venda), t: 'moeda' },
      { h: 'Custo mão de obra', v: r => num(r.custo_mao_obra), t: 'moeda' },
      { h: 'Custo acabamento', v: r => num(r.custo_acabamento), t: 'moeda' },
      { h: 'Custo operacional', v: r => num(r.custo_operacional), t: 'moeda' },
      { h: 'Unidade', v: r => r.unidade_medida },
      { h: 'Por m²', v: r => r.por_metro_quadrado, t: 'sn' },
      { h: 'Terceirizado', v: r => r.terceirizado, t: 'sn' },
      { h: 'Prazo de entrega (dias)', v: r => r.prazo_entrega_dias, t: 'int' },
      { h: 'Setor', v: r => r.setor },
      { h: 'Máquina', v: r => r.maquina },
      { h: 'Situação', v: r => cap(r.status) },
      { h: 'Descrição', v: r => r.descricao, w: 40 },
    ],
  },
  {
    id: 'estoque_atual', grupo: 'Produtos e Estoque', aba: 'Estoque Atual', tabela: 'materias_primas',
    descricao: 'Matérias-primas com saldo atual e valor em estoque (pode ser importada de volta)',
    ordem: { campo: 'nome', asc: true },
    cols: [
      { h: 'Nome', v: r => r.nome, w: 36 },
      { h: 'Categoria', v: r => r.categoria },
      { h: 'Unidade', v: r => r.unidade },
      { h: 'Custo unitário', v: r => num(r.custo_unitario), t: 'moeda' },
      { h: 'Preço de venda', v: r => num(r.preco_venda), t: 'moeda' },
      { h: 'Estoque mínimo', v: r => num(r.estoque_minimo), t: 'num' },
      { h: 'Saldo atual', v: r => num(r.saldo ?? r.saldo_inicial), t: 'num' },
      { h: 'Valor em estoque', v: r => Number(r.saldo ?? r.saldo_inicial ?? 0) * Number(r.custo_unitario || 0), t: 'moeda' },
      { h: 'Situação', v: r => (r.controla_estoque === false ? 'Sem controle' : Number(r.saldo ?? 0) <= Number(r.estoque_minimo ?? 0) && Number(r.estoque_minimo ?? 0) > 0 ? 'Abaixo do mínimo' : 'OK') },
      { h: 'Fornecedor', v: (r, c) => c.fornecedores.get(r.fornecedor_id) ?? '', w: 24 },
    ],
  },
  {
    id: 'estoque_mov', grupo: 'Produtos e Estoque', aba: 'Movimentações de Estoque', tabela: 'estoque_movimentos',
    descricao: 'Entradas, saídas e ajustes de estoque',
    filtro: { campo: 'created_at', tipo: 'dh' }, ordem: { campo: 'created_at', asc: false },
    cols: [
      { h: 'Data', v: r => r.created_at, t: 'dh' },
      { h: 'Matéria-prima', v: (r, c) => c.materias.get(r.materia_prima_id) ?? '', w: 34 },
      { h: 'Tipo', v: r => cap(r.tipo) },
      { h: 'Quantidade', v: r => num(r.quantidade), t: 'num' },
      { h: 'Motivo', v: r => r.motivo, w: 34 },
      { h: 'Origem', v: r => r.origem },
    ],
  },

  // ── Produção ──
  {
    id: 'producao', grupo: 'Produção', aba: 'Produção', tabela: 'producao',
    descricao: 'Ordens de produção e etapa atual', ordem: { campo: 'created_at', asc: false },
    cols: [
      { h: 'Venda nº', v: (r, c) => c.vendaNum.get(r.venda_id)?.numero, t: 'int' },
      { h: 'Título', v: r => r.titulo, w: 36 },
      { h: 'Etapa', v: r => cap(r.etapa) },
      { h: 'Prioridade', v: r => cap(r.prioridade) },
      { h: 'Responsável', v: r => r.responsavel },
      { h: 'Data de entrega', v: r => r.data_entrega, t: 'data' },
      { h: 'Entregue em', v: r => r.entregue_em, t: 'dh' },
      { h: 'Descrição', v: r => r.descricao, w: 44 },
    ],
  },

  // ── Custos ──
  {
    id: 'custos_fixos', grupo: 'Custos', aba: 'Custos Fixos', tabela: 'custos_fixos',
    descricao: 'Custos fixos mensais', ordem: { campo: 'nome', asc: true },
    cols: [
      { h: 'Nome', v: r => r.nome, w: 32 }, { h: 'Categoria', v: r => r.categoria },
      { h: 'Valor mensal', v: r => num(r.valor_mensal), t: 'moeda' }, { h: 'Ativo', v: r => r.ativo, t: 'sn' },
      { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  },
  {
    id: 'custos_variaveis', grupo: 'Custos', aba: 'Custos Variáveis', tabela: 'custos_variaveis',
    descricao: 'Custos variáveis por mês', ordem: { campo: 'mes_referencia', asc: false },
    cols: [
      { h: 'Mês', v: r => r.mes_referencia }, { h: 'Nome', v: r => r.nome, w: 32 }, { h: 'Categoria', v: r => r.categoria },
      { h: 'Valor', v: r => num(r.valor), t: 'moeda' }, { h: 'Observações', v: r => r.observacoes, w: 34 },
    ],
  },
];

export const GRUPOS = ['Financeiro', 'Vendas', 'Orçamentos', 'Cadastros', 'Produtos e Estoque', 'Produção', 'Custos'] as const;

// ───────────────────────── busca de dados ─────────────────────────

const PAGINA = 1000;

async function buscarTudo(tabela: string, c: Conjunto | null, periodo: Periodo, selecao = '*'): Promise<any[]> {
  const out: any[] = [];
  for (let ini = 0; ; ini += PAGINA) {
    let q: any = supabase.from(tabela).select(selecao);
    if (c?.onde) q = c.onde(q);
    const f = c?.filtro;
    if (f && 'campo' in f) {
      if (periodo.de) q = q.gte(f.campo, f.tipo === 'dh' ? `${periodo.de}T00:00:00` : periodo.de);
      if (periodo.ate) q = q.lte(f.campo, f.tipo === 'dh' ? `${periodo.ate}T23:59:59` : periodo.ate);
    }
    if (c?.ordem) q = q.order(c.ordem.campo, { ascending: c.ordem.asc });
    else q = q.order('id');
    const { data, error } = await q.range(ini, ini + PAGINA - 1);
    if (error) throw new Error(`${c?.aba ?? tabela}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return out;
}

async function montarContexto(): Promise<{ ctx: Ctx; vendas: any[]; orcs: any[] }> {
  const [contas, clientes, forn, mats, cats, vendas, orcs] = await Promise.all([
    buscarTudo('contas_bancarias', null, { de: null, ate: null }, 'id,nome'),
    buscarTudo('clientes', null, { de: null, ate: null }, 'id,nome'),
    buscarTudo('fornecedores', null, { de: null, ate: null }, 'id,nome'),
    buscarTudo('materias_primas', null, { de: null, ate: null }, 'id,nome'),
    buscarTudo('categorias', null, { de: null, ate: null }, 'id,nome').catch(() => []),
    buscarTudo('vendas', null, { de: null, ate: null }, 'id,numero,cliente_nome,data_venda'),
    buscarTudo('orcamentos', null, { de: null, ate: null }, 'id,numero,cliente_nome,created_at'),
  ]);
  const m = (l: any[]) => new Map<string, string>(l.map(x => [x.id, x.nome]));
  const d = new Date();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    vendas, orcs,
    ctx: {
      contas: m(contas), clientes: m(clientes), fornecedores: m(forn), materias: m(mats), categorias: m(cats),
      vendaNum: new Map(vendas.map(v => [v.id, v])), orcNum: new Map(orcs.map(o => [o.id, o])), hoje,
    },
  };
}

// ───────────────────────── geração do Excel ─────────────────────────

function dataISOparaDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0) : null;
}

function montarAba(c: Conjunto, linhas: any[], ctx: Ctx): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const nCols = c.cols.length;
  const larguras = c.cols.map(col => Math.max(col.w ?? 0, Math.min(40, col.h.length + 3), col.t === 'moeda' ? 15 : col.t === 'data' ? 13 : col.t === 'dh' ? 17 : 11));

  c.cols.forEach((col, ci) => {
    ws[XLSX.utils.encode_cell({ r: 0, c: ci })] = { t: 's', v: col.h };
  });

  linhas.forEach((r, ri) => {
    c.cols.forEach((col, ci) => {
      let v = col.v(r, ctx);
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (v === null || v === undefined || v === '') return;
      switch (col.t) {
        case 'moeda': ws[ref] = { t: 'n', v: Number(v), z: '"R$" #,##0.00;[Red]-"R$" #,##0.00' }; break;
        case 'num':   ws[ref] = { t: 'n', v: Number(v), z: '#,##0.00##' }; break;
        case 'int':   ws[ref] = { t: 'n', v: Number(v), z: '0' }; break;
        case 'data': { const d = dataISOparaDate(String(v)); if (d) ws[ref] = { t: 'd', v: d, z: 'dd/mm/yyyy' }; break; }
        case 'dh': {
          const d = new Date(String(v));
          if (!isNaN(d.getTime())) ws[ref] = { t: 'd', v: d, z: 'dd/mm/yyyy hh:mm' };
          break;
        }
        case 'sn': ws[ref] = { t: 's', v: v ? 'Sim' : 'Não' }; break;
        default:
          if (typeof v === 'number') ws[ref] = { t: 'n', v };
          else ws[ref] = { t: 's', v: String(v) };
      }
    });
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(linhas.length, 1), c: nCols - 1 } });
  ws['!cols'] = larguras.map(wch => ({ wch }));
  ws['!autofilter'] = { ref: ws['!ref'] };
  return ws;
}

export interface ResultadoExportacao { arquivo: string; abas: { aba: string; linhas: number }[] }

/** Gera e baixa uma planilha com as abas escolhidas. */
export async function exportarPlanilha(
  ids: string[],
  periodo: Periodo,
  nomeArquivo: string,
  aoProgredir?: (msg: string) => void,
): Promise<ResultadoExportacao> {
  const escolhidos = CONJUNTOS.filter(c => ids.includes(c.id));
  if (!escolhidos.length) throw new Error('Escolha pelo menos uma aba para exportar.');

  aoProgredir?.('Carregando referências...');
  const { ctx, vendas, orcs } = await montarContexto();

  // vendas/orçamentos dentro do período (os itens seguem a venda/orçamento)
  const dentro = (valor: string | null, tipo: 'data' | 'dh') => {
    if (!valor) return !periodo.de && !periodo.ate;
    const dia = tipo === 'dh' ? String(valor).slice(0, 10) : String(valor);
    return (!periodo.de || dia >= periodo.de) && (!periodo.ate || dia <= periodo.ate);
  };
  const idsVendas = new Set(vendas.filter(v => dentro(v.data_venda, 'data')).map(v => v.id));
  const idsOrcs = new Set(orcs.filter(o => dentro(o.created_at, 'dh')).map(o => o.id));

  const wb = XLSX.utils.book_new();
  const abas: { aba: string; linhas: number }[] = [];

  for (const c of escolhidos) {
    aoProgredir?.(`Lendo ${c.aba}...`);
    let linhas = await buscarTudo(c.tabela, c, periodo);
    const f = c.filtro;
    if (f && 'pai' in f) {
      const set = f.pai === 'vendas' ? idsVendas : idsOrcs;
      if (periodo.de || periodo.ate) linhas = linhas.filter(r => set.has(r[f.fk]));
    }
    // itens e movimentos: ordem natural (venda/orçamento e data) fica melhor que a ordem do banco
    if (c.id === 'venda_itens') linhas.sort((a, b) => (ctx.vendaNum.get(b.venda_id)?.numero ?? 0) - (ctx.vendaNum.get(a.venda_id)?.numero ?? 0) || String(a.created_at).localeCompare(String(b.created_at)));
    if (c.id === 'orcamento_itens') linhas.sort((a, b) => (ctx.orcNum.get(b.orcamento_id)?.numero ?? 0) - (ctx.orcNum.get(a.orcamento_id)?.numero ?? 0) || String(a.created_at).localeCompare(String(b.created_at)));

    XLSX.utils.book_append_sheet(wb, montarAba(c, linhas, ctx), c.aba.slice(0, 31));
    abas.push({ aba: c.aba, linhas: linhas.length });
  }

  // aba de resumo com o que foi exportado
  const rotuloPeriodo = periodo.de || periodo.ate
    ? `${periodo.de ? periodo.de.split('-').reverse().join('/') : 'início'} a ${periodo.ate ? periodo.ate.split('-').reverse().join('/') : 'hoje'}`
    : 'Todo o período';
  const resumo = [
    ['Gráfica Master Print — exportação de dados'],
    [`Gerado em ${new Date().toLocaleString('pt-BR')}`],
    [`Período (vendas, orçamentos, lançamentos, caixa e movimentos): ${rotuloPeriodo}`],
    ['Contas a pagar/receber mostram sempre o que está em aberto hoje; cadastros saem completos.'],
    [''],
    ['Aba', 'Registros'],
    ...abas.map(a => [a.aba, a.linhas]),
  ];
  const wsRes = XLSX.utils.aoa_to_sheet(resumo);
  wsRes['!cols'] = [{ wch: 34 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsRes, 'Resumo');
  // Resumo vai para a primeira posição
  wb.SheetNames = ['Resumo', ...wb.SheetNames.filter((n: string) => n !== 'Resumo')];

  XLSX.writeFile(wb, nomeArquivo, { cellDates: true });
  return { arquivo: nomeArquivo, abas };
}
