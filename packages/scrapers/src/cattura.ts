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
  /** Cosa e' successo con l'eventuale banner di consenso ai cookie. */
  consenso: EsitoConsenso;
}

export type EsitoConsenso =
  /** Nessun banner trovato: la pagina si e' aperta libera. */
  | { tipo: "assente" }
  /** Trovato e chiuso rifiutando i cookie non necessari. */
  | { tipo: "rifiutato"; selettore: string }
  /**
   * Trovato, ma senza un modo per rifiutare: l'unica via era accettare tutto,
   * e quella scelta non spetta a un programma.
   */
  | { tipo: "irrisolto"; dettaglio: string };

/**
 * Selettori con cui i banner di consenso permettono di NON accettare i cookie
 * facoltativi. L'ordine conta: prima il rifiuto esplicito, poi il "solo
 * necessari", che e' equivalente ma meno diretto.
 *
 * Qui non si aggira nulla: si compie la stessa scelta che farebbe una persona
 * davanti al banner, ed e' deliberatamente la piu' restrittiva. Il pulsante
 * "accetta tutto" non e' in elenco, e non deve entrarci: acconsentire alla
 * profilazione per conto di qualcun altro non e' una decisione da automatizzare.
 */
const RIFIUTO_CONSENSO = [
  // Cookiebot
  "#CybotCookiebotDialogBodyButtonDecline",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowNecessaryCookies",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll",
  // OneTrust
  "#onetrust-reject-all-handler",
  ".ot-pc-refuse-all-handler",
  // Iubenda, molto diffuso sui siti italiani
  ".iubenda-cs-reject-btn",
  // Quantcast / TCF
  "button[mode='secondary'][aria-label*='Rifiuta' i]",
];

/** Testi che, su un pulsante, indicano il rifiuto dei cookie facoltativi. */
const TESTI_RIFIUTO =
  /^(rifiuta(\s+tutt[oi])?|solo\s+(i\s+)?necessari|continua\s+senza\s+accettare|accetta\s+solo\s+(i\s+)?necessari|reject\s+all|decline)$/i;

/**
 * Chiude il banner di consenso, se c'e'.
 *
 * Molti portali non mostrano i risultati finche' il banner e' aperto: la
 * cattura restituisce allora una pagina fatta di intestazione, footer e
 * dialogo dei cookie, e chi la guarda non capisce perche' manchino gli annunci
 * che vede benissimo nel browser.
 */
async function chiudiBannerConsenso(page: import("playwright").Page): Promise<EsitoConsenso> {
  for (const sel of RIFIUTO_CONSENSO) {
    const bottone = page.locator(sel).first();
    if (await bottone.isVisible().catch(() => false)) {
      await bottone.click({ timeout: 5000 }).catch(() => undefined);
      return { tipo: "rifiutato", selettore: sel };
    }
  }

  // nessun selettore noto: si cerca per testo, che copre i banner artigianali
  const bottoni = page.locator("button, a[role='button']");
  const quanti = Math.min(await bottoni.count().catch(() => 0), 60);
  for (let i = 0; i < quanti; i++) {
    const b = bottoni.nth(i);
    const testo = ((await b.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
    if (!TESTI_RIFIUTO.test(testo)) continue;
    if (!(await b.isVisible().catch(() => false))) continue;
    await b.click({ timeout: 5000 }).catch(() => undefined);
    return { tipo: "rifiutato", selettore: `testo "${testo}"` };
  }

  // resta da capire se un banner c'e' comunque, e blocca la pagina
  const indizi = ["#CybotCookiebotDialog", "#onetrust-banner-sdk", ".iubenda-cs-container", "[id*='cookie' i][role='dialog']"];
  for (const sel of indizi) {
    if (await page.locator(sel).first().isVisible().catch(() => false)) {
      return {
        tipo: "irrisolto",
        dettaglio:
          `c'e' un banner di consenso (${sel}) ma non ho trovato un modo per rifiutare i ` +
          `cookie facoltativi. L'unica via sembra accettare tutto, e quella scelta non la prendo io.`,
      };
    }
  }

  return { tipo: "assente" };
}

export interface CandidatoSelettore {
  selettore: string;
  occorrenze: number;
  /** Quante di quelle occorrenze contengono un link: una scheda di norma ce l'ha. */
  conLink: number;
  /**
   * Quanti testi diversi hanno fra loro quelle occorrenze. E' il segnale che
   * separa un elenco di annunci (ogni scheda ha un contenuto suo) da menu,
   * footer e classi di impaginazione (ripetono sempre lo stesso testo).
   */
  testiDistinti: number;
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
  const conteggi = new Map<string, { n: number; conLink: number; testi: Set<string>; primo: string }>();

  $("*").each((_, el) => {
    const classi = ($(el).attr("class") ?? "").split(/\s+/).filter(Boolean);
    if (classi.length === 0) return;
    const testo = $(el).text().replace(/\s+/g, " ").trim();
    const haLink = $(el).find("a").length > 0;

    for (const c of classi) {
      // le classi di utility (una o due lettere) raramente identificano una scheda
      if (c.length < 3) continue;
      const voce = conteggi.get(c) ?? { n: 0, conLink: 0, testi: new Set<string>(), primo: "" };
      voce.n++;
      if (haLink) voce.conLink++;
      if (testo) voce.testi.add(testo.slice(0, 120));
      if (!voce.primo && testo) voce.primo = testo.slice(0, 80);
      conteggi.set(c, voce);
    }
  });

  return [...conteggi.entries()]
    .filter(([, v]) => v.n >= minimo && v.conLink >= Math.ceil(v.n / 2) && v.primo.length > 10)
    .map(([c, v]) => ({
      selettore: `.${c}`,
      occorrenze: v.n,
      conLink: v.conLink,
      testiDistinti: v.testi.size,
      anteprima: v.primo,
    }))
    // Ordinare per rarita' era sbagliato: su una pagina con un design system le
    // classi di impaginazione si ripetono poche volte e affollavano i primi posti,
    // spingendo fuori le schede vere. Il segnale che le distingue e' che ogni
    // scheda ha un contenuto DIVERSO, mentre menu e footer ripetono lo stesso
    // testo. Si ordina quindi per varieta' del contenuto.
    .sort((a, b) => b.testiDistinti - a.testiDistinti || b.occorrenze - a.occorrenze)
    .slice(0, 15);
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

/**
 * Scorre la pagina fino in fondo, a scatti.
 *
 * I portali di annunci caricano quasi sempre le schede mentre l'utente scorre.
 * Un salto diretto in fondo spesso non basta: il caricamento e' legato al
 * superamento di soglie intermedie, quindi si procede per passi.
 */
async function scorriFinoInFondo(page: import("playwright").Page, passi = 8): Promise<void> {
  let altezzaPrecedente = 0;
  for (let i = 0; i < passi; i++) {
    const altezza = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.9);
      return document.body?.scrollHeight ?? 0;
    });
    await page.waitForTimeout(700);
    // la pagina non cresce piu' e siamo in fondo: inutile insistere
    if (altezza === altezzaPrecedente && i > 2) break;
    altezzaPrecedente = altezza;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function catturaPagina(
  url: string,
  opzioni: {
    modo?: "static" | "browser";
    attendiSelettore?: string;
    timeoutMs?: number;
    /** Tetto all'attesa che il DOM si stabilizzi. */
    attesaMassimaMs?: number;
    /** Scorre la pagina per far caricare le schede pigre. Attivo per default. */
    scorri?: boolean;
  } = {},
): Promise<EsitoCattura> {
  if (!(await consentito(url))) {
    throw new Error(`robots.txt vieta l'accesso a ${url}`);
  }
  await rallenta("cattura", 2);

  const modo = opzioni.modo ?? "browser";
  const timeout = opzioni.timeoutMs ?? 30_000;
  let html: string;
  let consenso: EsitoConsenso = { tipo: "assente" };

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

      // Prima di misurare la stabilita' del DOM: finche' il banner e' aperto
      // molti portali non montano affatto la lista, e la pagina risulterebbe
      // "stabile" proprio perche' non sta caricando nulla.
      consenso = await chiudiBannerConsenso(page);
      if (consenso.tipo === "rifiutato") {
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      }

      await attendiDomStabile(page, opzioni.attesaMassimaMs ?? 20_000);

      // Molti portali caricano le schede solo quando si scorre. Senza questo,
      // la cattura restituisce l'intestazione e il footer di una pagina che
      // all'utente appare invece piena di annunci.
      if (opzioni.scorri !== false) {
        await scorriFinoInFondo(page);
        await attendiDomStabile(page, 8000);
      }

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
    consenso,
  };
}
