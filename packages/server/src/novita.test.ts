import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-novita-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { salvaImmobiliDeduplicati, novita, listAllRows } = await import("./repository.js");
const { db } = await import("./db.js");

const annuncio = (id: string, prezzo: number | null) => ({
  fonte: "test",
  idEsterno: id,
  titolo: `Immobile ${id}`,
  comune: "Cremona",
  indirizzoRaw: `Via Prima ${id}`,
  mq: 90,
  prezzo,
  tipoPrezzo: "richiesta_reoco" as const,
});

/** Sposta indietro nel tempo le tracce di un immobile, per simulare il passato. */
function invecchia(idEsterno: string, giorni: number): void {
  const quando = new Date(Date.now() - giorni * 86_400_000).toISOString();
  const riga = listAllRows().find((r) => r.id_esterno === idEsterno)!;
  db.prepare("UPDATE immobili SET first_seen_at = ? WHERE id = ?").run(quando, riga.id);
  db.prepare("UPDATE storico_prezzi SET rilevato_il = ? WHERE immobile_id = ?").run(quando, riga.id);
}

beforeEach(() => {
  db.exec("DELETE FROM storico_prezzi; DELETE FROM immobili;");
});

describe("digest dei movimenti", () => {
  test("un ribasso viene riconosciuto, con il calo in percentuale", () => {
    salvaImmobiliDeduplicati([annuncio("a", 200_000)]);
    invecchia("a", 10);
    salvaImmobiliDeduplicati([annuncio("a", 150_000)]);

    const n = novita(7);
    assert.equal(n.ribassati.length, 1);
    const r = n.ribassati[0]!;
    assert.equal(r.prezzoPrima, 200_000);
    assert.equal(r.prezzoDopo, 150_000);
    assert.equal(Math.round(r.calo * 100), 25);
  });

  test("il primo prezzo mai visto non e' un ribasso", () => {
    // e' l'inizio dell'osservazione, non un movimento: contarlo direbbe che un
    // venditore ha ceduto quando non ha fatto nulla
    salvaImmobiliDeduplicati([annuncio("b", 300_000)]);
    const n = novita(7);
    assert.equal(n.ribassati.length, 0);
    assert.equal(n.nuovi.length, 1);
  });

  test("un rincaro non viene contato fra i ribassi", () => {
    salvaImmobiliDeduplicati([annuncio("c", 100_000)]);
    invecchia("c", 10);
    salvaImmobiliDeduplicati([annuncio("c", 120_000)]);

    const n = novita(7);
    assert.equal(n.ribassati.length, 0);
    assert.equal(n.rincarati.length, 1);
    assert.equal(n.rincarati[0]!.prezzoDopo, 120_000);
  });

  test("i ribassi sono ordinati dal calo piu' grosso", () => {
    salvaImmobiliDeduplicati([annuncio("d", 100_000), annuncio("e", 100_000)]);
    invecchia("d", 10);
    invecchia("e", 10);
    salvaImmobiliDeduplicati([annuncio("d", 95_000), annuncio("e", 60_000)]);

    const n = novita(7);
    assert.equal(n.ribassati.length, 2);
    assert.equal(n.ribassati[0]!.immobile.id_esterno, "e", "il calo del 40% viene prima di quello del 5%");
  });

  test("fuori dalla finestra non si guarda", () => {
    salvaImmobiliDeduplicati([annuncio("f", 200_000)]);
    invecchia("f", 60);
    salvaImmobiliDeduplicati([annuncio("f", 150_000)]);
    // il ribasso e' di oggi, ma restringendo la finestra a zero giorni sparisce
    invecchia("f", 60);

    assert.equal(novita(7).ribassati.length, 0);
    assert.equal(novita(90).ribassati.length, 1);
  });

  test("un prezzo che non cambia non produce movimento", () => {
    salvaImmobiliDeduplicati([annuncio("g", 180_000)]);
    invecchia("g", 3);
    salvaImmobiliDeduplicati([annuncio("g", 180_000)]);

    const n = novita(7);
    assert.equal(n.ribassati.length, 0);
    assert.equal(n.rincarati.length, 0);
  });

  test("un immobile senza prezzo non inquina il digest", () => {
    // Reperform pubblica solo una valutazione, non un prezzo: quegli immobili
    // entrano senza prezzo e non devono comparire fra i movimenti
    salvaImmobiliDeduplicati([annuncio("h", null)]);
    const n = novita(7);
    assert.equal(n.ribassati.length, 0);
    assert.equal(n.rincarati.length, 0);
    assert.equal(n.nuovi.length, 1, "resta comunque una novita': e' appena entrato in radar");
  });

  test("la finestra e' riportata nell'esito, cosi' chi legge sa cosa sta guardando", () => {
    assert.equal(novita(30).giorni, 30);
  });
});
