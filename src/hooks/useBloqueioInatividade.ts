// Com o sistema aberto: acompanha o uso e, após 30 min sem mexer em nada,
// encerra a sessão e volta para a tela inicial (login).
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  registrarAtividade, motivoDeExpiracao, guardarMotivo, limparAtividade,
} from '../lib/sessaoInatividade';
import { limparAlteracoesPendentes } from '../lib/unsavedChangesGuard';
import { salvarRascunhosPendentes } from '../lib/rascunhosInatividade';

export function useBloqueioInatividade() {
  useEffect(() => {
    registrarAtividade();
    let ultimoRegistro = Date.now();
    const aoUsar = () => {
      const agora = Date.now();
      if (agora - ultimoRegistro > 5000) { ultimoRegistro = agora; registrarAtividade(); }
    };
    const eventos: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    eventos.forEach(e => window.addEventListener(e, aoUsar, { passive: true, capture: true }));

    async function verificar() {
      const motivo = motivoDeExpiracao();
      if (!motivo) return;
      // Antes de fechar: guarda o que estava aberto e sem salvar (orçamento/venda/produto),
      // pra poder recuperar ao entrar de novo.
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user?.id) salvarRascunhosPendentes(data.session.user.id);
      } catch { /* segue sem guardar */ }
      guardarMotivo(motivo);
      limparAtividade();
      limparAlteracoesPendentes();
      try { sessionStorage.removeItem('mp-sessao-iniciada'); } catch { /* ignora */ }
      await supabase.auth.signOut();
    }
    const id = setInterval(verificar, 15_000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') verificar(); };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      eventos.forEach(e => window.removeEventListener(e, aoUsar, { capture: true } as any));
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, []);
}
