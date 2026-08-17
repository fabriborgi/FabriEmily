/**
 * Le variabili d'ambiente NEXT_PUBLIC_* sono inlined a build time: se ne manca una,
 * il valore è `undefined` e il bug si manifesta molto lontano dalla causa.
 * Questa funzione lo fa fallire subito, con il nome della variabile nel messaggio.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
