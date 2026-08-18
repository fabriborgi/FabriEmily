# F5 — Domande

Data: 2026-08-18
Stato: approvato in brainstorming, da eseguire
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Quarta fase del progetto, dopo F0+F1 (fondazioni, lettere) già in produzione.
Dal README originale: libreria di domande categorizzate, pescabili a caso o per
categoria, a cui entrambi rispondono senza vedere la risposta dell'altro finché
non hanno risposto anche loro, con tracciamento di quelle già fatte per non
ripeterle prima che sia passato un ciclo completo.

Fase autonoma: non dipende da F2/F3/F4/F6 e non ne è dipesa. Riusa le
convenzioni di F0+F1 — token CSS, `Person`/`identity`, `useRealtimeQuery`,
funzioni Postgres `security definer` come unica via di scrittura, la regola
`question_answered` già seminata in `coin_rules` (8 monete, tetto 5/giorno per
persona) — senza introdurre nuovi meccanismi architetturali.

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Meccanica base | **Un solo round attivo alla volta, condiviso** | Le due persone sono a fusi diversi e raramente online insieme. Un turno in tempo reale (come i giochi) le obbligherebbe a coordinarsi; pescare ognuno per conto proprio rischia domande "a metà" per settimane. Un round condiviso e asincrono ha lo stesso ritmo delle lettere. |
| Rivelazione | **Nessun indizio su chi ha già risposto** | Sapere che l'altro ha già risposto può influenzare cosa si scrive. Le due risposte si sbloccano insieme, anche se scritte a distanza di giorni. |
| Non ripetizione | **Mai ripetere finché non sono finite tutte quelle della categoria** | Con 300 domande e un ritmo di poche a settimana, la differenza pratica con una finestra scorrevole è nulla nei primi mesi, ma la garanzia "non hai già visto questa di recente" è più forte e più facile da spiegare. |
| Tono "spicy" | **Diretto sul desiderio, non esplicito** | Domande audaci sull'attrazione e l'intimità fra due adulti in una relazione vera; niente descrizioni grafiche di atti. È il limite editoriale di chi scrive i contenuti, non negoziabile nella fase di implementazione. |
| Categorie | **5, ~60 domande l'una** | Deep, Spicy, About us, Hypothetical, Fun. La quinta (Fun) dà un registro leggero quando non si ha voglia di riflettere, distinto da Hypothetical che resta più giocoso-immaginativo. |
| Annullare una domanda scomoda | **Skip, chiude subito il round** | Un solo skip da uno dei due (non serve il consenso dell'altro) chiude il round senza monete per nessuno, e la domanda torna pescabile in futuro. Evita di restare bloccati su una domanda che mette a disagio, senza introdurre un meccanismo di "skip multipli" che indebolirebbe il gioco. |
| Monete | **Accreditate a chi risponde, quando risponde** | Non si aspetta che risponda anche l'altro: stesso principio di `create_letter`, dove la ricompensa è nella stessa transazione dell'azione, non subordinata a quella di qualcun altro. Riusa `question_answered` già in `coin_rules`, nessun nuovo valore economico. |
| Ritmo | **Nessun limite imposto oltre al tetto giornaliero delle monete** | Coerente con le lettere: si può rispondere quanto si vuole, oltre il tetto semplicemente non si guadagna. |

## 3. Schema dati

```sql
create type question_category as enum ('deep','spicy','about_us','hypothetical','fun');

create table questions (
  id       uuid primary key default gen_random_uuid(),
  category question_category not null,
  body     text not null
);
-- Seminata con 300 righe (60 per categoria) nella stessa migrazione.

create table question_rounds (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid   not null references questions(id),
  drawn_by     person not null,
  drawn_at     timestamptz not null default now(),
  closed_at    timestamptz null,
  closed_reason text null check (closed_reason in ('answered','skipped')),
  closed_by    person null  -- chi ha skippato; null se closed_reason='answered'
);

-- Al massimo un round aperto alla volta, imposto dal database e non solo
-- dall'applicazione: indice unico parziale su un'espressione costante, lo
-- stesso trucco già visto nel progetto per "una riga sola" (couple_state usa
-- invece un check su id=1; qui non c'è una chiave naturale su cui vincolare,
-- quindi il vincolo è sulla CONDIZIONE "closed_at is null" stessa).
create unique index one_open_round on question_rounds ((true)) where closed_at is null;

create table question_answers (
  round_id    uuid   not null references question_rounds(id),
  author      person not null,
  body        text   not null,
  answered_at timestamptz not null default now(),
  primary key (round_id, author)  -- impedisce di rispondere due volte alla stessa domanda
);
```

RLS e privilegi: stesso pattern esatto di F0+F1. I default privileges globali
impostati in F0+F1 fanno nascere ogni tabella nuova **senza alcun privilegio**
per `anon`/`authenticated` — è per questo che vanno concessi esplicitamente,
non perché manchi qualcosa alla configurazione globale:

```sql
grant select on questions, question_rounds, question_answers to authenticated;

alter table questions enable row level security;
create policy read_for_authenticated on questions for select to authenticated using (true);

alter table question_rounds enable row level security;
create policy read_for_authenticated on question_rounds for select to authenticated using (true);

alter table question_answers enable row level security;
create policy read_for_authenticated on question_answers for select to authenticated using (true);
```

Nessuna policy di scrittura su nessuna delle tre: come in F0+F1, si scrive solo
attraverso le funzioni sottostanti, ciascuna con il proprio `grant execute` a
`authenticated` e nessun privilegio a `anon` — i default privileges coprono
solo la parte "nasce chiuso", il resto va riaperto a mano, tabella per tabella
e funzione per funzione.

Realtime: `question_rounds` e `question_answers` aggiunte alla pubblicazione
`supabase_realtime`, stesso meccanismo di `letters`/`couple_state`.

## 4. Funzioni

Tutte `security definer`, `set search_path = public`, con `revoke`/`grant`
espliciti come le funzioni di F0+F1 (i privilegi nascono chiusi per default:
vedi la lezione di sicurezza del task 2 di F0+F1).

### `draw_question(p_person person, p_category question_category default null) returns question_rounds`

1. Se esiste già un round aperto (`closed_at is null`), solleva `round_already_open`.
2. Sceglie una domanda: fra quelle della categoria indicata (o di tutte, se
   `p_category` è null) che **non hanno mai chiuso con `closed_reason='answered'`**.
   Le domande skippate restano candidate: nessuna informazione è stata rivelata,
   quindi non c'è motivo di escluderle.
3. Se quel pool è vuoto (categoria esaurita), ripesca fra tutte quelle della
   categoria ordinando per la data dell'ultima chiusura `answered` più vecchia
   (quella "dimenticata da più tempo"), invece di sollevare un errore.
4. Inserisce il round, lo ritorna.

### `answer_question(p_round_id uuid, p_person person, p_body text) returns question_answers`

1. Se `p_body` è vuoto dopo `trim`, solleva `empty_answer`.
2. Se il round non è quello aperto (`closed_at is not null` o id diverso da
   quello corrente), solleva `round_already_closed` — caso limite reale: il
   partner ha skippato mentre si stava scrivendo la risposta.
3. Inserisce la risposta. La chiave primaria `(round_id, author)` impedisce una
   seconda risposta della stessa persona allo stesso round: violazione tradotta
   in `already_answered` lato client.
4. Accredita le monete **nella stessa transazione**: `grant_coins(p_person,
   'question_answered', p_round_id, 0)`.
5. Se dopo l'insert il round ha due risposte, lo chiude
   (`closed_at = now(), closed_reason = 'answered'`).
6. Ritorna la riga inserita.

### `skip_question(p_round_id uuid, p_person person) returns void`

Chiude il round se è ancora quello aperto: `closed_at = now(), closed_reason =
'skipped', closed_by = p_person where id = p_round_id and closed_at is null`.
Idempotente per costruzione, stesso stile di `mark_letter_read`: una seconda
chiamata sullo stesso round è un no-op silenzioso.

## 5. Frontend

Stessa forma di `features/letters/`:

```
features/questions/
  queries.ts           fetchActiveRound, fetchHistory, drawQuestion, answerQuestion, skipQuestion
  useActiveRound.ts     hook realtime su question_rounds + question_answers
  QuestionCard.tsx      la domanda attiva + lo stato di chi ha risposto
  AnswerForm.tsx        textarea + invio, stesso stile del composer delle lettere
  RevealedAnswers.tsx   le due risposte affiancate, dopo che entrambi hanno risposto
  CategoryPicker.tsx    le 5 categorie + "Surprise me" (nessuna categoria = pesca da tutte)
  History.tsx           round chiusi, cronologico

app/questions/page.tsx           sostituisce il segnaposto di F0+F1
app/questions/history/page.tsx   archivio
```

La schermata principale (`app/questions/page.tsx`) ha tre stati, derivati dal
round attivo e da chi ha già risposto:

1. **Nessun round attivo** → `CategoryPicker` + pulsante "Draw a question".
2. **Round attivo, io non ho ancora risposto** → la domanda e `AnswerForm`, con
   un pulsante "Skip this one" e un'etichetta neutra tipo "waiting on you" che
   non rivela se l'altro ha già risposto.
3. **Round attivo, io ho già risposto** → solo "Waiting for Emily" (o
   Fabrizio), niente altro visibile, finché il realtime non porta la seconda
   risposta e si passa a `RevealedAnswers`.

## 6. Contenuti

300 domande in inglese, seminate come dati statici nella migrazione, 60 per
categoria:

- **Deep** — valori, paure, il futuro insieme.
- **Spicy** — dirette sul desiderio e l'intimità, mai grafiche.
- **About us** — cosa pensa l'uno dell'altro e della coppia.
- **Hypothetical** — situazioni immaginarie, leggere e giocose.
- **Fun** — domande scherzose senza pensieri, il registro più leggero.

Le domande vengono scritte durante l'implementazione (task dedicato del piano),
seguendo il tono calibrato in questa spec — cinque esempi per categoria sono
già stati approvati in fase di brainstorming.

## 7. Errori e casi limite

| Codice | Quando | Comportamento atteso lato client |
|---|---|---|
| `round_already_open` | Si prova a pescare mentre un round è già aperto | Non dovrebbe succedere dall'interfaccia (il pulsante "Draw" è nascosto quando c'è un round attivo); se arriva comunque, messaggio generico e refetch |
| `empty_answer` | Risposta vuota | Il pulsante di invio è disabilitato a corpo vuoto, come nel composer delle lettere |
| `round_already_closed` | Il partner ha skippato mentre si scriveva | Messaggio che spiega cosa è successo e invita a ricaricare; il realtime dovrebbe già aver aggiornato la schermata prima che l'utente prema invio |
| `already_answered` (violazione chiave primaria) | Doppio invio della stessa persona | Tradotto in `lib/rpc.ts` come gli altri codici; non dovrebbe capitare con la stessa guardia sincrona anti-doppio-tocco già usata nel composer delle lettere e nell'editor di disegno |

## 8. Test

Stesso impianto di F0+F1:

- **Integrazione** (Vitest contro Supabase locale): un solo round aperto alla
  volta imposto dal database, `draw_question` esclude le domande già risposte
  e ripesca dalla più vecchia a categoria esaurita, `answer_question` accredita
  le monete nella stessa transazione e chiude il round alla seconda risposta,
  `skip_question` è idempotente e riapre la domanda al pool, la chiave primaria
  impedisce la doppia risposta, i privilegi (`authenticated` sì, `anon` no) su
  tutte e tre le funzioni.
- **Unit**: gli hook e i componenti, stesso stile di `features/letters/*.test.tsx`.

## 9. Fuori scope in questa fase

Modificare o cancellare una risposta già data; statistiche su quante domande
di ogni categoria sono state fatte; notifiche push (la card realtime in Home,
già esistente da F0+F1, copre l'uso principale).

## 10. Criteri di accettazione

1. Pescando una domanda (a caso o per categoria) appare a entrambi in tempo
   reale, senza ricaricare.
2. Rispondendo, non si vede se l'altro ha già risposto; le due risposte
   compaiono insieme solo quando sono arrivate entrambe.
3. Skippare chiude il round senza monete per nessuno, e la domanda torna
   pescabile.
4. Le monete si accreditano a ciascuno quando risponde, rispettando il tetto
   giornaliero di `question_answered`.
5. Esaurita una categoria, si ripesca dalla più vecchia già fatta invece di
   bloccarsi.
6. L'archivio mostra i round chiusi in ordine cronologico con entrambe le
   risposte.
