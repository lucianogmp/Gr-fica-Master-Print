import {
  CaixaMovimentosRepository,
  VendasCaixaRepository,
} from "../repositories/FluxoCaixaRepository.js";
import { ProdutosRepository } from "../repositories/ProdutosRepository.js";
import { BaseRepository } from "../repositories/BaseRepository.js";
import { EventBus } from "../core/EventBus.js";

// Repositório leve para clientes (só precisa de id/nome)
class ClientesLightRepository extends BaseRepository {
  constructor() { super("clientes", "id, nome, telefone"); }
  async findOrdered() { return this.findAll({ order: "nome" }); }
}

export class FluxoCaixaService {
  #movimentos = new CaixaMovimentosRepository();
  #vendas     = new VendasCaixaRepository();
  #clientes   = new ClientesLightRepository();
  #produtos   = new ProdutosRepository();

  _cache = {
    movimentos: [],
    clientes:   [],
    produtos:   [],
  };

  // ─── Carregamento ─────────────────────────────────────────────────────────
  async loadAll() {
    const [movs, clientes, produtos] = await Promise.all([
      this.#movimentos.findAll(),
      this.#clientes.findOrdered(),
      this.#produtos.findAll({ order: "nome" }),
    ]);
    this._cache.movimentos = movs;
    this._cache.clientes   = clientes;
    this._cache.produtos   = produtos;
    return this._cache;
  }

  // ─── Cálculos do dia ──────────────────────────────────────────────────────
  calcDia(data) {
    const doDia = this._cache.movimentos.filter(m => m.data === data);
    let saldoCorrido = 0;
    const comSaldo = doDia.map(m => {
      const val = Number(m.valor);
      saldoCorrido += m.tipo === "entrada" ? val : -val;
      return { ...m, saldoCorrido };
    });
    const totalEntradas = doDia.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor), 0);
    const totalSaidas   = doDia.filter(m => m.tipo === "saida").reduce((s, m)   => s + Number(m.valor), 0);
    return { doDia, comSaldo, totalEntradas, totalSaidas, saldoDia: totalEntradas - totalSaidas };
  }

  // ─── CRUD Movimentos ──────────────────────────────────────────────────────
  validate({ valor, descricao }) {
    if (!descricao?.trim()) throw new Error("Informe a descrição / produto.");
    if (!valor || Number(valor) <= 0) throw new Error("Informe um valor válido.");
  }

  async criar(payload) {
    this.validate(payload);
    const novo = await this.#movimentos.create(this._buildPayload(payload));
    await this._recarregarMovimentos();
    EventBus.emit("caixa:movimento_criado", novo);
    return novo;
  }

  async atualizar(id, payload) {
    this.validate(payload);
    const atualizado = await this.#movimentos.update(id, this._buildPayload(payload));
    await this._recarregarMovimentos();
    EventBus.emit("caixa:movimento_atualizado", atualizado);
    return atualizado;
  }

  async deletar(id) {
    await this.#movimentos.delete(id);
    await this._recarregarMovimentos();
    EventBus.emit("caixa:movimento_deletado", { id });
  }

  _buildPayload(p) {
    return {
      tipo:        p.tipo,
      data:        p.data,
      valor:       Number(p.valor),
      descricao:   p.descricao?.trim(),
      cliente_nome: p.cliente_nome?.trim() || null,
      observacoes: p.observacoes?.trim()   || null,
      origem:      p.origem || "manual",
      venda_id:    p.venda_id || null,
    };
  }

  // ─── Importar vendas ──────────────────────────────────────────────────────
  async carregarVendasDisponiveis() {
    const [vendas, idsImportadas] = await Promise.all([
      this.#vendas.findDisponiveisImportacao(),
      this.#movimentos.findVendaIdsImportadas(),
    ]);
    return vendas.filter(v => !idsImportadas.has(v.id));
  }

  async importarVendas(vendas, diaFallback) {
    if (!vendas.length) throw new Error("Selecione ao menos uma venda.");
    const inserts = vendas.map(v => ({
      tipo:        "entrada",
      data:        v.data || diaFallback,
      descricao:   v.descricao,
      cliente_nome: v.cliente || null,
      valor:       parseFloat(v.total) || 0,
      venda_id:    v.id,
      origem:      "venda",
    }));
    for (const item of inserts) {
      await this.#movimentos.create(item);
    }
    await this._recarregarMovimentos();
    EventBus.emit("caixa:vendas_importadas", { quantidade: inserts.length });
    return inserts.length;
  }

  // ─── Helpers internos ─────────────────────────────────────────────────────
  async _recarregarMovimentos() {
    this._cache.movimentos = await this.#movimentos.findAll();
  }
}
