import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-storico-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { salvaImmobiliDeduplicati, storicoPrezzi, listImmobili, listAllRows } = await import(
  "./repository.js"
);

/** Lo stesso annuncio, rilevato piu' volte con prezzi diversi. */
const annuncio = (prezzo: number | null) => ({
  fonte: "test", idEsterno: "ann-1", titolo: "Trilocale", comune: "Novara",
  indirizzoRaw: "Via Prima 1", mq: 90, locali: 3,
  prezzo, tipoPrezzo: "richiesta_reoco" as const,
});

function idAnnuncio(): number {
  return listAllRows().find((r) => r.id_esterno === "ann-1")!.id;
}

describe("storico dei prezzi", () => {
  test("il primo rilevamento viene registrato", () => {
    salvaImmobiliDeduplicati([annuncio(200000)]);
    const s = storicoPrezzi(idAnnuncio());
    assert.equal(s.length, 1);
    assert.equal(s[0]!.prezzo, 200000);
  });

  test("uno scraping che non cambia il prezzo non aggiunge righe", () => {
    salvaImmobiliDeduplicati([annuncio(200000)]);
    salvaImmobiliDeduplicati([annuncio(200000)]);
    assert.equal(storicoPrezzi(idAnnuncio()).length, 1, "solo le variazioni vanno annotate");
  });

  test("un ribasso viene registrato conservando il prezzo precedente", () => {
    salvaImmobiliDeduplicati([annuncio(180000)]);
    const s = storicoPrezzi(idAnnuncio());
    assert.equal(s.length, 2);
    assert.equal(s[0]!.prezzo, 200000, "il prezzo iniziale non deve andare perduto");
    assert.equal(s[1]!.prezzo, 180000);
  });

  test("il listato espone il prezzo iniziale, da cui si ricava il calo", () => {
    const riga = listImmobili({ comune: "Novara" })[0]!;
    assert.equal(riga.prezzo, 180000);
    assert.equal(riga.prezzo_iniziale, 200000);
    assert.equal(riga.n_rilevazioni_prezzo, 2);
    // il 10% di calo e' cio' che la dashboard mostra come "ribassato"
    assert.equal(Math.round((1 - riga.prezzo! / riga.prezzo_iniziale!) * 100), 10);
  });

  test("il filtro 'solo ribassati' esclude i prezzi fermi", () => {
    salvaImmobiliDeduplicati([
      { fonte: "test", idEsterno: "fermo-1", titolo: "Mai ribassato", comune: "Novara",
        indirizzoRaw: "Via Seconda 2", mq: 70, locali: 2, prezzo: 150000 },
    ]);

    const tutti = listImmobili({ comune: "Novara" });
    const ribassati = listImmobili({ comune: "Novara", soloRibassati: true });
    assert.equal(tutti.length, 2);
    assert.equal(ribassati.length, 1);
    assert.equal(ribassati[0]!.id_esterno, "ann-1");
  });

  test("l'ordinamento per ribasso mette per primo il calo maggiore", () => {
    salvaImmobiliDeduplicati([
      { fonte: "test", idEsterno: "crollo", titolo: "Grosso calo", comune: "Novara",
        indirizzoRaw: "Via Terza 3", mq: 120, locali: 4, prezzo: 400000 },
    ]);
    salvaImmobiliDeduplicati([
      { fonte: "test", idEsterno: "crollo", titolo: "Grosso calo", comune: "Novara",
        indirizzoRaw: "Via Terza 3", mq: 120, locali: 4, prezzo: 250000 },
    ]);

    const ordinati = listImmobili({ comune: "Novara", ordine: "ribasso" });
    assert.equal(ordinati[0]!.id_esterno, "crollo", "150.000 di calo batte 20.000");
  });

  test("un prezzo assente non inquina lo storico", () => {
    salvaImmobiliDeduplicati([
      { fonte: "test", idEsterno: "senza-prezzo", titolo: "Pre-asta senza prezzo",
        comune: "Novara", indirizzoRaw: "Via Quarta 4", mq: 60, locali: 2, prezzo: null },
    ]);
    const id = listAllRows().find((r) => r.id_esterno === "senza-prezzo")!.id;
    assert.equal(storicoPrezzi(id).length, 0, "senza prezzo non c'e' nulla da annotare");
  });
});

describe("annunci gemelli dello stesso portale", () => {
  test("due box allo stesso civico non diventano un falso ribasso, nemmeno al giro dopo", async () => {
    const { salvaImmobiliDeduplicati, listAllRows, novita } = await import("./repository.js");
    const { deduplica } = await import("@qdr/core");
    const box = (id: string, prezzo: number) => ({
      fonte: "demanio_test", idEsterno: id, indirizzoRaw: "PIERPAOLO PASOLINI N. 33", comune: "MANERBIO", prezzo,
      tipoPrezzo: "base_asta" as const,
    });
    for (let giro = 0; giro < 2; giro++) {
      salvaImmobiliDeduplicati(deduplica([box("18962", 21889), box("18963", 15439)]) as never);
    }
    const righe = listAllRows().filter((r) => r.fonte === "demanio_test");
    assert.equal(righe.length, 2);
    assert.deepEqual(righe.map((r) => r.prezzo).sort(), [15439, 21889]);
    assert.equal(novita(1).ribassati.filter((r) => r.immobile.fonte === "demanio_test").length, 0);
  });
});
