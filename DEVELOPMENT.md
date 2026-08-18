# Sviluppo locale

Questo file documenta le credenziali **del solo database locale**, quello che gira
in Docker sul Mac di sviluppo. Non hanno nulla a che vedere con la password che la
coppia sceglierà per l'app in produzione, e non danno accesso a nessun dato reale.

## Entrare nell'app in locale

1. `npm run db:start` — avvia Supabase in Docker e scrive `.env.test`
2. `npm run dev` — avvia l'app su http://localhost:3000
3. Alla richiesta della password condivisa: **`sviluppo-locale`**

L'utente corrispondente è quello indicato da `NEXT_PUBLIC_COUPLE_EMAIL` in `.env.local`.

Se la password smette di funzionare (per esempio dopo un `npm run db:reset`, che
ricrea il database da zero), ricreare l'utente con la service role key presa da
`.env.test`, usando `auth.admin.createUser({ email, password, email_confirm: true })`.

## Perché è scritta qui in chiaro

Perché è una credenziale usa-e-getta di un database che vive solo su questa macchina,
e lasciarla non documentata ha gia' portato un agente a resettarla per poter lavorare.
Le credenziali vere — quelle del progetto Supabase in cloud — non vanno mai messe in
un file versionato: vivono solo nel pannello di Netlify.
