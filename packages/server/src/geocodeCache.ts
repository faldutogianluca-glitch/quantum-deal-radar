import type { CacheGeocoding, RisultatoGeocoding } from "@qdr/core";

import { db } from "./db.js";

db.exec(`
CREATE TABLE IF NOT EXISTS geocode_cache (
  chiave TEXT PRIMARY KEY,
  valore_json TEXT NOT NULL
);
`);

/**
 * Cache di geocoding su SQLite. Memorizza anche i fallimenti (valore_json = "null"):
 * un indirizzo che non si risolve non va ritentato a ogni ciclo (vedi geocode.ts in @qdr/core).
 */
export function cacheGeocodingSqlite(): CacheGeocoding {
  const leggi = db.prepare("SELECT valore_json FROM geocode_cache WHERE chiave = ?");
  const scrivi = db.prepare(
    "INSERT INTO geocode_cache (chiave, valore_json) VALUES (?, ?) ON CONFLICT(chiave) DO UPDATE SET valore_json = excluded.valore_json",
  );

  return {
    async leggi(chiave: string): Promise<RisultatoGeocoding | null | undefined> {
      const row = leggi.get(chiave) as { valore_json: string } | undefined;
      if (!row) return undefined;
      return JSON.parse(row.valore_json) as RisultatoGeocoding | null;
    },
    async scrivi(chiave: string, valore: RisultatoGeocoding | null): Promise<void> {
      scrivi.run(chiave, JSON.stringify(valore));
    },
  };
}
