# F3.2 — Trivia

Data: 2026-08-19
Stato: approvato in brainstorming, da eseguire
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Secondo sotto-progetto di F3 (i giochi veri e propri), dopo F3.1 (Forza 4)
già in produzione. Riusa il motore di F2 (`game_matches`, `create_match`,
`make_move`) **senza modificarlo** — zero migrazioni, zero nuove tabelle,
persino più semplice di Forza 4 perché il contenuto delle domande vive nel
codice frontend, non nel database.

Dal README originale: quiz "quanto mi conosci"/trivia generico. Questa fase
copre un trivia a risposta multipla generico (non specifico sulla coppia),
con un vincolo nuovo rispetto a Tris e Forza 4: **10 secondi per rispondere
a ogni domanda**, gestito interamente lato client.

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Timeout | **Scaduto = risposta sbagliata automatica** | Il motore di F2 è asincrono per design (nessun limite di tempo per mossa) proprio perché i due sono spesso in fusi diversi. Un timer presuppone che stiano giocando insieme in quel momento — quando è così, "niente risposta in tempo" è semplicemente un punto perso, esattamente come una risposta sbagliata. Nessuna nuova infrastruttura di presenza da costruire per un solo gioco. |
| Struttura della partita | **10 domande, 5 a testa, alternate** | Il motore di turni esistente gira già automaticamente fra le due persone a ogni `make_move` — l'alternanza "chi inizia risponde alla prima, l'altro alla seconda" viene gratis, senza scrivere nulla di nuovo. Dopo 10 domande vince chi ha più risposte corrette, pareggio se pari. |
| Contenuto | **Banco di domande nel codice frontend, non nel database** | Nessuna nuova tabella, nessuna migrazione — le domande sono dati statici (uguali per entrambi, nessuna privacy da proteggere), quindi non serve la macchina di F5 (tabella `questions` seminata via SQL). `create_match` riceve già le 10 domande scelte, incorporate nello stato iniziale. |
| Riservatezza della risposta corretta | **Visibile fin dall'inizio nello stato condiviso della partita** | Stesso principio di fiducia verso il client già in vigore in tutto il motore (l'avversario è il proprio partner, non un estraneo). Nascondere la risposta richiederebbe un cambiamento architetturale serio (uno schema di rivelazione come quello delle Domande di F5) per un rischio che in questo contesto non esiste davvero — decisione esplicita, non una svista. |
| Timer | **10 secondi per domanda, gestito lato client** | Il server non sa nulla del timer: allo scadere, il client dichiara semplicemente una risposta sbagliata tramite `make_move`, esattamente come farebbe per un tocco sull'opzione errata. |

## 3. Schema dati

Nessuna modifica. `game_matches` accetta già qualunque `game_type` e
qualunque forma di `state` — Trivia usa `'trivia'` come nuovo valore
dell'enum `game_type`, stessa unica riga di migrazione di Forza 4:

```sql
alter type game_type add value 'trivia';
```

## 4. Funzioni

Nessuna funzione nuova. `create_match`/`make_move` (F2) funzionano già per
`'trivia'` esattamente come per gli altri giochi.

## 5. Frontend

```
features/games/trivia/
  questions.ts             banco di ~100 domande a risposta multipla, dati statici (prompt, 4 opzioni, indice della risposta corretta)
  match.ts                 logica pura: pesca 10 domande casuali senza ripetizioni, valuta una risposta, calcola il punteggio finale — testabile isolata, senza React
  TriviaBoard.tsx           la domanda corrente, il countdown di 10 secondi, il punteggio parziale, l'invio della risposta — stessa struttura a tre stati di TicTacToeBoard.tsx/ConnectFourBoard.tsx

app/games/trivia/page.tsx        la partita vera e propria
app/games/page.tsx                modificato: Trivia passa da "Coming soon" a link giocabile
```

`state = { questions: Question[], answers: (number | null)[], currentIndex:
number }`, dove `Question = { prompt: string; options: [string, string,
string, string]; correctIndex: 0 | 1 | 2 | 3 }`. `answers[i]` è l'indice
scelto per la domanda `i`, o `null` se scaduto il tempo. `currentIndex`
indica la domanda in corso (0-9).

Il timer vive in `TriviaBoard.tsx` come un `useEffect` con un
`setTimeout`/countdown visibile, azzerato a ogni nuova domanda. Non è una
mossa separata: allo scadere, il componente chiama la stessa funzione che
gestirebbe una risposta scelta dall'utente, passando `null` come risposta.

## 6. Contenuto: il banco di domande

Circa 100 domande a risposta multipla di cultura generale (geografia,
scienza, storia, cultura pop, ecc. — non specifiche alla coppia, a
differenza delle Domande di F5), 4 opzioni ciascuna, una sola corretta.
Vivono come dati statici in `features/games/trivia/questions.ts`. Nessuna
garanzia di non-ripetizione fra partite diverse (a differenza delle Domande
di F5): con ~100 domande e partite da 10, la ripetizione a breve termine è
rara abbastanza da non giustificare la macchina di tracciamento di F5 per
una prima versione.

## 7. Errori e casi limite

Stessi codici di F2 (`match_already_open`, `not_your_turn`,
`match_already_closed`), già tradotti in `lib/rpc.ts` — nessuna aggiunta.
Se il timer scade mentre una richiesta `make_move` precedente è ancora in
volo (rete lenta), la guardia sincrona già in uso in Tris/Forza 4
(`sending` ref) impedisce un doppio invio.

## 8. Test

Stesso impianto di F3.1:

- **Unit**: `match.ts` (pescare 10 domande senza ripetizioni, valutare una
  risposta corretta/sbagliata/scaduta, calcolare il vincitore finale su
  vittoria/pareggio) senza alcuna dipendenza da React; `TriviaBoard.tsx` e
  `app/games/trivia/page.tsx`, stesso stile dei test di Forza 4 — incluso il
  countdown, usando i timer finti di Vitest (`vi.useFakeTimers`).
- **Integrazione**: un solo test che conferma `create_match` accetta
  `'trivia'` senza alcuna modifica alla funzione, stesso principio del test
  equivalente di Forza 4.

## 9. Fuori scope in questa fase

Domande specifiche sulla coppia (restano il dominio delle Domande di F5).
Tracciamento delle domande già fatte fra partite diverse. Un banco di
domande superiore a ~100 — si può ampliare in futuro con una semplice
modifica al file statico, senza toccare né motore né schema.

## 10. Criteri di accettazione

1. Aprendo una nuova partita di Trivia, appare a entrambi in tempo reale.
2. Solo chi ha il turno vede la domanda come attiva; ogni domanda ha un
   countdown di 10 secondi visibile.
3. Rispondendo in tempo, la risposta si valuta subito e il turno passa
   all'altro con la domanda successiva.
4. Se il tempo scade senza risposta, conta come sbagliata e il turno passa
   comunque.
5. Dopo 10 domande (5 a testa), la partita si chiude con chi ha più
   risposte corrette, o in pareggio se pari — le monete si accreditano
   secondo `coin_rules`, senza intervento manuale.
6. Non si può aprire una seconda partita di Trivia finché quella attiva non
   è chiusa.
7. Nessuna migrazione oltre alla singola riga che aggiunge `'trivia'`
   all'enum — il motore resta invariato.
