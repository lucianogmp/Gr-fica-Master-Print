// src/features/importacao/mapeamento.ts
//
// Sugere automaticamente qual coluna da planilha do sistema antigo
// corresponde a qual campo do sistema novo, comparando os nomes das colunas
// (sem acento, sem espaço, minúsculo) contra um dicionário de sinônimos comuns.
// O usuário sempre pode corrigir a sugestão manualmente na tela de mapeamento.

import type { CampoImportavel } from './importConfig';

const SINONIMOS: Record<string, string[]> = {
  nome: ['nome', 'cliente', 'nomecliente', 'nomecompleto', 'razaosocial', 'contato', 'nomedocliente'],
  cpf_cnpj: ['cpf', 'cnpj', 'cpfcnpj', 'documento', 'cpfoucnpj'],
  email: ['email', 'e-mail', 'mail', 'emailcliente'],
  telefone: ['telefone', 'fone', 'celular', 'whatsapp', 'contato', 'tel'],
  endereco: ['endereco', 'rua', 'logradouro', 'end'],
  numero: ['numero', 'nro', 'n'],
  bairro: ['bairro'],
  cidade: ['cidade', 'municipio'],
  estado: ['estado', 'uf'],
  cep: ['cep'],
  data_nascimento: ['datanascimento', 'nascimento', 'dtnascimento', 'aniversario'],
  razao_social: ['razaosocial', 'razao'],
  nome_fantasia: ['nomefantasia', 'fantasia'],
  inscricao_estadual: ['inscricaoestadual', 'ie'],
  situacao_cadastral: ['situacaocadastral', 'situacao'],
  cnae_principal: ['cnae', 'cnaeprincipal'],
  como_conheceu: ['comoconheceu', 'origem'],
  produto_interesse: ['produtointeresse', 'interesse'],
  observacoes: ['observacoes', 'obs', 'notas', 'observacao'],
  categoria: ['categoria', 'tipo'],
  unidade: ['unidade', 'un'],
  custo_unitario: ['custounitario', 'custo'],
  preco_venda: ['precovenda', 'preco', 'valorvenda'],
  estoque_minimo: ['estoqueminimo', 'minimo'],
  saldo_inicial: ['saldoinicial', 'saldo'],
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

/**
 * Recebe os cabeçalhos encontrados na planilha e a lista de campos do
 * módulo escolhido, e devolve um mapa { colunaOrigem: chaveDoCampo }
 * com as melhores sugestões encontradas.
 */
export function sugerirMapeamento(
  colunasOrigem: string[],
  campos: CampoImportavel[]
): Record<string, string> {
  const mapeamento: Record<string, string> = {};

  for (const colunaOriginal of colunasOrigem) {
    const colunaNormalizada = normalizar(colunaOriginal);
    if (!colunaNormalizada) continue;

    let melhorCampo: CampoImportavel | undefined;

    for (const campo of campos) {
      const candidatos = [campo.chave, campo.label, ...(SINONIMOS[campo.chave] ?? [])].map(normalizar);
      if (candidatos.includes(colunaNormalizada)) {
        melhorCampo = campo;
        break;
      }
    }

    if (melhorCampo) {
      mapeamento[colunaOriginal] = melhorCampo.chave;
    }
  }

  return mapeamento;
}
