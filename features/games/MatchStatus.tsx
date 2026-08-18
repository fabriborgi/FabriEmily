import { displayName, partnerOf, type Person } from '@/features/auth/identity';
import styles from './games.module.css';

/** Generico e riusabile da ogni gioco: non sa nulla delle regole, solo di chi ha il turno. */
export function MatchStatus({ currentTurn, who }: { currentTurn: Person; who: Person }) {
  const mine = currentTurn === who;
  return <p className={styles.status}>{mine ? 'Your turn' : `Waiting for ${displayName(partnerOf(who))}`}</p>;
}
