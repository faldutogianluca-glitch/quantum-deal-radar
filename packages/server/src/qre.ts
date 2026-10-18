import type { Stima } from "@qdr/core";

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
 * 2. A quanto si aggiudichera' davvero? Non al prezzo base: lo storico QRE
 *    dice 1,20 volte la base in mediana per le unita' piccole. Il
 *    moltiplicatore si ricalibra sugli esiti registrati (vedi esiti.ts).
 * 3. Il prezzo atteso sta sotto il massimo? Se no, si vince solo con poca
 *    concorrenza, e va detto.
 *
 * Il valore di uscita viene dal massimo OMI di zona: descrive un immobile in
 * buono stato ed e' l'approssimazione piu' vicina al "ristrutturato" senza
 * comparabili. Quando la zona non e' risolta (ripiego sul comune) la forbice
 * e' molto piu' larga, e lo stress test si fa piu' severo di conseguenza.
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
    /** Uscita piu' bassa quando la quotazione e' l'aggregato comunale. */
    uscitaComune: number;
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
  stress: { uscitaZona: 0.15, uscitaComune: 0.25, lavori: 0.15, mesiExtra: 6, margine: 0 },
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
  zonaRisolta: boolean,
  p: ParametriQre = PARAMETRI_QRE_B,
): { prezzo: number; vincolo: Vincolo } {
  const base = { valore, mesi: p.mesi, fattoreLavori: 1 };
  const candidati: { prezzo: number; vincolo: Vincolo }[] = [
    { vincolo: "margine", prezzo: prezzoPerScenario(mq, { ...base, margineRichiesto: margineBase }, p) },
    { vincolo: "irr", prezzo: prezzoPerScenario(mq, { ...base, margineRichiesto: margineDaIrr(p.irrMinimo, p.mesi) }, p) },
    {
      vincolo: "stress",
      prezzo: prezzoPerScenario(mq, {
        valore: valore * (1 - (zonaRisolta ? p.stress.uscitaZona : p.stress.uscitaComune)),
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

/** Nelle aste giudiziarie si puo' offrire fino a un quarto sotto la base (art. 571 c.p.c.). */
export const RIDUZIONE_OFFERTA_MINIMA = 0.75;

// ---------------------------------------------------------------- esito

/**
 * - `passa`                  : anche il prezzo atteso di aggiudicazione sta entro l'offerta
 * - `al_limite`              : il prezzo atteso supera l'offerta ma sta entro il tetto
 * - `solo_poca_concorrenza`  : si entra (offerta minima entro il tetto), ma il prezzo
 *                              atteso supera il tetto: si vince solo se in pochi
 * - `scarta`                 : neppure l'offerta minima sta entro il tetto
 * - `fuori_taglio`           : superficie fuori dal binario B (i numeri restano calcolati)
 * - `dati_mancanti`          : manca superficie, valore OMI o prezzo
 */
export type EsitoQre = "passa" | "al_limite" | "solo_poca_concorrenza" | "scarta" | "fuori_taglio" | "dati_mancanti";

export interface DettaglioQre {
  /** Margine e IRR comprando all'offerta, nel caso base e nello stress test. */
  base: { margine: number; irr: number } | null;
  stress: { margine: number; irr: number } | null;
  moltiplicatore: Moltiplicatore;
  ipotesi: string[];
}

export interface PrezzoMaxQre {
  valoreMq: number | null;
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
  valoreMq: number | null | undefined;
  /** false quando la quotazione e' l'aggregato comunale: stress piu' severo. */
  zonaRisolta?: boolean;
  /** Asta giudiziaria: l'offerta minima e' tre quarti della base. */
  giudiziaria?: boolean;
  moltiplicatore?: Moltiplicatore;
}

const euro = (v: number): string => `${Math.round(v).toLocaleString("it-IT")} EUR`;
const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;

const NOMI_VINCOLO: Record<Vincolo, string> = {
  margine: "margine",
  irr: "IRR minimo sulla durata",
  stress: "stress test",
};

export function prezzoMaxQre(input: InputQre, p: ParametriQre = PARAMETRI_QRE_B): PrezzoMaxQre {
  const { mq, prezzo, valoreMq } = input;
  const zonaRisolta = input.zonaRisolta ?? true;
  const molt = input.moltiplicatore ?? MOLTIPLICATORE_DEFAULT;
  const stressUscita = zonaRisolta ? p.stress.uscitaZona : p.stress.uscitaComune;
  const ipotesi = [
    `valore di uscita: massimo OMI di zona${zonaRisolta ? "" : " (aggregato comunale, forbice larga)"}, stima da verificare`,
    `${p.mesi} mesi, lavori ${euro(p.lavoriMq)}/mq + ${pct(p.imprevisti)} imprevisti, registro ${pct(p.registro)}, vendita ${pct(p.costiVendita)}`,
    `stress: uscita -${pct(stressUscita)}, lavori +${pct(p.stress.lavori)}, +${p.stress.mesiExtra} mesi, capitale salvo`,
    `IRR con esborso a t0 e incasso a fine operazione, senza leva`,
  ];
  const vuoto = {
    valoreMq: valoreMq ?? null, pmaxObiettivo: null, pmaxTetto: null, vincolo: null,
    prezzoIngresso: null, prezzoAtteso: null,
    dettaglio: { base: null, stress: null, moltiplicatore: molt, ipotesi },
  };

  if (!mq || !valoreMq) {
    return {
      ...vuoto, esito: "dati_mancanti",
      motivo: !mq ? "superficie non disponibile" : "nessuna quotazione OMI per la zona",
    };
  }

  const valore = valoreMq * mq;
  const obiettivo = prezzoMassimo(valore, mq, p.margineObiettivo, zonaRisolta, p);
  const tetto = prezzoMassimo(valore, mq, p.margineTetto, zonaRisolta, p);

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
    pmaxObiettivo: Math.round(obiettivo.prezzo),
    pmaxTetto: Math.round(tetto.prezzo),
    vincolo: obiettivo.vincolo,
    prezzoIngresso: prezzo ? Math.round(prezzo * (input.giudiziaria ? RIDUZIONE_OFFERTA_MINIMA : 1)) : null,
    prezzoAtteso: prezzo ? Math.round(prezzo * molt.valore) : null,
    dettaglio: { base: metriche(scenarioBase), stress: metriche(scenarioStress), moltiplicatore: molt, ipotesi },
  };
  const vincolo = obiettivo.vincolo === "margine" ? "" : `, fissato dal ${NOMI_VINCOLO[obiettivo.vincolo]}`;

  if (mq < p.mqMin || mq > p.mqMax) {
    return { ...calcolato, esito: "fuori_taglio", motivo: `${mq} mq, fuori dal taglio ${p.mqMin}-${p.mqMax} mq del binario B` };
  }
  if (!calcolato.prezzoIngresso || !calcolato.prezzoAtteso) {
    return { ...calcolato, esito: "dati_mancanti", motivo: `prezzo non disponibile; offerta massima ${euro(obiettivo.prezzo)}${vincolo}` };
  }

  const atteso = calcolato.prezzoAtteso;
  const ingresso = calcolato.prezzoIngresso;
  const attesoTesto = `prezzo atteso ${euro(atteso)} (${molt.valore.toFixed(2)} x base)`;
  if (atteso <= obiettivo.prezzo) {
    return { ...calcolato, esito: "passa", motivo: `${attesoTesto} entro l'offerta massima ${euro(obiettivo.prezzo)}${vincolo}` };
  }
  if (atteso <= tetto.prezzo) {
    return {
      ...calcolato, esito: "al_limite",
      motivo: `${attesoTesto} sopra l'offerta ${euro(obiettivo.prezzo)} ma entro il tetto ${euro(tetto.prezzo)}`,
    };
  }
  if (ingresso <= tetto.prezzo) {
    return {
      ...calcolato, esito: "solo_poca_concorrenza",
      motivo: `si entra a ${euro(ingresso)}, ma il ${attesoTesto} supera il tetto ${euro(tetto.prezzo)}: si vince solo se in pochi`,
    };
  }
  return { ...calcolato, esito: "scarta", motivo: `anche l'offerta minima ${euro(ingresso)} supera il tetto ${euro(tetto.prezzo)}` };
}

/** Il massimo OMI di zona fra le stime di valuta(): la base del valore ristrutturato. */
export function valoreMqDaStime(stime: Stima[]): number | null {
  return stime.find((s) => s.metodo === "omi_max")?.valoreMq ?? null;
}

/** Esiti su cui vale la pena muoversi: entrano nel filtro e nel conteggio. */
export const ESITI_AZIONABILI: readonly EsitoQre[] = ["passa", "al_limite"];
