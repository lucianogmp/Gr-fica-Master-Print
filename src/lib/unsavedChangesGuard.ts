// src/lib/unsavedChangesGuard.ts
//
// Guarda simples e global (fora do React) pra avisar quando a pessoa tenta
// sair de uma tela com alterações não salvas — seja clicando em outra aba
// do menu, seja fechando/recarregando a aba do navegador.
//
// Não é Context porque quem precisa ler isso (o clique no menu lateral)
// precisa de uma resposta SÍNCRONA no exato instante do clique, sem
// esperar um re-render. Um objeto mutável simples resolve isso.

interface GuardaAlteracoes {
  mensagem: string | null;
}

export const unsavedChangesGuard: GuardaAlteracoes = { mensagem: null };

export function marcarAlteracoesPendentes(mensagem: string) {
  unsavedChangesGuard.mensagem = mensagem;
}

export function limparAlteracoesPendentes() {
  unsavedChangesGuard.mensagem = null;
}

/**
 * Pergunta (via confirm nativo) se pode navegar apesar das alterações
 * pendentes. Sem alterações pendentes, libera direto sem perguntar nada.
 */
export function podeSairSemSalvar(): boolean {
  if (!unsavedChangesGuard.mensagem) return true;
  const pode = window.confirm(unsavedChangesGuard.mensagem);
  if (pode) limparAlteracoesPendentes();
  return pode;
}

// Fechar a aba/janela ou dar F5 com alterações pendentes — aviso nativo do
// navegador (o texto customizado não aparece mais nos navegadores atuais
// por segurança, mas o aviso genérico do próprio navegador aparece).
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (unsavedChangesGuard.mensagem) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}
