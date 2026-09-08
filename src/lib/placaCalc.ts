// Regras de cálculo do módulo de Orçamento de Placas / Serralheria.
// Funções puras — sem acesso a banco — pra poderem ser testadas isoladamente
// e reaproveitadas tanto no editor quanto no "Ver cálculo detalhado".

export type TipoCalculoAcabamento = 'perimetro' | 'm2' | 'metro_linear' | 'manual';
export type TipoInstalacaoPlaca = 'sem' | 'esticar' | 'completa';

export interface MetalonCalculo {
  perimetro: number;
  travessasV: number;
  travessasH: number;
  compTravessasV: number;
  compTravessasH: number;
  total: number;
}

/**
 * Perímetro da placa + travessas de reforço.
 *
 * Regra validada com o Luciano: sempre que uma dimensão ultrapassa o
 * espaçamento máximo configurado, entra uma travessa extra pra não deixar
 * vão maior que esse espaçamento. O comprimento de cada travessa é a
 * dimensão perpendicular (uma travessa que "corta" a largura tem o
 * comprimento da altura, e vice-versa).
 *
 * Exemplo (2,00 × 1,00 m, espaçamento 1,00 m): largura 2,00 m excede
 * 1,00 m → 1 travessa vertical de 1,00 m (a altura). Total = perímetro
 * (6,00 m) + travessa (1,00 m) = 7,00 m.
 */
export function calcMetalonQuantidade(
  largura: number,
  altura: number,
  espacamentoMax: number,
): MetalonCalculo {
  const espacamento = espacamentoMax > 0 ? espacamentoMax : 1;
  const perimetro = (largura + altura) * 2;

  const travessasV = largura > espacamento ? Math.ceil(largura / espacamento) - 1 : 0;
  const travessasH = altura  > espacamento ? Math.ceil(altura  / espacamento) - 1 : 0;

  const compTravessasV = travessasV * altura;
  const compTravessasH = travessasH * largura;

  return {
    perimetro,
    travessasV,
    travessasH,
    compTravessasV,
    compTravessasH,
    total: perimetro + compTravessasV + compTravessasH,
  };
}

export interface DadosPlacaParaAcabamento {
  area: number;      // m² (largura × altura × quantidade)
  perimetro: number; // m  ((largura + altura) × 2, sem multiplicar por quantidade)
}

/**
 * Quantidade calculada de um acabamento, conforme a regra configurada no
 * cadastro do material (item 8 da especificação — sem fórmula fixa no
 * código por produto). Regra confirmada com o Luciano:
 *
 * - perimetro:    perímetro DA PLACA × fator, onde fator = 1/espaçamento
 *                 — ex: parafuso/ilhós/rebite a cada 15cm de borda,
 *                 fator = 1/0,15 ≈ 6,67
 * - m2:           área × fator (reserva pra outros materiais no futuro)
 * - metro_linear: perímetro DA PLACA × fator — ex: fita dupla face e
 *                 cantoneira dão só a volta na placa; travessas internas
 *                 de reforço do metalon NÃO entram nessa conta. fator ≈ 1
 *                 (1m de fita por metro de perímetro)
 * - manual:       0 — usuário sempre define a quantidade usada
 */
export function calcAcabamentoQuantidade(
  tipoCalculo: TipoCalculoAcabamento,
  fator: number | null | undefined,
  dados: DadosPlacaParaAcabamento,
): number {
  const f = fator ?? 0;
  switch (tipoCalculo) {
    case 'perimetro':    return Math.ceil(dados.perimetro * f);
    case 'm2':           return Math.ceil(dados.area * f);
    case 'metro_linear': return Number((dados.perimetro * f).toFixed(2));
    case 'manual':
    default:              return 0;
  }
}

// ---------------------------------------------------------------------
// Snapshot congelado (detalhe_placa) — o que é salvo no orçamento e que
// viaja pra venda/produção/impressão sem depender do cadastro não mudar.
// ---------------------------------------------------------------------

export interface DetalhePlacaMaterial {
  id: string | null;
  nome: string;
  custo_m2: number;
  custo_total: number;
}

export interface DetalhePlacaSerralheria {
  metalon_tipo_id: string | null;
  metalon_nome: string;
  custo_metro: number;
  espacamento_travessa_m: number;
  qtd_calculada: number;
  qtd_usada: number;
  mao_obra_pct: number;
  mao_obra_custo: number;
  custo_total: number;
}

export interface DetalhePlacaAcabamento {
  acabamento_id: string | null;
  nome: string;
  tipo_calculo: TipoCalculoAcabamento;
  fator_calculo: number | null;
  qtd_calculada: number;
  qtd_usada: number;
  custo_unitario: number;
  custo_total: number;
  controla_estoque: boolean;
}

export interface DetalhePlacaInstalacao {
  tipo: TipoInstalacaoPlaca;
  custo: number;
}

export interface DetalhePlaca {
  largura: number;
  altura: number;
  quantidade: number;
  area_total_m2: number;
  perimetro_m: number;
  material: DetalhePlacaMaterial;
  possui_armacao: boolean;
  serralheria: DetalhePlacaSerralheria | null;
  acabamentos: DetalhePlacaAcabamento[];
  instalacao: DetalhePlacaInstalacao;
  custo_total: number;
  margem_pct: number;
  preco_sugerido: number;
  preco_final: number;
  lucro: number;
  margem_real_pct: number;
}

const INSTALACAO_LABEL: Record<TipoInstalacaoPlaca, string> = {
  sem: 'Sem instalação (retirada)',
  esticar: 'Instalação — esticar lona na estrutura do cliente',
  completa: 'Instalação completa',
};

/**
 * Descrição multi-linha do item de placa pra impressão comercial
 * (orçamento/venda enviados ao cliente) — item 20 da especificação:
 * mostra dimensão/material/estrutura/acabamento/instalação, mas nunca
 * custo, mão de obra % ou margem. `DocumentoImpressaoData.itens` já é
 * um formato "achatado" (descricao + preço), reaproveitado tal como
 * está — aqui só enriquecemos a string de descrição.
 */
export function formatarDescricaoImpressaoPlaca(descricaoBase: string, d: DetalhePlaca | null | undefined): string {
  if (!d) return descricaoBase;

  const linhas: string[] = [descricaoBase];
  linhas.push(`Dimensões: ${d.largura.toFixed(2)} × ${d.altura.toFixed(2)} m${d.quantidade > 1 ? ` (${d.quantidade} un.)` : ''}`);
  if (d.material.nome) linhas.push(`Material: ${d.material.nome}`);
  linhas.push(
    d.possui_armacao
      ? `Estrutura: com armação metálica${d.serralheria?.metalon_nome ? ` (${d.serralheria.metalon_nome})` : ''}`
      : 'Estrutura: sem armação (cliente já possui)',
  );
  if (d.acabamentos.length > 0) {
    linhas.push(`Acabamentos: ${d.acabamentos.map(a => a.nome).join(', ')}`);
  }
  linhas.push(INSTALACAO_LABEL[d.instalacao.tipo]);
  return linhas.join('\n');
}
