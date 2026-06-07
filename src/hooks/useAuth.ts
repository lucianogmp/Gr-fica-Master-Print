// src/hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string | null;          // campo direto para conveniência
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
    // app_metadata tem precedência
    role:  appMeta.role ?? userMeta.role ?? null,
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