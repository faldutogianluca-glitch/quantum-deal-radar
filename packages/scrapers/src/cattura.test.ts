import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { proponiSelettori } from "./cattura.js";

/** Pagina realistica: navigazione, wrapper e otto schede annuncio. */
const PAGINA = `<!DOCTYPE html><html><head><title>Immobili</title></head><body>
  <nav class="menu">
    <a class="voce-menu" href="/a">A</a><a class="voce-menu" href="/b">B</a><a class="voce-menu" href="/c">C</a>
  </nav>
  <div class="contenitore-risultati">
    ${Array.from({ length: 8 }, (_, i) => `
      <article class="card-annuncio">
        <a class="link-dettaglio" href="/immobile/${i}"><h3 class="titolo-annuncio">Trilocale in via Roma ${i}</h3></a>
        <span class="prezzo-annuncio">€ 95.000</span>
        <span class="citta-annuncio">Milano</span>
      </article>`).join("")}
  </div>
</body></html>`;

describe("proponiSelettori", () => {
  test("riconosce la classe delle schede", () => {
    const c = proponiSelettori(PAGINA);
    const nomi = c.map((x) => x.selettore);
    assert.ok(nomi.includes(".card-annuncio"), `atteso .card-annuncio fra ${nomi.join(", ")}`);

    const scheda = c.find((x) => x.selettore === ".card-annuncio")!;
    assert.equal(scheda.occorrenze, 8);
    assert.equal(scheda.conLink, 8);
    assert.match(scheda.anteprima, /Trilocale/);
  });

  test("scarta le voci di navigazione, che hanno link ma quasi nessun testo", () => {
    const nomi = proponiSelettori(PAGINA).map((x) => x.selettore);
    assert.ok(!nomi.includes(".voce-menu"), "il menu non e' un elenco di risultati");
  });

  test("scarta i blocchi che compaiono troppo poche volte", () => {
    const nomi = proponiSelettori(PAGINA).map((x) => x.selettore);
    assert.ok(!nomi.includes(".contenitore-risultati"), "un wrapper unico non e' una scheda");
  });

  test("una pagina senza elenchi non produce candidati", () => {
    assert.deepEqual(proponiSelettori("<html><body><p>Nessun risultato trovato.</p></body></html>"), []);
  });
});

/**
 * Pagina con un design system, come i portali costruiti su librerie di
 * componenti: decine di classi di impaginazione che ricorrono poche volte
 * ripetendo lo stesso testo, e in mezzo le schede vere.
 */
const PAGINA_DESIGN_SYSTEM = `<!DOCTYPE html><html><body>
  ${Array.from({ length: 20 }, (_, k) => `
    <div class="mds-blocco-${k}"><a href="/nav/${k}">Naviga nel sito, sezione utile</a></div>
    <div class="mds-blocco-${k}"><a href="/nav/${k}">Naviga nel sito, sezione utile</a></div>
    <div class="mds-blocco-${k}"><a href="/nav/${k}">Naviga nel sito, sezione utile</a></div>`).join("")}
  <section class="elenco">
    ${Array.from({ length: 24 }, (_, i) => `
      <article class="scheda-annuncio">
        <a href="/annuncio/${i}"><h3>Appartamento in vendita, lotto numero ${i}</h3></a>
      </article>`).join("")}
  </section>
</body></html>`;

describe("proponiSelettori su una pagina con design system", () => {
  test("mette per prime le schede, non le classi di impaginazione", () => {
    const c = proponiSelettori(PAGINA_DESIGN_SYSTEM);
    const nomi = c.map((x) => x.selettore);

    // Il bug: ordinando per rarita' e tagliando la lista, le venti classi
    // ricorrenti tre volte occupavano tutti i posti e le schede sparivano.
    assert.ok(nomi.includes(".scheda-annuncio"), `atteso .scheda-annuncio fra ${nomi.join(", ")}`);
    assert.equal(nomi[0], ".scheda-annuncio", `atteso primo, ordine ottenuto: ${nomi.join(", ")}`);
  });

  test("misura la varieta' del contenuto, che e' cio' che distingue una scheda", () => {
    const c = proponiSelettori(PAGINA_DESIGN_SYSTEM);
    const scheda = c.find((x) => x.selettore === ".scheda-annuncio")!;
    assert.equal(scheda.occorrenze, 24);
    assert.equal(scheda.testiDistinti, 24, "ogni annuncio ha un testo suo");

    const impaginazione = c.find((x) => x.selettore === ".mds-blocco-0");
    if (impaginazione) {
      assert.equal(impaginazione.testiDistinti, 1, "un blocco di impaginazione ripete lo stesso testo");
    }
  });
});
