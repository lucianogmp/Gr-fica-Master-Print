// Logo da gráfica (o que for enviado em Configurações → Empresa), guardado no aparelho
// para aparecer na hora — inclusive na tela de "Carregando" do F5 e no login, antes da
// configuração chegar do servidor. Não existe logo "do sistema" fixo no código.
export const CHAVE_LOGO = 'mp-logo-cache';

export interface LogoCache { escuro: string | null; claro: string | null }

export function lerLogoCache(): LogoCache {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE_LOGO) || '');
    return { escuro: j?.escuro ?? null, claro: j?.claro ?? null };
  } catch { return { escuro: null, claro: null }; }
}

export function salvarLogoCache(l: LogoCache) {
  try { localStorage.setItem(CHAVE_LOGO, JSON.stringify(l)); } catch { /* ignora */ }
}

/** Escolhe a imagem de cada tema: a específica do tema, senão a da empresa, senão a outra versão. */
export function logosDaConfig(c?: { sistema_logo_url?: string | null; sistema_logo_url_dark?: string | null; empresa_logo_url?: string | null } | null): LogoCache {
  const esc = c?.sistema_logo_url || null;
  const cla = c?.sistema_logo_url_dark || null;
  const emp = c?.empresa_logo_url || null;
  return { escuro: esc || emp || cla, claro: cla || emp || esc };
}

export function temaAtualEscuro(): boolean {
  return (document.documentElement.getAttribute('data-theme') ?? 'dark') !== 'light';
}
