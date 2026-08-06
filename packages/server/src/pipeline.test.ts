import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Il DB va isolato dal QDR_DB_PATH di sviluppo *prima* di importare qualunque
// modulo che tocchi db.ts: da qui l'import dinamico invece di uno statico
// (che verrebbe issato prima di questa riga).
const dir = mkdtempSync(join(tmpdir(), "qdr-test-"));
process.env.QDR_DB_PATH = join(dir, "test.db");

const { eseguiPipeline } = await import("./pipeline.js");
const { listImmobili } = await import("./repository.js");

describe("pipeline end-to-end (adapter demo, nessuna rete)", () => {
  test("scrape -> dedup -> persist popola il DB", async () => {
    const esito = await eseguiPipeline("demo");
    assert.equal(esito.nuovi, 3);
    assert.equal(esito.aggiornati, 0);

    const righe = listImmobili({ fonte: "demo" });
    assert.equal(righe.length, 3);
    assert.ok(righe.every((r) => r.first_seen_at === r.scraped_at));
  });

  test("una seconda esecuzione aggiorna senza duplicare ne' raddoppiare il conteggio", async () => {
    const esito = await eseguiPipeline("demo");
    assert.equal(esito.nuovi, 0);
    assert.equal(esito.aggiornati, 3);

    const righe = listImmobili({ fonte: "demo" });
    assert.equal(righe.length, 3);
  });

  test("i filtri per prezzo funzionano", async () => {
    const righe = listImmobili({ prezzoMin: 100000 });
    assert.ok(righe.every((r) => (r.prezzo ?? 0) >= 100000));
    assert.ok(righe.length > 0 && righe.length < 3);
  });
});
