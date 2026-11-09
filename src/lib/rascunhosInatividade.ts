// src/lib/rascunhosInatividade.ts
//
// Quando a sessão expira por inatividade (30 min sem mexer), o sistema volta pro login e
// o que estava aberto sem salvar (orçamento, venda, produto) se perdia. Agora cada tela
// registra aqui um "getter" do que está em edição; no instante em que a sessão é encerrada
// por inatividade, tudo o que estava sujo (com alteração não salva) é guardado no navegador,
// por usuário. Ao entrar de novo, um aviso oferece "Recuperar" ou "Descartar".

export type TipoRascunho = 'orcamento' | 'venda' | 'produto';

export interface InstantaneoRascunho {
  /** id do documento em edição ('__novo__' quando ainda não foi salvo). */
  chave: string;
  /** texto curto pro aviso (ex.: "Orçamento — Carlos"). */
  rotulo: string;
  dados: any;
}
export interface RascunhoGuardado extends InstantaneoRascunho { tipo: TipoRascunho; em: number; }

const registros = new Map<TipoRascunho, () => InstantaneoRascunho | null>();
const VALIDADE_MS = 72 * 60 * 60 * 1000;
const chaveStorage = (userId: string, tipo: TipoRascunho) => `gmp:rascunho-inatividade:${userId}:${tipo}`;

/** A tela registra como obter o que está em edição (null = nada pendente). Retorna o cancelamento. */
export function registrarRascunho(tipo: TipoRascunho, getter: () => InstantaneoRascunho | null) {
  registros.set(tipo, getter);
  return () => { if (registros.get(tipo) === getter) registros.delete(tipo); };
}

/** Chamado no instante em que a sessão é encerrada por inatividade. */
export function salvarRascunhosPendentes(userId: string) {
  registros.forEach((getter, tipo) => {
    try {
      const r = getter();
      if (!r) return;
      localStorage.setItem(chaveStorage(userId, tipo), JSON.stringify({ ...r, tipo, em: Date.now() } satisfies RascunhoGuardado));
    } catch { /* sem storage ou dado não serializável: segue sem guardar */ }
  });
}

export function listarRascunhos(userId: string): RascunhoGuardado[] {
  const out: RascunhoGuardado[] = [];
  (['orcamento', 'venda', 'produto'] as TipoRascunho[]).forEach(tipo => {
    const r = lerRascunho(userId, tipo);
    if (r) out.push(r);
  });
  return out;
}

export function lerRascunho(userId: string, tipo: TipoRascunho): RascunhoGuardado | null {
  try {
    const bruto = localStorage.getItem(chaveStorage(userId, tipo));
    if (!bruto) return null;
    const r = JSON.parse(bruto) as RascunhoGuardado;
    if (Date.now() - (r.em ?? 0) > VALIDADE_MS) { localStorage.removeItem(chaveStorage(userId, tipo)); return null; }
    return r;
  } catch { return null; }
}

export function limparRascunho(userId: string, tipo: TipoRascunho) {
  try { localStorage.removeItem(chaveStorage(userId, tipo)); } catch { /* ignore */ }
}
