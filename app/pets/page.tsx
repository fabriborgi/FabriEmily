'use client';

import { useIdentity } from '@/features/auth/IdentityProvider';
import { usePets } from '@/features/pets/usePets';
import { SPECIES } from '@/features/pets/species';
import { PetCard } from '@/features/pets/PetCard';
import { OfflineStrip } from '@/components/ui/OfflineStrip';
import styles from '@/features/pets/pets.module.css';

export default function PetsPage() {
  const { who } = useIdentity();
  const { data, loading, offline } = usePets();

  if (loading && !data) return <p className={styles.muted}>Loading…</p>;

  const pets = data?.pets ?? [];
  const prices = data?.prices ?? {};
  const animals = SPECIES.filter((s) => s.kind === 'animal');
  const plants = SPECIES.filter((s) => s.kind === 'plant');

  return (
    <>
      {offline && <OfflineStrip />}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Animals</h2>
        <div className={styles.grid}>
          {animals.map((s) => (
            <PetCard key={s.key} species={s} pet={pets.find((p) => p.species_key === s.key)} cost={prices[s.key]} who={who} />
          ))}
        </div>
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Plants</h2>
        <div className={styles.grid}>
          {plants.map((s) => (
            <PetCard key={s.key} species={s} pet={pets.find((p) => p.species_key === s.key)} cost={prices[s.key]} who={who} />
          ))}
        </div>
      </section>
    </>
  );
}
