import { writeSync } from "node:fs";

import {
  catturaPagina,
  cercaTesto,
  daDecidere,
  ispezionaRobots,
  ispezionaSchede,
  sospettoBloccoDiRete,
  verdetto,
  verificaTutteLeFonti,
} from "@qdr/scrapers";

import { eseguiEnrich } from "./enrich.js";
import { eseguiPipeline } from "./pipeline.js";
import { avviaScheduler } from "./scheduler.js";
import { avviaServer } from "./index.js";

/*
 * Rete di sicurezza contro l'uscita muta.
 *
 * Un comando che termina senza stampare niente e' il peggior esito possibile:
 * chi lo lancia non sa se ha funzionato, se e' stato bloccato o se e' morto.
 *
 * La scrittura e' sincrona di proposito. Node documenta che `process.stderr`
 * scrive verso una pipe in modo sincrono su POSIX ma **asincrono su Windows**,
 * e una pipe e' proprio cio' che si ottiene facendo girare il comando dentro
 * `npm run`. La', `process.exit()` termina il processo *scartando* quanto non
 * e' ancora uscito: un errore che c'e' stato e di cui non resta traccia.
 *
 * `writeSync` non ha questa ambiguita' su nessuna piattaforma. Va detto che il
 * guasto non e' stato riprodotto in laboratorio — su Linux non si manifesta —
 * quindi questa e' una difesa fondata sul comportamento documentato, non una
 * diagnosi confermata.
 */
function moriConMessaggio(testo: string): never {
  writeSync(2, testo.endsWith("\n") ? testo : testo + "\n");
  process.exit(1);
}

process.on("uncaughtException", (err) => {
  moriConMessaggio(`\nErrore non gestito: ${err.message}\n${err.stack ?? ""}`);
});
process.on("unhandledRejection", (motivo) => {
  const dettaglio = motivo instanceof Error ? `${motivo.message}\n${motivo.stack ?? ""}` : String(motivo);
  moriConMessaggio(`\nOperazione fallita senza essere intercettata: ${dettaglio}`);
});

const comando = process.argv[2];
const fonte = process.argv[3];

switch (comando) {
  case "scrape": {
    let esito;
    try {
      esito = await eseguiPipeline(fonte);
    } catch (err) {
      moriConMessaggio((err as Error).message);
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
    // Senza URL si verificano tutte le fonti configurate: controllarle a una a
    // una e' un lavoro che si interrompe a meta' e va rifatto da capo.
    if (!fonte) {
      console.log("Verifica di robots.txt su tutte le fonti configurate.");
      console.log("Le richieste sono distanziate: ci vuole qualche minuto.\n");
      const righe = await verificaTutteLeFonti();

      const larghezza = Math.max(...righe.map((r) => r.fonte.length));
      console.log(`${"FONTE".padEnd(larghezza)}  ${"ROBOTS.TXT".padEnd(18)}  ${"STATO NEL CONFIG".padEnd(16)}  URL`);
      for (const r of righe) {
        const delay = r.crawlDelay !== undefined ? ` (crawl-delay ${r.crawlDelay}s)` : "";
        console.log(
          `${r.fonte.padEnd(larghezza)}  ${verdetto(r).padEnd(18)}  ` +
            `${r.statoDichiarato.padEnd(16)}  ${r.url}${delay}`,
        );
        if (r.errore) console.log(`${" ".repeat(larghezza)}  ! ${r.errore}`);
      }

      if (sospettoBloccoDiRete(righe)) {
        console.log(
          "\nATTENZIONE: quasi tutte le fonti risultano negate o irraggiungibili.\n" +
            "Che venti portali diversi siano ostili nello stesso momento e' poco credibile:\n" +
            "molto piu' probabile un proxy aziendale, una VPN o un DNS che filtra. Questa\n" +
            "tabella non e' un verdetto sui siti finche' non la rilanci da una rete pulita.",
        );
      }

      const aperte = daDecidere(righe);
      if (aperte.length > 0) {
        console.log(
          `\n${aperte.length === 1 ? "Una fonte" : `${aperte.length} fonti`} ` +
            `robots.txt non le vieta, ma nel config sono ancora "da_verificare":`,
        );
        for (const r of aperte) console.log(`  ${r.fonte}  ${r.url}`);
        console.log(
          "\nPer ognuna resta da leggere le condizioni d'uso. Fatto questo, il passaggio\n" +
            'a "consentito" va scritto a mano nel config: e\' una decisione tua, e finche\'\n' +
            "non c'e' lo scraper si rifiuta di partire.",
        );
      }

      const vietate = righe.filter((r) => r.esito === "regole_lette" && !r.consentito);
      if (vietate.length > 0) {
        console.log("\nVIETATE da robots.txt — su queste non si procede:");
        for (const r of vietate) console.log(`  ${r.fonte}  ${r.url}`);
      }

      const mancanti = righe.filter((r) => r.esito === null);
      if (mancanti.length > 0) {
        console.log("\nURL ancora da fornire (segnaposto nel config):");
        for (const r of mancanti) console.log(`  ${r.fonte}  ${r.displayName}`);
      }

      console.log(
        "\nPer il dettaglio di una singola fonte, col robots.txt integrale:\n" +
          "  npm run verifica -- <url>",
      );
      break;
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
      moriConMessaggio(
        "Uso: node dist/cli.js cattura <url> [file-di-uscita] [--accetta-cookie]\n" +
          "  --accetta-cookie: accetta TUTTI i cookie invece di rifiutare i facoltativi.\n" +
          "                    Serve sui portali che non mostrano nulla senza consenso.",
      );
    }
    // Il consenso pieno ai cookie si chiede a ogni invocazione, mai per default:
    // cosi' resta scritto nel comando che cosa e' stato accettato, e non diventa
    // un comportamento implicito che nessuno ricorda di avere scelto.
    const accettaCookie = process.argv.includes("--accetta-cookie");
    const posizionali = process.argv.slice(3).filter((a) => !a.startsWith("--"));
    const destinazione = posizionali[1] ?? "pagina-catturata.html";

    // Una riga subito, prima di qualunque attesa: se il comando muore piu' avanti
    // si sa almeno che era partito, invece di restare davanti a un terminale muto.
    console.log(`Apro ${fonte} con Chromium. Fra attesa del DOM e scorrimento ci vuole circa un minuto.`);
    if (accettaCookie) {
      console.log("Consenso cookie: ACCETTO TUTTO, come richiesto con --accetta-cookie.");
    }
    let esito;
    try {
      esito = await catturaPagina(fonte, {
        modo: "browser",
        consenso: accettaCookie ? "accetta" : "rifiuta",
        onProgresso: (m) => console.log(`  ... ${m}`),
      });
    } catch (err) {
      // un messaggio con istruzioni vale piu' di uno stack trace
      moriConMessaggio(`\nCattura non riuscita:\n${(err as Error).message}`);
    }
    const { writeFile } = await import("node:fs/promises");
    await writeFile(destinazione, esito.html, "utf-8");

    console.log(`Titolo pagina: ${esito.titolo ?? "(assente)"}`);
    console.log(`HTML salvato in: ${destinazione} (${Math.round(esito.html.length / 1024)} KB)`);

    switch (esito.consenso.tipo) {
      case "rifiutato":
        console.log(
          `Banner cookie: chiuso rifiutando i facoltativi (${esito.consenso.selettore}).`,
        );
        break;
      case "accettato":
        console.log(
          `Banner cookie: chiuso ACCETTANDO tutti i cookie (${esito.consenso.selettore}).`,
        );
        break;
      case "irrisolto":
        console.log(`\nBanner cookie NON risolto: ${esito.consenso.dettaglio}`);
        console.log(
          "Molti portali non montano la lista finche' il banner e' aperto: e' la spiegazione\n" +
            "piu' probabile se qui sotto non compaiono le schede. Apri la pagina nel browser,\n" +
            "scegli tu cosa accettare, e dimmi che pulsanti offre il banner.",
        );
        break;
      case "assente":
        break;
    }
    if (esito.candidati.length === 0) {
      console.log("\nNessun blocco ripetuto riconosciuto. Le cause tipiche, in ordine:");
      console.log("  1. l'URL e' una pagina vetrina, non un elenco di risultati: prova un");
      console.log("     percorso di ricerca vero, o un deep-link (es. .../<comune>);");
      console.log("  2. i risultati compaiono solo dopo aver inviato una ricerca dal form;");
      console.log("  3. il portale li carica in un modo che la cattura non ha intercettato.");
      console.log("Apri il file salvato e cerca il titolo di un immobile che vedi nel browser:");
      console.log("se non c'e', il problema e' il caricamento; se c'e', il problema e' l'euristica.");
    } else {
      console.log("\nBlocchi ripetuti, candidati per listSelector (dal piu' probabile):");
      console.log("(ordinati per varieta' del contenuto: un elenco di annunci ha testi tutti diversi,");
      console.log(" un menu ripete sempre lo stesso testo)");
      for (const c of esito.candidati) {
        console.log(
          `  ${c.selettore.padEnd(30)} x${String(c.occorrenze).padEnd(4)} ` +
            `(${c.conLink} con link, ${c.testiDistinti} testi distinti)`,
        );
        console.log(`  ${" ".repeat(30)} "${c.anteprima}"`);
      }

      // Il candidato in testa e' quasi sempre quello giusto: ispezionarlo subito
      // evita di dover rilanciare `ispeziona` a mano per vedere i campi. Se non
      // e' quello giusto si rilancia scegliendone un altro dall'elenco sopra.
      const primo = esito.candidati[0]!;
      const dettaglio = ispezionaSchede(esito.html, primo.selettore);
      console.log(`\n--- Campi dentro ${primo.selettore} (${dettaglio.occorrenze} schede) ---`);
      for (const c of dettaglio.campi.slice(0, 20)) {
        console.log(`  ${c.selettore.padEnd(32)} ${String(c.presenteIn).padStart(3)}/${dettaglio.occorrenze}`);
        for (const e of c.esempi.slice(0, 2)) console.log(`  ${" ".repeat(32)} "${e}"`);
      }
      console.log("\nCollegamenti e immagini:");
      for (const c of dettaglio.collegamenti) {
        console.log(`  ${c.selettore.padEnd(32)} ${String(c.presenteIn).padStart(3)}/${dettaglio.occorrenze}`);
        for (const e of c.esempi.slice(0, 2)) console.log(`  ${" ".repeat(32)} "${e}"`);
      }
      console.log(`\n--- HTML della prima scheda ---\n${dettaglio.primoElemento.slice(0, 2500)}`);
    }
    break;
  }
  case "ispeziona": {
    const selettore = process.argv[4];
    if (!fonte || !selettore) {
      moriConMessaggio(
        'Uso: node dist/cli.js ispeziona <file-html> "<selettore-scheda>"\n' +
          '     node dist/cli.js ispeziona <file-html> "testo:<parola>"  (cerca dove finisce quel testo)',
      );
    }
    const { readFile } = await import("node:fs/promises");
    const html = await readFile(fonte, "utf-8");

    // Ricerca per contenuto: la via d'uscita quando nessun selettore proposto
    // corrisponde alle schede che si vedono nel browser.
    if (selettore.startsWith("testo:")) {
      const parola = selettore.slice("testo:".length);
      const esiti = cercaTesto(html, parola);
      if (esiti.length === 0) {
        console.log(`"${parola}" non compare nell'HTML salvato.`);
        console.log("Vuol dire che la cattura non ha preso i risultati: il contenuto arriva");
        console.log("dopo un'interazione (form di ricerca, consenso ai cookie) oppure da una");
        console.log("chiamata che il browser fa e la cattura non attende.");
        break;
      }
      const punti = esiti.length === 1 ? "1 punto" : `${esiti.length} punti`;
      console.log(`"${parola}" trovato in ${punti}. Contenitori, dal piu' interno:`);
      for (const e of esiti) {
        console.log(`\n  testo: "${e.testo}"`);
        for (const [i, a] of e.catena.entries()) {
          const classi = a.classi.length
            ? a.classi.map((c) => `${c.selettore} (x${c.occorrenzeInPagina})`).join("  ")
            : "(senza classe)";
          console.log(`    ${"  ".repeat(i)}<${a.tag}> ${classi}`);
        }
      }
      console.log("\nIl listSelector e' la classe il cui conteggio somiglia al numero di");
      console.log("annunci che vedi nella pagina.");
      break;
    }

    const r = ispezionaSchede(html, selettore);

    console.log(`Schede trovate con "${selettore}": ${r.occorrenze}`);
    if (r.occorrenze === 0) {
      console.log("Nessuna corrispondenza: prova un altro selettore fra quelli proposti da 'cattura'.");
      break;
    }
    console.log(`\nCampi interni (presenti in N schede su ${r.occorrenze}):`);
    for (const c of r.campi) {
      console.log(`  ${c.selettore.padEnd(32)} ${String(c.presenteIn).padStart(3)}/${r.occorrenze}`);
      for (const e of c.esempi) console.log(`  ${" ".repeat(32)} "${e}"`);
    }
    console.log("\nCollegamenti e immagini:");
    for (const c of r.collegamenti) {
      console.log(`  ${c.selettore.padEnd(32)} ${String(c.presenteIn).padStart(3)}/${r.occorrenze}`);
      for (const e of c.esempi) console.log(`  ${" ".repeat(32)} "${e}"`);
    }
    console.log("\n--- HTML della prima scheda ---");
    console.log(r.primoElemento.slice(0, 3000));
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
    moriConMessaggio(
      "Uso: node dist/cli.js <scrape [fonte] | enrich | serve | watch [minuti] | verifica [url] | cattura <url> [file] | ispeziona <file> <sel>>\n" +
        "  watch: rilancia lo scraping a intervalli regolari (default 360 min).\n" +
        "         QDR_WATCH_ENRICH=true aggiunge l'arricchimento a ogni ciclo.\n" +
        "  verifica: senza argomenti controlla il robots.txt di tutte le fonti configurate;\n" +
        "            con un url ne mostra il dettaglio, robots.txt integrale compreso.\n" +
        "  cattura:  salva l'HTML di una pagina e propone i selettori delle schede. Chiude il\n" +
        "            banner cookie rifiutando i facoltativi; --accetta-cookie accetta tutto.\n" +
        "  ispeziona: elenca i campi dentro una scheda. Con \"testo:<parola>\" cerca invece\n" +
        "             dove finisce un testo che vedi nel browser e mostra i suoi contenitori.",
    );
}
