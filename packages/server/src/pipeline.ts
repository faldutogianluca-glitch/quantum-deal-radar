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
}

/**
 * Scrape -> dedup -> persist. Include sempre gli immobili gia' in DB nel pool
 * di deduplica(): e' cosi' che un annuncio pre-asta si aggancia da solo alla
 * stessa unita' quando ricompare con l'RGE in un ciclo successivo.
 */
export async function eseguiPipeline(nomeFonte?: string): Promise<EsitoPipeline> {
  const scrapers = nomeFonte
    ? [await getScraper(nomeFonte)].filter((s): s is NonNullable<typeof s> => s !== null)
    : await getAllScrapers();

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

  const { nuovi, aggiornati } = salvaImmobiliDeduplicati(deduplicati);
  return { perFonte, nuovi, aggiornati };
}
