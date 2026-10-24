import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  chiaveNuovo,
  chiaveRibasso,
  chiaviDi,
  componiMessaggio,
  filtraNovita,
} from "./digest.js";
import type { ImmobileRow, Novita, Ribasso } from "./repository.js";

function riga(id: number, extra: Partial<ImmobileRow> = {}): ImmobileRow {
  return {
    id,
    chiave_dedup: `k${id}`,
    fonte: "test",
    id_esterno: `e${id}`,
    url: `https://esempio.invalid/${id}`,
    titolo: `Appartamento ${id}`,
    comune: "Cremona",
    prezzo: 100_000,
    first_seen_at: "2026-10-01T00:00:00.000Z",
    scraped_at: "2026-10-01T00:00:00.000Z",
  } as unknown as ImmobileRow;
}

function ribasso(id: number, prima: number, dopo: number, quando = "2026-10-10T08:00:00.000Z"): Ribasso {
  return { immobile: riga(id), prezzoPrima: prima, prezzoDopo: dopo, calo: (prima - dopo) / prima, quando };
}

const vuoto: Novita = { giorni: 7, nuovi: [], ribassati: [], rincarati: [] };

describe("chiavi di notifica", () => {
  test("un secondo ribasso sullo stesso immobile ha una chiave diversa", () => {
    // e' la proprieta' che conta: il primo calo e' gia' stato annunciato, ma
    // il secondo e' una notizia nuova e deve poter ripartire
    const a = chiaveRibasso(ribasso(1, 200_000, 150_000, "2026-10-01T00:00:00.000Z"));
    const b = chiaveRibasso(ribasso(1, 150_000, 120_000, "2026-10-09T00:00:00.000Z"));
    assert.notEqual(a, b);
  });

  test("lo stesso ribasso produce sempre la stessa chiave", () => {
    assert.equal(chiaveRibasso(ribasso(4, 300_000, 200_000)), chiaveRibasso(ribasso(4, 300_000, 200_000)));
  });

  test("un immobile nuovo e' identificato senza data: entra in radar una volta sola", () => {
    assert.equal(chiaveNuovo(riga(7)), "nuovo:7");
  });
});

describe("filtro di cio' che e' gia' stato mandato", () => {
  test("toglie il ribasso gia' notificato e lascia l'altro", () => {
    const n: Novita = {
      giorni: 7,
      nuovi: [riga(10)],
      ribassati: [ribasso(1, 200_000, 150_000), ribasso(2, 100_000, 90_000)],
      rincarati: [],
    };
    const visti = new Set([chiaveRibasso(n.ribassati[0]!)]);
    const resto = filtraNovita(n, visti);
    assert.equal(resto.ribassati.length, 1);
    assert.equal(resto.ribassati[0]!.immobile.id, 2);
    assert.equal(resto.nuovi.length, 1, "il filtro sui ribassi non deve toccare i nuovi");
  });

  test("chiaviDi copre tutte e tre le categorie", () => {
    const n: Novita = { giorni: 7, nuovi: [riga(1)], ribassati: [ribasso(2, 10, 5)], rincarati: [ribasso(3, 5, 10)] };
    assert.equal(chiaviDi(n).length, 3);
    assert.equal(new Set(chiaviDi(n)).size, 3, "le chiavi delle tre categorie non devono collidere");
  });
});

describe("composizione del messaggio", () => {
  test("senza movimenti lo dice, invece di mandare un messaggio vuoto", () => {
    assert.match(componiMessaggio(vuoto), /nessun movimento negli ultimi 7 giorni/);
  });

  test("il ribasso porta percentuale, prezzi e link", () => {
    const m = componiMessaggio({ ...vuoto, ribassati: [ribasso(1, 200_000, 150_000)] });
    assert.match(m, /-25%/);
    assert.match(m, /https:\/\/esempio\.invalid\/1/);
    assert.match(m, /RIBASSATI/);
  });

  test("i rincari sono ridotti a un conteggio, non elencati", () => {
    // su un telefono il dettaglio di un rincaro e' rumore: allontana dalla
    // prima riga cio' su cui bisogna muoversi
    const m = componiMessaggio({ ...vuoto, rincarati: [ribasso(9, 100_000, 120_000)] });
    assert.match(m, /1 rincarati/);
    assert.doesNotMatch(m, /esempio\.invalid\/9/);
  });

  test("resta sotto il limite e dice quante voci ha lasciato fuori", () => {
    const molti = Array.from({ length: 200 }, (_, i) => ribasso(i + 1, 200_000, 150_000));
    const m = componiMessaggio({ ...vuoto, ribassati: molti });
    assert.ok(m.length <= 4096, `messaggio di ${m.length} caratteri: WhatsApp lo rifiuterebbe`);
    assert.match(m, /e altri \d+: apri la dashboard/);
  });

  test("il taglio cade fra due voci, mai dentro un link", () => {
    const molti = Array.from({ length: 200 }, (_, i) => ribasso(i + 1, 200_000, 150_000));
    const m = componiMessaggio({ ...vuoto, ribassati: molti });
    for (const url of m.match(/https:\/\/esempio\.invalid\/\d+/g) ?? []) {
      assert.match(url, /^https:\/\/esempio\.invalid\/\d+$/, "un URL troncato e' inservibile");
    }
    // nessuna voce deve finire a meta': ogni blocco ribasso ha tre righe
    assert.ok(!m.endsWith("→"), "messaggio interrotto dentro un blocco");
  });

  test("il conteggio degli omessi e' esatto", () => {
    const molti = Array.from({ length: 40 }, (_, i) => ribasso(i + 1, 200_000, 150_000));
    const m = componiMessaggio({ ...vuoto, ribassati: molti });
    const mostrati = (m.match(/https:\/\/esempio\.invalid\/\d+/g) ?? []).length;
    const dichiarati = Number(/e altri (\d+):/.exec(m)?.[1] ?? 0);
    assert.equal(mostrati + dichiarati, 40, "mostrati + omessi deve dare il totale");
  });

  test("una sezione non compare col titolo se non ci sta nemmeno una voce", () => {
    // un titolo "NUOVI (12)" senza nessuna voce sotto farebbe credere a un guasto
    const molti = Array.from({ length: 200 }, (_, i) => ribasso(i + 1, 200_000, 150_000));
    const m = componiMessaggio({ ...vuoto, ribassati: molti, nuovi: [riga(999)] });
    if (m.includes("NUOVI")) assert.match(m, /esempio\.invalid|prezzo non pubblicato|€/);
  });
});

describe("sotto valore OMI", () => {
  test("i nuovi con uno sconto calcolato stanno in cima, col valore e la fonte", () => {
    const n: Novita = {
      ...vuoto,
      // riga() non applica gli extra: i campi della valutazione si impostano a mano
      nuovi: [
        riga(1),
        Object.assign(riga(2), { prezzo: 108_000, valore_centrale: 164_992, sconto_su_valore: 0.35, praticabile: 1, comune: "Roma" }),
        Object.assign(riga(3), { prezzo: 90_000, valore_centrale: 100_000, sconto_su_valore: 0.1, praticabile: 1 }),
        Object.assign(riga(4), { prezzo: 50_000, valore_centrale: 100_000, sconto_su_valore: 0.5, praticabile: 0 }),
      ],
    };
    const m = componiMessaggio(n);
    assert.match(m, /SOTTO VALORE OMI\* \(1\)/);
    assert.ok(m.indexOf("SOTTO VALORE OMI") < m.indexOf("NUOVI"), "la sezione viene prima dei nuovi");
    assert.match(m, /\*-35%\*  108\.000\s?€ · valore OMI 164\.992\s?€/);
    assert.match(m, /NUOVI\* \(3\)/, "chi e' sotto valore non viene ripetuto fra i nuovi");
    assert.match(m, /Agenzia delle Entrate - OMI/);
  });
});
