'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { toUserMessage } from '@/lib/rpc';

type Options<T> = {
  /** Tabelle da osservare: una modifica su qualsiasi di queste provoca un ri-scarico. */
  tables: string[];
  fetcher: () => Promise<T>;
  /** Iniettabile solo per i test. */
  client?: SupabaseClient;
};

export type RealtimeQuery<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  offline: boolean;
  refetch: () => void;
};

/**
 * Fetch iniziale, sottoscrizione Realtime, e ri-scarico quando la rete torna.
 *
 * Il ri-scarico completo a ogni evento, invece dell'applicazione incrementale
 * della modifica ricevuta, è deliberato: con due utenti il costo è irrilevante e
 * la correttezza è banale — non esiste stato locale che possa divergere dal database.
 */
export function useRealtimeQuery<T>({ tables, fetcher, client }: Options<T>): RealtimeQuery<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // Il fetcher è una closure che cambia a ogni render: tenerlo in un ref evita
  // di ricreare la sottoscrizione Realtime a ogni render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Guardiano di sequenza: al montaggio partono due caricamenti quasi in
  // contemporanea (fetch diretto + ri-scarico su SUBSCRIBED), con latenze
  // potenzialmente diverse. Senza un numero di esecuzione, la risposta più
  // lenta può arrivare per ultima e sovrascrivere dati più freschi già
  // mostrati. Ogni load() prende un numero progressivo e, prima di scrivere
  // qualunque stato, verifica di essere ancora l'esecuzione più recente: se
  // nel frattempo ne è partita un'altra, esce senza toccare nulla.
  const runIdRef = useRef(0);

  // Ogni istanza dell'hook ha il proprio canale, anche se osserva le stesse
  // tabelle di un'altra istanza altrove nell'albero: Supabase riusa lo stesso
  // oggetto canale per topic identici, e una seconda chiamata a .on() su un
  // canale già in fase di join/joined lancia un'eccezione. Scoperto quando
  // useActiveTheme (F6) e useCoins hanno iniziato a osservare entrambi
  // couple_state nello stesso albero di componenti (AppChrome), facendo
  // crashare l'intera app. useId() è stabile per il ciclo di vita del
  // componente e univoco per istanza, esattamente ciò che serve qui — non è
  // un problema di correttezza dei dati (nessuno stato condiviso fra istanze),
  // solo di identità del canale lato client.
  const instanceId = useId();

  const load = useCallback(async () => {
    const runId = ++runIdRef.current;
    try {
      const next = await fetcherRef.current();
      if (runId !== runIdRef.current) return;
      setData(next);
      setError(null);
      setOffline(false);
    } catch (thrown) {
      if (runId !== runIdRef.current) return;
      // I dati precedenti restano visibili: meglio qualcosa di vecchio che una schermata vuota.
      setError(toUserMessage({ message: thrown instanceof Error ? thrown.message : '' }));
      if (typeof navigator !== 'undefined' && !navigator.onLine) setOffline(true);
    } finally {
      if (runId === runIdRef.current) setLoading(false);
    }
  }, []);

  const key = tables.join(',');

  useEffect(() => {
    const supabase = client ?? getSupabase();
    void load();
    setOffline(typeof navigator !== 'undefined' && !navigator.onLine);

    let channel = supabase.channel(`rt:${key}:${instanceId}`);
    for (const table of key.split(',')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => void load(),
      );
    }
    // Al ritorno della sottoscrizione dopo una disconnessione, lo stato locale
    // può aver perso eventi: si ri-scarica invece di fidarsi.
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') void load();
    });

    const onOnline = () => {
      setOffline(false);
      void load();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [key, load, client]);

  return { data, error, loading, offline, refetch: () => void load() };
}
