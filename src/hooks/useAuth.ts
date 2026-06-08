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
    supabase.auth.getSession().then(({ data }) => {
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
