/**
 * Misura del funnel agenti: tempi di risposta, SLA e metriche del pilota.
 * Zero dipendenze, funzioni pure.
 *
 * Questo modulo MISURA, non promette. Le definizioni (quando parte l'orologio, giorni solari o
 * lavorativi, chi risponde) sono una politica da confermare: vedi funnel/docs/sla-agenti.md.
 * Una simulazione con dati sintetici prova che il calcolo funziona; non prova nessun esito commerciale.
 */

export type PoliticaGiorni = "solari" | "lavorativi";

export interface PoliticaSla {
  /** ore entro cui dare il feedback motivato */
  oreFeedback: number;
  /** "solari": le 48 ore corrono anche nel weekend. "lavorativi": le ore corrono solo nei giorni lavorativi. */
  giorniFeedback: PoliticaGiorni;
  /** finestra per l'offerta vincolante, in giorni dal momento in cui i documenti sono completi */
  giorniOffertaMin: number;
  giorniOffertaMax: number;
  giorniOfferta: PoliticaGiorni;
}

/** Politica coerente con la promessa pubblica attuale ("48 ore", "7-10 giorni"), senza eccezioni per il weekend. */
export const POLITICA_PUBBLICA: PoliticaSla = {
  oreFeedback: 48, giorniFeedback: "solari",
  giorniOffertaMin: 7, giorniOffertaMax: 10, giorniOfferta: "solari",
};

// ---------------------------------------------------------------- calendario

/** Pasqua (algoritmo anonimo gregoriano). */
function pasqua(anno: number): Date {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anno, mese - 1, giorno));
}

const FUSO = "Europe/Rome";
const formatoRoma = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** Data civile e giorno della settimana a Roma (non in UTC: tra le 00:00 e le 02:00 la data differisce). */
function dataRoma(t: Date): { anno: number; mese: number; giorno: number; settimana: number; chiave: string } {
  const p = Object.fromEntries(formatoRoma.formatToParts(t).map((x) => [x.type, x.value]));
  const settimana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(p.weekday));
  return { anno: +p.year!, mese: +p.month!, giorno: +p.day!, settimana, chiave: `${p.year}-${p.month}-${p.day}` };
}

/** Scarto di Roma rispetto a UTC, in ms, nell'istante dato (3.600.000 d'inverno, 7.200.000 d'estate). */
function offsetRoma(t: Date): number {
  const p = Object.fromEntries(formatoRoma.formatToParts(t).map((x) => [x.type, x.value]));
  const locale = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return locale - Math.floor(t.getTime() / 1000) * 1000;
}

/** Mezzanotte successiva a Roma, come istante UTC. */
function mezzanotteSuccessivaRoma(t: Date): number {
  const r = dataRoma(t);
  const approssimata = Date.UTC(r.anno, r.mese - 1, r.giorno + 1);
  return approssimata - offsetRoma(new Date(approssimata - 3_600_000));
}

const chiaveGiorno = (d: Date): string => d.toISOString().slice(0, 10);

/** Festivita' nazionali italiane (Lunedi' dell'Angelo compreso). Il patrono locale non e' incluso. */
export function festivita(anno: number): Set<string> {
  const fisse = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"];
  const s = new Set(fisse.map((m) => `${anno}-${m}`));
  const p = pasqua(anno);
  s.add(chiaveGiorno(new Date(p.getTime() + 86_400_000)));
  return s;
}

/** Giorno lavorativo secondo il calendario di Roma: lun-ven, esclusi i festivi nazionali. */
export function eLavorativo(d: Date): boolean {
  const r = dataRoma(d);
  if (r.settimana === 0 || r.settimana === 6) return false;
  return !festivita(r.anno).has(r.chiave);
}

const ORA = 3_600_000;
const GIORNO = 86_400_000;

/** Somma `ore` ore contando soltanto i giorni lavorativi (giorni di Roma). */
function aggiungiOreLavorative(inizio: Date, ore: number): Date {
  let restanti = ore * ORA;
  let t = inizio.getTime();
  while (restanti > 0) {
    const corrente = new Date(t);
    const fineGiorno = mezzanotteSuccessivaRoma(corrente);
    if (!eLavorativo(corrente)) {
      t = fineGiorno;
      continue;
    }
    const disponibile = fineGiorno - t;
    if (restanti <= disponibile) return new Date(t + restanti);
    restanti -= disponibile;
    t = fineGiorno;
  }
  return new Date(t);
}

function aggiungiGiorniLavorativi(inizio: Date, giorni: number): Date {
  let d = new Date(inizio.getTime());
  let n = 0;
  while (n < giorni) {
    d = new Date(d.getTime() + GIORNO);
    if (eLavorativo(d)) n++;
  }
  return d;
}

/** Scadenza del feedback motivato, a partire dal momento in cui la segnalazione e' completa. */
export function scadenzaFeedback(inizio: Date, p: PoliticaSla = POLITICA_PUBBLICA): Date {
  return p.giorniFeedback === "solari" ? new Date(inizio.getTime() + p.oreFeedback * ORA) : aggiungiOreLavorative(inizio, p.oreFeedback);
}

/** Finestra in cui deve arrivare l'offerta vincolante, dal momento in cui i documenti sono completi. */
export function finestraOfferta(documentiCompleti: Date, p: PoliticaSla = POLITICA_PUBBLICA): { dal: Date; entro: Date } {
  const calcola = (g: number) => (p.giorniOfferta === "solari" ? new Date(documentiCompleti.getTime() + g * GIORNO) : aggiungiGiorniLavorativi(documentiCompleti, g));
  return { dal: calcola(p.giorniOffertaMin), entro: calcola(p.giorniOffertaMax) };
}

// ---------------------------------------------------------------- eventi e SLA

export type CanaleSegnalazione = "agente" | "proprietario" | "servicer" | "asset_manager" | "professionista" | "altro";

/** Una segnalazione, con i soli timestamp e le sole etichette che servono a misurare. Nessun dato personale. */
export interface Segnalazione {
  id: string;
  canale: CanaleSegnalazione;
  /** in target = rientra nel buy box (tipo, zona, ticket) */
  inTarget: boolean | null;
  /** fonte registrata: chi ha segnalato e da quale canale marketing, entrambi presenti */
  fonteCompleta: boolean;
  ricevutaIl: string | null;
  /** quando la segnalazione contiene i dati minimi per essere valutata */
  completaIl: string | null;
  feedbackIl: string | null;
  verdetto: "GO" | "WATCH" | "SCARTA" | null;
  documentiCompletiIl: string | null;
  offertaIl: string | null;
  acquisitoIl: string | null;
}

export type EsitoSla = "in_tempo" | "in_ritardo" | "in_corso" | "non_misurabile";

const d = (s: string | null): Date | null => {
  if (!s) return null;
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t;
};

/** SLA del feedback: parte da `completaIl` (o da `ricevutaIl` se la segnalazione era gia' completa). */
export function esitoFeedback(s: Segnalazione, adesso: Date, p: PoliticaSla = POLITICA_PUBBLICA): EsitoSla {
  const inizio = d(s.completaIl) ?? d(s.ricevutaIl);
  if (!inizio) return "non_misurabile";
  const scadenza = scadenzaFeedback(inizio, p);
  const risposta = d(s.feedbackIl);
  if (risposta) return risposta.getTime() <= scadenza.getTime() ? "in_tempo" : "in_ritardo";
  return adesso.getTime() > scadenza.getTime() ? "in_ritardo" : "in_corso";
}

/** SLA dell'offerta: conta solo se i documenti sono completi; l'offerta puo' arrivare dal giorno minimo fino al massimo. */
export function esitoOfferta(s: Segnalazione, adesso: Date, p: PoliticaSla = POLITICA_PUBBLICA): EsitoSla {
  const inizio = d(s.documentiCompletiIl);
  if (!inizio) return "non_misurabile";
  const { entro } = finestraOfferta(inizio, p);
  const offerta = d(s.offertaIl);
  if (offerta) return offerta.getTime() <= entro.getTime() ? "in_tempo" : "in_ritardo";
  return adesso.getTime() > entro.getTime() ? "in_ritardo" : "in_corso";
}

// ---------------------------------------------------------------- metriche del pilota

export interface FinestraPilota {
  dal: string;
  al: string;
}

export interface Soglie {
  /** sotto questo numero di segnalazioni in target non si conclude nulla */
  minimoCampione: number;
}

/** Valore di partenza da confermare con Pitagora: e' una scelta di prudenza, non una soglia statistica. */
export const SOGLIE_PREDEFINITE: Soglie = { minimoCampione: 20 };

export interface MetricheCanale {
  segnalazioni: number;
  inTarget: number;
  fonteCompleta: number;
  feedbackInTempo: number;
  feedbackInRitardo: number;
  feedbackInCorso: number;
  nonMisurabili: number;
  aDocumenti: number;
  aOfferta: number;
  acquisiti: number;
  /** mediana in ore fra segnalazione completa e feedback, sui casi che hanno ricevuto feedback */
  oreMedianeFeedback: number | null;
}

export type Conclusione = "nessun_evento" | "campione_insufficiente" | "misurato";

export interface MetrichePilota {
  finestra: FinestraPilota;
  conclusione: Conclusione;
  /** una frase che dice cosa il risultato NON dimostra */
  avvertenza: string;
  totale: MetricheCanale;
  perCanale: Record<string, MetricheCanale>;
  /** percentuale di feedback in tempo sui feedback conclusi delle sole segnalazioni in target, null se nessuno */
  percentualeFeedbackInTempo: number | null;
}

const mediana = (v: number[]): number | null => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

function calcola(lista: Segnalazione[], adesso: Date, p: PoliticaSla): MetricheCanale {
  let inTempo = 0, inRitardo = 0, inCorso = 0, nonMis = 0;
  const ore: number[] = [];
  for (const s of lista) {
    const e = esitoFeedback(s, adesso, p);
    if (e === "in_tempo") inTempo++;
    else if (e === "in_ritardo") inRitardo++;
    else if (e === "in_corso") inCorso++;
    else nonMis++;
    const i = d(s.completaIl) ?? d(s.ricevutaIl), f = d(s.feedbackIl);
    if (i && f) ore.push((f.getTime() - i.getTime()) / ORA);
  }
  return {
    segnalazioni: lista.length,
    inTarget: lista.filter((s) => s.inTarget === true).length,
    fonteCompleta: lista.filter((s) => s.fonteCompleta).length,
    feedbackInTempo: inTempo, feedbackInRitardo: inRitardo, feedbackInCorso: inCorso, nonMisurabili: nonMis,
    aDocumenti: lista.filter((s) => s.documentiCompletiIl).length,
    aOfferta: lista.filter((s) => s.offertaIl).length,
    acquisiti: lista.filter((s) => s.acquisitoIl).length,
    oreMedianeFeedback: mediana(ore),
  };
}

/**
 * Metriche di una finestra (il pilota proposto e' di quattro settimane, da confermare).
 * Zero eventi o campione insufficiente producono una conclusione ESPLICITA di non-prova:
 * mai un "successo".
 */
export function metrichePilota(
  segnalazioni: Segnalazione[],
  finestra: FinestraPilota,
  adesso: Date,
  politica: PoliticaSla = POLITICA_PUBBLICA,
  soglie: Soglie = SOGLIE_PREDEFINITE,
): MetrichePilota {
  // "2026-11-28" come estremo finale comprende tutto quel giorno (a Roma), non solo la mezzanotte UTC
  const soloData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x.trim());
  const dal = soloData(finestra.dal)
    ? mezzanotteSuccessivaRoma(new Date(new Date(finestra.dal).getTime() - GIORNO / 2)) - 0
    : new Date(finestra.dal).getTime();
  const al = soloData(finestra.al)
    ? mezzanotteSuccessivaRoma(new Date(new Date(finestra.al).getTime() + GIORNO / 2 - 1)) - 1
    : new Date(finestra.al).getTime();
  const nella = segnalazioni.filter((s) => {
    const t = d(s.ricevutaIl)?.getTime();
    return t !== undefined && t >= dal && t <= al;
  });
  const perCanale: Record<string, MetricheCanale> = {};
  for (const c of new Set(nella.map((s) => s.canale))) perCanale[c] = calcola(nella.filter((s) => s.canale === c), adesso, politica);
  const totale = calcola(nella, adesso, politica);
  // la percentuale usa lo stesso insieme del campione minimo: solo le segnalazioni in target
  const inTargetTotale = calcola(nella.filter((s) => s.inTarget === true), adesso, politica);
  const conclusi = inTargetTotale.feedbackInTempo + inTargetTotale.feedbackInRitardo;

  let conclusione: Conclusione = "misurato";
  let avvertenza = "Le percentuali descrivono solo questa finestra e questo campione: non provano che il processo funzioni in altre condizioni.";
  if (nella.length === 0) {
    conclusione = "nessun_evento";
    avvertenza = "Nessuna segnalazione nella finestra: non c'e' nulla da misurare e nulla viene dimostrato.";
  } else if (totale.inTarget < soglie.minimoCampione) {
    conclusione = "campione_insufficiente";
    avvertenza = `Solo ${totale.inTarget} segnalazioni in target, sotto il minimo di ${soglie.minimoCampione}: i numeri sono indicativi e non provano successo ne' insuccesso.`;
  }
  return {
    finestra, conclusione, avvertenza, totale, perCanale,
    percentualeFeedbackInTempo: conclusi ? (inTargetTotale.feedbackInTempo / conclusi) * 100 : null,
  };
}
