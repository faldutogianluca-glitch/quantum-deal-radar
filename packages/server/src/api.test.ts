import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-api-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { creaApp } = await import("./index.js");
const { eseguiPipeline, FonteSconosciuta } = await import("./pipeline.js");
const { salvaImmobiliDeduplicati, listAllRows } = await import("./repository.js");

/** Avvia l'app su una porta effimera e ritorna base URL + funzione di chiusura. */
async function avvia(): Promise<{ base: string; chiudi: () => Promise<void> }> {
  const server = creaApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  const porta = (server.address() as { port: number }).port;
  return {
    base: `http://127.0.0.1:${porta}`,
    chiudi: () => new Promise((r) => server.close(() => r(undefined))),
  };
}

describe("API: parametri di query malformati", () => {
  test("un limit non numerico non fa fallire la query", async () => {
    const { base, chiudi } = await avvia();
    try {
      const resp = await fetch(`${base}/api/immobili?limit=abc`);
      assert.equal(resp.status, 200, "un parametro non valido non deve produrre un 500");
      assert.ok(Array.isArray(await resp.json()));
    } finally {
      await chiudi();
    }
  });

  test("un limit negativo non restituisce l'intera tabella", async () => {
    await eseguiPipeline("demo");
    const { base, chiudi } = await avvia();
    try {
      const righe = (await (await fetch(`${base}/api/immobili?limit=-1`)).json()) as unknown[];
      assert.equal(righe.length, 1, "LIMIT negativo in SQLite significa 'nessun limite'");
    } finally {
      await chiudi();
    }
  });

  test("prezzoMin non numerico viene ignorato invece di azzerare i risultati", async () => {
    const { base, chiudi } = await avvia();
    try {
      const righe = (await (await fetch(`${base}/api/immobili?prezzoMin=abc`)).json()) as unknown[];
      assert.ok(righe.length > 0, "un filtro illeggibile non deve comportarsi da filtro impossibile");
    } finally {
      await chiudi();
    }
  });

  test("una fonte inesistente e' un errore del chiamante (400), non del server", async () => {
    const { base, chiudi } = await avvia();
    try {
      const resp = await fetch(`${base}/api/scrape?fonte=non-esiste`, { method: "POST" });
      assert.equal(resp.status, 400);
      assert.match(((await resp.json()) as { errore: string }).errore, /inesistente/);
    } finally {
      await chiudi();
    }
  });
});

describe("pipeline: fonte inesistente", () => {
  test("solleva invece di terminare silenziosamente con zero risultati", async () => {
    await assert.rejects(() => eseguiPipeline("fonte-che-non-esiste"), FonteSconosciuta);
  });
});

describe("storage: deriva della chiave di dedup", () => {
  test("una correzione di mq aggiorna la riga invece di duplicarla", () => {
    const partenza = listAllRows().length;
    const base = {
      fonte: "pvp", idEsterno: "annuncio-42", titolo: "Trilocale",
      comune: "Milano", indirizzoRaw: "Via Bergamo 7", locali: 3,
    };
    salvaImmobiliDeduplicati([{ ...base, mq: 80 }]);
    // il portale corregge la metratura: mqBucket passa da 80 a 100 e la chiave cambia
    salvaImmobiliDeduplicati([{ ...base, mq: 95 }]);

    const righe = listAllRows().filter((r) => r.id_esterno === "annuncio-42");
    assert.equal(righe.length, 1, "lo stesso annuncio non deve produrre due righe");
    assert.equal(righe[0]!.mq, 95, "la riga deve riportare il valore corretto");
    assert.equal(listAllRows().length, partenza + 1);
  });
});
