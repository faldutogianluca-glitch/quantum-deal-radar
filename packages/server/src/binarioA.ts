import type { ImmobileRow } from "./repository.js";

/**
 * Filtro del binario A (docs/decisione-2026-10-18.md, priorita' 1): almeno
 * 200 mq, o multi-unita', o cambio d'uso possibile, e lotti gia' andati deserti
 * almeno una volta.
 *
 * E' un filtro, non un verdetto economico: il Gate 0 di qre.ts e' tarato sul
 * binario B e scarta proprio questi lotti (commerciali "fuori perimetro",
 * grandi superfici "fuori taglio"). Il modello economico del binario A si
 * calibra sul consuntivo di Bollate; fino ad allora ogni candidato si valuta a
 * mano con la perizia (analisi/modello_fix_flip.py).
 *
 * Due esiti: "candidato" quando tutto e' noto, "da verificare" quando un dato
 * che decide (aste deserte, superficie, diritto venduto) manca o e' dubbio.
 * Un lotto grande con il dato mancante non deve sparire in silenzio.
 */

export const MQ_MINIMI_A = 200;
/**
 * IPOTESI: sotto i 100 mq un cambio d'uso non da' almeno due unita' vendibili,
 * quindi non e' un'operazione da binario A.
 */
export const MQ_MINIMI_CAMBIO_USO = 100;
/** IPOTESI: un'abitazione senza superficie letta sopra questo prezzo base puo' essere grande. */
export const PREZZO_GRANDE_SENZA_MQ = 300_000;

export interface EsitoBinarioA {
  candidato: boolean;
  daVerificare: boolean;
  /** Criteri di dimensione soddisfatti: "200 mq", "multi-unita'", "cambio d'uso". */
  criteri: string[];
  /** Cosa manca o va verificato a mano. */
  avvisi: string[];
}

// destinazioni che si possono convertire, solo come bene principale: box, posti auto, stalle e terreni no,
// e il magazzino accessorio di un'abitazione ("IMMOBILE_RESIDENZIALE / ... / MAGAZZINI_E_DEPOSITO") neppure
const CONVERTIBILE_PVP = /^IMMOBILE_COMMERCIALE\b.*\b(UFFIC\w*|NEGOZ\w*|LABORATOR\w*|DEPOSIT\w*|MAGAZZIN\w*|FABBRICATI_COMMERCIALI|CAPANNON\w*)/i;
const CONVERTIBILE_CATASTO = /^\s*(A\s*\/\s*10|C\s*\/\s*[123]|D\s*\/\s*[178])\b/i;
// "1 unita' immobiliare" e' una sola: dal 2 in su
const NUMERO_UNITA = String.raw`(?:diverse|piu'|più|varie|plurime|[2-9]|\d{2,}|due|tre|quattro|cinque|sei)`;
const MULTI_UNITA = new RegExp(
  [
    String.raw`\b${NUMERO_UNITA}\s+unit[aà](?:\s+immobiliari)?(?![a-z])`,
    String.raw`\bfrazionat[oa]\s+in\s+${NUMERO_UNITA}\b`,
    String.raw`\bintero\s+(?:stabile|fabbricato|edificio)\b`,
    String.raw`\bpalazzin\w*\b`,
    String.raw`\bcielo[- ]terra\b`,
    String.raw`\bbifamiliar\w*\b`,
    String.raw`\b(?:due|tre|quattro|[2-9])\s+(?:appartamenti|negozi|edifici|alloggi)\b`,
    String.raw`\bsoprastante\s+abitazione\b`,
  ].join("|"),
  "i",
);
// "bilocale in condominio di 40 unita' immobiliari" descrive l'edificio, non il lotto
const UNITA_DEL_CONDOMINIO = new RegExp(String.raw`\b(?:condominio|complesso|stabile|edificio)\s+(?:di|composto da|con)\s+${NUMERO_UNITA}\s+unit[aà]`, "i");
// diritto parziale sul bene principale; "quota di 2/6 di aree esterne" riguarda il cortile, non il bene
const DIRITTO_PARZIALE =
  /\bnuda\s+propriet|\busufrutto\b|\bdiritto\s+di\s+superficie\b|\bquota\s+(?:pari\s+)?(?:a|di)\s+(\d+)\s*\/\s*(\d+)(?!\d)(?!\s+(?:di|delle|degli|del|dell')\s*(?:aree|area|cortil|parti|enti|strad|corsell|terren))/i;

function dirittoParziale(titolo: string): string | null {
  const m = DIRITTO_PARZIALE.exec(titolo);
  if (!m) return null;
  if (m[1] && m[2] && Number(m[1]) === Number(m[2])) return null; // 1000/1000, 1/1
  return m[0].trim();
}

export function valutaBinarioA(r: ImmobileRow, oggi: string): EsitoBinarioA {
  const criteri: string[] = [];
  const avvisi: string[] = [];
  const titolo = r.titolo ?? "";
  const categoria = (r.sottotipo_asset ?? "").trim();
  const abitazioni = categoria.match(/ABITAZIONE\w*|APPARTAMENT\w*/gi)?.length ?? 0;

  if (r.mq != null && r.mq >= MQ_MINIMI_A) criteri.push(`${MQ_MINIMI_A} mq`);
  if ((MULTI_UNITA.test(titolo) && !UNITA_DEL_CONDOMINIO.test(titolo)) || abitazioni >= 2) criteri.push("multi-unita'");
  // solo la categoria: nel titolo "perizia depositata" o "ex negozio ora abitazione" ingannerebbero
  const convertibile = CONVERTIBILE_PVP.test(categoria) || CONVERTIBILE_CATASTO.test(categoria);
  if (convertibile) {
    if (r.mq == null) {
      criteri.push("cambio d'uso");
      avvisi.push("superficie non letta: verificare che il cambio d'uso dia almeno due unita'");
    } else if (r.mq >= MQ_MINIMI_CAMBIO_USO) {
      criteri.push("cambio d'uso");
    }
  }
  // un'abitazione grande senza superficie letta non si scarta: si guarda
  const forseGrande =
    criteri.length === 0 &&
    r.mq == null &&
    !convertibile &&
    (/ABITAZIONE_IN_VILL|^\s*A\s*\/\s*[78]\b/i.test(categoria) || (r.prezzo ?? 0) >= PREZZO_GRANDE_SENZA_MQ);
  if (forseGrande) avvisi.push("superficie non letta su un'abitazione forse grande: verificarla nella perizia");

  const parziale = dirittoParziale(titolo);
  if (parziale) avvisi.push(`diritto parziale ("${parziale}"): verificare cosa si compra`);

  // Sul PVP le aste deserte si contano solo aprendo il dettaglio, che porta anche il termine delle
  // offerte: uno zero senza termine e' un dato mai letto, non un lotto mai andato deserto
  const deserti = r.n_esperimenti_deserti === 0 && r.termine_offerte == null ? null : r.n_esperimenti_deserti;
  if (deserti == null) avvisi.push("aste deserte non note (dettaglio non aperto): verificarle sul PVP");

  const scadenza = r.termine_offerte ?? r.data_asta;
  const aperto = scadenza == null || scadenza.slice(0, 10) >= oggi;
  if (scadenza == null) avvisi.push("termine offerte non noto");
  else if (r.termine_offerte == null) avvisi.push(`termine offerte non noto: l'asta e' il ${r.data_asta}, le offerte chiudono prima`);

  const candidato = criteri.length > 0 && (deserti ?? 0) >= 1 && aperto && !parziale;
  const daVerificare = !candidato && aperto && (criteri.length > 0 || forseGrande) && (deserti == null || deserti >= 1);
  return { candidato, daVerificare, criteri, avvisi };
}

export interface ElencoBinarioA {
  candidati: { riga: ImmobileRow; esito: EsitoBinarioA }[];
  daVerificare: { riga: ImmobileRow; esito: EsitoBinarioA }[];
}

/** Candidati binario A ancora aperti (dal termine piu' vicino) e lotti da verificare (dal prezzo piu' basso). */
export function candidatiBinarioA(righe: ImmobileRow[], oggi: string): ElencoBinarioA {
  const valutate = righe
    .filter((r) => r.fonte !== "demanio") // canale statale congelato (decisione del 18/10/2026)
    .map((riga) => ({ riga, esito: valutaBinarioA(riga, oggi) }));
  const scadenza = (r: ImmobileRow) => r.termine_offerte ?? r.data_asta ?? "9999";
  return {
    candidati: valutate.filter((x) => x.esito.candidato).sort((a, b) => scadenza(a.riga).localeCompare(scadenza(b.riga))),
    daVerificare: valutate.filter((x) => x.esito.daVerificare).sort((a, b) => (a.riga.prezzo ?? Infinity) - (b.riga.prezzo ?? Infinity)),
  };
}

/** La data di oggi in Italia: in UTC, dopo la mezzanotte italiana resterebbe aperto un termine gia' scaduto. */
export function oggiInItalia(adesso = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(adesso);
}
