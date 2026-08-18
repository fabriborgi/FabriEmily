# F2 — Motore realtime dei giochi

Data: 2026-08-18
Stato: approvato in brainstorming, da eseguire
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Settima fase del progetto, dopo F0+F1 (fondazioni, lettere), F5 (Domande) e F6
(Shop) già in produzione. Dal README originale: elenco di giochi realtime a
due giocatori (Tris, Forza 4, Blackjack, Trivia, +1-2 pensati per coppie),
ogni mossa sincronizzata live, nessun turno perso se l'altro non è online,
storico persistente per gioco (vittorie Fabrizio/Emily/pareggi), vincere
assegna monete.

Questa fase costruisce il **motore condiviso** — la tabella delle partite, le
due funzioni generiche (`create_match`, `make_move`), l'hook realtime, e la
separazione fra "infrastruttura di gioco" e "regole di un gioco specifico" —
e include **il Tris come gioco di riferimento**, per validare l'infrastruttura
end-to-end invece di lasciarla non dimostrabile. Gli altri giochi (Forza 4,
Blackjack, Trivia, ...) arrivano in F3, riusando lo stesso motore senza
toccarlo. Riusa le convenzioni di F0+F1/F5/F6 — token CSS, `Person`/identity,
`useRealtimeQuery`, funzioni Postgres `security definer` come unica via di
scrittura, la regola `game_win`/`game_draw`/`game_loss` già seminata in
`coin_rules` (20/10/5 monete, nessun tetto) — senza introdurre nuovi
meccanismi architetturali.

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Scope | **Motore + Tris come prova end-to-end** | Un motore senza alcun consumatore reale è difficile da validare in modo significativo. Il Tris è il gioco più semplice possibile (stato 3×3, nessuna logica complessa), sufficiente a dimostrare che stanza/turni/storico funzionano — non è anticipare il lavoro di F3. |
| Turno | **Asincrono, come le domande di F5** | Le due persone sono spesso in fusi diversi. "In tempo reale" nel README descrive l'aggiornamento live *se* capita che siano online insieme (già coperto dal realtime esistente), non un requisito di sessione live condivisa. Nessun limite di tempo per mossa. |
| Partite concorrenti | **Una sola partita aperta per gioco alla volta** | Stesso principio di "un solo round di domande aperto": un solo posto dove guardare "c'è una partita che aspetta una mossa", nessuna lista da gestire con due soli giocatori. |
| Primo turno | **Chi inizia la partita muove per primo** | Stesso principio di "pescare una domanda": chi avvia l'azione la fa per prima. Nessuno stato aggiuntivo (es. alternanza) da tracciare. |
| Validazione delle mosse | **Motore generico, il client calcola le regole del gioco** | Coerente con la fiducia già accordata al client per il *contenuto* di lettere e risposte (nessuna validazione server-side che una lettera "abbia senso"). Il server applica solo ciò che conta davvero: turni, che non si possa muovere su una partita chiusa, e le monete — mai la correttezza delle regole di un gioco specifico. Aggiungere un gioco in F3 diventa "scrivi un componente con le sue regole", non "scrivi ed esegui una nuova migrazione". |
| Storico | **Derivato da una query aggregata su `game_matches`** | Nessuna tabella di riepilogo da tenere sincronizzata: stesso principio di `coin_ledger` come unica fonte di verità, letto meno spesso di quanto lo sia `couple_state.coins` (che invece resta una cache per motivi di performance su ogni lettura). |
| Monete | **Riusa `game_win`/`game_draw`/`game_loss` già in `coin_rules`** | 20/10/5 monete, nessun tetto giornaliero, già seminate in F0+F1 esattamente per questa fase — nessun nuovo valore economico. |

## 3. Schema dati

```sql
-- F3 aggiunge altri valori con ALTER TYPE game_type ADD VALUE.
create type game_type as enum ('tic_tac_toe');

create table game_matches (
  id           uuid primary key default gen_random_uuid(),
  game_type    game_type not null,
  state        jsonb not null,        -- forma libera, diversa per ogni gioco
  started_by   person not null,
  current_turn person not null,
  winner       person null,           -- valorizzato solo se qualcuno vince
  created_at   timestamptz not null default now(),
  closed_at    timestamptz null       -- null = partita aperta, stesso pattern di question_rounds
);

-- Una partita aperta alla volta PER GIOCO: indice unico parziale sulla
-- colonna game_type stessa — più diretto del trucco "((true))" di F5, qui
-- esiste una chiave naturale su cui partizionare il vincolo.
create unique index one_open_match_per_game on game_matches (game_type) where closed_at is null;

grant select on game_matches to authenticated;
alter table game_matches enable row level security;
create policy read_for_authenticated on game_matches for select to authenticated using (true);

alter publication supabase_realtime add table game_matches;
```

Nessuna policy di scrittura: si scrive solo attraverso `create_match` e
`make_move`, ciascuna con il proprio `grant execute` esplicito a
`authenticated` e nessun privilegio ad `anon` — i default privileges del
progetto fanno nascere tabelle e funzioni chiuse per default.

Distinguere "partita finita con un vincitore" da "pareggio" non richiede una
colonna in più: `closed_at is not null and winner is not null` → ha vinto
`winner`; `closed_at is not null and winner is null` → pareggio.

## 4. Funzioni

Entrambe `security definer`, `set search_path = public`, `revoke`/`grant`
espliciti — stesso stile di F0+F1/F5/F6.

### `create_match(p_game_type game_type, p_person person, p_initial_state jsonb) returns game_matches`

Apre una nuova partita con lo stato iniziale passato dal client (es. la
griglia 3×3 vuota del Tris) e `current_turn = p_person`. Una violazione
dell'indice `one_open_match_per_game` (due aperture concorrenti dello stesso
gioco) diventa `match_already_open` — stesso pattern del `round_already_open`
di F5: nessun controllo preventivo separato, la violazione stessa è il
segnale.

### `make_move(p_match_id uuid, p_person person, p_state jsonb, p_result text default null, p_winner person default null) returns game_matches`

1. Blocca la riga della partita con `for update` prima di leggere qualunque
   cosa (stesso principio del lock in `answer_question`/`spend_coins`: senza,
   due mosse quasi simultanee rischierebbero di operare su uno stato non
   aggiornato).
2. Se la partita non esiste più aperta (`closed_at is not null` o id
   inesistente), solleva `match_already_closed`.
3. Se non è il turno di `p_person` (`current_turn <> p_person`), solleva
   `not_your_turn`.
4. Salva `p_state`, gira `current_turn` sull'altra persona.
5. Se `p_result = 'win'`: chiude la partita (`closed_at = now()`,
   `winner = p_winner`), accredita `game_win` a `p_winner` e `game_loss`
   all'altra persona.
6. Se `p_result = 'draw'`: chiude la partita (`winner` resta `null`),
   accredita `game_draw` a entrambe le persone.
7. Se `p_result` è `null`, la partita resta aperta e il turno passa
   all'altra persona.

`p_result`/`p_winner` sono calcolati dal client (vedi decisione in sezione 2)
— la funzione non valuta mai da sola se una mossa costituisce una vittoria.

## 5. Frontend

```
features/games/
  types.ts              GameType, Match — condivisi da motore e giochi
  queries.ts             fetchActiveMatch(gameType), fetchHistory(gameType), createMatch, makeMove
  useActiveMatch.ts       hook realtime sulla partita aperta di un gameType
  useGameHistory.ts        hook realtime sullo storico (vittorie/pareggi aggregati)
  MatchStatus.tsx           "Your turn" / "Waiting for Emily" — chrome condiviso, generico

features/games/ticTacToe/
  board.ts                 logica pura: mosse legali, rilevamento vittoria/pareggio — testabile isolata, senza React
  TicTacToeBoard.tsx         la griglia 3×3, chiama makeMove col risultato calcolato da board.ts

app/games/page.tsx          elenco giochi: Tic-tac-toe giocabile, il resto "coming soon" (stesso EmptyState già in uso per le sezioni non ancora costruite)
app/games/tic-tac-toe/page.tsx    la partita vera e propria
```

Confine netto fra le due cartelle: `features/games/*.ts` è il motore,
generico, e non sa nulla del Tris; `features/games/ticTacToe/*` conosce solo
le regole del Tris e chiama `makeMove`/`createMatch` senza sapere come sono
implementate. Aggiungere Forza 4 in F3 significa aggiungere
`features/games/connectFour/` con lo stesso confine, senza toccare il motore.

La schermata della partita ha stati derivati dalla partita attiva:

1. **Nessuna partita attiva** → pulsante "New game", chiama `createMatch`.
2. **Partita attiva, tocca a me** → la board, interattiva.
3. **Partita attiva, tocca all'altro** → la board, sola lettura, con
   `MatchStatus` che mostra "Waiting for Emily" (o Fabrizio) — nessun indizio
   sulla mossa in corso, semplicemente non modificabile.
4. **Partita appena chiusa** → il risultato (vittoria/pareggio), poi si
   ritorna allo stato 1.

## 6. Contenuto: le regole del Tris

Griglia 3×3, `state = { cells: (Person | null)[9] }` (o forma equivalente),
`X`/`O` assegnati implicitamente in base a chi ha iniziato la partita
(`started_by` gioca sempre lo stesso simbolo per tutta la partita). Vittoria:
tre celle allineate (riga, colonna, diagonale) dello stesso simbolo.
Pareggio: griglia piena senza vittoria. Tutta la logica vive in
`features/games/ticTacToe/board.ts`, pura e testabile senza React.

## 7. Errori e casi limite

| Codice | Quando | Comportamento atteso lato client |
|---|---|---|
| `match_already_open` | Si prova ad aprire una seconda partita dello stesso gioco | Non dovrebbe succedere dall'interfaccia (il pulsante "New game" è nascosto quando c'è già una partita attiva); se arriva comunque, messaggio generico e refetch |
| `not_your_turn` | Si prova a muovere fuori dal proprio turno | Difensivo: la board è già sola lettura quando non è il proprio turno; messaggio generico se capita comunque |
| `match_already_closed` | L'altro ha appena chiuso la partita mentre si stava per muovere | Messaggio che spiega cosa è successo e invita a ricaricare; il realtime dovrebbe già aver aggiornato la schermata prima che l'utente completi la mossa |

## 8. Test

Stesso impianto di F0+F1/F5/F6:

- **Integrazione** (Vitest contro Supabase locale): una sola partita aperta
  per gioco imposta dal database, `create_match` assegna `current_turn` a chi
  inizia, `make_move` rifiuta un movimento fuori turno e su una partita
  chiusa, chiude correttamente su vittoria/pareggio accreditando le monete
  giuste a ciascuna persona, il lock impedisce corse su mosse quasi
  simultanee, i privilegi (`authenticated` sì, `anon` no) su entrambe le
  funzioni.
- **Unit**: `board.ts` (mosse legali, rilevamento vittoria su tutte le righe
  possibili, rilevamento pareggio) senza alcuna dipendenza da React; gli hook
  e i componenti, stesso stile di `features/questions/*.test.tsx`.

## 9. Fuori scope in questa fase

Indicatore di presenza online del partner (il README chiede solo
l'aggiornamento live se capita che siano online insieme, già coperto dal
realtime esistente su `postgres_changes` — non un canale di presenza
dedicato). Limite di tempo per mossa. Abbandono/forfait di una partita in
corso. Qualunque gioco oltre al Tris — arrivano in F3, che riuserà questo
stesso motore senza modificarlo.

## 10. Criteri di accettazione

1. Aprendo una nuova partita di Tris, appare a entrambi in tempo reale.
2. Solo chi ha il turno può muovere; l'altro vede la board in sola lettura
   con un'etichetta neutra ("Waiting for...").
3. Una mossa fuori turno o su una partita già chiusa viene rifiutata dal
   database, non solo dal client.
4. Vincendo o pareggiando, la partita si chiude e le monete si accreditano
   secondo `coin_rules`, senza intervento manuale.
5. Non si può aprire una seconda partita di Tris finché quella attiva non è
   chiusa.
6. Lo storico (vittorie Fabrizio/Emily/pareggi) riflette correttamente le
   partite concluse, derivato da query, non da uno stato mantenuto a parte.
