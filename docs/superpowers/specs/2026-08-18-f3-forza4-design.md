# F3.1 — Forza 4

Data: 2026-08-18
Stato: approvato in brainstorming, da eseguire
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Primo sotto-progetto di F3 (i giochi veri e propri), dopo F2 (motore realtime
dei giochi + Tris come gioco di riferimento) già in produzione. F3 nel suo
complesso è troppo ampio per uno spec unico — Forza 4, Blackjack, Trivia e
1-2 giochi pensati per coppie sono sottosistemi con problemi di design molto
diversi tra loro — quindi si procede un gioco alla volta. Questo è il primo:
Forza 4, scelto perché ha la stessa forma del Tris già validato (griglia,
allineamenti, avversario), il modo più economico di provare che il motore
regge un secondo gioco vero prima di affrontare i problemi di design più
grossi di Blackjack (variante a due giocatori da inventare) o Trivia
(contenuto pesante, come le 300 domande di F5).

Riusa il motore di F2 **senza modificarlo**: nessuna nuova tabella, nessuna
nuova funzione Postgres. L'unica modifica al database è una riga di
migrazione che aggiunge `'connect_four'` all'enum `game_type` già esistente.

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Dimensioni griglia | **7 colonne × 6 righe (42 celle), standard** | Le dimensioni classiche del gioco. Su viewport da 390px una cella da ~50px resta comodamente sopra i 44px di tocco minimo. |
| Rappresentazione dello stato | **`{ cells: Cell[] }` piatto, 42 elementi, indice `row * 7 + col`, riga 0 in alto** | Stessa convenzione di `features/games/ticTacToe/board.ts` — nessun nuovo pattern da imparare per chi legge il codice di entrambi i giochi. |
| Input della mossa | **Si tocca una colonna, non una cella** | Riflette la meccanica reale di Forza 4 (il pezzo cade). `isLegalMove` controlla che la colonna non sia piena; `applyMove` trova la riga libera più bassa di quella colonna. |
| Generazione delle linee di vittoria | **Calcolata a partire dalla griglia, non elencata a mano** | A differenza delle 8 linee del Tris (elencabili comodamente), un 7×6 ha decine di combinazioni di 4 allineati (orizzontali, verticali, diagonali in entrambe le direzioni) — generarle da un ciclo evita un elenco lungo e soggetto a errori di trascrizione. |
| Stato "partita appena chiusa" | **Stesso pattern corretto in F2**: la partita più recente (aperta o appena chiusa) resta visibile, il risultato compare insieme al pulsante "New game" | Non ripetere il difetto già trovato e chiuso nella review finale di F2 (la board spariva all'istante senza mostrare chi aveva vinto). |
| Riuso del motore | **`create_match`/`make_move` invariate, `MatchStatus`/`useActiveMatch`/`useGameHistory` invariati** | Sono già generici per progettazione — questo sotto-progetto è la prima prova reale di quella promessa. |

## 3. Schema dati

```sql
alter type game_type add value 'connect_four';
```

Nessun'altra modifica allo schema. `game_matches`, gli indici, le policy RLS
e la pubblicazione realtime restano quelli di F2, già corretti per qualunque
valore di `game_type`.

## 4. Funzioni

Nessuna funzione nuova. `create_match` e `make_move` (F2) funzionano già per
`'connect_four'` esattamente come per `'tic_tac_toe'`, perché non contengono
alcuna logica specifica al gioco — è precisamente il punto del motore
generico.

## 5. Frontend

```
features/games/connectFour/
  board.ts                 logica pura: colonna piena, applica una mossa (con gravità), rilevamento vittoria/pareggio — testabile isolata, senza React
  ConnectFourBoard.tsx        la griglia 7×6, l'avvio partita, il tally, l'invio delle mosse — stessa struttura di TicTacToeBoard.tsx, inclusi i tre stati (nessuna partita / board interattiva / risultato + New game)

app/games/connect-four/page.tsx    la partita vera e propria
app/games/page.tsx                  modificato: Forza 4 passa da "Coming soon" a link giocabile
```

`ConnectFourBoard.tsx` è un adattamento diretto di `TicTacToeBoard.tsx`: la
sola differenza strutturale è che i pulsanti cliccabili sono le 7 colonne (o
le celle vuote più in alto di ciascuna colonna), non le 42 celle singole —
il tocco su una colonna piena non fa nulla, indipendentemente dal turno.

## 6. Contenuto: le regole di Forza 4

Griglia 7×6, `state = { cells: (Person | null)[42] }` (indice `row * 7 +
col`, riga 0 in alto). Il simbolo di ciascun pezzo segue la stessa
convenzione del Tris: dipende da chi ha iniziato la partita (`started_by`),
non da chi guarda. Vittoria: quattro pezzi dello stesso colore allineati in
orizzontale, verticale, o in una delle due diagonali. Pareggio: griglia
piena senza vittoria. Tutta la logica vive in
`features/games/connectFour/board.ts`, pura e testabile senza React.

## 7. Errori e casi limite

Stessi codici di F2 (`match_already_open`, `not_your_turn`,
`match_already_closed`), già tradotti in `lib/rpc.ts` — nessuna aggiunta.
Un tocco su una colonna piena è un'illegalità puramente client-side (come
un tocco su una cella occupata nel Tris): il pulsante di quella colonna
resta comunque toccabile finché non è completamente piena, ma la mossa non
parte se la colonna è piena.

## 8. Test

Stesso impianto di F2:

- **Unit**: `board.ts` (colonna piena, gravità del pezzo — cade nella riga
  giusta anche con altri pezzi già presenti, rilevamento vittoria su
  orizzontali/verticali/diagonali in entrambe le direzioni, rilevamento
  pareggio) senza alcuna dipendenza da React; `ConnectFourBoard.tsx` e
  `app/games/connect-four/page.tsx`, stesso stile di
  `features/games/ticTacToe/TicTacToeBoard.test.tsx`.
- **Integrazione**: nessun test nuovo di database richiesto — `create_match`
  e `make_move` sono già testati in modo generico rispetto a `game_type` in
  F2. Un singolo test in più (o un adattamento di un test esistente di F2)
  che apre una partita con `game_type = 'connect_four'` è sufficiente a
  confermare che l'enum esteso funziona, senza duplicare l'intera suite di
  F2.

## 9. Fuori scope in questa fase

Blackjack, Trivia, e gli altri giochi pensati per coppie — restano
sotto-progetti separati di F3, con il proprio ciclo spec → piano →
implementazione. Nessuna modifica al motore di F2.

## 10. Criteri di accettazione

1. Aprendo una nuova partita di Forza 4, appare a entrambi in tempo reale.
2. Toccando una colonna nel proprio turno, il pezzo cade nella riga libera
   più bassa di quella colonna.
3. Una colonna piena non accetta altre mosse.
4. Vincendo (4 allineati in una qualunque direzione) o pareggiando (griglia
   piena), la partita si chiude e le monete si accreditano secondo
   `coin_rules`, esattamente come nel Tris.
5. La partita appena chiusa resta visibile con il risultato, non sparisce
   all'istante.
6. Non si può aprire una seconda partita di Forza 4 finché quella attiva non
   è chiusa.
7. Lo storico (vittorie Fabrizio/Emily/pareggi) di Forza 4 è indipendente da
   quello del Tris (filtrato per `game_type`).
