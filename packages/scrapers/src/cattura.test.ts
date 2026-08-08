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
