'use client';

import { useState } from 'react';

/**
 * L'immagine attesa vive in public/pets/<speciesKey>.png (fornita dall'
 * utente, non generata). Se il file manca (404), l'onError sostituisce con
 * l'emoji del catalogo — l'app funziona da subito, ogni file caricato col
 * nome giusto sostituisce l'emoji senza toccare codice.
 */
export function SpeciesImage({
  speciesKey,
  emoji,
  alt,
  className,
}: {
  speciesKey: string;
  emoji: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={className} role="img" aria-label={alt}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`/pets/${speciesKey}.png`}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
