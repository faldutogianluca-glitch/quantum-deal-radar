/**
 * Deduplicazione cross-fonte. Zero dipendenze, funzioni pure.
 *
 * Problema che risolve: lo stesso lotto compare su Reperform, BNL, PVP e
 * sul portale della REOCO. Senza dedup la coda si riempie di duplicati e
 * il ranking diventa inutilizzabile.
 *
 * Due chiavi:
 *   - giudiziaria  (tribunale, anno RGE, numero RGE, lotto) -> deterministica
 *   - geofisica    (comune, indirizzo normalizzato, civico, mq bucket, locali)
 *
 * La seconda serve a due cose: le vendite dirette che non hanno RGE, e
 * l'aggancio pre-asta -> asta, che avviene da solo quando lo stesso bene
 * ricompare con l'RGE.
 */

// ---------------------------------------------------------------- tipi

export type TipoPrezzo = "base_asta" | "richiesta_reoco" | "trattativa";
export type Conformita = "insanabile" | "sanabile" | "non_verificata" | "conforme";

export interface ImmobileNorm {
  fonte: string;
  idEsterno: string;
  url?: string | null;

  tribunale?: string | null;
  annoRge?: number | null;
  numeroRge?: number | null;
  numeroLotto?: string | null;

  indirizzoRaw?: string | null;
  indirizzoNorm?: string | null;
  civico?: string | null;
  comune?: string | null;
  comuneCod?: string | null;

  lat?: number | null;
  lon?: number | null;
  /** precisione del geocoding: sotto "strada" la zona OMI non e' assegnabile */
  precisioneGeo?: string | null;
  /** "zona" = perimetro OMI risolto, "comune" = ripiego aggregato */
  livelloZona?: string | null;

  mq?: number | null;
  locali?: number | null;
  zonaOmi?: string | null;
  tipologiaOmi?: string;

  tipoVendita?: string | null;
  prezzo?: number | null;
  tipoPrezzo?: TipoPrezzo | null;
  valorePerizia?: number | null;
  nEsperimentiDeserti?: number;

  dataAsta?: string | null;
  termineOfferte?: string | null;

  statoOccupazionale?: string | null;
  conformitaUrb?: Conformita;
  vincoloCulturale?: boolean | null;
  sottotipoAsset?: string | null;

  fonti?: string[];
  noteMerge?: string[];
}

/** priorita' piu' bassa = fonte piu' autorevole. Allinearla a fonti.json. */
export type Registry = Record<string, { priorita: number }>;

// ---------------------------------------------------------------- indirizzi

const ABBREV: Record<string, string> = {
  "V.LE": "VIALE", VLE: "VIALE",
  "C.SO": "CORSO", CSO: "CORSO",
  "P.ZA": "PIAZZA", "P.ZZA": "PIAZZA", PZA: "PIAZZA",
  "P.LE": "PIAZZALE", PLE: "PIAZZALE",
  "L.GO": "LARGO", LGO: "LARGO",
  "V.": "VIA", V: "VIA",
  "S.": "SAN", S: "SAN", "SS.": "SANTI", STA: "SANTA",
  "STR.": "STRADA", "VIC.": "VICOLO", "LOC.": "LOCALITA",
};

const RUMORE =
  /\b(SNC|S\.N\.C\.|INT\.?\s*\d+\w?|INTERNO\s*\d+\w?|SCALA\s*\w+|PIANO\s*\w+|LOTTO\s*\d+|SUB\.?\s*\d+)\b/g;
const CIVICO = /(?:\bN\.?|\bNR\.?|\bCIV\.?)?\s*(\d+)\s*(\/?\s*[A-Z])?\s*$/;

function asciiUp(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

/** "V.le Monza, 12/A - int. 3" -> { indirizzo: "VIALE MONZA", civico: "12A" } */
export function normalizzaIndirizzo(
  raw: string | null | undefined,
): { indirizzo: string | null; civico: string | null } {
  if (!raw || !raw.trim()) return { indirizzo: null, civico: null };

  let s = asciiUp(raw).replace(/['`]/g, " ").replace(/[,\-–—;]+/g, " ");
  s = s.replace(RUMORE, " ").replace(/\s+/g, " ").trim();

  let civico: string | null = null;
  const m = CIVICO.exec(s);
  if (m && m[1]) {
    civico = (m[1] + (m[2] ?? "").replace("/", "").trim()).replace(/\s/g, "");
    s = s.slice(0, m.index).trim();
  }

  s = s
    .split(" ")
    .map((p) => ABBREV[p] ?? ABBREV[p.replace(/\.$/, "")] ?? p)
    .filter((p) => p && p !== ".")
    .join(" ")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return { indirizzo: s || null, civico };
}

/** Portali diversi arrotondano lo stesso bene: 82 e 80 mq devono collidere. */
export function mqBucket(mq: number | null | undefined, ampiezza = 10): number | null {
  if (mq == null || mq <= 0) return null;
  return Math.round(mq / ampiezza) * ampiezza;
}

// ---------------------------------------------------------------- chiavi

export function chiaveGiudiziaria(i: ImmobileNorm): string | null {
  if (!i.tribunale || !i.annoRge || !i.numeroRge) return null;
  const trib = asciiUp(i.tribunale).replace("TRIBUNALE DI ", "").trim();
  const lotto = (i.numeroLotto ?? "").trim().toUpperCase() || "-";
  return `RGE|${trib}|${i.annoRge}|${i.numeroRge}|${lotto}`;
}

export function chiaveGeofisica(i: ImmobileNorm): string | null {
  const ind = i.indirizzoNorm ?? normalizzaIndirizzo(i.indirizzoRaw).indirizzo;
  if (!ind || !i.comune) return null;
  const civ = i.civico ?? normalizzaIndirizzo(i.indirizzoRaw).civico ?? "-";
  return `GEO|${asciiUp(i.comune).trim()}|${ind}|${civ}|${mqBucket(i.mq) ?? "-"}|${i.locali ?? "-"}`;
}

export function chiavi(i: ImmobileNorm): string[] {
  return [chiaveGiudiziaria(i), chiaveGeofisica(i)].filter((k): k is string => k !== null);
}

// ---------------------------------------------------------------- merge

const CAMPI_MERGE = [
  "url", "tribunale", "annoRge", "numeroRge", "numeroLotto", "indirizzoRaw",
  "indirizzoNorm", "civico", "comune", "comuneCod", "mq", "locali", "zonaOmi",
  "tipoVendita", "valorePerizia", "dataAsta", "termineOfferte",
  "statoOccupazionale", "vincoloCulturale", "sottotipoAsset",
] as const satisfies readonly (keyof ImmobileNorm)[];

const ORDINE_CONFORMITA: Record<Conformita, number> = {
  insanabile: 0, sanabile: 1, non_verificata: 2, conforme: 3,
};
const RANK_PREZZO: Record<string, number> = {
  base_asta: 0, richiesta_reoco: 1, trattativa: 2,
};

const prio = (f: string, r: Registry): number => r[f]?.priorita ?? 99;

/**
 * Fonde due record dello stesso bene. Non fa medie: sui conflitti tiene il
 * valore della fonte autorevole e annota il conflitto in noteMerge, cosi'
 * resta ispezionabile invece di sparire.
 */
export function unisci(a: ImmobileNorm, b: ImmobileNorm, reg: Registry): ImmobileNorm {
  const [master, altro] =
    prio(a.fonte, reg) <= prio(b.fonte, reg) ? [{ ...a }, b] : [{ ...b }, a];

  master.fonti = [...new Set([...(master.fonti ?? [master.fonte]), ...(altro.fonti ?? [altro.fonte])])];
  master.noteMerge = [...(master.noteMerge ?? []), ...(altro.noteMerge ?? [])];

  for (const campo of CAMPI_MERGE) {
    const vm = master[campo];
    const va = altro[campo];
    if ((vm === null || vm === undefined || vm === "") && va !== null && va !== undefined && va !== "") {
      (master as Record<string, unknown>)[campo] = va;
    } else if (vm != null && va != null && vm !== va && (campo === "mq" || campo === "valorePerizia")) {
      master.noteMerge.push(`${campo}: ${String(vm)} (${master.fonte}) vs ${String(va)} (${altro.fonte})`);
    }
  }

  // il giudizio di conformita' piu' prudente vince sempre
  const cm = master.conformitaUrb ?? "non_verificata";
  const ca = altro.conformitaUrb ?? "non_verificata";
  if (ORDINE_CONFORMITA[ca] < ORDINE_CONFORMITA[cm]) master.conformitaUrb = ca;

  master.nEsperimentiDeserti = Math.max(a.nEsperimentiDeserti ?? 0, b.nEsperimentiDeserti ?? 0);

  // la base d'asta e' il dato ufficiale: prevale sul prezzo richiesto
  const rm = RANK_PREZZO[master.tipoPrezzo ?? ""] ?? 3;
  const ra = RANK_PREZZO[altro.tipoPrezzo ?? ""] ?? 3;
  if (ra < rm || master.prezzo == null) {
    if (altro.prezzo != null) {
      master.prezzo = altro.prezzo;
      master.tipoPrezzo = altro.tipoPrezzo ?? null;
    }
  }
  master.noteMerge = [...new Set(master.noteMerge)];
  return master;
}

/**
 * Union-find sulle chiavi: due record che condividono una chiave qualsiasi
 * sono lo stesso bene. Un record senza RGE puo' essere unito via chiave
 * geofisica a uno che ce l'ha: e' il caso pre-asta -> asta.
 */
export function deduplica(records: ImmobileNorm[], reg: Registry = {}): ImmobileNorm[] {
  const perChiave = new Map<string, ImmobileNorm>();
  let risultato: ImmobileNorm[] = [];

  for (const rec of records) {
    const ks = chiavi(rec);
    if (ks.length === 0) {
      risultato.push(rec); // non deduplicabile: passa cosi' com'e'
      continue;
    }

    const esistenti = new Set<ImmobileNorm>();
    for (const k of ks) {
      const e = perChiave.get(k);
      if (e) esistenti.add(e);
    }

    let corrente = rec;
    for (const altro of esistenti) {
      corrente = unisci(corrente, altro, reg);
      risultato = risultato.filter((x) => x !== altro);
    }

    risultato.push(corrente);
    for (const k of [...ks, ...chiavi(corrente)]) perChiave.set(k, corrente);
  }
  return risultato;
}
