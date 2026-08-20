# F3.x — Scacchi

Data: 2026-08-20
Stato: approvato dall'utente senza fase di brainstorming interattiva (richiesta esplicita: "esegui i test essenziali e poi implementa il gioco" — decisioni prese direttamente qui, senza cicli di approvazione)
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Quarto e ultimo dei nuovi giochi che sostituiscono BlackJack: Gioco dell'Oca
(completato) → Quoridor (completato) → Backgammon (completato) → Scacchi, il
più complesso. Riusa il motore di F2 (`game_matches`, `create_match`,
`make_move`) senza modificarlo — zero migrazioni oltre l'estensione
dell'enum, zero funzioni nuove.

A differenza di Backgammon, ogni turno di Scacchi è una singola mossa: si
adatta al motore esistente nel modo più semplice possibile, senza bisogno
del pattern "turno multi-mossa" già usato per Gioco dell'Oca/Quoridor/
Backgammon. La complessità di Scacchi è tutta nella logica di gioco pura
(generazione mosse legali, rilevamento scacco/scacco matto/stallo,
arrocco, en passant, promozione), non nella struttura del turno.

Requisiti espliciti dell'utente per l'interfaccia: (1) selezionando una
pedina, una piccola anteprima mostra dove si può muovere; (2) quando il
giocatore di turno è sotto scacco, l'interfaccia lo segnala chiaramente;
(3) allo scacco matto, l'interfaccia lo segnala mostrando la scacchiera con
la casella del re sotto matto evidenziata.

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Mosse implementate | Scacchi standard completo: tutti e 6 i tipi di pedina, arrocco (corto e lungo, con tutte le condizioni di legalità), presa en passant, promozione con scelta del pezzo | A differenza del cubo del raddoppio in Backgammon (un elemento di scommessa, non di movimento), arrocco/en passant/promozione sono regole di mossa legale di base — ometterle renderebbe questo "un altro gioco", non una versione più semplice degli scacchi. |
| Condizioni di patta automatiche | Solo lo stallo (nessuna mossa legale, non sotto scacco). Tripla ripetizione, regola delle 50 mosse e materiale insufficiente sono **fuori scope** | Stesso compromesso già accettato per pozzo/prigione nel Gioco dell'Oca e per il cubo del raddoppio in Backgammon: regole rare in una partita amichevole fra due persone, che richiederebbero tenere una cronologia degli stati (ripetizione) o un calcolo euristico sul materiale (insufficiente) per un beneficio minimo. Lo stallo, al contrario, è comune ed è già necessario per distinguere "stallo" da "scacco matto" nella stessa funzione di rilevamento. |
| Orientamento della scacchiera | Fisso: riga 0 (rango 1, retrovia del Bianco) sempre in basso nel rendering, uguale per entrambi i giocatori, nessun "flip" secondo chi guarda | Nessun gioco precedente del progetto ruota la vista secondo il giocatore (Quoridor, per esempio, mostra sempre la riga 0 in alto per entrambi) — coerenza con l'architettura esistente, evita la complessità di rendering condizionale al viewer. |
| Assegnazione colori | Chi apre la partita (`started_by`) gioca con il Bianco (muove per primo), l'altro con il Nero | Stessa convenzione già in uso per "chi inizia" negli altri giochi: `started_by` = chi ha il primo turno secondo il motore F2. |
| Scacchiera visibile a partita chiusa | **Sì, sempre** (deviazione esplicita dal pattern standard degli altri giochi, che a partita chiusa non mostrano più la scacchiera) — con la casella del re sotto matto evidenziata in caso di scacco matto | Richiesta esplicita dell'utente: poter rivedere dove è avvenuto lo scacco matto. Nessun costo aggiuntivo: lo stato finale è già disponibile in `match.state`. |
| Scelta del pezzo di promozione | Il giocatore sceglie fra Regina/Torre/Alfiere/Cavallo con un piccolo selettore, non promozione automatica a Regina | Costo di implementazione minimo (4 pulsanti) per un comportamento corretto — la promozione automatica a Regina sarebbe una semplificazione non richiesta e leggermente meno fedele. |
| Resa/abbandono partita | Fuori scope, come in tutti gli altri giochi del progetto | Nessun gioco precedente ha un pulsante "abbandona": si vince solo raggiungendo la condizione di vittoria del gioco. |

## 3. Schema dati

Nessuna modifica. Una sola riga di migrazione, stessa forma delle fasi
precedenti:

```sql
alter type game_type add value 'chess';
```

## 4. Funzioni

Nessuna funzione nuova. `create_match`/`make_move` (F2) funzionano già per
`'chess'` esattamente come per gli altri giochi. Ogni turno è una singola
mossa (a differenza di Backgammon): una `make_move` per mossa, senza batching
lato client.

## 5. Rappresentazione dello stato e regole

Scacchiera 8×8, `board[row][col]` con `row` 0-7 e `col` 0-7. Riga 0 = rango 1
(retrovia iniziale del Bianco), riga 7 = rango 8 (retrovia iniziale del
Nero); colonna 0 = colonna "a", colonna 7 = colonna "h" — solo una
convenzione interna, non serve corrispondere alla notazione algebrica reale
salvo che per le etichette mostrate in UI (vedi sezione 6).

```
state = {
  board: (Piece | null)[8][8],   // Piece = { type: 'pawn'|'knight'|'bishop'|'rook'|'queen'|'king', color: 'white'|'black' }
  castlingRights: {
    white: { kingside: boolean, queenside: boolean },
    black: { kingside: boolean, queenside: boolean },
  },
  enPassantTarget: { row: number, col: number } | null,  // la casella "saltata" dall'ultimo doppio passo di pedone, presa possibile solo nella mossa immediatamente successiva
}
```

Disposizione iniziale standard: Bianco su righe 0-1 (torre-cavallo-alfiere-
regina-re-alfiere-cavallo-torre sulla riga 0, pedoni sulla riga 1), Nero
speculare su righe 7-6.

**Movimento per pezzo** (regole standard, nessuna semplificazione):
- Pedone: un passo in avanti su casella libera; due passi dalla casella di
  partenza se entrambe le caselle sono libere; cattura in diagonale di una
  casella; presa en passant se `enPassantTarget` coincide con la casella di
  arrivo diagonale e c'è un pedone avversario adiacente che ha appena fatto
  il doppio passo.
- Cavallo: le 8 mosse a "L", indipendenti da ostacoli intermedi.
- Alfiere/Torre/Regina: movimento in linea retta (diagonale/ortogonale/
  entrambe) fino al primo ostacolo; casella dell'ostacolo raggiungibile solo
  se occupata da un pezzo avversario (cattura).
- Re: un passo in qualunque direzione; arrocco (vedi sotto) come caso
  speciale.

**Arrocco**: legale se — il re e la torre coinvolta non si sono mai mossi
(tracciato da `castlingRights`), le caselle fra loro sono tutte libere, il
re non è attualmente sotto scacco, il re non passa né atterra su una
casella attaccata dall'avversario. `castlingRights` per un lato si azzera
quando il re o quella torre si muovono, o quando quella torre viene
catturata.

**Scacco**: il re del colore di turno è sotto attacco di un pezzo
avversario. **Mossa legale**: una mossa pseudo-legale (secondo le regole di
movimento del pezzo) che, applicata, non lascia il proprio re sotto scacco
— si simula la mossa e si verifica.

**Fine partita**: al termine di ogni mossa, se l'avversario (chi deve
muovere ora) non ha alcuna mossa legale disponibile: se è sotto scacco è
**scacco matto** (vince chi ha appena mosso), altrimenti è **stallo**
(pareggio).

## 6. Frontend

```
features/games/chess/
  board.ts             logica pura: initialState, colorOf/personOf,
                      pieceMoves (pseudo-legali), isSquareAttacked, isInCheck,
                      legalMoves (filtrate su self-check), isCheckmate,
                      isStalemate, isPromotion, applyMove, algebraic
                      (etichetta di casella tipo "e4" per l'aria-label)
  board.test.ts         unit, con scacchiere costruite apposta per ogni caso
                      limite (arrocco bloccato/attraverso scacco, en passant
                      disponibile/scaduto, promozione, scacco matto e stallo
                      su posizioni note)
  ChessBoard.tsx          scacchiera, selezione pedina → anteprima mosse
                      legali evidenziate, selettore di promozione quando
                      necessario, banner di scacco, scacchiera sempre
                      visibile a partita chiusa con casella del re sotto
                      matto evidenziata — stessa struttura a tre stati degli
                      altri giochi, con questa unica eccezione dichiarata
  ChessBoard.test.tsx      unit

app/games/chess/page.tsx           la partita vera e propria
app/games/page.tsx                  modificato: Scacchi passa da assente a link giocabile
```

Flusso del turno: tocco su una propria pedina nel proprio turno →
evidenzia le caselle di arrivo legali per quella pedina (calcolate da
`legalMoves`) → tocco su una casella evidenziata applica la mossa
localmente e la invia con una singola `make_move`. Se la mossa è una
promozione (`isPromotion` vero), prima dell'invio compare un selettore con
4 pulsanti (Regina/Torre/Alfiere/Cavallo); la mossa si invia solo dopo la
scelta.

Segnalazioni: quando il giocatore di turno è sotto scacco (`isInCheck`
vero per il colore di turno), un banner testuale "Check!" sopra la
scacchiera. A partita chiusa per scacco matto, la casella del re dato
matto (quello del colore che doveva muovere e non aveva mosse legali)
viene evidenziata con uno stile dedicato, insieme al testo del risultato.

## 7. Errori e casi limite

Stessi codici di F2 (`match_already_open`, `not_your_turn`,
`match_already_closed`), nessuna aggiunta. Pareggio possibile solo per
stallo (sezione 2) — si chiude con `result: 'draw'`, `winner: null`, già
supportato dal motore esistente (il tally mostra già "N draws" in ogni
gioco).

## 8. Test

- **Unit**: `board.ts` — movimento base di ogni tipo di pezzo (incluso
  bloccato da un pezzo proprio/avversario per i pezzi a scorrimento),
  cattura, pedone doppio passo e cattura diagonale, presa en passant
  disponibile e presa en passant scaduta dopo un turno, arrocco legale
  corto e lungo, arrocco illegale (torre/re già mossi, casella intermedia
  occupata, re sotto scacco, re che attraversa/atterra su casella
  attaccata), promozione con scelta del pezzo, rilevamento scacco da
  almeno un paio di tipi di pezzo diversi, una mossa che scoprirebbe il
  proprio re filtrata da `legalMoves`, scacco matto su una posizione nota
  (matto del corridoio/back-rank), stallo su una posizione nota;
  `ChessBoard.tsx` e `app/games/chess/page.tsx`, stesso stile dei test
  degli altri giochi. Non esaustivo su ogni possibile combinazione di
  scacchiera — copertura mirata alle regole essenziali, per esplicita
  richiesta di velocità.
- **Integrazione**: un solo test che conferma `create_match` accetta
  `'chess'` senza modifiche.

## 9. Fuori scope in questa fase

Tripla ripetizione, regola delle 50 mosse, materiale insufficiente
(sezione 2). Resa/abbandono partita. Orologio/timer per mossa.
Suggerimenti di mossa oltre alla semplice anteprima delle caselle di
arrivo legali (nessun motore di valutazione, nessun "miglior mossa").
Notazione delle mosse giocate/cronologia PGN. Rotazione della scacchiera
secondo il giocatore che guarda (sezione 2). Varianti (Chess960, ecc.).

## 10. Criteri di accettazione

1. Aprendo una nuova partita, appare a entrambi in tempo reale, Bianco a
   chi ha iniziato.
2. Toccando una propria pedina nel proprio turno, le caselle di arrivo
   legali per quella pedina sono evidenziate (anteprima).
3. Arrocco, presa en passant e promozione (con scelta del pezzo)
   funzionano secondo le regole standard descritte in sezione 5.
4. Quando il giocatore di turno è sotto scacco, l'interfaccia lo segnala
   chiaramente.
5. Allo scacco matto, la partita si chiude, la scacchiera resta visibile
   con la casella del re sotto matto evidenziata, e il vincitore è chi ha
   dato matto.
6. Allo stallo, la partita si chiude in pareggio (nessun vincitore).
7. Le monete si accreditano secondo `game_win`/`game_loss`/pareggio già
   esistenti, senza intervento manuale.
8. Non si può aprire una seconda partita finché quella attiva non è
   chiusa.
