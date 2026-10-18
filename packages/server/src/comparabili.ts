/**
 * Valore di uscita dai comparabili ristrutturati. Funzioni pure.
 *
 * Il massimo OMI descrive "un immobile in buono stato" della zona: una media
 * su tagli e qualita' diverse. Chi rivende un bilocale appena ristrutturato
 * compete con altri bilocali ristrutturati a qualche centinaio di metri, ed e'
 * quel prezzo che conta. Il metodo:
 *
 * 1. **Filtro duro:** solo nuovo o ristrutturato, vicini, recenti, di taglio
 *    simile. Cio' che non passa non entra nella stima, ma viene contato.
 * 2. **Omogeneizzazione:** ogni comparabile viene riportato alle condizioni
 *    del bersaglio. Prezzo richiesto -> rogito, nuovo -> ristrutturato, e il
 *    taglio: i piccoli valgono di piu' al mq.
 * 3. **Stima robusta:** mediana pesata per distanza, dopo aver tolto gli
 *    anomali. La dispersione fra primo e terzo quartile misura quanto ci si
 *    puo' fidare, e decide lo stress test a valle.
 *
 * Sotto il numero minimo di comparabili, o con una dispersione troppo alta,
 * la stima esce come non affidabile e il Gate 0 resta sul massimo OMI. Meglio
 * un dato meno preciso dichiarato che uno preciso solo in apparenza.
 */

export type StatoComparabile = "nuovo" | "ristrutturato" | "buono" | "da_ristrutturare";

export interface Comparabile {
  id: number;
  fonte: string;
  indirizzo: string | null;
  comune: string | null;
  lat: number | null;
  lon: number | null;
  zonaOmi: string | null;
  mq: number;
  prezzo: number;
  /** "richiesta" per gli annunci, "rogito" per le compravendite chiuse. */
  tipoPrezzo: "richiesta" | "rogito";
  stato: StatoComparabile | null;
  /** ISO, data dell'annuncio o del rogito. */
  data: string | null;
  url: string | null;
}

export interface ParametriComparabili {
  /** Raggi successivi in metri: si allarga solo se i comparabili non bastano. */
  raggi: number[];
  mesiMassimi: number;
  /** Banda di taglio rispetto al bersaglio. */
  bandaMq: [number, number];
  minimo: number;
  /** Oltre questa dispersione (IQR / mediana) la stima non e' affidabile. */
  dispersioneMassima: number;
  /** Sconto medio fra prezzo richiesto e rogito. */
  haircutRichiesta: number;
  /** Il nuovo vale di piu' del ristrutturato: si riporta il nuovo al ristrutturato. */
  fattoreNuovo: number;
  /** Elasticita' del prezzo al mq rispetto alla superficie: EUR/mq ~ mq^-elasticita. */
  elasticitaTaglio: number;
  /** Distanza a cui il peso di un comparabile si dimezza, in metri. */
  dimezzamentoPeso: number;
}

/**
 * Valori di partenza, tutti dichiarati come ipotesi: l'haircut richiesta-rogito
 * e' lo stesso di @qdr/core (0,90); premio del nuovo e elasticita' al taglio
 * sono valori tipici del mercato residenziale milanese, da ricalibrare quando
 * ci saranno rogiti propri.
 */
export const PARAMETRI_COMPARABILI: ParametriComparabili = {
  raggi: [500, 1000],
  mesiMassimi: 12,
  bandaMq: [0.65, 1.5],
  minimo: 5,
  dispersioneMassima: 0.3,
  haircutRichiesta: 0.9,
  fattoreNuovo: 0.92,
  elasticitaTaglio: 0.1,
  dimezzamentoPeso: 300,
};

export interface Bersaglio {
  lat: number | null;
  lon: number | null;
  zonaOmi: string | null;
  mq: number;
}

export interface ComparabileUsato {
  id: number;
  indirizzo: string | null;
  mq: number;
  stato: StatoComparabile;
  prezzoMq: number;
  /** EUR/mq dopo l'omogeneizzazione: e' il numero che entra nella stima. */
  prezzoMqOmogeneo: number;
  distanza: number | null;
  peso: number;
  url: string | null;
}

export interface StimaComparabili {
  affidabile: boolean;
  valoreMq: number | null;
  n: number;
  p25: number | null;
  p75: number | null;
  /** (p75 - p25) / mediana. */
  dispersione: number | null;
  /** Come si sono scelti: raggio in metri, o stessa zona OMI. */
  ambito: string;
  /** Perche' gli altri sono rimasti fuori: e' il primo posto dove guardare se n e' basso. */
  esclusi: { stato: number; data: number; taglio: number; distanza: number; anomali: number };
  motivo: string;
  usati: ComparabileUsato[];
}

/** Distanza in metri (haversine): alle scale di un quartiere l'errore e' trascurabile. */
export function distanzaMetri(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Quantile con interpolazione lineare su valori ordinati. */
export function quantile(ordinati: number[], q: number): number {
  const pos = (ordinati.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return ordinati[lo]! + (ordinati[hi]! - ordinati[lo]!) * (pos - lo);
}

/** Mediana pesata: il valore dove il peso cumulato supera la meta'. */
export function medianaPesata(valori: { v: number; peso: number }[]): number {
  const s = [...valori].sort((a, b) => a.v - b.v);
  const totale = s.reduce((a, x) => a + x.peso, 0);
  let cumulato = 0;
  for (const x of s) {
    cumulato += x.peso;
    if (cumulato >= totale / 2) return x.v;
  }
  return s[s.length - 1]!.v;
}

/** Riconosce lo stato da come lo scrivono annunci ed export: "Ottimo / Ristrutturato", "Nuovo / In costruzione"... */
export function statoDaTesto(testo: string | null | undefined): StatoComparabile | null {
  const t = (testo ?? "").toLowerCase();
  if (!t.trim()) return null;
  // l'ordine conta: "da ristrutturare" contiene "ristruttur"
  if (/da ristruttur|da rinnov|da riattare|grezzo/.test(t)) return "da_ristrutturare";
  if (/nuov|costruzione/.test(t)) return "nuovo";
  if (/ristruttur|ottimo|rinnovat/.test(t)) return "ristrutturato";
  if (/buono|abitabile|discreto/.test(t)) return "buono";
  return null;
}

function mesiFra(da: string, a: Date): number {
  const d = new Date(da);
  if (Number.isNaN(d.getTime())) return Infinity;
  return (a.getTime() - d.getTime()) / (30.44 * 86_400_000);
}

export function stimaDaComparabili(
  bersaglio: Bersaglio,
  comparabili: Comparabile[],
  oggi: Date = new Date(),
  p: ParametriComparabili = PARAMETRI_COMPARABILI,
): StimaComparabili {
  const esclusi = { stato: 0, data: 0, taglio: 0, distanza: 0, anomali: 0 };
  const vuota = (ambito: string, motivo: string): StimaComparabili => ({
    affidabile: false, valoreMq: null, n: 0, p25: null, p75: null, dispersione: null, ambito, esclusi, motivo, usati: [],
  });

  // --- filtri che non dipendono dalla geografia
  const idonei: Comparabile[] = [];
  for (const c of comparabili) {
    if (c.stato !== "nuovo" && c.stato !== "ristrutturato") { esclusi.stato++; continue; }
    // un comparabile senza data non si sa quanto sia vecchio: fuori
    if (!c.data || mesiFra(c.data, oggi) > p.mesiMassimi) { esclusi.data++; continue; }
    if (c.mq < bersaglio.mq * p.bandaMq[0] || c.mq > bersaglio.mq * p.bandaMq[1]) { esclusi.taglio++; continue; }
    idonei.push(c);
  }

  // --- geografia: raggi crescenti se il bersaglio ha coordinate, altrimenti stessa zona OMI
  const haPunto = bersaglio.lat != null && bersaglio.lon != null;
  let scelti: { c: Comparabile; distanza: number | null }[] = [];
  let ambito = "";
  if (haPunto) {
    const conDistanza = idonei
      .filter((c) => c.lat != null && c.lon != null)
      .map((c) => ({ c, distanza: distanzaMetri(bersaglio as { lat: number; lon: number }, c as { lat: number; lon: number }) }));
    for (const r of p.raggi) {
      scelti = conDistanza.filter((x) => x.distanza <= r);
      ambito = `entro ${r} m`;
      if (scelti.length >= p.minimo) break;
    }
    esclusi.distanza = idonei.length - scelti.length;
  } else if (bersaglio.zonaOmi && bersaglio.zonaOmi !== "*") {
    scelti = idonei.filter((c) => c.zonaOmi === bersaglio.zonaOmi).map((c) => ({ c, distanza: null }));
    ambito = `zona OMI ${bersaglio.zonaOmi}`;
    esclusi.distanza = idonei.length - scelti.length;
  } else {
    return vuota("nessuno", "bersaglio senza coordinate ne' zona OMI: i comparabili non si possono localizzare");
  }

  // --- omogeneizzazione
  let usati: ComparabileUsato[] = scelti.map(({ c, distanza }) => {
    const prezzoMq = c.prezzo / c.mq;
    const omogeneo =
      prezzoMq *
      (c.tipoPrezzo === "richiesta" ? p.haircutRichiesta : 1) *
      (c.stato === "nuovo" ? p.fattoreNuovo : 1) *
      (bersaglio.mq / c.mq) ** -p.elasticitaTaglio;
    return {
      id: c.id, indirizzo: c.indirizzo, mq: c.mq, stato: c.stato as StatoComparabile, prezzoMq,
      prezzoMqOmogeneo: omogeneo, distanza,
      peso: distanza == null ? 1 : 1 / (1 + distanza / p.dimezzamentoPeso),
      url: c.url,
    };
  });

  // --- anomali (Tukey): un attico con terrazzo o un errore di battitura spostano la media, non devono spostare la stima
  if (usati.length >= p.minimo) {
    const ord = usati.map((u) => u.prezzoMqOmogeneo).sort((a, b) => a - b);
    const q1 = quantile(ord, 0.25);
    const q3 = quantile(ord, 0.75);
    const iqr = q3 - q1;
    const prima = usati.length;
    usati = usati.filter((u) => u.prezzoMqOmogeneo >= q1 - 1.5 * iqr && u.prezzoMqOmogeneo <= q3 + 1.5 * iqr);
    esclusi.anomali = prima - usati.length;
  }

  if (usati.length === 0) return vuota(ambito, `nessun comparabile ristrutturato ${ambito}`);

  const ord = usati.map((u) => u.prezzoMqOmogeneo).sort((a, b) => a - b);
  const valoreMq = medianaPesata(usati.map((u) => ({ v: u.prezzoMqOmogeneo, peso: u.peso })));
  const p25 = quantile(ord, 0.25);
  const p75 = quantile(ord, 0.75);
  const dispersione = (p75 - p25) / quantile(ord, 0.5);
  usati.sort((a, b) => (a.distanza ?? 0) - (b.distanza ?? 0));

  const base = { valoreMq, n: usati.length, p25, p75, dispersione, ambito, esclusi, usati };
  if (usati.length < p.minimo) {
    return { ...base, affidabile: false, motivo: `${usati.length} comparabili ${ambito}, ne servono ${p.minimo}` };
  }
  if (dispersione > p.dispersioneMassima) {
    return {
      ...base, affidabile: false,
      motivo: `dispersione ${(dispersione * 100).toFixed(0)}% oltre il ${(p.dispersioneMassima * 100).toFixed(0)}%: comparabili troppo eterogenei`,
    };
  }
  return { ...base, affidabile: true, motivo: `${usati.length} comparabili ristrutturati ${ambito}` };
}
