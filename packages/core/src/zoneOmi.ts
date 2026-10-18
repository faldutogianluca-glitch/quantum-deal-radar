/**
 * Risoluzione della zona OMI per un immobile: il pezzo che mancava fra
 * l'indirizzo di un annuncio e la quotazione dell'Agenzia delle Entrate.
 *
 * Catena: indirizzo normalizzato -> geocoding (con cache) -> point-in-polygon
 * sui perimetri OMI -> chiave di quotazione.
 *
 * Se la catena si interrompe non si inventa nulla: si scende al livello
 * comunale, con confidenza ridotta e un flag esplicito. La differenza fra
 * "zona B7" e "comune di Milano" e' enorme e deve restare visibile.
 */

import type { ImmobileNorm } from "./dedup.js";
import { normalizzaIndirizzo } from "./dedup.js";
import { almeno, type Geocoder, type Precisione } from "./geocode.js";
import { trovaZona, type IndiceZone } from "./geo.js";
import type { QuotazioneOmi } from "./valutazione.js";

/** Zona convenzionale per la quotazione aggregata di comune. */
export const ZONA_COMUNE = "*";

export type LivelloZona = "zona" | "comune" | "nessuno";

export interface EsitoZona {
  zonaOmi: string | null;
  livello: LivelloZona;
  precisioneGeo: Precisione;
  lat?: number;
  lon?: number;
  motivo?: string;
}

/**
 * Precisione minima per fidarsi del point-in-polygon.
 * Sotto "strada" il geocoder restituisce un centroide di quartiere o di
 * comune: cadrebbe in *qualche* zona OMI, e il risultato sarebbe un numero
 * inventato con l'aspetto di un dato.
 */
const PRECISIONE_MINIMA: Precisione = "strada";

const TIPI_STRADA = /^(via|viale|v\.le|piazza|p\.za|p\.zza|piazzale|corso|c\.so|largo|vicolo|strada|localit[aà]|loc\.|frazione|alzaia|ripa|borgo|contrada|galleria|passaggio|salita|lungo\w*)(?=[\s.,]|$)/i;

/**
 * Forme alternative di un indirizzo grezzo per il geocoding: senza "n." davanti
 * al civico, senza iniziali puntate, e con "Via" quando manca il tipo di strada.
 * Gli apostrofi restano: "d'Assisi" senza apostrofo non lo trova nessuno.
 */
export function variantiIndirizzo(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const base = raw
    .split(/[;]/)[0]!
    .replace(/[’`]/g, "'")
    .replace(/\bn\.?\s*(?=\d)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const senzaIniziali = base.replace(/\b(?!V\.)[A-Z]\.\s*/gi, (m, off: number) => (off === 0 ? m : "")).replace(/\s+/g, " ").trim();
  const varianti = [base, senzaIniziali];
  for (const v of [base, senzaIniziali]) if (!TIPI_STRADA.test(v)) varianti.push(`Via ${v}`);
  return [...new Set(varianti)].filter((v) => v.length > 3);
}

export async function risolviZona(
  imm: ImmobileNorm,
  indice: IndiceZone,
  geocoder: Geocoder,
): Promise<EsitoZona> {
  if (imm.zonaOmi) {
    return { zonaOmi: imm.zonaOmi, livello: "zona", precisioneGeo: "civico" };
  }
  if (!imm.comune) {
    return { zonaOmi: null, livello: "nessuno", precisioneGeo: "nessuna", motivo: "comune assente" };
  }

  const ind = imm.indirizzoNorm ?? normalizzaIndirizzo(imm.indirizzoRaw).indirizzo;
  const civ = imm.civico ?? normalizzaIndirizzo(imm.indirizzoRaw).civico;
  if (!ind) {
    return {
      zonaOmi: ZONA_COMUNE, livello: "comune", precisioneGeo: "comune",
      motivo: "indirizzo assente: quotazione al livello di comune",
    };
  }

  // Prima la forma normalizzata (e' la chiave che la cache conosce gia'), poi
  // varianti piu' vicine a come OpenStreetMap scrive le vie: le iniziali puntate
  // ("Via G. Pascoli") e i nomi senza tipo di strada ("Pierpaolo Pasolini 33")
  // non si trovano, la stessa via scritta per intero si'. Ci si ferma alla prima
  // risposta precisa almeno alla strada.
  const query = `${ind}${civ ? " " + civ : ""}, ${imm.comune}, Italia`;
  let g = await geocoder.geocodifica(query);
  for (const variante of variantiIndirizzo(imm.indirizzoRaw)) {
    if (g && almeno(g.precisione, PRECISIONE_MINIMA)) break;
    const altro = await geocoder.geocodifica(`${variante}, ${imm.comune}, Italia`);
    if (altro && (!g || almeno(altro.precisione, g.precisione))) g = altro;
  }

  if (!g) {
    return {
      zonaOmi: ZONA_COMUNE, livello: "comune", precisioneGeo: "nessuna",
      motivo: `geocoding fallito per "${query}"`,
    };
  }
  if (!almeno(g.precisione, PRECISIONE_MINIMA)) {
    return {
      zonaOmi: ZONA_COMUNE, livello: "comune", precisioneGeo: g.precisione,
      lat: g.lat, lon: g.lon,
      motivo: `geocoding impreciso (${g.precisione}): zona non assegnabile`,
    };
  }

  const zona = trovaZona(indice, { lat: g.lat, lon: g.lon }, imm.comuneCod);
  if (!zona) {
    return {
      zonaOmi: ZONA_COMUNE, livello: "comune", precisioneGeo: g.precisione,
      lat: g.lat, lon: g.lon,
      motivo: "punto fuori da ogni perimetro OMI noto: perimetri mancanti o comune non coperto",
    };
  }

  return {
    zonaOmi: zona.zona, livello: "zona", precisioneGeo: g.precisione,
    lat: g.lat, lon: g.lon,
  };
}

/** Applica l'esito all'immobile. Ritorna una copia: nessuna mutazione. */
export function applicaZona(imm: ImmobileNorm, e: EsitoZona): ImmobileNorm {
  return {
    ...imm,
    zonaOmi: e.zonaOmi,
    lat: e.lat ?? null,
    lon: e.lon ?? null,
    precisioneGeo: e.precisioneGeo,
    livelloZona: e.livello,
  };
}

export async function arricchisci(
  immobili: ImmobileNorm[],
  indice: IndiceZone,
  geocoder: Geocoder,
): Promise<ImmobileNorm[]> {
  const out: ImmobileNorm[] = [];
  for (const i of immobili) out.push(applicaZona(i, await risolviZona(i, indice, geocoder)));
  return out;
}

/**
 * Aggrega le quotazioni di zona in una quotazione di comune, registrata sotto
 * la zona convenzionale "*".
 *
 * Scelta deliberata: min dei minimi e max dei massimi, NON la media.
 * L'aggregato deve essere onestamente largo. Una media di comune darebbe una
 * forbice stretta e falsamente precisa: comunicherebbe una fiducia che il
 * dato non ha. Larga e vera batte stretta e finta.
 */
export function aggregaPerComune(
  quotazioni: Map<string, QuotazioneOmi>,
): Map<string, QuotazioneOmi> {
  const out = new Map(quotazioni);
  const acc = new Map<string, { min: number; max: number; sem: string }>();

  for (const [chiave, q] of quotazioni) {
    const parti = chiave.split("|");
    const comune = parti[0];
    const zona = parti[1];
    const tipologia = parti[2];
    if (!comune || !tipologia || zona === ZONA_COMUNE) continue;
    if (q.vendMin == null || q.vendMax == null) continue;

    const k = `${comune}|${ZONA_COMUNE}|${tipologia}`;
    const a = acc.get(k);
    if (!a) acc.set(k, { min: q.vendMin, max: q.vendMax, sem: q.semestre ?? "?" });
    else {
      a.min = Math.min(a.min, q.vendMin);
      a.max = Math.max(a.max, q.vendMax);
    }
  }

  for (const [k, a] of acc) {
    out.set(k, { vendMin: a.min, vendMax: a.max, semestre: a.sem });
  }
  return out;
}
