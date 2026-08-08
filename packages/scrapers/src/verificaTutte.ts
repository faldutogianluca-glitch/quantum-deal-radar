import { loadSiteConfigs } from "./registry.js";
import { ispezionaRobots, rallenta } from "./robots.js";
import type { EsitoRobots } from "./robots.js";
import type { SiteConfig } from "./types.js";

/** Un config senza blocco compliance vale come non verificato: e' il default prudente. */
type StatoCompliance = NonNullable<SiteConfig["compliance"]>["stato"];

/**
 * Verifica di conformita' su tutte le fonti configurate.
 *
 * Controllare venti portali uno per uno e' un lavoro che si interrompe a meta'
 * e va rifatto. Qui si scorre l'elenco una volta sola, distanziando le
 * richieste, e si ottiene un quadro unico da cui decidere quali fonti aprire.
 * La verifica riguarda solo `robots.txt`: le condizioni d'uso vanno lette a
 * parte, e il verdetto finale resta di chi gestisce il progetto.
 */

export interface RigaVerifica {
  fonte: string;
  displayName: string;
  url: string;
  /** Stato registrato nel config: e' la decisione presa, non il responso del sito. */
  statoDichiarato: StatoCompliance;
  /** null quando l'URL e' ancora un segnaposto: non si e' interrogato nulla. */
  esito: EsitoRobots | null;
  stato: number | null;
  consentito: boolean;
  crawlDelay?: number;
  errore?: string;
}

/** Un URL che non e' ancora stato fornito: interrogarlo non avrebbe senso. */
function daCompilare(url: string): boolean {
  return url.includes("DA-COMPILARE") || url.endsWith(".invalid") || url.includes(".invalid/");
}

/** L'URL su cui la fonte lavorerebbe davvero. */
export function urlDiVerifica(c: SiteConfig): string | null {
  if (c.fetchMode === "file") return null;
  if (c.urlTemplate) {
    // il template contiene segnaposto: si sostituisce il primo valore reale,
    // altrimenti l'URL non sarebbe valido e la verifica fallirebbe per un motivo
    // che non c'entra con la conformita'
    let url = c.urlTemplate;
    for (const [chiave, valori] of Object.entries(c.parametri ?? {})) {
      url = url.replaceAll(`{${chiave}}`, valori[0] ?? "");
    }
    return url;
  }
  return c.searchUrl;
}

export async function verificaTutteLeFonti(
  opzioni: { secondiTraRichieste?: number } = {},
): Promise<RigaVerifica[]> {
  const configs = await loadSiteConfigs();
  const pausa = opzioni.secondiTraRichieste ?? 2;
  const righe: RigaVerifica[] = [];

  // ordine di monitoraggio: si guarda per prima la fonte che conta di piu'
  const ordinate = [...configs].sort(
    (a, b) => (a.ordineMonitoraggio ?? 99) - (b.ordineMonitoraggio ?? 99),
  );

  for (const c of ordinate) {
    const url = urlDiVerifica(c);
    if (url === null) continue; // fixture locale: non c'e' nessun sito da interrogare

    const base = {
      fonte: c.name,
      displayName: c.displayName,
      url,
      statoDichiarato: c.compliance?.stato ?? "da_verificare",
    };

    if (daCompilare(url)) {
      righe.push({ ...base, esito: null, stato: null, consentito: false });
      continue;
    }

    // una verifica non e' una scusa per martellare: le richieste restano distanziate
    await rallenta(new URL(url).origin, pausa);
    try {
      const e = await ispezionaRobots(url);
      righe.push({
        ...base,
        esito: e.esito,
        stato: e.stato,
        consentito: e.consentito,
        ...(e.crawlDelay !== undefined ? { crawlDelay: e.crawlDelay } : {}),
        ...(e.errore ? { errore: e.errore } : {}),
      });
    } catch (err) {
      // un URL malformato in un config non deve interrompere la verifica delle altre
      righe.push({
        ...base,
        esito: "irraggiungibile",
        stato: null,
        consentito: false,
        errore: (err as Error).message,
      });
    }
  }

  return righe;
}

/** Verdetto in una parola, per la tabella riassuntiva. */
export function verdetto(r: RigaVerifica): string {
  if (r.esito === null) return "URL DA FORNIRE";
  switch (r.esito) {
    case "regole_lette":
      return r.consentito ? "consentito" : "VIETATO";
    case "assente":
      return "nessun robots.txt";
    case "accesso_negato":
      return "ROBOTS NEGATO";
    case "errore_server":
      return "SERVER KO";
    case "irraggiungibile":
      return "IRRAGGIUNGIBILE";
  }
}

/**
 * Riconosce l'esito che non riguarda i siti ma chi li interroga.
 *
 * Se quasi tutte le fonti rispondono "accesso negato" o "irraggiungibile", la
 * spiegazione plausibile non e' che venti portali diversi siano ostili nello
 * stesso momento: e' la rete di chi sta verificando — un proxy aziendale, una
 * VPN, un DNS che filtra. Segnalarlo evita di prendere per verdetto quello che
 * e' un guasto locale, e di scartare fonti buone per un motivo sbagliato.
 */
export function sospettoBloccoDiRete(righe: RigaVerifica[]): boolean {
  const interrogate = righe.filter((r) => r.esito !== null);
  if (interrogate.length < 4) return false;
  const fallite = interrogate.filter(
    (r) => r.esito === "accesso_negato" || r.esito === "irraggiungibile",
  );
  return fallite.length >= Math.ceil(interrogate.length * 0.8);
}

/**
 * Le fonti su cui manca ancora una decisione. Il responso di robots.txt non
 * basta ad aprire una fonte: finche' `compliance.stato` non viene messo a mano,
 * lo scraper non parte, ed e' cosi' di proposito.
 */
export function daDecidere(righe: RigaVerifica[]): RigaVerifica[] {
  return righe.filter(
    (r) =>
      r.statoDichiarato === "da_verificare" &&
      (r.esito === "regole_lette" || r.esito === "assente") &&
      r.consentito,
  );
}
