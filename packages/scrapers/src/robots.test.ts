import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";

import { ispezionaRobots } from "./robots.js";

const ROBOTS = `# gruppo che non ci riguarda
User-agent: BadBot
Disallow: /

User-agent: *
Crawl-delay: 10
Disallow: /privata/
Disallow: /ricerca
Allow: /ricerca/pubblica
`;

let server: Server;
let base = "";

before(async () => {
  server = createServer((req, res) => {
    if (req.url === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(ROBOTS);
    } else if (req.url === "/senza-robots/robots.txt") {
      res.writeHead(404);
      res.end();
    } else {
      res.writeHead(200);
      res.end("ok");
    }
  });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(() => new Promise<void>((r) => server.close(() => r())));

describe("interpretazione della risposta a robots.txt", () => {
  /** Un server per caso: robots.txt si legge dalla radice, quindi servono origini distinte. */
  async function conStato(stato: number, corpo = ""): Promise<{ esito: string; consentito: boolean }> {
    const s = createServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(stato, { "Content-Type": "text/plain" });
        res.end(corpo);
      } else {
        res.writeHead(200);
        res.end("ok");
      }
    });
    await new Promise<void>((r) => s.listen(0, r));
    const porta = (s.address() as { port: number }).port;
    try {
      const e = await ispezionaRobots(`http://127.0.0.1:${porta}/pagina`);
      return { esito: e.esito, consentito: e.consentito };
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
    }
  }

  test("404: il sito non pubblica regole, risposta definitiva", async () => {
    const e = await conStato(404);
    assert.equal(e.esito, "assente");
    assert.equal(e.consentito, true, "senza direttive robots.txt non pone limiti");
  });

  test("403: accesso negato al file, caso ambiguo", async () => {
    assert.equal((await conStato(403)).esito, "accesso_negato");
  });

  test("5xx: lo standard prescrive di astenersi", async () => {
    const e = await conStato(503);
    assert.equal(e.esito, "errore_server");
    assert.equal(e.consentito, false, "un server in errore non va caricato ulteriormente");
  });

  test("200: le regole vengono lette", async () => {
    assert.equal((await conStato(200, "User-agent: *\nDisallow: /x\n")).esito, "regole_lette");
  });
});

describe("ispezionaRobots", () => {
  test("riporta il testo grezzo e il crawl-delay", async () => {
    const e = await ispezionaRobots(`${base}/qualsiasi`);
    assert.equal(e.stato, 200);
    assert.match(e.testo ?? "", /Crawl-delay: 10/);
    assert.equal(e.crawlDelay, 10);
  });

  test("un percorso sotto Disallow risulta vietato", async () => {
    assert.equal((await ispezionaRobots(`${base}/ricerca`)).consentito, false);
    assert.equal((await ispezionaRobots(`${base}/privata/x`)).consentito, false);
  });

  test("una Allow piu' specifica riammette il percorso", async () => {
    // la regola vuole che vinca la direttiva col prefisso piu' lungo
    assert.equal((await ispezionaRobots(`${base}/ricerca/pubblica`)).consentito, true);
  });

  test("un percorso non menzionato e' consentito", async () => {
    assert.equal((await ispezionaRobots(`${base}/altro`)).consentito, true);
  });

  test("le regole di un altro User-agent non ci si applicano", async () => {
    // BadBot ha "Disallow: /", ma non siamo noi
    const e = await ispezionaRobots(`${base}/altro`);
    assert.ok(!e.regoleApplicate.disallow.includes("/"));
  });
});
