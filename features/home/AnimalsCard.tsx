'use client';

import Link from 'next/link';
import { usePets } from '@/features/pets/usePets';
import { SPECIES } from '@/features/pets/species';
import { projectStats, needsAttention } from '@/features/pets/care';
import { useNow } from '@/features/pets/useNow';
import styles from './home.module.css';

export function AnimalsCard() {
  const { data, error } = usePets();
  // Chiamato incondizionatamente (prima di ogni return): le regole dei
  // hook di React non permettono di chiamarlo solo in alcuni rami.
  const now = useNow();
  const pets = data?.pets ?? [];

  const errorBanner = error && (
    <p className={styles.error} role="alert">
      {error}
    </p>
  );

  if (pets.length === 0) {
    return (
      <>
        {errorBanner}
        <div className={styles.slot}>
          <p className={styles.slotTitle}>Your animals</p>
          <p className={styles.slotBody}>Unlock your first animal or plant to start caring for it.</p>
        </div>
      </>
    );
  }

  const needy = pets.filter((pet) => {
    const species = SPECIES.find((s) => s.key === pet.species_key);
    return species !== undefined && needsAttention(projectStats(pet, species, now));
  });

  if (needy.length === 0) {
    return (
      <>
        {errorBanner}
        <div className={styles.slot}>
          <p className={styles.slotTitle}>Your animals</p>
          <p className={styles.slotBody}>Everyone&rsquo;s doing well.</p>
        </div>
      </>
    );
  }

  const names = needy.map((pet) => {
    const species = SPECIES.find((s) => s.key === pet.species_key)!;
    return pet.nickname ?? species.name;
  });

  return (
    <>
      {errorBanner}
      <Link href="/pets" className={styles.slot}>
        <p className={styles.slotTitle}>Your animals</p>
        <p className={styles.slotBody}>
          {names.join(', ')} need{names.length === 1 ? 's' : ''} attention.
        </p>
      </Link>
    </>
  );
}
