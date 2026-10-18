import { db } from "./db.js";
import { getImmobile, type ImmobileRow } from "./repository.js";
import { MOLTIPLICATORE_DEFAULT, type Moltiplicatore } from "./qre.js";

/**
 * Esiti delle aste: il ciclo che rende il Gate 0 piu' preciso nel tempo.
 *
 * Il prezzo atteso di aggiudicazione parte da un default (lo storico QRE sulle
 * giudiziarie). Ogni aggiudicazione registrata, anche di aste a cui non si e'
 * partecipato, e' un'osservazione: superata una soglia minima, il moltiplicatore
 * di quella famiglia di vendite si calcola sui dati invece che sul default.
 */

/** Giudiziarie e statali hanno dinamiche diverse: si calibrano separatamente. */
export type Famiglia = "giudiziaria" | "statale" | "altro";

const FONTI_STATALI = new Set(["demanio", "invimit", "inps", "ader", "anbsc", "aler_milano"]);

/** Sotto questa soglia una mediana e' rumore: si resta sul default. */
export const MINIMO_ESITI = 5;

export function famigliaDi(r: Pick<ImmobileRow, "fonte" | "tribunale" | "numero_rge">): Famiglia {
  if (r.numero_rge != null || r.tribunale) return "giudiziaria";
  if (FONTI_STATALI.has(r.fonte)) return "statale";
  return "altro";
}

const mediana = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function moltiplicatorePer(famiglia: Famiglia): Moltiplicatore {
  const rapporti = (
    db.prepare("SELECT prezzo_aggiudicazione / prezzo_base AS r FROM esiti_aste WHERE famiglia = ? AND prezzo_base > 0")
      .all(famiglia) as { r: number }[]
  ).map((x) => x.r);
  if (rapporti.length < MINIMO_ESITI) {
    return rapporti.length === 0
      ? MOLTIPLICATORE_DEFAULT
      : { ...MOLTIPLICATORE_DEFAULT, fonte: `${MOLTIPLICATORE_DEFAULT.fonte} (${rapporti.length} esiti ${famiglia}, ne servono ${MINIMO_ESITI})` };
  }
  return {
    valore: mediana(rapporti),
    n: rapporti.length,
    fonte: `mediana di ${rapporti.length} aggiudicazioni registrate (${famiglia})`,
  };
}

/** Tutti i moltiplicatori in una volta: enrich li chiede per ogni immobile. */
export function moltiplicatori(): Record<Famiglia, Moltiplicatore> {
  return { giudiziaria: moltiplicatorePer("giudiziaria"), statale: moltiplicatorePer("statale"), altro: moltiplicatorePer("altro") };
}

export class EsitoNonValido extends Error {}

/**
 * Registra un'aggiudicazione. Il prezzo base e' quello in radar al momento:
 * va fotografato qui, perche' un ribasso successivo cambierebbe il rapporto.
 */
export function registraEsito(
  immobileId: number,
  prezzoAggiudicazione: number,
  opzioni: { vinto?: boolean; data?: string; nota?: string } = {},
): { famiglia: Famiglia; rapporto: number } {
  const imm = getImmobile(immobileId);
  if (!imm) throw new EsitoNonValido(`immobile ${immobileId} non trovato`);
  if (!imm.prezzo) throw new EsitoNonValido(`immobile ${immobileId} senza prezzo base: il rapporto non si puo' calcolare`);
  if (!(prezzoAggiudicazione > 0)) throw new EsitoNonValido("prezzo di aggiudicazione non valido");

  const famiglia = famigliaDi(imm);
  db.prepare(
    `INSERT INTO esiti_aste (immobile_id, fonte, famiglia, prezzo_base, prezzo_aggiudicazione, vinto, data, nota, registrato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    immobileId, imm.fonte, famiglia, imm.prezzo, prezzoAggiudicazione, opzioni.vinto ? 1 : 0,
    opzioni.data ?? imm.data_asta ?? null, opzioni.nota ?? null, new Date().toISOString(),
  );
  return { famiglia, rapporto: prezzoAggiudicazione / imm.prezzo };
}
