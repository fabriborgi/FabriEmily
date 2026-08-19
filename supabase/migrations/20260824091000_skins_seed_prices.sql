-- Palette globale di 8 colori, riusabile su qualunque animale/pianta
-- posseduto (spec F4.2, sezione 6). Costo uniforme, più economico dei
-- temi di Shop (100) essendo una personalizzazione più piccola.
insert into item_prices (key, cost, label) values
  ('skin_gold', 50, 'Gold'),
  ('skin_ocean', 50, 'Ocean blue'),
  ('skin_sunset', 50, 'Sunset orange'),
  ('skin_forest', 50, 'Forest green'),
  ('skin_rose', 50, 'Rose pink'),
  ('skin_mint', 50, 'Mint'),
  ('skin_violet', 50, 'Violet'),
  ('skin_charcoal', 50, 'Charcoal');
