import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DATA_DIR e DB vanno isolati *prima* di importare i moduli che li leggono.
const dir = mkdtempSync(join(tmpdir(), "qdr-endpoints-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { creaApp, avviaServer } = await import("./index.js");
const { eseguiPipeline } = await import("./pipeline.js");
const { listAllRows } = await import("./repository.js");

const app = creaApp();
let base = "";
let chiudi: () => Promise<void>;

before(async () => {
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  chiudi = () => new Promise((r) => server.close(() => r(undefined)));
  await eseguiPipeline("demo");
});

// Senza questo il server resta in ascolto e il processo di test non termina mai.
after(() => chiudi());

describe("GET /api/immobili/:id", () => {
  test("un id esistente restituisce la riga", async () => {
    const atteso = listAllRows()[0]!;
    const resp = await fetch(`${base}/api/immobili/${atteso.id}`);

    assert.equal(resp.status, 200);
    const riga = (await resp.json()) as { id: number; fonte: string };
    assert.equal(riga.id, atteso.id);
    assert.equal(riga.fonte, "demo");
  });

  test("un id non numerico e' un 400, non un 500", async () => {
    const resp = await fetch(`${base}/api/immobili/abc`);
    assert.equal(resp.status, 400);
    assert.match(((await resp.json()) as { errore: string }).errore, /non valido/);
  });

  test("un id decimale e' un 400", async () => {
    const resp = await fetch(`${base}/api/immobili/1.5`);
    assert.equal(resp.status, 400);
  });

  test("un id inesistente e' un 404", async () => {
    const resp = await fetch(`${base}/api/immobili/999999`);
    assert.equal(resp.status, 404);
    assert.match(((await resp.json()) as { errore: string }).errore, /non trovato/);
  });
});

describe("GET /api/fonti", () => {
  test("elenca tutte le fonti configurate, anche quelle disattivate", async () => {
    const resp = await fetch(`${base}/api/fonti`);
    assert.equal(resp.status, 200);

    const fonti = (await resp.json()) as { name: string; displayName: string; enabled: boolean }[];
    const demo = fonti.find((f) => f.name === "demo")!;
    assert.equal(demo.enabled, true);
    assert.ok(demo.displayName, "displayName serve alla dashboard");
    assert.ok(fonti.some((f) => !f.enabled), "le fonti disattivate restano visibili in elenco");
  });
});

describe("POST /api/scrape", () => {
  test("una fonte valida esegue la pipeline", async () => {
    const resp = await fetch(`${base}/api/scrape?fonte=demo`, { method: "POST" });
    assert.equal(resp.status, 200);

    const esito = (await resp.json()) as { perFonte: { fonte: string; trovati: number }[] };
    assert.deepEqual(esito.perFonte.map((f) => f.fonte), ["demo"]);
    assert.equal(esito.perFonte[0]!.trovati, 3);
  });

  test("senza parametro gira su tutte le fonti attive", async () => {
    const resp = await fetch(`${base}/api/scrape`, { method: "POST" });
    assert.equal(resp.status, 200);
    const esito = (await resp.json()) as { perFonte: unknown[] };
    assert.ok(esito.perFonte.length >= 1);
  });
});

describe("POST /api/enrich", () => {
  test("senza i dati OMI risponde 200 spiegando perche' non ha fatto nulla", async () => {
    // Il degrado e' previsto: scraping e dashboard restano usabili senza i file OMI.
    const resp = await fetch(`${base}/api/enrich`, { method: "POST" });
    assert.equal(resp.status, 200);

    const esito = (await resp.json()) as { eseguito: boolean; motivo?: string };
    assert.equal(esito.eseguito, false);
    assert.match(esito.motivo ?? "", /zone_omi\.geojson/);
  });
});

describe("gestore di errore", () => {
  test("un corpo JSON malformato non rimanda lo stack al client", async () => {
    // Il gestore di default di Express serializza lo stack trace completo, che
    // espone percorsi e struttura interna: qui deve restare nei log del server.
    const resp = await fetch(`${base}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ questo non e' json",
    });

    assert.equal(resp.status, 500);
    const corpo = (await resp.json()) as Record<string, unknown>;
    assert.deepEqual(corpo, { errore: "Errore interno del server" });
    assert.ok(!("stack" in corpo), "nessuno stack trace nella risposta");
  });
});

describe("dashboard statica", () => {
  test("la root serve index.html", async () => {
    const resp = await fetch(`${base}/`);
    assert.equal(resp.status, 200);
    assert.match(resp.headers.get("content-type") ?? "", /text\/html/);
  });
});

describe("avviaServer", () => {
  test("mette in ascolto un'app funzionante (e' il punto d'ingresso della CLI)", async () => {
    const server = avviaServer(0);
    try {
      await new Promise((r) => server.once("listening", r));
      const porta = (server.address() as { port: number }).port;
      const resp = await fetch(`http://127.0.0.1:${porta}/api/fonti`);
      assert.equal(resp.status, 200);
    } finally {
      await new Promise((r) => server.close(() => r(undefined)));
    }
  });
});
