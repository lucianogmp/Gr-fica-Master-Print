// src/lib/buscaFlexivel.ts
//
// Busca flexível usada em todas as caixas de pesquisa do sistema.
//
// Problema que resolve: buscar "lona placa" não achava "Placa Fachada —
// Lona 440g", porque o texto tinha que aparecer EXATAMENTE na ordem
// digitada. Também não achava "ilhos" quando o cadastro tinha "ilhós"
// (acento).
//
// Regra: TODAS as palavras digitadas precisam aparecer em algum lugar do
// texto-alvo, em QUALQUER ordem, ignorando acento e maiúscula/minúscula.

/** Remove acentos pra comparação mais tolerante (ex: "ilhós" casa com "ilhos"). */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * true se TODAS as palavras de `termoBusca` aparecem em `textoAlvo`, em
 * qualquer ordem. Termo vazio sempre casa (não filtra nada).
 *
 * Ex: correspondeABusca("Placa Fachada — Lona 440g", "lona placa") → true
 */
export function correspondeABusca(textoAlvo: string | null | undefined, termoBusca: string): boolean {
  const termo = termoBusca.trim();
  if (!termo) return true;
  if (!textoAlvo) return false;
  const alvoNormalizado = normalizar(textoAlvo);
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  return palavras.every(p => alvoNormalizado.includes(p));
}

/**
 * Mesma lógica, combinando vários campos de uma vez (ex: nome + categoria
 * + telefone) — útil quando a busca deve achar por qualquer um desses
 * campos, mesmo que as palavras digitadas estejam espalhadas entre eles.
 *
 * Ex: correspondeABuscaEmCampos(["João Silva", "11999998888"], "silva 9999")
 */
export function correspondeABuscaEmCampos(campos: (string | number | null | undefined)[], termoBusca: string): boolean {
  const termo = termoBusca.trim();
  if (!termo) return true;
  const alvoNormalizado = normalizar(campos.filter(c => c !== null && c !== undefined).map(String).join(' '));
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  return palavras.every(p => alvoNormalizado.includes(p));
}
