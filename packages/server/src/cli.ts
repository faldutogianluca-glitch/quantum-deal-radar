import { eseguiEnrich } from "./enrich.js";
import { eseguiPipeline } from "./pipeline.js";
import { avviaServer } from "./index.js";

const comando = process.argv[2];
const fonte = process.argv[3];

switch (comando) {
  case "scrape": {
    const esito = await eseguiPipeline(fonte);
    for (const f of esito.perFonte) {
      console.log(`  ${f.fonte}: ${f.trovati} trovati${f.errori.length ? `, ${f.errori.length} errori` : ""}`);
      for (const e of f.errori) console.log(`    ! ${e}`);
    }
    console.log(`Totale: ${esito.nuovi} nuovi, ${esito.aggiornati} aggiornati.`);
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
  default:
    console.log("Uso: node dist/cli.js <scrape [fonte]|enrich|serve>");
    process.exit(1);
}
