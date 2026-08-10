import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import { parseCsv, trovaColonna, type RigaCsv } from "./csv.js";
import { parseDataIt, parseImporto, tipoPrezzoValido } from "./parsing.js";
import type { ImmobileGrezzo, SiteConfig } from "./types.js";

/**
 * Importazione dei portafogli che non hanno un catalogo pubblico.
 *
 * Per BPER Real Estate e Banco BPM/Phoenix non esiste una pagina da leggere:
 * gli elenchi arrivano per email, feed o data room. Il percorso corretto non e'
 * uno scraper piu' insistente, e' un punto di ingresso dichiarato: si lascia
 * cadere un CSV in una cartella e la fonte lo raccoglie al ciclo successivo.
 */

/** Colonne riconosciute senza configurazione, con i nomi che si trovano di fatto. */
const ALIAS: Record<string, string[]> = {
  titolo: ["titolo", "descrizione", "denominazione", "immobile"],
  comune: ["comune", "citta", "localita"],
  indirizzoRaw: ["indirizzo", "via", "ubicazione"],
  prezzoRaw: ["prezzo", "importo", "valore", "richiesta", "baseasta"],
  mqRaw: ["mq", "superficie", "metriquadri"],
  numeroLotto: ["lotto", "numerolotto"],
  sottotipoAsset: ["tipologia", "tipo", "categoria", "destinazione"],
  dataAstaRaw: ["dataasta", "data"],
  termineOfferteRaw: ["termineofferte", "scadenza"],
  tribunale: ["tribunale"],
  statoOccupazionale: ["statooccupazionale", "occupazione", "stato"],
  idEsterno: ["id", "codice", "riferimento", "rif"],
  url: ["url", "link", "scheda"],
};

const CAMPI_TESTUALI = [
  "titolo",
  "comune",
  "indirizzoRaw",
  "numeroLotto",
  "sottotipoAsset",
  "tribunale",
  "statoOccupazionale",
] as const;

export interface EsitoImportazione {
  immobili: ImmobileGrezzo[];
  /** File letti, con quante righe ognuno: serve a capire cos'e' entrato. */
  fileLetti: { nome: string; righe: number }[];
  /** Colonne presenti nel file che nessun campo sa usare. */
  colonneIgnorate: string[];
  avvisi: string[];
}

/**
 * Risolve i nomi delle colonne, una volta per file.
 *
 * La mappatura esplicita nel config vince sempre; dove manca si tenta con gli
 * alias. Cosi' un file ben fatto non richiede configurazione, e uno con nomi
 * strani si sistema senza toccare il codice.
 */
function mappaColonne(
  intestazioni: string[],
  esplicite: Record<string, string> | undefined,
): { campo: string; colonna: string }[] {
  const mappa: { campo: string; colonna: string }[] = [];

  for (const campo of Object.keys(ALIAS)) {
    const richiesta = esplicite?.[campo];
    if (richiesta) {
      const trovata = trovaColonna(intestazioni, richiesta);
      if (trovata) mappa.push({ campo, colonna: trovata });
      continue;
    }
    for (const alias of ALIAS[campo] ?? []) {
      const trovata = trovaColonna(intestazioni, alias);
      if (trovata) {
        mappa.push({ campo, colonna: trovata });
        break;
      }
    }
  }
  return mappa;
}

function costruisciImmobile(
  riga: RigaCsv,
  mappa: { campo: string; colonna: string }[],
  config: SiteConfig,
  origine: string,
  indice: number,
): ImmobileGrezzo | null {
  const val = (campo: string): string | null => {
    const m = mappa.find((x) => x.campo === campo);
    const v = m ? riga[m.colonna]?.trim() : undefined;
    return v ? v : null;
  };

  // Una riga senza nulla di identificabile non e' un immobile: e' rumore
  // dell'export (righe di totale, note a pie' di tabella).
  const titolo = val("titolo");
  const comune = val("comune");
  const indirizzo = val("indirizzoRaw");
  if (!titolo && !comune && !indirizzo) return null;

  const item: ImmobileGrezzo = {
    fonte: config.name,
    // Il file di origine entra nell'id: due invii diversi dello stesso
    // portafoglio non devono sovrascriversi a vicenda prima della deduplica.
    idEsterno: val("idEsterno") ?? `${origine}#${indice + 1}`,
    url: val("url"),
    titolo: titolo ?? [comune, indirizzo].filter(Boolean).join(" - "),
    prezzo: parseImporto(val("prezzoRaw") ?? ""),
    tipoPrezzo: tipoPrezzoValido(config.tipoPrezzo) ?? null,
    mq: parseImporto(val("mqRaw") ?? ""),
    dataAsta: parseDataIt(val("dataAstaRaw") ?? ""),
    termineOfferte: parseDataIt(val("termineOfferteRaw") ?? ""),
  };
  for (const campo of CAMPI_TESTUALI) {
    const v = val(campo);
    if (v) (item as unknown as Record<string, unknown>)[campo] = v;
  }
  return item;
}

/** Importa un singolo file CSV gia' letto. */
export function importaCsv(
  contenuto: string,
  config: SiteConfig,
  origine: string,
): { immobili: ImmobileGrezzo[]; colonneIgnorate: string[]; avvisi: string[] } {
  const csv = parseCsv(contenuto);
  const avvisi: string[] = [];

  if (csv.righe.length === 0) {
    return { immobili: [], colonneIgnorate: [], avvisi: [`${origine}: nessuna riga di dati.`] };
  }

  const mappa = mappaColonne(csv.intestazioni, config.manuale?.colonne);
  if (mappa.length === 0) {
    avvisi.push(
      `${origine}: nessuna colonna riconosciuta fra [${csv.intestazioni.join(", ")}]. ` +
        `Indica i nomi in "manuale.colonne" nel config della fonte.`,
    );
    return { immobili: [], colonneIgnorate: csv.intestazioni, avvisi };
  }

  if (csv.righeIrregolari > 0) {
    // quasi sempre un campo con un a-capo non protetto da virgolette
    avvisi.push(
      `${origine}: ${csv.righeIrregolari} righe hanno un numero di campi diverso ` +
        `dall'intestazione. Il file potrebbe essere danneggiato.`,
    );
  }

  const usate = new Set(mappa.map((m) => m.colonna));
  const immobili: ImmobileGrezzo[] = [];
  csv.righe.forEach((riga, i) => {
    const item = costruisciImmobile(riga, mappa, config, origine, i);
    if (item) immobili.push(item);
  });

  return {
    immobili,
    colonneIgnorate: csv.intestazioni.filter((h) => !usate.has(h)),
    avvisi,
  };
}

/**
 * Raccoglie tutti i CSV lasciati nella cartella della fonte.
 *
 * Se la cartella non c'e' non e' un errore: significa che nessuno ha ancora
 * consegnato niente. Il messaggio dice dove mettere il file, invece di
 * lamentare un percorso mancante.
 */
export async function importaCartella(
  cartella: string,
  config: SiteConfig,
): Promise<EsitoImportazione> {
  const esito: EsitoImportazione = {
    immobili: [],
    fileLetti: [],
    colonneIgnorate: [],
    avvisi: [],
  };

  let elenco: string[];
  try {
    const info = await stat(cartella);
    if (!info.isDirectory()) throw new Error("non e' una cartella");
    elenco = (await readdir(cartella)).filter((f) => /\.csv$/i.test(f)).sort();
  } catch {
    esito.avvisi.push(
      `"${config.name}" non ha un catalogo pubblico: i dati vanno consegnati a mano. ` +
        `Crea la cartella ${cartella} e lasciaci dentro i CSV ricevuti.`,
    );
    return esito;
  }

  if (elenco.length === 0) {
    esito.avvisi.push(`Nessun CSV in ${cartella}: niente da importare per "${config.name}".`);
    return esito;
  }

  const ignorate = new Set<string>();
  for (const file of elenco) {
    const contenuto = await readFile(join(cartella, file), "utf-8");
    const r = importaCsv(contenuto, config, basename(file));
    esito.immobili.push(...r.immobili);
    esito.fileLetti.push({ nome: file, righe: r.immobili.length });
    esito.avvisi.push(...r.avvisi);
    for (const c of r.colonneIgnorate) ignorate.add(c);
  }
  esito.colonneIgnorate = [...ignorate];

  return esito;
}
