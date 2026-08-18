'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { clearIdentity, partnerOf, writeIdentity, type Person } from './identity';

type IdentityValue = {
  who: Person;
  partner: Person;
  setWho: (who: Person) => void;
  forget: () => void;
};

const IdentityContext = createContext<IdentityValue | null>(null);

export function IdentityProvider({ initial, children }: { initial: Person; children: ReactNode }) {
  const [who, setWhoState] = useState<Person>(initial);

  const value = useMemo<IdentityValue>(
    () => ({
      who,
      partner: partnerOf(who),
      setWho: (next) => {
        // writeIdentity non lancia mai (vedi identity.ts): se il salvataggio
        // fallisce, l'identità cambia comunque per la sessione corrente e
        // verrà richiesta di nuovo alla prossima apertura.
        writeIdentity(window.localStorage, next);
        setWhoState(next);
      },
      forget: () => clearIdentity(window.localStorage),
    }),
    [who],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): IdentityValue {
  const value = useContext(IdentityContext);
  if (!value) throw new Error('useIdentity va usato dentro IdentityProvider');
  return value;
}
