import type { Stima } from "@qdr/core";

/**
 * Prezzo massimo d'acquisto secondo il metodo QRE, binario B (unita' singola).
 * Funzioni pure: i numeri e le soglie sono quelli di docs/economia-deal-binario-b.md.
 *
 * E' un Gate 0, non una valutazione: dice se vale la pena aprire la perizia,
 * non se comprare. Il valore di uscita viene dal massimo OMI di zona, che
 * descrive un immobile in buono stato ed e' quindi l'approssimazione piu'
 * vicina al "ristrutturato" disponibile senza comparabili. Resta una stima da
 * verificare sulla microzona prima di qualunque offerta.
 */

export interface ParametriQre {
  /** Margine lordo da portare in offerta: regge un'uscita piu' bassa del 10%. */
  margineObiettivo: number;
  /** Margine minimo assoluto del metodo: oltre il prezzo che lo rispetta non si sale. */
  margineTetto: number;
  costiVendita: number;
  /** Ristrutturazione leggera, EUR/mq. */
  lavoriMq: number;
  imprevisti: number;
  praticheMq: number;
  /** APE, utenze, gestione, imposte ipotecaria e catastale fisse, notaio. */
  costiFissi: number;
  registro: number;
  mqMin: number;
  mqMax: number;
}

export const PARAMETRI_QRE_B: ParametriQre = {
  margineObiettivo: 0.3,
  margineTetto: 0.2,
  costiVendita: 0.03,
  lavoriMq: 400,
  imprevisti: 0.05,
  praticheMq: 10,
  costiFissi: 8_900,
  registro: 0.09,
  mqMin: 60,
  mqMax: 150,
};

/**
 * - `passa`        : prezzo entro il P_max col margine obiettivo
 * - `al_limite`    : fra obiettivo e tetto, si offre solo fino al tetto
 * - `scarta`       : prezzo sopra il tetto
 * - `fuori_taglio` : superficie fuori dal binario B (i numeri restano calcolati)
 * - `dati_mancanti`: manca superficie, valore OMI o prezzo
 */
export type EsitoQre = "passa" | "al_limite" | "scarta" | "fuori_taglio" | "dati_mancanti";

export interface PrezzoMaxQre {
  valoreMq: number | null;
  pmaxObiettivo: number | null;
  pmaxTetto: number | null;
  esito: EsitoQre;
  motivo: string;
}

/** P_max = (V x (1 - vendita) / (1 + margine) - mq x lavori - fissi) / (1 + registro) */
export function pmax(valore: number, mq: number, margine: number, p: ParametriQre = PARAMETRI_QRE_B): number {
  const lavori = mq * (p.lavoriMq * (1 + p.imprevisti) + p.praticheMq);
  return (valore * (1 - p.costiVendita) / (1 + margine) - lavori - p.costiFissi) / (1 + p.registro);
}

const euro = (v: number): string => `${Math.round(v).toLocaleString("it-IT")} EUR`;

export function prezzoMaxQre(
  input: { mq: number | null | undefined; prezzo: number | null | undefined; valoreMq: number | null | undefined },
  p: ParametriQre = PARAMETRI_QRE_B,
): PrezzoMaxQre {
  const { mq, prezzo, valoreMq } = input;
  if (!mq || !valoreMq) {
    return {
      valoreMq: valoreMq ?? null, pmaxObiettivo: null, pmaxTetto: null, esito: "dati_mancanti",
      motivo: !mq ? "superficie non disponibile" : "nessuna quotazione OMI per la zona",
    };
  }

  // un P_max negativo significa che lavori e costi fissi superano il valore:
  // va mostrato come zero, non come un prezzo
  const obiettivo = Math.max(0, pmax(valoreMq * mq, mq, p.margineObiettivo, p));
  const tetto = Math.max(0, pmax(valoreMq * mq, mq, p.margineTetto, p));
  const base = { valoreMq, pmaxObiettivo: Math.round(obiettivo), pmaxTetto: Math.round(tetto) };

  if (mq < p.mqMin || mq > p.mqMax) {
    return { ...base, esito: "fuori_taglio", motivo: `${mq} mq, fuori dal taglio ${p.mqMin}-${p.mqMax} mq del binario B` };
  }
  if (!prezzo) {
    return { ...base, esito: "dati_mancanti", motivo: "prezzo non disponibile" };
  }
  if (prezzo <= obiettivo) {
    return { ...base, esito: "passa", motivo: `prezzo entro il P_max al ${p.margineObiettivo * 100}% (${euro(obiettivo)})` };
  }
  if (prezzo <= tetto) {
    return {
      ...base, esito: "al_limite",
      motivo: `prezzo sopra l'obiettivo ma entro il tetto al ${p.margineTetto * 100}% (${euro(tetto)}): offrire solo fino al tetto`,
    };
  }
  return { ...base, esito: "scarta", motivo: `prezzo sopra il tetto al ${p.margineTetto * 100}% (${euro(tetto)})` };
}

/** Il massimo OMI di zona fra le stime di valuta(): la base del valore ristrutturato. */
export function valoreMqDaStime(stime: Stima[]): number | null {
  return stime.find((s) => s.metodo === "omi_max")?.valoreMq ?? null;
}
