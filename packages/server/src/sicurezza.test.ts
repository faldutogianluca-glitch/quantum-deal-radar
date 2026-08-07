import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Il modulo vive in public/ perche' lo carica anche il browser; qui viene importato
// direttamente, senza DOM ne' browser di test.
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const { escapeAttr, escapeHtml, urlSicuro } = (await import(
  join(PUBLIC_DIR, "sicurezza.js")
)) as {
  escapeAttr: (s: unknown) => string;
  escapeHtml: (s: unknown) => string;
  urlSicuro: (raw: unknown, base?: string) => string | null;
};

const ORIGINE = "http://localhost:3000";

describe("urlSicuro: schemi eseguibili", () => {
  test("respinge javascript: e i suoi travestimenti", () => {
    // erano cliccabili nella dashboard: al clic eseguivano codice nella sua origine
    assert.equal(urlSicuro("javascript:alert(1)", ORIGINE), null);
    assert.equal(urlSicuro("JavaScript:alert(1)", ORIGINE), null);
    assert.equal(urlSicuro("  javascript:alert(1)", ORIGINE), null);
    assert.equal(urlSicuro("java\tscript:alert(1)", ORIGINE), null);
  });

  test("respinge data: e vbscript:", () => {
    assert.equal(urlSicuro("data:text/html;base64,PHNjcmlwdD4=", ORIGINE), null);
    assert.equal(urlSicuro("vbscript:msgbox(1)", ORIGINE), null);
  });

  test("respinge valori vuoti o non analizzabili", () => {
    assert.equal(urlSicuro(null, ORIGINE), null);
    assert.equal(urlSicuro("", ORIGINE), null);
    assert.equal(urlSicuro("http://", ORIGINE), null);
  });

  test("lascia passare gli URL legittimi", () => {
    assert.equal(urlSicuro("https://esempio.it/x", ORIGINE), "https://esempio.it/x");
    assert.equal(urlSicuro("http://esempio.it/x", ORIGINE), "http://esempio.it/x");
    assert.equal(urlSicuro("/immobile/1", ORIGINE), `${ORIGINE}/immobile/1`);
  });
});

describe("escapeAttr: uscita dall'attributo", () => {
  test("neutralizza le virgolette che permettono di iniettare attributi", () => {
    // payload reale usato per iniettare data-iniettato="si" nel link del dettaglio
    const ostile = 'https://ok.invalid/x" data-iniettato="si';
    const escapato = escapeAttr(ostile);
    assert.ok(!escapato.includes('"'), "nessuna virgoletta doppia deve sopravvivere");
    assert.ok(escapato.includes("&quot;"));
  });

  test("neutralizza anche apici singoli e parentesi angolari", () => {
    assert.equal(escapeAttr(`a'b`), "a&#39;b");
    assert.equal(escapeAttr("<img>"), "&lt;img&gt;");
  });

  test("l'ampersand e' convertito per primo, senza doppia codifica", () => {
    assert.equal(escapeAttr('&"'), "&amp;&quot;");
  });
});

describe("escapeHtml: contenuto testuale", () => {
  test("un titolo scrapato non puo' aprire un tag", () => {
    assert.equal(
      escapeHtml("<script>alert(1)</script>"),
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  test("null e undefined diventano stringa vuota", () => {
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
  });
});
