Prompt di sviluppo — Sito web di coppia "Fabrizio & Emily"
Obiettivo generale
Crea una web app mobile-first che sia in inglese per una coppia a distanza (Fabrizio ed Emily) che permetta loro di giocare insieme, scriversi lettere, prendersi cura di animali/piante virtuali, farsi domande, e personalizzare l'esperienza tramite uno shop. L'app deve funzionare bene principalmente su smartphone (design responsive, ma ottimizzato prima per mobile).
Stack tecnico
* Frontend: React (o Next.js), design mobile-first, PWA-ready (installabile su home screen)
* Backend/Dati: Supabase (Postgres + Auth + Realtime + Storage), piano gratuito
* Realtime: Supabase Realtime (o canali websocket di Supabase) per la sincronizzazione live dei giochi tra i due dispositivi
* Hosting frontend: Vercel o Netlify (piano gratuito)
Autenticazione
* Un'unica password condivisa per accedere all'app (nessun sistema di registrazione).
* Dopo l'accesso, l'utente sceglie "Sei Fabrizio" o "Sei Emily" — questa scelta determina l'identità con cui interagisce con l'app (persistita in sessione/local storage così non va rifatta a ogni apertura).
* Tutti i dati (monete, animali, lettere, punteggi) sono condivisi in un unico spazio dati per la coppia, ma taggati con "autore/giocatore" (Fabrizio o Emily) dove serve.
Struttura dell'app (navigazione a 5 sezioni, tab bar in basso ottimizzata per mobile)
1. Home
Dashboard che mostra: eventuali nuove lettere non ancora aperte, stato rapido degli animali che richiedono attenzione (es. "il koala ha fame"), saldo monete, eventuali inviti/turni attivi nei giochi.
2. Giochi
* Elenco giochi in tempo reale a due giocatori: Tris, Forza 4, Blackjack, Trivia, + almeno 1-2 giochi aggiuntivi pensati per coppie (proponi tu opzioni: es. "Indovina la risposta dell'altro", memory a coppie, quiz "quanto mi conosci").
* Ogni partita si gioca in tempo reale: un giocatore fa una mossa, l'altro la vede aggiornarsi live (Supabase Realtime).
* Se l'altro giocatore non è online, la partita resta "in attesa" finché non si connette (nessun turno perso).
* Per ogni gioco, tenere uno storico persistente: numero di vittorie di Fabrizio, numero di vittorie di Emily, pareggi.
* Vincere una partita assegna monete.
3. Lettere
* Chiunque dei due può scrivere una lettera di lunghezza libera, in qualsiasi momento, anche più volte al giorno.
* Una lettera non ancora letta dal destinatario appare in evidenza nella Home.
* Una volta aperta/letta, la lettera scompare dalla Home e passa nell'archivio permanente della sezione Lettere, visibile con tutte le lettere scritte da entrambi, ordinate cronologicamente.
* Scrivere una lettera assegna monete.
4. Animali e piante
* Sistema di cura con almeno 30 animali distinti (+ 15 piante), ciascuno sbloccabile progressivamente tramite monete e con curiosità riguardo all’animale/pianta.
* Ogni animale ha statistiche da mantenere (fame, pulizia, gioco/affetto) che decadono nel tempo e vanno reintegrate con azioni (dar da mangiare, pulire, giocare).
* Ogni specie ha bisogni diversi e tassi di decadimento diversi (es. koala ha fabbisogno di cibo basso, cane ha bisogno alto di gioco, pony ha bisogno alto di cibo) — definisci una tabella di parametri per specie.
* Ogni animale ha skin/colori sbloccabili separatamente, acquistabili con monete.
* Le monete si guadagnano interagendo con gli animali, annaffiando le piante giocando ai giochi di coppia, e scrivendo lettere.
* Proponi tu una lista di 30+ animali con parametri di cura ragionevoli e variati (mix di animali domestici, esotici, fantastici) e alcune piante con cura più semplice (solo "acqua"/"luce").
5. Domande
* Libreria di 300 domande, categorizzate (es. "profonde", "piccanti", "sul partner", "situazioni ipotetiche/casuali").
* Modalità: pesca una domanda a caso o scegli per categoria, entrambi rispondono e vedono la risposta dell'altro.
* Tieni traccia di quali domande sono già state fatte per non ripeterle subito.
6. Shop
* Acquistabili con le monete: colore/tema dello sfondo dell'app, avatar personalizzato per Fabrizio ed Emily, piccoli dettagli estetici extra (cornici, adesivi, effetti).
* Gli acquisti si applicano subito e sono visibili nell'interfaccia (tema, avatar in home, ecc.).
Sistema economico (monete)
Unica valuta condivisa "monete coppia", guadagnata da: interazioni con animali, vittorie/partite ai giochi, scrittura lettere, risposta a domande. Spendibile in: sblocco animali, skin animali, articoli shop. Definisci tu valori di guadagno/costo bilanciati e coerenti in tutto il progetto.
Requisiti tecnici trasversali
* Design mobile-first, touch-friendly, con tab bar di navigazione inferiore.
* Aggiornamenti realtime per giochi e notifica nuove lettere (Supabase Realtime/subscriptions).
* Persistenza di tutti i dati (monete, animali, cronologia giochi, lettere, domande fatte, acquisti shop) su Supabase.
* Gestione offline ragionevole: se un utente perde connessione durante un gioco, la partita deve poter riprendere.
* Codice organizzato in componenti riutilizzabili, con una chiara separazione tra logica di gioco, gestione stato animali, e gestione contenuti (lettere/domande).
Cosa fare per primo
Proponi un piano di sviluppo a fasi (setup progetto + Supabase + auth → sezione Lettere → sezione Giochi con un solo gioco realtime funzionante end-to-end → estensione agli altri giochi → sezione Animali → sezione Domande → Shop), spiegando le dipendenze tra le fasi prima di iniziare a scrivere codice.
