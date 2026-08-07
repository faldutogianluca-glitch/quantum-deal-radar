import { chiaveGeofisica, chiaveGiudiziaria, deduplica } from "@qdr/core";
import { getAllScrapers, getFontiRegistry, getScraper } from "@qdr/scrapers";
import type { ImmobileGrezzo } from "@qdr/scrapers";

import { listAllAsImmobileNorm, salvaImmobiliDeduplicati } from "./repository.js";

export interface EsitoFonte {
  fonte: string;
  trovati: number;
  errori: string[];
}

export interface EsitoPipeline {
  perFonte: EsitoFonte[];
  nuovi: number;
  aggiornati: number;
  /** righe duplicate dello stesso bene, fuse in una sola durante il salvataggio */
  assorbiti: number;
}

/**
 * Scrape -> dedup -> persist. Include sempre gli immobili gia' in DB nel pool
 * di deduplica(): e' cosi' che un annuncio pre-asta si aggancia da solo alla
 * stessa unita' quando ricompare con l'RGE in un ciclo successivo.
 */
export class FonteSconosciuta extends Error {
  constructor(nome: string, disponibili: string[]) {
    super(`Fonte "${nome}" inesistente. Disponibili: ${disponibili.join(", ")}`);
    this.name = "FonteSconosciuta";
  }
}

export async function eseguiPipeline(nomeFonte?: string): Promise<EsitoPipeline> {
  let scrapers;
  if (nomeFonte) {
    // Senza questo controllo un nome errato produceva zero scraper e la pipeline
    // terminava con "0 nuovi, 0 aggiornati" come se fosse andata a buon fine.
    const scraper = await getScraper(nomeFonte);
    if (!scraper) {
      const tutti = await getAllScrapers(true);
      throw new FonteSconosciuta(nomeFonte, tutti.map((s) => s.name));
    }
    scrapers = [scraper];
  } else {
    scrapers = await getAllScrapers();
  }

  const registry = await getFontiRegistry();
  const raccolti: ImmobileGrezzo[] = [];
  const perFonte: EsitoFonte[] = [];

  for (const scraper of scrapers) {
    const risultato = await scraper.scrape();
    raccolti.push(...risultato.items);
    perFonte.push({ fonte: scraper.name, trovati: risultato.items.length, errori: risultato.errors });
  }

  // Nel pool di deduplica() rientrano solo gli esistenti che core puo' effettivamente
  // fondere (hanno una chiave giudiziaria o geofisica): e' li' che serve, es. per
  // agganciare un pre-asta alla stessa unita' quando ricompare con l'RGE. Gli esistenti
  // senza chiave restano gia' identificati dalla loro chiave di storage (fonte+idEsterno)
  // e includerli qui li duplicherebbe nel pool a ogni ciclo senza che nessun merge li tocchi.
  const esistentiFondibili = listAllAsImmobileNorm().filter(
    (i) => chiaveGiudiziaria(i) !== null || chiaveGeofisica(i) !== null,
  );
  const deduplicati = deduplica([...esistentiFondibili, ...raccolti], registry) as ImmobileGrezzo[];

  const { nuovi, aggiornati, assorbiti } = salvaImmobiliDeduplicati(deduplicati);
  return { perFonte, nuovi, aggiornati, assorbiti };
}
