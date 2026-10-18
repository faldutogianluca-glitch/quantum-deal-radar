import { db } from "./db.js";
import { getImmobile, idPerOrigine, type ImmobileRow } from "./repository.js";
import { MOLTIPLICATORE_DEFAULT, MOLTIPLICATORE_TRATTATIVA_DEFAULT, type Moltiplicatore } from "./qre.js";

/**
 * Esiti delle aste: il ciclo che rende il Gate 0 piu' preciso nel tempo.
 *
 * Il prezzo atteso di aggiudicazione parte da un default (lo storico QRE sulle
 * giudiziarie). Ogni aggiudicazione registrata, anche di aste a cui non si e'
 * partecipato, e' un'osservazione: superata una soglia minima, il moltiplicatore
 * di quella famiglia di vendite si calcola sui dati invece che sul default.
 */

/**
 * Dinamiche diverse si calibrano separatamente: giudiziarie e statali sono
 * gare sulla base d'asta, la trattativa e' una negoziazione sul prezzo
 * richiesto (REOCO, banche), "asta" raccoglie le altre gare.
 */
export type Famiglia = "giudiziaria" | "statale" | "trattativa" | "asta";
export const FAMIGLIE: readonly Famiglia[] = ["giudiziaria", "statale", "trattativa", "asta"];

const FONTI_STATALI = new Set(["demanio", "invimit", "inps", "ader", "anbsc", "aler_milano"]);

/** Sotto questa soglia una mediana e' rumore: si resta sul default. */
export const MINIMO_ESITI = 5;

export function famigliaDi(r: Pick<ImmobileRow, "fonte" | "tribunale" | "numero_rge" | "tipo_prezzo">): Famiglia {
  if (r.numero_rge != null || r.tribunale) return "giudiziaria";
  if (r.tipo_prezzo === "richiesta_reoco" || r.tipo_prezzo === "trattativa") return "trattativa";
  if (FONTI_STATALI.has(r.fonte)) return "statale";
  // prezzo di tipo ignoto: si tratta come una gara, l'ipotesi prudente
  return "asta";
}

const mediana = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function moltiplicatorePer(famiglia: Famiglia): Moltiplicatore {
  const rapporti = (
    // un esito per immobile, l'ultimo registrato: un doppio clic o un comando rilanciato
    // non devono contare due volte la stessa asta e spostare la mediana
    db.prepare(
      `SELECT e.prezzo_aggiudicazione / e.prezzo_base AS r FROM esiti_aste e
       WHERE e.famiglia = ? AND e.prezzo_base > 0
         AND e.id = (SELECT max(id) FROM esiti_aste x WHERE x.immobile_id = e.immobile_id)`,
    ).all(famiglia) as { r: number }[]
  ).map((x) => x.r);
  const predefinito = famiglia === "trattativa" ? MOLTIPLICATORE_TRATTATIVA_DEFAULT : MOLTIPLICATORE_DEFAULT;
  if (rapporti.length < MINIMO_ESITI) {
    return rapporti.length === 0
      ? predefinito
      : { ...predefinito, fonte: `${predefinito.fonte} (${rapporti.length} esiti ${famiglia}, ne servono ${MINIMO_ESITI})` };
  }
  return {
    valore: mediana(rapporti),
    n: rapporti.length,
    fonte: `mediana di ${rapporti.length} aggiudicazioni registrate (${famiglia})`,
  };
}

/** Tutti i moltiplicatori in una volta: enrich li chiede per ogni immobile. */
export function moltiplicatori(): Record<Famiglia, Moltiplicatore> {
  return Object.fromEntries(FAMIGLIE.map((f) => [f, moltiplicatorePer(f)])) as Record<Famiglia, Moltiplicatore>;
}

export class EsitoNonValido extends Error {}

/**
 * Registra un'aggiudicazione, o il prezzo di chiusura di una trattativa. Il prezzo base e' quello in radar al momento:
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

/**
 * Aggiudicazioni pubblicate dai portali stessi (per esempio la Vetrina del
 * Demanio): si registrano da sole a ogni scraping, una volta per immobile e
 * prezzo. E' il modo in cui il moltiplicatore delle vendite statali smette di
 * essere un'ipotesi presa dalle giudiziarie.
 */
export function registraAggiudicazioniPubblicate(
  items: { fonte: string; idEsterno: string; prezzo?: number | null; prezzoAggiudicazione?: number | null }[],
): number {
  const gia = db.prepare("SELECT 1 FROM esiti_aste WHERE immobile_id = ? AND prezzo_aggiudicazione = ?");
  let registrati = 0;
  for (const i of items) {
    if (!i.prezzoAggiudicazione || !i.prezzo) continue;
    const id = idPerOrigine(i.fonte, i.idEsterno);
    if (id === undefined || gia.get(id, i.prezzoAggiudicazione)) continue;
    registraEsito(id, i.prezzoAggiudicazione, { nota: `pubblicato da ${i.fonte}` });
    registrati++;
  }
  return registrati;
}
