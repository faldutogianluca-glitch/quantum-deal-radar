import { analizzaDuplicati, chiaveEdificio, chiaveGiudiziaria } from "@qdr/core";
import { getAllScrapers, getFontiRegistry, getScraper } from "@qdr/scrapers";
import type { ImmobileGrezzo } from "@qdr/scrapers";
import type { Registry } from "@qdr/core";

import { listAllAsImmobileNorm, salvaCandidati, salvaImmobiliDeduplicati } from "./repository.js";

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
  /** coppie simili ma non certe: non fuse, in attesa di verifica */
  candidati: number;
  /** gruppi di legami certi scartati perche' contengono identificativi incompatibili */
  ambigui: number;
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

  return integraImmobili(raccolti, registry, perFonte);
}

/**
 * Deduplica e salva immobili gia' raccolti. Separata dallo scraping perche' e' la parte che
 * decide l'identita' dei beni: si puo' provare con dati di test senza toccare la rete.
 */
export function integraImmobili(
  raccolti: ImmobileGrezzo[],
  registry: Registry,
  perFonte: EsitoFonte[] = [],
): EsitoPipeline {
  // Nel pool di analizzaDuplicati() entrano gli esistenti che hanno un elemento di confronto
  // (procedura giudiziaria o indirizzo): e' li' che serve per riconoscere lo stesso annuncio
  // riletto e per agganciare i record che ora hanno un identificativo in piu'.
  const esistentiFondibili = listAllAsImmobileNorm().filter(
    (i) => chiaveGiudiziaria(i) !== null || chiaveEdificio(i) !== null,
  );
  const analisi = analizzaDuplicati([...esistentiFondibili, ...raccolti], registry);
  const deduplicati = analisi.risultato as ImmobileGrezzo[];

  const { nuovi, aggiornati, assorbiti } = salvaImmobiliDeduplicati(deduplicati);
  salvaCandidati(analisi.candidati);
  return { perFonte, nuovi, aggiornati, assorbiti, candidati: analisi.candidati.length, ambigui: analisi.ambigui.length };
}
