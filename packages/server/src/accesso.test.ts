/**
 * Controllo di accesso (rilievo 3 della revisione del 24/10/2026).
 * Server avviato su porta effimera, database isolato, token SINTETICO.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";

const dir = mkdtempSync(join(tmpdir(), "qdr-accesso-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");
// isolamento dalla rete: solo la fonte demo
import { copyFileSync, mkdirSync } from "node:fs";
const siti = join(dir, "sites");
mkdirSync(siti);
copyFileSync(new URL("../../scrapers/sites/demo.json", import.meta.url), join(siti, "demo.json"));
process.env.QDR_SITES_DIR = siti;

const { creaApp } = await import("./index.js");
const { leggiConfigAccesso, ErroreConfigurazione, eLoopback, LimiteFallimenti, tokenDaIntestazione } = await import("./accesso.js");
const { esclusivo, LavoroInCorso } = await import("./lavoro.js");

const TOKEN = "token-di-prova-solo-per-i-test-0123456789";
const conToken = { ...leggiConfigAccesso({ QDR_TOKEN: TOKEN } as never), cooldownOperazioniSecondi: 0, maxFallimenti: 5 };

async function avvia(config = conToken): Promise<{ porta: number; chiudi: () => Promise<void> }> {
  const server = creaApp(config).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  return { porta: (server.address() as { port: number }).port, chiudi: () => new Promise((r) => server.close(() => r(undefined))) };
}

/** Richiesta con intestazioni arbitrarie, Host compreso (fetch non permette di cambiarlo). */
function chiedi(porta: number, percorso: string, opzioni: { metodo?: string; intestazioni?: Record<string, string> } = {}): Promise<{ stato: number; corpo: string; intestazioni: http.IncomingHttpHeaders }> {
  return new Promise((risolvi, rifiuta) => {
    const req = http.request({ host: "127.0.0.1", port: porta, path: percorso, method: opzioni.metodo ?? "GET", headers: opzioni.intestazioni }, (res) => {
      let corpo = "";
      res.on("data", (c) => (corpo += c));
      res.on("end", () => risolvi({ stato: res.statusCode ?? 0, corpo, intestazioni: res.headers }));
    });
    req.on("error", rifiuta);
    req.end();
  });
}
const basic = (t: string) => "Basic " + Buffer.from(`radar:${t}`).toString("base64");

describe("configurazione dell'ascolto", () => {
  test("predefinito: solo loopback, nessun token richiesto", () => {
    const c = leggiConfigAccesso({} as never);
    assert.equal(c.host, "127.0.0.1");
    assert.equal(c.remoto, false);
    assert.equal(c.token, null);
  });

  test("ascolto remoto senza token: il server non parte", () => {
    for (const host of ["0.0.0.0", "192.168.1.20", "::"]) {
      assert.throws(() => leggiConfigAccesso({ QDR_HOST: host } as never), ErroreConfigurazione, host);
    }
  });

  test("token troppo corto rifiutato anche in locale", () => {
    assert.throws(() => leggiConfigAccesso({ QDR_TOKEN: "corto" } as never), /almeno 24/);
  });

  test("token lungo ma prevedibile rifiutato", () => {
    for (const t of ["a".repeat(40), "12341234".repeat(5), "ab".repeat(20)]) {
      assert.throws(() => leggiConfigAccesso({ QDR_TOKEN: t } as never), /prevedibile/, t);
    }
  });

  test("limite tentativi a zero o negativo non e' ammesso (non deve disattivarlo ne' bloccare per sempre)", () => {
    for (const v of ["0", "-3"]) {
      assert.throws(() => leggiConfigAccesso({ QDR_MAX_FALLIMENTI: v } as never), ErroreConfigurazione, v);
      assert.throws(() => leggiConfigAccesso({ QDR_FINESTRA_FALLIMENTI_SECONDI: v } as never), ErroreConfigurazione, v);
    }
  });

  test("il registro dei tentativi non cresce oltre il tetto", () => {
    const limite = new LimiteFallimenti(3, 60_000);
    for (let i = 0; i < LimiteFallimenti.MAX_CHIAVI + 500; i++) limite.registra(`ip-${i}`);
    assert.ok((limite as unknown as { tentativi: Map<string, number[]> }).tentativi.size <= LimiteFallimenti.MAX_CHIAVI);
    // gli indirizzi piu' recenti sono ancora tracciati
    limite.registra(`ip-${LimiteFallimenti.MAX_CHIAVI + 499}`);
    limite.registra(`ip-${LimiteFallimenti.MAX_CHIAVI + 499}`);
    assert.ok(limite.bloccato(`ip-${LimiteFallimenti.MAX_CHIAVI + 499}`) > 0);
  });

  test("ascolto remoto con token valido: ammesso", () => {
    const c = leggiConfigAccesso({ QDR_HOST: "0.0.0.0", QDR_TOKEN: TOKEN } as never);
    assert.equal(c.remoto, true);
  });

  test("eLoopback riconosce gli indirizzi locali e rifiuta gli altri", () => {
    for (const h of ["127.0.0.1", "127.1.2.3", "localhost", "::1", "[::1]"]) assert.equal(eLoopback(h), true, h);
    for (const h of ["0.0.0.0", "10.0.0.1", "example.com", "::"]) assert.equal(eLoopback(h), false, h);
  });
});

describe("autenticazione", () => {
  test("senza credenziali: 401 con richiesta di accesso, sia per l'API sia per la dashboard", async () => {
    const { porta, chiudi } = await avvia();
    try {
      for (const p of ["/api/immobili", "/", "/app.js"]) {
        const r = await chiedi(porta, p);
        assert.equal(r.stato, 401, p);
        assert.match(String(r.intestazioni["www-authenticate"]), /Basic/);
      }
    } finally { await chiudi(); }
  });

  test("credenziali errate: 401", async () => {
    const { porta, chiudi } = await avvia();
    try {
      for (const h of ["Bearer sbagliato", basic("sbagliato"), "Bearer ", "Basic !!!", "Token " + TOKEN]) {
        const r = await chiedi(porta, "/api/immobili", { intestazioni: { Authorization: h } });
        assert.equal(r.stato, 401, h);
      }
    } finally { await chiudi(); }
  });

  test("il token nell'URL non vale", async () => {
    const { porta, chiudi } = await avvia();
    try {
      const r = await chiedi(porta, `/api/immobili?token=${TOKEN}&access_token=${TOKEN}`);
      assert.equal(r.stato, 401);
    } finally { await chiudi(); }
  });

  test("credenziali corrette (Bearer per gli script, Basic per il browser): accesso e dashboard funzionante", async () => {
    const { porta, chiudi } = await avvia();
    try {
      const api = await chiedi(porta, "/api/immobili", { intestazioni: { Authorization: `Bearer ${TOKEN}` } });
      assert.equal(api.stato, 200);
      const pagina = await chiedi(porta, "/", { intestazioni: { Authorization: basic(TOKEN) } });
      assert.equal(pagina.stato, 200);
      assert.match(pagina.corpo, /Quantum Deal Radar|<title>/i);
      const js = await chiedi(porta, "/app.js", { intestazioni: { Authorization: basic(TOKEN) } });
      assert.equal(js.stato, 200);
      assert.ok(!js.corpo.includes(TOKEN), "il token non compare nel JavaScript pubblico");
    } finally { await chiudi(); }
  });

  test("dopo troppi tentativi falliti l'indirizzo viene rallentato, anche con il token giusto", async () => {
    const { porta, chiudi } = await avvia({ ...conToken, maxFallimenti: 3, finestraFallimentiSecondi: 60 });
    try {
      for (let i = 0; i < 3; i++) assert.equal((await chiedi(porta, "/api/immobili", { intestazioni: { Authorization: "Bearer no" } })).stato, 401);
      const bloccato = await chiedi(porta, "/api/immobili", { intestazioni: { Authorization: `Bearer ${TOKEN}` } });
      assert.equal(bloccato.stato, 429);
      assert.ok(Number(bloccato.intestazioni["retry-after"]) > 0);
    } finally { await chiudi(); }
  });

  test("richieste anonime (browser, scanner) non bloccano il proprietario con il token giusto", async () => {
    const { porta, chiudi } = await avvia({ ...conToken, maxFallimenti: 3, finestraFallimentiSecondi: 60 });
    try {
      for (let i = 0; i < 10; i++) assert.equal((await chiedi(porta, "/api/immobili")).stato, 401);
      assert.equal((await chiedi(porta, "/api/immobili", { intestazioni: { Authorization: `Bearer ${TOKEN}` } })).stato, 200);
    } finally { await chiudi(); }
  });

  test("intestazioni di sicurezza presenti e nessun 'x-powered-by'", async () => {
    const { porta, chiudi } = await avvia();
    try {
      const r = await chiedi(porta, "/", { intestazioni: { Authorization: basic(TOKEN) } });
      assert.equal(r.intestazioni["x-content-type-options"], "nosniff");
      assert.equal(r.intestazioni["x-frame-options"], "DENY");
      assert.match(String(r.intestazioni["content-security-policy"]), /default-src 'self'/);
      assert.equal(r.intestazioni["x-powered-by"], undefined);
    } finally { await chiudi(); }
  });

  test("unit: token da Bearer e da Basic, confronto limitato nel tempo", () => {
    assert.equal(tokenDaIntestazione("Bearer abc"), "abc");
    assert.equal(tokenDaIntestazione(basic("xyz")), "xyz");
    assert.equal(tokenDaIntestazione(undefined), null);
    let t = 0;
    const l = new LimiteFallimenti(2, 1000, () => t);
    l.registra("a"); l.registra("a");
    assert.ok(l.bloccato("a") > 0);
    t = 2000;
    assert.equal(l.bloccato("a"), 0, "la finestra scade");
  });
});

describe("accesso locale senza token: richieste estranee respinte", () => {
  const locale = { ...leggiConfigAccesso({} as never), cooldownOperazioniSecondi: 0 };

  test("Host non locale (DNS rebinding): 421", async () => {
    const { porta, chiudi } = await avvia(locale);
    try {
      const r = await chiedi(porta, "/api/immobili", { intestazioni: { Host: `sito-ostile.example:${porta}` } });
      assert.equal(r.stato, 421);
    } finally { await chiudi(); }
  });

  test("POST da un'altra origine (cross-site): 403, e non avvia nulla", async () => {
    const { porta, chiudi } = await avvia(locale);
    try {
      const r = await chiedi(porta, "/api/scrape?fonte=demo", { metodo: "POST", intestazioni: { Origin: "https://sito-ostile.example" } });
      assert.equal(r.stato, 403);
      const nulla = await chiedi(porta, "/api/scrape?fonte=demo", { metodo: "POST", intestazioni: { Origin: "null" } });
      assert.equal(nulla.stato, 403);
    } finally { await chiudi(); }
  });

  test("la stessa origine locale e le chiamate da script (senza Origin) passano", async () => {
    const { porta, chiudi } = await avvia(locale);
    try {
      const a = await chiedi(porta, "/api/immobili", { intestazioni: { Origin: `http://127.0.0.1:${porta}` } });
      assert.equal(a.stato, 200);
      const b = await chiedi(porta, "/api/immobili");
      assert.equal(b.stato, 200);
    } finally { await chiudi(); }
  });
});

describe("operazioni costose: limiti e concorrenza", () => {
  test("cooldown: il secondo avvio ravvicinato e' respinto con 429 e Retry-After", async () => {
    const { porta, chiudi } = await avvia({ ...conToken, cooldownOperazioniSecondi: 60 });
    const h = { Authorization: `Bearer ${TOKEN}` };
    try {
      const primo = await chiedi(porta, "/api/scrape?fonte=demo", { metodo: "POST", intestazioni: h });
      assert.equal(primo.stato, 200, primo.corpo);
      const secondo = await chiedi(porta, "/api/scrape?fonte=demo", { metodo: "POST", intestazioni: h });
      assert.equal(secondo.stato, 429);
      assert.ok(Number(secondo.intestazioni["retry-after"]) > 0);
    } finally { await chiudi(); }
  });

  test("una richiesta respinta (fonte errata, 400) non consuma il cooldown della richiesta corretta", async () => {
    const { porta, chiudi } = await avvia({ ...conToken, cooldownOperazioniSecondi: 60 });
    const h = { Authorization: `Bearer ${TOKEN}` };
    try {
      const errata = await chiedi(porta, "/api/scrape?fonte=non-esiste", { metodo: "POST", intestazioni: h });
      assert.equal(errata.stato, 400);
      const corretta = await chiedi(porta, "/api/scrape?fonte=demo", { metodo: "POST", intestazioni: h });
      assert.equal(corretta.stato, 200, corretta.corpo);
    } finally { await chiudi(); }
  });

  test("senza token lo scraping via API e' rifiutato", async () => {
    const { porta, chiudi } = await avvia();
    try {
      const r = await chiedi(porta, "/api/scrape?fonte=demo", { metodo: "POST" });
      assert.equal(r.stato, 401);
    } finally { await chiudi(); }
  });

  test("due operazioni contemporanee: la seconda trova la prima in corso (409)", async () => {
    let sblocca!: () => void;
    const lenta = esclusivo("scraping", () => new Promise<void>((r) => { sblocca = r; }));
    await assert.rejects(() => esclusivo("arricchimento", async () => 1), LavoroInCorso);
    sblocca();
    await lenta;
    assert.equal(await esclusivo("arricchimento", async () => 7), 7, "terminata la prima, si puo' ripartire");
  });

  test("via API: scraping mentre un altro lavoro e' in corso risponde 409", async () => {
    const { porta, chiudi } = await avvia();
    const h = { Authorization: `Bearer ${TOKEN}` };
    let sblocca!: () => void;
    const lenta = esclusivo("scraping", () => new Promise<void>((r) => { sblocca = r; }));
    try {
      const r = await chiedi(porta, "/api/scrape?fonte=demo", { metodo: "POST", intestazioni: h });
      assert.equal(r.stato, 409);
    } finally { sblocca(); await lenta; await chiudi(); }
  });
});
