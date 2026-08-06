/**
 * Ancora di valutazione esterna. Zero dipendenze, funzioni pure.
 *
 * Perche' esiste: uno score costruito sullo sconto rispetto al prezzo
 * richiesto e' autoreferenziale. Serve almeno una fonte di valore
 * indipendente dall'annuncio.
 *
 * Regola non negoziabile: se le stime divergono oltre soglia il modulo
 * NON produce un valore. Emette un flag di revisione. Una media fra stime
 * discordanti e' la forma piu' elegante di degrado silenzioso.
 *
 * Questo modulo NON calcola l'Opportunity Score: quello resta nella skill
 * OpenClaw, che e' l'unico posto dove vivono i pesi e la calibrazione.
 */

import type { ImmobileNorm } from "./dedup.js";

export type Metodo = "omi_min" | "omi_max" | "perizia" | "comps_richiesta";
export type Strategia = "flip" | "frazionamento" | "cambio_uso" | "affitto_breve";

export interface Stima {
  metodo: Metodo;
  valoreMq: number | null;
  valoreTotale: number;
  confidenza: number; // 0..1
  nota: string;
}

export interface Flag {
  tipo: string;
  dettaglio: string;
}

export interface Valutazione {
  stime: Stima[];
  valoreCentrale: number | null;
  divergenza: number | null;
  scontoSuValore: number | null;
  praticabile: boolean;
  flags: Flag[];
}

export interface QuotazioneOmi {
  vendMin?: number | null;
  vendMax?: number | null;
  semestre?: string;
}

export interface Parametri {
  /** Sconto richiesta -> rogito. ASSUNZIONE, non dato di mercato:
   *  la impara calibra_parametri.py dagli esiti reali. */
  haircutRichiestaRogito: number;
  sogliaDivergenza: number;
  giorniMinimiDd: Record<Strategia, number>;
  confidenza: { perizia: number; omi: number; compsRichiesta: number };
  /** moltiplicatore applicato all'OMI quando si ripiega sul livello comunale */
  penalitaZonaComune: number;
}

export const PARAMETRI_DEFAULT: Parametri = {
  haircutRichiestaRogito: 0.9,
  sogliaDivergenza: 0.2,
  giorniMinimiDd: { flip: 10, frazionamento: 21, cambio_uso: 35, affitto_breve: 14 },
  confidenza: { perizia: 0.85, omi: 0.55, compsRichiesta: 0.65 },
  penalitaZonaComune: 0.5,
};

export interface ContestoValutazione {
  /** chiave: `${comuneCod}|${zonaOmi}|${tipologia}` */
  quotazioni: Map<string, QuotazioneOmi>;
  compsMq?: number | null;
  nComps?: number;
  ntn?: number | null;
  strategia?: Strategia;
  oggi?: Date;
  parametri?: Partial<Parametri>;
}

function parseData(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(t);
  if (m) return new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!));
  return null;
}

const media = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

// ---------------------------------------------------------------- stime

function stimeOmi(i: ImmobileNorm, ctx: ContestoValutazione, p: Parametri): Stima[] {
  if (!i.comuneCod || !i.zonaOmi || !i.mq) return [];
  const tipologia = i.tipologiaOmi ?? "Abitazioni civili";
  const q = ctx.quotazioni.get(`${i.comuneCod}|${i.zonaOmi}|${tipologia}`);
  if (!q) return [];

  // ripiego di comune: la stima resta utilizzabile ma vale meno nella media
  // pesata, perche' la forbice aggregata e' molto piu' larga di quella di zona
  const ripiego = i.livelloZona === "comune" || i.zonaOmi === "*";
  const conf = p.confidenza.omi * (ripiego ? p.penalitaZonaComune : 1);
  const out: Stima[] = [];
  // due stime, min e max: la forbice OMI supera spesso il 30% e collassarla
  // in una media butta via l'informazione piu' utile
  for (const [metodo, v] of [["omi_min", q.vendMin], ["omi_max", q.vendMax]] as const) {
    if (v) {
      out.push({
        metodo, valoreMq: v, valoreTotale: v * i.mq, confidenza: conf,
        nota: ripiego
          ? `aggregato comunale ${i.comuneCod}, sem. ${q.semestre ?? "?"} (Agenzia Entrate - OMI)`
          : `zona ${i.zonaOmi}, sem. ${q.semestre ?? "?"} (Agenzia Entrate - OMI)`,
      });
    }
  }
  return out;
}

function stimaPerizia(i: ImmobileNorm, p: Parametri): Stima[] {
  if (!i.valorePerizia) return [];
  return [{
    metodo: "perizia",
    valoreMq: i.mq ? i.valorePerizia / i.mq : null,
    valoreTotale: i.valorePerizia,
    confidenza: p.confidenza.perizia,
    nota: "stima CTU: incorpora gia' decurtazioni per stato e procedura",
  }];
}

function stimaComps(i: ImmobileNorm, ctx: ContestoValutazione, p: Parametri): Stima[] {
  const n = ctx.nComps ?? 0;
  if (!ctx.compsMq || !i.mq || n < 3) return [];
  const netto = ctx.compsMq * p.haircutRichiestaRogito;
  return [{
    metodo: "comps_richiesta",
    valoreMq: netto,
    valoreTotale: netto * i.mq,
    confidenza: p.confidenza.compsRichiesta * Math.min(1, n / 8),
    nota: `${n} comparabili (prezzi richiesti), haircut ${(p.haircutRichiestaRogito * 100).toFixed(0)}%`,
  }];
}

// ---------------------------------------------------------------- motore

export function valuta(i: ImmobileNorm, ctx: ContestoValutazione): Valutazione {
  const p: Parametri = { ...PARAMETRI_DEFAULT, ...(ctx.parametri ?? {}) };
  const strategia = ctx.strategia ?? "flip";
  const oggi = ctx.oggi ?? new Date();
  const flags: Flag[] = [];
  let praticabile = true;

  const stime = [...stimeOmi(i, ctx, p), ...stimaPerizia(i, p), ...stimaComps(i, ctx, p)];

  // --- hard filter temporale, prima di qualunque calcolo economico
  const termine = parseData(i.termineOfferte) ?? parseData(i.dataAsta);
  if (termine) {
    const giorni = Math.floor((termine.getTime() - oggi.getTime()) / 86_400_000);
    const minimi = p.giorniMinimiDd[strategia];
    if (giorni < 0) {
      praticabile = false;
      flags.push({ tipo: "scaduto", dettaglio: `termine ${termine.toISOString().slice(0, 10)} passato` });
    } else if (giorni < minimi) {
      praticabile = false;
      flags.push({
        tipo: "non_praticabile",
        dettaglio: `${giorni} giorni al termine, ne servono almeno ${minimi} per '${strategia}'`,
      });
    }
  }

  // --- hard filter regolatorio
  if (i.conformitaUrb === "insanabile" && (strategia === "frazionamento" || strategia === "cambio_uso")) {
    praticabile = false;
    flags.push({ tipo: "insanabile", dettaglio: "abuso insanabile: frazionamento e cambio d'uso preclusi" });
  }
  if (i.vincoloCulturale) {
    flags.push({
      tipo: "vincolo_culturale",
      dettaglio: "possibile vincolo D.Lgs. 42/2004: tempi autorizzativi lunghi, verifica con tecnico",
    });
  }

  // --- triangolazione
  const punti: number[] = stime
    .filter((s) => s.metodo === "perizia" || s.metodo === "comps_richiesta")
    .map((s) => s.valoreTotale);
  const omi = stime.filter((s) => s.metodo.startsWith("omi")).map((s) => s.valoreTotale);
  if (omi.length) punti.push(media(omi)); // OMI entra come UN punto, non due

  if (punti.length === 0) {
    flags.push({ tipo: "dato_mancante", dettaglio: "nessuna base di stima disponibile" });
    return { stime, valoreCentrale: null, divergenza: null, scontoSuValore: null, praticabile, flags };
  }

  const lo = Math.min(...punti);
  const hi = Math.max(...punti);
  const divergenza = punti.length > 1 ? (hi - lo) / media(punti) : 0;

  let valoreCentrale: number | null;
  if (punti.length > 1 && divergenza > p.sogliaDivergenza) {
    valoreCentrale = null;
    flags.push({
      tipo: "divergenza_valutativa",
      dettaglio: `stime da ${Math.round(lo).toLocaleString("it-IT")} a ${Math.round(hi).toLocaleString("it-IT")} EUR ` +
        `(${(divergenza * 100).toFixed(0)}%): nessun valore centrale, serve revisione umana`,
    });
  } else {
    const pesi = stime.reduce((a, s) => a + s.confidenza, 0);
    valoreCentrale = stime.reduce((a, s) => a + s.confidenza * s.valoreTotale, 0) / pesi;
  }

  if (punti.length === 1) {
    flags.push({ tipo: "stima_singola", dettaglio: "una sola base di stima: nessuna validazione incrociata" });
  }
  if (i.livelloZona === "comune" || i.zonaOmi === "*") {
    flags.push({
      tipo: "zona_omi_non_risolta",
      dettaglio: `quotazione al livello di comune${i.precisioneGeo ? ` (geocoding: ${i.precisioneGeo})` : ""}: ` +
        "forbice larga, stima meno affidabile di una zonale",
    });
  }
  if (ctx.ntn != null && ctx.ntn < 50) {
    flags.push({
      tipo: "bassa_liquidita",
      dettaglio: `NTN ${ctx.ntn.toFixed(0)}: mercato sottile, uscita lenta -> carrying cost alto`,
    });
  }

  const scontoSuValore =
    valoreCentrale && i.prezzo ? 1 - i.prezzo / valoreCentrale : null;

  return { stime, valoreCentrale, divergenza, scontoSuValore, praticabile, flags };
}
