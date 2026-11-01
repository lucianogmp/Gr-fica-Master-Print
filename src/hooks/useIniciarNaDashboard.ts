// src/hooks/useIniciarNaDashboard.ts
//
// Ao ABRIR o sistema (aba nova, app instalado no celular, link salvo nos favoritos),
// sempre começa no Dashboard — só para quem tem acesso a ele. Quem não tem (ex.:
// vendedor, que já cai direto em Pedidos pela rota "/") não é forçado a nada.
// Atualizar a página (F5) com o sistema já aberto na aba NÃO volta pro Dashboard:
// o "já abri" fica guardado na sessão da aba.

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRole } from './useRole';

const CHAVE = 'mp-sessao-iniciada';

export function useIniciarNaDashboard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role, pode } = useRole();

  useEffect(() => {
    let jaIniciou = false;
    try { jaIniciou = sessionStorage.getItem(CHAVE) === '1'; } catch { /* sem storage: age só uma vez por carregamento */ }
    if (jaIniciou) return;
    // Espera saber o cargo pra decidir (evita marcar como iniciado antes da hora).
    if (!role) return;
    try { sessionStorage.setItem(CHAVE, '1'); } catch { /* ignora */ }
    if (pathname !== '/' && role !== 'vendedor' && pode('/')) {
      navigate('/', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);
}
