import type { PetKind, Species, SpeciesStat } from './species';

/** Riga della tabella pets — stessa forma anche in features/pets/queries.ts. */
export type Pet = {
  species_key: string;
  kind: PetKind;
  nickname: string | null;
  stats: Record<string, number>;
  updated_at: string;
  unlocked_at: string;
  active_skin: string | null;
};

export const CARE_BOOST = 40;
export const NEEDS_ATTENTION_THRESHOLD = 30;

/** Statistiche iniziali (100) per ogni voce del catalogo della specie. */
export function initialStatsFor(species: Species): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const stat of Object.keys(species.decayPerHour)) stats[stat] = 100;
  return stats;
}

/**
 * Proietta le statistiche correnti a partire dall'ultimo valore salvato +
 * il tempo trascorso, usando i tassi per specie del catalogo — nessun tick
 * lato server, stesso principio del countdown di Trivia.
 */
export function projectStats(pet: Pet, species: Species, now: Date = new Date()): Record<string, number> {
  const elapsedHours = (now.getTime() - new Date(pet.updated_at).getTime()) / 3_600_000;
  const projected: Record<string, number> = {};
  for (const [stat, value] of Object.entries(pet.stats)) {
    const rate = species.decayPerHour[stat as SpeciesStat] ?? 0;
    projected[stat] = Math.max(0, Math.min(100, value - rate * elapsedHours));
  }
  return projected;
}

/** Alza una statistica di CARE_BOOST punti, clampata a 100. */
export function applyCareAction(stats: Record<string, number>, stat: string): Record<string, number> {
  return { ...stats, [stat]: Math.min(100, (stats[stat] ?? 0) + CARE_BOOST) };
}

/** Vero se almeno una statistica è sotto la soglia di attenzione. */
export function needsAttention(stats: Record<string, number>): boolean {
  return Object.values(stats).some((value) => value < NEEDS_ATTENTION_THRESHOLD);
}
