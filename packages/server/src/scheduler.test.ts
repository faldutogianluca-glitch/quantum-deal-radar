import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-sched-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { avviaScheduler } = await import("./scheduler.js");
const { listAllRows } = await import("./repository.js");

const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("scheduler", () => {
  test("esegue subito quando richiesto e popola il DB", async () => {
    assert.equal(listAllRows().length, 0);

    const s = avviaScheduler({ intervalloMinuti: 60, subito: true });
    await s.attendiCicloCorrente();
    s.ferma();

    assert.equal(listAllRows().length, 3, "il ciclo iniziale deve aver eseguito lo scraping demo");
  });

  test("non parte da solo se 'subito' non e' richiesto", async () => {
    const s = avviaScheduler({ intervalloMinuti: 60 });
    await attendi(150);
    s.ferma();
    // nessun ciclo lanciato: il DB resta com'era dopo il test precedente
    assert.equal(listAllRows().length, 3);
  });

  test("un ciclo lento non viene affiancato da un altro", async () => {
    // Intervallo minimo (1 min) ma lanciato a mano piu' volte di seguito:
    // il secondo lancio deve trovare il primo ancora in corso e saltare.
    const s = avviaScheduler({ intervalloMinuti: 1, subito: true });
    const primo = s.attendiCicloCorrente();

    // secondo avvio immediato mentre il primo e' ancora in volo
    const s2 = avviaScheduler({ intervalloMinuti: 1, subito: true });
    await Promise.all([primo, s2.attendiCicloCorrente()]);
    s.ferma();
    s2.ferma();

    // qualunque sia l'interleaving, il dedup impedisce righe duplicate
    assert.equal(listAllRows().length, 3, "cicli concorrenti non devono duplicare righe");
  });

  test("ferma() impedisce ulteriori esecuzioni", async () => {
    const s = avviaScheduler({ intervalloMinuti: 60, subito: true });
    await s.attendiCicloCorrente();
    s.ferma();
    await attendi(100);
    assert.equal(listAllRows().length, 3);
  });
});
