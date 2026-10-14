import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { configurazioneWhatsApp, inviaTesto, spiegaErrore, type ConfigWhatsApp } from "./whatsapp.js";

const AMBIENTE_COMPLETO = {
  QDR_WHATSAPP_TOKEN: "tok",
  QDR_WHATSAPP_PHONE_ID: "123456",
  QDR_WHATSAPP_A: "+39 340 1234567",
} as NodeJS.ProcessEnv;

describe("configurazione", () => {
  test("nomina le variabili mancanti, una per una", () => {
    const c = configurazioneWhatsApp({} as NodeJS.ProcessEnv);
    assert.equal(c.ok, false);
    if (c.ok) return;
    assert.equal(c.mancanti.length, 3);
    assert.ok(c.mancanti.some((m) => m.startsWith("QDR_WHATSAPP_TOKEN")));
  });

  test("il numero viene ridotto alle sole cifre", () => {
    // spazi e '+' copiati dalla rubrica sono la causa piu' banale di un invio
    // respinto, ed e' inutile farla pagare a chi configura
    const c = configurazioneWhatsApp(AMBIENTE_COMPLETO);
    assert.equal(c.ok, true);
    if (!c.ok) return;
    assert.equal(c.config.a, "393401234567");
  });

  test("senza template si parla di testo libero", () => {
    const c = configurazioneWhatsApp(AMBIENTE_COMPLETO);
    assert.equal(c.ok && c.config.template, undefined);
  });

  test("una variabile di soli spazi conta come mancante", () => {
    const c = configurazioneWhatsApp({ ...AMBIENTE_COMPLETO, QDR_WHATSAPP_TOKEN: "   " });
    assert.equal(c.ok, false);
  });
});

describe("traduzione degli errori di Meta", () => {
  test("131047 spiega la finestra di 24 ore e le due vie d'uscita", () => {
    const t = spiegaErrore(131047, "Re-engagement message");
    assert.match(t, /24 ore/);
    assert.match(t, /QDR_WHATSAPP_TEMPLATE/);
  });

  test("190 indica il token, non il messaggio", () => {
    assert.match(spiegaErrore(190, "invalid token"), /Token scaduto o revocato/);
  });

  test("un codice sconosciuto non viene inventato: passa il messaggio originale", () => {
    assert.equal(spiegaErrore(99999, "qualcosa di nuovo"), "qualcosa di nuovo");
  });
});

const CFG: ConfigWhatsApp = {
  token: "tok",
  phoneId: "123",
  a: "393401234567",
  lingua: "it",
  versione: "v21.0",
};

/** Sostituisce fetch per la durata di una prova: nessuna chiamata vera a Meta. */
async function conFetch<T>(finto: typeof fetch, corpo: () => Promise<T>): Promise<T> {
  const vero = globalThis.fetch;
  globalThis.fetch = finto;
  try {
    return await corpo();
  } finally {
    globalThis.fetch = vero;
  }
}

describe("invio", () => {
  test("un esito positivo riporta il wamid", async () => {
    const esito = await conFetch(
      async () => new Response(JSON.stringify({ messages: [{ id: "wamid.XYZ" }] }), { status: 200 }),
      () => inviaTesto(CFG, "ciao"),
    );
    assert.equal(esito.inviato, true);
    assert.equal(esito.wamid, "wamid.XYZ");
  });

  test("un errore di Meta non viene scambiato per un successo", async () => {
    const esito = await conFetch(
      async () =>
        new Response(JSON.stringify({ error: { message: "Re-engagement message", code: 131047 } }), { status: 400 }),
      () => inviaTesto(CFG, "ciao"),
    );
    assert.equal(esito.inviato, false);
    assert.match(esito.errore!, /24 ore/);
  });

  test("una risposta non-JSON viene mostrata com'e', senza spiegazioni inventate", async () => {
    const esito = await conFetch(
      async () => new Response("<html>502 Bad Gateway</html>", { status: 502 }),
      () => inviaTesto(CFG, "ciao"),
    );
    assert.equal(esito.inviato, false);
    assert.match(esito.errore!, /502/);
  });

  test("la rete irraggiungibile e' un errore, non un'eccezione che sfugge", async () => {
    const esito = await conFetch(
      () => Promise.reject(new Error("ENOTFOUND")),
      () => inviaTesto(CFG, "ciao"),
    );
    assert.equal(esito.inviato, false);
    assert.match(esito.errore!, /rete non raggiungibile/);
  });

  test("il corpo viene tagliato a 4096 caratteri prima di partire", async () => {
    let inviato = "";
    await conFetch(
      async (_u, init) => {
        inviato = JSON.parse(String((init as RequestInit).body)).text.body;
        return new Response(JSON.stringify({ messages: [{ id: "x" }] }), { status: 200 });
      },
      () => inviaTesto(CFG, "a".repeat(5000)),
    );
    assert.equal(inviato.length, 4096);
  });
});
