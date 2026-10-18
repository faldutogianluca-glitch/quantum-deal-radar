import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-dettaglio-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { salvaImmobiliDeduplicati, listAllRows } = await import("./repository.js");

/*
 * Il connettore del PVP apre il dettaglio (RGE, termine offerte, aste
 * precedenti) solo per una parte dei lotti, entro un tetto per esecuzione.
 * Un'esecuzione che non lo riapre, o in cui il servizio e' giu', non deve
 * cancellare cio' che quella precedente aveva letto.
 */
const lotto = (conDettaglio: boolean) => ({
  fonte: "pvp", idEsterno: "4644188", titolo: "Appartamento al piano settimo", comune: "Milano",
  tribunale: "Tribunale di MILANO", numeroLotto: "1", mq: 240, prezzo: 851000, tipoPrezzo: "base_asta" as const,
  dataAsta: "2027-01-14",
  ...(conDettaglio
    ? { numeroRge: 138, annoRge: 2024, termineOfferte: "2027-01-13", tipoVendita: "Senza Incanto", nEsperimentiDeserti: 2 }
    : {}),
});

test("un'esecuzione senza dettaglio conserva RGE, termine, tipo di vendita e aste deserte", () => {
  salvaImmobiliDeduplicati([lotto(true)]);
  salvaImmobiliDeduplicati([lotto(false)]);
  const righe = listAllRows().filter((r) => r.id_esterno === "4644188");
  assert.equal(righe.length, 1, "resta una riga sola");
  const r = righe[0]!;
  assert.equal(r.numero_rge, 138);
  assert.equal(r.anno_rge, 2024);
  assert.equal(r.termine_offerte, "2027-01-13");
  assert.equal(r.tipo_vendita, "Senza Incanto");
  assert.equal(r.n_esperimenti_deserti, 2);
});

test("un dettaglio nuovo aggiorna i valori", () => {
  salvaImmobiliDeduplicati([{ ...lotto(true), termineOfferte: "2027-02-01", nEsperimentiDeserti: 3 }]);
  const r = listAllRows().find((x) => x.id_esterno === "4644188")!;
  assert.equal(r.termine_offerte, "2027-02-01");
  assert.equal(r.n_esperimenti_deserti, 3);
});
