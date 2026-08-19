'use client';

import { useParams } from 'next/navigation';
import { useIdentity } from '@/features/auth/IdentityProvider';
import { usePets } from '@/features/pets/usePets';
import { SPECIES } from '@/features/pets/species';
import { PetDetail } from '@/features/pets/PetDetail';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineStrip } from '@/components/ui/OfflineStrip';
import styles from '@/features/pets/pets.module.css';

export default function PetDetailPage() {
  const { species: speciesKey } = useParams<{ species: string }>();
  const { who } = useIdentity();
  const { data, loading, offline, error } = usePets();

  const species = SPECIES.find((s) => s.key === speciesKey);
  if (!species) return <EmptyState title="Not found" body="That species doesn't exist." />;
  if (loading && !data) return <p>Loading…</p>;

  const pet = data?.pets.find((p) => p.species_key === speciesKey);

  return (
    <>
      {offline && <OfflineStrip />}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <PetDetail species={species} pet={pet} prices={data?.prices ?? {}} ownedSkins={data?.ownedSkins ?? []} who={who} />
    </>
  );
}
