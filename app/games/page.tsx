import Link from 'next/link';
import styles from '@/features/games/games.module.css';

const GAMES = [
  { slug: 'tic-tac-toe', label: 'Tic-tac-toe', available: true },
  { slug: 'connect-four', label: 'Connect 4', available: true },
  { slug: 'blackjack', label: 'Blackjack', available: false },
  { slug: 'trivia', label: 'Trivia', available: true },
  { slug: 'goose', label: 'Goose Game', available: true },
  { slug: 'quoridor', label: 'Quoridor', available: true },
  { slug: 'backgammon', label: 'Backgammon', available: true },
];

export default function GamesPage() {
  return (
    <div className={styles.list}>
      {GAMES.map((game) =>
        game.available ? (
          <Link key={game.slug} href={`/games/${game.slug}`} className={styles.gameCard}>
            {game.label}
          </Link>
        ) : (
          <div key={game.slug} className={styles.gameCardDisabled}>
            {game.label}
            <span className={styles.soon}>Coming soon</span>
          </div>
        ),
      )}
    </div>
  );
}
