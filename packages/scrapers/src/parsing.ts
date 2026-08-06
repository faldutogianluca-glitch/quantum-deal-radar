import type { TipoPrezzo } from "@qdr/core";

const VALUTA_SIMBOLI: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP" };

/** Parser tollerante per prezzi in stile italiano: "€ 123.456,00" o "123.000 €". */
export function parseImporto(raw: string): number | null {
  const match = raw.match(/([\d.,]+)/);
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
