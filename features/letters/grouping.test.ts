import { describe, it, expect } from 'vitest';
import { groupByMonth, isUnread, unreadFor } from './grouping';
import type { Letter } from './queries';

const letter = (over: Partial<Letter> = {}): Letter => ({
  id: crypto.randomUUID(),
  author: 'emily',
  kind: 'text',
  body: 'hello',
  strokes: null,
  created_at: '2026-08-14T10:00:00Z',
  read_at: null,
  ...over,
});

describe('groupByMonth', () => {
  it('raggruppa per mese e anno, con etichette in inglese', () => {
    const groups = groupByMonth([
      letter({ created_at: '2026-08-14T10:00:00Z' }),
      letter({ created_at: '2026-08-02T10:00:00Z' }),
      letter({ created_at: '2026-07-30T10:00:00Z' }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['August 2026', 'July 2026']);
    expect(groups[0].letters).toHaveLength(2);
  });

  it('tiene distinti gli stessi mesi di anni diversi', () => {
    const groups = groupByMonth([
      letter({ created_at: '2026-08-14T10:00:00Z' }),
      letter({ created_at: '2025-08-14T10:00:00Z' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('su una lista vuota non produce gruppi', () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it('conserva l’ordine di arrivo dentro ogni gruppo', () => {
    const first = letter({ created_at: '2026-08-14T10:00:00Z', body: 'prima' });
    const second = letter({ created_at: '2026-08-13T10:00:00Z', body: 'seconda' });
    expect(groupByMonth([first, second])[0].letters.map((l) => l.body)).toEqual([
      'prima',
      'seconda',
    ]);
  });
});

describe('coerenza fra i due fusi', () => {
  it('mette una lettera nello stesso mese per entrambe le persone', () => {
    // 1 agosto 03:30 UTC = 31 luglio 23:30 a Buffalo, 1 agosto 05:30 in Italia.
    // Con il fuso di chi guarda, le due persone vedrebbero due mesi diversi
    // per la stessa identica lettera. Il fuso fisso lo impedisce.
    const groups = groupByMonth([letter({ created_at: '2026-08-01T03:30:00Z' })]);
    expect(groups[0].label).toBe('July 2026');
  });

  it('non dipende dal fuso del dispositivo che la mostra', () => {
    const iso = '2026-08-01T03:30:00Z';
    const atRome = new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Rome',
    });
    // Prova che il fuso locale darebbe un risultato diverso: se un giorno
    // questa asserzione fallisse, il test sopra non starebbe piu' provando nulla.
    expect(atRome).toBe('August 2026');
    expect(groupByMonth([letter({ created_at: iso })])[0].label).not.toBe(atRome);
  });
});

describe('raggruppamento su liste non ordinate', () => {
  it('unisce le lettere dello stesso mese anche se non sono contigue', () => {
    const groups = groupByMonth([
      letter({ created_at: '2026-08-14T12:00:00Z' }),
      letter({ created_at: '2026-07-30T12:00:00Z' }),
      letter({ created_at: '2026-08-02T12:00:00Z' }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['August 2026', 'July 2026']);
    expect(groups[0].letters).toHaveLength(2);
  });
});

describe('isUnread', () => {
  it('è non letta se l’ha scritta l’altro e non è stata aperta', () => {
    expect(isUnread(letter({ author: 'emily', read_at: null }), 'fabrizio')).toBe(true);
  });

  it('le proprie lettere non sono mai non lette', () => {
    expect(isUnread(letter({ author: 'emily', read_at: null }), 'emily')).toBe(false);
  });

  it('una lettera già aperta non è non letta', () => {
    expect(
      isUnread(letter({ author: 'emily', read_at: '2026-08-14T11:00:00Z' }), 'fabrizio'),
    ).toBe(false);
  });
});

describe('unreadFor', () => {
  it('restituisce solo le non lette, dalla più vecchia alla più recente', () => {
    const older = letter({ created_at: '2026-08-10T10:00:00Z', body: 'vecchia' });
    const newer = letter({ created_at: '2026-08-14T10:00:00Z', body: 'nuova' });
    const mine = letter({ author: 'fabrizio', body: 'mia' });
    const read = letter({ read_at: '2026-08-14T12:00:00Z', body: 'letta' });
    expect(unreadFor([newer, read, older, mine], 'fabrizio').map((l) => l.body)).toEqual([
      'vecchia',
      'nuova',
    ]);
  });

  it('senza non lette restituisce una lista vuota', () => {
    expect(unreadFor([letter({ author: 'fabrizio' })], 'fabrizio')).toEqual([]);
  });
});
