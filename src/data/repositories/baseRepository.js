/**
 * BASE REPOSITORY — Camada de acesso a dados (Data Access Layer).
 * Abstrai o Supabase. Se amanhã mudar para outro backend,
 * só este arquivo precisa mudar.
 */

import { supabase } from "../../supabase/client.js";

export class BaseRepository {
  #table;
  #defaultSelect;

  constructor(table, defaultSelect = "*") {
    this.#table = table;
    this.#defaultSelect = defaultSelect;
  }

  get table() { return this.#table; }
  get client() { return supabase; }

  /** Busca todos os registros com filtros opcionais */
  async findAll({ select, filters = {}, order, limit } = {}) {
    let q = supabase.from(this.#table).select(select || this.#defaultSelect);

    Object.entries(filters).forEach(([col, val]) => {
      if (val === null || val === undefined || val === "") return;
      if (Array.isArray(val)) q = q.in(col, val);
      else if (typeof val === "object" && val.op) {
        // Suporte a operadores: { op: "gte", value: X }
        q = q[val.op](col, val.value);
      } else {
        q = q.eq(col, val);
      }
    });

    if (order) {
      const { col, asc = true } = typeof order === "string" ? { col: order } : order;
      q = q.order(col, { ascending: asc });
    }

    if (limit) q = q.limit(limit);

    const { data, error } = await q;
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return data || [];
  }

  /** Busca um registro por ID */
  async findById(id, select) {
    const { data, error } = await supabase
      .from(this.#table)
      .select(select || this.#defaultSelect)
      .eq("id", id)
      .single();
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return data;
  }

  /** Busca com texto livre (ilike) em uma coluna */
  async search(column, term, select) {
    const { data, error } = await supabase
      .from(this.#table)
      .select(select || this.#defaultSelect)
      .ilike(column, `%${term}%`)
      .order(column);
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return data || [];
  }

  /** Cria um novo registro */
  async create(payload) {
    const clean = this.#removeUndefined(payload);
    const { data, error } = await supabase
      .from(this.#table)
      .insert(clean)
      .select()
      .single();
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return data;
  }

  /** Cria múltiplos registros */
  async createMany(payloads) {
    const clean = payloads.map(p => this.#removeUndefined(p));
    const { data, error } = await supabase
      .from(this.#table)
      .insert(clean)
      .select();
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return data || [];
  }

  /** Atualiza um registro */
  async update(id, patch) {
    const clean = this.#removeUndefined({ ...patch, updated_at: new Date().toISOString() });
    const { data, error } = await supabase
      .from(this.#table)
      .update(clean)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return data;
  }

  /** Upsert (cria ou atualiza) */
  async upsert(payload, conflictColumn = "id") {
    const clean = this.#removeUndefined(payload);
    const { data, error } = await supabase
      .from(this.#table)
      .upsert(clean, { onConflict: conflictColumn })
      .select()
      .single();
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return data;
  }

  /** Remove um registro */
  async delete(id) {
    const { error } = await supabase
      .from(this.#table)
      .delete()
      .eq("id", id);
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return true;
  }

  /** Remove com filtro customizado */
  async deleteWhere(filters) {
    let q = supabase.from(this.#table).delete();
    Object.entries(filters).forEach(([col, val]) => { q = q.eq(col, val); });
    const { error } = await q;
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return true;
  }

  /** Contagem */
  async count(filters = {}) {
    let q = supabase.from(this.#table).select("id", { count: "exact", head: true });
    Object.entries(filters).forEach(([col, val]) => {
      if (val !== undefined && val !== "") q = q.eq(col, val);
    });
    const { count, error } = await q;
    if (error) throw new RepositoryError(error.message, error.code, this.#table);
    return count || 0;
  }

  #removeUndefined(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined)
    );
  }
}

export class RepositoryError extends Error {
  constructor(message, code, table) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.table = table;
  }
}
