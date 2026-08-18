import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeCard } from './ThemeCard';
import { THEMES } from './themes';

const purchaseItem = vi.fn();
const activateTheme = vi.fn();
vi.mock('./queries', () => ({
  purchaseItem: (...a: unknown[]) => purchaseItem(...a),
  activateTheme: (...a: unknown[]) => activateTheme(...a),
}));

const ocean = THEMES.find((t) => t.key === 'theme_ocean')!;

describe('ThemeCard', () => {
  beforeEach(() => {
    purchaseItem.mockReset();
    activateTheme.mockReset();
    purchaseItem.mockResolvedValue({ data: null, error: null });
    activateTheme.mockResolvedValue({ data: null, error: null });
  });

  it('non posseduto: mostra il prezzo; comprando, acquista e poi attiva', async () => {
    render(<ThemeCard theme={ocean} cost={100} owned={false} active={false} who="fabrizio" />);
    screen.getByRole('button', { name: 'Buy for 100 coins' }).click();
    await waitFor(() => expect(purchaseItem).toHaveBeenCalledWith('fabrizio', 'theme_ocean'));
    await waitFor(() => expect(activateTheme).toHaveBeenCalledWith('theme_ocean'));
  });

  it('posseduto ma non attivo: mostra Activate, non il prezzo', () => {
    render(<ThemeCard theme={ocean} cost={100} owned active={false} who="fabrizio" />);
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDefined();
    expect(screen.queryByText(/Buy for/)).toBeNull();
  });

  it('attivando un tema posseduto, chiama solo activateTheme', async () => {
    render(<ThemeCard theme={ocean} cost={100} owned active={false} who="emily" />);
    screen.getByRole('button', { name: 'Activate' }).click();
    await waitFor(() => expect(activateTheme).toHaveBeenCalledWith('theme_ocean'));
    expect(purchaseItem).not.toHaveBeenCalled();
  });

  it('attivo: mostra l’etichetta Active, nessun pulsante azionabile', () => {
    render(<ThemeCard theme={ocean} cost={100} owned active who="fabrizio" />);
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('acquisto fallito per monete insufficienti: mostra l’errore, non attiva', async () => {
    purchaseItem.mockResolvedValue({
      data: null,
      error: "You don't have enough coins for that yet.",
    });
    render(<ThemeCard theme={ocean} cost={100} owned={false} active={false} who="fabrizio" />);
    screen.getByRole('button', { name: 'Buy for 100 coins' }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(activateTheme).not.toHaveBeenCalled();
  });

  it('due tocchi rapidi su Buy inviano un solo acquisto', async () => {
    render(<ThemeCard theme={ocean} cost={100} owned={false} active={false} who="fabrizio" />);
    const button = screen.getByRole('button', { name: 'Buy for 100 coins' });
    button.click();
    button.click();
    await waitFor(() => expect(purchaseItem).toHaveBeenCalled());
    expect(purchaseItem).toHaveBeenCalledTimes(1);
  });
});
