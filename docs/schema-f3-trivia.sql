-- Schema F3.2 di Fabrizio & Emily — aggiunta di Trivia al motore giochi.
-- Da eseguire SOLO SE F0+F1 (docs/schema-completo.sql) E F2
-- (docs/schema-f2-motore-giochi.sql) sono già stati applicati: questo script
-- presuppone che esista già il tipo game_type.
-- Incollare per intero nel SQL Editor del progetto Supabase e premere Run,
-- una volta sola.
-- Una sola riga: F3.2 aggiunge solo un valore all'enum esistente, nessuna
-- nuova tabella o funzione. Le domande vivono come dati statici nel codice
-- frontend (features/games/trivia/questions.ts), non nel database.

-- ============================================================
-- 20260822090000_trivia_game_type.sql
-- ============================================================
alter type game_type add value 'trivia';
