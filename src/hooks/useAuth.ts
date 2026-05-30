import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  user_metadata: Record<string, any>;
}

function mapUser(u: User): AuthUser {
  return {
    id:    u.id,
    email: u.email ?? '',
    name:  u.user_metadata?.nome ?? u.user_metadata?.name ?? u.email ?? 'Usuário',
    user_metadata: u.user_metadata ?? {},
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
