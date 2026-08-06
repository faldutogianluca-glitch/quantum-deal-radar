/**
 * Geometria minima per assegnare una zona OMI a un punto. Zero dipendenze.
 *
 * Le zone OMI sono poligoni. Senza point-in-polygon la triangolazione
 * valutativa resta senza la gamba OMI e ogni immobile finisce con una sola
 * stima, cioe' la perizia — che e' esattamente il dato che l'OMI dovrebbe
 * validare.
 *
 * Coordinate sempre [lon, lat] (convenzione GeoJSON), EPSG:4326.
 */

export interface Punto {
  lat: number;
  lon: number;
}

/** [ovest, sud, est, nord] */
export type BBox = [number, number, number, number];

/** Anello chiuso o aperto: [lon, lat][] */
export type Anello = [number, number][];
/** Primo anello = contorno esterno, successivi = buchi (es. enclave) */
export type Poligono = Anello[];
export type MultiPoligono = Poligono[];

export interface ZonaOmi {
  comuneCod: string;
  zona: string;
  descrizione?: string;
  geom: MultiPoligono;
  bbox: BBox;
}

// ---------------------------------------------------------------- bbox

export function bboxDi(mp: MultiPoligono): BBox {
  let o = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const poly of mp) {
    for (const anello of poly) {
      for (const [lon, lat] of anello) {
        if (lon < o) o = lon;
        if (lon > e) e = lon;
        if (lat < s) s = lat;
        if (lat > n) n = lat;
      }
    }
  }
  return [o, s, e, n];
}

export const nelBBox = (p: Punto, b: BBox): boolean =>
  p.lon >= b[0] && p.lon <= b[2] && p.lat >= b[1] && p.lat <= b[3];

// ---------------------------------------------------------------- point in polygon

/**
 * Ray casting. Il punto esattamente su un vertice o su un lato e' un caso
 * degenere: qui conta come dentro, cosi' un civico sul confine fra due zone
 * riceve comunque una zona invece di cadere nel vuoto.
 */
export function puntoInAnello(p: Punto, anello: Anello): boolean {
  let dentro = false;
  const n = anello.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = anello[i]!;
    const b = anello[j]!;
    const [xi, yi] = a;
    const [xj, yj] = b;

    // sul vertice
    if ((xi === p.lon && yi === p.lat) || (xj === p.lon && yj === p.lat)) return true;

    // sul lato (collineare e dentro il segmento)
    const cross = (xj - xi) * (p.lat - yi) - (yj - yi) * (p.lon - xi);
    if (Math.abs(cross) < 1e-12) {
      const dentroX = p.lon >= Math.min(xi, xj) && p.lon <= Math.max(xi, xj);
      const dentroY = p.lat >= Math.min(yi, yj) && p.lat <= Math.max(yi, yj);
      if (dentroX && dentroY) return true;
    }

    const attraversa = yi > p.lat !== yj > p.lat;
    if (attraversa && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export function puntoInPoligono(p: Punto, poly: Poligono): boolean {
  const esterno = poly[0];
  if (!esterno || !puntoInAnello(p, esterno)) return false;
  for (let i = 1; i < poly.length; i++) {
    if (puntoInAnello(p, poly[i]!)) return false; // dentro un buco
  }
  return true;
}

export function puntoInZona(p: Punto, z: ZonaOmi): boolean {
  if (!nelBBox(p, z.bbox)) return false; // prefiltro: scarta il 99% dei casi
  return z.geom.some((poly) => puntoInPoligono(p, poly));
}

// ---------------------------------------------------------------- indice

const LATO_CELLA = 0.05; // ~5 km: le zone OMI urbane sono molto piu' piccole

const cella = (lon: number, lat: number): string =>
  `${Math.floor(lon / LATO_CELLA)}:${Math.floor(lat / LATO_CELLA)}`;

export interface IndiceZone {
  griglia: Map<string, ZonaOmi[]>;
  zone: ZonaOmi[];
}

/**
 * Griglia uniforme. Con qualche decina di migliaia di zone su scala nazionale
 * e' abbondante: evita di scorrere tutte le zone a ogni lookup senza
 * introdurre un R-tree e le sue dipendenze.
 */
export function costruisciIndice(zone: ZonaOmi[]): IndiceZone {
  const griglia = new Map<string, ZonaOmi[]>();
  for (const z of zone) {
    const [o, s, e, n] = z.bbox;
    for (let x = Math.floor(o / LATO_CELLA); x <= Math.floor(e / LATO_CELLA); x++) {
      for (let y = Math.floor(s / LATO_CELLA); y <= Math.floor(n / LATO_CELLA); y++) {
        const k = `${x}:${y}`;
        const lista = griglia.get(k);
        if (lista) lista.push(z);
        else griglia.set(k, [z]);
      }
    }
  }
  return { griglia, zone };
}

/**
 * Ritorna la zona che contiene il punto. Se `comuneCod` e' noto, filtra su
 * quello: i confini OMI di comuni contigui possono sovrapporsi di poco per
 * imprecisioni di digitalizzazione, e senza filtro si prende la zona sbagliata.
 */
export function trovaZona(
  indice: IndiceZone,
  p: Punto,
  comuneCod?: string | null,
): ZonaOmi | null {
  const candidate = indice.griglia.get(cella(p.lon, p.lat)) ?? [];
  const filtrate = comuneCod ? candidate.filter((z) => z.comuneCod === comuneCod) : candidate;
  for (const z of filtrate) if (puntoInZona(p, z)) return z;
  // il filtro per comune puo' fallire se il codice non combacia: riprova largo
  if (comuneCod) for (const z of candidate) if (puntoInZona(p, z)) return z;
  return null;
}

// ---------------------------------------------------------------- GeoJSON

interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}
interface GeoJsonFeature {
  type: string;
  properties?: Record<string, unknown> | null;
  geometry?: GeoJsonGeometry | null;
}
export interface GeoJsonFeatureCollection {
  type: string;
  features: GeoJsonFeature[];
}

const ALIAS_COMUNE = ["comune_cod", "comune_amm", "cod_com", "codice_comune", "COMUNE_AMM", "COMUNE_CAT"];
const ALIAS_ZONA = ["zona", "zona_omi", "cod_zona", "ZONA", "ZONA_OMI"];
const ALIAS_DESCR = ["descrizione", "descr_zona", "LINKZONA", "DESCR_ZONA"];

function prendi(props: Record<string, unknown>, alias: string[]): string | null {
  for (const a of alias) {
    const v = props[a] ?? props[a.toLowerCase()] ?? props[a.toUpperCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/**
 * Converte una FeatureCollection nelle zone indicizzabili.
 *
 * I perimetri OMI si scaricano dall'area riservata dell'Agenzia delle Entrate
 * in formato shapefile. Conversione da fare una volta, offline:
 *
 *   ogr2ogr -f GeoJSON -t_srs EPSG:4326 zone_omi.geojson ZONE_OMI.shp
 *
 * Il nome dei campi cambia fra rilasci: gli alias sopra coprono le varianti
 * viste finora, e la funzione riferisce quali feature ha scartato invece di
 * ingoiarle in silenzio.
 */
export function daGeoJson(fc: GeoJsonFeatureCollection): {
  zone: ZonaOmi[];
  scartate: number;
  motivi: string[];
} {
  const zone: ZonaOmi[] = [];
  const motivi = new Set<string>();
  let scartate = 0;

  for (const f of fc.features ?? []) {
    const props = f.properties ?? {};
    const comuneCod = prendi(props, ALIAS_COMUNE);
    const zona = prendi(props, ALIAS_ZONA);
    const g = f.geometry;

    if (!comuneCod || !zona) {
      scartate++;
      motivi.add(`proprieta' mancanti (attese fra: ${ALIAS_COMUNE[0]}, ${ALIAS_ZONA[0]})`);
      continue;
    }
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) {
      scartate++;
      motivi.add(`geometria non poligonale: ${g?.type ?? "assente"}`);
      continue;
    }

    const geom: MultiPoligono =
      g.type === "Polygon" ? [g.coordinates as Poligono] : (g.coordinates as MultiPoligono);
    if (!geom.length || !geom[0]?.[0]?.length) {
      scartate++;
      motivi.add("anello vuoto");
      continue;
    }

    const descr = prendi(props, ALIAS_DESCR);
    zone.push({
      comuneCod,
      zona,
      ...(descr ? { descrizione: descr } : {}),
      geom,
      bbox: bboxDi(geom),
    });
  }
  return { zone, scartate, motivi: [...motivi] };
}
