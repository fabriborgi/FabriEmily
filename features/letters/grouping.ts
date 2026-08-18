import type { Person } from '@/features/auth/identity';
import type { Letter } from './queries';

/** "August 2026". Le etichette sono interfaccia, quindi in inglese. */
const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export function groupByMonth(letters: Letter[]): Array<{ label: string; letters: Letter[] }> {
  const groups: Array<{ label: string; letters: Letter[] }> = [];
  for (const letter of letters) {
    const label = monthLabel(letter.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.letters.push(letter);
    else groups.push({ label, letters: [letter] });
  }
  return groups;
}

/** Le proprie lettere non sono mai "non lette": si scrivono già sapendo cosa dicono. */
export const isUnread = (letter: Letter, who: Person): boolean =>
  letter.read_at === null && letter.author !== who;

/** Dalla più vecchia: si aprono nell'ordine in cui sono state scritte. */
export const unreadFor = (letters: Letter[], who: Person): Letter[] =>
  letters
    .filter((letter) => isUnread(letter, who))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
