# F0 + F1 — Fondazioni e Lettere (testo + disegni)

Data: 2026-08-17
Stato: approvato in brainstorming, da eseguire
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Il README del repo descrive sei sottosistemi (shell+auth, lettere, motore giochi realtime,
cinque-sei giochi, cura di 30+ animali e 15 piante, libreria di 300 domande, shop).
È troppo per una singola spec eseguibile, quindi il progetto è decomposto in fasi, ognuna
con la propria spec → plan → implementazione.

**Questa spec copre F0 e F1**, tenute insieme perché le fondazioni non sono verificabili
finché non c'è una feature reale costruita sopra.

| Fase | Contenuto | Dipende da |
|---|---|---|
| **F0** | Setup Next.js + PWA, schema Supabase base, password condivisa, scelta identità, tab bar, ledger monete, prezzi | — |
| **F1** | Lettere di testo e disegni: composizione, archivio, non-lette, card in Home, ricompense | F0 |
| F2 | Motore partite realtime + Tris end-to-end | F0 |
| F3 | Forza 4, Blackjack, Trivia, 1–2 giochi di coppia | F2 |
| F4 | Animali e piante: specie, decay, cura, skin, curiosità | F0 |
| F5 | 300 domande categorizzate, risposte accoppiate, no-repeat | F0 |
| F6 | Shop: temi, avatar, cornici, adesivi | F0, F4 |

Dipendenze reali: **tutto passa da F0**, e il **ledger monete più la tabella prezzi stanno
in F0** perché lettere, giochi e animali sono tutti sorgenti di monete — costruirli dopo
imporrebbe di riscrivere tre feature. F6 va per ultima: uno shop senza sorgenti di
guadagno non è testabile. F5 è indipendente da F2/F3/F4 e può essere spostata.

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Autenticazione | **Un solo utente Supabase reale** con email fissa e password condivisa | Le RLS possono richiedere `authenticated`: senza password i dati non sono leggibili nemmeno conoscendo la anon key. Le lettere sono contenuto intimo. |
| Framework | **Next.js (App Router) su Vercel** | Manifest PWA e service worker diretti; route server disponibili per F2/F3 (es. mescolare il mazzo del Blackjack lato server). |
| Accesso ai dati | **Tutto client-side**, un hook `useRealtimeQuery` scritto a mano | Due utenti e poche centinaia di righe: il valore di una cache libreria è marginale. L'hook è la cucitura per introdurre TanStack Query in futuro senza toccare i componenti. |
| Scritture | **Solo funzioni Postgres `security definer`** | Se il client potesse scrivere su `couple_state`, ogni regola economica sarebbe riscrivibile dal browser e un doppio click diventerebbe monete duplicate. |
| Lettere di testo | **Solo testo, immutabili** | Nessuno Storage, nessuna policy di upload, nessuna RLS su bozze. L'archivio è un registro permanente. |
| Disegni | **Tratti vettoriali in JSONB**, non PNG su Storage | Undo gratis, 5–30 KB invece di ~200 KB, nessun bucket, e possibilità di rigiocare il disegno tratto per tratto. |
| Notifiche | **Solo in-app** (badge + card in Home via Realtime) | Zero configurazione e zero punti di rottura. Le Web Push restano una fase dedicata futura. |
| Shop nella navigazione | **Fuori dalla tab bar**, raggiungibile toccando il saldo monete | Il README chiede "5 sezioni" ma ne elenca sei; il saldo è il punto in cui si cerca istintivamente lo shop. |

### Limite noto e accettato

**L'identità Fabrizio/Emily non è verificata**: è una scelta salvata in `localStorage`, quindi
chi conosce la password può presentarsi come l'altro. È inevitabile con una password condivisa
ed è accettabile per una coppia. La protezione reale è la RLS: senza password non si legge nulla.

## 3. Stack

- Next.js (App Router), TypeScript, React client components
- `@supabase/supabase-js` — unica dipendenza dati
- CSS Modules o Tailwind (scelta lasciata al plan; mobile-first in entrambi i casi)
- PWA: `manifest.webmanifest` + service worker minimo (solo app shell cache, nessun push in questa fase)
- Vitest (unit + integrazione contro Supabase locale), Playwright (un solo smoke e2e)
- Supabase CLI per migrazioni e istanza locale di test

Variabili d'ambiente:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_COUPLE_EMAIL      # es. couple@fabriemily.app
SUPABASE_SERVICE_ROLE_KEY     # solo per i test di integrazione locali, mai nel bundle
```

## 4. Struttura del progetto

```
app/
  layout.tsx                 # AuthGate, IdentityProvider, header con saldo, TabBar
  page.tsx                   # Home
  login/page.tsx             # gate password condivisa
  letters/page.tsx           # archivio (testo + disegni)
  letters/new/page.tsx       # composer testo
  letters/draw/page.tsx      # composer disegno
  letters/[id]/page.tsx      # dettaglio (testo o disegno con replay)
  games/page.tsx             # placeholder F2
  pets/page.tsx              # placeholder F4
  questions/page.tsx         # placeholder F5
  shop/page.tsx              # placeholder F6
components/
  ui/                        # Button, Card, Sheet, CoinPill, Avatar, EmptyState, OfflineStrip
  TabBar.tsx
features/
  auth/      AuthGate.tsx, IdentityProvider.tsx, IdentityChooser.tsx
  coins/     useCoins.ts, coins.ts
  letters/   queries.ts, useLetters.ts, LetterCard.tsx, LetterComposer.tsx,
             DrawingCanvas.tsx, DrawingThumbnail.tsx, DrawingReplay.tsx,
             strokes.ts        # formato, semplificazione, undo, rendering — logica pura
lib/
  supabase/client.ts
  rpc.ts                     # wrapper: mappa errori Postgres in messaggi leggibili
  useRealtimeQuery.ts
  types.ts                   # generati con `supabase gen types typescript`
supabase/
  migrations/*.sql
  seed.sql
  tests/*.test.ts
```

Ogni feature è autonoma: le sue query, i suoi componenti, i suoi tipi. Le fasi F2–F6
**aggiungono** cartelle sotto `features/`, non modificano quelle esistenti.
`strokes.ts` contiene solo funzioni pure, senza React e senza canvas globale, perché è
la parte più densa di logica e deve essere testabile in isolamento.

## 5. Schema dati

```sql
create type person      as enum ('fabrizio','emily');
create type letter_kind as enum ('text','drawing');

-- I cap giornalieri si resettano a mezzanotte di Buffalo, dove vive Emily, che sono
-- le 6 del mattino in Italia. Il fuso è il letterale 'America/New_York' e compare in un
-- solo punto del codice: grant_coins. Cambiare fuso = cambiare lì.

create table couple_state (
  id         int primary key default 1 check (id = 1),
  coins      int not null default 0 check (coins >= 0),
  theme      text not null default 'default',
  updated_at timestamptz not null default now()
);

create table coin_rules (
  reason    text primary key,     -- 'letter_written', 'drawing_sent', 'game_win', ...
  amount    int  not null check (amount > 0),
  daily_cap int  null,            -- null = illimitato; il cap è PER PERSONA
  min_units int  not null default 0,  -- caratteri per le lettere, tratti per i disegni
  label     text not null         -- testo mostrato nel ledger, in inglese
);

create table item_prices (
  key   text primary key,         -- 'pet:koala', 'skin:koala:blue', 'theme:sunset', ...
  cost  int  not null check (cost > 0),
  label text not null
);

create table coin_ledger (
  id         bigserial primary key,
  actor      person      not null,
  amount     int         not null,      -- positivo = guadagno, negativo = spesa
  reason     text        not null,
  ref_id     uuid        null,          -- riga che ha causato il movimento
  created_at timestamptz not null default now()
);
create index coin_ledger_actor_reason_day
  on coin_ledger (actor, reason, created_at desc);

create table letters (
  id         uuid        primary key default gen_random_uuid(),
  author     person      not null,
  kind       letter_kind not null,
  body       text        null,
  strokes    jsonb       null,
  created_at timestamptz not null default now(),
  read_at    timestamptz null,
  constraint letters_payload_matches_kind check (
       (kind = 'text'    and body is not null and strokes is null)
    or (kind = 'drawing' and strokes is not null and body is null)
  ),
  constraint letters_text_not_blank check (
    kind <> 'text' or char_length(trim(body)) > 0
  )
);
create index letters_created_at_desc on letters (created_at desc);
create index letters_unread on letters (created_at) where read_at is null;
```

`couple_state.coins` è un saldo denormalizzato per leggerlo in una query;
`coin_ledger` è la verità storica. Serve a mostrare *come* sono state guadagnate le monete
("Emily +20 · drawing sent") e a ricalcolare il saldo se qualcosa va storto.

Realtime abilitato su `letters` e `couple_state`:

```sql
alter publication supabase_realtime add table letters, couple_state;
```

## 6. Funzioni: l'unica via di scrittura

Tutte `security definer`, `set search_path = public`, proprietà di `postgres`,
`execute` concesso a `authenticated`.

### `grant_coins(p_actor person, p_reason text, p_ref uuid, p_units int default 0) → int`

Ritorna il nuovo saldo.

1. Legge la regola da `coin_rules`; se il `reason` non esiste solleva `unknown_coin_reason`.
2. Se `p_units < rule.min_units` **non accredita** e ritorna il saldo attuale. Non è un errore:
   la lettera è comunque valida, semplicemente non paga.
3. Se `daily_cap` non è null, conta le righe di `coin_ledger` con lo stesso `actor` e `reason`
   nella giornata corrente. Il confine va scritto esattamente così, con la doppia conversione
   di fuso — `at time zone` applicato a un `timestamp` senza fuso lo reinterpreta come locale
   e riporta a `timestamptz`:

   ```sql
   created_at >= date_trunc('day', now() at time zone 'America/New_York')
                   at time zone 'America/New_York'
   ```

   Se il conteggio ha già raggiunto il cap, non accredita e ritorna il saldo attuale.

   Il fuso è quello di Buffalo, dove vive Emily: la giornata cambia a mezzanotte per lei e
   alle 6 del mattino per Fabrizio. Usare il nome della zona e non un offset fisso è ciò che
   mantiene il confine corretto attraverso i cambi di ora legale. Per le circa tre settimane
   all'anno in cui Stati Uniti ed Europa cambiano l'ora in date diverse, il confine resta
   mezzanotte a Buffalo ma diventa le 5 o le 7 del mattino in Italia: irrilevante per un cap
   sulle monete, ma vale saperlo invece di scoprirlo come un bug.
4. Altrimenti inserisce la riga di ledger, incrementa `couple_state.coins`, ritorna il nuovo saldo.

### `create_letter(p_author person, p_kind letter_kind, p_body text, p_strokes jsonb) → letters`

Inserisce e accredita **nella stessa transazione**, così non può esistere una lettera senza
la sua valutazione di ricompensa.

- `units` = `char_length(trim(body))` per `text`, `jsonb_array_length(strokes)` per `drawing`
- `reason` = `letter_written` per `text`, `drawing_sent` per `drawing`
- Valida i disegni prima di inserire: array non vuoto, al massimo 200 tratti, ogni tratto con
  `c` in 0–11, `w` in 0–2, `p` array di interi 0–1000 di lunghezza pari e ≤ 800 (400 punti).
  Violazione → `invalid_strokes`.
- Ritorna la riga inserita.

### `mark_letter_read(p_id uuid, p_reader person) → void`

```sql
update letters set read_at = now()
where id = p_id and author <> p_reader and read_at is null;
```

Idempotente per costruzione, e l'autore non può segnare come letta la propria lettera.

### `spend_coins(p_actor person, p_item_key text) → int`

Il costo **non arriva dal client**: viene letto da `item_prices`, altrimenti il browser
potrebbe comprare a costo zero.

1. Legge il costo da `item_prices`; se la chiave non esiste solleva `unknown_item`.
2. `select coins from couple_state where id = 1 for update` — il lock è ciò che rende
   impossibile andare in negativo se entrambi comprano nello stesso istante.
3. Se il saldo è insufficiente solleva `insufficient_funds`.
4. Decrementa il saldo, inserisce la riga di ledger con `amount` negativo e
   `reason = 'spend:' || p_item_key`, ritorna il nuovo saldo.

In F0/F1 non esistono ancora oggetti acquistabili, quindi **`item_prices` viene creata vuota**:
le chiavi concrete arrivano con F4 (animali, skin, piante) e F6 (temi, avatar, decorazioni).
La funzione viene comunque costruita e testata ora — i test di integrazione inseriscono le
proprie righe di prezzo con la service role — perché F4 e F6 la useranno senza modifiche.

## 7. Permessi

`ALTER TABLE` accetta una tabella per istruzione, quindi le due righe seguenti vanno ripetute
per ognuna delle cinque tabelle (`couple_state`, `coin_rules`, `item_prices`, `coin_ledger`,
`letters`):

```sql
alter table couple_state enable row level security;
create policy read_for_authenticated on couple_state
  for select to authenticated using (true);
```

Nessuna policy di `insert`, `update` o `delete` su nessuna tabella: le scritture passano solo
dalle funzioni. In più, privilegi revocati come seconda barriera:

```sql
revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke usage on schema public from anon;

grant execute on function
  grant_coins(person, text, uuid, int),
  create_letter(person, letter_kind, text, jsonb),
  mark_letter_read(uuid, person),
  spend_coins(person, text)
  to authenticated;
```

Le funzioni sono `security definer` e proprietà di `postgres`, quindi scrivono aggirando le RLS:
è esattamente il comportamento voluto, ed è il motivo per cui ognuna valida i propri argomenti.

## 8. Login e identità

1. `/login`: un campo password. `signInWithPassword({ email: NEXT_PUBLIC_COUPLE_EMAIL, password })`.
   Password errata → messaggio gentile, il campo resta compilato. Nessun rate limit oltre a
   quello nativo di Supabase.
2. `supabase-js` persiste la sessione in `localStorage`: il login si fa una volta sola per device.
3. Sessione valida ma `localStorage['fe.who']` assente → `IdentityChooser`: due card grandi,
   "I'm Fabrizio" / "I'm Emily".
4. Identità presente → app. Un pulsante nell'header permette di cambiarla (per chi tocca quella
   sbagliata) e di uscire.

`AuthGate` è un client component nel layout: decide fra login, scelta identità e app.
Non serve nessuna guardia lato server, perché i dati sono protetti dalla RLS e non dal routing.

L'account Supabase va creato **una volta a mano** dalla dashboard (email fissa + password
condivisa, email confermata manualmente). Va documentato nel README di setup:
non esiste registrazione nell'app.

## 9. Lettere

### Archivio — `/letters`

Tutte le lettere di entrambi in ordine cronologico discendente, raggruppate per mese
("August 2026"). Ogni card mostra autore, ora, e:

- lettera di testo → le prime righe del corpo
- disegno → una **miniatura ridisegnata dai tratti** su una tela piccola (nessun thumbnail
  da generare o salvare)

Non-letta = `read_at is null` **e** `author <> l'identità corrente`, evidenziata con un pallino.
Le proprie lettere non sono mai "non lette".

### Dettaglio — `/letters/[id]`

Testo intero, oppure disegno a tela piena con un pulsante **replay** che ridisegna i tratti
in ordine in circa due secondi.

All'apertura, se la lettera è di non-letta dell'altro, chiama `mark_letter_read`. Da quel
momento all'autore appare "Read on 14 Aug" — è un dettaglio piccolo ma in una relazione a
distanza è informazione preziosa.

### Composer di testo — `/letters/new`

Textarea che cresce con il contenuto, invio disabilitato se vuota. **Se l'invio fallisce il testo
resta nel campo**: non si perde una lettera lunga per una tacca di segnale.
Al successo, navigazione all'archivio e toast con le monete guadagnate (o senza, se sotto il
minimo o oltre il cap — il messaggio lo dice esplicitamente).

### Composer di disegno — `/letters/draw`

Tela quadrata a tutto schermo con la barra strumenti in basso, raggiungibile col pollice:

- **12 colori** a pastiglie (palette fissa, non un color picker: su mobile è molto più veloce),
  target di tocco 44 px
- **3 spessori**
- **indietro** (annulla l'ultimo tratto)
- **cancella tutto**, con conferma

Input via Pointer Events con `touch-action: none` sulla tela, così il tratto non fa scrollare
la pagina. Tratti disegnati con estremità e giunzioni arrotondate, interpolati con curve
quadratiche sui punti medi per evitare spigoli.

**I tratti vengono salvati in `localStorage` mentre si disegna** (debounce ~1 s). Se una
telefonata fa scaricare la PWA dalla memoria, riaprendo il disegno è ancora lì. Non è una
bozza sul server: resta locale e viene cancellata all'invio riuscito.

### Formato dei tratti

```jsonc
[ { "c": 3, "w": 1, "p": [412,180, 430,205, 455,240] },
  { "c": 0, "w": 0, "p": [120,600, 118,640] } ]
```

- Spazio logico **1000 × 1000**, coordinate interi: il disegno si ridisegna identico su
  qualsiasi schermo, e la tela rimane quadrata su tutti i device.
- `c` = indice nella palette (0–11), `w` = indice spessore (0–2), `p` = coppie x,y in sequenza.
- Spessori in unità normalizzate: **6, 14, 30**, scalati al lato reale della tela in pixel.
- Semplificazione in acquisizione: si scarta un punto se dista meno di **4 unità** dal precedente.
- Limiti: **200 tratti**, **400 punti per tratto**. Raggiunto il limite, i tratti successivi
  vengono ignorati e la UI mostra un avviso discreto.

Palette (dodici colori, tutti leggibili su tela bianca):

```
0 #1F2933 ink      3 #F2C14E yellow   6 #2AA8A8 teal     9  #7B5EA7 violet
1 #E4572E red      4 #8FBC5A lime     7 #4C9BE8 sky      10 #E86AA6 pink
2 #F4A259 orange   5 #2E9E6B green    8 #3355C4 blue     11 #8C6239 brown
```

## 10. Home

Card, in questo ordine:

1. **Non lette** — "Emily wrote you · 2 unread" oppure "Emily sent you a drawing";
   porta alla più vecchia non letta; sparisce quando sono state lette tutte.
2. **Saldo monete** — tocco → `/shop`.
3. **Segnaposto** per animali che chiedono attenzione (F4) e turni di gioco attivi (F2),
   presenti come componenti vuoti con un testo "coming soon", così F2 e F4 riempiono
   uno spazio già progettato invece di ridisegnare la Home.

Tutte le card sono live via `useRealtimeQuery` mentre l'app è aperta.

## 11. Errori e offline

- Ogni chiamata passa da `lib/rpc.ts`, che traduce gli errori Postgres noti
  (`insufficient_funds`, `invalid_strokes`, `unknown_item`, …) in messaggi in inglese
  leggibili, e tutto il resto in un generico "Something went wrong, try again".
- `useRealtimeQuery` conserva l'ultimo dato valido alla caduta della connessione, mostra
  una striscia "You're offline" discreta, e ri-scarica quando torna l'evento `online`
  o quando il canale Realtime si re-iscrive (`SUBSCRIBED`).
- **Nessuna coda di scrittura offline in F0/F1**: inviare senza rete produce un errore e il
  contenuto resta (testo nel campo, tratti in `localStorage`). La coda si valuterà in F2,
  dove serve davvero — una mossa fatta in metropolitana.

## 12. Test

**Integrazione (Vitest contro Supabase locale, `supabase start`, service role)** — qui vive
la logica, quindi qui vanno i test più importanti:

1. lettera di testo ≥ 40 caratteri → +15 monete, riga di ledger corretta
2. lettera di 10 caratteri → salvata, 0 monete
3. quarta lettera premiata dello stesso giorno → salvata, 0 monete; il cap è per persona
   (Emily può ancora guadagnare)
4. disegno con 5 tratti → +20; con 4 tratti → salvato, 0 monete
5. disegno con tratti malformati → `invalid_strokes`, nessuna riga inserita
6. `mark_letter_read` chiamata dall'autore → nessun effetto
7. `mark_letter_read` chiamata dal destinatario due volte → `read_at` impostato una sola volta
8. `spend_coins` con saldo insufficiente → `insufficient_funds`, saldo invariato
9. due `spend_coins` concorrenti → una fallisce, il saldo non va mai sotto zero
10. un client `authenticated` non riesce a fare `insert` su `letters` né `update` su `couple_state`

**Unit (Vitest, funzioni pure)**: semplificazione dei punti, undo che rimuove esattamente
l'ultimo tratto, round-trip di serializzazione dei tratti, mappatura 0–1000 → pixel,
raggruppamento per mese, derivazione delle non-lette.

**E2E (Playwright, viewport iPhone)** — un solo percorso, quello che deve funzionare sempre:
login → scelta identità → scrittura lettera → comparsa in archivio → disegno di sei tratti →
invio → miniatura in archivio → saldo monete aumentato.

## 13. Economia

Seed di `coin_rules` (le regole delle fasi non ancora costruite restano semplicemente inutilizzate,
ma i valori sono definiti ora per evitare di ribilanciare a pezzi):

| reason | amount | daily_cap | min_units |
|---|---|---|---|
| `letter_written` | 15 | 3 | 40 caratteri |
| `drawing_sent` | 20 | 2 | 5 tratti |
| `question_answered` | 8 | 5 | 0 |
| `game_win` | 20 | — | 0 |
| `game_draw` | 10 | — | 0 |
| `game_loss` | 5 | — | 0 |
| `pet_care_action` | 2 | 30 | 0 |
| `plant_watered` | 3 | 15 | 0 |
| `daily_open` | 10 | 1 | 0 |

Fasce di prezzo di riferimento. **Non sono un seed**: `item_prices` nasce vuota in F0, e queste
cifre sono il vincolo di bilanciamento a cui F4 e F6 dovranno attenersi quando inseriranno le
chiavi reali.

| categoria | costo |
|---|---|
| animale comune | 150 |
| animale non comune | 350 |
| animale esotico | 700 |
| animale fantastico | 1200 |
| pianta | 80 – 300 |
| skin animale | 120 |
| tema app | 400 |
| avatar | 250 |
| adesivo o cornice | 100 – 200 |

Con un uso leggero la coppia guadagna ~60 monete al giorno, con un uso attivo ~200.
Il primo animale arriva in un paio di giorni, un animale fantastico è un obiettivo da settimane,
e i ~45 animali e piante valgono circa 20.000 monete complessive: mesi di progressione senza
che diventi un secondo lavoro.

## 14. Fuori scope in F0+F1

Giochi, animali, domande e shop (solo schermate placeholder navigabili); Web Push;
allegati fotografici; bozze sul server; modifica e cancellazione delle lettere; coda di
scrittura offline; multi-coppia o più di due persone.

## 15. Criteri di accettazione

F0 e F1 sono completi quando, su un telefono reale:

1. Aprendo l'app la prima volta si inserisce la password condivisa e si scelgono Fabrizio o Emily;
   alla riapertura non viene chiesto nulla.
2. La tab bar mostra cinque sezioni; Games, Pets e Questions sono placeholder navigabili;
   il saldo monete nell'header porta allo Shop placeholder.
3. Fabrizio scrive una lettera di testo; sul telefono di Emily, con l'app aperta, la card in Home
   appare **senza ricaricare**.
4. Emily apre la lettera: la card sparisce dalla Home, la lettera resta in archivio, e Fabrizio
   vede "Read on ...".
5. Emily disegna con almeno due colori e due spessori, annulla un tratto, invia; la miniatura
   appare in archivio e il replay ridisegna il disegno.
6. Il saldo monete cresce di 15 per la lettera e 20 per il disegno, e la quarta lettera dello
   stesso giorno non paga.
7. Mettendo il telefono in modalità aereo l'app mostra "You're offline" e conserva i contenuti
   già caricati; tornando online si aggiorna da sola.
8. La suite di integrazione, gli unit test e l'e2e passano.
