/**
 * SERVICES — Camada de lógica de negócio do ERP.
 * Coordena repositories, valida regras, emite eventos e atualiza o store.
 * As páginas (Views) não chamam Supabase diretamente — sempre passam pelo Service.
 */

import { repositories } from "../data/repositories/index.js";
import { store, actions, selectors } from "./store.js";
import { EventBus, EVENTS } from "./eventBus.js";

// ─── Helpers de validação ─────────────────────────────────────────────────────
class ValidationError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// VENDA SERVICE
// ══════════════════════════════════════════════════════════════════════════════
export const VendaService = {
  async listar(filtros = {}) {
    actions.setVendasLoading(true);
    try {
      const list = await repositories.vendas.findWithFilters(filtros);
      actions.setVendas(list);
      return list;
    } finally {
      actions.setVendasLoading(false);
    }
  },

  async buscarPorId(id) {
    const venda = await repositories.vendas.findById(id);
    const itens = await repositories.vendas.findItens(id);
    return { ...venda, venda_itens: itens };
  },

  async criar(dados, itens = []) {
    const erros = VendaService._validar(dados, itens);
    if (Object.keys(erros).length) throw new ValidationError("Dados inválidos", erros);

    const payload = {
      ...dados,
      total: VendaService._calcularTotal(itens),
      status: dados.status || "pendente",
    };

    const venda = await repositories.vendas.create(payload);

    if (itens.length) {
      const itensDb = itens
        .filter(it => it.descricao?.trim())
        .map(it => ({
          venda_id:       venda.id,
          produto_id:     it.produtoId || null,
          descricao:      it.descricao,
          quantidade:     Number(it.qtd) || 1,
          preco_unitario: Number(it.preco) || 0,
          desconto:       Number(it.desconto) || 0,
          obs:            it.obs || null,
        }));
      await repositories.vendas.createItens(itensDb);
    }

    EventBus.emit(EVENTS.VENDA_CRIADA, venda);
    actions.showToast("Venda criada com sucesso!", "ok");

    // Lançamento financeiro automático
    await LancamentoService.criarDeVenda(venda);

    // Invalidar cache
    actions.setCache("vendas_resumo", null);

    return venda;
  },

  async atualizar(id, dados, itens) {
    const venda = await repositories.vendas.update(id, {
      ...dados,
      total: VendaService._calcularTotal(itens),
    });

    if (itens !== undefined) {
      await repositories.vendas.deleteItens(id);
      const validos = itens.filter(it => it.descricao?.trim());
      if (validos.length) {
        await repositories.vendas.createItens(
          validos.map(it => ({
            venda_id: id,
            produto_id: it.produtoId || null,
            descricao: it.descricao,
            quantidade: Number(it.qtd) || 1,
            preco_unitario: Number(it.preco) || 0,
            desconto: Number(it.desconto) || 0,
            obs: it.obs || null,
          }))
        );
      }
    }

    EventBus.emit(EVENTS.VENDA_ATUALIZADA, venda);
    actions.showToast("Venda atualizada!", "ok");
    return venda;
  },

  async mudarStatus(id, status) {
    const venda = await repositories.vendas.update(id, { status });
    EventBus.emit(EVENTS.VENDA_STATUS_MUDOU, { id, status });

    // Auto-mover para produção
    if (status === "em_execucao") {
      const vendaCompleta = await repositories.vendas.findById(id, "id, cliente_nome");
      await ProducaoService.criarDeVenda(vendaCompleta);
    }

    return venda;
  },

  async deletar(id) {
    await repositories.vendas.deleteItens(id);
    await repositories.vendas.delete(id);
    EventBus.emit(EVENTS.VENDA_DELETADA, { id });
    actions.showToast("Venda removida.", "ok");
  },

  async getResumoMes(mes) {
    const cache = store.getState("cache");
    const cacheKey = `vendas_resumo_${mes}`;
    if (cache[cacheKey] && Date.now() < (cache._ttl?.[cacheKey] || 0)) {
      return cache[cacheKey];
    }

    const vendas = await repositories.vendas.getResumoMes(mes);
    const resumo = {
      total: vendas.reduce((s, v) => s + Number(v.total || 0), 0),
      quantidade: vendas.length,
      porStatus: vendas.reduce((acc, v) => {
        acc[v.status] = (acc[v.status] || 0) + 1;
        return acc;
      }, {}),
    };
    actions.setCache(cacheKey, resumo);
    return resumo;
  },

  _validar(dados, itens) {
    const erros = {};
    const itensValidos = itens.filter(it => it.descricao?.trim());
    if (!itensValidos.length) erros.itens = "Adicione ao menos um item";
    return erros;
  },

  _calcularTotal(itens) {
    return itens.reduce((s, it) => {
      const subtotal = (Number(it.preco) || 0) * (Number(it.qtd) || 0);
      return s + subtotal - (Number(it.desconto) || 0);
    }, 0);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTE SERVICE
// ══════════════════════════════════════════════════════════════════════════════
export const ClienteService = {
  async listar() {
    const cached = actions.getCache("clientes");
    if (cached) { actions.setClientes(cached); return cached; }

    const list = await repositories.clientes.findAll();
    actions.setClientes(list);
    actions.setCache("clientes", list);
    return list;
  },

  async buscar(term) {
    if (!term?.trim()) return ClienteService.listar();
    return repositories.clientes.search(term);
  },

  async criar(dados) {
    if (!dados.nome?.trim()) throw new ValidationError("Nome é obrigatório", { nome: true });
    const cliente = await repositories.clientes.create(dados);
    EventBus.emit(EVENTS.CLIENTE_CRIADO, cliente);
    actions.setCache("clientes", null); // Invalidar cache
    await ClienteService.listar();
    actions.showToast(`Cliente "${cliente.nome}" cadastrado!`, "ok");
    return cliente;
  },

  async atualizar(id, dados) {
    const cliente = await repositories.clientes.update(id, dados);
    EventBus.emit(EVENTS.CLIENTE_ATUALIZADO, cliente);
    actions.setCache("clientes", null);
    await ClienteService.listar();
    return cliente;
  },

  async deletar(id) {
    await repositories.clientes.delete(id);
    EventBus.emit(EVENTS.CLIENTE_DELETADO, { id });
    actions.setCache("clientes", null);
    await ClienteService.listar();
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ESTOQUE SERVICE
// ══════════════════════════════════════════════════════════════════════════════
export const EstoqueService = {
  async listar() {
    const materias = await repositories.materias.findComSaldo();
    actions.setMaterias(materias);

    // Verificar alertas
    materias.forEach(mp => {
      const saldo = Number(mp.saldo);
      const min = Number(mp.estoque_minimo || 0);
      if (saldo <= 0) EventBus.emit(EVENTS.ESTOQUE_ZERADO, mp);
      else if (min > 0 && saldo <= min) EventBus.emit(EVENTS.ESTOQUE_ALERTA_BAIXO, mp);
    });

    return materias;
  },

  async registrarEntrada(mpId, quantidade, motivo) {
    if (!quantidade || quantidade <= 0) throw new ValidationError("Quantidade inválida");
    const mov = await repositories.movimentos.registrar({
      materia_prima_id: mpId, tipo: "entrada", quantidade, motivo,
    });
    EventBus.emit(EVENTS.ESTOQUE_ENTRADA, { mpId, quantidade });
    await EstoqueService.listar();
    return mov;
  },

  async registrarSaida(mpId, quantidade, motivo, forcarNegativo = false) {
    if (!quantidade || quantidade <= 0) throw new ValidationError("Quantidade inválida");

    // Verificar saldo
    const materias = selectors.estoque().materias;
    const mp = materias.find(m => m.id === mpId);
    if (mp && mp.saldo < quantidade && !forcarNegativo) {
      throw new ValidationError(`Saldo insuficiente (${mp.saldo} ${mp.unidade})`);
    }

    const mov = await repositories.movimentos.registrar({
      materia_prima_id: mpId, tipo: "saida", quantidade, motivo,
    });
    EventBus.emit(EVENTS.ESTOQUE_SAIDA, { mpId, quantidade });
    await EstoqueService.listar();
    return mov;
  },

  async criarMateria(dados) {
    const mp = await repositories.materias.create(dados);
    if (dados.saldo_inicial > 0) {
      await repositories.movimentos.registrar({
        materia_prima_id: mp.id, tipo: "entrada",
        quantidade: dados.saldo_inicial, motivo: "Saldo inicial", origem: "manual",
      });
    }
    await EstoqueService.listar();
    actions.showToast("Matéria-prima cadastrada!", "ok");
    return mp;
  },

  async atualizarMateria(id, dados) {
    const mp = await repositories.materias.update(id, dados);
    await EstoqueService.listar();
    return mp;
  },

  async deletarMateria(id) {
    await repositories.movimentos.deleteWhere({ materia_prima_id: id });
    await repositories.materias.delete(id);
    await EstoqueService.listar();
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// FINANCEIRO SERVICE
// ══════════════════════════════════════════════════════════════════════════════
export const LancamentoService = {
  async listar(mes) {
    store.set("financeiro", { loading: true });
    try {
      const lancamentos = mes
        ? await repositories.lancamentos.findDoMes(mes)
        : await repositories.lancamentos.findAll();

      const resumo = LancamentoService._calcularResumo(lancamentos);
      actions.setLancamentos(lancamentos);
      actions.setResumo(resumo);
      return { lancamentos, resumo };
    } finally {
      store.set("financeiro", s => ({ ...s, loading: false }));
    }
  },

  async criar(dados) {
    const { isRecorrente, qtdParcelas, tipoParc, ...payload } = dados;

    if (!payload.descricao?.trim()) throw new ValidationError("Informe a descrição");
    if (!payload.valor) throw new ValidationError("Informe o valor");

    if (isRecorrente) {
      return LancamentoService._criarRecorrente(payload, qtdParcelas, tipoParc);
    }

    const lanc = await repositories.lancamentos.create(payload);
    EventBus.emit(EVENTS.LANCAMENTO_CRIADO, lanc);
    await LancamentoService.listar(selectors.financeiro().mes);
    actions.showToast("Lançamento criado!", "ok");
    return lanc;
  },

  async criarDeVenda(venda) {
    const lanc = await repositories.lancamentos.create({
      tipo: "receita",
      descricao: `Venda — ${venda.cliente_nome || "Sem cliente"}`,
      valor: Number(venda.total || 0),
      categoria: "Venda",
      status: venda.status === "entregue" ? "pago" : "pendente",
      venda_id: venda.id,
      data_vencimento: venda.data_entrega || new Date().toISOString().split("T")[0],
    });
    EventBus.emit(EVENTS.LANCAMENTO_CRIADO, lanc);
    return lanc;
  },

  async marcarPago(id) {
    const lanc = await repositories.lancamentos.marcarPago(id);
    EventBus.emit(EVENTS.LANCAMENTO_PAGO, lanc);
    await LancamentoService.listar(selectors.financeiro().mes);
    actions.showToast("Lançamento baixado!", "ok");
    return lanc;
  },

  async atualizar(id, dados) {
    const lanc = await repositories.lancamentos.update(id, dados);
    await LancamentoService.listar(selectors.financeiro().mes);
    return lanc;
  },

  async deletar(id, deleteGroup = false) {
    if (deleteGroup) {
      const lanc = await repositories.lancamentos.findById(id);
      if (lanc?.grupo_recorrencia) {
        const todos = await repositories.lancamentos.findAll();
        const pendentes = todos.filter(l =>
          l.grupo_recorrencia === lanc.grupo_recorrencia &&
          l.status === "pendente" &&
          l.data_vencimento >= lanc.data_vencimento
        );
        await Promise.all(pendentes.map(l => repositories.lancamentos.delete(l.id)));
        await LancamentoService.listar(selectors.financeiro().mes);
        return;
      }
    }
    await repositories.lancamentos.delete(id);
    await LancamentoService.listar(selectors.financeiro().mes);
  },

  _calcularResumo(lancamentos) {
    const receitas = lancamentos.filter(l => l.tipo === "receita");
    const despesas = lancamentos.filter(l => l.tipo === "despesa");
    const totalRec  = receitas.reduce((s, l) => s + Number(l.valor), 0);
    const totalDesp = despesas.reduce((s, l) => s + Number(l.valor), 0);
    return {
      receitas: totalRec,
      despesas: totalDesp,
      saldo: totalRec - totalDesp,
      recebido: receitas.filter(l => l.status === "pago").reduce((s, l) => s + Number(l.valor), 0),
      aReceber: receitas.filter(l => l.status === "pendente").reduce((s, l) => s + Number(l.valor), 0),
      aPagar:   despesas.filter(l => l.status === "pendente").reduce((s, l) => s + Number(l.valor), 0),
    };
  },

  async _criarRecorrente(payload, qtd, tipoParc) {
    const numParc = tipoParc === "indefinido" ? 24 : (parseInt(qtd) || 12);
    const grupo = crypto.randomUUID();
    const [ano, mes, dia] = payload.data_vencimento.split("-").map(Number);
    const registros = [];
    for (let i = 0; i < numParc; i++) {
      let novoMes = mes + i, novoAno = ano;
      while (novoMes > 12) { novoMes -= 12; novoAno++; }
      registros.push({
        ...payload,
        data_vencimento: `${novoAno}-${String(novoMes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`,
        status: i === 0 ? payload.status : "pendente",
        grupo_recorrencia: grupo,
        parcela_num: i + 1,
        total_parcelas: tipoParc === "indefinido" ? null : numParc,
      });
    }
    await repositories.lancamentos.createMany(registros);
    await LancamentoService.listar(selectors.financeiro().mes);
    actions.showToast(`${numParc} parcelas criadas!`, "ok");
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// PRODUÇÃO SERVICE
// ══════════════════════════════════════════════════════════════════════════════
export const ProducaoService = {
  async listar() {
    store.set("producao", { loading: true });
    try {
      const itens = await repositories.producao.findAll();
      store.set("producao", { itens, loading: false });
      return itens;
    } catch (e) {
      store.set("producao", { loading: false });
      throw e;
    }
  },

  async criar(dados) {
    const item = await repositories.producao.create({ ...dados, etapa: dados.etapa || "fila" });
    await ProducaoService.listar();
    return item;
  },

  async criarDeVenda(venda) {
    return ProducaoService.criar({
      titulo: `Pedido — ${venda.cliente_nome || "Sem cliente"}`,
      venda_id: venda.id,
      etapa: "fila",
      prioridade: "normal",
    });
  },

  async moverEtapa(id, etapa) {
    const item = await repositories.producao.moverEtapa(id, etapa);
    EventBus.emit(EVENTS.PRODUCAO_ETAPA_MUDOU, { id, etapa });
    if (etapa === "pronto") EventBus.emit(EVENTS.PRODUCAO_CONCLUIDA, item);
    await ProducaoService.listar();
    return item;
  },

  async atualizar(id, dados) {
    const item = await repositories.producao.update(id, dados);
    await ProducaoService.listar();
    return item;
  },

  async deletar(id) {
    await repositories.producao.delete(id);
    await ProducaoService.listar();
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG SERVICE
// ══════════════════════════════════════════════════════════════════════════════
export const ConfigService = {
  async carregar() {
    const cfg = await repositories.config.getGlobal();
    const vendedores = await repositories.vendedores.findAll();
    const parse = (val, fallback) => {
      try { return JSON.parse(val || "null") ?? fallback; } catch { return fallback; }
    };
    const config = {
      empresa: cfg,
      formasPagamento: parse(cfg.formas_pagamento, []),
      etapasProducao: parse(cfg.etapas_producao, []),
      categoriasFinanceiras: parse(cfg.categorias_financeiras, { receitas: [], despesas: [] }),
      custosFixos: parse(cfg.custos_fixos, []),
      vendedores,
    };
    actions.setConfig(config);
    EventBus.emit(EVENTS.CONFIG_CARREGADA, config);
    return config;
  },

  async salvar(dados) {
    const cfg = await repositories.config.updateGlobal(dados);
    await ConfigService.carregar();
    actions.showToast("Configurações salvas!", "ok");
    return cfg;
  },

  async salvarJSON(campo, valor) {
    return ConfigService.salvar({ [campo]: JSON.stringify(valor) });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD SERVICE — agrega dados de múltiplos domínios
// ══════════════════════════════════════════════════════════════════════════════
export const DashboardService = {
  async getResumo(mes) {
    const cacheKey = `dashboard_${mes}`;
    const cached = actions.getCache(cacheKey);
    if (cached) return cached;

    const [vendas, lancamentos, materias, clientes] = await Promise.all([
      repositories.vendas.getResumoMes(mes),
      repositories.lancamentos.findDoMes(mes),
      repositories.materias.findComSaldo(),
      repositories.clientes.count({ created_at: { op: "gte", value: `${mes}-01` } }).catch(() => 0),
    ]);

    const receitasMes = lancamentos.filter(l => l.tipo === "receita").reduce((s,l) => s+Number(l.valor), 0);
    const despesasMes = lancamentos.filter(l => l.tipo === "despesa").reduce((s,l) => s+Number(l.valor), 0);
    const faturamento = vendas.reduce((s,v) => s+Number(v.total||0), 0);

    const resumo = {
      faturamento,
      vendas: { total: vendas.length, lista: vendas },
      financeiro: {
        receitas: receitasMes,
        despesas: despesasMes,
        lucro: receitasMes - despesasMes,
        margem: receitasMes > 0 ? ((receitasMes - despesasMes) / receitasMes * 100).toFixed(1) : "0.0",
      },
      estoque: {
        alertas: materias.filter(m => m.saldo > 0 && m.saldo <= (m.estoque_minimo || 0)),
        zerados: materias.filter(m => m.saldo <= 0),
      },
      clientes: { novos: clientes },
      lancamentos,
    };

    actions.setCache(cacheKey, resumo);
    return resumo;
  },
};

// Exporta todos os services em um namespace
export const services = {
  venda:      VendaService,
  cliente:    ClienteService,
  estoque:    EstoqueService,
  lancamento: LancamentoService,
  producao:   ProducaoService,
  config:     ConfigService,
  dashboard:  DashboardService,
};
