import * as cheerio from "cheerio";

import { avviaChromium } from "./browserLauncher.js";
import { consentito, rallenta, USER_AGENT } from "./robots.js";

/**
 * Cattura di una pagina per calibrare i selettori.
 *
 * Scrivere un adapter richiede di vedere il DOM reale. Questo comando lo scarica
 * una volta sola e lo salva su file, cosi' la calibrazione avviene offline e
 * senza ripetere richieste al sito a ogni tentativo.
 */

export interface EsitoCattura {
  url: string;
  html: string;
  /** Classi che si ripetono: candidate a essere le schede dei risultati. */
  candidati: CandidatoSelettore[];
  titolo: string | null;
}

export interface CandidatoSelettore {
  selettore: string;
  occorrenze: number;
  /** Quante di quelle occorrenze contengono un link: una scheda di norma ce l'ha. */
  conLink: number;
  /** Testo del primo elemento, troncato: serve a riconoscere a colpo d'occhio cos'e'. */
  anteprima: string;
}

/**
 * Cerca i blocchi che si ripetono nella pagina. In un elenco di annunci la
 * scheda e' quasi sempre una classe che compare molte volte, contiene un link
 * e del testo: e' il punto da cui partire per `listSelector`.
 */
export function proponiSelettori(html: string, minimo = 3): CandidatoSelettore[] {
  const $ = cheerio.load(html);
  const conteggi = new Map<string, { n: number; conLink: number; primo: string }>();

  $("*").each((_, el) => {
    const classi = ($(el).attr("class") ?? "").split(/\s+/).filter(Boolean);
    for (const c of classi) {
      // le classi di utility (una lettera, o generate) raramente identificano una scheda
      if (c.length < 3) continue;
      const voce = conteggi.get(c) ?? { n: 0, conLink: 0, primo: "" };
      voce.n++;
      if ($(el).find("a").length > 0) voce.conLink++;
      if (!voce.primo) voce.primo = $(el).text().replace(/\s+/g, " ").trim().slice(0, 80);
      conteggi.set(c, voce);
    }
  });

  return [...conteggi.entries()]
    .filter(([, v]) => v.n >= minimo && v.conLink >= Math.ceil(v.n / 2) && v.primo.length > 10)
    .map(([c, v]) => ({ selettore: `.${c}`, occorrenze: v.n, conLink: v.conLink, anteprima: v.primo }))
    // prima i blocchi meno numerosi: una classe che compare 8 volte e' piu'
    // probabilmente la scheda di una che ne compare 200 (spesso un wrapper interno)
    .sort((a, b) => a.occorrenze - b.occorrenze)
    .slice(0, 12);
}

/**
 * Attende che il DOM smetta di cambiare.
 *
 * Un'attesa a tempo fisso e' una scommessa: troppo corta su un sito lento
 * restituisce una pagina vuota e chi la guarda non capisce perche'. Nemmeno
 * `networkidle` basta, perche' una lista popolata da un semplice timer non
 * genera traffico da attendere. Qui si osserva la dimensione del contenuto
 * finche' non resta stabile per due rilevazioni di fila.
 */
async function attendiDomStabile(page: import("playwright").Page, massimoMs: number): Promise<void> {
  const intervallo = 500;
  // Nei primi istanti la pagina non cambia comunque: concludere subito la
  // direbbe "stabile" mentre i risultati devono ancora arrivare. Si osserva
  // quindi per un tempo minimo prima di poter dichiarare la stabilita'.
  const osservazioneMinimaMs = 4000;
  const stabiliRichieste = 3;

  let precedente = -1;
  let stabili = 0;

  for (let atteso = 0; atteso < massimoMs; atteso += intervallo) {
    const dimensione = await page.evaluate(() => document.body?.innerHTML.length ?? 0);
    if (dimensione === precedente && dimensione > 0) stabili++;
    else stabili = 0;
    precedente = dimensione;

    if (atteso >= osservazioneMinimaMs && stabili >= stabiliRichieste) return;
    await page.waitForTimeout(intervallo);
  }
}

export async function catturaPagina(
  url: string,
  opzioni: {
    modo?: "static" | "browser";
    attendiSelettore?: string;
    timeoutMs?: number;
    /** Tetto all'attesa che il DOM si stabilizzi. */
    attesaMassimaMs?: number;
  } = {},
): Promise<EsitoCattura> {
  if (!(await consentito(url))) {
    throw new Error(`robots.txt vieta l'accesso a ${url}`);
  }
  await rallenta("cattura", 2);

  const modo = opzioni.modo ?? "browser";
  const timeout = opzioni.timeoutMs ?? 30_000;
  let html: string;

  if (modo === "static") {
    const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} su ${url}`);
    html = await resp.text();
  } else {
    const { browser, chiudi } = await avviaChromium();
    try {
      const page = await browser.newPage({ userAgent: USER_AGENT, locale: "it-IT" });
      const risposta = await page.goto(url, { timeout, waitUntil: "domcontentloaded" });
      if (risposta && !risposta.ok()) throw new Error(`HTTP ${risposta.status()} su ${url}`);
      if (opzioni.attendiSelettore) {
        await page.waitForSelector(opzioni.attendiSelettore, { timeout }).catch(() => undefined);
      }

      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await attendiDomStabile(page, opzioni.attesaMassimaMs ?? 20_000);
      html = await page.content();
    } finally {
      await chiudi();
    }
  }

  const $ = cheerio.load(html);
  return {
    url,
    html,
    titolo: $("title").first().text().trim() || null,
    candidati: proponiSelettori(html),
  };
}
