-- Colore attivo su questo animale/pianta, o null per il colore naturale.
-- Nessuna FK verso item_prices: la vera regola non è "la chiave esiste"
-- ma "è stata comprata" (owned_items), un controllo che vive nella
-- funzione select_pet_skin (Task 2), non nello schema — stesso principio
-- già in vigore per select_theme (F6).
alter table pets add column active_skin text null;
