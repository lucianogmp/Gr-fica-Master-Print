import { BaseRepository } from "./BaseRepository.js";
import { supabase } from "../supabase/client.js";

// ─── Produtos ─────────────────────────────────────────────────────────────────
export class ProdutosRepository extends BaseRepository {
  constructor() {
    super("produtos", "*");
  }

  async findAllComCategoria() {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .order("nome");
    if (error) throw error;
    return data || [];
  }

  async findComBOM() {
    const { data, error } = await supabase
      .from("produto_materias")
      .select("*, materias_primas(id, nome, unidade, custo_unitario)")
      .order("created_at");
    if (error) throw error;
    return data || [];
  }
}

// ─── Categorias ───────────────────────────────────────────────────────────────
export class CategoriasRepository extends BaseRepository {
  constructor() {
    super("categorias", "*");
  }

  async findOrdered() {
    return this.findAll({ order: "nome" });
  }

  async findOrCreate(nome) {
    const { data: existing } = await supabase
      .from("categorias")
      .select("id")
      .ilike("nome", nome)
      .maybeSingle();
    if (existing) return existing.id;
    const nova = await this.create({ nome });
    return nova.id;
  }
}

// ─── Materias Primas ──────────────────────────────────────────────────────────
export class MateriasPrimasRepository extends BaseRepository {
  constructor() {
    super("materias_primas", "*");
  }

  async findOrdered() {
    return this.findAll({ order: "nome" });
  }
}

// ─── BOM (produto_materias) ───────────────────────────────────────────────────
export class BomRepository extends BaseRepository {
  constructor() {
    super("produto_materias", "*");
  }

  async findByProduto(produtoId) {
    const { data, error } = await supabase
      .from("produto_materias")
      .select("*, materias_primas(id, nome, unidade, custo_unitario)")
      .eq("produto_id", produtoId)
      .order("created_at");
    if (error) throw error;
    return data || [];
  }

  async deleteByProduto(produtoId) {
    return this.deleteWhere({ produto_id: produtoId });
  }
}
