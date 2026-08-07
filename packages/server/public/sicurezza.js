/**
 * Sanificazione dei dati scrapati prima di inserirli nel DOM.
 *
 * Titoli, comuni e URL arrivano da portali di terzi: vanno trattati come ostili.
 * Queste funzioni sono in un modulo separato, senza dipendenze dal DOM, cosi'
 * sono verificabili direttamente in Node (vedi sicurezza.test.ts) invece che
 * solo aprendo un browser.
 */

/** Per il contenuto testuale: neutralizza i caratteri che aprono un tag o un'entita'. */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Per i valori inseriti dentro un attributo. escapeHtml() non basta: non tocca
 * le virgolette, e un valore che ne contiene una chiude l'attributo e permette
 * di iniettarne altri (onclick, onerror...) fino all'esecuzione di codice.
 */
export function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Ammette solo URL navigabili su http/https. Uno schema come javascript: o
 * data: eseguirebbe codice nell'origine della dashboard al clic dell'utente.
 * Ritorna null quando l'URL non e' utilizzabile, cosi' il chiamante puo'
 * semplicemente non rendere il link.
 */
export function urlSicuro(raw, base) {
  if (!raw) return null;
  try {
    const u = base === undefined ? new URL(raw) : new URL(raw, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
