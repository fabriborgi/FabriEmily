'use client';

import { useRef, useState } from 'react';
import type { Person } from '@/features/auth/identity';
import type { Species, SpeciesStat } from './species';
import { STAT_LABELS } from './species';
import type { Pet } from './care';
import { initialStatsFor, projectStats, applyCareAction } from './care';
import { unlockPet, careForPet, renamePet } from './queries';
import { skinFilterFor } from './skins';
import { useNow } from './useNow';
import { SpeciesImage } from './SpeciesImage';
import { SkinPicker } from './SkinPicker';
import styles from './pets.module.css';

export function PetDetail({
  species,
  pet,
  prices,
  ownedSkins,
  who,
}: {
  species: Species;
  pet: Pet | undefined;
  prices: Record<string, number>;
  ownedSkins: string[];
  who: Person;
}) {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(pet?.nickname ?? '');
  const sending = useRef(false);
  const cost = prices[species.key];

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

  async function care(stat: SpeciesStat) {
    if (sending.current || !pet) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const next = applyCareAction(projectStats(pet, species, now), stat);
    const { error: failure } = await careForPet(who, species.key, next);
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  async function rename() {
    if (sending.current || !pet) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const { error: failure } = await renamePet(species.key, nameDraft);
    setBusy(false);
    sending.current = false;
    if (failure) setError(failure);
  }

  if (!pet) {
    return (
      <div className={styles.detail}>
        <SpeciesImage speciesKey={species.key} emoji={species.emoji} alt={species.name} className={styles.imageLocked} />
        <p className={styles.name}>{species.name}</p>
        <p className={styles.curiosity}>{species.curiosity}</p>
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
  const statKeys = Object.keys(species.decayPerHour) as SpeciesStat[];

  return (
    <div className={styles.detail}>
      <SpeciesImage
        speciesKey={species.key}
        emoji={species.emoji}
        alt={pet.nickname ?? species.name}
        className={styles.image}
        filter={skinFilterFor(pet.active_skin)}
      />
      <div className={styles.renameRow}>
        <input
          className={styles.nameInput}
          value={nameDraft}
          placeholder={species.name}
          onChange={(e) => setNameDraft(e.target.value)}
          maxLength={40}
        />
        <button type="button" className={styles.renameAction} onClick={rename} disabled={busy}>
          Save name
        </button>
      </div>
      <p className={styles.curiosity}>{species.curiosity}</p>
      <div className={styles.stats}>
        {statKeys.map((stat) => (
          <div key={stat} className={styles.statRow}>
            <span className={styles.statLabel}>{stat}</span>
            <span>{Math.round(stats[stat])}</span>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        {statKeys.map((stat) => (
          <button key={stat} type="button" className={styles.action} onClick={() => care(stat)} disabled={busy}>
            {STAT_LABELS[stat]}
          </button>
        ))}
      </div>
      <SkinPicker
        speciesKey={species.key}
        activeSkin={pet.active_skin}
        ownedSkins={ownedSkins}
        prices={prices}
        who={who}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
