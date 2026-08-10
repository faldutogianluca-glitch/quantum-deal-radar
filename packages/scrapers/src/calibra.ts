import { ispezionaSchede, type CampoInterno, type EsitoIspezione } from "./ispeziona.js";
import { parseDataIt, parseImporto } from "./parsing.js";
import { proponiSelettori } from "./cattura.js";

/**
 * Proposta automatica dei selettori di una scheda.
 *
 * Calibrare venti fonti a mano significa, per ognuna, guardare un elenco di
 * classi e decidere quale porta il prezzo e quale la data. E' un lavoro che il
 * calcolatore sa fare meglio di una persona, perche' il segnale sta nei
 * *valori*: "€ 320.000" e' un prezzo qualunque sia il nome della classe, e
 * "12/03/2026" e' una data anche se la classe si chiama `.mds-caption-2`.
 *
 * Le proposte non vengono applicate: vengono scritte come bozza da rivedere.
 * Un selettore sbagliato riempie il database di valori plausibili e sbagliati,
 * che e' molto peggio di un campo vuoto.
 */

export type Confidenza = "alta" | "media" | "bassa";

export interface CampoProposto {
  campo: string;
  selettore: string;
  confidenza: Confidenza;
  /** Perche' e' stato proposto: serve a chi rivede, non al codice. */
  motivo: string;
  esempi: string[];
  /** Su quante schede il selettore trova qualcosa. */
  presenteIn: number;
}

const RE_IMPORTO = /(?:€|eur\b)|(?:\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/i;
const RE_DATA = /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b\d{1,2}\s+(?:gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)/i;
const RE_MQ = /\b\d+(?:[.,]\d+)?\s*(?:mq|m²|m2|metri quadri)\b/i;
const RE_LOTTO = /\blotto\b/i;
const RE_ESPERIMENTO = /\besperiment|\btentativ|\bdeserta?\b/i;
const RE_TRIBUNALE = /\btribunale\b/i;
const RE_RGE = /\bR\.?G\.?E\.?\b|\bn\.\s*\d+\/\d{4}\b/i;
const RE_OCCUPAZIONE = /\boccupat|\blibero\b|\bnon liber/i;
const RE_VENDITA = /\basta\b|\bpre-?asta\b|\bvendita\b|\btrattativa\b|\boffert/i;

/** Un valore che somiglia a un prezzo *e* ha un ordine di grandezza credibile. */
function sembraPrezzo(v: string): boolean {
  if (!RE_IMPORTO.test(v)) return false;
  const n = parseImporto(v);
  // sotto i mille non e' il prezzo di un immobile: e' un numero civico, un
  // conteggio, o le spese di una voce accessoria
  return n !== null && n >= 1000;
}

function sembraData(v: string): boolean {
  return RE_DATA.test(v) && parseDataIt(v) !== null;
}

/** Testo breve, senza cifre, in forma di nome proprio: un comune, di norma. */
function sembraComune(v: string): boolean {
  return v.length >= 3 && v.length <= 40 && !/\d/.test(v) && /^[A-ZÀ-Ú]/.test(v);
}

interface Regola {
  campo: string;
  /** Vale su un valore d'esempio. */
  prova: (v: string) => boolean;
  motivo: string;
  /** Quante schede devono averlo perche' la confidenza sia alta. */
  richiedeTutte?: boolean;
}

const REGOLE: Regola[] = [
  { campo: "prezzoRaw", prova: sembraPrezzo, motivo: "il valore e' un importo di ordine immobiliare" },
  { campo: "dataAstaRaw", prova: sembraData, motivo: "il valore si interpreta come data italiana" },
  { campo: "mqRaw", prova: (v) => RE_MQ.test(v), motivo: "il valore porta un'unita' di superficie" },
  { campo: "numeroLotto", prova: (v) => RE_LOTTO.test(v), motivo: 'il testo contiene "lotto"' },
  { campo: "nEsperimentiDeserti", prova: (v) => RE_ESPERIMENTO.test(v), motivo: "il testo parla di esperimenti o aste deserte" },
  { campo: "tribunale", prova: (v) => RE_TRIBUNALE.test(v) || RE_RGE.test(v), motivo: "il testo nomina il tribunale o un RGE" },
  { campo: "statoOccupazionale", prova: (v) => RE_OCCUPAZIONE.test(v), motivo: "il testo descrive lo stato occupazionale" },
  { campo: "tipoVendita", prova: (v) => RE_VENDITA.test(v), motivo: "il testo descrive il tipo di vendita" },
  { campo: "comune", prova: sembraComune, motivo: "testo breve senza cifre, in forma di nome proprio", richiedeTutte: true },
];

/**
 * Assegna i campi guardando i valori d'esempio, non i nomi delle classi.
 *
 * Un campo viene proposto una volta sola: fra piu' candidati vince quello
 * presente su piu' schede, e a parita' il piu' specifico. Gli altri restano
 * fuori dalla bozza ma vengono elencati fra le alternative, perche' e'
 * esattamente li' che l'euristica puo' sbagliare.
 */
export function proponiCampi(ispezione: EsitoIspezione): {
  proposte: CampoProposto[];
  alternative: CampoProposto[];
} {
  const totale = ispezione.occorrenze;
  const trovati: CampoProposto[] = [];
  const alternativeScartate: CampoProposto[] = [];

  const valuta = (c: CampoInterno, regola: Regola): CampoProposto | null => {
    const validi = c.esempi.filter(regola.prova);
    if (validi.length === 0) return null;
    // tutti gli esempi devono rispettare la regola: se solo alcuni lo fanno,
    // il selettore prende un blocco misto e il campo sarebbe inaffidabile
    if (validi.length !== c.esempi.length) return null;

    const copertura = totale > 0 ? c.presenteIn / totale : 0;
    let confidenza: Confidenza = "bassa";
    if (copertura === 1) confidenza = "alta";
    else if (copertura >= 0.5) confidenza = "media";
    if (regola.richiedeTutte && copertura < 1) confidenza = "bassa";

    return {
      campo: regola.campo,
      selettore: c.selettore,
      confidenza,
      motivo: regola.motivo,
      esempi: c.esempi.slice(0, 2),
      presenteIn: c.presenteIn,
    };
  };

  // Un selettore serve un campo solo. "Asta del 12/03/2027" soddisfa sia la
  // regola della data sia quella del tipo di vendita: senza questo vincolo il
  // config mapperebbe lo stesso elemento su due campi, e tipoVendita finirebbe
  // per contenere una data. REGOLE e' in ordine di specificita', quindi vince
  // la prima che rivendica il selettore.
  const rivendicati = new Set<string>();
  for (const regola of REGOLE) {
    for (const c of ispezione.campi) {
      const p = valuta(c, regola);
      if (!p) continue;
      if (rivendicati.has(c.selettore)) {
        alternativeScartate.push({ ...p, motivo: `${p.motivo}, ma il selettore serve gia' un altro campo` });
        continue;
      }
      rivendicati.add(c.selettore);
      trovati.push(p);
    }
  }

  // il titolo non ha una forma riconoscibile: e' il testo piu' lungo presente
  // su tutte le schede, escluse le classi gia' assegnate a un campo tipizzato
  const assegnati = new Set(trovati.map((t) => t.selettore));
  const titolo = ispezione.campi
    .filter((c) => c.presenteIn === totale && !assegnati.has(c.selettore))
    .filter((c) => (c.esempi[0]?.length ?? 0) >= 12 && !sembraPrezzo(c.esempi[0] ?? ""))
    // A parita' di testo vince l'elemento piu' interno: un <a> che avvolge
    // titolo e immagine ha lo stesso testo del titolo, ma puntarci il selettore
    // e' fragile — basta un badge aggiunto dentro il link perche' il valore
    // cambi senza che nessuno abbia toccato niente.
    .sort(
      (a, b) =>
        (b.esempi[0]?.length ?? 0) - (a.esempi[0]?.length ?? 0) ||
        Number(a.haFigliElemento) - Number(b.haFigliElemento),
    )[0];
  if (titolo) {
    trovati.push({
      campo: "titolo",
      selettore: titolo.selettore,
      confidenza: "media",
      motivo: "testo piu' lungo presente su tutte le schede",
      esempi: titolo.esempi.slice(0, 2),
      presenteIn: titolo.presenteIn,
    });
  }

  // link e immagine si leggono dagli attributi, non dal testo
  for (const c of ispezione.collegamenti) {
    const campo = c.selettore.includes("attr(href)") ? "url" : "immagineUrl";
    if (c.selettore.startsWith("img") && campo === "url") continue;
    trovati.push({
      campo,
      selettore: c.selettore,
      confidenza: c.presenteIn === totale ? "alta" : "media",
      motivo: campo === "url" ? "collegamento presente nella scheda" : "immagine della scheda",
      esempi: c.esempi.slice(0, 2),
      presenteIn: c.presenteIn,
    });
  }

  // un campo per volta: vince chi copre piu' schede
  const proposte: CampoProposto[] = [];
  const alternative: CampoProposto[] = [];
  const perCampo = new Map<string, CampoProposto[]>();
  for (const t of trovati) {
    const lista = perCampo.get(t.campo) ?? [];
    lista.push(t);
    perCampo.set(t.campo, lista);
  }
  for (const [, lista] of perCampo) {
    lista.sort((a, b) => b.presenteIn - a.presenteIn || a.selettore.length - b.selettore.length);
    proposte.push(lista[0]!);
    alternative.push(...lista.slice(1));
  }

  const ordine = ["titolo", "url", "prezzoRaw", "comune", "indirizzoRaw", "dataAstaRaw"];
  proposte.sort((a, b) => {
    const ia = ordine.indexOf(a.campo);
    const ib = ordine.indexOf(b.campo);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.campo.localeCompare(b.campo);
  });

  return { proposte, alternative: [...alternative, ...alternativeScartate] };
}

export interface EsitoCalibrazione {
  listSelector: string;
  /** Da dove viene il listSelector: scelto dall'euristica o gia' nel config. */
  origineListSelector: "proposto" | "config";
  schede: number;
  proposte: CampoProposto[];
  alternative: CampoProposto[];
  /** Bozza pronta da incollare nel config della fonte. */
  bozza: { listSelector: string; fields: Record<string, string> };
  ispezione: EsitoIspezione;
}

/**
 * Dalla pagina catturata alla bozza di config.
 *
 * `listSelectorNoto` ha la precedenza quando e' gia' stato calibrato: se una
 * fonte funziona, un'euristica non deve poterla cambiare alle spalle di chi la
 * mantiene.
 */
export function calibraDaHtml(html: string, listSelectorNoto?: string): EsitoCalibrazione {
  let listSelector = listSelectorNoto ?? "";
  let origine: "proposto" | "config" = "config";

  const utilizzabile =
    listSelector && !listSelector.includes("DA-COMPILARE") && ispezionaSchede(html, listSelector).occorrenze > 0;

  if (!utilizzabile) {
    const candidati = proponiSelettori(html);
    if (candidati.length === 0) {
      throw new Error(
        "Nessun blocco ripetuto riconosciuto nella pagina. Le schede non sono state catturate: " +
          "il contenuto arriva dopo un'interazione, oppure l'URL non e' un elenco di risultati.",
      );
    }
    listSelector = candidati[0]!.selettore;
    origine = "proposto";
  }

  const ispezione = ispezionaSchede(html, listSelector);
  const { proposte, alternative } = proponiCampi(ispezione);

  const fields: Record<string, string> = {};
  for (const p of proposte) fields[p.campo] = p.selettore;

  return {
    listSelector,
    origineListSelector: origine,
    schede: ispezione.occorrenze,
    proposte,
    alternative,
    bozza: { listSelector, fields },
    ispezione,
  };
}
