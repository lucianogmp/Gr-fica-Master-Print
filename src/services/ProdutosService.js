import {
  ProdutosRepository,
  CategoriasRepository,
  MateriasPrimasRepository,
  BomRepository,
} from "../repositories/ProdutosRepository.js";
import { EventBus } from "../core/eventBus.js";

export class ProdutosService {
  #produtos   = new ProdutosRepository();
  #categorias = new CategoriasRepository();
  #mps        = new MateriasPrimasRepository();
  #bom        = new BomRepository();

  // ─── Cache ────────────────────────────────────────────────────────────────
  _cache = {
    produtos:       [],
    categorias:     [],
    materias_primas:[],
    bom:            [],
  };

  // ─── Carregamento ─────────────────────────────────────────────────────────
  async loadAll() {
    const [prods, cats, mps, bom] = await Promise.all([
      this.#produtos.findAllComCategoria(),
      this.#categorias.findOrdered(),
      this.#mps.findOrdered(),
      this.#produtos.findComBOM(),
    ]);

    this._cache.categorias      = cats;
    this._cache.materias_primas = mps;
    this._cache.bom             = bom;
    this._cache.produtos        = prods.map(p => this.enriquecer(p, bom));
    return this._cache;
  }

  async recarregar() {
    return this.loadAll();
  }

  // ─── Enriquecimento (cálculo de custo BOM + margem) ──────────────────────
  enriquecer(prod, bom) {
    const materiais = bom.filter(b => b.produto_id === prod.id);
    const custoBOM  = materiais.reduce((s, b) =>
      s + Number(b.materias_primas?.custo_unitario || 0) * Number(b.quantidade || 0), 0);
    const precoVenda = Number(prod.preco_venda || 0);
    const margem     = precoVenda > 0 && custoBOM > 0
      ? ((precoVenda - custoBOM) / precoVenda) * 100
      : precoVenda > 0 ? 100 : 0;
    return { ...prod, materiais, custoBOM, margem };
  }

  calcPreco(p, bom) {
    const custoBOM   = bom.reduce((s, b) =>
      s + Number(b.quantidade || 0) * Number(b.materias_primas?.custo_unitario || 0), 0);
    const precoVenda = Number(p.preco_venda || 0);
    const lucro      = precoVenda - custoBOM;
    const margem     = precoVenda > 0 && custoBOM > 0
      ? ((precoVenda - custoBOM) / precoVenda) * 100
      : precoVenda > 0 ? 100 : 0;
    return { custoBOM, lucro, margem };
  }

  // ─── Produto CRUD ─────────────────────────────────────────────────────────
  validate(p) {
    if (!p.nome?.trim()) throw new Error("Informe o nome do produto.");
  }

  async criar(payload) {
    this.validate(payload);
    const clean = this._buildPayload(payload);
    const novo  = await this.#produtos.create(clean);
    EventBus.emit("produto:criado", novo);
    await this.recarregar();
    return novo;
  }

  async atualizar(id, payload) {
    this.validate(payload);
    const clean = this._buildPayload(payload);
    const atualizado = await this.#produtos.update(id, clean);
    EventBus.emit("produto:atualizado", atualizado);
    await this.recarregar();
    return atualizado;
  }

  async deletar(id) {
    await this.#bom.deleteByProduto(id);
    await this.#produtos.delete(id);
    EventBus.emit("produto:deletado", { id });
    await this.recarregar();
  }

  _buildPayload(p) {
    return {
      nome:              p.nome?.trim(),
      categoria_id:      p.categoria_id   || null,
      sku:               p.sku            || null,
      status:            p.status         || "ativo",
      descricao:         p.descricao      || null,
      icone_svg:         p.icone_svg      || null,
      preco_venda:       Number(p.preco_venda       || 0),
      custo_mao_obra:    Number(p.custo_mao_obra    || 0),
      custo_acabamento:  Number(p.custo_acabamento  || 0),
      custo_operacional: Number(p.custo_operacional || 0),
      tempo_producao:    p.tempo_producao  || null,
      maquina:           p.maquina         || null,
      setor:             p.setor           || null,
      acabamento:        p.acabamento      || null,
      checklist:         p.checklist       || null,
    };
  }

  // ─── Categoria CRUD ───────────────────────────────────────────────────────
  async criarCategoria(nome) {
    if (!nome?.trim()) throw new Error("Informe o nome da categoria.");
    const nova = await this.#categorias.create({ nome: nome.trim() });
    await this.recarregar();
    return nova;
  }

  async atualizarCategoria(id, nome) {
    if (!nome?.trim()) throw new Error("Informe o nome da categoria.");
    const atualizada = await this.#categorias.update(id, { nome: nome.trim() });
    await this.recarregar();
    return atualizada;
  }

  // ─── BOM CRUD ─────────────────────────────────────────────────────────────
  async adicionarBOM(produtoId, materiaId, quantidade) {
    const item = await this.#bom.create({
      produto_id: produtoId,
      materia_id: materiaId,
      quantidade: Number(quantidade),
    });
    this._cache.bom = await this.#produtos.findComBOM();
    // Atualiza produto enriquecido no cache
    const idx = this._cache.produtos.findIndex(p => p.id === produtoId);
    if (idx !== -1) {
      this._cache.produtos[idx] = this.enriquecer(
        this._cache.produtos[idx],
        this._cache.bom
      );
    }
    return item;
  }

  async removerBOM(itemId, produtoId) {
    await this.#bom.delete(itemId);
    this._cache.bom = await this.#produtos.findComBOM();
    const idx = this._cache.produtos.findIndex(p => p.id === produtoId);
    if (idx !== -1) {
      this._cache.produtos[idx] = this.enriquecer(
        this._cache.produtos[idx],
        this._cache.bom
      );
    }
  }

  getBomDoProduto(produtoId) {
    return this._cache.bom.filter(b => b.produto_id === produtoId);
  }
}
