'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { Person } from '@/features/auth/identity';
import type { Species } from './species';
import type { Pet } from './care';
import { initialStatsFor, projectStats, needsAttention } from './care';
import { unlockPet } from './queries';
import { SpeciesImage } from './SpeciesImage';
import { skinFilterFor } from './skins';
import { useNow } from './useNow';
import styles from './pets.module.css';

export function PetCard({
  species,
  pet,
  cost,
  who,
}: {
  species: Species;
  pet: Pet | undefined;
  cost: number | undefined;
  who: Person;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stessa guardia sincrona degli altri giochi/acquisti: il `disabled` da
  // solo non basta fra due tocchi molto ravvicinati.
  const sending = useRef(false);
  // Chiamato incondizionatamente (prima di ogni return): le regole dei
  // hook di React non permettono di chiamarlo solo nel ramo "sbloccata".
  const now = useNow();

  async function unlock() {
    if (sending.current || cost === undefined) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await unlockPet(who, species.key, species.kind, initialStatsFor(species));
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  if (!pet) {
    return (
      <div className={styles.card} data-testid={`pet-card-${species.key}`}>
        <Link href={`/pets/${species.key}`} className={styles.cardLink}>
          <SpeciesImage speciesKey={species.key} emoji={species.emoji} alt={species.name} className={styles.imageLocked} />
          <p className={styles.name}>{species.name}</p>
        </Link>
        <button type="button" className={styles.action} onClick={unlock} disabled={busy || cost === undefined}>
          {busy ? 'Unlocking…' : cost === undefined ? 'Unlock' : `Unlock for ${cost} coins`}
        </button>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const stats = projectStats(pet, species, now);
  const needy = needsAttention(stats);

  return (
    <Link
      href={`/pets/${species.key}`}
      className={`${styles.card} ${needy ? styles.needy : ''}`}
      data-testid={`pet-card-${species.key}`}
    >
      <SpeciesImage
        speciesKey={species.key}
        emoji={species.emoji}
        alt={pet.nickname ?? species.name}
        className={styles.image}
        filter={skinFilterFor(pet.active_skin)}
      />
      <p className={styles.name}>{pet.nickname ?? species.name}</p>
      {needy && <span className={styles.needyBadge}>Needs attention</span>}
    </Link>
  );
}
