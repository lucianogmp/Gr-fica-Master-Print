import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

// Estende a interface User do Supabase para incluir o campo name
interface AuthUser extends User {
  user_metadata?: {
    name?: string;
  };
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user as AuthUser ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user as AuthUser ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user: user ? { ...user, name: user.user_metadata?.name || user.email } : null, loading };
}