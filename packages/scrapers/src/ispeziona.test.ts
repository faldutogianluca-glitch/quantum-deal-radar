import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { cercaTesto, ispezionaSchede } from "./ispeziona.js";

/** Struttura ricalcata su un portale reale: griglia Bootstrap e schede annuncio. */
const PAGINA = `<!DOCTYPE html><html><body><div class="container"><div class="row">
${Array.from({ length: 5 }, (_, i) => `
  <div class="colonna-risultato col-md-4">
    <div class="blocco-asta">
      <a href="/immobile/${i}" class="link-scheda">
        <div class="copertina"><img src="/img/${i}.jpg"></div>
        <h4 class="titolo-immobile">EDIFICIO IN CECCANO (FR)</h4>
        <span class="comune-immobile">Ceccano</span>
        <span class="valutazione">Valutazione media: 852.000,00</span>
        ${i < 2 ? '<span class="badge-nuovo">Novita</span>' : ""}
      </a>
    </div>
  </div>`).join("")}
</div></div></body></html>`;

describe("ispezionaSchede", () => {
  test("conta le schede e ne elenca i campi con i valori", () => {
    const r = ispezionaSchede(PAGINA, ".blocco-asta");
    assert.equal(r.occorrenze, 5);

    const titolo = r.campi.find((c) => c.selettore === ".titolo-immobile");
    assert.ok(titolo, "il titolo deve essere fra i campi");
    assert.equal(titolo!.presenteIn, 5);
    assert.match(titolo!.esempi[0]!, /EDIFICIO IN CECCANO/);
  });

  test("distingue i campi opzionali da quelli presenti ovunque", () => {
    const r = ispezionaSchede(PAGINA, ".blocco-asta");
    // presente solo sulle prime due schede: va trattato come opzionale
    const badge = r.campi.find((c) => c.selettore === ".badge-nuovo");
    assert.ok(badge);
    assert.equal(badge!.presenteIn, 2);
    assert.ok(badge!.presenteIn < r.occorrenze);
  });

  test("riporta link e immagini, candidati per url e immagineUrl", () => {
    const r = ispezionaSchede(PAGINA, ".blocco-asta");
    const href = r.collegamenti.find((c) => c.selettore === "a::attr(href)");
    assert.ok(href);
    assert.equal(href!.presenteIn, 5);
    assert.match(href!.esempi[0]!, /\/immobile\/0/);

    const src = r.collegamenti.find((c) => c.selettore === "img::attr(src)");
    assert.ok(src, "le immagini vanno riportate per il campo immagineUrl");
  });

  test("un selettore che non trova nulla lo dice, senza fallire", () => {
    const r = ispezionaSchede(PAGINA, ".inesistente");
    assert.equal(r.occorrenze, 0);
    assert.equal(r.campi.length, 0);
    assert.equal(r.primoElemento, "");
  });
});

describe("cercaTesto", () => {
  test("risale dai testo ai contenitori, col conteggio di ciascuna classe", () => {
    const esiti = cercaTesto(PAGINA, "CECCANO");
    assert.ok(esiti.length > 0, "il testo e' nella pagina, va trovato");

    const tutteLeClassi = esiti[0]!.catena.flatMap((a) => a.classi);
    const scheda = tutteLeClassi.find((c) => c.selettore === ".blocco-asta");
    assert.ok(scheda, `atteso .blocco-asta fra ${tutteLeClassi.map((c) => c.selettore).join(", ")}`);
    // il conteggio e' il dato che fa scegliere: cinque schede, cinque occorrenze
    assert.equal(scheda!.occorrenzeInPagina, 5);

    // il wrapper unico si riconosce perche' ricorre una volta sola
    const container = tutteLeClassi.find((c) => c.selettore === ".container");
    assert.equal(container?.occorrenzeInPagina, 1);
  });

  test("parte dall'elemento piu' interno, senza ripetere lo stesso testo per ogni antenato", () => {
    const esiti = cercaTesto(PAGINA, "EDIFICIO IN CECCANO");
    // cinque schede, cinque risultati: se contasse anche gli antenati sarebbero molti di piu'
    assert.equal(esiti.length, 5);
    for (const e of esiti) assert.equal(e.testo, "EDIFICIO IN CECCANO (FR)");
  });

  test("un testo assente non produce risultati", () => {
    assert.deepEqual(cercaTesto(PAGINA, "villa con piscina"), []);
  });
});
