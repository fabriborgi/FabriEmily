export type SkinKey =
  | 'skin_gold'
  | 'skin_ocean'
  | 'skin_sunset'
  | 'skin_forest'
  | 'skin_rose'
  | 'skin_mint'
  | 'skin_violet'
  | 'skin_charcoal';

export type Skin = {
  key: SkinKey;
  label: string;
  /** Applicato all'emoji/immagine della specie con style={{ filter }}. */
  filter: string;
  /** Solo per l'anteprima del picker (cerchio colorato) — non è il colore reale della creatura. */
  swatch: string;
};

/**
 * Catalogo statico: chiave, etichetta, filtro e swatch di anteprima. Il
 * costo NON vive qui — arriva da item_prices via usePets, fonte unica di
 * verità sul prezzo (stesso principio di features/shop/themes.ts e
 * features/pets/species.ts).
 */
export const SKINS: Skin[] = [
  { key: 'skin_gold', label: 'Gold', filter: 'hue-rotate(35deg) saturate(1.6) brightness(1.1)', swatch: '#d4a12a' },
  { key: 'skin_ocean', label: 'Ocean blue', filter: 'hue-rotate(190deg) saturate(1.5)', swatch: '#1f7ac2' },
  { key: 'skin_sunset', label: 'Sunset orange', filter: 'hue-rotate(-20deg) saturate(1.5) brightness(1.05)', swatch: '#e0672f' },
  { key: 'skin_forest', label: 'Forest green', filter: 'hue-rotate(90deg) saturate(1.4)', swatch: '#3f7a3d' },
  { key: 'skin_rose', label: 'Rose pink', filter: 'hue-rotate(300deg) saturate(1.5)', swatch: '#d1487a' },
  { key: 'skin_mint', label: 'Mint', filter: 'hue-rotate(140deg) saturate(1.3) brightness(1.1)', swatch: '#3fbf9f' },
  { key: 'skin_violet', label: 'Violet', filter: 'hue-rotate(250deg) saturate(1.5)', swatch: '#7a4fc2' },
  { key: 'skin_charcoal', label: 'Charcoal', filter: 'grayscale(1) brightness(0.75)', swatch: '#4a4a4a' },
];

/** Il filtro CSS della skin attiva, o undefined se nessuna (colore naturale). */
export function skinFilterFor(activeSkin: string | null | undefined): string | undefined {
  return SKINS.find((s) => s.key === activeSkin)?.filter;
}
