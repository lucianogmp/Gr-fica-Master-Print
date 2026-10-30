// src/lib/rascunhoVenda.ts
//
// Ao clicar no lápis de um item da venda, o sistema abre o cadastro do produto. Como isso sai da
// tela da venda, tudo o que ainda não foi salvo (dados, itens, parcelas, gastos) fica guardado aqui,
// no navegador, e volta no lugar quando a pessoa salva (ou fecha) o produto.
// sessionStorage: some sozinho ao fechar a aba e não vaza pra outra venda.
const CHAVE = 'gmp:venda-rascunho-retorno';

export interface RascunhoRetornoVenda {
  vendaId: string;                 // '__novo__' ou o id da venda
  form: any;
  itens: any[];
  pagamentosRascunho: any[];
  gastosRascunho: any[];
  /** Item cujo produto foi aberto pra edição (pra puxar nome/preço atualizados na volta). */
  /** Quando foi guardado — rascunho velho demais (voltou por outro caminho) é ignorado. */
  em?: number;
  edicao?: { indice: number; produtoId: string; nomeAntes: string; precoAntes: number };
}

export function guardarRascunhoVenda(r: RascunhoRetornoVenda) {
  try { sessionStorage.setItem(CHAVE, JSON.stringify({ ...r, em: Date.now() })); } catch { /* sem storage: volta sem rascunho */ }
}

/** Lê sem apagar (apagar é explícito, depois de aplicar). */
export function lerRascunhoVenda(vendaId: string): RascunhoRetornoVenda | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const r = JSON.parse(bruto) as RascunhoRetornoVenda;
    return r?.vendaId === vendaId && Date.now() - (r.em ?? 0) < 30 * 60 * 1000 ? r : null;
  } catch { return null; }
}

export function limparRascunhoVenda() {
  try { sessionStorage.removeItem(CHAVE); } catch { /* ignore */ }
}
