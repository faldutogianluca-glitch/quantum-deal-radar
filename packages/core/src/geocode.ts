/**
 * Geocoding. Zero dipendenze: usa fetch, iniettabile per i test.
 *
 * Due vincoli che governano il disegno di questo modulo:
 *
 * 1. La CACHE non e' un'ottimizzazione, e' un requisito. Con migliaia di
 *    annunci ripubblicati a ogni ciclo, senza cache si rigeocodificano gli
 *    stessi indirizzi ogni giorno: inaccettabile per qualunque provider e
 *    costoso su quelli a pagamento.
 *
 * 2. La PRECISIONE va propagata, non nascosta. Un indirizzo risolto a livello
 *    di comune produce un centroide che cade in una zona OMI qualsiasi: la
 *    quotazione risultante sarebbe inventata con l'aspetto di un dato.
 *    Sotto il livello "strada" la zona non va assegnata.
 */

export type Precisione = "civico" | "strada" | "localita" | "comune" | "nessuna";

export interface RisultatoGeocoding {
  lat: number;
  lon: number;
  precisione: Precisione;
  etichetta: string;
  fonte: string;
}

export interface Geocoder {
  geocodifica(query: string): Promise<RisultatoGeocoding | null>;
}

/** Implementabile su D1, KV, SQLite: qui serve solo il contratto. */
export interface CacheGeocoding {
  leggi(chiave: string): Promise<RisultatoGeocoding | null | undefined>;
  scrivi(chiave: string, valore: RisultatoGeocoding | null): Promise<void>;
}

export const chiaveCache = (indirizzo: string, comune: string): string =>
  `${comune}|${indirizzo}`.toUpperCase().replace(/\s+/g, " ").trim();

/** Ordinamento: piu' basso = piu' preciso. Serve per le soglie. */
const RANGO: Record<Precisione, number> = {
  civico: 0, strada: 1, localita: 2, comune: 3, nessuna: 4,
};

export const almeno = (p: Precisione, minima: Precisione): boolean =>
  RANGO[p] <= RANGO[minima];

// ---------------------------------------------------------------- Nominatim

interface RispostaNominatim {
  lat?: string;
  lon?: string;
  display_name?: string;
  addresstype?: string;
  type?: string;
  class?: string;
}

const TIPI_CIVICO = ["house", "house_number", "building", "address"];
const TIPI_STRADA = [
  "road", "street", "residential", "unclassified", "living_street", "pedestrian",
  "service", "track", "footway", "path", "cycleway", "steps",
  "motorway", "trunk", "primary", "secondary", "tertiary",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
];
const TIPI_LOCALITA = [
  "suburb", "neighbourhood", "quarter", "hamlet", "village", "borough",
  "city_district", "locality", "isolated_dwelling",
];
const TIPI_COMUNE = ["city", "town", "municipality", "administrative"];

/**
 * Classifica la precisione di un risultato Nominatim.
 *
 * Due livelli di riconoscimento: prima l'`addresstype`/`type` puntuale, poi un
 * ripiego sulla `class` OSM. L'elenco dei type non e' chiudibile — OSM ne
 * introduce di nuovi e Nominatim cambia mappatura fra una versione e l'altra —
 * e senza ripiego un tipo non previsto degrada a "nessuna": l'immobile perde la
 * zona OMI in silenzio, che e' esattamente il fallimento che questo modulo deve
 * evitare.
 *
 * Nel dubbio si resta bassi. Una precisione sottostimata fa ripiegare sul
 * livello comunale con un flag esplicito; una sovrastimata assegna una zona
 * inventata. Per questo `place` non e' mappato: in Nominatim copre tutto da
 * "continent" a "house" e non dice nulla sulla precisione.
 */
function classifica(r: RispostaNominatim): Precisione {
  const t = (r.addresstype ?? r.type ?? "").toLowerCase();
  if (TIPI_CIVICO.includes(t)) return "civico";
  if (TIPI_STRADA.includes(t)) return "strada";
  if (TIPI_LOCALITA.includes(t)) return "localita";
  if (TIPI_COMUNE.includes(t)) return "comune";

  switch ((r.class ?? "").toLowerCase()) {
    case "building": return "civico";
    case "highway": return "strada";
    case "boundary": return "comune";
    default: return "nessuna";
  }
}

export interface OpzioniNominatim {
  /** Obbligatorio dalla usage policy: identificativo con contatto reale. */
  userAgent: string;
  /** La policy impone al massimo 1 richiesta al secondo. Non abbassare. */
  pausaMs?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/**
 * Nominatim/OSM ha una usage policy stringente: un solo thread, massimo una
 * richiesta al secondo, User-Agent identificabile, niente uso massivo.
 * Va benissimo per costruire la cache iniziale e per il flusso incrementale
 * quotidiano; se un giorno serve geocodificare decine di migliaia di
 * indirizzi in blocco, va sostituito con un provider a pagamento —
 * l'interfaccia Geocoder e' li' apposta.
 */
export function geocoderNominatim(opz: OpzioniNominatim): Geocoder {
  const pausa = opz.pausaMs ?? 1100;
  const f = opz.fetchImpl ?? fetch;
  const base = opz.baseUrl ?? "https://nominatim.openstreetmap.org/search";
  let ultimo = 0;

  return {
    async geocodifica(query: string): Promise<RisultatoGeocoding | null> {
      const attesa = pausa - (Date.now() - ultimo);
      if (attesa > 0) await new Promise((r) => setTimeout(r, attesa));
      ultimo = Date.now();

      const url = `${base}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&countrycodes=it&addressdetails=0`;
      const resp = await f(url, { headers: { "User-Agent": opz.userAgent, "Accept-Language": "it" } });
      if (!resp.ok) return null;

      const dati = (await resp.json()) as RispostaNominatim[];
      const r = dati?.[0];
      if (!r?.lat || !r?.lon) return null;

      return {
        lat: Number(r.lat),
        lon: Number(r.lon),
        precisione: classifica(r),
        etichetta: r.display_name ?? query,
        fonte: "nominatim",
      };
    },
  };
}

/** Avvolge un geocoder con la cache. I fallimenti si memorizzano come null:
 *  un indirizzo che non si risolve non va riprovato a ogni ciclo. */
export function conCache(g: Geocoder, cache: CacheGeocoding): Geocoder {
  return {
    async geocodifica(query: string): Promise<RisultatoGeocoding | null> {
      const k = query.toUpperCase().replace(/\s+/g, " ").trim();
      const memorizzato = await cache.leggi(k);
      if (memorizzato !== undefined) return memorizzato;
      const r = await g.geocodifica(query);
      await cache.scrivi(k, r);
      return r;
    },
  };
}

/** Cache in memoria: utile per test e script una tantum. */
export function cacheMemoria(): CacheGeocoding {
  const m = new Map<string, RisultatoGeocoding | null>();
  return {
    async leggi(k) { return m.has(k) ? m.get(k)! : undefined; },
    async scrivi(k, v) { m.set(k, v); },
  };
}
