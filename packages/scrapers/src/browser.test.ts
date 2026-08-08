import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GenericScraper } from "./genericScraper.js";
import type { SiteConfig } from "./types.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** Chromium e' opzionale: dove non c'e', i test del motore browser vengono saltati
 *  invece di far fallire l'intera suite. */
async function chromiumDisponibile(): Promise<boolean> {
  try {
    const { chromium } = await import("playwright");
    const exe = process.env.QDR_CHROMIUM_PATH;
    const b = await chromium.launch(exe ? { executablePath: exe } : {});
    await b.close();
    return true;
  } catch {
    return false;
  }
}

let server: Server;
let base = "";

before(async () => {
  const html = await readFile(join(FIXTURES, "sito_js", "index.html"), "utf-8");
  server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(() => new Promise<void>((r) => server.close(() => r())));

function config(fetchMode: SiteConfig["fetchMode"]): SiteConfig {
  return {
    name: `js-${fetchMode}`,
    displayName: "Portale finto con rendering JS",
    enabled: false,
    priorita: 90,
    fetchMode,
    baseUrl: base,
    searchUrl: base,
    listSelector: ".card",
    fields: {
      titolo: ".titolo",
      url: ".link::attr(href)",
      prezzoRaw: ".prezzo",
      comune: ".comune",
      dataAstaRaw: ".data",
    },
    pagination: { maxPages: 1 },
    browser: { attendiSelettore: ".card", timeoutMs: 15_000 },
    // server di test avviato da noi: la conformita' non e' in discussione
    compliance: { stato: "consentito", note: "fixture locale del test" },
    rateLimitSeconds: 0,
  };
}

describe("cattura di contenuti che arrivano tardi", () => {
  test("attende che il DOM si stabilizzi, non un tempo fisso", async (t) => {
    if (!(await chromiumDisponibile())) {
      t.skip("Chromium non disponibile in questo ambiente");
      return;
    }
    const { catturaPagina, proponiSelettori } = await import("./cattura.js");

    // pagina che popola la lista dopo 2,5 secondi, senza traffico di rete:
    // ne' un'attesa breve ne' networkidle basterebbero
    const html = `<!DOCTYPE html><html><body><div id="lista"></div><script>
      setTimeout(() => { document.getElementById("lista").innerHTML =
        Array.from({length: 6}, (_, i) =>
          '<article class="scheda-tardiva"><a href="/x/' + i +
          '"><h3>Immobile numero ' + i + ' con titolo lungo</h3></a></article>').join("");
      }, 2500);
    </script></body></html>`;

    const s = createServer((req, res) => {
      if (req.url === "/robots.txt") { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    await new Promise<void>((r) => s.listen(0, r));
    const porta = (s.address() as { port: number }).port;

    try {
      const esito = await catturaPagina(`http://127.0.0.1:${porta}/ricerca`, { modo: "browser" });
      const candidati = proponiSelettori(esito.html).map((c) => c.selettore);
      assert.ok(
        candidati.includes(".scheda-tardiva"),
        `i risultati tardivi devono essere nella cattura, trovati: ${candidati.join(", ") || "nessuno"}`,
      );
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
    }
  });
});

describe("cattura di schede caricate scorrendo", () => {
  test("scorre la pagina per far comparire le schede pigre", async (t) => {
    if (!(await chromiumDisponibile())) {
      t.skip("Chromium non disponibile in questo ambiente");
      return;
    }
    const { catturaPagina, proponiSelettori } = await import("./cattura.js");

    // infinite scroll: quattro schede per volta, come sui portali di annunci
    const html = `<!DOCTYPE html><html><body>
      <div style="height:1200px">intestazione alta</div><div id="lista"></div><script>
      let caricate = 0;
      function carica() {
        if (caricate >= 12) return;
        document.getElementById("lista").insertAdjacentHTML("beforeend",
          Array.from({length: 4}, (_, i) =>
            '<article class="scheda-pigra"><a href="/imm/' + (caricate + i) +
            '"><h3>Immobile pigro numero ' + (caricate + i) + '</h3></a></article>').join(""));
        caricate += 4;
      }
      window.addEventListener("scroll", () => {
        if (window.scrollY + window.innerHeight > document.body.scrollHeight - 400) carica();
      });
    </script></body></html>`;

    const s = createServer((req, res) => {
      if (req.url === "/robots.txt") { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    await new Promise<void>((r) => s.listen(0, r));
    const porta = (s.address() as { port: number }).port;

    try {
      const esito = await catturaPagina(`http://127.0.0.1:${porta}/ricerca`, { modo: "browser" });
      const scheda = proponiSelettori(esito.html).find((c) => c.selettore === ".scheda-pigra");
      assert.ok(scheda, "senza scorrere la pagina le schede non comparirebbero affatto");
      assert.ok(scheda!.occorrenze >= 8, `attese almeno 8 schede, trovate ${scheda?.occorrenze}`);
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
    }
  });
});

describe("fetchMode browser", () => {
  test("il fetch statico non vede i risultati resi da JavaScript", async () => {
    const r = await new GenericScraper(config("static")).scrape();
    assert.deepEqual(r.errors, []);
    assert.equal(r.items.length, 0, "l'HTML servito non contiene ancora le schede");
  });

  test("il motore browser li vede", async (t) => {
    if (!(await chromiumDisponibile())) {
      t.skip("Chromium non disponibile in questo ambiente");
      return;
    }
    const r = await new GenericScraper(config("browser")).scrape();
    assert.deepEqual(r.errors, []);
    assert.equal(r.items.length, 2);

    const primo = r.items[0]!;
    assert.equal(primo.titolo, "Lotto reso via JS");
    assert.equal(primo.prezzo, 123000);
    assert.equal(primo.comune, "Pavia");
    assert.equal(primo.dataAsta, "2027-03-05");
    assert.match(primo.url ?? "", /\/lotto\/10$/);

    // la seconda scheda usa una data in lettere: verifica che il parsing regga entrambi i formati
    assert.equal(r.items[1]!.dataAsta, "2027-04-18");
  });
});

describe("banner di consenso ai cookie", () => {
  test("chiude il banner rifiutando i facoltativi, e allora le schede compaiono", async (t) => {
    if (!(await chromiumDisponibile())) {
      t.skip("Chromium non disponibile in questo ambiente");
      return;
    }
    const { catturaPagina, proponiSelettori } = await import("./cattura.js");

    // Ricalca Cookiebot: finche' il dialogo e' aperto la lista non viene montata,
    // quindi la cattura vedrebbe solo intestazione, footer e il dialogo stesso.
    const html = `<!DOCTYPE html><html><body>
      <div id="CybotCookiebotDialog">
        <div class="tab-navigation"><span class="tab-item">Necessario (33)</span></div>
        <button id="CybotCookiebotDialogBodyButtonAccept">Accetta tutti</button>
        <button id="CybotCookiebotDialogBodyButtonDecline">Rifiuta</button>
      </div>
      <div id="lista"></div><script>
      document.getElementById("CybotCookiebotDialogBodyButtonDecline").addEventListener("click", () => {
        document.getElementById("CybotCookiebotDialog").remove();
        document.getElementById("lista").innerHTML = Array.from({length: 9}, (_, i) =>
          '<article class="scheda-annuncio"><a href="/imm/' + i +
          '"><h3>Appartamento in vendita, lotto ' + i + '</h3></a></article>').join("");
      });
      document.getElementById("CybotCookiebotDialogBodyButtonAccept").addEventListener("click", () => {
        document.getElementById("lista").innerHTML = "<p>consenso pubblicitario concesso</p>";
      });
    </script></body></html>`;

    const s = createServer((req, res) => {
      if (req.url === "/robots.txt") { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    await new Promise<void>((r) => s.listen(0, r));
    const porta = (s.address() as { port: number }).port;

    try {
      const esito = await catturaPagina(`http://127.0.0.1:${porta}/ricerca`, { modo: "browser" });
      assert.equal(esito.consenso.tipo, "rifiutato");

      const nomi = proponiSelettori(esito.html).map((c) => c.selettore);
      assert.ok(
        nomi.includes(".scheda-annuncio"),
        `col banner aperto le schede non esistono nemmeno, trovati: ${nomi.join(", ") || "nessuno"}`,
      );
      // il pulsante "accetta tutti" non deve essere stato toccato: acconsentire
      // alla profilazione per conto di qualcun altro non e' una scelta da
      // automatizzare. Si guarda il DOM reso, non l'HTML grezzo: quella frase
      // compare anche nel sorgente dello script, dove non prova nulla.
      const cheerio = await import("cheerio");
      const reso = cheerio.load(esito.html)("#lista").text();
      assert.ok(
        !reso.includes("consenso pubblicitario concesso"),
        "ha accettato tutti i cookie invece di rifiutare i facoltativi",
      );
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
    }
  });

  test("un banner senza via d'uscita viene segnalato, non forzato", async (t) => {
    if (!(await chromiumDisponibile())) {
      t.skip("Chromium non disponibile in questo ambiente");
      return;
    }
    const { catturaPagina } = await import("./cattura.js");

    // solo "accetta tutto": non c'e' modo di rifiutare i cookie facoltativi
    const html = `<!DOCTYPE html><html><body>
      <div id="CybotCookiebotDialog"><button id="soloAccetta">Accetta tutti</button></div>
      </body></html>`;

    const s = createServer((req, res) => {
      if (req.url === "/robots.txt") { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    await new Promise<void>((r) => s.listen(0, r));
    const porta = (s.address() as { port: number }).port;

    try {
      const esito = await catturaPagina(`http://127.0.0.1:${porta}/ricerca`, { modo: "browser" });
      assert.equal(esito.consenso.tipo, "irrisolto", "va detto, non risolto di nascosto accettando tutto");
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
    }
  });
});
