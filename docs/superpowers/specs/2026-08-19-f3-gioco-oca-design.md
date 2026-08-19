# F3.x — Gioco dell'Oca

Data: 2026-08-19
Stato: approvato in brainstorming, da eseguire
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Primo di quattro nuovi giochi che sostituiscono BlackJack (esplicitamente
scartato) nell'elenco di F3: Gioco dell'Oca → Quoridor → Backgammon →
Scacchi, dal più semplice al più complesso. Riusa il motore di F2
(`game_matches`, `create_match`, `make_move`) senza modificarlo, esattamente
come Forza4 (F3.1) e Trivia (F3.2) prima di lui — zero migrazioni oltre
l'estensione dell'enum, zero funzioni nuove.

A differenza di Gin Rummy (scartato prima di questa fase), il Gioco
dell'Oca è a informazione completamente pubblica: nessuna mano nascosta,
nessun problema di fiducia nuovo rispetto a quanto già in vigore per gli
altri giochi.

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Pozzo/Prigione a 2 giocatori | **Bloccati per un numero fisso di turni (2)**, non "finché l'altro non arriva lì" | Con solo 2 giocatori, la regola tradizionale rischia uno stallo lunghissimo se l'avversario non passa mai da quella casella specifica. Un blocco a turni fissi resta fedele allo spirito della regola (perdere tempo) senza il rischio di stallo. |
| Dadi | **2 dadi, generati lato client** | Nessun bisogno di casualità verificabile server-side: stesso principio del countdown di Trivia, il server non sa nulla dei dadi, si fida dello stato dichiarato dal client a fine turno. |
| Arrivo (casella 63) | **Serve il numero esatto, altrimenti rimbalzo indietro dell'eccesso** | Regola tradizionale, mantenuta intatta: non richiede altra logica oltre a un confronto numerico. |
| Layout del tabellone | **Griglia a serpentina 7 colonne** (come le app di Scale e Serpenti) | 63 caselle in un'unica striscia non stanno comodamente su un viewport mobile da 390px senza scroll orizzontale — la serpentina è lo standard consolidato per questo tipo di tabellone su schermo piccolo. |

## 3. Schema dati

Nessuna modifica. Una sola riga di migrazione, stessa forma di F3.1/F3.2:

```sql
alter type game_type add value 'goose';
```

## 4. Funzioni

Nessuna funzione nuova. `create_match`/`make_move` (F2) funzionano già per
`'goose'` esattamente come per gli altri giochi.

## 5. Tabellone e regole

63 caselle, posizione `0` = non ancora partiti, `63` = arrivo. Caselle
speciali (numerazione tradizionale italiana):

| Casella | Effetto |
|---|---|
| 5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59 | Oca: si ripete lo stesso tiro da lì (può incatenarsi su un'altra oca) |
| 6 | Ponte: salta al 12 |
| 19 | Locanda: salta 1 turno |
| 31 | Pozzo: bloccato 2 turni |
| 42 | Labirinto: torna al 30 |
| 52 | Prigione: bloccato 2 turni |
| 58 | Morte: torna a 0 |
| 63 | Arrivo: numero esatto per vincere, altrimenti rimbalzo indietro dell'eccesso |

Un turno "bloccato" (pozzo/prigione/locanda) non tira i dadi: scala il
contatore di blocco e passa il turno — il motore di F2 non distingue un
turno passivo da uno attivo, gira comunque.

Chiarimento sull'incatenamento: dopo il ripetersi del tiro da un'oca, si
applica l'effetto della NUOVA casella di arrivo, qualunque esso sia — se è
un'altra oca la catena continua, se è un'altra casella speciale (ponte,
pozzo, morte, ecc.) quell'effetto si applica una volta sola, se supera la
casella 63 rimbalza indietro come da regola dell'arrivo, se arriva esatto
a 63 vince immediatamente.

## 6. Frontend

```
features/games/goose/
  board.ts             logica pura: tabella delle caselle speciali, rollDice(), applyRoll(state, roll)
                        (spostamento + effetto, con incatenamento oca), isWin(position)
  board.test.ts          unit
  GooseBoard.tsx           tabellone a serpentina, pedine di entrambi, stato bloccato/turno
                        di chi, pulsante "Roll dice" — stessa struttura a tre stati di
                        TicTacToeBoard.tsx/ConnectFourBoard.tsx

app/games/goose/page.tsx        la partita vera e propria
app/games/page.tsx               modificato: Gioco dell'oca passa da assente a link giocabile
```

`state = { positions: { fabrizio: number, emily: number }, stuck: {
fabrizio: number, emily: number } }` — `stuck` conta i turni residui di
blocco (0 = libero). Nessuno storico delle caselle attraversate: tutto è
ricalcolabile dalla sola posizione corrente + l'ultimo tiro, stesso
principio di stato minimo già in vigore per gli altri giochi.

## 7. Errori e casi limite

Stessi codici di F2 (`match_already_open`, `not_your_turn`,
`match_already_closed`), già tradotti in `lib/rpc.ts` — nessuna aggiunta.
Nessun pareggio possibile in questo gioco: qualcuno arriva sempre per
primo a 63.

## 8. Test

Stesso impianto delle fasi precedenti:

- **Unit**: `board.ts` (tiro semplice, oca singola e incatenata, ponte,
  locanda, pozzo/prigione con contatore che scala, labirinto, morte,
  rimbalzo all'arrivo, vittoria esatta); `GooseBoard.tsx` e
  `app/games/goose/page.tsx`, stesso stile dei test di Forza4/Trivia.
- **Integrazione**: un solo test che conferma `create_match` accetta
  `'goose'` senza modifiche.

## 9. Fuori scope in questa fase

Regole tradizionali con più di 2 giocatori. La regola "attesa
dell'avversario" per pozzo/prigione (sostituita dal blocco a turni fissi).
Varianti regionali del tabellone diverse da quella italiana standard.

## 10. Criteri di accettazione

1. Aprendo una nuova partita, appare a entrambi in tempo reale.
2. A ogni turno, chi ha il turno tira 2 dadi (lato client) e la pedina
   avanza di conseguenza.
3. Ogni casella speciale applica l'effetto corretto, incluso
   l'incatenamento di più oche consecutive.
4. Un giocatore bloccato (pozzo/prigione/locanda) salta il turno senza
   tirare, il contatore scala di 1 a ogni turno passato.
5. Si vince solo con arrivo esatto alla casella 63; un tiro in eccesso
   rimbalza indietro della stessa quantità.
6. Le monete si accreditano secondo `game_win`/`game_loss` già esistenti,
   senza intervento manuale — nessun pareggio possibile in questo gioco.
7. Non si può aprire una seconda partita finché quella attiva non è
   chiusa.
