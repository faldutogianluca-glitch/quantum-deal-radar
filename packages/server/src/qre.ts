import type { Stima } from "@qdr/core";

import type { StimaComparabili } from "./comparabili.js";

/**
 * Underwriting QRE, binario B (unita' singola). Funzioni pure: numeri e
 * soglie sono quelli di docs/economia-deal-binario-b.md.
 *
 * E' un Gate 0, non una valutazione: dice se vale la pena aprire la perizia,
 * non se comprare. Tre domande, in quest'ordine:
 *
 * 1. Quanto si puo' pagare al massimo? Il prezzo che rispetta *tutti* i
 *    vincoli insieme: margine, IRR (che dipende dalla durata) e uno stress
 *    test in cui il capitale deve tornare indietro. Vince il piu' severo, e
 *    il risultato dice quale.
 * 2. A quanto si chiudera' davvero? In asta non al prezzo base: lo storico
 *    QRE dice 1,20 volte la base in mediana per le unita' piccole. In
 *    trattativa (REOCO, banche) non al prezzo richiesto, ma sotto. Il
 *    moltiplicatore si ricalibra sugli esiti registrati (vedi esiti.ts).
 * 3. Il prezzo atteso sta sotto il massimo? Se no, si vince solo con poca
 *    concorrenza, e va detto.
 *
 * Il valore di uscita viene dai comparabili ristrutturati vicini quando sono
 * abbastanza e abbastanza omogenei (comparabili.ts); altrimenti dal massimo
 * OMI di zona, che descrive un immobile in buono stato. Lo stress test
 * sull'uscita segue l'incertezza della fonte: con i comparabili e' la loro
 * dispersione misurata, con l'OMI e' fisso, e piu' severo quando la zona non
 * e' risolta e la quotazione e' l'aggregato comunale.
 */

export interface ParametriQre {
  /** Margine lordo da portare in offerta. */
  margineObiettivo: number;
  /** Margine minimo assoluto del metodo: oltre il prezzo che lo rispetta non si sale. */
  margineTetto: number;
  /** IRR annuo minimo. Con l'esborso a t0 equivale a un margine che cresce con la durata. */
  irrMinimo: number;
  costiVendita: number;
  /** Ristrutturazione leggera, EUR/mq. */
  lavoriMq: number;
  imprevisti: number;
  praticheMq: number;
  /** Una tantum: APE 300, utenze 500, ipotecaria e catastale 100, notaio 3.000. */
  costiUnaTantum: number;
  /** Gestione durante l'operazione (condominio, IMU, assicurazione): 5.000 EUR l'anno. */
  gestioneMese: number;
  registro: number;
  /** Durata di riferimento: aggiudicazione e saldo, lavori, vendita. */
  mesi: number;
  mqMin: number;
  mqMax: number;
  stress: {
    /** Uscita piu' bassa, con la zona OMI risolta. */
    uscitaZona: number;
    /** Uscita piu' bassa quando la quotazione e' l'aggregato comunale. E' anche il
     *  massimo con i comparabili: oltre, la stima non sarebbe affidabile. */
    uscitaComune: number;
    /** Con i comparabili lo stress e' la loro dispersione, ma mai sotto questo valore. */
    uscitaComparabiliMin: number;
    lavori: number;
    mesiExtra: number;
    /** Margine minimo nello scenario avverso: zero, il capitale torna indietro. */
    margine: number;
  };
}

export const PARAMETRI_QRE_B: ParametriQre = {
  margineObiettivo: 0.3,
  margineTetto: 0.2,
  irrMinimo: 0.12,
  costiVendita: 0.03,
  lavoriMq: 400,
  imprevisti: 0.05,
  praticheMq: 10,
  costiUnaTantum: 3_900,
  gestioneMese: 5_000 / 12,
  registro: 0.09,
  mesi: 12,
  mqMin: 60,
  mqMax: 150,
  stress: { uscitaZona: 0.15, uscitaComune: 0.25, uscitaComparabiliMin: 0.1, lavori: 0.15, mesiExtra: 6, margine: 0 },
};

/** Il vincolo che fissa il prezzo massimo: e' l'informazione su cosa negoziare. */
export type Vincolo = "margine" | "irr" | "stress";

export interface Scenario {
  valore: number;
  mesi: number;
  fattoreLavori: number;
  margineRichiesto: number;
}

/** Costo totale a un dato prezzo: lineare nel prezzo, perche' il registro lo e'. */
export function costoTotale(prezzo: number, mq: number, s: Pick<Scenario, "mesi" | "fattoreLavori">, p: ParametriQre): number {
  const lavori = mq * (p.lavoriMq * (1 + p.imprevisti) * s.fattoreLavori + p.praticheMq);
  return prezzo * (1 + p.registro) + lavori + p.costiUnaTantum + p.gestioneMese * s.mesi;
}

/** Prezzo che porta lo scenario esattamente al margine richiesto. Formula chiusa:
 *  P = (V x (1 - vendita) / (1 + margine) - lavori - una tantum - gestione) / (1 + registro) */
export function prezzoPerScenario(mq: number, s: Scenario, p: ParametriQre): number {
  const netto = s.valore * (1 - p.costiVendita);
  const altri = costoTotale(0, mq, s, p);
  return (netto / (1 + s.margineRichiesto) - altri) / (1 + p.registro);
}

/** Margine lordo di uno scenario a un prezzo dato. */
export function margine(prezzo: number, mq: number, s: Omit<Scenario, "margineRichiesto">, p: ParametriQre): number {
  return (s.valore * (1 - p.costiVendita)) / costoTotale(prezzo, mq, s, p) - 1;
}

/** IRR annuo con esborso a t0 e incasso a fine operazione, senza leva. */
export const irrDaMargine = (m: number, mesi: number): number => (1 + m) ** (12 / mesi) - 1;
/** Margine che serve per ottenere un IRR dato in una durata data. */
export const margineDaIrr = (irr: number, mesi: number): number => (1 + irr) ** (mesi / 12) - 1;

/** Prezzo massimo che rispetta insieme margine, IRR e stress test, e il vincolo che lo fissa. */
export function prezzoMassimo(
  valore: number,
  mq: number,
  margineBase: number,
  /** Calo dell'uscita nello stress test, come frazione (0,15 = -15%). */
  stressUscita: number,
  p: ParametriQre = PARAMETRI_QRE_B,
): { prezzo: number; vincolo: Vincolo } {
  const base = { valore, mesi: p.mesi, fattoreLavori: 1 };
  const candidati: { prezzo: number; vincolo: Vincolo }[] = [
    { vincolo: "margine", prezzo: prezzoPerScenario(mq, { ...base, margineRichiesto: margineBase }, p) },
    { vincolo: "irr", prezzo: prezzoPerScenario(mq, { ...base, margineRichiesto: margineDaIrr(p.irrMinimo, p.mesi) }, p) },
    {
      vincolo: "stress",
      prezzo: prezzoPerScenario(mq, {
        valore: valore * (1 - stressUscita),
        mesi: p.mesi + p.stress.mesiExtra,
        fattoreLavori: 1 + p.stress.lavori,
        margineRichiesto: p.stress.margine,
      }, p),
    },
  ];
  // a parita' vince il primo: il margine e' il vincolo che il metodo nomina per primo
  const piuSevero = candidati.reduce((a, b) => (b.prezzo < a.prezzo ? b : a));
  // sotto zero lavori e costi superano il valore: si mostra zero, non un prezzo negativo
  return { prezzo: Math.max(0, piuSevero.prezzo), vincolo: piuSevero.vincolo };
}

// ---------------------------------------------------------------- asta

/** Moltiplicatore atteso fra prezzo base e aggiudicazione, con la sua provenienza. */
export interface Moltiplicatore {
  valore: number;
  /** Esiti su cui e' calibrato; zero = default dallo storico. */
  n: number;
  fonte: string;
}

/**
 * Storico QRE (file "Aste in evidenza", 19 aste giudiziarie 2022-2026 con
 * aggiudicazione registrata): mediana 1,20 volte il prezzo base. Per le vendite
 * statali non c'e' ancora uno storico: si parte dallo stesso valore, e lo si
 * dichiara, finche' gli esiti registrati non lo correggono.
 */
export const MOLTIPLICATORE_DEFAULT: Moltiplicatore = {
  valore: 1.2,
  n: 0,
  fonte: "storico QRE: 19 aste giudiziarie 2022-2026, mediana 1,20 x base",
};

/**
 * Vendite statali. 126 aggiudicazioni della Vetrina del Demanio (2015-2026,
 * docs/dati/demanio_aggiudicazioni.csv) chiudono in mediana a 1,02 volte la
 * base, le residenziali a 1,02 con terzo quartile 1,17: molta meno gara delle
 * giudiziarie. Nessuna e' pero' in Lombardia, dove la domanda e' piu' forte,
 * quindi il punto di partenza e' 1,10, fra la mediana nazionale e il terzo
 * quartile, finche' gli esiti lombardi registrati non lo sostituiscono.
 */
export const MOLTIPLICATORE_STATALE_DEFAULT: Moltiplicatore = {
  valore: 1.1,
  n: 0,
  fonte: "Vetrina Demanio: 126 aggiudicazioni 2015-2026, mediana 1,02 x base (nessuna in Lombardia); prudenza a 1,10",
};

/**
 * In trattativa (REOCO, banche, vendite dirette) si chiude sotto la richiesta.
 * Il punto di partenza e' la riduzione media misurata da Banca d'Italia per
 * Milano e cintura (6,7%, II trimestre 2026): venditori istituzionali possono
 * concedere di piu', quindi e' un'ipotesi prudente, che gli esiti registrati
 * correggono.
 */
export const MOLTIPLICATORE_TRATTATIVA_DEFAULT: Moltiplicatore = {
  valore: 0.933,
  n: 0,
  fonte: "Banca d'Italia, sondaggio abitazioni II trim. 2026: sconto medio 6,7% sulla richiesta, Nord-Ovest urbano",
};

/** Nelle aste giudiziarie si puo' offrire fino a un quarto sotto la base (art. 571 c.p.c.). */
export const RIDUZIONE_OFFERTA_MINIMA = 0.75;

// ---------------------------------------------------------------- esito

/**
 * - `passa`                  : anche il prezzo atteso di aggiudicazione sta entro l'offerta
 * - `al_limite`              : il prezzo atteso supera l'offerta ma sta entro il tetto
 * - `solo_poca_concorrenza`  : si entra (offerta minima entro il tetto), ma il prezzo
 *                              atteso supera il tetto: si vince solo se in pochi
 * - `scarta`                 : neppure l'offerta minima sta entro il tetto (in trattativa:
 *                              neppure il prezzo atteso di chiusura)
 * - `fuori_perimetro`        : non e' un'unita' residenziale in piena proprieta' (usufrutto,
 *                              quote, box, lastrici...): il binario B non la considera
 * - `fuori_taglio`           : superficie fuori dal binario B (i numeri restano calcolati)
 * - `dati_mancanti`          : manca superficie, valore OMI o prezzo
 */
export type EsitoQre =
  | "passa" | "al_limite" | "solo_poca_concorrenza" | "scarta" | "fuori_perimetro" | "fuori_taglio" | "dati_mancanti";

export type FonteValore = "comparabili" | "omi_ottimo" | "omi_max";

export interface DettaglioQre {
  uscita: {
    fonte: FonteValore | null;
    stress: number;
    omiMaxMq: number | null;
    /** Comparabili / massimo OMI - 1, quando ci sono entrambi: oltre il 25% merita uno sguardo. */
    divergenzaOmi: number | null;
    comparabili: StimaComparabili | null;
  };
  /** Margine e IRR comprando all'offerta, nel caso base e nello stress test. */
  base: { margine: number; irr: number } | null;
  stress: { margine: number; irr: number } | null;
  moltiplicatore: Moltiplicatore;
  ipotesi: string[];
}

export interface PrezzoMaxQre {
  valoreMq: number | null;
  valoreFonte: FonteValore | null;
  pmaxObiettivo: number | null;
  pmaxTetto: number | null;
  vincolo: Vincolo | null;
  /** Offerta minima ammessa dall'avviso. */
  prezzoIngresso: number | null;
  /** Prezzo a cui ci si aspetta che l'asta si chiuda. */
  prezzoAtteso: number | null;
  esito: EsitoQre;
  motivo: string;
  dettaglio: DettaglioQre;
}

export interface InputQre {
  mq: number | null | undefined;
  prezzo: number | null | undefined;
  /** Massimo OMI di zona, stato NORMALE, EUR/mq. */
  valoreMq: number | null | undefined;
  /** Minimo OMI di zona, stato OTTIMO, EUR/mq: la proxy del ristrutturato, quando la zona lo quota. */
  valoreMqOttimo?: number | null;
  /** Stima dai comparabili: se affidabile, sostituisce l'OMI come valore di uscita. */
  comparabili?: StimaComparabili | null;
  /** false quando la quotazione e' l'aggregato comunale: stress piu' severo. */
  zonaRisolta?: boolean;
  /** Asta giudiziaria: l'offerta minima e' tre quarti della base. */
  giudiziaria?: boolean;
  /** Prezzo richiesto e non base d'asta: si negozia, non c'e' gara. */
  trattativa?: boolean;
  moltiplicatore?: Moltiplicatore;
  /** Perche' il lotto non e' un'unita' residenziale in piena proprieta', se non lo e'. */
  fuoriPerimetro?: string | null;
}

/**
 * Il perimetro del binario B: unita' residenziale in piena proprieta'. Le vendite
 * pubbliche mettono all'asta anche usufrutti, quote, box e lastrici solari, che
 * con la superficie giusta passerebbero il conto senza essere il prodotto.
 */
/**
 * Una quota di proprieta' minore dell'intero: "quota di 1/3 di", "1/2 della piena
 * proprieta'", "proprieta' per 1/2". Non lo sono 1/1 o 1000/1000 (l'intero), la
 * "quota di comproprieta' del cortile" (un accessorio) e "Via Roma 12/14 di Milano".
 */
function quotaParziale(t: string): boolean {
  const schemi = [
    /\bquota\s+(?:di\s+|pari\s+a\s+)?(\d+)\s*\/\s*(\d+)/g,
    /\b(\d+)\s*\/\s*(\d+)\s+(?:della|del|dell')\s+(?:piena\s+)?propriet/g,
    /\bpropriet\S*\s+per\s+(\d+)\s*\/\s*(\d+)/g,
  ];
  for (const schema of schemi) {
    for (const m of t.matchAll(schema)) {
      if (Number(m[1]) < Number(m[2])) return true;
    }
  }
  return false;
}

export function motivoFuoriPerimetro(titolo: string | null | undefined, categoria: string | null | undefined): string | null {
  const t = (titolo ?? "").toLowerCase();
  if (/usufrutt|nuda propriet|diritto di superficie/.test(t) || quotaParziale(t)) {
    return "diritto parziale (usufrutto, nuda proprieta' o quota), non piena proprieta'";
  }
  const c = (categoria ?? "").toUpperCase().replace(/[\s/]/g, "");
  const m = /^([A-F])(\d{1,2})$/.exec(c);
  // A/1-A/9 e A/11 sono abitazioni; A/10 uffici, e le altre lettere box, negozi, lastrici
  if (m && !(m[1] === "A" && m[2] !== "10")) return `categoria catastale ${m[1]}/${m[2]}, non residenziale`;
  return null;
}

const euro = (v: number): string => `${Math.round(v).toLocaleString("it-IT")} EUR`;
const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;
const per = (v: number): string => v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const maiuscola = (s: string): string => s[0]!.toUpperCase() + s.slice(1);

const NOMI_VINCOLO: Record<Vincolo, string> = {
  margine: "margine",
  irr: "IRR minimo sulla durata",
  stress: "stress test",
};

/** Da dove viene il valore di uscita, e quanto stressarlo. */
function sceltaUscita(input: InputQre, p: ParametriQre) {
  const omi = input.valoreMq ?? null;
  const comps = input.comparabili ?? null;
  const zonaRisolta = input.zonaRisolta ?? true;
  if (comps?.affidabile && comps.valoreMq) {
    return {
      fonte: "comparabili" as const,
      valoreMq: comps.valoreMq,
      // l'incertezza misurata dei comparabili, dentro i limiti di prudenza
      stress: Math.min(p.stress.uscitaComune, Math.max(p.stress.uscitaComparabiliMin, comps.dispersione ?? 0)),
      testo: `valore di uscita: mediana di ${comps.n} comparabili ristrutturati ${comps.ambito}, omogeneizzati`,
    };
  }
  if (input.valoreMqOttimo && zonaRisolta) {
    return {
      fonte: "omi_ottimo" as const,
      valoreMq: input.valoreMqOttimo,
      stress: p.stress.uscitaZona,
      testo: `valore di uscita: minimo OMI di zona in stato ottimo, la proxy piu' vicina al ristrutturato` +
        (comps ? ` (comparabili non usati: ${comps.motivo})` : ""),
    };
  }
  // Senza zona il massimo OMI e' quello dell'intero comune, cioe' del suo centro:
  // a Milano 13.000 EUR/mq anche per un lotto in periferia. Non e' una stima prudente
  // da stressare, e' un numero sbagliato, e il Gate 0 non lo usa.
  if (omi && zonaRisolta) {
    return {
      fonte: "omi_max" as const,
      valoreMq: omi,
      stress: p.stress.uscitaZona,
      testo: `valore di uscita: massimo OMI di zona, stima da verificare` +
        (comps ? ` (comparabili non usati: ${comps.motivo})` : ""),
    };
  }
  return { fonte: null, valoreMq: null, stress: p.stress.uscitaComune, testo: "nessun valore di uscita disponibile" };
}

export function prezzoMaxQre(input: InputQre, p: ParametriQre = PARAMETRI_QRE_B): PrezzoMaxQre {
  const { mq, prezzo } = input;
  const molt = input.moltiplicatore ?? (input.trattativa ? MOLTIPLICATORE_TRATTATIVA_DEFAULT : MOLTIPLICATORE_DEFAULT);
  const uscita = sceltaUscita(input, p);
  const valoreMq = uscita.valoreMq;
  const stressUscita = uscita.stress;
  const omiMaxMq = input.valoreMq ?? null;
  const dettaglioUscita = {
    fonte: uscita.fonte,
    stress: stressUscita,
    omiMaxMq,
    divergenzaOmi: uscita.fonte === "comparabili" && omiMaxMq ? uscita.valoreMq! / omiMaxMq - 1 : null,
    comparabili: input.comparabili ?? null,
  };
  const ipotesi = [
    uscita.testo,
    `${p.mesi} mesi, lavori ${euro(p.lavoriMq)}/mq + ${pct(p.imprevisti)} imprevisti, registro ${pct(p.registro)}, vendita ${pct(p.costiVendita)}`,
    `stress: uscita -${pct(stressUscita)}, lavori +${pct(p.stress.lavori)}, +${p.stress.mesiExtra} mesi, capitale salvo`,
    `IRR con esborso a t0 e incasso a fine operazione, senza leva`,
  ];
  const vuoto = {
    valoreMq, valoreFonte: uscita.fonte, pmaxObiettivo: null, pmaxTetto: null, vincolo: null,
    prezzoIngresso: null, prezzoAtteso: null,
    dettaglio: { uscita: dettaglioUscita, base: null, stress: null, moltiplicatore: molt, ipotesi },
  };

  // fuori perimetro e' un verdetto anche senza numeri: un usufrutto non diventa
  // "dati mancanti" solo perche' manca la zona
  if (input.fuoriPerimetro) {
    return { ...vuoto, esito: "fuori_perimetro", motivo: maiuscola(input.fuoriPerimetro) };
  }
  if (!mq || !valoreMq) {
    return {
      ...vuoto, esito: "dati_mancanti",
      motivo: !mq
        ? "superficie non disponibile"
        : input.zonaRisolta === false
          ? "zona OMI non risolta e nessun comparabile affidabile: il valore comunale non descrive il lotto"
          : "nessuna quotazione OMI e nessun comparabile affidabile per la zona",
    };
  }

  const valore = valoreMq * mq;
  const obiettivo = prezzoMassimo(valore, mq, p.margineObiettivo, stressUscita, p);
  const tetto = prezzoMassimo(valore, mq, p.margineTetto, stressUscita, p);

  const scenarioBase = { valore, mesi: p.mesi, fattoreLavori: 1 };
  const scenarioStress = {
    valore: valore * (1 - stressUscita), mesi: p.mesi + p.stress.mesiExtra, fattoreLavori: 1 + p.stress.lavori,
  };
  const metriche = (s: typeof scenarioBase) => {
    const m = margine(obiettivo.prezzo, mq, s, p);
    return { margine: m, irr: irrDaMargine(m, s.mesi) };
  };

  const calcolato = {
    valoreMq,
    valoreFonte: uscita.fonte,
    pmaxObiettivo: Math.round(obiettivo.prezzo),
    pmaxTetto: Math.round(tetto.prezzo),
    vincolo: obiettivo.vincolo,
    // in trattativa non c'e' un'offerta minima: si entra al prezzo che si negozia
    prezzoIngresso: prezzo
      ? Math.round(prezzo * (input.trattativa ? molt.valore : input.giudiziaria ? RIDUZIONE_OFFERTA_MINIMA : 1))
      : null,
    prezzoAtteso: prezzo ? Math.round(prezzo * molt.valore) : null,
    dettaglio: { uscita: dettaglioUscita, base: metriche(scenarioBase), stress: metriche(scenarioStress), moltiplicatore: molt, ipotesi },
  };
  const vincolo = obiettivo.vincolo === "margine" ? "" : `, fissata dal vincolo: ${NOMI_VINCOLO[obiettivo.vincolo]}`;

  if (mq < p.mqMin || mq > p.mqMax) {
    return { ...calcolato, esito: "fuori_taglio", motivo: `${mq} mq, fuori dal taglio ${p.mqMin}-${p.mqMax} mq del binario B` };
  }
  if (!calcolato.prezzoIngresso || !calcolato.prezzoAtteso) {
    return { ...calcolato, esito: "dati_mancanti", motivo: `prezzo non disponibile; offerta massima ${euro(obiettivo.prezzo)}${vincolo}` };
  }

  const atteso = calcolato.prezzoAtteso;
  const ingresso = calcolato.prezzoIngresso;
  const attesoTesto = input.trattativa
    ? `chiusura attesa ${euro(atteso)} (${per(molt.valore)} x richiesta)`
    : `aggiudicazione attesa ${euro(atteso)} (${per(molt.valore)} x base)`;
  if (atteso <= obiettivo.prezzo) {
    return { ...calcolato, esito: "passa", motivo: `${maiuscola(attesoTesto)} entro l'offerta massima ${euro(obiettivo.prezzo)}${vincolo}` };
  }
  if (atteso <= tetto.prezzo) {
    return {
      ...calcolato, esito: "al_limite",
      motivo: `${maiuscola(attesoTesto)} sopra l'offerta ${euro(obiettivo.prezzo)} ma entro il tetto ${euro(tetto.prezzo)}`,
    };
  }
  if (input.trattativa) {
    // senza gara la domanda utile e' quanto sconto serve sulla richiesta
    const sconto = 1 - obiettivo.prezzo / prezzo!;
    return {
      ...calcolato, esito: "scarta",
      motivo: `${maiuscola(attesoTesto)} sopra il tetto ${euro(tetto.prezzo)}: per l'offerta massima serve il ${pct(sconto)} di sconto sulla richiesta`,
    };
  }
  if (ingresso <= tetto.prezzo) {
    // sotto la base, in giudiziaria, il creditore puo' chiedere l'assegnazione (art. 588 c.p.c.)
    const sottoBase = input.giudiziaria && tetto.prezzo < prezzo! ? "; sotto la base, rischio di istanze di assegnazione" : "";
    return {
      ...calcolato, esito: "solo_poca_concorrenza",
      motivo: `Si entra a ${euro(ingresso)}, ma l'${attesoTesto} supera il tetto ${euro(tetto.prezzo)}: si vince solo se in pochi${sottoBase}`,
    };
  }
  return { ...calcolato, esito: "scarta", motivo: `Anche l'offerta minima ${euro(ingresso)} supera il tetto ${euro(tetto.prezzo)}` };
}

/** Il massimo OMI di zona fra le stime di valuta(): la base del valore ristrutturato. */
export function valoreMqDaStime(stime: Stima[]): number | null {
  return stime.find((s) => s.metodo === "omi_max")?.valoreMq ?? null;
}

/** Esiti su cui vale la pena muoversi: entrano nel filtro e nel conteggio. */
export const ESITI_AZIONABILI: readonly EsitoQre[] = ["passa", "al_limite"];
