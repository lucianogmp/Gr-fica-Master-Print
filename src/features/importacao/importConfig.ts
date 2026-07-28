// src/features/importacao/importConfig.ts
//
// Cadastro central de "tabelas importáveis". Para liberar a importação de
// um novo módulo (ex: produtos, materiais) basta adicionar um novo item aqui
// — nenhuma outra parte do fluxo de importação precisa mudar.

export type CampoTipo = 'texto' | 'numero' | 'data' | 'booleano';

export interface CampoImportavel {
  /** nome exato da coluna no Supabase */
  chave: string;
  /** rótulo mostrado para o usuário no mapeamento */
  label: string;
  /** se true, a linha é rejeitada quando o campo vier vazio */
  obrigatorio?: boolean;
  tipo?: CampoTipo;
  /**
   * Usado para detectar duplicidade contra os registros que já existem no banco.
   * - 'forte': se bater, a linha é tratada como duplicado confirmado (ex: CPF/CNPJ, e-mail).
   * - 'fraca': se bater, a linha é só sinalizada como "possível duplicado" pra revisão
   *   manual — nunca bloqueia sozinha, porque nome/telefone repetido não significa
   *   necessariamente que é a mesma pessoa (ex: nome igual, cliente diferente).
   */
  chaveDuplicidade?: 'forte' | 'fraca';
}

export interface TabelaImportavel {
  /** nome exato da tabela no Supabase */
  tabela: string;
  /** rótulo mostrado no seletor de "o que você quer importar" */
  label: string;
  campos: CampoImportavel[];
}

export const TABELAS_IMPORTAVEIS: TabelaImportavel[] = [
  {
    tabela: 'clientes',
    label: 'Clientes',
    campos: [
      { chave: 'nome', label: 'Nome', obrigatorio: true, chaveDuplicidade: 'fraca' },
      { chave: 'cpf_cnpj', label: 'CPF / CNPJ', chaveDuplicidade: 'forte' },
      { chave: 'email', label: 'E-mail', chaveDuplicidade: 'forte' },
      { chave: 'telefone', label: 'Telefone', chaveDuplicidade: 'fraca' },
      { chave: 'endereco', label: 'Endereço' },
      { chave: 'numero', label: 'Número' },
      { chave: 'bairro', label: 'Bairro' },
      { chave: 'cidade', label: 'Cidade' },
      { chave: 'estado', label: 'Estado (UF)' },
      { chave: 'cep', label: 'CEP' },
      { chave: 'data_nascimento', label: 'Data de nascimento', tipo: 'data' },
      { chave: 'razao_social', label: 'Razão social' },
      { chave: 'nome_fantasia', label: 'Nome fantasia' },
      { chave: 'inscricao_estadual', label: 'Inscrição estadual' },
      { chave: 'situacao_cadastral', label: 'Situação cadastral' },
      { chave: 'cnae_principal', label: 'CNAE principal' },
      { chave: 'como_conheceu', label: 'Como conheceu' },
      { chave: 'produto_interesse', label: 'Produto de interesse' },
      { chave: 'observacoes', label: 'Observações' },
    ],
  },
  {
    tabela: 'materias_primas',
    label: 'Matérias-primas (Estoque)',
    campos: [
      { chave: 'nome', label: 'Nome', obrigatorio: true, chaveDuplicidade: 'forte' },
      { chave: 'categoria', label: 'Categoria' },
      { chave: 'unidade', label: 'Unidade' },
      { chave: 'custo_unitario', label: 'Custo unitário', tipo: 'numero' },
      { chave: 'preco_venda', label: 'Preço de venda', tipo: 'numero' },
      { chave: 'estoque_minimo', label: 'Estoque mínimo', tipo: 'numero' },
      { chave: 'saldo_inicial', label: 'Saldo inicial', tipo: 'numero' },
    ],
  },
  {
    tabela: 'contas_bancarias',
    label: 'Contas bancárias',
    campos: [
      { chave: 'nome', label: 'Nome', obrigatorio: true, chaveDuplicidade: 'forte' },
      { chave: 'tipo', label: 'Tipo (caixa/corrente/poupanca/cartao/pix/outro)' },
      { chave: 'banco', label: 'Banco' },
      { chave: 'agencia', label: 'Agência' },
      { chave: 'conta', label: 'Conta' },
      { chave: 'saldo_inicial', label: 'Saldo inicial', tipo: 'numero' },
    ],
  },
];

export function getTabelaImportavel(tabela: string): TabelaImportavel | undefined {
  return TABELAS_IMPORTAVEIS.find((t) => t.tabela === tabela);
}
