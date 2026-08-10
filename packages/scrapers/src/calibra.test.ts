import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { calibraDaHtml } from "./calibra.js";

/**
 * Pagina ricalcata su un portale reale, con dentro le trappole che contano:
 * classi dal nome inutile (un design system non dice mai cosa contiene), un
 * numero civico che somiglia a una cifra, un badge presente solo su alcune
 * schede, e un secondo importo che non e' il prezzo.
 */
const PAGINA = `<!DOCTYPE html><html><body>
  <nav class="mds-nav"><a href="/a">Home</a><a href="/b">Chi siamo</a></nav>
  <section class="mds-grid">
  ${[
    { t: "Appartamento in vendita a Cremona, zona centro", c: "Cremona", p: "€ 148.000", d: "12/03/2027", m: "95 mq", badge: "3° esperimento" },
    { t: "Villetta a schiera con giardino a Pavia", c: "Pavia", p: "€ 212.500", d: "04/04/2027", m: "140 mq", badge: "" },
    { t: "Capannone artigianale in zona industriale a Lodi", c: "Lodi", p: "€ 385.000", d: "19/05/2027", m: "820 mq", badge: "2° esperimento" },
    { t: "Locale commerciale su strada a Mantova", c: "Mantova", p: "€ 96.000", d: "07/06/2027", m: "62 mq", badge: "" },
  ]
    .map(
      (x, i) => `
    <article class="mds-card-3">
      <a class="mds-a" href="/immobile/${1000 + i}">
        <img class="mds-img" src="/foto/${1000 + i}.jpg">
        <h3 class="mds-txt-1">${x.t}</h3>
      </a>
      <span class="mds-txt-2">${x.c}</span>
      <span class="mds-txt-3">${x.p}</span>
      <span class="mds-txt-4">Asta del ${x.d}</span>
      <span class="mds-txt-5">${x.m}</span>
      <span class="mds-txt-6">Spese di procedura: 350</span>
      ${x.badge ? `<span class="mds-badge">${x.badge}</span>` : ""}
    </article>`,
    )
    .join("")}
  </section>
</body></html>`;

function campo(esito: ReturnType<typeof calibraDaHtml>, nome: string) {
  return esito.proposte.find((p) => p.campo === nome);
}

describe("calibrazione automatica dei selettori", () => {
  test("trova le schede senza che nessuno le indichi", () => {
    const e = calibraDaHtml(PAGINA);
    assert.equal(e.listSelector, ".mds-card-3");
    assert.equal(e.origineListSelector, "proposto");
    assert.equal(e.schede, 4);
  });

  test("riconosce il prezzo dal valore, non dal nome della classe", () => {
    // la classe si chiama .mds-txt-3: nessun indizio nel nome
    const p = campo(calibraDaHtml(PAGINA), "prezzoRaw");
    assert.ok(p, "il prezzo deve essere proposto");
    assert.equal(p!.selettore, ".mds-txt-3");
    assert.equal(p!.confidenza, "alta");
  });

  test("non scambia un importo accessorio per il prezzo dell'immobile", () => {
    // "Spese di procedura: 350" e' un importo, ma di ordine di grandezza sbagliato
    const e = calibraDaHtml(PAGINA);
    assert.notEqual(campo(e, "prezzoRaw")!.selettore, ".mds-txt-6");
    assert.ok(
      !e.alternative.some((a) => a.campo === "prezzoRaw" && a.selettore === ".mds-txt-6"),
      "un importo sotto i mille non e' il prezzo di un immobile",
    );
  });

  test("riconosce la data d'asta", () => {
    const d = campo(calibraDaHtml(PAGINA), "dataAstaRaw");
    assert.ok(d);
    assert.equal(d!.selettore, ".mds-txt-4");
  });

  test("riconosce la superficie dall'unita' di misura", () => {
    const m = campo(calibraDaHtml(PAGINA), "mqRaw");
    assert.ok(m);
    assert.equal(m!.selettore, ".mds-txt-5");
  });

  test("il titolo e' il testo piu' lungo presente su tutte le schede", () => {
    const t = campo(calibraDaHtml(PAGINA), "titolo");
    assert.ok(t);
    assert.equal(t!.selettore, ".mds-txt-1");
  });

  test("propone il link e l'immagine dagli attributi", () => {
    const e = calibraDaHtml(PAGINA);
    assert.match(campo(e, "url")!.selettore, /attr\(href\)/);
    assert.match(campo(e, "immagineUrl")!.selettore, /attr\(src\)/);
  });

  test("un campo presente solo su alcune schede non prende confidenza alta", () => {
    // il badge dell'esperimento c'e' su due schede su quattro: e' opzionale,
    // e spacciarlo per affidabile farebbe scrivere un config che mente
    const e = calibraDaHtml(PAGINA);
    const deserti = campo(e, "nEsperimentiDeserti");
    assert.ok(deserti);
    assert.equal(deserti!.presenteIn, 2);
    assert.notEqual(deserti!.confidenza, "alta");
  });

  test("ogni campo compare una volta sola nella bozza", () => {
    const e = calibraDaHtml(PAGINA);
    const nomi = e.proposte.map((p) => p.campo);
    assert.equal(new Set(nomi).size, nomi.length, `campi duplicati in ${nomi.join(", ")}`);
  });

  test("la bozza e' pronta da incollare nel config", () => {
    const { bozza } = calibraDaHtml(PAGINA);
    assert.equal(bozza.listSelector, ".mds-card-3");
    assert.equal(bozza.fields["prezzoRaw"], ".mds-txt-3");
    assert.ok(bozza.fields["titolo"] && bozza.fields["url"], "titolo e url servono sempre");
  });

  test("un listSelector gia' nel config non viene cambiato alle spalle di chi lo mantiene", () => {
    const e = calibraDaHtml(PAGINA, ".mds-card-3");
    assert.equal(e.origineListSelector, "config");
    assert.equal(e.schede, 4);
  });

  test("un listSelector nel config che non trova nulla viene ricalcolato", () => {
    // il portale ha cambiato markup: insistere su un selettore morto darebbe
    // zero schede e nessuna spiegazione
    const e = calibraDaHtml(PAGINA, ".classe-che-non-esiste-piu");
    assert.equal(e.origineListSelector, "proposto");
    assert.equal(e.listSelector, ".mds-card-3");
  });

  test("una pagina senza elenchi lo dice, invece di proporre selettori inventati", () => {
    assert.throws(
      () => calibraDaHtml("<html><body><p>Nessun risultato.</p></body></html>"),
      /Nessun blocco ripetuto/,
    );
  });
});

describe("valori misti dentro lo stesso selettore", () => {
  test("un selettore che a volte porta un prezzo e a volte no non viene proposto", () => {
    // e' il caso peggiore: funziona sulla prima scheda e fallisce sulle altre,
    // e chi rivede la bozza vede un esempio giusto
    const misto = `<!DOCTYPE html><html><body>
      ${Array.from({ length: 4 }, (_, i) => `
      <article class="scheda">
        <a href="/x/${i}"><h3 class="tit">Immobile numero ${i} con titolo lungo</h3></a>
        <span class="forse">${i === 0 ? "€ 150.000" : "prezzo su richiesta"}</span>
      </article>`).join("")}
    </body></html>`;

    const e = calibraDaHtml(misto);
    const prezzo = e.proposte.find((p) => p.campo === "prezzoRaw");
    assert.equal(prezzo, undefined, "meglio nessuna proposta che una che regge su una scheda sola");
  });
});

describe("un selettore serve un campo solo", () => {
  /** "Asta del 12/03/2027" e' insieme una data e un tipo di vendita. */
  const AMBIGUA = `<!DOCTYPE html><html><body>
    ${Array.from({ length: 4 }, (_, i) => `
    <article class="scheda">
      <a href="/x/${i}"><h3 class="tit">Immobile numero ${i} con un titolo abbastanza lungo</h3></a>
      <span class="quando">Asta del 1${i}/03/2027</span>
    </article>`).join("")}
  </body></html>`;

  test("lo stesso elemento non finisce su due campi", () => {
    const e = calibraDaHtml(AMBIGUA);
    const selettori = e.proposte.map((p) => p.selettore);
    assert.equal(
      new Set(selettori).size,
      selettori.length,
      `selettore ripetuto fra i campi: ${e.proposte.map((p) => `${p.campo}=${p.selettore}`).join(", ")}`,
    );
  });

  test("vince il campo piu' specifico, e lo scarto resta visibile fra le alternative", () => {
    const e = calibraDaHtml(AMBIGUA);
    // la data e' piu' specifica del generico "tipo di vendita"
    assert.equal(campo(e, "dataAstaRaw")?.selettore, ".quando");
    assert.equal(campo(e, "tipoVendita"), undefined);
    assert.ok(
      e.alternative.some((a) => a.campo === "tipoVendita" && /serve gia' un altro campo/.test(a.motivo)),
      "chi rivede deve poter vedere cosa e' stato scartato e perche'",
    );
  });
});
