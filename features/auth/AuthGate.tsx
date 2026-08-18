'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { readIdentity, writeIdentity, type Person } from './identity';
import { IdentityProvider } from './IdentityProvider';
import { IdentityChooser } from './IdentityChooser';
import { LoginForm } from './LoginForm';

type Stage = 'checking' | 'login' | 'identity' | 'ready';

/**
 * Non è una guardia di sicurezza: i dati sono protetti dalle RLS, non dal routing.
 * Serve a non mostrare un'app vuota a chi non ha ancora una sessione o un'identità.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('checking');
  const [who, setWho] = useState<Person | null>(null);

  useEffect(() => {
    const supabase = getSupabase();

    const decide = (hasSession: boolean) => {
      if (!hasSession) return setStage('login');
      const stored = readIdentity(window.localStorage);
      setWho(stored);
      setStage(stored ? 'ready' : 'identity');
    };

    void supabase.auth.getSession().then(({ data }) => decide(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      decide(Boolean(session)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (stage === 'checking') return null;
  if (stage === 'login') return <LoginForm onSuccess={() => setStage('identity')} />;
  if (stage === 'identity' || !who) {
    return (
      <IdentityChooser
        onChoose={(chosen) => {
          writeIdentity(window.localStorage, chosen);
          setWho(chosen);
          setStage('ready');
        }}
      />
    );
  }
  return <IdentityProvider initial={who}>{children}</IdentityProvider>;
}
