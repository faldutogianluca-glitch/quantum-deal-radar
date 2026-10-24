/**
 * Deduplicazione cross-fonte. Zero dipendenze, funzioni pure.
 *
 * Problema che risolve: lo stesso lotto compare su Reperform, BNL, PVP e
 * sul portale della REOCO. Senza dedup la coda si riempie di duplicati e
 * il ranking diventa inutilizzabile.
 *
 * Principio: due record si fondono solo quando l'identita' e' CERTA. La
 * somiglianza di indirizzo, superficie e locali non basta: due appartamenti
 * dello stesso condominio, interni 2 e 3, entrambi 80 mq e tre locali, sono
 * due beni. Il confronto tra due record ha quattro esiti (vedi confronta()):
 *   - certa      stesso annuncio, stessa procedura e stesso lotto, oppure stesso
 *                indirizzo/superficie/locali con lo stesso interno o subalterno
 *                dichiarato da due fonti diverse;
 *   - candidata  somiglianza senza un identificativo che la certifichi: NON si
 *                fonde, si segnala per la verifica di una persona;
 *   - esclusa    identificativi incompatibili (procedura, lotto, interno, scala,
 *                piano, subalterno): nessuna fusione, mai;
 *   - diversa    nessuna relazione.
 *
 * Due chiavi, usate come indice di ricerca e per la memorizzazione:
 *   - giudiziaria  (tribunale, anno RGE, numero RGE, lotto) -> deterministica
 *   - geofisica    (comune, indirizzo, civico, mq bucket, locali, identita' dell'unita')
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
  /** identita' dell'unita' dentro l'edificio: se assenti si ricavano dall'indirizzo grezzo */
  interno?: string | null;
  scala?: string | null;
  piano?: string | null;
  subalterno?: string | null;
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
  /** tutte le origini fuse in questo record, nel formato "fonte:idEsterno" */
  idFonti?: string[];
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

// ---------------------------------------------------------------- unita'

export interface IdentitaUnita {
  interno: string | null;
  scala: string | null;
  piano: string | null;
  subalterno: string | null;
}

const RE_INTERNO = /\b(?:INT\.?|INTERNO)\s*([0-9]+[A-Z]?)\b/;
const RE_SCALA = /\bSCALA\s*([A-Z0-9]+)\b/;
const RE_PIANO = /\bPIANO\s*([A-Z0-9]+)\b/;
const RE_SUB = /\bSUB(?:ALTERNO)?\.?\s*([0-9]+)\b/;

const pulisci = (v: string | null | undefined): string | null => {
  const s = (v ?? "").toString().trim().toUpperCase();
  return s ? s : null;
};

/**
 * Identita' dell'unita' dentro l'edificio. I campi espliciti prevalgono; se
 * mancano si cercano nell'indirizzo grezzo ("int. 3", "scala B", "sub. 12").
 * Un valore assente significa "sconosciuto", non "uguale": non certifica nulla.
 */
export function identitaUnita(i: ImmobileNorm): IdentitaUnita {
  const raw = i.indirizzoRaw ? asciiUp(i.indirizzoRaw) : "";
  return {
    interno: pulisci(i.interno) ?? RE_INTERNO.exec(raw)?.[1] ?? null,
    scala: pulisci(i.scala) ?? RE_SCALA.exec(raw)?.[1] ?? null,
    piano: pulisci(i.piano) ?? RE_PIANO.exec(raw)?.[1] ?? null,
    subalterno: pulisci(i.subalterno) ?? RE_SUB.exec(raw)?.[1] ?? null,
  };
}

/** Un identificativo "forte" individua l'unita': interno o subalterno catastale. */
export function haIdentificativoForte(i: ImmobileNorm): boolean {
  const u = identitaUnita(i);
  return u.interno !== null || u.subalterno !== null;
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

/** Parte della chiave geofisica senza l'identita' dell'unita': serve a trovare i candidati. */
export function chiaveEdificio(i: ImmobileNorm): string | null {
  const ind = i.indirizzoNorm ?? normalizzaIndirizzo(i.indirizzoRaw).indirizzo;
  if (!ind || !i.comune) return null;
  const civ = i.civico ?? normalizzaIndirizzo(i.indirizzoRaw).civico ?? "-";
  return `GEO|${asciiUp(i.comune).trim()}|${ind}|${civ}|${mqBucket(i.mq) ?? "-"}|${i.locali ?? "-"}`;
}

/** Chiave geofisica completa: comprende l'identita' dell'unita' (interno, scala, piano, subalterno). */
export function chiaveGeofisica(i: ImmobileNorm): string | null {
  const base = chiaveEdificio(i);
  if (!base) return null;
  const u = identitaUnita(i);
  return `${base}|I:${u.interno ?? "-"}|S:${u.scala ?? "-"}|P:${u.piano ?? "-"}|SUB:${u.subalterno ?? "-"}`;
}

/**
 * Chiave con cui un record si memorizza. Deve essere unica per bene:
 *  - procedura giudiziaria completa: chiave giudiziaria, piu' l'identita' dell'unita' se nota
 *    (due unita' dello stesso lotto, interni diversi, non devono sovrascriversi);
 *  - senza procedura: chiave geofisica solo se c'e' un identificativo forte dell'unita'
 *    (interno o subalterno): senza, l'indirizzo non individua il bene;
 *  - altrimenti l'identita' dell'annuncio, fonte e id esterno.
 */
export function chiaveArchivio(i: ImmobileNorm): string {
  const u = identitaUnita(i);
  const suffisso = [u.interno && `I:${u.interno}`, u.scala && `S:${u.scala}`, u.piano && `P:${u.piano}`, u.subalterno && `SUB:${u.subalterno}`]
    .filter(Boolean).join(";");
  const giud = chiaveGiudiziaria(i);
  if (giud) return suffisso ? `${giud}|${suffisso}` : giud;
  if (haIdentificativoForte(i)) {
    const geo = chiaveGeofisica(i);
    if (geo) return geo;
  }
  return `FONTE|${i.fonte}|${i.idEsterno}`;
}

export function chiavi(i: ImmobileNorm): string[] {
  return [chiaveGiudiziaria(i), chiaveGeofisica(i)].filter((k): k is string => k !== null);
}

// ---------------------------------------------------------------- merge

const CAMPI_MERGE = [
  "url", "tribunale", "annoRge", "numeroRge", "numeroLotto", "indirizzoRaw",
  "indirizzoNorm", "civico", "interno", "scala", "piano", "subalterno", "comune", "comuneCod", "mq", "locali", "zonaOmi",
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
  // ogni origine fusa resta rintracciabile: senza questo un annuncio riletto da una fonte
  // che non e' quella del master non si riconoscerebbe piu' come gia' acquisito
  master.idFonti = [...new Set([
    ...(master.idFonti ?? [`${master.fonte}:${master.idEsterno}`]),
    ...(altro.idFonti ?? [`${altro.fonte}:${altro.idEsterno}`]),
  ])].sort();
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

  // vincolo culturale: se una fonte lo segnala, vale (il silenzio dell'altra non lo smentisce)
  if (altro.vincoloCulturale === true && master.vincoloCulturale !== true) {
    master.noteMerge.push(`vincoloCulturale: segnalato da ${altro.fonte}`);
    master.vincoloCulturale = true;
  }
  // stato occupazionale: il piu' sfavorevole per chi compra prevale; un conflitto resta annotato
  const occ = (x: string | null | undefined): number => {
    const t = (x ?? "").toLowerCase();
    if (!t) return -1;
    if (/occupat|inquilin|locat|abusiv|debitor/.test(t) && !/non\s+occupat/.test(t)) return 2;
    if (/libero|vuoto|non\s+occupat|disoccupat/.test(t)) return 0;
    return 1;
  };
  const om = occ(master.statoOccupazionale);
  const oa = occ(altro.statoOccupazionale);
  if (oa > om) {
    if (om >= 0) master.noteMerge.push(`statoOccupazionale: ${String(master.statoOccupazionale)} (${master.fonte}) vs ${String(altro.statoOccupazionale)} (${altro.fonte}): prevale il piu' cautelativo`);
    master.statoOccupazionale = altro.statoOccupazionale;
  } else if (om >= 0 && oa >= 0 && oa !== om) {
    master.noteMerge.push(`statoOccupazionale: ${String(master.statoOccupazionale)} (${master.fonte}) vs ${String(altro.statoOccupazionale)} (${altro.fonte})`);
  }

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

// ---------------------------------------------------------------- confronto

export type Relazione = "certa" | "candidata" | "esclusa" | "diversa";

export interface EsitoConfronto {
  relazione: Relazione;
  motivo: string;
}

const norm = (v: string | null | undefined): string => (v ?? "").toString().trim().toUpperCase();

function procedura(i: ImmobileNorm): { trib: string; anno: string; num: string; lotto: string } {
  return {
    trib: i.tribunale ? asciiUp(i.tribunale).replace("TRIBUNALE DI ", "").trim() : "",
    anno: i.annoRge ? String(i.annoRge) : "",
    num: i.numeroRge ? String(i.numeroRge) : "",
    lotto: norm(i.numeroLotto),
  };
}

/**
 * Confronta due record e dice se sono lo stesso bene. Funzione simmetrica:
 * confronta(a, b) e confronta(b, a) danno la stessa relazione.
 */
export function confronta(a: ImmobileNorm, b: ImmobileNorm): EsitoConfronto {
  // 1. stesso annuncio della stessa fonte riletto: aggiornamento, non nuovo bene
  if (a.fonte === b.fonte && a.idEsterno === b.idEsterno) {
    return { relazione: "certa", motivo: "stesso annuncio della stessa fonte" };
  }

  // 2. identificativi giudiziari: se anche uno solo e' incompatibile, il bene e' diverso
  const pa = procedura(a);
  const pb = procedura(b);
  for (const [campo, etichetta] of [["trib", "tribunale"], ["anno", "anno RGE"], ["num", "numero RGE"]] as const) {
    if (pa[campo] && pb[campo] && pa[campo] !== pb[campo]) {
      return { relazione: "esclusa", motivo: `${etichetta} diverso (${pa[campo]} / ${pb[campo]})` };
    }
  }
  if (pa.lotto && pb.lotto && pa.lotto !== pb.lotto) {
    return { relazione: "esclusa", motivo: `lotto diverso (${pa.lotto} / ${pb.lotto})` };
  }

  // 3. identificativi dell'unita': interno, scala, piano, subalterno incompatibili escludono
  const ua = identitaUnita(a);
  const ub = identitaUnita(b);
  for (const campo of ["interno", "scala", "piano", "subalterno"] as const) {
    if (ua[campo] && ub[campo] && ua[campo] !== ub[campo]) {
      return { relazione: "esclusa", motivo: `${campo} diverso (${ua[campo]} / ${ub[campo]})` };
    }
  }

  // 4. procedura giudiziaria completa e uguale su entrambi
  const completa = (p: ReturnType<typeof procedura>) => p.trib && p.anno && p.num;
  if (completa(pa) && completa(pb)) {
    if (pa.lotto === pb.lotto) {
      // senza lotto da entrambi i lati, due annunci DISTINTI della stessa fonte possono essere lotti
      // diversi non letti dal parser: si chiede una verifica invece di fonderli
      if (!pa.lotto && a.fonte === b.fonte) {
        return { relazione: "candidata", motivo: "stessa procedura nella stessa fonte, lotto non indicato: puo' essere un lotto diverso" };
      }
      return { relazione: "certa", motivo: pa.lotto ? "stessa procedura e stesso lotto" : "stessa procedura, lotto unico" };
    }
    return { relazione: "candidata", motivo: "stessa procedura, lotto indicato da una sola fonte" };
  }

  // 5. somiglianza geofisica: da sola non certifica l'identita'
  const ea = chiaveEdificio(a);
  const eb = chiaveEdificio(b);
  if (ea === null || eb === null || ea !== eb) {
    return { relazione: "diversa", motivo: "nessun elemento in comune" };
  }
  if (a.fonte === b.fonte) {
    return { relazione: "diversa", motivo: "annunci distinti della stessa fonte" };
  }
  // la scala, se dichiarata da un solo lato, non permette di dire che l'interno sia lo stesso:
  // "int. 3" puo' esistere su piu' scale dello stesso edificio
  const scalaIncerta = (ua.scala === null) !== (ub.scala === null);
  const forte =
    (ua.interno !== null && ua.interno === ub.interno && !scalaIncerta) ||
    (ua.subalterno !== null && ua.subalterno === ub.subalterno);
  if (forte) {
    return { relazione: "certa", motivo: "stesso edificio e stesso interno o subalterno dichiarato da due fonti" };
  }
  return {
    relazione: "candidata",
    motivo: "stesso indirizzo, superficie e locali, ma manca un identificativo che certifichi la stessa unita'",
  };
}

// ---------------------------------------------------------------- analisi

export interface CandidatoDuplicato {
  /** origine di ciascun lato, formato "fonte:idEsterno" */
  a: string;
  b: string;
  motivo: string;
}

export interface AnalisiDuplicati {
  risultato: ImmobileNorm[];
  candidati: CandidatoDuplicato[];
  /** gruppi di legami certi scartati perche' contengono una coppia incompatibile */
  ambigui: string[][];
}

const origine = (i: ImmobileNorm): string => `${i.fonte}:${i.idEsterno}`;

/** Indici di blocco: confronta solo record che condividono almeno uno di questi. */
function chiaviBlocco(i: ImmobileNorm): string[] {
  const k: string[] = [`ORI|${origine(i)}`];
  const p = procedura(i);
  if (p.trib && p.anno && p.num) k.push(`PRO|${p.trib}|${p.anno}|${p.num}`);
  const e = chiaveEdificio(i);
  if (e) {
    const ind = i.indirizzoNorm ?? normalizzaIndirizzo(i.indirizzoRaw).indirizzo;
    const civ = i.civico ?? normalizzaIndirizzo(i.indirizzoRaw).civico ?? "-";
    k.push(`EDI|${asciiUp(i.comune ?? "").trim()}|${ind}|${civ}`);
  }
  return k;
}

/**
 * Raggruppa i record che sono certamente lo stesso bene e segnala i candidati.
 *
 * Regole di sicurezza:
 *  - si fondono solo legami "certa"; i "candidata" restano record distinti;
 *  - un gruppo di legami certi che contiene una coppia "esclusa" (legame
 *    transitivo ambiguo: A=B, B=C ma A e C incompatibili) non viene fuso;
 *  - il risultato non dipende dall'ordine dei record in ingresso, tranne che per
 *    lo stesso annuncio riletto, dove prevale il record piu' recente (l'ultimo).
 */
export function analizzaDuplicati(records: ImmobileNorm[], reg: Registry = {}): AnalisiDuplicati {
  const n = records.length;
  const genitore = Array.from({ length: n }, (_, i) => i);
  const radice = (x: number): number => {
    while (genitore[x] !== x) { genitore[x] = genitore[genitore[x]!]!; x = genitore[x]!; }
    return x;
  };

  // indici di blocco
  const blocchi = new Map<string, number[]>();
  records.forEach((r, idx) => {
    for (const k of chiaviBlocco(r)) {
      const l = blocchi.get(k);
      if (l) l.push(idx); else blocchi.set(k, [idx]);
    }
  });

  const visti = new Set<string>();
  const certe: Array<[number, number]> = [];
  const candidatePairs: Array<[number, number, string]> = [];
  const escluse = new Set<string>();
  const chiaveCoppia = (x: number, y: number) => (x < y ? `${x}|${y}` : `${y}|${x}`);

  for (const lista of blocchi.values()) {
    for (let x = 0; x < lista.length; x++) {
      for (let y = x + 1; y < lista.length; y++) {
        const i = lista[x]!, j = lista[y]!;
        const kc = chiaveCoppia(i, j);
        if (visti.has(kc)) continue;
        visti.add(kc);
        const esito = confronta(records[i]!, records[j]!);
        if (esito.relazione === "certa") certe.push([i, j]);
        else if (esito.relazione === "candidata") candidatePairs.push([i, j, esito.motivo]);
        else if (esito.relazione === "esclusa") escluse.add(kc);
      }
    }
  }

  for (const [i, j] of certe) genitore[radice(i)] = radice(j);

  // gruppi con una coppia esclusa al loro interno: ambigui, non si fondono
  const gruppi = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = radice(i);
    const l = gruppi.get(r);
    if (l) l.push(i); else gruppi.set(r, [i]);
  }
  const ambigui: string[][] = [];
  const candidati: CandidatoDuplicato[] = [];
  const nonFondere = new Set<number>();
  for (const membri of gruppi.values()) {
    if (membri.length < 2) continue;
    let conflitto = false;
    for (let x = 0; x < membri.length && !conflitto; x++) {
      for (let y = x + 1; y < membri.length; y++) {
        const i = membri[x]!, j = membri[y]!;
        const kc = chiaveCoppia(i, j);
        const incompatibile = escluse.has(kc) || (!visti.has(kc) && confronta(records[i]!, records[j]!).relazione === "esclusa");
        if (incompatibile) { conflitto = true; break; }
      }
    }
    if (conflitto) {
      ambigui.push(membri.map((m) => origine(records[m]!)).sort());
      for (const m of membri) nonFondere.add(m);
    }
  }
  for (const [i, j] of certe) {
    if (nonFondere.has(i) || nonFondere.has(j)) {
      candidati.push({ a: origine(records[i]!), b: origine(records[j]!), motivo: "legame transitivo ambiguo: il gruppo contiene identificativi incompatibili" });
    }
  }
  for (const [i, j, motivo] of candidatePairs) {
    candidati.push({ a: origine(records[i]!), b: origine(records[j]!), motivo });
  }

  // fusione per gruppo, in ordine deterministico (priorita' della fonte, fonte, id; a parita' prevale l'ultimo in ingresso)
  const risultato: Array<{ primo: number; rec: ImmobileNorm }> = [];
  for (const membri of gruppi.values()) {
    if (membri.length === 1 || nonFondere.has(membri[0]!)) {
      for (const m of membri) risultato.push({ primo: m, rec: records[m]! });
      continue;
    }
    const ordinati = [...membri].sort((p, q) => {
      const rp = records[p]!, rq = records[q]!;
      return (
        prio(rp.fonte, reg) - prio(rq.fonte, reg) ||
        rp.fonte.localeCompare(rq.fonte) ||
        rp.idEsterno.localeCompare(rq.idEsterno) ||
        q - p
      );
    });
    let corrente = { ...records[ordinati[0]!]! };
    for (const m of ordinati.slice(1)) corrente = unisci(corrente, records[m]!, reg);
    risultato.push({ primo: Math.min(...membri), rec: corrente });
  }
  risultato.sort((a, b) => a.primo - b.primo);

  // candidati senza ripetizioni, ordine stabile
  const unici = new Map<string, CandidatoDuplicato>();
  for (const c of candidati) {
    const [x, y] = c.a < c.b ? [c.a, c.b] : [c.b, c.a];
    const k = `${x}||${y}`;
    if (!unici.has(k)) unici.set(k, { a: x, b: y, motivo: c.motivo });
  }
  return {
    risultato: risultato.map((r) => r.rec),
    candidati: [...unici.values()].sort((p, q) => (p.a + p.b).localeCompare(q.a + q.b)),
    ambigui,
  };
}

/** Compatibilita': restituisce solo i record dopo la fusione dei legami certi. */
export function deduplica(records: ImmobileNorm[], reg: Registry = {}): ImmobileNorm[] {
  return analizzaDuplicati(records, reg).risultato;
}
