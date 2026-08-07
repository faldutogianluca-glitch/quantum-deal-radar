import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-geocache-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { cacheGeocodingSqlite } = await import("./geocodeCache.js");

const RISULTATO = {
  lat: 45.47, lon: 9.19, precisione: "civico" as const,
  etichetta: "Viale Monza 12, Milano", fonte: "nominatim",
};

describe("cache di geocoding su SQLite", () => {
  test("chiave mai vista -> undefined", () => {
    // undefined e null non sono intercambiabili qui: conCache() distingue
    // "mai interrogato" da "interrogato, nessun risultato".
    const c = cacheGeocodingSqlite();
    return c.leggi("MAI VISTA").then((v) => assert.equal(v, undefined));
  });

  test("scrittura e rilettura conservano il risultato", async () => {
    const c = cacheGeocodingSqlite();
    await c.scrivi("VIALE MONZA 12, MILANO", RISULTATO);
    assert.deepEqual(await c.leggi("VIALE MONZA 12, MILANO"), RISULTATO);
  });

  test("anche i fallimenti si memorizzano come null", async () => {
    // Un indirizzo che non si risolve non va ritentato a ogni ciclo.
    const c = cacheGeocodingSqlite();
    await c.scrivi("INDIRIZZO INESISTENTE", null);

    const letto = await c.leggi("INDIRIZZO INESISTENTE");
    assert.equal(letto, null);
    assert.notEqual(letto, undefined, "null memorizzato != chiave assente");
  });

  test("riscrivere la stessa chiave aggiorna invece di fallire", async () => {
    const c = cacheGeocodingSqlite();
    await c.scrivi("VIA TAL 1", null);
    await c.scrivi("VIA TAL 1", RISULTATO);
    assert.deepEqual(await c.leggi("VIA TAL 1"), RISULTATO);
  });

  test("istanze diverse condividono lo stesso archivio", async () => {
    await cacheGeocodingSqlite().scrivi("CONDIVISA", RISULTATO);
    assert.deepEqual(await cacheGeocodingSqlite().leggi("CONDIVISA"), RISULTATO);
  });
});
