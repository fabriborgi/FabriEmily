import type { Person } from '@/features/auth/identity';
import type { Letter } from './queries';
import { monthLabel } from './dates';

/**
 * Raggruppa per mese conservando l'ordine di arrivo delle lettere.
 *
 * Usa una Map invece di confrontare solo con l'ultimo gruppo: la versione
 * ingenua produce due gruppi "August 2026" separati se la lista non e'
 * ordinata, e l'ordinamento della lista e' una precondizione implicita che
 * niente qui puo' garantire. Le Map conservano l'ordine di inserimento,
 * quindi per una lista gia' ordinata il risultato e' identico.
 */
export function groupByMonth(letters: Letter[]): Array<{ label: string; letters: Letter[] }> {
  const groups = new Map<string, Letter[]>();
  for (const letter of letters) {
    const label = monthLabel(letter.created_at);
    const existing = groups.get(label);
    if (existing) existing.push(letter);
    else groups.set(label, [letter]);
  }
  return Array.from(groups, ([label, group]) => ({ label, letters: group }));
}

/** Le proprie lettere non sono mai "non lette": si scrivono già sapendo cosa dicono. */
export const isUnread = (letter: Letter, who: Person): boolean =>
  letter.read_at === null && letter.author !== who;

/** Dalla più vecchia: si aprono nell'ordine in cui sono state scritte. */
export const unreadFor = (letters: Letter[], who: Person): Letter[] =>
  letters
    .filter((letter) => isUnread(letter, who))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
