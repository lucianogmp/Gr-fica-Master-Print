// Controle da tela inicial: o sistema volta para o login (com o versículo do dia)
// na primeira abertura de cada dia e depois de 30 minutos sem uso.

export const LIMITE_INATIVIDADE_MS = 30 * 60 * 1000;
const CHAVE_ATIVIDADE = 'mp-ultima-atividade';
const CHAVE_MOTIVO = 'mp-motivo-login';

export type MotivoLogin = 'inatividade' | 'novo-dia';

function diaLocal(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function lerAtividade(): number | null {
  try {
    const v = Number(localStorage.getItem(CHAVE_ATIVIDADE));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

export function registrarAtividade() {
  try { localStorage.setItem(CHAVE_ATIVIDADE, String(Date.now())); } catch { /* ignora */ }
}

export function limparAtividade() {
  try { localStorage.removeItem(CHAVE_ATIVIDADE); } catch { /* ignora */ }
}

/** Retorna o motivo pelo qual a sessão deve pedir login de novo, ou null se está tudo certo. */
export function motivoDeExpiracao(): MotivoLogin | null {
  const ultima = lerAtividade();
  if (!ultima) return null;
  const agora = Date.now();
  if (diaLocal(ultima) !== diaLocal(agora)) return 'novo-dia';
  if (agora - ultima > LIMITE_INATIVIDADE_MS) return 'inatividade';
  return null;
}

export function guardarMotivo(m: MotivoLogin) {
  try { localStorage.setItem(CHAVE_MOTIVO, m); } catch { /* ignora */ }
}

export function lerEApagarMotivo(): MotivoLogin | null {
  try {
    const m = localStorage.getItem(CHAVE_MOTIVO) as MotivoLogin | null;
    localStorage.removeItem(CHAVE_MOTIVO);
    return m;
  } catch { return null; }
}

// Avaliado uma única vez, assim que o sistema é carregado (antes de qualquer atividade ser registrada).
// IMPORTANTE: só vale para a abertura da página. Antes ele continuava "expirado" pelo resto da
// vida da aba: no celular (aba mantida em memória) a pessoa logava e, ao montar a próxima tela,
// o sistema achava que ainda era a abertura expirada e deslogava de novo — o loop de login.
const CARREGADO_EM = Date.now();
const JANELA_ABERTURA_MS = 10_000;
let expirouAoAbrir: MotivoLogin | null = motivoDeExpiracao();

/** Motivo de expiração da abertura da página (só nos primeiros segundos, e só até o login). */
export function expirouAoAbrirAgora(): MotivoLogin | null {
  if (Date.now() - CARREGADO_EM > JANELA_ABERTURA_MS) return null;
  return expirouAoAbrir;
}

/** Chamar quando a pessoa faz login: a expiração da abertura já foi tratada. */
export function limparExpiracaoAoAbrir() {
  expirouAoAbrir = null;
  registrarAtividade();
}
