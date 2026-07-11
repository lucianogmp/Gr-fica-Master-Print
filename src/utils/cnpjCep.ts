// src/utils/cnpjCep.ts
// Consulta pública de CNPJ (BrasilAPI) e CEP (ViaCEP) para preenchimento automático de cadastro.

export function apenasNumeros(valor: string): string {
  return (valor || '').replace(/\D/g, '');
}

export function formatarCNPJ(valor: string): string {
  const v = apenasNumeros(valor).slice(0, 14);
  return v
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatarCEP(valor: string): string {
  const v = apenasNumeros(valor).slice(0, 8);
  return v.replace(/^(\d{5})(\d)/, '$1-$2');
}

function formatarTelefone(dddTelefone?: string | null): string {
  const v = apenasNumeros(dddTelefone ?? '');
  if (v.length === 11) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  if (v.length === 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return '';
}

export interface CNPJResultado {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  email: string;
  telefone: string;
  cnaePrincipal: string;
}

/** Busca dados públicos de uma empresa pelo CNPJ (BrasilAPI). Lança erro com mensagem amigável em caso de falha. */
export async function buscarCNPJ(cnpjDigitado: string): Promise<CNPJResultado> {
  const cnpj = apenasNumeros(cnpjDigitado);
  if (cnpj.length !== 14) {
    throw new Error('CNPJ inválido. Digite os 14 números do CNPJ.');
  }

  let resp: Response;
  try {
    resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  } catch {
    throw new Error('Sem conexão para consultar o CNPJ. Verifique sua internet e tente novamente.');
  }

  if (resp.status === 404) {
    throw new Error('CNPJ não encontrado na Receita Federal.');
  }
  if (!resp.ok) {
    throw new Error('Não foi possível consultar o CNPJ agora. Tente novamente em instantes.');
  }

  const d = await resp.json();

  const cnaeDescricao = d.cnae_fiscal_descricao
    ? `${d.cnae_fiscal ?? ''} - ${d.cnae_fiscal_descricao}`.trim()
    : (d.cnae_fiscal ? String(d.cnae_fiscal) : '');

  return {
    cnpj: formatarCNPJ(cnpj),
    razaoSocial: d.razao_social ?? '',
    nomeFantasia: d.nome_fantasia ?? '',
    situacaoCadastral: d.descricao_situacao_cadastral ?? '',
    cep: d.cep ? formatarCEP(d.cep) : '',
    logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ').trim(),
    numero: d.numero ?? '',
    bairro: d.bairro ?? '',
    cidade: d.municipio ?? '',
    estado: d.uf ?? '',
    email: (d.email ?? '').toLowerCase(),
    telefone: formatarTelefone(d.ddd_telefone_1),
    cnaePrincipal: cnaeDescricao,
  };
}

export interface CEPResultado {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/** Busca endereço pelo CEP (ViaCEP). Lança erro com mensagem amigável em caso de falha. */
export async function buscarCEP(cepDigitado: string): Promise<CEPResultado> {
  const cep = apenasNumeros(cepDigitado);
  if (cep.length !== 8) {
    throw new Error('CEP inválido. Digite os 8 números do CEP.');
  }

  let resp: Response;
  try {
    resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  } catch {
    throw new Error('Sem conexão para consultar o CEP. Verifique sua internet e tente novamente.');
  }
  if (!resp.ok) {
    throw new Error('Não foi possível consultar o CEP agora. Tente novamente em instantes.');
  }

  const d = await resp.json();
  if (d.erro) {
    throw new Error('CEP não encontrado.');
  }

  return {
    cep: formatarCEP(cep),
    logradouro: d.logradouro ?? '',
    bairro: d.bairro ?? '',
    cidade: d.localidade ?? '',
    estado: d.uf ?? '',
  };
}
