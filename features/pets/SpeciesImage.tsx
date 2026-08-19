'use client';

import { useState } from 'react';

/**
 * L'immagine attesa vive in public/pets/<speciesKey>.png (fornita dall'
 * utente, non generata). Se il file manca (404), l'onError sostituisce con
 * l'emoji del catalogo — l'app funziona da subito, ogni file caricato col
 * nome giusto sostituisce l'emoji senza toccare codice. Il filtro CSS di
 * un'eventuale skin attiva (F4.2) si applica identico su entrambi i rami.
 */
export function SpeciesImage({
  speciesKey,
  emoji,
  alt,
  className,
  filter,
}: {
  speciesKey: string;
  emoji: string;
  alt: string;
  className?: string;
  filter?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = filter ? { filter } : undefined;

  if (failed) {
    return (
      <span className={className} style={style} role="img" aria-label={alt}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`/pets/${speciesKey}.png`}
      alt={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
