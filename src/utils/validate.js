/**
 * VALIDATE — Regras de validação de negócio centralizadas.
 * Todas as validações do ERP passam por aqui.
 */

export class ValidationError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

// ─── Financeiro ───────────────────────────────────────────────────────────────
export const validateValor = (valor, campo = "Valor") => {
  const n = Number(valor);
  if (isNaN(n) || n <= 0)        throw new ValidationError(`${campo} deve ser maior que zero.`);
  if (n > 9_999_999)              throw new ValidationError(`${campo} excede o limite permitido.`);
  return n;
};

export const validateDescricao = (desc, campo = "Descrição") => {
  if (!desc?.trim()) throw new ValidationError(`${campo} é obrigatório.`);
  if (desc.trim().length > 500)  throw new ValidationError(`${campo} deve ter no máximo 500 caracteres.`);
  return desc.trim();
};

export const validateData = (data, campo = "Data") => {
  if (!data) throw new ValidationError(`${campo} é obrigatória.`);
  const d = new Date(data);
  if (isNaN(d.getTime())) throw new ValidationError(`${campo} inválida.`);
  return data;
};

// ─── Venda ────────────────────────────────────────────────────────────────────
export const validateItensVenda = (itens) => {
  const validos = itens.filter(it => it.descricao?.trim());
  if (!validos.length) throw new ValidationError("Adicione ao menos um item com descrição.", { itens: true });
  validos.forEach((it, i) => {
    if (Number(it.preco) < 0)  throw new ValidationError(`Item ${i + 1}: preço não pode ser negativo.`);
    if (Number(it.qtd)   <= 0) throw new ValidationError(`Item ${i + 1}: quantidade deve ser positiva.`);
  });
  return validos;
};

// ─── Cliente ──────────────────────────────────────────────────────────────────
export const validateCliente = (dados) => {
  if (!dados.nome?.trim()) throw new ValidationError("Nome é obrigatório.", { nome: true });
  if (dados.nome.trim().length > 200) throw new ValidationError("Nome muito longo.");
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) {
    throw new ValidationError("E-mail inválido.", { email: true });
  }
  return dados;
};

// ─── Matéria-prima ────────────────────────────────────────────────────────────
export const validateMateria = (dados) => {
  if (!dados.nome?.trim()) throw new ValidationError("Nome é obrigatório.", { nome: true });
  const custo = Number(dados.custo_unitario);
  if (isNaN(custo) || custo < 0) throw new ValidationError("Custo unitário inválido.");
  const min = Number(dados.estoque_minimo || 0);
  if (min < 0) throw new ValidationError("Estoque mínimo não pode ser negativo.");
  return dados;
};

// ─── Movimentação de estoque ──────────────────────────────────────────────────
export const validateMovEstoque = (qtd, saldo, forcarNegativo = false) => {
  const n = Number(qtd);
  if (isNaN(n) || n <= 0) throw new ValidationError("Quantidade deve ser positiva.");
  if (!forcarNegativo && n > saldo) {
    throw new ValidationError(`Saldo insuficiente (disponível: ${Number(saldo).toFixed(3)}).`);
  }
  return n;
};
