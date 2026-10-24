import { readFile } from "node:fs/promises";

import { parseDataIt, parseImporto, tipoPrezzoValido } from "./parsing.js";
import { consentito, USER_AGENT } from "./robots.js";
import type { ImmobileGrezzo, JsonConfig, SiteConfig } from "./types.js";

/**
 * Lettura di un'API JSON.
 *
 * Alcuni portali sono applicazioni a pagina singola: il DOM e' un guscio e i
 * dati arrivano da un'API pubblica che il browser interroga. Leggere l'API e'
 * piu' stabile (non cambia a ogni ritocco grafico) e molto piu' leggero (una
 * risposta invece di un browser). La configurazione dice solo dove stanno i
 * campi: nessun codice per fonte.
 */

/** Contesto in cui si risolvono i percorsi dei campi. */
export interface ContestoJson {
  elenco: unknown;
  dettaglio?: unknown;
}

const CAMPI_TESTO = [
  "titolo", "url", "idEsterno", "immagineUrl", "comune", "indirizzoRaw",
  "sottotipoAsset", "tipoVendita", "tribunale", "numeroLotto",
] as const;

/** Segue un percorso puntato ("annuncio.immobile.indirizzo") dentro un oggetto. */
export function valorePercorso(radice: unknown, percorso: string): unknown {
  let corrente: unknown = radice;
  for (const passo of percorso.split(".")) {
    if (corrente === null || typeof corrente !== "object") return undefined;
    corrente = (corrente as Record<string, unknown>)[passo];
  }
  return corrente;
}

/**
 * Risolve un campo: un percorso restituisce il valore cosi' com'e', un modello
 * con le graffe restituisce testo. Un modello con un segnaposto vuoto vale null,
 * invece di produrre "Torino, undefined".
 */
export function risolviCampo(spec: string, ctx: ContestoJson): unknown {
  if (!spec.includes("{")) return valorePercorso(ctx, spec);
  let vuoto = false;
  const testo = spec.replace(/\{([^}]+)\}/g, (_, percorso: string) => {
    const v = valorePercorso(ctx, percorso.trim());
    if (v === null || v === undefined || v === "") {
      vuoto = true;
      return "";
    }
    return String(v);
  });
  return vuoto ? null : testo;
}

/** Date delle API: ISO, compatte (20270120 o 20270120000000) o all'italiana. */
export function parseDataJson(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  const compatta = s.match(/^(\d{4})(\d{2})(\d{2})(\d{6})?$/);
  if (compatta) return parseDataIt(`${compatta[3]}/${compatta[2]}/${compatta[1]}`);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return parseDataIt(`${iso[3]}/${iso[2]}/${iso[1]}`);
  return parseDataIt(s);
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return parseImporto(String(v));
}

function testo(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Gli elementi dell'elenco che passano il filtro, fino al limite. */
export function elementiElenco(risposta: unknown, cfg: JsonConfig): unknown[] {
  const elenco = valorePercorso(risposta, cfg.elenco);
  if (!Array.isArray(elenco)) {
    throw new Error(
      `json.elenco = "${cfg.elenco}" non porta a un array nella risposta: ` +
        `controlla il percorso sulla risposta vera dell'API.`,
    );
  }
  const filtro = Object.entries(cfg.filtro ?? {});
  const tenuti = elenco.filter((e) => filtro.every(([k, atteso]) => valorePercorso(e, k) === atteso));
  return cfg.limite !== undefined ? tenuti.slice(0, cfg.limite) : tenuti;
}

/** Costruisce l'immobile da un elemento (e dalla sua scheda, se c'e'). */
export function immobileDaJson(ctx: ContestoJson, config: SiteConfig): ImmobileGrezzo | null {
  const campi = config.json?.campi ?? {};
  const v = (nome: string): unknown => (campi[nome] ? risolviCampo(campi[nome], ctx) : undefined);

  const titolo = testo(v("titolo"));
  const url = testo(v("url"));
  if (!titolo || !url) return null;

  const item: ImmobileGrezzo = {
    fonte: config.name,
    idEsterno: testo(v("idEsterno")) ?? url,
    url,
    titolo,
    prezzo: numero(v("prezzoRaw")),
    tipoPrezzo: tipoPrezzoValido(config.tipoPrezzo) ?? null,
    valorePerizia: numero(v("valorePeriziaRaw")),
    mq: numero(v("mqRaw")),
    locali: numero(v("localiRaw")),
    lat: numero(v("lat")),
    lon: numero(v("lon")),
    dataAsta: parseDataJson(v("dataAstaRaw")),
    termineOfferte: parseDataJson(v("termineOfferteRaw")),
  };
  for (const campo of CAMPI_TESTO) {
    if (campo === "titolo" || campo === "url" || campo === "idEsterno") continue;
    const t = testo(v(campo));
    if (t) (item as unknown as Record<string, unknown>)[campo] = t;
  }
  return item;
}

/**
 * Scarica e interpreta una risposta JSON. Un percorso locale invece di un URL
 * serve ai test e a rilavorare una risposta gia' salvata senza richiederla.
 */
export async function scaricaJson(indirizzo: string): Promise<unknown> {
  if (!/^https?:\/\//.test(indirizzo)) return JSON.parse(await readFile(indirizzo, "utf-8"));

  if (!(await consentito(indirizzo))) throw new Error(`robots.txt vieta l'accesso a ${indirizzo}`);
  const risposta = await fetch(indirizzo, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!risposta.ok) throw new Error(`HTTP ${risposta.status} su ${indirizzo}`);
  const corpo = await risposta.text();
  try {
    return JSON.parse(corpo);
  } catch {
    // un portale che risponde con una pagina d'errore HTML va detto in chiaro
    throw new Error(`${indirizzo} non ha restituito JSON: "${corpo.slice(0, 80).replace(/\s+/g, " ")}"`);
  }
}
