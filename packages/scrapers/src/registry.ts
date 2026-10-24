import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Registry } from "@qdr/core";

import { GenericScraper } from "./genericScraper.js";
import type { Scraper, SiteConfig } from "./types.js";

// dist/registry.js -> ../sites (le config JSON vivono alla radice del pacchetto, non sotto src/,
// cosi' non serve copiarle nella build)
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITES_DIR_PREDEFINITA = join(PACKAGE_ROOT, "sites");

/**
 * Cartella dei config dei siti. QDR_SITES_DIR la sostituisce: serve ai test per
 * restare isolati dalla rete (altrimenti ogni test che lancia "tutte le fonti
 * abilitate" scarica davvero i portali) e a chi vuole un insieme di fonti diverso.
 */
function sitesDir(): string {
  return process.env.QDR_SITES_DIR || SITES_DIR_PREDEFINITA;
}

/* I config cambiano solo quando si modificano i file in sites/: rileggerli e
 * riparsarli a ogni chiamata (getScraper, getFontiRegistry e l'endpoint /api/fonti
 * li chiedono piu' volte per singola esecuzione) e' lavoro sprecato. */
let cacheConfigs: SiteConfig[] | null = null;

/** Svuota la cache dei config: utile dopo aver modificato un file in sites/. */
export function invalidaCacheSiti(): void {
  cacheConfigs = null;
}

export async function loadSiteConfigs(): Promise<SiteConfig[]> {
  if (cacheConfigs) return cacheConfigs;

  const files = (await readdir(sitesDir())).filter((f) => f.endsWith(".json"));
  const configs: SiteConfig[] = [];
  for (const file of files) {
    const raw = await readFile(join(sitesDir(), file), "utf-8");
    const config = JSON.parse(raw) as SiteConfig;
    // fetchMode "file" punta a una fixture relativa alla radice del pacchetto,
    // non alla cwd del processo che importa @qdr/scrapers.
    if (config.fetchMode === "file") {
      config.searchUrl = join(PACKAGE_ROOT, config.searchUrl);
    }
    configs.push(config);
  }
  cacheConfigs = configs;
  return configs;
}

export async function getAllScrapers(includeDisabled = false): Promise<Scraper[]> {
  const configs = await loadSiteConfigs();
  return configs
    .filter((c) => c.enabled || includeDisabled)
    .map((c) => new GenericScraper(c));
}

export async function getScraper(name: string): Promise<Scraper | null> {
  const configs = await loadSiteConfigs();
  const config = configs.find((c) => c.name === name);
  return config ? new GenericScraper(config) : null;
}

/** Registry di priorita' per deduplica() di @qdr/core, derivato dai config dei siti. */
export async function getFontiRegistry(): Promise<Registry> {
  const configs = await loadSiteConfigs();
  const reg: Registry = {};
  for (const c of configs) reg[c.name] = { priorita: c.priorita };
  return reg;
}
