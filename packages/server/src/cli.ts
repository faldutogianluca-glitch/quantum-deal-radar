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
      "Uso: node dist/cli.js <scrape [fonte] | enrich | serve | watch [minuti]>\n" +
        "  watch: rilancia lo scraping a intervalli regolari (default 360 min).\n" +
        "         QDR_WATCH_ENRICH=true aggiunge l'arricchimento a ogni ciclo.",
    );
    process.exit(1);
}
