import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * La CLI non deve mai terminare in silenzio.
 *
 * Il guasto peggiore osservato non e' un errore: e' un comando che finisce
 * senza stampare niente, perche' chi lo lancia non sa se abbia funzionato, se
 * sia stato bloccato o se sia morto, e non ha nessun appiglio per capirlo.
 *
 * La causa sospettata e' documentata da Node: `process.stdout` e
 * `process.stderr` scrivono in modo sincrono o asincrono a seconda del sistema
 * e di cosa c'e' dall'altra parte. Verso una **pipe** — ed e' il caso ogni
 * volta che il comando gira dentro `npm run` — la scrittura e' sincrona su
 * POSIX ma **asincrona su Windows**. Li' `process.exit()` termina il processo
 * scartando quanto non e' ancora uscito.
 *
 * ATTENZIONE a cosa provano questi test: girano con gli stream reindirizzati,
 * quindi verificano che un messaggio ci sia sempre, ma **su Linux non possono
 * riprodurre la perdita**, perche' li' la scrittura su pipe e' gia' sincrona.
 * Rimettendo `console.error` + `process.exit()` questi test continuano infatti
 * a passare. Sono una rete contro l'uscita muta, non la dimostrazione della
 * causa: quella resta un'ipotesi fondata sul comportamento documentato di Node
 * e sull'unica piattaforma dove il guasto e' stato osservato.
 */

const CLI = join(dirname(fileURLToPath(import.meta.url)), "cli.js");

function esegui(args: string[]): Promise<{ codice: number; out: string }> {
  return new Promise((risolvi) => {
    // execFile cattura stdout e stderr in pipe: e' esattamente lo scenario
    // in cui l'output andava perso
    execFile(process.execPath, [CLI, ...args], { timeout: 30_000 }, (err, stdout, stderr) => {
      const codice = (err as NodeJS.ErrnoException & { code?: number })?.code ?? 0;
      risolvi({ codice: typeof codice === "number" ? codice : 1, out: stdout + stderr });
    });
  });
}

describe("la CLI non esce mai in silenzio", () => {
  test("un comando sconosciuto stampa l'uso, anche con stdout su pipe", async () => {
    const { codice, out } = await esegui(["comando-che-non-esiste"]);
    assert.notEqual(out.trim(), "", "uscita muta: e' il guasto che questo test esiste per impedire");
    assert.match(out, /Uso: node dist\/cli\.js/);
    assert.equal(codice, 1, "un comando sconosciuto deve fallire, non riuscire in silenzio");
  });

  test("cattura senza URL spiega come si usa, invece di terminare e basta", async () => {
    const { codice, out } = await esegui(["cattura"]);
    assert.notEqual(out.trim(), "", "uscita muta");
    assert.match(out, /Uso: node dist\/cli\.js cattura/);
    assert.equal(codice, 1);
  });

  test("ispeziona senza selettore nomina entrambe le forme, compresa la ricerca per testo", async () => {
    const { codice, out } = await esegui(["ispeziona", "un-file.html"]);
    assert.notEqual(out.trim(), "", "uscita muta");
    assert.match(out, /testo:<parola>/, "la ricerca per contenuto va documentata dove serve");
    assert.equal(codice, 1);
  });

  test("scrape di una fonte inesistente dice quale, invece di fallire senza motivo", async () => {
    const { codice, out } = await esegui(["scrape", "fonte-inventata"]);
    assert.notEqual(out.trim(), "", "uscita muta");
    assert.match(out, /fonte-inventata/);
    assert.equal(codice, 1);
  });
});
