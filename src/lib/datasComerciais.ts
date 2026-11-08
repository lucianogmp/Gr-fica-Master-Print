// src/lib/datasComerciais.ts
//
// Cálculo das datas comerciais (Natal, Páscoa, Dia das Mães, Black Friday...).
// Tudo é calculado aqui, sem IA e sem internet: datas fixas usam mês/dia e as
// móveis usam a regra (ex.: Dia das Mães = 2º domingo de maio).
// Datas sempre em texto "AAAA-MM-DD" (horário local), igual ao resto do sistema.

export type RegraData = 'fixa' | 'pascoa' | 'carnaval' | 'dia_das_maes' | 'dia_dos_pais' | 'black_friday';

export interface DataComercial {
  id: string;
  nome: string;
  regra: RegraData;
  mes: number | null;
  dia: number | null;
  dias_antecedencia: number;
  ativa: boolean;
  ideias: string | null;
  palavras_chave: string[];
  observacoes: string | null;
  site_mostrar?: boolean;          // aparece no site como "Ofertas de ..." (desligado até ativar)
  site_dias_antes?: number | null; // vazio = usa dias_antecedencia
}

export const REGRAS: { value: RegraData; label: string }[] = [
  { value: 'fixa',         label: 'Data fixa (dia/mês)' },
  { value: 'pascoa',       label: 'Páscoa' },
  { value: 'carnaval',     label: 'Carnaval (terça)' },
  { value: 'dia_das_maes', label: 'Dia das Mães (2º dom. de maio)' },
  { value: 'dia_dos_pais', label: 'Dia dos Pais (2º dom. de agosto)' },
  { value: 'black_friday', label: 'Black Friday' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const montar = (a: number, m: number, d: number) => `${a}-${pad(m)}-${pad(d)}`;
const paraUTC = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export function hojeISO(): string {
  const d = new Date();
  return montar(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function diasEntre(aISO: string, bISO: string): number {
  return Math.round((paraUTC(bISO) - paraUTC(aISO)) / 86400000);
}

export function somarDias(iso: string, n: number): string {
  const d = new Date(paraUTC(iso) + n * 86400000);
  return montar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoaDoAno(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return montar(ano, mes, dia);
}

/** n-ésimo dia da semana (0=domingo ... 6=sábado) de um mês. */
function enesimoDiaSemana(ano: number, mes: number, diaSemana: number, n: number): string {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dia = 1 + ((diaSemana - primeiro + 7) % 7) + (n - 1) * 7;
  return montar(ano, mes, dia);
}

/** Data em que a campanha cai num determinado ano. */
export function ocorrenciaNoAno(d: Pick<DataComercial, 'regra' | 'mes' | 'dia'>, ano: number): string {
  switch (d.regra) {
    case 'pascoa':       return pascoaDoAno(ano);
    case 'carnaval':     return somarDias(pascoaDoAno(ano), -47);
    case 'dia_das_maes': return enesimoDiaSemana(ano, 5, 0, 2);
    case 'dia_dos_pais': return enesimoDiaSemana(ano, 8, 0, 2);
    // Black Friday = sexta depois da 4ª quinta de novembro (nem sempre é a 4ª sexta).
    case 'black_friday': return somarDias(enesimoDiaSemana(ano, 11, 4, 4), 1);
    default: {
      const mes = d.mes ?? 1;
      const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
      return montar(ano, mes, Math.min(d.dia ?? 1, ultimo));
    }
  }
}

/** Próxima vez que a data acontece (hoje conta). */
export function proximaOcorrencia(d: Pick<DataComercial, 'regra' | 'mes' | 'dia'>, hoje = hojeISO()): string {
  const ano = +hoje.slice(0, 4);
  const esteAno = ocorrenciaNoAno(d, ano);
  return esteAno >= hoje ? esteAno : ocorrenciaNoAno(d, ano + 1);
}

/** Se hoje está dentro da janela de aviso, devolve a data e quantos dias faltam. */
export function janelaDeAviso(d: DataComercial, hoje = hojeISO()): { dataISO: string; dias: number } | null {
  if (!d.ativa) return null;
  const alvo = proximaOcorrencia(d, hoje);
  const dias = diasEntre(hoje, alvo);
  return dias >= 0 && dias <= d.dias_antecedencia ? { dataISO: alvo, dias } : null;
}

/** Mesmo período, um ano antes: dos "dias de antecedência" até o dia da data. */
export function periodoAnoAnterior(d: DataComercial, ocorrenciaISO: string): { ini: string; fim: string } {
  const fim = ocorrenciaNoAno(d, +ocorrenciaISO.slice(0, 4) - 1);
  return { ini: somarDias(fim, -d.dias_antecedencia), fim };
}

export function textoDias(dias: number): string {
  if (dias === 0) return 'é hoje';
  if (dias === 1) return 'é amanhã';
  return `em ${dias} dias`;
}

export function fmtDataCurta(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
