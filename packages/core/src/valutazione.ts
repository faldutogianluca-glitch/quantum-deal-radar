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

/**
 * Esito della praticabilita'. Tre stati distinti, perche' "nessun blocco noto" non e'
 * una verifica positiva:
 *  - positivo      dati indispensabili presenti, nessun blocco, stime coerenti;
 *  - negativo      almeno un blocco accertato (termine scaduto o troppo vicino, abuso insanabile);
 *  - non_valutato  manca un dato indispensabile o le stime divergono: non si puo' dire ne' si' ne' no.
 * Non e' il verdetto commerciale GO/WATCH/SCARTA, che vive nella skill di screening.
 */
export type EsitoPraticabilita = "positivo" | "negativo" | "non_valutato";

export interface Mancante {
  dato: string;
  prossimoControllo: string;
}

export interface Valutazione {
  stime: Stima[];
  valoreCentrale: number | null;
  divergenza: number | null;
  scontoSuValore: number | null;
  /** true = positivo, false = negativo, null = non valutato (vedi `esito`) */
  praticabile: boolean | null;
  esito: EsitoPraticabilita;
  /** disponibilita' dei dati economici, separata dall'esito */
  datiEconomici: "assenti" | "parziali" | "completi";
  /** vincoli operativi (termini, conformita'), separati dai dati economici */
  vincoli: "bloccanti" | "nessuno_noto" | "non_verificabili";
  /** perche' non e' valutato e cosa controllare per sbloccarlo */
  mancanti: Mancante[];
  /** forbice OMI mantenuta come intervallo, senza collassarla */
  intervalloOmi: { min: number; max: number } | null;
  /** i pesi di confidenza sono assunzioni di lavoro, non un'accuratezza misurata */
  pesiEuristici: true;
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
  /**
   * Politica sul semestre delle quotazioni OMI. Valori di partenza prudenti, NON calibrati
   * su dati reali: vanno rivisti quando esistono esiti osservati.
   *  - maxEtaSemestri: oltre questa distanza dal semestre corrente la quotazione e' obsoleta
   *  - obsoleto / sconosciuto: "avvisa" (solo flag), "penalizza" (flag e confidenza ridotta),
   *    "non_valutare" (l'esito diventa non_valutato)
   */
  semestreOmi: {
    maxEtaSemestri: number;
    obsoleto: "avvisa" | "penalizza" | "non_valutare";
    sconosciuto: "avvisa" | "penalizza" | "non_valutare";
    penalita: number;
  };
}

export const PARAMETRI_DEFAULT: Parametri = {
  haircutRichiestaRogito: 0.9,
  sogliaDivergenza: 0.2,
  giorniMinimiDd: { flip: 10, frazionamento: 21, cambio_uso: 35, affitto_breve: 14 },
  confidenza: { perizia: 0.85, omi: 0.55, compsRichiesta: 0.65 },
  penalitaZonaComune: 0.5,
  semestreOmi: { maxEtaSemestri: 2, obsoleto: "non_valutare", sconosciuto: "penalizza", penalita: 0.7 },
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
  let anno: number, mese: number, giorno: number;
  // ISO con o senza orario (2026-12-30, 2026-12-30T10:00:00, 2026-12-30 10:00)
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(t);
  if (m) { anno = +m[1]!; mese = +m[2]!; giorno = +m[3]!; }
  else {
    m = /^(\d{2})[/-](\d{2})[/-](\d{4})(?:[ T,]+\d{1,2}[:.]\d{2}(?::\d{2})?)?$/.exec(t);
    if (!m) return null;
    giorno = +m[1]!; mese = +m[2]!; anno = +m[3]!;
  }
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  // una data impossibile (31/09) non si trasforma silenziosamente nel primo del mese dopo
  if (data.getUTCFullYear() !== anno || data.getUTCMonth() !== mese - 1 || data.getUTCDate() !== giorno) return null;
  return data;
}

/** "2026-1" -> indice progressivo del semestre (anno * 2 + 0|1). Null se il formato non e' riconosciuto. */
export function indiceSemestre(s: string | null | undefined): number | null {
  const m = /^(\d{4})\s*[-_/ ]?\s*[sS]?\s*([12])$/.exec((s ?? "").trim());
  return m ? Number(m[1]) * 2 + (Number(m[2]) - 1) : null;
}

const semestreCorrente = (oggi: Date): number => oggi.getUTCFullYear() * 2 + (oggi.getUTCMonth() < 6 ? 0 : 1);

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
  const p: Parametri = {
    ...PARAMETRI_DEFAULT,
    ...(ctx.parametri ?? {}),
    semestreOmi: { ...PARAMETRI_DEFAULT.semestreOmi, ...(ctx.parametri?.semestreOmi ?? {}) },
  };
  const strategia = ctx.strategia ?? "flip";
  const oggi = ctx.oggi ?? new Date();
  const flags: Flag[] = [];
  const mancanti: Mancante[] = [];
  let bloccato = false;
  let nonValutabile = false;

  const stime = [...stimeOmi(i, ctx, p), ...stimaPerizia(i, p), ...stimaComps(i, ctx, p)];

  // --- semestre delle quotazioni OMI: una quotazione vecchia o senza data non si usa come se fosse attuale
  const stimeOmiTrovate = stime.filter((s) => s.metodo.startsWith("omi"));
  if (stimeOmiTrovate.length) {
    const sem = ctx.quotazioni.get(`${i.comuneCod}|${i.zonaOmi}|${i.tipologiaOmi ?? "Abitazioni civili"}`)?.semestre;
    const idx = indiceSemestre(sem);
    let problema: "obsoleto" | "sconosciuto" | null = null;
    if (idx === null) problema = "sconosciuto";
    else if (semestreCorrente(oggi) - idx > p.semestreOmi.maxEtaSemestri) problema = "obsoleto";
    if (problema) {
      const politica = p.semestreOmi[problema];
      flags.push({
        tipo: `omi_semestre_${problema}`,
        dettaglio: problema === "sconosciuto"
          ? `semestre OMI non riconoscibile (${sem ?? "assente"}): l'eta' della quotazione non e' verificabile`
          : `quotazione OMI del semestre ${sem}: oltre ${p.semestreOmi.maxEtaSemestri} semestri dal corrente`,
      });
      if (politica === "penalizza") {
        for (const s of stimeOmiTrovate) s.confidenza *= p.semestreOmi.penalita;
      } else if (politica === "non_valutare") {
        nonValutabile = true;
        mancanti.push({
          dato: `quotazione OMI aggiornata (semestre ${sem ?? "sconosciuto"})`,
          prossimoControllo: "caricare le quotazioni OMI dell'ultimo semestre pubblicato dall'Agenzia delle Entrate",
        });
      }
    }
  }

  // --- senza prezzo non c'e' sconto da calcolare ne' soglia da rispettare: non si puo' dire "praticabile"
  if (i.prezzo === null || i.prezzo === undefined || !(i.prezzo > 0)) {
    nonValutabile = true;
    flags.push({ tipo: "prezzo_mancante", dettaglio: "prezzo di vendita assente: sconto e margine non calcolabili" });
    mancanti.push({
      dato: "prezzo (base d'asta o prezzo richiesto)",
      prossimoControllo: "leggere l'avviso di vendita o l'annuncio e registrare il prezzo",
    });
  }

  // --- hard filter temporale, prima di qualunque calcolo economico
  const termine = parseData(i.termineOfferte) ?? parseData(i.dataAsta);
  let terminePresente = false;
  if (termine) {
    terminePresente = true;
    const giorni = Math.floor((termine.getTime() - oggi.getTime()) / 86_400_000);
    const minimi = p.giorniMinimiDd[strategia];
    if (giorni < 0) {
      bloccato = true;
      flags.push({ tipo: "scaduto", dettaglio: `termine ${termine.toISOString().slice(0, 10)} passato` });
    } else if (giorni < minimi) {
      bloccato = true;
      flags.push({
        tipo: "non_praticabile",
        dettaglio: `${giorni} giorni al termine, ne servono almeno ${minimi} per '${strategia}'`,
      });
    }
  } else if (i.termineOfferte || i.dataAsta) {
    // una data presente ma non leggibile e' un dato mancante, non un termine lontano
    flags.push({ tipo: "termine_illeggibile", dettaglio: `data non interpretabile (${i.termineOfferte ?? i.dataAsta})` });
  }
  // In una vendita giudiziaria il termine e' indispensabile: senza, non si puo' dire che ci sia tempo.
  const vendita_giudiziaria = Boolean((i.tribunale && i.numeroRge) || i.tipoPrezzo === "base_asta");
  if (!terminePresente && vendita_giudiziaria) {
    nonValutabile = true;
    flags.push({ tipo: "termine_mancante", dettaglio: "vendita giudiziaria senza data d'asta o termine offerte" });
    mancanti.push({
      dato: "data d'asta o termine per le offerte",
      prossimoControllo: "leggere l'avviso di vendita sul Portale delle vendite pubbliche o nell'ordinanza del giudice",
    });
  }

  // --- hard filter regolatorio
  if (i.conformitaUrb === "insanabile" && (strategia === "frazionamento" || strategia === "cambio_uso")) {
    bloccato = true;
    flags.push({ tipo: "insanabile", dettaglio: "abuso insanabile: frazionamento e cambio d'uso preclusi" });
  }
  if (i.vincoloCulturale) {
    flags.push({
      tipo: "vincolo_culturale",
      dettaglio: "possibile vincolo D.Lgs. 42/2004: tempi autorizzativi lunghi, verifica con tecnico",
    });
  }
  const conformitaNota = i.conformitaUrb && i.conformitaUrb !== "non_verificata";

  // --- triangolazione. L'OMI e' UNA fonte: min e max sono gli estremi di un intervallo e
  // insieme valgono una volta sola, non due.
  const totaliOmi = stime.filter((s) => s.metodo.startsWith("omi")).map((s) => s.valoreTotale);
  const intervalloOmi = totaliOmi.length
    ? { min: Math.min(...totaliOmi), max: Math.max(...totaliOmi) }
    : null;
  const nOmi = totaliOmi.length;
  const peso = (s: Stima): number => (s.metodo.startsWith("omi") ? s.confidenza / nOmi : s.confidenza);
  if (nOmi === 1) {
    flags.push({ tipo: "omi_estremo_singolo", dettaglio: "disponibile un solo estremo della forbice OMI: la stima vale come punto, non come intervallo" });
  }

  const punti: number[] = stime
    .filter((s) => s.metodo === "perizia" || s.metodo === "comps_richiesta")
    .map((s) => s.valoreTotale);
  if (totaliOmi.length) punti.push(media(totaliOmi));

  const finale = (valoreCentrale: number | null, divergenza: number | null, scontoSuValore: number | null): Valutazione => {
    const esito: EsitoPraticabilita = bloccato ? "negativo" : nonValutabile || punti.length === 0 || valoreCentrale === null ? "non_valutato" : "positivo";
    if (esito === "non_valutato" && punti.length > 0 && valoreCentrale === null && !mancanti.length) {
      mancanti.push({ dato: "valore centrale", prossimoControllo: "revisione umana delle stime discordanti" });
    }
    const datiEconomici: Valutazione["datiEconomici"] =
      punti.length === 0 ? "assenti" : valoreCentrale === null || punti.length === 1 || !i.prezzo ? "parziali" : "completi";
    const vincoli: Valutazione["vincoli"] = bloccato
      ? "bloccanti"
      : terminePresente || conformitaNota ? "nessuno_noto" : "non_verificabili";
    return {
      stime, valoreCentrale, divergenza, scontoSuValore,
      praticabile: esito === "positivo" ? true : esito === "negativo" ? false : null,
      esito, datiEconomici, vincoli, mancanti, intervalloOmi, pesiEuristici: true, flags,
    };
  };

  if (punti.length === 0) {
    flags.push({ tipo: "dato_mancante", dettaglio: "nessuna base di stima disponibile" });
    mancanti.push({
      dato: "una base di stima (perizia, quotazione OMI della zona, comparabili)",
      prossimoControllo: "leggere la perizia o caricare le quotazioni OMI e risolvere la zona dell'immobile",
    });
    return finale(null, null, null);
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
    mancanti.push({ dato: "valore centrale affidabile", prossimoControllo: "revisione umana delle stime discordanti" });
  } else {
    const pesi = stime.reduce((a, s) => a + peso(s), 0);
    valoreCentrale = stime.reduce((a, s) => a + peso(s) * s.valoreTotale, 0) / pesi;
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

  return finale(valoreCentrale, divergenza, scontoSuValore);
}
