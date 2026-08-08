import { catturaPagina, ispezionaRobots } from "@qdr/scrapers";

import { eseguiEnrich } from "./enrich.js";
import { eseguiPipeline } from "./pipeline.js";
import { avviaScheduler } from "./scheduler.js";
import { avviaServer } from "./index.js";

const comando = process.argv[2];
const fonte = process.argv[3];

switch (comando) {
  case "scrape": {
    let esito;
    try {
      esito = await eseguiPipeline(fonte);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
    for (const f of esito.perFonte) {
      console.log(`  ${f.fonte}: ${f.trovati} trovati${f.errori.length ? `, ${f.errori.length} errori` : ""}`);
      for (const e of f.errori) console.log(`    ! ${e}`);
    }
    const assorbiti = esito.assorbiti ? `, ${esito.assorbiti} duplicati fusi` : "";
    console.log(`Totale: ${esito.nuovi} nuovi, ${esito.aggiornati} aggiornati${assorbiti}.`);
    break;
  }
  case "enrich": {
    const esito = await eseguiEnrich();
    if (!esito.eseguito) {
      console.log(esito.motivo);
      break;
    }
    console.log(`Zone OMI caricate: ${esito.zoneCaricate} (scartate: ${esito.zoneScartate})`);
    console.log(`Immobili geocodificati: ${esito.immobiliGeocodificati}`);
    if (esito.valutazioneSaltata) console.log(esito.valutazioneSaltata);
    else console.log(`Immobili valutati: ${esito.immobiliValutati}`);
    break;
  }
  case "serve": {
    avviaServer(Number(process.env.PORT) || 3000);
    break;
  }
  case "verifica": {
    if (!fonte) {
      console.error("Uso: node dist/cli.js verifica <url-della-pagina-risultati>");
      process.exit(1);
    }
    const e = await ispezionaRobots(fonte);
    console.log(`Origine:    ${e.origine}`);
    console.log(`robots.txt: ${e.stato === null ? `irraggiungibile (${e.errore})` : `HTTP ${e.stato}`}`);
    if (e.crawlDelay !== undefined) console.log(`Crawl-delay dichiarato: ${e.crawlDelay}s`);
    console.log(`Regole applicabili al nostro User-Agent:`);
    console.log(`  Disallow: ${e.regoleApplicate.disallow.join(", ") || "(nessuna)"}`);
    console.log(`  Allow:    ${e.regoleApplicate.allow.join(", ") || "(nessuna)"}`);
    // Le risposte non-200 non si equivalgono: un 404 e' una risposta definitiva
    // (il sito non pubblica regole), un 403 e' ambiguo, un 5xx per lo standard
    // vale come divieto. Appiattirle su un unico messaggio nasconde informazione
    // proprio a chi deve decidere.
    const dove = `Esito per ${fonte}: `;
    switch (e.esito) {
      case "regole_lette":
        console.log(`\n${dove}${e.consentito ? "CONSENTITO da robots.txt" : "VIETATO da robots.txt"}`);
        break;
      case "assente":
        console.log(
          `\n${dove}NESSUNA RESTRIZIONE DICHIARATA — il sito non pubblica un robots.txt ` +
            `(HTTP ${e.stato}).\nE' una risposta definitiva, non un errore: non essendoci direttive, ` +
            `robots.txt\nnon pone limiti. Restano da valutare le condizioni d'uso.`,
        );
        break;
      case "accesso_negato":
        console.log(
          `\n${dove}IMPOSSIBILE VERIFICARE — l'accesso a robots.txt e' negato (HTTP ${e.stato}).\n` +
            `Un sito che rifiuta il proprio robots.txt di solito respinge le richieste non-browser:\n` +
            `spesso indica che la raccolta automatica non e' gradita. Aprilo a mano dal browser\n` +
            `prima di decidere.`,
        );
        break;
      case "errore_server":
        console.log(
          `\n${dove}NON PROCEDERE PER ORA — il server ha risposto con un errore (HTTP ${e.stato}).\n` +
            `Lo standard prescrive di astenersi finche' il sito non torna disponibile: insistere\n` +
            `significherebbe caricare un server gia' in difficolta'. Riprova piu' tardi.`,
        );
        break;
      case "irraggiungibile":
        console.log(
          `\n${dove}IMPOSSIBILE VERIFICARE — robots.txt irraggiungibile (${e.errore ?? "causa ignota"}).\n` +
            `Puo' essere la tua rete, un proxy o un blocco del sito. Riprova, oppure aprilo a mano.`,
        );
        break;
    }
    if (e.testo) {
      console.log(`\n--- robots.txt integrale ---\n${e.testo.trim()}\n--- fine ---`);
    }
    console.log(
      `\nAttenzione: robots.txt non esaurisce la questione. Leggi anche le condizioni\n` +
        `d'uso del sito: possono vietare la raccolta automatica anche dove robots.txt tace.`,
    );
    break;
  }
  case "cattura": {
    if (!fonte) {
      console.error('Uso: node dist/cli.js cattura <url> [file-di-uscita]');
      process.exit(1);
    }
    const destinazione = process.argv[4] ?? "pagina-catturata.html";
    let esito;
    try {
      esito = await catturaPagina(fonte, { modo: "browser" });
    } catch (err) {
      // un messaggio con istruzioni vale piu' di uno stack trace
      console.error(`\nCattura non riuscita:\n${(err as Error).message}`);
      process.exit(1);
    }
    const { writeFile } = await import("node:fs/promises");
    await writeFile(destinazione, esito.html, "utf-8");

    console.log(`Titolo pagina: ${esito.titolo ?? "(assente)"}`);
    console.log(`HTML salvato in: ${destinazione} (${Math.round(esito.html.length / 1024)} KB)`);
    if (esito.candidati.length === 0) {
      console.log("\nNessun blocco ripetuto riconosciuto: la pagina potrebbe non aver caricato i");
      console.log("risultati, oppure usarne una struttura inconsueta. Apri il file e guardalo.");
    } else {
      console.log("\nBlocchi ripetuti, candidati per listSelector (dal piu' probabile):");
      for (const c of esito.candidati) {
        console.log(`  ${c.selettore.padEnd(30)} x${String(c.occorrenze).padEnd(4)} (${c.conLink} con link)`);
        console.log(`  ${" ".repeat(30)} "${c.anteprima}"`);
      }
    }
    break;
  }
  case "watch": {
    // esecuzione periodica in primo piano: si ferma con Ctrl-C
    const minuti = Number(fonte) || Number(process.env.QDR_INTERVALLO_MINUTI) || 360;
    const scheduler = avviaScheduler({
      intervalloMinuti: minuti,
      conEnrich: process.env.QDR_WATCH_ENRICH === "true",
      subito: true,
    });
    const arresto = async () => {
      console.log("\narresto in corso: attendo la fine del ciclo corrente...");
      scheduler.ferma();
      await scheduler.attendiCicloCorrente();
      process.exit(0);
    };
    process.on("SIGINT", arresto);
    process.on("SIGTERM", arresto);
    // mantiene vivo il processo: il timer dello scheduler e' unref'd
    setInterval(() => {}, 1 << 30);
    break;
  }
  default:
    console.log(
      "Uso: node dist/cli.js <scrape [fonte] | enrich | serve | watch [minuti] | verifica <url> | cattura <url> [file]>\n" +
        "  watch: rilancia lo scraping a intervalli regolari (default 360 min).\n" +
        "         QDR_WATCH_ENRICH=true aggiunge l'arricchimento a ogni ciclo.\n" +
        "  verifica: legge il robots.txt di un sito e dice se il percorso e' consentito.\n" +
        "  cattura:  salva l'HTML di una pagina e propone i selettori delle schede.",
    );
    process.exit(1);
}
