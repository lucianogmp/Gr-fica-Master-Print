/**
 * REPOSITÓRIOS DE DOMÍNIO — Cada entidade do ERP tem seu repositório.
 * Herdam BaseRepository e adicionam queries específicas de negócio.
 */

import { BaseRepository } from "./baseRepository.js";
import { supabase } from "../../supabase/client.js";

// ══════════════════════════════════════════════════════════════════════════════
// VENDAS
// ══════════════════════════════════════════════════════════════════════════════
export class VendaRepository extends BaseRepository {
  constructor() {
    super("vendas", "*, venda_itens(*)");
  }

  async findWithFilters({ status, search, mes, limit = 100 } = {}) {
    let q = supabase
      .from("vendas")
      .select("*, venda_itens(*)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) q = q.eq("status", status);
    if (mes)    q = q.gte("created_at", `${mes}-01`).lte("created_at", `${mes}-31`);
    if (search) q = q.ilike("cliente_nome", `%${search}%`);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async findItens(vendaId) {
    const { data, error } = await supabase
      .from("venda_itens")
      .select("*")
      .eq("venda_id", vendaId);
    if (error) throw error;
    return data || [];
  }

  async deleteItens(vendaId) {
    const { error } = await supabase
      .from("venda_itens")
      .delete()
      .eq("venda_id", vendaId);
    if (error) throw error;
  }

  async createItens(itens) {
    if (!itens.length) return [];
    const { data, error } = await supabase
      .from("venda_itens")
      .insert(itens)
      .select();
    if (error) throw error;
    return data || [];
  }

  async getResumoMes(mes) {
    const { data, error } = await supabase
      .from("vendas")
      .select("id, total, status, created_at")
      .gte("created_at", `${mes}-01`)
      .lte("created_at", `${mes}-31`);
    if (error) throw error;
    return data || [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════════════════════════════
export class ClienteRepository extends BaseRepository {
  constructor() { super("clientes", "*"); }

  async findAll() {
    return super.findAll({ order: "nome" });
  }

  async search(term) {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,email.ilike.%${term}%,cpf_cnpj.ilike.%${term}%`)
      .order("nome")
      .limit(50);
    if (error) throw error;
    return data || [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUTOS
// ══════════════════════════════════════════════════════════════════════════════
export class ProdutoRepository extends BaseRepository {
  constructor() { super("produtos", "*"); }

  async findWithCategoria() {
    const { data, error } = await supabase
      .from("produtos")
      .select("*, categorias(id, nome)")
      .order("nome");
    if (error) throw error;
    return data || [];
  }

  async findBOM(produtoId) {
    const { data, error } = await supabase
      .from("produto_materias")
      .select("*, materias_primas(id, nome, unidade, custo_unitario)")
      .eq("produto_id", produtoId);
    if (error) throw error;
    return data || [];
  }
}

export class CategoriaRepository extends BaseRepository {
  constructor() { super("categorias", "*"); }
  async findAll() { return super.findAll({ order: "nome" }); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTOQUE
// ══════════════════════════════════════════════════════════════════════════════
export class MateriasPrimasRepository extends BaseRepository {
  constructor() { super("materias_primas", "*"); }

  async findAll() { return super.findAll({ order: "nome" }); }

  async findComSaldo() {
    const [{ data: mps }, { data: movs }] = await Promise.all([
      supabase.from("materias_primas").select("*").order("nome"),
      supabase.from("estoque_movimentos")
        .select("materia_prima_id, tipo, quantidade")
        .limit(2000),
    ]);

    return (mps || []).map(mp => {
      const movsMp = (movs || []).filter(m => m.materia_prima_id === mp.id);
      const ent = movsMp.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.quantidade), 0);
      const sai = movsMp.filter(m => m.tipo === "saida").reduce((s, m) => s + Number(m.quantidade), 0);
      return { ...mp, saldo: ent - sai };
    });
  }
}

export class EstoqueMovimentoRepository extends BaseRepository {
  constructor() { super("estoque_movimentos", "*, materias_primas(nome, unidade)"); }

  async findRecentes(limit = 300) {
    return super.findAll({
      order: { col: "created_at", asc: false },
      limit,
    });
  }

  async registrar({ materia_prima_id, tipo, quantidade, motivo, origem = "manual" }) {
    return this.create({ materia_prima_id, tipo, quantidade, motivo, origem });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CAIXA FÍSICO
// ══════════════════════════════════════════════════════════════════════════════
export class CaixaMovimentoRepository extends BaseRepository {
  constructor() { super("caixa_movimentos", "*"); }

  async findAll() {
    return super.findAll({ 
      order: [{ col: "data", asc: true }, { col: "created_at", asc: true }] 
    });
  }

  async findByData(data) {
    const { data: movimentos, error } = await supabase
      .from("caixa_movimentos")
      .select("*")
      .eq("data", data)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return movimentos || [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FINANCEIRO
// ══════════════════════════════════════════════════════════════════════════════
export class LancamentoRepository extends BaseRepository {
  constructor() { super("lancamentos", "*"); }

  async findAll() {
    return super.findAll({ order: { col: "data_vencimento", asc: true } });
  }

  async findDoMes(mes) {
    const { data, error } = await supabase
      .from("lancamentos")
      .select("*")
      .gte("data_vencimento", `${mes}-01`)
      .lte("data_vencimento", `${mes}-31`)
      .order("data_vencimento");
    if (error) throw error;
    return data || [];
  }

  async findVencidos() {
    const hoje = new Date().toISOString().split("T")[0];
    return super.findAll({
      filters: { status: "pendente" },
      order: { col: "data_vencimento", asc: true },
    }).then(list => list.filter(l => l.data_vencimento < hoje));
  }

  async marcarPago(id) {
    return this.update(id, {
      status: "pago",
      data_pagamento: new Date().toISOString().split("T")[0],
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUÇÃO
// ══════════════════════════════════════════════════════════════════════════════
export class ProducaoRepository extends BaseRepository {
  constructor() { super("producao", "*"); }

  async findAll() {
    return super.findAll({ order: { col: "data_entrega", asc: true } });
  }

  async moverEtapa(id, etapa) {
    return this.update(id, { etapa });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ORÇAMENTOS
// ══════════════════════════════════════════════════════════════════════════════
export class OrcamentoRepository extends BaseRepository {
  constructor() { super("orcamentos", "*, orcamento_itens(*)"); }

  async findAll() {
    return super.findAll({ order: { col: "created_at", asc: false } });
  }

  async findItens(orcamentoId) {
    const { data, error } = await supabase
      .from("orcamento_itens")
      .select("*")
      .eq("orcamento_id", orcamentoId);
    if (error) throw error;
    return data || [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ══════════════════════════════════════════════════════════════════════════════
export class ConfigRepository extends BaseRepository {
  constructor() { super("configuracoes", "*"); }

  async getGlobal() {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("*")
      .eq("id", "global")
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data || {};
  }

  async updateGlobal(patch) {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    );
    const { data, error } = await supabase
      .from("configuracoes")
      .update({ ...clean, updated_at: new Date() })
      .eq("id", "global")
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async saveJSON(campo, valor) {
    return this.updateGlobal({ [campo]: JSON.stringify(valor) });
  }
}

export class VendedorRepository extends BaseRepository {
  constructor() { super("vendedores", "*"); }
  async findAll() { return super.findAll({ order: "nome" }); }
}

// ══════════════════════════════════════════════════════════════════════════════
// INSTÂNCIAS SINGLETON (injeção de dependência simples)
// ══════════════════════════════════════════════════════════════════════════════
export const repositories = {
  vendas:        new VendaRepository(),
  clientes:      new ClienteRepository(),
  produtos:      new ProdutoRepository(),
  categorias:    new CategoriaRepository(),
  materias:      new MateriasPrimasRepository(),
  movimentos:    new EstoqueMovimentoRepository(),
  caixaMovimentos: new CaixaMovimentoRepository(),
  lancamentos:   new LancamentoRepository(),
  producao:      new ProducaoRepository(),
  orcamentos:    new OrcamentoRepository(),
  config:        new ConfigRepository(),
  vendedores:    new VendedorRepository(),
};
