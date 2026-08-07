import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { geocoderNominatim, type Precisione } from "./geocode.js";

/**
 * classifica() non e' esportata: si esercita attraverso geocoderNominatim, che
 * espone fetchImpl proprio per questo. E' anche il percorso reale — testare la
 * classificazione fuori dalla risposta che la produce direbbe meno.
 */

interface RispostaFinta {
  lat?: string;
  lon?: string;
  display_name?: string;
  addresstype?: string;
  type?: string;
  class?: string;
}

interface Chiamata {
  url: string;
  init?: RequestInit;
}

function fetchFinto(payload: unknown, ok = true): { impl: typeof fetch; chiamate: Chiamata[] } {
  const chiamate: Chiamata[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    chiamate.push({ url: String(input), init });
    return { ok, json: async () => payload } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, chiamate };
}

/** Geocodifica una singola risposta finta e ritorna la precisione classificata. */
async function precisioneDi(r: RispostaFinta): Promise<Precisione | undefined> {
  const { impl } = fetchFinto([{ lat: "45.47", lon: "9.19", ...r }]);
  const esito = await geocoderNominatim({ userAgent: "test", pausaMs: 0, fetchImpl: impl }).geocodifica("q");
  return esito?.precisione;
}

describe("classificazione della precisione di geocoding", () => {
  // La precisione decide se risolviZona() assegna una zona OMI o ripiega sul
  // comune (vedi PRECISIONE_MINIMA in zoneOmi.ts): una classificazione sbagliata
  // non produce un errore, produce una valutazione peggiore senza dirlo.
  const CASI: [RispostaFinta, Precisione][] = [
    // --- civico
    [{ addresstype: "house" }, "civico"],
    [{ addresstype: "house_number" }, "civico"],
    [{ addresstype: "building" }, "civico"],
    [{ addresstype: "address" }, "civico"],
    // --- strada
    [{ addresstype: "road" }, "strada"],
    [{ addresstype: "residential" }, "strada"],
    [{ addresstype: "unclassified" }, "strada"],
    [{ addresstype: "living_street" }, "strada"],
    [{ addresstype: "service" }, "strada"],
    [{ addresstype: "pedestrian" }, "strada"],
    [{ addresstype: "primary" }, "strada"],
    [{ addresstype: "secondary" }, "strada"],
    [{ addresstype: "tertiary" }, "strada"],
    // --- localita
    [{ addresstype: "suburb" }, "localita"],
    [{ addresstype: "neighbourhood" }, "localita"],
    [{ addresstype: "quarter" }, "localita"],
    [{ addresstype: "hamlet" }, "localita"],
    [{ addresstype: "village" }, "localita"],
    // --- comune
    [{ addresstype: "city" }, "comune"],
    [{ addresstype: "town" }, "comune"],
    [{ addresstype: "municipality" }, "comune"],
    [{ addresstype: "administrative" }, "comune"],
    // --- ignoto
    [{ addresstype: "qualcosa_di_nuovo" }, "nessuna"],
    [{}, "nessuna"],
  ];

  for (const [risposta, atteso] of CASI) {
    const nome = risposta.addresstype ?? "(nessun tipo)";
    test(`${nome} -> ${atteso}`, async () => {
      assert.equal(await precisioneDi(risposta), atteso);
    });
  }

  test("house_number e' un civico qualunque sia la class", async () => {
    // Regressione: la classificazione era condizionata a class === "place", e
    // un civico servito con class "building" o "amenity" finiva in "nessuna",
    // cioe' sotto la soglia minima: zona OMI non assegnata, ripiego comunale.
    for (const classe of ["place", "building", "amenity", undefined]) {
      assert.equal(
        await precisioneDi({ addresstype: "house_number", ...(classe ? { class: classe } : {}) }),
        "civico",
        `class=${classe ?? "(assente)"} deve restare civico`,
      );
    }
  });

  test("le vie residenziali italiane piu' comuni non degradano", async () => {
    // unclassified e living_street sono fra i valori highway piu' diffusi sulle
    // strade urbane italiane: prima non erano in elenco e cadevano in "nessuna".
    for (const tipo of ["unclassified", "living_street", "service"]) {
      assert.equal(await precisioneDi({ addresstype: tipo, class: "highway" }), "strada", tipo);
    }
  });

  test("class OSM come ripiego quando il type non e' in elenco", async () => {
    // L'elenco dei type non e' chiudibile: il ripiego evita che un valore nuovo
    // faccia sparire la zona in silenzio.
    assert.equal(await precisioneDi({ addresstype: "raccordo_ignoto", class: "highway" }), "strada");
    assert.equal(await precisioneDi({ addresstype: "tipo_ignoto", class: "building" }), "civico");
    assert.equal(await precisioneDi({ addresstype: "confine_ignoto", class: "boundary" }), "comune");
  });

  test("'place' resta non classificato", async () => {
    // In Nominatim `place` copre da "continent" a "house": mapparlo a un livello
    // preciso sarebbe una supposizione. Meglio il ripiego comunale, che almeno
    // si porta dietro il flag.
    assert.equal(await precisioneDi({ addresstype: "place", class: "place" }), "nessuna");
  });

  test("si usa `type` quando `addresstype` manca", async () => {
    assert.equal(await precisioneDi({ type: "road" }), "strada");
    assert.equal(await precisioneDi({ addresstype: "house", type: "road" }), "civico",
      "addresstype ha la precedenza su type");
  });
});

describe("geocoderNominatim: contratto della risposta", () => {
  const geo = (payload: unknown, ok = true) => {
    const { impl, chiamate } = fetchFinto(payload, ok);
    return {
      chiamate,
      geocoder: geocoderNominatim({ userAgent: "QDR-test/1.0", pausaMs: 0, fetchImpl: impl }),
    };
  };

  test("risposta HTTP non ok -> null", async () => {
    const { geocoder } = geo([{ lat: "45.4", lon: "9.1", addresstype: "house" }], false);
    assert.equal(await geocoder.geocodifica("q"), null);
  });

  test("nessun risultato -> null", async () => {
    assert.equal(await geo([]).geocoder.geocodifica("q"), null);
  });

  test("risultato senza coordinate -> null", async () => {
    assert.equal(await geo([{ addresstype: "house" }]).geocoder.geocodifica("q"), null);
  });

  test("coordinate convertite in numeri, etichetta e fonte valorizzate", async () => {
    const { geocoder } = geo([{ lat: "45.4642", lon: "9.1900", display_name: "Milano", addresstype: "road" }]);
    const r = await geocoder.geocodifica("Via Tal 1, Milano");
    assert.deepEqual(r, {
      lat: 45.4642, lon: 9.19, precisione: "strada", etichetta: "Milano", fonte: "nominatim",
    });
  });

  test("senza display_name l'etichetta ripiega sulla query", async () => {
    const { geocoder } = geo([{ lat: "45.4", lon: "9.1", addresstype: "road" }]);
    assert.equal((await geocoder.geocodifica("Via Tal 1"))?.etichetta, "Via Tal 1");
  });

  test("la richiesta rispetta la usage policy: un solo risultato, Italia, User-Agent", async () => {
    const { geocoder, chiamate } = geo([{ lat: "45.4", lon: "9.1", addresstype: "road" }]);
    await geocoder.geocodifica("Via Monza 12, Milano");

    const { url, init } = chiamate[0]!;
    assert.match(url, /[?&]limit=1(&|$)/);
    assert.match(url, /[?&]countrycodes=it(&|$)/);
    assert.match(url, /[?&]q=Via%20Monza%2012%2C%20Milano(&|$)/);
    assert.equal((init?.headers as Record<string, string>)["User-Agent"], "QDR-test/1.0");
  });

  test("le richieste successive restano distanziate di pausaMs", async () => {
    // La policy di Nominatim impone al massimo una richiesta al secondo: senza
    // questa pausa il bot viene bloccato e l'enrich smette di funzionare.
    const { impl } = fetchFinto([{ lat: "45.4", lon: "9.1", addresstype: "road" }]);
    const geocoder = geocoderNominatim({ userAgent: "test", pausaMs: 120, fetchImpl: impl });

    await geocoder.geocodifica("prima");
    const inizio = Date.now();
    await geocoder.geocodifica("seconda");

    assert.ok(Date.now() - inizio >= 100, "la seconda richiesta deve attendere la pausa");
  });
});
