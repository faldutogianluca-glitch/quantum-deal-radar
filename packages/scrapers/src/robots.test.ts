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
