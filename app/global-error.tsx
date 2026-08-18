'use client';

/**
 * Ultima rete: cattura anche gli errori che avvengono nel layout radice, dove
 * un normale error boundary di segmento non arriva. Senza questo file un
 * errore all'avvio lascia il browser a mostrare la propria pagina di errore
 * ("This page couldn't load"), che non dice niente a chi la legge.
 *
 * Gli stili sono scritti qui inline invece che con i token del progetto:
 * questo componente sostituisce html e body, e deve funzionare anche quando
 * il foglio di stile dell'app non e' stato caricato. E' l'unico posto in cui
 * un colore letterale e' la scelta giusta.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Il caso piu' probabile in produzione: le variabili d'ambiente non erano
  // presenti al momento del build, quindi l'app non sa a quale database
  // parlare. Merita un messaggio suo, perche' la soluzione e' diversa.
  const isConfigError = /Missing environment variable/i.test(error.message);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeContent: 'center',
          gap: 16,
          padding: 24,
          background: '#faf6f0',
          color: '#1f2933',
          font: '400 16px/1.55 system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ font: '600 24px/1.2 ui-serif, Georgia, serif', margin: 0 }}>
          {isConfigError ? 'Almost there' : 'Something broke'}
        </h1>
        <p style={{ margin: 0, maxWidth: '32ch' }}>
          {isConfigError
            ? "This copy of the app hasn't been connected to its database yet."
            : "Sorry — the app hit an error it didn't expect."}
        </p>
        {isConfigError && (
          <p style={{ margin: 0, maxWidth: '38ch', fontSize: 13, opacity: 0.7 }}>
            {error.message}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 48,
            padding: '0 24px',
            border: 'none',
            borderRadius: 12,
            background: '#c65f52',
            color: '#ffffff',
            font: '600 17px/1.3 system-ui, sans-serif',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
