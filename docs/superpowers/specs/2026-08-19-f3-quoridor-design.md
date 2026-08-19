# F3.x — Quoridor

Data: 2026-08-19
Stato: approvato in brainstorming, da eseguire
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Secondo di quattro nuovi giochi che sostituiscono BlackJack (esplicitamente
scartato): Gioco dell'Oca (completato) → Quoridor → Backgammon → Scacchi,
dal più semplice al più complesso. Riusa il motore di F2 (`game_matches`,
`create_match`, `make_move`) senza modificarlo — zero migrazioni oltre
l'estensione dell'enum, zero funzioni nuove. Ogni turno di Quoridor è già
atomico per natura (o si sposta la pedina, o si piazza un muro — mai
un'azione in due parti), quindi si adatta al motore esistente senza nessuno
dei problemi di "turno a due fasi" incontrati valutando Gin Rummy (scartato
prima di questa fase).

A differenza del Gioco dell'Oca, Quoridor è strutturalmente più complesso:
oltre al movimento (con le regole di salto e salto diagonale), richiede una
vera validazione di raggiungibilità (pathfinding) a ogni piazzamento di
muro. La review finale del Gioco dell'Oca ha trovato un bug critico di
ciclo infinito in un caso limite matematico non coperto dai test iniziali
— questa spec e il piano che ne segue trattano i casi limite di
salti/muri con lo stesso rigore, non come un dettaglio da coprire dopo.

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Regole di salto | **Regola ufficiale esatta** (salto dritto obbligatorio se libero, salto diagonale solo se il salto dritto è bloccato) | Centrale alla tattica del gioco (bloccare l'avversario mentre lo si supera) — semplificarla renderebbe Quoridor un gioco diverso, non una versione più semplice dello stesso gioco. |
| Validazione muri | **Vera ricerca di raggiungibilità (BFS) dopo ogni piazzamento ipotizzato, per entrambi i giocatori** | È la regola che definisce Quoridor: senza, un giocatore potrebbe murare l'altro per sempre. Non negoziabile, a differenza delle semplificazioni accettate per il Gioco dell'Oca. |
| Interazione muri su mobile | **Due modalità (Move/Wall)**, con le 64 intersezioni come bersagli tappabili ingranditi oltre il punto visivo | Un tocco impreciso fra due modalità sempre attive rischierebbe piazzamenti muro accidentali durante un tentativo di mossa; due modalità esplicite eliminano l'ambiguità. |
| Dimensione celle | **~40px, sotto i 44px ideali, accettato come eccezione documentata** | Un tabellone 9×9 a piena larghezza su un viewport da 390px non può garantire 44px per cella (a differenza di Forza4, 7 colonne) — stesso trattamento già riservato ad altre eccezioni minori nel progetto. |

## 3. Schema dati

Nessuna modifica. Una sola riga di migrazione, stessa forma delle fasi
precedenti:

```sql
alter type game_type add value 'quoridor';
```

## 4. Funzioni

Nessuna funzione nuova. `create_match`/`make_move` (F2) funzionano già per
`'quoridor'` esattamente come per gli altri giochi.

## 5. Regole

Tabellone 9×9 (righe/colonne 0-8). `started_by` parte in alto (riga 0,
obiettivo riga 8), l'altro in basso (riga 8, obiettivo riga 0), entrambi
al centro del proprio lato (colonna 4). 10 muri a testa.

**Movimento**: una casella ortogonalmente adiacente, libera, non separata
da un muro.

**Salto**: se le due pedine sono adiacenti, e la casella oltre
l'avversario nella stessa direzione è libera e non bloccata da un muro, il
salto dritto sostituisce la mossa normale in quella direzione (non è
un'alternativa a scelta). Se quella casella è bloccata (muro o bordo), è
permesso spostarsi in diagonale in una delle celle laterali all'avversario,
purché non bloccate a loro volta da un muro. Se anche entrambe le
diagonali sono bloccate, in quella direzione non esiste una mossa
disponibile (il giocatore ha comunque altre direzioni possibili, a meno
che non sia una situazione di stallo completo, fuori scope — vedi sezione
9).

**Muri**: un muro occupa un segmento lungo 2 caselle, ancorato su una delle
64 intersezioni dell'8×8 fra le celle (riga/colonna 0-7), orizzontale o
verticale. Un piazzamento è illegale se: esce dal tabellone, si
sovrappone o incrocia un muro già piazzato, oppure — controllo principale
— bloccherebbe completamente la strada di **uno qualunque** dei due
giocatori verso la propria riga obiettivo, verificato con una ricerca in
ampiezza (BFS) dalla posizione di ciascun giocatore verso qualunque casella
della propria riga obiettivo, ricalcolata dopo aver aggiunto
ipoteticamente il muro proposto.

**Vittoria**: raggiungere qualunque casella della propria riga obiettivo.

## 6. Frontend

```
features/games/quoridor/
  board.ts              logica pura: legalMoves (mossa/salto/salto diagonale), isLegalWallPlacement,
                       hasPath (BFS), applyMove, applyWall, isWin
  board.test.ts          unit, con tabelloni costruiti apposta per ogni caso limite di muri/salti
  QuoridorBoard.tsx        tabellone, le due modalità (Move/Wall), l'avvio partita, il tally —
                       stessa struttura a tre stati degli altri giochi
  QuoridorBoard.test.tsx    unit

app/games/quoridor/page.tsx        la partita vera e propria
app/games/page.tsx                  modificato: Quoridor passa da assente a link giocabile
```

`state = { positions: { fabrizio: {row, col}, emily: {row, col} }, walls:
[{row, col, orientation: 'horizontal'|'vertical'}], wallsRemaining: {
fabrizio: number, emily: number } }`.

Due modalità di interazione: **Move** (default, celle raggiungibili
evidenziate e tappabili) e **Wall** (le 64 intersezioni diventano bersagli
tappabili con area di tocco allargata; toccandone una compaiono due
pulsanti "Horizontal"/"Vertical", disabilitato quello che
`isLegalWallPlacement` rifiuterebbe in quel punto).

## 7. Errori e casi limite

Stessi codici di F2 (`match_already_open`, `not_your_turn`,
`match_already_closed`), nessuna aggiunta. Nessun pareggio possibile:
si vince solo raggiungendo la riga obiettivo, non c'è altro esito.

## 8. Test

- **Unit**: `board.ts` — mossa semplice bloccata da muro/bordo, salto
  dritto, salto diagonale quando il salto dritto è bloccato, nessun salto
  legale quando anche le diagonali sono bloccate, muro che si
  sovrappone/incrocia uno esistente, muro fuori tabellone, muro che
  chiuderebbe la strada a un giocatore solo (rifiutato) e uno che lascia
  un solo corridoio stretto (accettato), `hasPath` isolata su tabelloni
  costruiti apposta per ogni caso; `QuoridorBoard.tsx` e
  `app/games/quoridor/page.tsx`, stesso stile dei test degli altri giochi.
- **Integrazione**: un solo test che conferma `create_match` accetta
  `'quoridor'` senza modifiche.

## 9. Fuori scope in questa fase

Rilevamento di uno stallo completo (nessuna mossa disponibile per nessuno
dei due, teoricamente possibile solo in configurazioni di muri estreme
mai raggiungibili rispettando la regola del percorso libero) — non gestito
esplicitamente, coerente con l'assenza di enforcement anti-stallo nel
resto del progetto (stessa fiducia già riservata al Gioco dell'Oca per una
partita che teoricamente potrebbe non finire mai se nessuno dei due
avanza). Varianti a più di 2 giocatori. Timer per mossa.

## 10. Criteri di accettazione

1. Aprendo una nuova partita, appare a entrambi in tempo reale.
2. Ogni turno è una mossa pedina o un piazzamento muro, mai entrambi.
3. Salto dritto e salto diagonale funzionano secondo la regola ufficiale
   esatta descritta in sezione 5.
4. Nessun piazzamento di muro può mai chiudere completamente la strada di
   uno dei due giocatori verso la propria riga obiettivo.
5. Raggiungere la riga obiettivo vince immediatamente la partita.
6. Le monete si accreditano secondo `game_win`/`game_loss` già esistenti,
   senza intervento manuale — nessun pareggio possibile.
7. Non si può aprire una seconda partita finché quella attiva non è
   chiusa.
