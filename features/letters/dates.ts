/**
 * Formattazione delle date delle lettere, con un fuso orario FISSO.
 *
 * Perche' non il fuso di chi guarda: le due persone vivono a sei ore di
 * distanza, e l'archivio e' condiviso. Con il fuso locale la stessa identica
 * lettera puo' comparire sotto "July" per una e sotto "August" per l'altra, e
 * la data mostrata sulla card differisce di un giorno per tutto cio' che e'
 * stato scritto fra mezzanotte e le sei del mattino italiane. Un archivio
 * condiviso che non concorda su quando sono successe le cose e' un archivio
 * che confonde chi lo legge insieme.
 *
 * Il fuso scelto e' quello di Buffalo, lo stesso che il database usa per il
 * confine delle giornate nei cap delle monete (vedi grant_coins): tutta l'app
 * ragiona sul calendario di Emily, e cosi' "oggi" significa la stessa cosa
 * ovunque compaia.
 */
export const DISPLAY_TIME_ZONE = 'America/New_York';

/** "August 2026" — intestazione dei gruppi mensili nell'archivio. */
export const monthLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  });

/** "Aug 14" — data compatta sulle card dell'archivio. */
export const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  });

/** "Aug 14, 2026" — data estesa nel dettaglio di una lettera. */
export const longDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  });
