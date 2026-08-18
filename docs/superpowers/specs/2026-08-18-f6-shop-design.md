# F6 — Shop

Data: 2026-08-18
Stato: approvato in brainstorming, da eseguire
Progetto: web app di coppia "Fabrizio & Emily"

---

## 1. Contesto e scope

Quinta fase del progetto, dopo F0+F1 (fondazioni, lettere) e F5 (Domande) già
in produzione. Dal README originale: negozio dove spendere le monete
guadagnate altrove per sbloccare temi, avatar e decorazioni. Questa fase
copre **solo i temi colore**: avatar e decorazioni estetiche restano fuori
scope (vedi sezione 9) perché richiederebbero un concetto — immagini/icone
per persona — che oggi non esiste in nessuna parte dell'app, mentre i temi
hanno già l'infrastruttura pronta da F0+F1.

Fase autonoma: non dipende da F2/F3/F4 e non ne è dipesa. Riusa
l'infrastruttura già esistente e finora inutilizzata, lasciata pronta apposta
in F0+F1:

- `item_prices` (catalogo chiave→costo, nato vuoto "le chiavi arrivano con F4
  e F6")
- `spend_coins` (funzione già completa e testata: legge il costo da
  `item_prices`, blocca `couple_state` con `for update`, scala le monete,
  registra il movimento in `coin_ledger`)
- `couple_state.theme` (campo testo, default `'default'`)
- Il commento in `app/globals.css`: *"In F6 un tema acquistato ridefinisce
  questi valori e nient'altro: nessun componente scrive colori propri."*

## 2. Decisioni prese, con le motivazioni

| Decisione | Scelta | Perché |
|---|---|---|
| Scope | **Solo temi colore** | Avatar e decorazioni non hanno infrastruttura preesistente (niente Storage, niente concetto di immagine per persona in nessuna parte dell'app); i temi sì. Una prima versione dello shop più piccola e concreta batte uno scope ampio senza fondamenta. |
| Proprietà vs. attivazione | **Comprato una volta, riattivabile gratis in seguito** | Serve una tabella di "posseduti" separata dall'atto d'acquisto: si paga una volta, poi si sceglie liberamente fra i temi già propri, incluso tornare al default, senza ripagare. |
| Generalità dell'acquisto | **`purchase_item` generico, non specifico ai temi** | `item_prices` è stata lasciata vuota apposta anche per F4 (skin animali). L'acquisto (scala monete, registra proprietà) e l'attivazione (rende un tema quello attivo) sono due passi distinti: il primo è riusabile da F4 tale e quale, il secondo resta specifico ai temi. |
| Prezzo | **100 monete, uniforme per tutti i 4 temi acquistabili** | Nessuna gerarchia da giustificare per una prima versione; è un traguardo raggiungibile ma non immediato (circa 7 lettere, o 13 risposte a domande, o 5 partite vinte). |
| Applicazione del tema | **CSS variables via attributo `data-theme` sull'`<html>`, in tempo reale su entrambi i dispositivi** | Coerente col commento già presente in `globals.css`: nessun componente scrive colori propri. `couple_state.theme` è condiviso (un solo campo, non per persona), quindi se un partner cambia tema lo vede anche l'altro senza ricaricare — stesso trattamento realtime già riservato a `coins`. |
| Conferma d'acquisto | **Nessuna modale, un tap esegue subito** | Coerente con lo skip delle domande in F5: azioni a basso rischio (le monete restano nel ledger, nessuna perdita di contenuto) non hanno bisogno di un secondo passaggio. |

## 3. Schema dati

```sql
-- Tabella condivisa dalla coppia, come couple_state: non per persona.
-- La chiave primaria stessa impedisce di possedere due volte lo stesso
-- oggetto, senza bisogno dell'indice parziale usato in F5 per "un round alla
-- volta" — qui il vincolo è su un valore, non su una condizione.
create table owned_items (
  key          text primary key references item_prices(key),
  purchased_at timestamptz not null default now()
);

grant select on owned_items to authenticated;
alter table owned_items enable row level security;
create policy read_for_authenticated on owned_items for select to authenticated using (true);

alter publication supabase_realtime add table owned_items;
-- couple_state è già in pubblicazione da F0+F1: nessuna aggiunta necessaria
-- lì per propagare il cambio di couple_state.theme.
```

I 4 temi acquistabili sono righe in `item_prices` (nessuna tabella nuova per
il catalogo): `theme_night`, `theme_ocean`, `theme_sunset`, `theme_forest`,
tutte a costo 100. Il tema `default` non è mai una riga di `item_prices`: è
sempre disponibile senza acquisto (vedi funzione `select_theme` sotto).

## 4. Funzioni

Entrambe `security definer`, `set search_path = public`, `revoke`/`grant`
espliciti — stesso stile di F0+F1/F5.

### `purchase_item(p_actor person, p_item_key text) returns void`

Generica, pensata per essere riusata da F4.

1. Se `p_item_key` è già in `owned_items`, solleva `already_owned`.
2. Richiama `spend_coins(p_actor, p_item_key)` — riusa la funzione esistente
   così com'è: legge il costo da `item_prices` (solleva `unknown_item` se la
   chiave non esiste), blocca `couple_state` con `for update`, scala le
   monete o solleva `insufficient_funds`, registra il movimento nel ledger.
3. Inserisce `(p_item_key)` in `owned_items`. Una violazione di unicità
   concorrente (due acquisti simultanei dello stesso oggetto) diventa
   `already_owned` — stesso pattern del `round_already_open` di F5: il
   controllo al punto 1 è la via rapida per il messaggio giusto, il vincolo
   del database è la vera rete di sicurezza sotto concorrenza.

```sql
create or replace function purchase_item(p_actor person, p_item_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from owned_items where key = p_item_key) then
    raise exception 'already_owned';
  end if;

  perform spend_coins(p_actor, p_item_key);

  begin
    insert into owned_items (key) values (p_item_key);
  exception when unique_violation then
    raise exception 'already_owned';
  end;
end
$$;

revoke all on function purchase_item(person, text) from public, anon;
grant execute on function purchase_item(person, text) to authenticated;
```

### `select_theme(p_theme_key text) returns void`

Specifica ai temi. Attivare un tema già posseduto è gratis.

1. Se `p_theme_key <> 'default'` e la chiave non è in `owned_items`, solleva
   `theme_not_owned`.
2. Aggiorna `couple_state.theme = p_theme_key`.

```sql
create or replace function select_theme(p_theme_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_theme_key <> 'default' and not exists (
    select 1 from owned_items where key = p_theme_key
  ) then
    raise exception 'theme_not_owned';
  end if;

  update couple_state set theme = p_theme_key, updated_at = now() where id = 1;
end
$$;

revoke all on function select_theme(text) from public, anon;
grant execute on function select_theme(text) to authenticated;
```

## 5. Frontend

Stessa forma di `features/letters/` e `features/questions/`:

```
features/shop/
  themes.ts             catalogo statico { key, label, swatches } per il rendering — non è fonte di verità sul prezzo
  queries.ts             fetchShopState, purchaseItem, activateTheme
  useShop.ts              hook realtime: item_prices + owned_items + couple_state
  useActiveTheme.ts       hook leggero: solo couple_state.theme, per applicare il data-theme globale
  ThemeCard.tsx           anteprima colori + prezzo + pulsante di stato
  shop.module.css

app/shop/page.tsx        sostituisce il segnaposto di F0+F1
```

`useActiveTheme` è consumato da un piccolo componente client (aggiunto dentro
`AppChrome`, che è già client-side) con un `useEffect` che imposta
`document.documentElement.dataset.theme`. Un breve istante col tema default
prima dell'idratazione è accettabile, coerente con altri stati di
caricamento già presenti nell'app (es. `CoinPill` mostra `—` finché non ha
il saldo).

`ThemeCard` ha tre stati derivati da `owned_items` e `couple_state.theme`:

1. **Non posseduto** → "Buy for 100 coins", disabilitato se le monete non
   bastano (lo stesso controllo lato client di F5/F0 per i pulsanti d'invio:
   solo UX, l'unica fonte di verità resta `spend_coins` lato database).
2. **Posseduto, non attivo** → "Activate" (gratis).
3. **Attivo** → etichetta "Active", pulsante disabilitato.

Il pulsante "Buy" esegue `purchaseItem` e, se va a buon fine, richiama subito
`activateTheme` — comprare applica subito il tema, come richiesto dal README
("Gli acquisti si applicano subito"), mantenendo comunque le due funzioni
database separate e generiche. Come `QuestionCard` in F5: una guardia
sincrona (`useRef`) impedisce un secondo invio mentre il primo è in corso, e
il pulsante mostra uno stato "Buying…"/"Activating…". Se `purchaseItem` va a
buon fine ma `activateTheme` fallisce (es. connessione caduta a metà), il
tema resta comunque posseduto: la card si aggiorna via realtime mostrando
"Activate", pronta per un secondo tap — nessuna moneta persa, nessuno stato
sporco.

## 6. Contenuti — i 5 temi

Il tema `Default` esiste già in `globals.css` (":root", "carta e inchiostro
caldi") e resta gratuito. I 4 acquistabili ridefiniscono le stesse variabili
sotto un selettore `[data-theme="..."]`, mai `--paper` (la tela dei disegni
resta sempre bianca, per restare leggibile ai tratti salvati con una palette
pensata per fondo chiaro):

| Tema | `--bg` | `--surface` | `--fg` | `--fg-muted` | `--line` | `--accent` | `--accent-fg` |
|---|---|---|---|---|---|---|---|
| `theme_night` (Night) | `#1a1d24` | `#242832` | `#e8e6e1` | `#9ca3af` | `#363c48` | `#e0a458` | `#1a1d24` |
| `theme_ocean` (Ocean) | `#eef5f6` | `#ffffff` | `#17323a` | `#5b7b82` | `#cfe3e6` | `#1f8a94` | `#ffffff` |
| `theme_sunset` (Sunset) | `#fdf0f5` | `#ffffff` | `#3a1f2c` | `#8a6a76` | `#f2d9e2` | `#d1487a` | `#ffffff` |
| `theme_forest` (Forest) | `#f1f5ee` | `#ffffff` | `#1f2e1a` | `#647a5c` | `#d9e5cf` | `#4c7a3d` | `#ffffff` |

Ogni riga di `item_prices` per questi 4 temi: `cost = 100`, `label` in
inglese (es. "Night theme").

## 7. Errori e casi limite

| Codice | Quando | Comportamento atteso lato client |
|---|---|---|
| `already_owned` | Si prova a comprare un tema già posseduto | Non dovrebbe succedere dall'interfaccia (il pulsante mostra "Activate", non "Buy", per i posseduti); se arriva comunque, messaggio generico e refetch |
| `insufficient_funds` | Monete insufficienti | Già tradotto in `lib/rpc.ts` ("You don't have enough coins for that yet.") — nessuna modifica |
| `unknown_item` | Chiave non in `item_prices` | Già tradotto in `lib/rpc.ts` ("That item doesn't exist anymore.") — non dovrebbe capitare, il catalogo del frontend viene dalla stessa tabella |
| `theme_not_owned` | Si prova ad attivare un tema non posseduto | Difensivo: la UI mostra "Activate" solo per temi già in `owned_items`; messaggio generico se capita comunque |

## 8. Test

Stesso impianto di F0+F1/F5:

- **Integrazione** (Vitest contro Supabase locale): `purchase_item` scala le
  monete e registra il possesso nella stessa transazione, rifiuta un secondo
  acquisto dello stesso oggetto, traduce la violazione di unicità
  concorrente in `already_owned`, propaga `insufficient_funds` e
  `unknown_item` da `spend_coins` senza modificarli; `select_theme` attiva
  un tema posseduto, rifiuta uno non posseduto, permette sempre `'default'`;
  i privilegi (`authenticated` sì, `anon` no) su entrambe le funzioni; RLS in
  lettura su `owned_items`.
- **Unit**: `ThemeCard` nei suoi tre stati (non posseduto/posseduto non
  attivo/attivo) più il caso "monete insufficienti", `useShop` e
  `useActiveTheme` sul modello di `useActiveRound`/`useCoins`.

## 9. Fuori scope in questa fase

Avatar personalizzati e decorazioni estetiche (cornici, adesivi, effetti) dal
README — richiedono un concetto di immagine/icona per persona che non esiste
oggi in nessuna parte dell'app (niente Supabase Storage in uso), fase
separata se e quando servirà. Anteprima "prova prima di comprare" (il tema si
applica solo dopo l'acquisto, non prima). Storico degli acquisti come
schermata dedicata (i dati restano comunque interrogabili da `coin_ledger` e
`owned_items` se servirà in futuro). Prezzi differenziati per tema.

## 10. Criteri di accettazione

1. Comprando un tema con monete sufficienti, si applica subito su entrambi i
   dispositivi in tempo reale, senza ricaricare.
2. Comprando un tema con monete insufficienti, l'acquisto fallisce con un
   messaggio chiaro e nessuna variazione di saldo o proprietà.
3. Un tema già posseduto si riattiva gratis in qualsiasi momento, incluso
   tornare al `default`.
4. Nessun componente dell'app definisce colori propri: cambiare tema cambia
   l'aspetto ovunque tramite le sole variabili CSS.
5. La tela dei disegni (`--paper`) resta invariata a prescindere dal tema
   attivo.
