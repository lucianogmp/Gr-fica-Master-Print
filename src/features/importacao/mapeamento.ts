// src/features/importacao/mapeamento.ts
//
// Sugere automaticamente qual coluna da planilha do sistema antigo
// corresponde a qual campo do sistema novo, comparando os nomes das colunas
// (sem acento, sem espaço, minúsculo) contra um dicionário de sinônimos comuns.
// O usuário sempre pode corrigir a sugestão manualmente na tela de mapeamento.

import type { CampoImportavel } from './importConfig';

const SINONIMOS: Record<string, string[]> = {
  nome: ['nome', 'cliente', 'nomecliente', 'nomecompleto', 'nomedocliente', 'nomerazaosocial', 'nomefornecedor', 'fornecedor', 'descricao', 'produto', 'materiaprima', 'material', 'titular'],
  cpf_cnpj: ['cpf', 'cnpj', 'cpfcnpj', 'cnpjcpf', 'documento', 'cpfoucnpj', 'cnpjoucpf', 'numerodocumento', 'doc', 'cpfcnpjcliente'],
  email: ['email', 'mail', 'emailcliente', 'correioeletronico'],
  telefone: ['telefone', 'fone', 'celular', 'whatsapp', 'tel', 'telefone1', 'fonecelular', 'foneresidencial', 'telefonecelular', 'contato'],
  endereco: ['endereco', 'rua', 'logradouro', 'end'],
  numero: ['numero', 'nro', 'num', 'n', 'numeroendereco'],
  bairro: ['bairro'],
  cidade: ['cidade', 'municipio'],
  estado: ['estado', 'uf'],
  cep: ['cep', 'codigopostal'],
  data_nascimento: ['datanascimento', 'nascimento', 'dtnascimento', 'aniversario', 'datadenascimento', 'dtnasc', 'datanasc'],
  razao_social: ['razaosocial', 'razao'],
  nome_fantasia: ['nomefantasia', 'fantasia'],
  inscricao_estadual: ['inscricaoestadual', 'ie'],
  situacao_cadastral: ['situacaocadastral', 'situacao'],
  cnae_principal: ['cnae', 'cnaeprincipal'],
  como_conheceu: ['comoconheceu', 'origem'],
  produto_interesse: ['produtointeresse', 'interesse'],
  observacoes: ['observacoes', 'obs', 'notas', 'observacao'],
  categoria: ['categoria', 'grupo', 'familia', 'tipo'],
  unidade: ['unidade', 'un', 'und', 'unidademedida', 'um'],
  custo_unitario: ['custounitario', 'custo', 'precocusto', 'valorcusto', 'custounit'],
  preco_venda: ['precovenda', 'preco', 'valorvenda', 'valor', 'precounitario'],
  estoque_minimo: ['estoqueminimo', 'minimo', 'estmin'],
  saldo_inicial: ['saldoinicial', 'saldo', 'saldoatual', 'estoque', 'estoqueatual', 'quantidade', 'qtd', 'qtde'],
  banco: ['banco'],
  agencia: ['agencia', 'ag'],
  conta: ['conta', 'cc'],
};

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function candidatosDoCampo(campo: CampoImportavel): string[] {
  return [campo.chave, campo.label, ...(SINONIMOS[campo.chave] ?? [])].map(normalizar);
}

/** Quantos cabeçalhos desta linha batem com algum campo do módulo — usado pra achar a linha do cabeçalho. */
export function pontuarLinhaCabecalho(linha: any[], campos: CampoImportavel[]): number {
  const todos = new Set(campos.flatMap(candidatosDoCampo));
  return linha.reduce((n, c) => {
    const k = normalizar(String(c ?? ''));
    return n + (k && todos.has(k) ? 1 : 0);
  }, 0);
}

/** Procura, nas primeiras linhas, a que mais parece um cabeçalho (sistemas antigos costumam pôr títulos acima). */
export function detectarLinhaCabecalho(linhas: any[][], campos: CampoImportavel[]): number {
  let melhor = 0, pontos = 0;
  for (let i = 0; i < Math.min(linhas.length, 25); i++) {
    const p = pontuarLinhaCabecalho(linhas[i] ?? [], campos);
    if (p > pontos) { pontos = p; melhor = i; }
  }
  return pontos >= 2 ? melhor : 0;
}

/**
 * Recebe os cabeçalhos encontrados na planilha e a lista de campos do
 * módulo escolhido, e devolve um mapa { colunaOrigem: chaveDoCampo }.
 * Cada campo recebe no máximo UMA coluna (a que bate exatamente com o nome/rótulo vem primeiro).
 */
export function sugerirMapeamento(
  colunasOrigem: string[],
  campos: CampoImportavel[]
): Record<string, string> {
  const mapeamento: Record<string, string> = {};
  const camposUsados = new Set<string>();

  // 1ª passada: nome/rótulo exatamente igual; 2ª: sinônimos
  for (const exato of [true, false]) {
    for (const colunaOriginal of colunasOrigem) {
      if (mapeamento[colunaOriginal]) continue;
      const k = normalizar(colunaOriginal);
      if (!k) continue;
      for (const campo of campos) {
        if (camposUsados.has(campo.chave)) continue;
        const lista = exato ? [campo.chave, campo.label].map(normalizar) : candidatosDoCampo(campo);
        if (lista.includes(k)) {
          mapeamento[colunaOriginal] = campo.chave;
          camposUsados.add(campo.chave);
          break;
        }
      }
    }
  }
  return mapeamento;
}
