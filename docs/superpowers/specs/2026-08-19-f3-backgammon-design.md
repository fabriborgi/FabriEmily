# F3.x — Backgammon

Data: 2026-08-19
Stato: approvato in brainstorming, da eseguire
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Terzo di quattro nuovi giochi che sostituiscono BlackJack (esplicitamente
scartato): Gioco dell'Oca (completato) → Quoridor (completato) → Backgammon
→ Scacchi, dal più semplice al più complesso. Riusa il motore di F2
(`game_matches`, `create_match`, `make_move`) senza modificarlo — zero
migrazioni oltre l'estensione dell'enum, zero funzioni nuove.

Backgammon introduce un elemento nuovo rispetto a tutti i giochi precedenti:
un turno non è una singola azione, ma un tiro di 2 dadi seguito da un
massimo di 4 mosse (2 normalmente, 4 se doppio). Il motore di F2 gira
sempre il turno a ogni `make_move` — la soluzione, già validata per
Quoridor/Gioco dell'Oca, è trattare l'intero turno (tiro + tutte le mosse
risultanti) come **una sola** `make_move`: il client calcola tutto in
locale e invia solo lo stato finale.

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Cubo del raddoppio e punteggi gammon/backgammon | **Esclusi** | Riguardano la posta/il punteggio variabile, non il movimento — il progetto premia sempre con monete fisse (`game_win`/`game_loss`) per ogni partita, mai un punteggio variabile. Una partita = un vincitore secco, tutte e 15 le pedine tolte. |
| Uso obbligato di tutti i dadi possibili | **Versione semplificata**: ogni dado si usa se in quel momento ha una mossa legale disponibile, ma il turno può finire con dadi inutilizzati se nessuna mossa resta legale — nessuna ricerca combinatoria per dimostrare che esisteva un ordine migliore | Stesso principio di semplificazione di pozzo/prigione nel Gioco dell'Oca: la regola completa serve contro un avversario scorretto in cerca di vantaggio, qui i due giocano insieme. Meno rischio implementativo proprio nel tipo di caso limite che ha già causato bug nelle due fasi precedenti. |
| Annullamento di un turno parziale | **"Reset turn" che scarta tutte le mosse locali e riparte dal tiro originale**, non un annulla-mossa-per-mossa | Molto più semplice da costruire, sufficiente per ripensarci — nessuna cronologia di mosse da mantenere. |

## 3. Schema dati

Nessuna modifica. Una sola riga di migrazione, stessa forma delle fasi
precedenti:

```sql
alter type game_type add value 'backgammon';
```

## 4. Funzioni

Nessuna funzione nuova. `create_match`/`make_move` (F2) funzionano già per
`'backgammon'` esattamente come per gli altri giochi. Lo stato persistito
contiene solo la posizione delle pedine — dadi e turno-in-corso restano
interamente locali fino all'invio finale, stesso principio del countdown
di Trivia e della modalità Wall di Quoridor.

## 5. Tabellone e posizione iniziale

24 punti (1-24). `started_by` si muove in senso decrescente (24→1, casa
punti 1-6, esce sotto lo 0), l'altro in senso crescente (1→24, casa punti
19-24, esce sopra il 25). La barra si rappresenta come due posizioni
virtuali fuori range: punto 25 per chi si muove in decrescente, punto 0
per chi si muove in crescente — la formula di spostamento
(`destinazione = partenza + direzione × dado`) resta identica anche per il
rientro dalla barra, nessun caso speciale nel codice.

Posizione di partenza standard (15 pedine a testa): per chi si muove
24→1: 2 sul 24, 5 sul 13, 3 sull'8, 5 sul 6. Per l'altro, speculare: 2
sull'1, 5 sul 12, 3 sul 17, 5 sul 19.

## 6. Movimento, cattura, barra

Una pedina si sposta da un punto a `partenza + direzione × dado`. La
destinazione è legale se: vuota, occupata da proprie pedine (si impila),
oppure occupata da esattamente una pedina avversaria (un "blot") — in quel
caso la si cattura: va sulla barra dell'avversario, la propria pedina
prende il suo posto. Una destinazione con due o più pedine avversarie è
bloccata, illegale.

Barra obbligatoria: se un giocatore ha pedine sulla barra, l'unica mossa
legale è farle rientrare (dalla posizione virtuale 25 o 0, stessa formula
di ogni altra mossa) — nessun'altra pedina si può muovere finché la barra
non è vuota.

## 7. Bear-off (togliere le pedine)

Si può iniziare a togliere pedine solo quando tutte e 15 le proprie
pedine sono nella propria casa (barra vuota, nessuna pedina fuori dai
punti 1-6 o 19-24 a seconda della direzione). Con un dado che porta
esattamente al bordo si toglie quella pedina. Regola dell'eccedenza: se
il dado supera il punto necessario, è comunque legale togliere quella
pedina ma solo se non ci sono proprie pedine su un punto più lontano
dalla casa — altrimenti il dado va usato per muovere quella pedina più
lontana, non per togliere quella più vicina.

Vittoria: chi toglie tutte e 15 le pedine per primo vince (nessun
moltiplicatore, come deciso in sezione 2).

## 8. Frontend

```
features/games/backgammon/
  board.ts               logica pura: direzione/casa/barra per persona, rollDice(),
                        legalDestinationsForDie (mossa singola, gestisce barra e bear-off
                        con la regola dell'eccedenza), applySingleMove, isWin
  board.test.ts           unit, con tabelloni costruiti apposta per ogni caso limite
                        (cattura, blocco, rientro dalla barra, bear-off esatto e in
                        eccedenza con/senza pedine più lontane)
  BackgammonBoard.tsx       tabellone a 2 file di 12 punti con corsia della barra al
                        centro, pedine impilate, area barra/uscite, gestione del turno
                        multi-mossa — stessa struttura a tre stati degli altri giochi
  BackgammonBoard.test.tsx   unit

app/games/backgammon/page.tsx        la partita vera e propria
app/games/page.tsx                    modificato: Backgammon passa da assente a link giocabile
```

`state = { points: {1..24: {owner, count} | null}, bar: {fabrizio, emily},
borneOff: {fabrizio, emily} }`.

Flusso del turno: tocco "Roll dice" → i due dadi appaiono (localmente,
doppio = 4 valori usabili) → si tocca un punto di partenza (evidenzia le
destinazioni legali per i dadi rimasti) → si tocca una destinazione → si
ripete finché i dadi non sono esauriti o non restano mosse legali → si
invia con un'unica `make_move`. Un pulsante "Reset turn" scarta tutte le
mosse locali non ancora inviate e riparte dal tiro originale.

## 9. Errori e casi limite

Stessi codici di F2 (`match_already_open`, `not_your_turn`,
`match_already_closed`), nessuna aggiunta. Nessun pareggio possibile: si
vince solo togliendo tutte e 15 le pedine.

## 10. Test

- **Unit**: `board.ts` — mossa semplice, cattura di un blot, blocco su
  punto con 2+ pedine avversarie, rientro obbligato dalla barra prima di
  ogni altra mossa, bear-off esatto, bear-off in eccedenza legale (nessuna
  pedina più lontana) e illegale (pedina più lontana presente), tiro
  doppio con 4 valori disponibili, turno che finisce con dadi inutilizzati
  quando nessuna mossa resta legale; `BackgammonBoard.tsx` e
  `app/games/backgammon/page.tsx`, stesso stile dei test degli altri
  giochi.
- **Integrazione**: un solo test che conferma `create_match` accetta
  `'backgammon'` senza modifiche.

## 11. Fuori scope in questa fase

Cubo del raddoppio, punteggi gammon/backgammon (sezione 2). Uso obbligato
completo di tutti i dadi possibili con ricerca combinatoria (sezione 2).
Annullamento mossa-per-mossa all'interno di un turno (solo reset completo
del turno). Varianti a più di 2 giocatori.

## 12. Criteri di accettazione

1. Aprendo una nuova partita, appare a entrambi in tempo reale.
2. A ogni turno, chi ha il turno tira 2 dadi (lato client) e può muovere
   fino a 4 volte (2 normalmente, 4 se doppio).
3. Una destinazione con una sola pedina avversaria cattura (manda sulla
   barra), con due o più è bloccata.
4. Con pedine sulla barra, l'unica mossa legale è farle rientrare.
5. Il bear-off segue la regola dell'eccedenza esattamente come descritta
   in sezione 7.
6. Si vince togliendo tutte e 15 le pedine per prime; le monete si
   accreditano secondo `game_win`/`game_loss` già esistenti, nessun
   pareggio possibile.
7. Non si può aprire una seconda partita finché quella attiva non è
   chiusa.
