-- Schema di Scacchi di Fabrizio & Emily — aggiunta al motore giochi.
-- Da eseguire SOLO SE F0+F1 (docs/schema-completo.sql) E F2
-- (docs/schema-f2-motore-giochi.sql) sono già stati applicati: questo script
-- presuppone che esista già il tipo game_type.
-- Incollare per intero nel SQL Editor del progetto Supabase e premere Run,
-- una volta sola.
-- Una sola riga: si aggiunge solo un valore all'enum esistente, nessuna
-- nuova tabella o funzione.

-- ============================================================
-- 20260828090000_chess_game_type.sql
-- ============================================================
alter type game_type add value 'chess';
