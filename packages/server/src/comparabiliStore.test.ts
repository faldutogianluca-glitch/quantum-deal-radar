import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-comps-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { importaComparabili, listComparabili, CARTELLA_COMPARABILI } = await import("./comparabiliStore.js");

describe("import dei comparabili da CSV", () => {
  test("legge un export di Excel italiano e scarta le righe inservibili, dicendo perche'", async () => {
    mkdirSync(CARTELLA_COMPARABILI, { recursive: true });
    writeFileSync(
      join(CARTELLA_COMPARABILI, "agenzia.csv"),
      "﻿Codice;Indirizzo;Comune;Superficie;Prezzo;Condizioni;Data annuncio;Lat;Lon;Piano\n" +
        "A1;Via Tortona 12;Milano;95;\"475.000\";Ottimo / Ristrutturato;2026-07-01;45,4521;9,1712;3\n" +
        "A2;Via Savona 40;Milano;80;380.000 €;Nuovo;12/08/2026;;;2\n" +
        "A3;Via Solari 5;Milano;;300.000;Ristrutturato;2026-06-01;;;1\n",
    );
    const esito = await importaComparabili();
    assert.equal(esito.importati, 2);
    assert.deepEqual(esito.scartati, [{ motivo: "superficie mancante o non plausibile", n: 1 }]);
    assert.deepEqual(esito.colonneIgnorate, ["Piano"]);

    const [a1, a2] = listComparabili().sort((x, y) => x.mq - y.mq).reverse();
    assert.equal(a1!.prezzo, 475_000);
    assert.equal(a1!.stato, "ristrutturato");
    assert.equal(a1!.lat, 45.4521, "le coordinate con la virgola decimale vanno lette");
    assert.equal(a1!.data, "2026-07-01", "la data ISO non va confusa con una data italiana");
    assert.equal(a2!.stato, "nuovo");
    assert.equal(a2!.data, "2026-08-12");
    assert.equal(a2!.tipoPrezzo, "richiesta");
  });

  test("reimportare lo stesso file aggiorna, non duplica", async () => {
    const esito = await importaComparabili();
    assert.equal(esito.importati, 0);
    assert.equal(esito.aggiornati, 2);
    assert.equal(listComparabili().length, 2);
  });

  test("se il file sposta un comparabile, la zona OMI trovata prima si ricalcola", async () => {
    const { salvaGeoComparabile } = await import("./comparabiliStore.js");
    const a1 = listComparabili().find((c) => c.indirizzo === "Via Tortona 12")!;
    salvaGeoComparabile(a1.id, a1.lat, a1.lon, "C12");
    writeFileSync(
      join(CARTELLA_COMPARABILI, "agenzia.csv"),
      "Codice;Indirizzo;Comune;Superficie;Prezzo;Condizioni;Data annuncio;Lat;Lon\n" +
        "A1;Via Tortona 12;Milano;95;475.000;Ristrutturato;2026-07-01;45,4700;9,1900\n",
    );
    await importaComparabili();
    const dopo = listComparabili().find((c) => c.id === a1.id)!;
    assert.equal(dopo.lat, 45.47);
    assert.equal(dopo.zonaOmi, null, "la zona vecchia non deve seguire le coordinate nuove");
    assert.equal(dopo.geoTentato, false);
  });
});
