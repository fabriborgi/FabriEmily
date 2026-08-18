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

/**
 * Il tema di base, sempre posseduto e gratuito: non è mai una riga di
 * item_prices/owned_items (select_theme lo permette sempre, senza controllo
 * di possesso). Non fa parte di THEMES perché non è acquistabile — va
 * renderizzato a parte nella pagina, con lo stesso ThemeCard ma owned
 * incondizionatamente vero.
 */
export const DEFAULT_THEME: { key: 'default'; label: string; swatches: ThemeSwatches } = {
  key: 'default',
  label: 'Default',
  swatches: { bg: '#faf6f0', surface: '#ffffff', accent: '#c65f52' },
};
