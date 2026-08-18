# Mettere l'app online

Quattro passi. Solo il primo e il terzo richiedono di scegliere qualcosa;
gli altri due sono copia e incolla.

## 1. Creare il database

Su supabase.com, crea un progetto (piano gratuito). La regione conviene
sceglierla vicina a Emily: l'app usa gia' il suo fuso orario per decidere
quando finisce la giornata.

## 2. Creare le tabelle

Nel progetto: **SQL Editor** → New query → incolla **tutto** il contenuto di
`docs/schema-completo.sql` → Run.

Deve rispondere "Success. No rows returned". Per controllare che sia andata:
**Table Editor** deve mostrare cinque tabelle (`couple_state`, `coin_rules`,
`item_prices`, `coin_ledger`, `letters`), e `coin_rules` deve contenere nove
righe.

## 3. Creare l'utente della coppia

**Authentication** → **Users** → **Add user** → *Create new user*:

- Email: `couple@fabriemily.app` (o quella che preferisci: dovra' combaciare
  con la variabile del passo 4)
- Password: **quella che userete davvero voi due**
- Spunta **Auto Confirm User**

Nell'app non esiste registrazione: questo e' l'unico modo di entrare, e questa
password e' l'unica cosa che protegge le vostre lettere.

## 4. Collegare Netlify

Servono i valori da **Project Settings → API Keys** e **→ Data API**:

| Variabile su Netlify | Valore su Supabase | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Data API → **Project URL** | del tipo `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API Keys → **Publishable key** | inizia con `sb_publishable_` |
| `NEXT_PUBLIC_COUPLE_EMAIL` | l'email del passo 3 | |

**Attenzione al nome delle chiavi.** Supabase ha rinominato le sue chiavi: la
vecchia "anon key" oggi si chiama **Publishable key**. E' quella giusta, ed e'
sicura da mettere in un'app che gira nel browser — le RLS impediscono di
leggere qualsiasi cosa senza aver fatto il login.

**NON usare la Secret key** (`sb_secret_...`): quella scavalca ogni controllo
di sicurezza e non deve mai finire in codice che gira nel browser.

Su Netlify: **Project configuration → Environment variables → Add a variable**,
una variabile per riga della tabella, lasciando "Same value in all deploy
contexts".

Poi **Deploys → Trigger deploy → Clear cache and deploy site**.

La pulizia della cache non e' facoltativa: le variabili che iniziano per
`NEXT_PUBLIC_` vengono scritte dentro il codice al momento della costruzione,
non lette quando l'app gira. Senza svuotare la cache Netlify puo' riusare la
costruzione precedente, che quelle variabili non le contiene, e vedresti
ancora lo stesso errore.

## Se qualcosa non torna

L'app ora dice cosa le manca invece di morire in silenzio. La pagina
"Almost there" nomina la variabile assente: quel nome e' la diagnosi.

- **"Missing environment variable NEXT_PUBLIC_SUPABASE_URL"** → la variabile
  non c'e' su Netlify, oppure c'e' ma non e' stato fatto un deploy con la cache
  pulita dopo averla aggiunta.
- **Entra ma dice "That's not the password"** → la password non corrisponde a
  quella dell'utente creato al passo 3, oppure `NEXT_PUBLIC_COUPLE_EMAIL` non
  combacia con la sua email.
- **Entra ma l'archivio resta vuoto e compare un errore** → lo schema del passo
  2 non e' stato eseguito, o e' stato eseguito solo in parte.

## Dopo che funziona

Su iPhone, apri il sito in Safari e scegli **Aggiungi alla schermata Home**.
Da li' si apre a schermo pieno con la sua icona, ed e' il modo in cui l'app e'
pensata per essere usata.
