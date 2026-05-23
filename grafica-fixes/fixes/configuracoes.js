// ════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES VIEW — com upload de logo funcionando
// ════════════════════════════════════════════════════════════════════════════

import { BaseRepository } from "../../data/repositories/baseRepository.js";
import { EventBus }       from "../../core/eventBus.js";
import { supabase }       from "../../supabase/client.js";
import { updateSidebarLogo } from "../layout.js";

// Mixin inline — substitui BaseView sem dependência externa
class BaseView {
  constructor(container) { this._container = container; this._listeners = []; }
  _on(el, ev, fn) { el.addEventListener(ev, fn); this._listeners.push({ el, ev, fn }); }
  cleanup() { this._listeners.forEach(({ el, ev, fn }) => el.removeEventListener(ev, fn)); this._listeners = []; }
}

// ─── Repositórios ──────────────────────────────────────────────────────────────

class ConfigGlobalRepository extends BaseRepository {
  constructor() { super("configuracoes", "*"); }

  async findGlobal() {
    const { data } = await supabase
      .from("configuracoes")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    return data || {};
  }

  async upsertGlobal(patch) {
    const { error } = await supabase
      .from("configuracoes")
      .upsert({ id: "global", ...patch }, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
}

class VendedoresRepository extends BaseRepository {
  constructor() { super("vendedores", "*"); }
  async findOrdered() { return this.findAll({ order: "nome" }); }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ConfiguracoesService {
  #global     = new ConfigGlobalRepository();
  #vendedores = new VendedoresRepository();

  _cache = {
    cfg: {},
    vendedores: [],
    formasPagamento:       [],
    taxasCartao:           [],
    contasBancarias:       [],
    categoriasFinanceiras: { receitas: [], despesas: [] },
    etapasProducao:        [],
    maquinasProducao:      [],
    custosFixos:           [],
    categoriasProdutos:    [],
    unidadesProdutos:      [],
    tabelasPreco:          [],
    fornecedores:          [],
    categoriasMateriais:   [],
    unidadesEstoque:       [],
    categoriasClientes:    [],
    camposCustomClientes:  [],
    perfisPermissao:       [],
  };

  async loadAll() {
    const [cfg, vendedores] = await Promise.all([
      this.#global.findGlobal(),
      this.#vendedores.findOrdered(),
    ]);
    this._cache.cfg        = cfg;
    this._cache.vendedores = vendedores;
    this._parseCache(cfg);
    return this._cache;
  }

  _parseCache(c) {
    const p = parseJSON;
    this._cache.formasPagamento       = p(c.formas_pagamento, []);
    this._cache.taxasCartao           = p(c.taxas_cartao, []);
    this._cache.contasBancarias       = p(c.contas_bancarias, []);
    this._cache.categoriasFinanceiras = p(c.categorias_financeiras, {
      receitas: ["Impressão","Fachadas","Adesivos","Cartões","Brindes"],
      despesas: ["Energia","Aluguel","Tinta","Lona","Funcionários","Marketing"],
    });
    this._cache.etapasProducao = p(c.etapas_producao, [
      { nome:"Fila",        cor:"#868e96", icone:"⏳", ordem:1 },
      { nome:"Conferência", cor:"#ffa94d", icone:"🔍", ordem:2 },
      { nome:"Impressão",   cor:"#4dabf7", icone:"🖨️",  ordem:3 },
      { nome:"Recorte",     cor:"#a9e34b", icone:"✂️",  ordem:4 },
      { nome:"Acabamento",  cor:"#da77f2", icone:"🔧", ordem:5 },
      { nome:"Pronto",      cor:"#69db7c", icone:"✅", ordem:6 },
    ]);
    this._cache.maquinasProducao = p(c.maquinas_producao, []);
    this._cache.custosFixos      = p(c.custos_fixos, [
      { nome:"Aluguel", valor:0 },{ nome:"Energia", valor:0 },
      { nome:"Internet", valor:0 },{ nome:"Salários", valor:0 },
    ]);
    this._cache.categoriasProdutos = p(c.categorias_produtos, [
      "Adesivos","Lonas","Fachadas","Acrílico","PVC","Cartões","Banners","Brindes",
    ]);
    this._cache.unidadesProdutos = p(c.unidades_produtos, [
      { sigla:"m²", nome:"Metro quadrado" },{ sigla:"un", nome:"Unidade" },
      { sigla:"m",  nome:"Metro linear"   },{ sigla:"cm", nome:"Centímetro" },
      { sigla:"fl", nome:"Folha"          },{ sigla:"kg", nome:"Quilograma" },
    ]);
    this._cache.tabelasPreco = p(c.tabelas_preco, [
      { nome:"Varejo",  multiplicador:1.0  },
      { nome:"Atacado", multiplicador:0.85 },
      { nome:"Revenda", multiplicador:0.75 },
    ]);
    this._cache.fornecedores        = p(c.fornecedores, []);
    this._cache.categoriasMateriais = p(c.categorias_materiais, [
      "Lona","Vinil","PVC","Acrílico","Tinta","Papel","Insumos",
    ]);
    this._cache.unidadesEstoque = p(c.unidades_estoque, [
      { sigla:"m",  nome:"Metro"      },{ sigla:"m²", nome:"Metro²"    },
      { sigla:"fl", nome:"Folha"      },{ sigla:"L",  nome:"Litro"     },
      { sigla:"kg", nome:"Quilograma" },{ sigla:"un", nome:"Unidade"   },
    ]);
    this._cache.categoriasClientes   = p(c.categorias_clientes, [
      "Pessoa Física","Empresa","Revenda","VIP",
    ]);
    this._cache.camposCustomClientes = p(c.campos_custom_clientes, []);
    this._cache.perfisPermissao = p(c.perfis_permissao, [
      { nome:"Administrador", cor:"#ff6b6b",
        permissoes:{ editar_preco:true,  excluir_venda:true,  cancelar_pedido:true,  ver_lucro:true,  acessar_config:true,  ver_financeiro:true  } },
      { nome:"Vendedor",      cor:"#4dabf7",
        permissoes:{ editar_preco:false, excluir_venda:false, cancelar_pedido:false, ver_lucro:false, acessar_config:false, ver_financeiro:false } },
    ]);
  }

  async salvarEmpresa(patch) {
    await this.#global.upsertGlobal(patch);
    Object.assign(this._cache.cfg, patch);
    EventBus.emit("config:empresa_salva", patch);
  }

  async salvarJSON(campo, dados) {
    await this.#global.upsertGlobal({ [campo]: JSON.stringify(dados) });
    this._cache.cfg[campo] = JSON.stringify(dados);
    this._parseCache(this._cache.cfg);
    EventBus.emit(`config:${campo}_salvo`, dados);
  }

  async criarVendedor(payload)       { const r = await this.#vendedores.create(payload); this._cache.vendedores = await this.#vendedores.findOrdered(); return r; }
  async atualizarVendedor(id, patch) { const r = await this.#vendedores.update(id, patch); this._cache.vendedores = await this.#vendedores.findOrdered(); return r; }
  async deletarVendedor(id)          { await this.#vendedores.delete(id); this._cache.vendedores = await this.#vendedores.findOrdered(); }
}

// ════════════════════════════════════════════════════════════════════════════
// VIEW
// ════════════════════════════════════════════════════════════════════════════

const ABAS = [
  { key:"empresa",        emoji:"🏢", label:"Empresa"        },
  { key:"financeiro",     emoji:"💰", label:"Financeiro"     },
  { key:"precificacao",   emoji:"📈", label:"Precificação"   },
  { key:"producao",       emoji:"🏭", label:"Produção"       },
  { key:"orcamentos",     emoji:"🧾", label:"Orçamentos"     },
  { key:"produtos",       emoji:"📦", label:"Produtos"       },
  { key:"estoque",        emoji:"🗂️",  label:"Estoque"        },
  { key:"clientes",       emoji:"👥", label:"Clientes"       },
  { key:"usuarios",       emoji:"🔐", label:"Usuários"       },
  { key:"vendedores",     emoji:"👤", label:"Vendedores"     },
  { key:"impressao",      emoji:"🖨️",  label:"Impressão"      },
  { key:"integracoes",    emoji:"🔗", label:"Integrações"    },
  { key:"personalizacao", emoji:"🎨", label:"Personalização" },
  { key:"seguranca",      emoji:"🛡️",  label:"Segurança"      },
];

export class ConfiguracoesView extends BaseView {
  #svc;
  #state = { aba: "empresa", sub: {}, msg: null };

  constructor(container) {
    super(container);
    this.#svc = new ConfiguracoesService();
  }

  async mount(container) {
    if (container) this._container = container;
    this._container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Carregando configurações...</span>
      </div>`;
    await this.#svc.loadAll();
    this._render();
  }

  unmount() { this.cleanup?.(); this._container = null; }

  // ─── Scaffold principal ───────────────────────────────────────────────────
  _render() {
    this.cleanup();
    this._container.innerHTML = `
      <style>${cfgCss()}</style>
      <div class="cfg-wrap">
        <aside class="cfg-sidebar">
          <div class="cfg-sidebar-title">Configurações</div>
          ${ABAS.map(a => `
            <button class="cfg-nav-btn ${this.#state.aba === a.key ? "active" : ""}" data-aba="${a.key}">
              <span class="cfg-nav-emoji">${a.emoji}</span>
              <span>${a.label}</span>
            </button>`).join("")}
        </aside>
        <div class="cfg-body">
          <div id="cfg-content"></div>
          <div id="modal-area"></div>
        </div>
      </div>`;

    this._container.querySelectorAll("[data-aba]").forEach(btn =>
      this._on(btn, "click", () => {
        this.#state.aba = btn.dataset.aba;
        this.#state.msg = null;
        this._render();
      })
    );

    const content = this._container.querySelector("#cfg-content");
    this._renderAba(content);
  }

  // ─── Router de abas ───────────────────────────────────────────────────────
  _renderAba(content) {
    const map = {
      empresa:        () => this._abaEmpresa(content),
      financeiro:     () => this._abaFinanceiro(content),
      precificacao:   () => this._abaPrecificacao(content),
      producao:       () => this._abaProducao(content),
      orcamentos:     () => this._abaOrcamentos(content),
      produtos:       () => this._abaProdutos(content),
      estoque:        () => this._abaEstoque(content),
      clientes:       () => this._abaClientes(content),
      usuarios:       () => this._abaUsuarios(content),
      vendedores:     () => this._abaVendedores(content),
      impressao:      () => this._abaImpressao(content),
      integracoes:    () => this._abaIntegracoes(content),
      personalizacao: () => this._abaPersonalizacao(content),
      seguranca:      () => this._abaSeguranca(content),
    };
    map[this.#state.aba]?.();
  }

  // ─── Toast ────────────────────────────────────────────────────────────────
  _toast(tipo, texto) {
    const area = this._container?.querySelector(".cfg-body");
    if (!area) return;
    const existing = area.querySelector(".cfg-toast");
    if (existing) existing.remove();
    const t = document.createElement("div");
    t.className = `cfg-toast ${tipo}`;
    t.textContent = `${tipo === "ok" ? "✅" : "❌"} ${texto}`;
    area.prepend(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ─── Modal ────────────────────────────────────────────────────────────────
  _modal(html) {
    const area = this._container.querySelector("#modal-area");
    area.innerHTML = html;
    area.querySelector("#modal-bg")?.addEventListener("click", e => {
      if (e.target.id === "modal-bg") area.innerHTML = "";
    });
    return area;
  }

  // ─── Helpers de save ──────────────────────────────────────────────────────
  async _salvarEmpresa(patch) {
    try {
      await this.#svc.salvarEmpresa(patch);
      this._toast("ok", "Dados da empresa salvos!");
    } catch (e) {
      this._toast("erro", e.message);
    }
  }

  async _salvarJSON(campo, dados, msg = "Salvo!") {
    try {
      await this.#svc.salvarJSON(campo, dados);
      this._toast("ok", msg);
    } catch (e) {
      this._toast("erro", e.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ABA: EMPRESA (com upload de logo)
  // ──────────────────────────────────────────────────────────────────────────
  _abaEmpresa(content) {
    const c        = this.#svc._cache.cfg;
    const savedLogo = localStorage.getItem("empresa_logo_url") || c.empresa_logo_url || "";

    content.innerHTML = `
      <div class="cfg-section-title">🏢 Dados da Empresa</div>

      <!-- LOGO DA EMPRESA -->
      <div class="cfg-card" style="margin-bottom:14px">
        <div class="cfg-card-title">🖼️ Logo da Empresa</div>
        <div class="logo-upload-area">
          <div class="logo-preview-wrap" id="logo-preview-wrap">
            ${savedLogo
              ? `<img src="${esc(savedLogo)}" class="logo-preview-img" id="logo-preview-img" alt="Logo atual" />`
              : `<div class="logo-placeholder" id="logo-placeholder"><i class="fi fi-rr-picture"></i><span>Sem logo</span></div>`}
          </div>
          <div class="logo-controls">
            <p class="cfg-hint" style="margin-bottom:10px">
              A logo aparece na barra lateral do sistema, ao lado do nome da empresa.<br>
              Faça upload de um arquivo <strong>PNG, JPG ou SVG</strong> (recomendado: 100×100px).
            </p>
            <!-- Upload de arquivo -->
            <label class="btn-upload-logo" for="logo-file-input">
              <i class="fi fi-rr-upload"></i> Selecionar arquivo
            </label>
            <input type="file" id="logo-file-input" accept="image/png,image/jpeg,image/svg+xml,image/webp"
              style="display:none" />
            <div style="margin:10px 0;color:var(--muted);font-size:11px;text-align:center">— ou cole uma URL —</div>
            <!-- URL manual -->
            <div style="display:flex;gap:8px;align-items:center">
              <input id="e-logo" value="${esc(savedLogo)}"
                placeholder="https://meusite.com/logo.png" style="flex:1" />
              <button class="btn-primary" id="btn-salvar-logo" style="white-space:nowrap;padding:8px 14px;font-size:12px">
                <i class="fi fi-rr-check"></i> Aplicar
              </button>
            </div>
            ${savedLogo ? `
            <button class="btn-remover-logo" id="btn-remover-logo" style="margin-top:10px">
              <i class="fi fi-rr-trash"></i> Remover logo
            </button>` : ""}
          </div>
        </div>
      </div>

      <!-- DADOS DA EMPRESA -->
      <div class="cfg-card">
        <div class="cfg-card-title">📋 Informações Cadastrais</div>
        <div class="cfg-grid">
          <div class="cfg-group full"><label>Nome Fantasia *</label>
            <input id="e-nome" value="${esc(c.empresa_nome)}" placeholder="Gráfica Master Print" /></div>
          <div class="cfg-group full"><label>Razão Social</label>
            <input id="e-razao" value="${esc(c.empresa_razao_social)}" placeholder="Razão Social Ltda." /></div>
          <div class="cfg-group"><label>CNPJ</label>
            <input id="e-cnpj" value="${esc(c.empresa_cnpj)}" placeholder="00.000.000/0000-00" /></div>
          <div class="cfg-group"><label>Inscrição Estadual</label>
            <input id="e-ie" value="${esc(c.empresa_ie)}" placeholder="000.000.000.000" /></div>
          <div class="cfg-group"><label>Telefone</label>
            <input id="e-tel" value="${esc(c.empresa_telefone)}" placeholder="(11) 99999-9999" /></div>
          <div class="cfg-group"><label>WhatsApp</label>
            <input id="e-whats" value="${esc(c.empresa_whatsapp)}" placeholder="(11) 99999-9999" /></div>
          <div class="cfg-group"><label>E-mail</label>
            <input id="e-email" type="email" value="${esc(c.empresa_email)}" placeholder="contato@empresa.com" /></div>
          <div class="cfg-group"><label>Site / Instagram</label>
            <input id="e-site" value="${esc(c.empresa_site)}" placeholder="@empresa ou www.empresa.com" /></div>
          <div class="cfg-group full"><label>Endereço completo</label>
            <input id="e-end" value="${esc(c.empresa_endereco)}" placeholder="Rua Exemplo, 123 — Bairro — Cidade/UF" /></div>
          <div class="cfg-group full">
            <label>Observações padrão / Rodapé de orçamento</label>
            <textarea id="e-rodape" rows="3"
              placeholder="Ex: Validade: 15 dias. Prazo de produção: 3 dias úteis.">${esc(c.empresa_rodape)}</textarea>
          </div>
        </div>
        <div class="cfg-acoes">
          <button class="btn-primary" id="btn-salvar-empresa">
            <i class="fi fi-rr-disk"></i> Salvar dados da empresa
          </button>
        </div>
      </div>`;

    // ── Bind logo ──────────────────────────────────────────────────────────

    // Upload de arquivo → converte para base64 e aplica
    content.querySelector("#logo-file-input")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        content.querySelector("#e-logo").value = dataUrl;
        this._previewLogo(content, dataUrl);
      };
      reader.readAsDataURL(file);
    });

    // Aplicar URL manualmente digitada
    content.querySelector("#btn-salvar-logo")?.addEventListener("click", async () => {
      const url = content.querySelector("#e-logo")?.value.trim();
      await this._aplicarLogo(content, url);
    });

    // Enter na caixa de URL também aplica
    content.querySelector("#e-logo")?.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const url = e.target.value.trim();
        await this._aplicarLogo(content, url);
      }
    });

    // Remover logo
    content.querySelector("#btn-remover-logo")?.addEventListener("click", async () => {
      localStorage.removeItem("empresa_logo_url");
      updateSidebarLogo("", null);
      await this._salvarEmpresa({ empresa_logo_url: null });
      this._abaEmpresa(content);
    });

    // ── Bind dados empresa ─────────────────────────────────────────────────
    const g = id => content.querySelector(id)?.value?.trim() || null;
    content.querySelector("#btn-salvar-empresa")?.addEventListener("click", async () => {
      const nome = g("#e-nome");
      if (nome) {
        localStorage.setItem("empresa_nome", nome);
        const nomeEl = document.getElementById("sidebar-empresa-nome");
        if (nomeEl) nomeEl.textContent = nome;
      }
      await this._salvarEmpresa({
        empresa_nome:         nome,
        empresa_razao_social: g("#e-razao"),
        empresa_cnpj:         g("#e-cnpj"),
        empresa_ie:           g("#e-ie"),
        empresa_telefone:     g("#e-tel"),
        empresa_whatsapp:     g("#e-whats"),
        empresa_email:        g("#e-email"),
        empresa_site:         g("#e-site"),
        empresa_endereco:     g("#e-end"),
        empresa_rodape:       content.querySelector("#e-rodape")?.value?.trim() || null,
      });
    });
  }

  /** Exibe preview da logo no painel */
  _previewLogo(content, url) {
    const wrap    = content.querySelector("#logo-preview-wrap");
    const logoInp = content.querySelector("#e-logo");
    if (!wrap) return;
    if (logoInp) logoInp.value = url;

    if (url) {
      wrap.innerHTML = `<img src="${esc(url)}" class="logo-preview-img" id="logo-preview-img" alt="Prévia" />`;
    } else {
      wrap.innerHTML = `<div class="logo-placeholder" id="logo-placeholder"><i class="fi fi-rr-picture"></i><span>Sem logo</span></div>`;
    }
  }

  /** Aplica e salva a logo */
  async _aplicarLogo(content, url) {
    if (!url) {
      this._toast("erro", "Informe uma URL ou selecione um arquivo.");
      return;
    }
    this._previewLogo(content, url);
    localStorage.setItem("empresa_logo_url", url);
    updateSidebarLogo(url, null);
    await this._salvarEmpresa({ empresa_logo_url: url });
    // Atualiza botão de remover se não existia
    const logoControls = content.querySelector(".logo-controls");
    if (logoControls && !content.querySelector("#btn-remover-logo")) {
      const btnRemover = document.createElement("button");
      btnRemover.id        = "btn-remover-logo";
      btnRemover.className = "btn-remover-logo";
      btnRemover.style.marginTop = "10px";
      btnRemover.innerHTML = `<i class="fi fi-rr-trash"></i> Remover logo`;
      btnRemover.addEventListener("click", async () => {
        localStorage.removeItem("empresa_logo_url");
        updateSidebarLogo("", null);
        await this._salvarEmpresa({ empresa_logo_url: null });
        this._abaEmpresa(content);
      });
      logoControls.appendChild(btnRemover);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ABA: FINANCEIRO
  // ──────────────────────────────────────────────────────────────────────────
  _abaFinanceiro(content) {
    const sub = this.#state.sub.financeiro || "fp";
    const SUBS = [
      { key:"fp",     label:"💳 Formas de Pagamento" },
      { key:"cartao", label:"🏦 Taxas de Cartão"     },
      { key:"contas", label:"🏛️ Contas Bancárias"    },
      { key:"categ",  label:"📂 Categorias"           },
    ];
    content.innerHTML = `
      <div class="cfg-section-title">💰 Financeiro</div>
      <div class="sub-tabs">
        ${SUBS.map(s => `<button class="sub-tab ${sub===s.key?"active":""}" data-sub="${s.key}">${s.label}</button>`).join("")}
      </div>
      <div id="sub-content"></div>`;

    content.querySelectorAll("[data-sub]").forEach(btn =>
      btn.addEventListener("click", () => {
        this.#state.sub.financeiro = btn.dataset.sub;
        this._abaFinanceiro(content);
      })
    );

    const sc = content.querySelector("#sub-content");
    if (sub === "fp")     this._renderFormasPagamento(sc);
    if (sub === "cartao") this._renderTaxasCartao(sc);
    if (sub === "contas") this._renderContasBancarias(sc);
    if (sub === "categ")  this._renderCategoriasFinanceiras(sc);
  }

  _renderFormasPagamento(sc) {
    const fps = this.#svc._cache.formasPagamento;
    const DEFAULTS = ["Dinheiro","PIX","Cartão Débito","Cartão Crédito 1×","Cartão Crédito 2×","Cartão Crédito 3×","Cheque","Boleto","Transferência"];
    sc.innerHTML = `
      <div class="cfg-section-header" style="margin-top:14px">
        <span class="cfg-hint" style="margin:0">Formas de pagamento aceitas pelos clientes.</span>
        <button class="btn-primary" id="btn-add-fp">+ Adicionar</button>
      </div>
      <div class="cfg-card" style="margin-top:10px">
        ${fps.length===0 ? `<div class="cfg-vazio">Nenhuma forma cadastrada.</div>` : ""}
        ${fps.map((f,i) => `
          <div class="categ-item">
            <span>${esc(f.nome||f)}</span>
            <button class="btn-icon danger" data-del-fp="${i}">🗑</button>
          </div>`).join("")}
        <div style="margin-top:12px">
          <div class="cfg-hint">Sugestões rápidas:</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${DEFAULTS.filter(d=>!fps.some(f=>(f.nome||f)===d)).map(d=>
              `<button class="btn-icon" data-quick-fp="${encodeURIComponent(d)}">${d}</button>`).join("")}
          </div>
        </div>
      </div>`;

    sc.querySelector("#btn-add-fp").addEventListener("click", async () => {
      const nome = prompt("Nome da forma de pagamento:");
      if (!nome?.trim()) return;
      this.#svc._cache.formasPagamento.push({ nome: nome.trim() });
      await this._salvarJSON("formas_pagamento", this.#svc._cache.formasPagamento, "Forma de pagamento adicionada!");
      this._abaFinanceiro(sc.closest("#cfg-content"));
    });
    sc.querySelectorAll("[data-del-fp]").forEach(b =>
      b.addEventListener("click", async () => {
        this.#svc._cache.formasPagamento.splice(parseInt(b.dataset.delFp),1);
        await this._salvarJSON("formas_pagamento",this.#svc._cache.formasPagamento,"Removida.");
        this._abaFinanceiro(sc.closest("#cfg-content"));
      })
    );
    sc.querySelectorAll("[data-quick-fp]").forEach(b =>
      b.addEventListener("click", async () => {
        const nome = decodeURIComponent(b.dataset.quickFp);
        this.#svc._cache.formasPagamento.push({ nome });
        await this._salvarJSON("formas_pagamento",this.#svc._cache.formasPagamento,`"${nome}" adicionado!`);
        this._abaFinanceiro(sc.closest("#cfg-content"));
      })
    );
  }

  _renderTaxasCartao(sc) {
    const taxas = this.#svc._cache.taxasCartao;
    sc.innerHTML = `
      <div class="cfg-section-header" style="margin-top:14px">
        <span class="cfg-hint" style="margin:0">Taxas por maquininha e parcelamento.</span>
        <button class="btn-primary" id="btn-add-tc">+ Nova Taxa</button>
      </div>
      <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
        ${taxas.length===0 ? `<div class="cfg-vazio">Nenhuma taxa cadastrada.</div>` :
        `<table class="cfg-table"><thead><tr>
          <th>Máquina</th><th>Bandeira</th><th>Débito</th><th>Créd.1×</th><th>Créd.2×</th><th>Créd.3×</th><th>Prazo</th><th></th>
        </tr></thead><tbody>
          ${taxas.map((t,i)=>`<tr>
            <td><strong>${esc(t.maquina)}</strong></td>
            <td><span class="tag-cargo">${esc(t.bandeira||"Todas")}</span></td>
            <td>${t.debito||0}%</td><td>${t.credito_1||0}%</td><td>${t.credito_2||0}%</td>
            <td>${t.credito_3||0}%</td><td>${t.prazo_dias?t.prazo_dias+"d":"—"}</td>
            <td class="tbl-acoes">
              <button class="btn-icon" data-edit-tc="${i}">✏️</button>
              <button class="btn-icon danger" data-del-tc="${i}">🗑</button>
            </td>
          </tr>`).join("")}
        </tbody></table>`}
      </div>`;

    sc.querySelector("#btn-add-tc").addEventListener("click",()=>this._modalTaxaCartao(null));
    sc.querySelectorAll("[data-edit-tc]").forEach(b=>b.addEventListener("click",()=>this._modalTaxaCartao(parseInt(b.dataset.editTc))));
    sc.querySelectorAll("[data-del-tc]").forEach(b=>b.addEventListener("click",async()=>{
      this.#svc._cache.taxasCartao.splice(parseInt(b.dataset.delTc),1);
      await this._salvarJSON("taxas_cartao",this.#svc._cache.taxasCartao,"Taxa removida.");
      this._abaFinanceiro(sc.closest("#cfg-content"));
    }));
  }

  _modalTaxaCartao(idx) {
    const taxas = this.#svc._cache.taxasCartao;
    const t     = idx!==null?taxas[idx]:{};
    const MAQUINAS  = ["PagSeguro","Cielo","Stone","Rede","Mercado Pago","GetNet","Sumup","InfinitePay","Outro"];
    const BANDEIRAS = ["Todas","Visa","Mastercard","Elo","American Express","Hipercard"];
    const area = this._modal(`
      <div class="modal-bg" id="modal-bg"><div class="modal" style="max-width:460px">
        <h3>${idx!==null?"Editar":"Nova"} Taxa de Cartão</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label>Máquina *</label>
            <select id="tc-maq">${MAQUINAS.map(m=>`<option value="${m}" ${t.maquina===m?"selected":""}>${m}</option>`).join("")}</select></div>
          <div><label>Bandeira</label>
            <select id="tc-band">${BANDEIRAS.map(b=>`<option value="${b}" ${(t.bandeira||"Todas")===b?"selected":""}>${b}</option>`).join("")}</select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
          <div><label>Débito %</label><input id="tc-deb" type="number" step="0.01" value="${t.debito||""}" placeholder="1.5"/></div>
          <div><label>Créd. 1×%</label><input id="tc-c1" type="number" step="0.01" value="${t.credito_1||""}" placeholder="2.5"/></div>
          <div><label>Créd. 2×%</label><input id="tc-c2" type="number" step="0.01" value="${t.credito_2||""}" placeholder="3"/></div>
          <div><label>Créd. 3×%</label><input id="tc-c3" type="number" step="0.01" value="${t.credito_3||""}" placeholder="3.5"/></div>
          <div><label>Créd. 6×%</label><input id="tc-c6" type="number" step="0.01" value="${t.credito_6||""}" placeholder="4.5"/></div>
          <div><label>Prazo dias</label><input id="tc-prazo" type="number" value="${t.prazo_dias||""}" placeholder="30"/></div>
        </div>
        <div class="modal-btns">
          <button class="btn-secondary" id="tc-cancel">Cancelar</button>
          <button class="btn-primary" id="tc-ok">Salvar</button>
        </div>
      </div></div>`);
    area.querySelector("#tc-cancel").addEventListener("click",()=>area.innerHTML="");
    area.querySelector("#tc-ok").addEventListener("click",async()=>{
      const dados={
        maquina:area.querySelector("#tc-maq").value,bandeira:area.querySelector("#tc-band").value,
        debito:parseFloat(area.querySelector("#tc-deb").value)||0,
        credito_1:parseFloat(area.querySelector("#tc-c1").value)||0,
        credito_2:parseFloat(area.querySelector("#tc-c2").value)||0,
        credito_3:parseFloat(area.querySelector("#tc-c3").value)||0,
        credito_6:parseFloat(area.querySelector("#tc-c6").value)||0,
        prazo_dias:parseInt(area.querySelector("#tc-prazo").value)||null,
      };
      if(idx!==null)taxas[idx]=dados;else taxas.push(dados);
      area.innerHTML="";
      await this._salvarJSON("taxas_cartao",taxas,idx!==null?"Taxa atualizada!":"Taxa adicionada!");
      this._abaFinanceiro(this._container.querySelector("#cfg-content"));
    });
  }

  _renderContasBancarias(sc) {
    const cb = this.#svc._cache.contasBancarias;
    sc.innerHTML = `
      <div class="cfg-section-header" style="margin-top:14px">
        <span class="cfg-hint" style="margin:0">Contas usadas nos lançamentos financeiros.</span>
        <button class="btn-primary" id="btn-nova-cb">+ Adicionar</button>
      </div>
      <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
        ${cb.length===0?`<div class="cfg-vazio">Nenhuma conta cadastrada.</div>`:
        `<table class="cfg-table"><thead><tr><th>Banco</th><th>Tipo</th><th>Agência</th><th>Conta</th><th>Saldo Inicial</th><th></th></tr></thead>
        <tbody>${cb.map((c,i)=>`<tr>
          <td><strong>${esc(c.banco)}</strong></td>
          <td><span class="tag-cargo">${esc(c.tipo)||"—"}</span></td>
          <td>${esc(c.agencia)||"—"}</td><td>${esc(c.conta)||"—"}</td>
          <td>R$ ${Number(c.saldo_inicial||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td>
          <td class="tbl-acoes">
            <button class="btn-icon" data-edit-cb="${i}">✏️</button>
            <button class="btn-icon danger" data-del-cb="${i}">🗑</button>
          </td></tr>`).join("")}
        </tbody></table>`}
      </div>`;
    sc.querySelector("#btn-nova-cb").addEventListener("click",()=>this._modalCB(null));
    sc.querySelectorAll("[data-edit-cb]").forEach(b=>b.addEventListener("click",()=>this._modalCB(parseInt(b.dataset.editCb))));
    sc.querySelectorAll("[data-del-cb]").forEach(b=>b.addEventListener("click",async()=>{
      this.#svc._cache.contasBancarias.splice(parseInt(b.dataset.delCb),1);
      await this._salvarJSON("contas_bancarias",this.#svc._cache.contasBancarias,"Conta removida.");
      this._abaFinanceiro(sc.closest("#cfg-content"));
    }));
  }

  _modalCB(idx) {
    const cb=this.#svc._cache.contasBancarias; const c=idx!==null?cb[idx]:{};
    const area=this._modal(`
      <div class="modal-bg" id="modal-bg"><div class="modal">
        <h3>${idx!==null?"Editar":"Nova"} Conta Bancária</h3>
        <label>Banco *</label><input id="cb-banco" value="${esc(c.banco||"")}" placeholder="Ex: Nubank, Itaú..." autofocus/>
        <label>Tipo</label>
        <select id="cb-tipo">${["Corrente","Poupança","Pagamento","Caixa","Outro"].map(t=>`<option value="${t}" ${c.tipo===t?"selected":""}>${t}</option>`).join("")}</select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label>Agência</label><input id="cb-ag" value="${esc(c.agencia||"")}" placeholder="0000-0"/></div>
          <div><label>Conta</label><input id="cb-conta" value="${esc(c.conta||"")}" placeholder="00000-0"/></div>
        </div>
        <label>Saldo inicial (R$)</label><input id="cb-saldo" type="number" step="0.01" value="${c.saldo_inicial||0}"/>
        <div class="modal-btns">
          <button class="btn-secondary" id="cb-cancel">Cancelar</button>
          <button class="btn-primary" id="cb-ok">Salvar</button>
        </div>
      </div></div>`);
    area.querySelector("#cb-cancel").addEventListener("click",()=>area.innerHTML="");
    area.querySelector("#cb-ok").addEventListener("click",async()=>{
      const banco=area.querySelector("#cb-banco").value.trim();
      if(!banco){alert("Informe o banco.");return;}
      const dados={banco,tipo:area.querySelector("#cb-tipo").value,
        agencia:area.querySelector("#cb-ag").value.trim()||null,
        conta:area.querySelector("#cb-conta").value.trim()||null,
        saldo_inicial:parseFloat(area.querySelector("#cb-saldo").value)||0};
      if(idx!==null)cb[idx]=dados;else cb.push(dados);
      area.innerHTML="";
      await this._salvarJSON("contas_bancarias",cb,idx!==null?"Conta atualizada!":"Conta adicionada!");
      this._abaFinanceiro(this._container.querySelector("#cfg-content"));
    });
  }

  _renderCategoriasFinanceiras(sc) {
    const cat=this.#svc._cache.categoriasFinanceiras;
    const lista=(tipo,titulo)=>`
      <div class="cfg-card">
        <div class="cfg-card-title">${titulo}</div>
        ${cat[tipo].map((c,i)=>`
          <div class="categ-item"><span>${esc(c)}</span>
            <button class="btn-icon danger" data-del-${tipo}="${i}">🗑</button>
          </div>`).join("")}
        <button class="btn-primary" id="btn-add-${tipo}" style="margin-top:10px;width:100%">+ Adicionar</button>
      </div>`;
    sc.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
      ${lista("receitas","📥 Receitas")}${lista("despesas","📤 Despesas")}</div>`;
    ["receitas","despesas"].forEach(tipo=>{
      sc.querySelector(`#btn-add-${tipo}`).addEventListener("click",async()=>{
        const nome=prompt(`Nova categoria de ${tipo}:`);
        if(!nome?.trim())return;
        cat[tipo].push(nome.trim());
        await this._salvarJSON("categorias_financeiras",cat,"Categoria adicionada!");
        this._renderCategoriasFinanceiras(sc);
      });
      sc.querySelectorAll(`[data-del-${tipo}]`).forEach(b=>b.addEventListener("click",async()=>{
        cat[tipo].splice(parseInt(b.dataset[`del${tipo.charAt(0).toUpperCase()+tipo.slice(1)}`]),1);
        await this._salvarJSON("categorias_financeiras",cat,"Removida.");
        this._renderCategoriasFinanceiras(sc);
      }));
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ABA: PRECIFICAÇÃO
  // ──────────────────────────────────────────────────────────────────────────
  _abaPrecificacao(content) {
    const c=this.#svc._cache.cfg; const tp=this.#svc._cache.tabelasPreco;
    content.innerHTML=`
      <div class="cfg-section-title">📈 Precificação</div>
      <div class="cfg-card">
        <div class="cfg-card-title">Margem e Markup Padrão</div>
        <div class="cfg-grid">
          <div class="cfg-group"><label>Margem mínima (%)</label>
            <input id="p-margem" type="number" min="0" step="0.1" value="${c.margem_minima||20}"/></div>
          <div class="cfg-group"><label>Markup padrão (×)</label>
            <input id="p-markup" type="number" min="1" step="0.01" value="${c.markup_padrao||1.5}"/></div>
          <div class="cfg-group"><label>Desconto máximo (%)</label>
            <input id="p-desc" type="number" min="0" max="100" value="${c.desconto_maximo||15}"/></div>
        </div>
        <div class="cfg-acoes"><button class="btn-primary" id="btn-salvar-prec">💾 Salvar</button></div>
      </div>
      <div class="cfg-card" style="margin-top:14px">
        <div class="cfg-section-header">
          <div class="cfg-card-title" style="margin:0">Tabelas de Preço</div>
          <button class="btn-primary" id="btn-add-tp">+ Nova Tabela</button>
        </div>
        <div id="tp-lista">
          ${tp.map((t,i)=>`<div class="categ-item">
            <div><strong>${esc(t.nome)}</strong><span style="font-size:11px;color:var(--muted);margin-left:8px">×${t.multiplicador}</span></div>
            <div style="display:flex;gap:5px">
              <button class="btn-icon" data-edit-tp="${i}">✏️</button>
              <button class="btn-icon danger" data-del-tp="${i}">🗑</button>
            </div>
          </div>`).join("")}
        </div>
      </div>`;
    const g=id=>content.querySelector(id)?.value;
    content.querySelector("#btn-salvar-prec").addEventListener("click",()=>
      this._salvarEmpresa({margem_minima:parseFloat(g("#p-margem"))||null,markup_padrao:parseFloat(g("#p-markup"))||null,desconto_maximo:parseFloat(g("#p-desc"))||null}));
    content.querySelector("#btn-add-tp").addEventListener("click",()=>this._modalTabelaPreco(null));
    content.querySelectorAll("[data-edit-tp]").forEach(b=>b.addEventListener("click",()=>this._modalTabelaPreco(parseInt(b.dataset.editTp))));
    content.querySelectorAll("[data-del-tp]").forEach(b=>b.addEventListener("click",async()=>{
      tp.splice(parseInt(b.dataset.delTp),1);
      await this._salvarJSON("tabelas_preco",tp,"Removida.");
      this._abaPrecificacao(content);
    }));
  }

  _modalTabelaPreco(idx) {
    const tp=this.#svc._cache.tabelasPreco; const t=idx!==null?tp[idx]:{};
    const area=this._modal(`<div class="modal-bg" id="modal-bg"><div class="modal" style="max-width:340px">
      <h3>${idx!==null?"Editar":"Nova"} Tabela de Preço</h3>
      <label>Nome *</label><input id="tp-nome" value="${esc(t.nome||"")}" placeholder="Ex: Varejo, Atacado..." autofocus/>
      <label>Multiplicador *</label><input id="tp-mult" type="number" min="0.1" step="0.01" value="${t.multiplicador||1}"/>
      <div class="modal-btns">
        <button class="btn-secondary" id="tp-cancel">Cancelar</button>
        <button class="btn-primary" id="tp-ok">Salvar</button>
      </div></div></div>`);
    area.querySelector("#tp-cancel").addEventListener("click",()=>area.innerHTML="");
    area.querySelector("#tp-ok").addEventListener("click",async()=>{
      const nome=area.querySelector("#tp-nome").value.trim();
      if(!nome){alert("Informe o nome.");return;}
      const dados={nome,multiplicador:parseFloat(area.querySelector("#tp-mult").value)||1};
      if(idx!==null)tp[idx]=dados;else tp.push(dados);
      area.innerHTML="";
      await this._salvarJSON("tabelas_preco",tp,"Tabela salva!");
      this._abaPrecificacao(this._container.querySelector("#cfg-content"));
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ABA: PRODUÇÃO
  // ──────────────────────────────────────────────────────────────────────────
  _abaProducao(content) {
    const etapas=this.#svc._cache.etapasProducao; const maquinas=this.#svc._cache.maquinasProducao;
    content.innerHTML=`
      <div class="cfg-section-title">🏭 Produção</div>
      <div class="cfg-section-header">
        <div class="cfg-card-title">Etapas do Kanban</div>
        <button class="btn-primary" id="btn-nova-etapa">+ Nova Etapa</button>
      </div>
      <div class="cfg-card" style="margin-bottom:14px">
        ${etapas.map((e,i)=>`<div class="etapa-row">
          <div class="etapa-ordem">
            <button class="btn-icon" ${i===0?"disabled":""} data-up="${i}">▲</button>
            <span class="etapa-num">${e.ordem||i+1}</span>
            <button class="btn-icon" ${i===etapas.length-1?"disabled":""} data-dn="${i}">▼</button>
          </div>
          <div class="etapa-icone">${e.icone||"📋"}</div>
          <div style="flex:1"><div class="etapa-nome">${esc(e.nome)}</div></div>
          <div style="width:20px;height:20px;border-radius:50%;background:${e.cor||"#aaa"};flex-shrink:0"></div>
          <div style="display:flex;gap:5px">
            <button class="btn-icon" data-edit-etapa="${i}">✏️</button>
            <button class="btn-icon danger" data-del-etapa="${i}">🗑</button>
          </div>
        </div>`).join("")}
      </div>
      <div class="cfg-section-header">
        <div class="cfg-card-title">Máquinas de Produção</div>
        <button class="btn-primary" id="btn-nova-maq">+ Nova Máquina</button>
      </div>
      <div class="cfg-card">
        ${maquinas.length===0?`<div class="cfg-vazio">Nenhuma máquina cadastrada.</div>`:
        maquinas.map((m,i)=>`<div class="categ-item">
          <div><strong>${esc(m.nome)}</strong>${m.tipo?` <span style="font-size:11px;color:var(--muted)">· ${esc(m.tipo)}</span>`:""}</div>
          <div style="display:flex;gap:5px">
            <button class="btn-icon" data-edit-maq="${i}">✏️</button>
            <button class="btn-icon danger" data-del-maq="${i}">🗑</button>
          </div>
        </div>`).join("")}
      </div>`;

    content.querySelector("#btn-nova-etapa").addEventListener("click",()=>this._modalEtapa(null));
    content.querySelectorAll("[data-edit-etapa]").forEach(b=>b.addEventListener("click",()=>this._modalEtapa(parseInt(b.dataset.editEtapa))));
    content.querySelectorAll("[data-del-etapa]").forEach(b=>b.addEventListener("click",async()=>{
      etapas.splice(parseInt(b.dataset.delEtapa),1);etapas.forEach((e,i)=>e.ordem=i+1);
      await this._salvarJSON("etapas_producao",etapas,"Etapa removida.");this._abaProducao(content);
    }));
    content.querySelectorAll("[data-up],[data-dn]").forEach(b=>b.addEventListener("click",async()=>{
      const i=parseInt(b.dataset.up??b.dataset.dn);const dir=b.dataset.up!==undefined?-1:1;const j=i+dir;
      [etapas[i],etapas[j]]=[etapas[j],etapas[i]];etapas.forEach((e,idx)=>e.ordem=idx+1);
      await this._salvarJSON("etapas_producao",etapas,"Ordem salva!");this._abaProducao(content);
    }));
    content.querySelector("#btn-nova-maq").addEventListener("click",()=>this._modalMaquina(null));
    content.querySelectorAll("[data-edit-maq]").forEach(b=>b.addEventListener("click",()=>this._modalMaquina(parseInt(b.dataset.editMaq))));
    content.querySelectorAll("[data-del-maq]").forEach(b=>b.addEventListener("click",async()=>{
      maquinas.splice(parseInt(b.dataset.delMaq),1);
      await this._salvarJSON("maquinas_producao",maquinas,"Removida.");this._abaProducao(content);
    }));
  }

  _modalEtapa(idx) {
    const etapas=this.#svc._cache.etapasProducao; const e=idx!==null?etapas[idx]:{};
    const area=this._modal(`<div class="modal-bg" id="modal-bg"><div class="modal" style="max-width:360px">
      <h3>${idx!==null?"Editar":"Nova"} Etapa</h3>
      <label>Nome *</label><input id="et-nome" value="${esc(e.nome||"")}" placeholder="Ex: Impressão..." autofocus/>
      <label>Ícone (emoji)</label><input id="et-icone" value="${esc(e.icone||"")}" placeholder="🖨️" style="font-size:20px" maxlength="4"/>
      <label>Cor</label><input id="et-cor" type="color" value="${e.cor||"#4dabf7"}" style="width:60px;height:36px;padding:2px;border:1px solid var(--border-md);border-radius:6px"/>
      <div class="modal-btns">
        <button class="btn-secondary" id="et-cancel">Cancelar</button>
        <button class="btn-primary" id="et-ok">Salvar</button>
      </div></div></div>`);
    area.querySelector("#et-cancel").addEventListener("click",()=>area.innerHTML="");
    area.querySelector("#et-ok").addEventListener("click",async()=>{
      const nome=area.querySelector("#et-nome").value.trim();
      if(!nome){alert("Informe o nome.");return;}
      const dados={nome,icone:area.querySelector("#et-icone").value.trim()||"📋",cor:area.querySelector("#et-cor").value,ordem:idx!==null?etapas[idx].ordem:etapas.length+1};
      if(idx!==null)etapas[idx]=dados;else etapas.push(dados);
      area.innerHTML="";
      await this._salvarJSON("etapas_producao",etapas,"Etapa salva!");
      this._abaProducao(this._container.querySelector("#cfg-content"));
    });
  }

  _modalMaquina(idx) {
    const maquinas=this.#svc._cache.maquinasProducao; const m=idx!==null?maquinas[idx]:{};
    const area=this._modal(`<div class="modal-bg" id="modal-bg"><div class="modal" style="max-width:360px">
      <h3>${idx!==null?"Editar":"Nova"} Máquina</h3>
      <label>Nome *</label><input id="mq-nome" value="${esc(m.nome||"")}" placeholder="Ex: Plotter HP Designjet" autofocus/>
      <label>Tipo</label>
      <select id="mq-tipo">${["Impressora","Plotter de Recorte","Laminadora","Guilhotina","Outro"].map(t=>`<option value="${t}" ${m.tipo===t?"selected":""}>${t}</option>`).join("")}</select>
      <label>Observações</label><textarea id="mq-obs" rows="2">${esc(m.observacoes||"")}</textarea>
      <div class="modal-btns">
        <button class="btn-secondary" id="mq-cancel">Cancelar</button>
        <button class="btn-primary" id="mq-ok">Salvar</button>
      </div></div></div>`);
    area.querySelector("#mq-cancel").addEventListener("click",()=>area.innerHTML="");
    area.querySelector("#mq-ok").addEventListener("click",async()=>{
      const nome=area.querySelector("#mq-nome").value.trim();
      if(!nome){alert("Informe o nome.");return;}
      const dados={nome,tipo:area.querySelector("#mq-tipo").value,observacoes:area.querySelector("#mq-obs").value};
      if(idx!==null)maquinas[idx]=dados;else maquinas.push(dados);
      area.innerHTML="";
      await this._salvarJSON("maquinas_producao",maquinas,"Máquina salva!");
      this._abaProducao(this._container.querySelector("#cfg-content"));
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ABAS GENÉRICAS (Orçamentos, Produtos, Estoque, Clientes, etc.)
  // ──────────────────────────────────────────────────────────────────────────
  _abaOrcamentos(content) {
    const c=this.#svc._cache.cfg;
    content.innerHTML=`
      <div class="cfg-section-title">🧾 Configurações de Orçamentos</div>
      <div class="cfg-card">
        <div class="cfg-grid">
          <div class="cfg-group"><label>Validade padrão (dias)</label><input id="orc-val" type="number" value="${c.orcamento_validade||15}"/></div>
          <div class="cfg-group"><label>Próximo número</label><input id="orc-num" type="number" value="${c.orcamento_proximo_numero||1}"/></div>
          <div class="cfg-group"><label>Prefixo</label><input id="orc-pre" value="${esc(c.orcamento_prefixo||"ORC-")}" placeholder="ORC-"/></div>
          <div class="cfg-group"><label>Status padrão</label>
            <select id="orc-st">${["rascunho","enviado","aprovado"].map(s=>`<option value="${s}" ${c.orcamento_status_padrao===s?"selected":""}>${s}</option>`).join("")}</select></div>
          <div class="cfg-group full"><label>Observações padrão</label><textarea id="orc-obs" rows="3">${esc(c.orcamento_observacoes)}</textarea></div>
        </div>
        <div class="cfg-acoes"><button class="btn-primary" id="btn-salvar-orc">💾 Salvar</button></div>
      </div>`;
    const g=id=>content.querySelector(id)?.value;
    content.querySelector("#btn-salvar-orc").addEventListener("click",()=>
      this._salvarEmpresa({orcamento_validade:parseInt(g("#orc-val"))||15,orcamento_proximo_numero:parseInt(g("#orc-num"))||1,orcamento_prefixo:g("#orc-pre")||"ORC-",orcamento_status_padrao:g("#orc-st"),orcamento_observacoes:g("#orc-obs")}));
  }

  _abaProdutos(content) {
    const cats=this.#svc._cache.categoriasProdutos;
    content.innerHTML=`
      <div class="cfg-section-title">📦 Configurações de Produtos</div>
      <div class="cfg-card">
        <div class="cfg-section-header"><div class="cfg-card-title">Categorias de Produtos</div><button class="btn-primary" id="btn-add-cp">+ Adicionar</button></div>
        ${cats.map((c,i)=>`<div class="categ-item"><span>${esc(c)}</span><button class="btn-icon danger" data-del-cp="${i}">🗑</button></div>`).join("")}
      </div>`;
    content.querySelector("#btn-add-cp").addEventListener("click",async()=>{const nome=prompt("Nova categoria:");if(!nome?.trim())return;cats.push(nome.trim());await this._salvarJSON("categorias_produtos",cats,"Adicionada!");this._abaProdutos(content);});
    content.querySelectorAll("[data-del-cp]").forEach(b=>b.addEventListener("click",async()=>{cats.splice(parseInt(b.dataset.delCp),1);await this._salvarJSON("categorias_produtos",cats,"Removida.");this._abaProdutos(content);}));
  }

  _abaEstoque(content) {
    const cats=this.#svc._cache.categoriasMateriais;
    content.innerHTML=`
      <div class="cfg-section-title">🗂️ Configurações de Estoque</div>
      <div class="cfg-card">
        <div class="cfg-section-header"><div class="cfg-card-title">Categorias de Materiais</div><button class="btn-primary" id="btn-add-cm">+ Adicionar</button></div>
        ${cats.map((c,i)=>`<div class="categ-item"><span>${esc(c)}</span><button class="btn-icon danger" data-del-cm="${i}">🗑</button></div>`).join("")}
      </div>`;
    content.querySelector("#btn-add-cm").addEventListener("click",async()=>{const nome=prompt("Nova categoria:");if(!nome?.trim())return;cats.push(nome.trim());await this._salvarJSON("categorias_materiais",cats,"Adicionada!");this._abaEstoque(content);});
    content.querySelectorAll("[data-del-cm]").forEach(b=>b.addEventListener("click",async()=>{cats.splice(parseInt(b.dataset.delCm),1);await this._salvarJSON("categorias_materiais",cats,"Removida.");this._abaEstoque(content);}));
  }

  _abaClientes(content) {
    const cats=this.#svc._cache.categoriasClientes;
    content.innerHTML=`
      <div class="cfg-section-title">👥 Configurações de Clientes</div>
      <div class="cfg-card">
        <div class="cfg-section-header"><div class="cfg-card-title">Categorias de Clientes</div><button class="btn-primary" id="btn-add-cc">+ Adicionar</button></div>
        ${cats.map((c,i)=>`<div class="categ-item"><span>${esc(c)}</span><button class="btn-icon danger" data-del-cc="${i}">🗑</button></div>`).join("")}
      </div>`;
    content.querySelector("#btn-add-cc").addEventListener("click",async()=>{const nome=prompt("Nova categoria:");if(!nome?.trim())return;cats.push(nome.trim());await this._salvarJSON("categorias_clientes",cats,"Adicionada!");this._abaClientes(content);});
    content.querySelectorAll("[data-del-cc]").forEach(b=>b.addEventListener("click",async()=>{cats.splice(parseInt(b.dataset.delCc),1);await this._salvarJSON("categorias_clientes",cats,"Removida.");this._abaClientes(content);}));
  }

  _abaVendedores(content) {
    const vends=this.#svc._cache.vendedores;
    content.innerHTML=`
      <div class="cfg-section-title">👤 Vendedores</div>
      <div class="cfg-section-header">
        <span class="cfg-hint" style="margin:0">Vendedores vinculados às vendas.</span>
        <button class="btn-primary" id="btn-novo-vend">+ Novo Vendedor</button>
      </div>
      <div class="cfg-card" style="padding:0;overflow:hidden;margin-top:10px">
        ${vends.length===0?`<div class="cfg-vazio">Nenhum vendedor cadastrado.</div>`:
        `<table class="cfg-table"><thead><tr><th>Nome</th><th>Cargo</th><th>Telefone</th><th>Comissão</th><th>Status</th><th></th></tr></thead>
        <tbody>${vends.map(v=>`<tr>
          <td><strong>${esc(v.nome)}</strong></td>
          <td><span class="tag-cargo">${esc(v.cargo||"Vendedor")}</span></td>
          <td>${esc(v.telefone)||"—"}</td>
          <td>${v.comissao_pct?v.comissao_pct+"%":"—"}</td>
          <td><span class="tag-status ${v.ativo!==false?"ativo":"inativo"}">${v.ativo!==false?"● Ativo":"○ Inativo"}</span></td>
          <td class="tbl-acoes">
            <button class="btn-icon" data-edit-v="${v.id}">✏️</button>
            <button class="btn-icon danger" data-del-v="${v.id}" data-del-vn="${esc(v.nome)}">🗑</button>
          </td></tr>`).join("")}
        </tbody></table>`}
      </div>`;

    content.querySelector("#btn-novo-vend").addEventListener("click",()=>this._modalVendedor(null));
    content.querySelectorAll("[data-edit-v]").forEach(b=>{const v=vends.find(x=>x.id===b.dataset.editV);b.addEventListener("click",()=>this._modalVendedor(v));});
    content.querySelectorAll("[data-del-v]").forEach(b=>b.addEventListener("click",async()=>{
      if(!confirm(`Remover "${b.dataset.delVn}"?`))return;
      await this.#svc.deletarVendedor(b.dataset.delV);
      this._abaVendedores(content);this._toast("ok","Vendedor removido.");
    }));
  }

  _modalVendedor(vend=null) {
    const editando=!!vend?.id; const v=vend||{};
    const area=this._modal(`<div class="modal-bg" id="modal-bg"><div class="modal">
      <h3>${editando?"Editar":"Novo"} Vendedor</h3>
      <label>Nome *</label><input id="vd-nome" value="${esc(v.nome||"")}" placeholder="Nome completo" autofocus/>
      <label>Cargo</label>
      <select id="vd-cargo">${["Vendedor","Atendente","Representante","Gerente","Sócio"].map(c=>`<option value="${c}" ${v.cargo===c?"selected":""}>${c}</option>`).join("")}</select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label>Telefone</label><input id="vd-tel" value="${esc(v.telefone||"")}" placeholder="(11) 99999-9999"/></div>
        <div><label>E-mail</label><input id="vd-email" type="email" value="${esc(v.email||"")}" placeholder="nome@email.com"/></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label>Comissão (%)</label><input id="vd-com" type="number" min="0" step="0.1" value="${v.comissao_pct||""}" placeholder="5.0"/></div>
        <div><label>Status</label>
          <select id="vd-ativo">
            <option value="true" ${v.ativo!==false?"selected":""}>● Ativo</option>
            <option value="false" ${v.ativo===false?"selected":""}>○ Inativo</option>
          </select>
        </div>
      </div>
      <div class="modal-btns">
        <button class="btn-secondary" id="vd-cancel">Cancelar</button>
        <button class="btn-primary" id="vd-ok">Salvar</button>
      </div></div></div>`);
    area.querySelector("#vd-cancel").addEventListener("click",()=>area.innerHTML="");
    area.querySelector("#vd-ok").addEventListener("click",async()=>{
      const nome=area.querySelector("#vd-nome").value.trim();
      if(!nome){alert("Informe o nome.");return;}
      const payload={nome,cargo:area.querySelector("#vd-cargo").value,telefone:area.querySelector("#vd-tel").value.trim()||null,email:area.querySelector("#vd-email").value.trim()||null,comissao_pct:parseFloat(area.querySelector("#vd-com").value)||null,ativo:area.querySelector("#vd-ativo").value==="true"};
      try{
        if(editando)await this.#svc.atualizarVendedor(vend.id,payload);else await this.#svc.criarVendedor(payload);
        area.innerHTML="";this._toast("ok",editando?"Vendedor atualizado!":"Vendedor cadastrado!");
        this._abaVendedores(this._container.querySelector("#cfg-content"));
      }catch(e){alert(e.message);}
    });
  }

  _abaUsuarios(content) {
    const perfis=this.#svc._cache.perfisPermissao;
    const PERMS=[{key:"editar_preco",label:"Editar preços"},{key:"excluir_venda",label:"Excluir vendas"},{key:"cancelar_pedido",label:"Cancelar pedidos"},{key:"ver_lucro",label:"Ver lucro"},{key:"acessar_config",label:"Acessar Configurações"},{key:"ver_financeiro",label:"Ver Financeiro"}];
    content.innerHTML=`
      <div class="cfg-section-title">🔐 Perfis de Permissão</div>
      ${perfis.map((p,i)=>`<div class="cfg-card" style="margin-bottom:12px">
        <div class="perfil-header">
          <span class="perfil-badge" style="background:${p.cor}22;color:${p.cor};border:1px solid ${p.cor}55">${esc(p.nome)}</span>
          <div style="display:flex;gap:5px">
            <button class="btn-icon" data-edit-perfil="${i}">✏️ Editar</button>
            <button class="btn-icon danger" data-del-perfil="${i}" ${i===0?"disabled":""}>🗑</button>
          </div>
        </div>
        <div class="perm-lista">
          ${PERMS.map(perm=>`<div class="perm-item ${p.permissoes?.[perm.key]?"perm-on":"perm-off"}">
            <span>${perm.label}</span><span class="perm-badge">${p.permissoes?.[perm.key]?"✅":"⛔"}</span>
          </div>`).join("")}
        </div>
      </div>`).join("")}
      <button class="btn-primary" id="btn-novo-perfil">+ Novo Perfil</button>`;
    content.querySelector("#btn-novo-perfil").addEventListener("click",()=>this._modalPerfil(null,PERMS));
    content.querySelectorAll("[data-edit-perfil]").forEach(b=>b.addEventListener("click",()=>this._modalPerfil(parseInt(b.dataset.editPerfil),PERMS)));
    content.querySelectorAll("[data-del-perfil]").forEach(b=>b.addEventListener("click",async()=>{
      const i=parseInt(b.dataset.delPerfil);if(!confirm(`Remover o perfil "${perfis[i].nome}"?`))return;
      perfis.splice(i,1);await this._salvarJSON("perfis_permissao",perfis,"Perfil removido.");this._abaUsuarios(content);
    }));
  }

  _modalPerfil(idx,PERMS) {
    const perfis=this.#svc._cache.perfisPermissao; const p=idx!==null?perfis[idx]:{permissoes:{}};
    const area=this._modal(`<div class="modal-bg" id="modal-bg"><div class="modal">
      <h3>${idx!==null?"Editar":"Novo"} Perfil</h3>
      <label>Nome *</label><input id="pf-nome" value="${esc(p.nome||"")}" placeholder="Ex: Atendente" autofocus/>
      <div style="margin-top:10px"><label>Cor</label><input id="pf-cor" type="color" value="${p.cor||"#4dabf7"}" style="width:60px;height:36px"/></div>
      <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
        ${PERMS.map(perm=>`<div class="perm-toggle"><span>${perm.label}</span>
          <label class="switch"><input type="checkbox" id="pf-${perm.key}" ${p.permissoes?.[perm.key]?"checked":""}/><span class="slider"></span></label>
        </div>`).join("")}
      </div>
      <div class="modal-btns">
        <button class="btn-secondary" id="pf-cancel">Cancelar</button>
        <button class="btn-primary" id="pf-ok">Salvar</button>
      </div></div></div>`);
    area.querySelector("#pf-cancel").addEventListener("click",()=>area.innerHTML="");
    area.querySelector("#pf-ok").addEventListener("click",async()=>{
      const nome=area.querySelector("#pf-nome").value.trim();if(!nome){alert("Informe o nome.");return;}
      const perms={};PERMS.forEach(perm=>{perms[perm.key]=area.querySelector(`#pf-${perm.key}`)?.checked||false;});
      const dados={nome,cor:area.querySelector("#pf-cor").value,permissoes:perms};
      if(idx!==null)perfis[idx]=dados;else perfis.push(dados);
      area.innerHTML="";await this._salvarJSON("perfis_permissao",perfis,"Perfil salvo!");
      this._abaUsuarios(this._container.querySelector("#cfg-content"));
    });
  }

  _abaImpressao(content) {
    const c=this.#svc._cache.cfg;
    content.innerHTML=`
      <div class="cfg-section-title">🖨️ Configurações de Impressão / PDF</div>
      <div class="cfg-card">
        <div class="cfg-grid">
          <div class="cfg-group"><label>Papel</label>
            <select id="imp-papel">${["A4","A3","Carta"].map(p=>`<option value="${p}" ${c.impressao_papel===p?"selected":""}>${p}</option>`).join("")}</select></div>
          <div class="cfg-group"><label>Orientação</label>
            <select id="imp-orient">${["Retrato","Paisagem"].map(p=>`<option value="${p}" ${c.impressao_orientacao===p?"selected":""}>${p}</option>`).join("")}</select></div>
          <div class="cfg-group"><label>Mostrar logo no PDF</label>
            <select id="imp-logo"><option value="sim" ${c.impressao_logo!=="nao"?"selected":""}>Sim</option><option value="nao" ${c.impressao_logo==="nao"?"selected":""}>Não</option></select></div>
          <div class="cfg-group full"><label>Rodapé do PDF</label>
            <textarea id="imp-rodape" rows="2" placeholder="Texto do rodapé...">${esc(c.impressao_rodape)}</textarea></div>
        </div>
        <div class="cfg-acoes"><button class="btn-primary" id="btn-salvar-imp">💾 Salvar</button></div>
      </div>`;
    const g=id=>content.querySelector(id)?.value;
    content.querySelector("#btn-salvar-imp").addEventListener("click",()=>
      this._salvarEmpresa({impressao_papel:g("#imp-papel"),impressao_orientacao:g("#imp-orient"),impressao_logo:g("#imp-logo"),impressao_rodape:g("#imp-rodape")}));
  }

  _abaIntegracoes(content) {
    const c=this.#svc._cache.cfg;
    content.innerHTML=`
      <div class="cfg-section-title">🔗 Integrações</div>
      <div class="cfg-card">
        <div class="cfg-card-title">WhatsApp</div>
        <div class="cfg-grid">
          <div class="cfg-group"><label>Número WhatsApp</label>
            <input id="int-whats" value="${esc(c.integracao_whatsapp)}" placeholder="11999999999"/></div>
          <div class="cfg-group full"><label>Mensagem padrão ao enviar orçamento</label>
            <textarea id="int-msg" rows="3" placeholder="Olá, segue seu orçamento...">${esc(c.integracao_msg_orcamento)}</textarea></div>
        </div>
        <div class="cfg-acoes"><button class="btn-primary" id="btn-salvar-int">💾 Salvar</button></div>
      </div>`;
    const g=id=>content.querySelector(id)?.value;
    content.querySelector("#btn-salvar-int").addEventListener("click",()=>
      this._salvarEmpresa({integracao_whatsapp:g("#int-whats"),integracao_msg_orcamento:g("#int-msg")}));
  }

  _abaPersonalizacao(content) {
    const c=this.#svc._cache.cfg;
    content.innerHTML=`
      <div class="cfg-section-title">🎨 Personalização</div>
      <div class="cfg-card">
        <div class="cfg-grid">
          <div class="cfg-group"><label>Cor primária</label>
            <input id="pers-cor1" type="color" value="${c.cor_primaria||"#00c49a"}" style="width:60px;height:36px"/></div>
          <div class="cfg-group"><label>Cor secundária</label>
            <input id="pers-cor2" type="color" value="${c.cor_secundaria||"#6b9fff"}" style="width:60px;height:36px"/></div>
        </div>
        <div class="cfg-acoes"><button class="btn-primary" id="btn-salvar-pers">💾 Salvar</button></div>
      </div>`;
    const g=id=>content.querySelector(id)?.value;
    content.querySelector("#btn-salvar-pers").addEventListener("click",()=>
      this._salvarEmpresa({cor_primaria:g("#pers-cor1"),cor_secundaria:g("#pers-cor2")}));
  }

  _abaSeguranca(content) {
    const c=this.#svc._cache.cfg;
    content.innerHTML=`
      <div class="cfg-section-title">🛡️ Segurança</div>
      <div class="cfg-card">
        <div class="cfg-grid">
          <div class="cfg-group"><label>Tempo de sessão (min)</label>
            <input id="seg-sessao" type="number" value="${c.seguranca_sessao||60}"/></div>
          <div class="cfg-group"><label>Tentativas antes de bloquear</label>
            <input id="seg-tent" type="number" value="${c.seguranca_tentativas||5}"/></div>
          <div class="cfg-group"><label>Backup automático</label>
            <select id="seg-backup"><option value="sim" ${c.seguranca_backup!=="nao"?"selected":""}>Sim</option><option value="nao" ${c.seguranca_backup==="nao"?"selected":""}>Não</option></select></div>
        </div>
        <div class="cfg-acoes"><button class="btn-primary" id="btn-salvar-seg">💾 Salvar</button></div>
      </div>`;
    const g=id=>content.querySelector(id)?.value;
    content.querySelector("#btn-salvar-seg").addEventListener("click",()=>
      this._salvarEmpresa({seguranca_sessao:parseInt(g("#seg-sessao"))||60,seguranca_tentativas:parseInt(g("#seg-tent"))||5,seguranca_backup:g("#seg-backup")}));
  }
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────
export async function Configuracoes(container) {
  const view = new ConfiguracoesView(container);
  await view.mount();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJSON(val, fallback) {
  try { return JSON.parse(val || "null") ?? fallback; }
  catch { return fallback; }
}
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function cfgCss() { return `
/* Layout geral */
.cfg-wrap{display:flex;gap:0;min-height:80vh;background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden;box-shadow:var(--shadow-sm)}
[data-theme="light"] .cfg-wrap{box-shadow:var(--shadow-md)}

/* Sidebar da config */
.cfg-sidebar{width:200px;flex-shrink:0;background:var(--panel3);border-right:1px solid var(--border);padding:14px 10px;display:flex;flex-direction:column;gap:2px}
[data-theme="light"] .cfg-sidebar{background:#f5f6fa}
.cfg-sidebar-title{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;padding:6px 10px;margin-bottom:4px}
.cfg-nav-btn{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:var(--radius-md);border:1px solid transparent;background:transparent;color:var(--muted);cursor:pointer;font-family:var(--font);font-size:12.5px;transition:all var(--t);text-align:left;width:100%}
.cfg-nav-btn:hover{background:var(--panel2);color:var(--text)}
[data-theme="light"] .cfg-nav-btn:hover{background:#fff}
.cfg-nav-btn.active{background:var(--primary-bg);color:var(--primary-light);border-color:var(--primary-border);font-weight:600}
.cfg-nav-emoji{font-size:15px;flex-shrink:0}

/* Corpo */
.cfg-body{flex:1;padding:20px 24px;overflow-y:auto;min-width:0}

/* Toasts internos */
.cfg-toast{border-radius:var(--radius-md);padding:10px 16px;font-size:12.5px;margin-bottom:16px}
.cfg-toast.ok{background:rgba(0,196,154,0.12);border:1px solid rgba(0,196,154,0.3);color:var(--success)}
.cfg-toast.erro{background:var(--error-bg);border:1px solid var(--error-border);color:var(--error)}

/* Títulos e seções */
.cfg-section-title{font-size:17px;font-weight:700;margin-bottom:16px;color:var(--text)}
.cfg-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:8px}
.cfg-hint{font-size:11px;color:var(--muted);margin-bottom:12px;line-height:1.5}

/* Cards */
.cfg-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px;margin-bottom:14px}
[data-theme="light"] .cfg-card{background:#fff;box-shadow:var(--shadow-xs)}
.cfg-card-title{font-size:11px;font-weight:700;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:.04em}

/* Grid */
.cfg-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:700px){.cfg-grid{grid-template-columns:1fr}}
.cfg-group{display:flex;flex-direction:column;gap:5px}
.cfg-group.full{grid-column:1/-1}
.cfg-group label{font-size:11px;color:var(--muted);font-weight:500}
.cfg-acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)}
.cfg-vazio{color:var(--muted);font-size:12.5px;padding:24px;text-align:center}

/* ── LOGO UPLOAD ── */
.logo-upload-area{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
.logo-preview-wrap{width:100px;height:100px;border-radius:var(--radius-lg);border:2px dashed var(--border-md);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;background:var(--panel3);transition:border-color var(--t)}
.logo-preview-wrap:hover{border-color:var(--primary)}
.logo-preview-img{width:100%;height:100%;object-fit:contain;display:block}
.logo-placeholder{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--muted)}
.logo-placeholder i{font-size:26px;opacity:.4}
.logo-placeholder span{font-size:10px}
.logo-controls{flex:1;min-width:200px}
.btn-upload-logo{display:inline-flex;align-items:center;gap:7px;background:var(--primary-bg);color:var(--primary-light);border:1px solid var(--primary-border);border-radius:var(--radius-md);padding:8px 16px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:var(--font);transition:all var(--t)}
.btn-upload-logo:hover{background:var(--primary);color:#fff}
.btn-remover-logo{display:inline-flex;align-items:center;gap:6px;background:transparent;color:var(--error);border:1px solid var(--error-border);border-radius:var(--radius-md);padding:6px 12px;font-size:11px;font-weight:500;cursor:pointer;font-family:var(--font);transition:all var(--t);width:100%;justify-content:center}
.btn-remover-logo:hover{background:var(--error-bg)}

/* Tabela */
.cfg-table{width:100%;border-collapse:collapse;font-size:12.5px}
.cfg-table th{text-align:left;color:var(--muted);font-weight:600;padding:9px 13px;border-bottom:1px solid var(--border);font-size:11px}
.cfg-table td{padding:9px 13px;border-bottom:1px solid var(--border);vertical-align:middle}
.cfg-table tr:last-child td{border-bottom:none}
.cfg-table tr:hover td{background:var(--panel3)}
.tbl-acoes{display:flex;gap:5px;justify-content:flex-end}
.tag-cargo{font-size:10.5px;background:var(--primary-bg);color:var(--primary-light);padding:2px 8px;border-radius:999px;border:1px solid var(--primary-border)}
.tag-status{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px}
.tag-status.ativo{background:rgba(0,196,154,0.12);color:var(--success)}
.tag-status.inativo{background:var(--panel3);color:var(--muted)}

/* Sub-tabs */
.sub-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
.sub-tab{background:transparent;border:1px solid var(--border-md);color:var(--muted);border-radius:var(--radius-md);padding:7px 13px;cursor:pointer;font-size:12px;font-family:var(--font);transition:all var(--t)}
.sub-tab:hover{color:var(--text)}
.sub-tab.active{background:var(--primary-bg);color:var(--primary-light);border-color:var(--primary-border)}

/* Categ items */
.categ-item{display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-radius:var(--radius-md);font-size:12.5px;margin-bottom:4px;background:var(--panel3);border:1px solid var(--border)}

/* Etapas */
.etapa-row{display:flex;align-items:center;gap:12px;background:var(--panel3);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:6px}
.etapa-ordem{display:flex;align-items:center;gap:4px;flex-shrink:0}
.etapa-num{font-size:11px;color:var(--muted);min-width:18px;text-align:center}
.etapa-icone{font-size:19px;flex-shrink:0}
.etapa-nome{font-size:12.5px;font-weight:600}

/* Perfis */
.perfil-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.perfil-badge{display:inline-block;padding:4px 14px;border-radius:999px;font-size:12.5px;font-weight:700}
.perm-lista{display:flex;flex-direction:column;gap:4px}
.perm-item{display:flex;align-items:center;justify-content:space-between;font-size:12px;padding:5px 8px;border-radius:6px}
.perm-on{background:rgba(0,196,154,0.06)}.perm-off{background:rgba(0,0,0,.02);color:var(--muted)}
.perm-badge{font-size:12px}
.perm-toggle{display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border);font-size:12.5px}
.perm-toggle:last-of-type{border-bottom:none}
.switch{position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;cursor:pointer;inset:0;background:rgba(0,0,0,.15);border-radius:22px;transition:.2s}
.slider:before{position:absolute;content:"";height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
input:checked+.slider{background:var(--primary)}
input:checked+.slider:before{transform:translateX(18px)}

/* Botões reusados */
.btn-primary{display:inline-flex;align-items:center;gap:6px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius-md);padding:8px 18px;cursor:pointer;font-size:12.5px;font-weight:600;font-family:var(--font);transition:all var(--t)}
.btn-primary:hover{opacity:.88}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.btn-secondary{background:transparent;border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:8px 16px;cursor:pointer;font-size:12.5px;font-family:var(--font)}
.btn-icon{background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:var(--radius-sm);padding:4px 9px;cursor:pointer;font-size:12px;transition:all var(--t)}
.btn-icon:hover{border-color:var(--primary);color:var(--primary-light)}
.btn-icon:disabled{opacity:.3;cursor:not-allowed}
.btn-icon.danger:hover{border-color:var(--error-border);color:var(--error)}

/* Modal */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:var(--panel);border:1px solid var(--border-md);border-radius:var(--radius-xl);padding:24px;min-width:320px;max-width:480px;width:92%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg)}
.modal h3{margin:0 0 16px;font-size:15px;font-weight:700}
.modal label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;margin-top:10px;font-weight:500}
.modal label:first-of-type{margin-top:0}
.modal input,.modal select,.modal textarea{width:100%;background:var(--panel3);border:1px solid var(--border-md);color:var(--text);border-radius:var(--radius-md);padding:8px 11px;font-size:12.5px;box-sizing:border-box;font-family:var(--font);transition:border-color var(--t)}
[data-theme="light"] .modal input,[data-theme="light"] .modal select,[data-theme="light"] .modal textarea{background:#f8f9fc}
.modal input:focus,.modal select:focus,.modal textarea:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,196,154,.12)}
.modal-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}

/* Responsivo */
@media(max-width:700px){
  .cfg-wrap{flex-direction:column}
  .cfg-sidebar{width:100%;border-right:none;border-bottom:1px solid var(--border);flex-direction:row;flex-wrap:wrap;padding:8px;gap:4px}
  .cfg-sidebar-title{display:none}
  .cfg-nav-btn{width:auto;flex:1;justify-content:center;font-size:11px;padding:6px 8px}
  .cfg-nav-emoji{display:none}
  .cfg-body{padding:14px}
  .logo-upload-area{flex-direction:column;align-items:center}
  .logo-controls{width:100%}
}
`; }
