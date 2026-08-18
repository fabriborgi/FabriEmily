export type ThemeKey = 'theme_night' | 'theme_ocean' | 'theme_sunset' | 'theme_forest';

export type ThemeSwatches = { bg: string; surface: string; accent: string };

/**
 * Catalogo statico: chiave, etichetta e colori di anteprima. Il costo NON
 * vive qui — arriva da item_prices via useShop, fonte unica di verità sul
 * prezzo (vedi spec F6, sezione 5).
 */
export const THEMES: Array<{ key: ThemeKey; label: string; swatches: ThemeSwatches }> = [
  { key: 'theme_night', label: 'Night', swatches: { bg: '#1a1d24', surface: '#242832', accent: '#e0a458' } },
  { key: 'theme_ocean', label: 'Ocean', swatches: { bg: '#eef5f6', surface: '#ffffff', accent: '#1f8a94' } },
  { key: 'theme_sunset', label: 'Sunset', swatches: { bg: '#fdf0f5', surface: '#ffffff', accent: '#d1487a' } },
  { key: 'theme_forest', label: 'Forest', swatches: { bg: '#f1f5ee', surface: '#ffffff', accent: '#4c7a3d' } },
];
