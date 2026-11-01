// src/hooks/useAuth.ts
//
// SEGURANÇA: a função mapUser expõe app_metadata e user_metadata separados
// para que os consumidores possam acessar cada um conscientemente.
//
// A propriedade `role` aqui é APENAS para conveniência de exibição (nome,
// avatar). Decisões de autorização devem usar useRole(), que lê
// exclusivamente app_metadata.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { EXPIROU_AO_ABRIR, guardarMotivo, limparAtividade } from '../lib/sessaoInatividade';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  // ATENÇÃO: use useRole() para autorização — não este campo.
  // Este campo é derivado de app_metadata e serve só para exibição.
  role: string | null;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
}

function mapUser(u: User): AuthUser {
  const appMeta  = u.app_metadata  ?? {};
  const userMeta = u.user_metadata ?? {};

  return {
    id:    u.id,
    email: u.email ?? '',
    name:  userMeta.nome ?? userMeta.name ?? u.email ?? 'Usuário',
    // role vem APENAS de app_metadata — nunca de user_metadata
    role:  appMeta.role ?? null,
    user_metadata: userMeta,
    app_metadata:  appMeta,
  };
}

export function useAuth() {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      // Primeira abertura do dia / mais de 30 min parado: volta para o login.
      if (data.session && EXPIROU_AO_ABRIR) {
        guardarMotivo(EXPIROU_AO_ABRIR);
        limparAtividade();
        try { sessionStorage.removeItem('mp-sessao-iniciada'); } catch { /* ignora */ }
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(data.session?.user ? mapUser(data.session.user) : null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ? mapUser(session.user) : null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
