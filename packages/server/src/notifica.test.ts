import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-notifica-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { salvaImmobiliDeduplicati, listAllRows, giaNotificati, segnaNotificati } = await import("./repository.js");
const { db } = await import("./db.js");
const { inviaDigest, parametriTemplate, ripulisci, TESTO_TEMPLATE_CONSIGLIATO } = await import("./notifica.js");

const AMBIENTE = {
  QDR_WHATSAPP_TOKEN: "tok",
  QDR_WHATSAPP_PHONE_ID: "123",
  QDR_WHATSAPP_A: "393401234567",
} as NodeJS.ProcessEnv;

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

function invecchia(idEsterno: string, giorni: number): void {
  const quando = new Date(Date.now() - giorni * 86_400_000).toISOString();
  const riga = listAllRows().find((r) => r.id_esterno === idEsterno)!;
  db.prepare("UPDATE immobili SET first_seen_at = ? WHERE id = ?").run(quando, riga.id);
  db.prepare("UPDATE storico_prezzi SET rilevato_il = ? WHERE immobile_id = ?").run(quando, riga.id);
}

/** Un ribasso vero nel DB: prezzo iniziale, tempo che passa, prezzo nuovo. */
function conRibasso(id: string, prima: number, dopo: number): void {
  salvaImmobiliDeduplicati([annuncio(id, prima)]);
  invecchia(id, 10);
  salvaImmobiliDeduplicati([annuncio(id, dopo)]);
}

let chiamate: { corpo: Record<string, unknown> }[] = [];
let risposta: () => Response;

function montaFetch(): void {
  globalThis.fetch = (async (_u: unknown, init: RequestInit) => {
    chiamate.push({ corpo: JSON.parse(String(init.body)) as Record<string, unknown> });
    return risposta();
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  db.exec("DELETE FROM storico_prezzi; DELETE FROM immobili; DELETE FROM notifiche_inviate;");
  chiamate = [];
  risposta = () => new Response(JSON.stringify({ messages: [{ id: "wamid.OK" }] }), { status: 200 });
  montaFetch();
});

describe("registro delle notifiche", () => {
  test("segna e ritrova, e non duplica se richiamato", () => {
    assert.equal(segnaNotificati(["a", "b"], "whatsapp"), 2);
    assert.equal(segnaNotificati(["a", "b"], "whatsapp"), 0, "la seconda volta non scrive niente");
    assert.deepEqual([...giaNotificati(["a", "b", "c"])].sort(), ["a", "b"]);
  });

  test("regge piu' chiavi del limite di parametri di SQLite", () => {
    const molte = Array.from({ length: 1500 }, (_, i) => `k${i}`);
    segnaNotificati(molte, "whatsapp");
    assert.equal(giaNotificati(molte).size, 1500);
  });

  test("un insieme vuoto non interroga il database", () => {
    assert.equal(giaNotificati([]).size, 0);
  });
});

describe("invio del digest", () => {
  test("il ribasso parte una volta, la seconda esecuzione non manda niente", async () => {
    // e' la ragione per cui il registro esiste: con una finestra di sette
    // giorni, senza registro lo stesso ribasso arriverebbe per sette mattine
    conRibasso("a", 200_000, 150_000);

    const primo = await inviaDigest({ giorni: 7, env: AMBIENTE });
    assert.equal(primo.inviato, true);
    assert.match(primo.messaggio, /-25%/);

    const secondo = await inviaDigest({ giorni: 7, env: AMBIENTE });
    assert.equal(secondo.inviato, false);
    assert.match(secondo.motivo!, /gia' stati notificati/);
    assert.equal(chiamate.length, 1, "nessuna seconda chiamata a Meta");
  });

  test("un secondo ribasso sullo stesso immobile riparte", async () => {
    conRibasso("b", 200_000, 150_000);
    await inviaDigest({ giorni: 7, env: AMBIENTE });

    invecchia("b", 5);
    salvaImmobiliDeduplicati([annuncio("b", 120_000)]);

    const esito = await inviaDigest({ giorni: 7, env: AMBIENTE });
    assert.equal(esito.inviato, true, "il calo successivo e' una notizia nuova");
    assert.match(esito.messaggio, /-20%/);
  });

  test("--rinvia ignora il registro", async () => {
    conRibasso("c", 100_000, 80_000);
    await inviaDigest({ giorni: 7, env: AMBIENTE });
    const esito = await inviaDigest({ giorni: 7, rinvia: true, env: AMBIENTE });
    assert.equal(esito.inviato, true);
    assert.equal(chiamate.length, 2);
  });

  test("se l'invio fallisce NON si segna niente: il ribasso dev'essere riproposto", async () => {
    // segnare prima dell'invio perderebbe per sempre un ribasso il cui
    // messaggio non e' partito. Un doppione si ignora, un silenzio no.
    conRibasso("d", 300_000, 200_000);
    risposta = () =>
      new Response(JSON.stringify({ error: { message: "Re-engagement message", code: 131047 } }), { status: 400 });

    const fallito = await inviaDigest({ giorni: 7, env: AMBIENTE });
    assert.equal(fallito.inviato, false);
    assert.match(fallito.errore!, /24 ore/);

    risposta = () => new Response(JSON.stringify({ messages: [{ id: "wamid.OK" }] }), { status: 200 });
    const riuscito = await inviaDigest({ giorni: 7, env: AMBIENTE });
    assert.equal(riuscito.inviato, true, "dopo un fallimento il movimento va riproposto");
  });

  test("--prova compone il messaggio senza inviarlo e senza segnarlo", async () => {
    conRibasso("e", 100_000, 70_000);
    const p = await inviaDigest({ giorni: 7, prova: true, env: AMBIENTE });
    assert.equal(p.inviato, false);
    assert.match(p.messaggio, /-30%/);
    assert.equal(chiamate.length, 0, "una prova non deve toccare la rete");

    const vero = await inviaDigest({ giorni: 7, env: AMBIENTE });
    assert.equal(vero.inviato, true, "la prova non deve aver consumato il movimento");
  });

  test("senza credenziali spiega cosa manca, e non segna niente", async () => {
    conRibasso("f", 100_000, 90_000);
    const esito = await inviaDigest({ giorni: 7, env: {} as NodeJS.ProcessEnv });
    assert.equal(esito.inviato, false);
    assert.match(esito.errore!, /QDR_WHATSAPP_TOKEN/);
    assert.equal(giaNotificati(["ribasso:1:x"]).size, 0);
  });

  test("niente di nuovo: nessuna chiamata a Meta, nessun messaggio a vuoto", async () => {
    const esito = await inviaDigest({ giorni: 7, env: AMBIENTE });
    assert.equal(esito.inviato, false);
    assert.match(esito.motivo!, /nessun movimento/);
    assert.equal(chiamate.length, 0);
  });

  test("con un template si manda un template, non testo libero", async () => {
    conRibasso("g", 500_000, 350_000);
    await inviaDigest({ giorni: 7, env: { ...AMBIENTE, QDR_WHATSAPP_TEMPLATE: "digest_qdr" } });
    const corpo = chiamate[0]!.corpo;
    assert.equal(corpo.type, "template");
    assert.equal((corpo.template as { name: string }).name, "digest_qdr");
  });
});

describe("parametri del template", () => {
  test("nessun parametro contiene a capo: Meta li rifiuterebbe", () => {
    // un solo \n dentro un parametro fa respingere l'intero messaggio, con un
    // errore che non dice quale parametro sia il colpevole
    const n = {
      giorni: 7,
      nuovi: [],
      rincarati: [],
      ribassati: [
        {
          immobile: { comune: "Cremona\nVia Tal", titolo: "Casa\tcon\ngiardino", id: 1 },
          prezzoPrima: 200_000,
          prezzoDopo: 150_000,
          calo: 0.25,
          quando: "2026-10-10T00:00:00.000Z",
        },
      ],
    } as unknown as Parameters<typeof parametriTemplate>[0];

    for (const p of parametriTemplate(n)) {
      assert.doesNotMatch(p, /[\r\n\t]/, `parametro con a capo: ${JSON.stringify(p)}`);
      assert.doesNotMatch(p, / {4,}/, "quattro spazi di fila sono rifiutati come un a capo");
    }
  });

  test("tanti parametri quanti segnaposto ha il template consigliato", () => {
    const segnaposto = new Set(TESTO_TEMPLATE_CONSIGLIATO.match(/\{\{\d+\}\}/g));
    const n = { giorni: 7, nuovi: [], rincarati: [], ribassati: [] } as unknown as Parameters<
      typeof parametriTemplate
    >[0];
    assert.equal(parametriTemplate(n).length, segnaposto.size);
  });

  test("ripulisci lascia intatto un testo gia' su riga singola", () => {
    assert.equal(ripulisci("Cremona - Appartamento"), "Cremona - Appartamento");
  });
});
