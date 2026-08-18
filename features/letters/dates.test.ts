import { describe, it, expect } from 'vitest';
import { DISPLAY_TIME_ZONE, monthLabel, shortDate, longDate } from './dates';

// Istante scelto apposta a cavallo di due giorni: 1 agosto 03:30 UTC sono le
// 23:30 del 31 luglio a Buffalo e le 05:30 del 1 agosto in Italia. Senza un fuso
// fisso le due persone leggerebbero due date diverse per la stessa lettera.
const ATTRAVERSA_LA_MEZZANOTTE = '2026-08-01T03:30:00Z';

describe('date con fuso fisso', () => {
  it('usa il fuso di Buffalo, lo stesso dei cap nel database', () => {
    expect(DISPLAY_TIME_ZONE).toBe('America/New_York');
  });

  it('monthLabel non dipende dal fuso di chi guarda', () => {
    expect(monthLabel(ATTRAVERSA_LA_MEZZANOTTE)).toBe('July 2026');
  });

  it('shortDate non dipende dal fuso di chi guarda', () => {
    expect(shortDate(ATTRAVERSA_LA_MEZZANOTTE)).toBe('Jul 31');
  });

  it('longDate non dipende dal fuso di chi guarda', () => {
    expect(longDate(ATTRAVERSA_LA_MEZZANOTTE)).toBe('Jul 31, 2026');
  });

  it('il fuso locale darebbe davvero un risultato diverso', () => {
    // Se questa asserzione fallisse, i test sopra non starebbero piu' provando
    // nulla: significherebbe che la macchina gira gia' nel fuso atteso.
    const inItalia = new Date(ATTRAVERSA_LA_MEZZANOTTE).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Europe/Rome',
    });
    expect(inItalia).toBe('Aug 1');
    expect(shortDate(ATTRAVERSA_LA_MEZZANOTTE)).not.toBe(inItalia);
  });

  it('formatta normalmente le date lontane dai confini di giornata', () => {
    expect(monthLabel('2026-08-14T15:00:00Z')).toBe('August 2026');
    expect(shortDate('2026-08-14T15:00:00Z')).toBe('Aug 14');
    expect(longDate('2026-08-14T15:00:00Z')).toBe('Aug 14, 2026');
  });
});
