import type { TipoPrezzo } from "@qdr/core";

const VALUTA_SIMBOLI: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP" };

/** Parser tollerante per prezzi in stile italiano: "€ 123.456,00" o "123.000 €". */
export function parseImporto(raw: string): number | null {
  // il numero deve contenere una cifra: "[\d.,]+" da solo trovava il punto di
  // "sup." o "Euro." e lo leggeva come zero
  const match = raw.match(/(\d[\d.,]*)/);
  if (!match?.[1]) return null;

  // Convenzione italiana: '.' e' sempre separatore delle migliaia, ',' e' sempre
  // il separatore decimale. Senza virgola, ogni punto e' quindi un separatore
  // delle migliaia da rimuovere (anche uno solo, es. "210.000" = 210000).
  let numero = match[1];
  if (numero.includes(",")) {
    numero = numero.replace(/\./g, "").replace(",", ".");
  } else {
    numero = numero.replace(/\./g, "");
  }

  const valore = Number(numero);
  return Number.isFinite(valore) ? valore : null;
}

/**
 * Superficie da una cella che puo' elencarne piu' d'una: "sub. 8 - 99 mq sub.16 -
 * 26 mq", "A/1: 404 mq, C/6: 20 mq", "sup. cat. mq 199 + 97". Il primo numero
 * e' spesso un subalterno o una categoria, non la superficie. Si prende il numero
 * piu' grande scritto accanto a "mq" (prima o dopo): e' l'unita' principale, le
 * pertinenze (box, cantine) sono piu' piccole. Senza nessun "mq", il primo numero.
 */
export function parseSuperficie(raw: string): number | null {
  const testo = raw.replace(/m²|m2\b|metri quadr\w*/gi, "mq");
  const numero = (s: string) => parseImporto(s);
  const candidati: number[] = [];
  for (const m of testo.matchAll(/(\d[\d.,]*)\s*mq/gi)) {
    const n = numero(m[1]!);
    if (n) candidati.push(n);
  }
  // "mq 199 + 97": i numeri dopo "mq" fino al primo testo
  for (const m of testo.matchAll(/mq\.?\s*((?:\d[\d.,]*\s*\+?\s*)+)/gi)) {
    for (const parte of m[1]!.split("+")) {
      const n = numero(parte);
      if (n) candidati.push(n);
    }
  }
  if (candidati.length) return Math.max(...candidati);
  return numero(testo);
}

export function valutaSimbolo(raw: string): string | null {
  for (const [simbolo, codice] of Object.entries(VALUTA_SIMBOLI)) {
    if (raw.includes(simbolo)) return codice;
  }
  return null;
}

const MESI_IT: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

/** Parser tollerante per date in stile italiano: "12/05/2026" o "12 maggio 2026". Ritorna YYYY-MM-DD. */
export function parseDataIt(raw: string): string | null {
  const testo = raw.trim();

  const numerica = testo.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/);
  if (numerica) {
    const [, giornoStr, meseStr, annoStr] = numerica;
    let anno = Number(annoStr);
    if (anno < 100) anno += 2000;
    return isoData(anno, Number(meseStr), Number(giornoStr));
  }

  const mesiPattern = Object.keys(MESI_IT).join("|");
  const testuale = new RegExp(`(\\d{1,2})\\s+(${mesiPattern})\\s+(\\d{4})`, "i").exec(testo);
  if (testuale) {
    const [, giornoStr, meseNome, annoStr] = testuale;
    const mese = MESI_IT[(meseNome ?? "").toLowerCase()];
    if (mese) return isoData(Number(annoStr), mese, Number(giornoStr));
  }

  return null;
}

function isoData(anno: number, mese: number, giorno: number): string | null {
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (d.getUTCFullYear() !== anno || d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) return null;
  return d.toISOString().slice(0, 10);
}

export function tipoPrezzoValido(v: string | undefined): TipoPrezzo | undefined {
  return v === "base_asta" || v === "richiesta_reoco" || v === "trattativa" ? v : undefined;
}
