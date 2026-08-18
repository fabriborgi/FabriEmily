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

    // getSession() e onAuthStateChange sono due sorgenti indipendenti che
    // possono risolvere/emettere in qualunque ordine. Senza guardia vince
    // l'ultima che risolve, non l'ultima che è vera: un SIGNED_OUT arrivato
    // per primo verrebbe sovrascritto dalla getSession() partita al montaggio
    // (quando la sessione esisteva ancora) se questa risolve dopo, resuscitando
    // una sessione appena chiusa. `sawAuthEvent` fa sì che, una volta arrivato
    // un evento reale, la risoluzione di getSession() venga ignorata; `cancelled`
    // fa lo stesso se il componente è già stato smontato.
    let sawAuthEvent = false;
    let cancelled = false;

    const decide = (hasSession: boolean) => {
      if (!hasSession) return setStage('login');
      const stored = readIdentity(window.localStorage);
      setWho(stored);
      setStage(stored ? 'ready' : 'identity');
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (sawAuthEvent || cancelled) return;
      decide(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // auth-js emette SEMPRE un INITIAL_SESSION poco dopo la sottoscrizione
      // (vedi GoTrueClient.js) e, se durante l'inizializzazione incontra un
      // errore transitorio — incluso un AuthRetryableFetchError, cioè un
      // guasto di rete passeggero — lo emette con session: null anche quando
      // una sessione valida esiste davvero. Non è quindi un'affermazione
      // affidabile sullo stato: se lo trattassimo come un evento reale
      // bloccheremmo per sempre la getSession() ancora in volo (quella che
      // sta per portare la sessione vera), e l'utente resterebbe bloccato
      // sul login pur avendo una sessione valida. Per questo lo ignoriamo
      // del tutto — non alza sawAuthEvent e non decide nulla — mentre ogni
      // altro evento (SIGNED_OUT, SIGNED_IN, o un INITIAL_SESSION che porta
      // davvero una sessione) resta un segnale reale che deve vincere su una
      // getSession() tardiva, com'era già garantito prima di questo fix.
      const isUnreliableInitialSession = event === 'INITIAL_SESSION' && !session;
      if (isUnreliableInitialSession) return;
      sawAuthEvent = true;
      decide(Boolean(session));
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
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
