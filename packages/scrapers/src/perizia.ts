import type { Conformita } from "@qdr/core";

/**
 * Lettura della perizia di stima allegata a un annuncio giudiziario.
 *
 * La superficie, il valore stimato dall'esperto, la conformita' edilizia e lo
 * stato di occupazione stanno quasi sempre solo li': il PVP non li riporta nei
 * suoi campi e il delegato li scrive nella descrizione solo a volte. Senza
 * superficie il Gate 0 non si calcola.
 *
 * Le perizie non hanno una struttura comune, ma la maggior parte segue due
 * modelli: quello del Tribunale di Milano (indice sintetico, tabella delle
 * superfici con "mq. lordi mq. commerciali") e quello del software di stima
 * molto usato a Monza ("Consistenza commerciale complessiva unita' principali").
 * Si leggono solo le formule riconosciute: dove nessuna corrisponde, o dove la
 * perizia descrive piu' lotti e non si capisce quale, il campo resta vuoto. Un
 * numero preso dalla riga sbagliata di una perizia di 40 pagine e' peggio di
 * nessun numero.
 *
 * Del testo non si salva nulla: contiene nomi, codici fiscali e indirizzi di
 * debitori, esperti e occupanti. Restano solo i numeri estratti.
 */

/** Cambia quando cambiano le formule: le perizie lette con una versione precedente si rileggono. */
export const VERSIONE_LETTORE = 2;

export interface EsitoPerizia {
  /** Falso per le scansioni senza testo e i PDF con font senza mappatura: servirebbe l'OCR. */
  leggibile: boolean;
  mq: number | null;
  /** Da quale formula viene la superficie: serve a chi controlla. */
  fonteMq: "consistenza_commerciale" | "tabella_commerciale" | "superficie_commerciale" | "catastale" | null;
  /**
   * Valore dopo le decurtazioni per la vendita giudiziaria (assenza di
   * garanzia, regolarizzazioni, spese insolute): e' cio' che il core intende
   * per valore di perizia. Solo dalle formule che lo dichiarano.
   */
  valoreGiudiziario: number | null;
  /** Valore di mercato prima delle decurtazioni: informativo, non entra nella valutazione. */
  valoreMercato: number | null;
  conformita: Conformita | null;
  statoOccupativo: string | null;
  /** La perizia descrive piu' lotti: superficie e valori si prendono solo se riferiti al lotto giusto. */
  piuLotti: boolean;
}

const VUOTO: Omit<EsitoPerizia, "leggibile"> = {
  mq: null,
  fonteMq: null,
  valoreGiudiziario: null,
  valoreMercato: null,
  conformita: null,
  statoOccupativo: null,
  piuLotti: false,
};

/** "1.424,00" -> 1424, "1424,00" -> 1424, "58,7" -> 58.7, "132.075,00" -> 132075 */
function importo(s: string | undefined): number | null {
  if (!s) return null;
  let t = s.trim().replace(/[.,]+$/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "");
  t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Un importo italiano intero: con i punti delle migliaia ("1.424,00") o senza
 * ("1424,00"). Il confine finale impedisce di fermarsi alle prime tre cifre.
 */
const NUMERO = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(?![\d.,]\d)`;
const UNITA = String.raw`(?:m²|m2|m\?|mq)`;
const EURO = String.raw`(?:€\.?|Euro)`;

/** Sotto questa cifra non e' il valore di un immobile in asta, e' una riga letta male. */
const VALORE_MINIMO = 10_000;
const valore = (s: string | undefined) => {
  const n = importo(s);
  return n != null && n >= VALORE_MINIMO ? n : null;
};

/** Parole comuni per pagina sotto cui la pagina e' una scansione o simboli. */
const PAROLE_PER_PAGINA = 8;
const paroleComuni = (testo: string) =>
  testo.match(/\b(il|la|di|del|della|che|per|con|immobile|stima|valore)\b/gi)?.length ?? 0;

/**
 * Un PDF con testo vero contiene parole italiane comuni su quasi ogni pagina.
 * Una scansione non ne ha, un font senza mappatura produce simboli. Un
 * frontespizio di testo davanti a un corpo scansionato non basta: serve che
 * almeno meta' delle pagine sia testo.
 */
export function testoLeggibile(pagine: string[] | string): boolean {
  const lista = typeof pagine === "string" ? [pagine] : pagine.filter((p) => p.trim().length > 0);
  if (lista.length === 0) return false;
  const buone = lista.filter((p) => paroleComuni(p) >= PAROLE_PER_PAGINA).length;
  const totale = paroleComuni(lista.join("\n"));
  return totale >= 25 && buone * 2 >= lista.length;
}

/** "Lotto 1", "LOTTO N. 2", "lotto B": gli identificativi di lotto nominati nella perizia. */
function lottiNominati(testo: string): Set<string> {
  const lotti = new Set<string>();
  // la lettera deve essere maiuscola: "un lotto a sua volta contiguo" non e' il lotto A
  for (const m of testo.matchAll(/\b(?:LOTTO|Lotto|lotto)\s+(?:[Nn]\.?\s*|[Nn]°\s*)?(\d{1,2}|[A-H])\b(?!\s*\/)/g)) lotti.add(m[1]!);
  return lotti;
}

const normalizzaLotto = (l: string | null | undefined) => {
  const n = (l ?? "").toUpperCase().replace(/^LOTTO\s*/, "").replace(/^(N\.?|N°)\s*/, "").replace(/^0+(?=\d)/, "").trim();
  return n === "UNICO" || n === "" ? null : n;
};

/** Prima corrispondenza di una formula la cui parte intermedia non parla di un accessorio. */
const ACCESSORIO = /\b(box|autorimess|cantin|posto auto|posti auto|giardin|terren|cortil|soffitt|solaio)/i;

function superficie(testo: string, piuLotti: boolean): Pick<EsitoPerizia, "mq" | "fonteMq"> {
  // modello del software di stima: il totale del lotto, gia' omogeneizzato
  const consistenza = new RegExp(String.raw`Consistenza commerciale complessiva unit[aà'] principali:\s*${NUMERO}\s*${UNITA}`, "i").exec(testo);
  // in una perizia di piu' lotti il software ripete il riepilogo per lotto: non si sa quale
  if (consistenza && !piuLotti) return { mq: importo(consistenza[1]), fonteMq: "consistenza_commerciale" };
  if (piuLotti) return { mq: null, fonteMq: null };

  // modello di Milano: riga dei totali sopra "mq. lordi mq. commerciali"; la prima tabella e' l'unita' principale
  const tabella = new RegExp(String.raw`${NUMERO}\s+${NUMERO}\s*\n?\s*mq\.?\s*lord[ie]\s+mq\.?\s*commercial[ie]`, "i").exec(testo);
  if (tabella) return { mq: importo(tabella[2]), fonteMq: "tabella_commerciale" };

  // "superficie commerciale complessiva di 85,40 mq", "Superficie commerciale dell'appartamento = mq.58,00".
  // L'unita' deve esserci; fra la formula e il numero niente "€", "/" o "euro" (prezzi unitari)
  const commerciale = new RegExp(
    String.raw`superficie\s+(?:lorda\s+)?commerciale([^\d\n€/]{0,30}?)(?:${UNITA}\.?\s*${NUMERO}|${NUMERO}\s*${UNITA})`,
    "gi",
  );
  for (const m of testo.matchAll(commerciale)) {
    if (/euro|valore|prezzo/i.test(m[1]!) || ACCESSORIO.test(m[1]!)) continue;
    return { mq: importo(m[2] ?? m[3]), fonteMq: "superficie_commerciale" };
  }

  // ultima risorsa: la superficie catastale, che comprende balconi e accessori
  const catastale = new RegExp(
    String.raw`Superficie\s+Catastale\s+Totale\s*:?\s*(?:${UNITA}\.?\s*${NUMERO}|${NUMERO}\s*${UNITA})`,
    "i",
  ).exec(testo);
  if (catastale) return { mq: importo(catastale[1] ?? catastale[2]), fonteMq: "catastale" };

  return { mq: null, fonteMq: null };
}

/**
 * Valore dopo le decurtazioni. In una perizia di piu' lotti solo la formula
 * che nomina il lotto dell'annuncio; se il lotto non si conosce, nessuno.
 */
function valoreGiudiziario(testo: string, piuLotti: boolean, lotto: string | null): number | null {
  if (!piuLotti) {
    const formule = [
      String.raw`Valore di vendita giudiziaria dell'immobile nello stato di fatto e di diritto in cui si\s*trova:\s*${EURO}\s*${NUMERO}`,
      String.raw`Valore\s+LOTTO\s+UNICO\s+al netto delle decurtazioni\s*${EURO}\s*${NUMERO}`,
      String.raw`Prezzo dell'intero al netto delle decurtazioni\s*\n?\s*da liberi:\s*${EURO}\s*${NUMERO}`,
    ];
    for (const f of formule) {
      const m = new RegExp(f, "i").exec(testo);
      if (m) return valore(m[1]);
    }
  }
  if (!lotto) return null;
  const perLotto = new RegExp(
    String.raw`Valore\s+LOTTO\s+(?:N\.?\s*|N°\s*)?${lotto}\s+al netto delle decurtazioni\s*${EURO}\s*${NUMERO}`,
    "i",
  ).exec(testo);
  return perLotto ? valore(perLotto[1]) : null;
}

function valoreMercato(testo: string, piuLotti: boolean, lotto: string | null): number | null {
  if (piuLotti) {
    if (!lotto) return null;
    const m = new RegExp(String.raw`Valore\s+LOTTO\s+(?:N\.?\s*|N°\s*)?${lotto}\s*${EURO}\s*${NUMERO}`, "i").exec(testo);
    return m ? valore(m[1]) : null;
  }
  const formule = [
    String.raw`Valore di Mercato dell'immobile nello stato di fatto e di diritto in cui si trova:\s*${EURO}\s*${NUMERO}`,
    String.raw`Valore\s+LOTTO\s+UNICO\s*${EURO}\s*${NUMERO}`,
    String.raw`Complessivamente\W+LOTTO\s+UNICO\s*${EURO}\s*${NUMERO}`,
    String.raw`Valore\s+Totale\s*[=:]?\s*${EURO}\s*${NUMERO}`,
  ];
  for (const f of formule) {
    const m = new RegExp(f, "i").exec(testo);
    if (m) return valore(m[1]);
  }
  return null;
}

/**
 * Conformita' edilizia e urbanistica dai giudizi dell'esperto. La catastale non
 * conta qui: si sistema con una variazione, non con una sanatoria. Sanabilita'
 * e insanabilita' si cercano solo nel paragrafo del giudizio, non nelle frasi
 * di rito ("le eventuali opere non sanabili...").
 */
function conformita(testo: string): Conformita | null {
  const giudizi = [
    ...testo.matchAll(
      /conformit[aà']\s+(?:edilizia|urbanistica|urbanistico-edilizia|edilizio-urbanistica)\s*:?\s*\n?\s*(non conforme\b|no(?=\s*(?:[.;,\n]|$))|s[iì]\s+parziale|s[iì](?=\s*(?:[.;,\n]|$))|conforme\b|nessuna difformit)/gi,
    ),
  ];
  if (giudizi.length === 0) return null;
  const esito = giudizi.map((m) => m[1]!.toLowerCase());
  const nonConforme = esito.some((g) => g.startsWith("non") || g === "no" || g.includes("parziale"));
  if (!nonConforme) return "conforme";
  const paragrafi = giudizi.map((m) => testo.slice(m.index, m.index + 800)).join("\n");
  const senzaRito = paragrafi.replace(/[^.\n]*\beventual\w*[^.\n]*/gi, "");
  if (/\b(non\s+sanabil|insanabil)/i.test(senzaRito)) return "insanabile";
  // l'esperto ha quantificato la regolarizzazione: e' sanabile, a quel costo
  if (/(spese|costi|oneri)\s+(?:di|per)\s+(?:la\s+)?regolarizzazione|\bsanabil|\bregolarizzabil|\bsanatoria\b/i.test(senzaRito)) return "sanabile";
  if (/(spese|costi|oneri)\s+(?:di|per)\s+(?:la\s+)?regolarizzazione/i.test(testo)) return "sanabile";
  return "non_verificata";
}

/**
 * Stato di occupazione dal giudizio dell'esperto. Le negazioni prima ("senza
 * titolo", "non risultano contratti", "non occupato"); "liberazione" non e'
 * "libero"; se la frase dice sia occupato sia libero (l'appartamento si', il
 * box no) non si decide.
 */
function statoOccupativo(testo: string): string | null {
  const blocco = /Stato occupativo\s*\n\s*([^\n]{5,200}(?:\n[^\n]{0,200})?)/i.exec(testo)?.[1];
  const sopralluogo =
    /(?:Alla data del|Al momento del) sopralluogo[^.\n]{0,60}?\s+risulta(?:no|va|vano)?\s+([^.\n]{3,160})/i.exec(testo)?.[1];
  const frase = blocco ?? sopralluogo;
  if (!frase) return null;
  const f = frase.toLowerCase().replace(/\s+/g, " ");
  const libero = /\bliber[oiae]\b/.test(f) && !/\bnon\s+liber/.test(f);
  const nonOccupato = /\bnon\s+(?:risulta\s+)?occupat/.test(f);
  const occupato = !nonOccupato && /\boccupat|\babitat|\bin uso\b|\butilizzat/.test(f);
  if (nonOccupato) return occupato ? null : "Libero (perizia)";
  if (occupato && libero) {
    // "libero ai fini della procedura": l'occupante e' il debitore, che deve lasciare
    return /liber[oiae]\s+(?:ai fini|per la procedura)/.test(f) ? "Libero ai fini della procedura (perizia)" : null;
  }
  if (occupato) {
    const senzaTitolo = /senza titolo|non (?:risulta|risultano|sussistono|vi sono)[^.]{0,40}contratt|nessun contratto/.test(f);
    if (!senzaTitolo && /\bcontratto di locazione|\bconduttore|\bin locazione|\baffitt/.test(f)) return "Occupato con contratto (perizia)";
    return "Occupato (perizia)";
  }
  if (libero) return "Libero (perizia)";
  return null;
}

export function leggiPerizia(pagine: string[], numeroLotto?: string | null): EsitoPerizia {
  if (!testoLeggibile(pagine)) return { leggibile: false, ...VUOTO };
  const testo = pagine.join("\n");
  const piuLotti = lottiNominati(testo).size >= 2;
  const lotto = normalizzaLotto(numeroLotto);
  const s = superficie(testo, piuLotti);
  const mq = s.mq && s.mq >= 15 ? s.mq : null;
  return {
    leggibile: true,
    // sotto i 15 mq non e' la superficie di un lotto, e' una riga letta male
    mq,
    fonteMq: mq ? s.fonteMq : null,
    valoreGiudiziario: valoreGiudiziario(testo, piuLotti, lotto),
    valoreMercato: valoreMercato(testo, piuLotti, lotto),
    conformita: conformita(testo),
    statoOccupativo: statoOccupativo(testo),
    piuLotti,
  };
}

export interface AllegatoPvp {
  nomeFile?: string | null;
  linkAllegato?: string | null;
  codiceTipoAllegato?: string | null;
  dimensioneAllegato?: number | null;
}

function nomeAllegato(a: AllegatoPvp): string {
  const grezzo = (a.nomeFile ?? a.linkAllegato ?? "").split("/").pop()!.split("?")[0]!;
  try {
    return decodeURIComponent(grezzo);
  } catch {
    // "Perizia ribasso 25%.pdf": non e' una codifica, e' il nome
    return grezzo;
  }
}

/**
 * La perizia fra gli allegati di un annuncio. Sotto lo stesso codice PERIZ i
 * delegati caricano anche visure, planimetrie, foto e relazioni notarili.
 * Vince il file che si chiama perizia, stima, relazione di stima, CTU o
 * elaborato peritale; fra piu' perizie, quella che nomina il lotto
 * dell'annuncio; poi la piu' grande. Una perizia che nomina un altro lotto non
 * si prende.
 */
export function scegliPerizia(allegati: AllegatoPvp[], numeroLotto?: string | null): AllegatoPvp | null {
  const candidati = allegati.filter(
    (a) => a.linkAllegato && /^(PERIZ|STIMA)$/i.test(a.codiceTipoAllegato ?? "") && /\.pdf$/i.test(nomeAllegato(a)),
  );
  const principale = /perizi|periza|perit|\bstima\b|\bctu\b|relazione di stima/i;
  const accessorio = /allegat|visura|mappa|planimetr|foto|catast|elaborato planimetrico|integrazion|ipotecar|notari|ventennal/i;
  // "Allegato A perizia.pdf" e "Perizia con allegati.pdf" sono perizie; "Integrazione perizia" no
  const eAccessorio = (n: string) => /integrazion|notari|ventennal/i.test(n) || (accessorio.test(n) && !/perizi|periza|perit|stima/i.test(n));
  const lotto = normalizzaLotto(numeroLotto);
  const lottoNelNome = (n: string) => /\blotto\s*(?:n\.?\s*|n°\s*)?(\d{1,2}|[A-H])\b/i.exec(n)?.[1]?.toUpperCase() ?? null;
  const ammessi = candidati.filter((a) => {
    const l = lottoNelNome(nomeAllegato(a));
    return !l || !lotto || l === lotto;
  });
  const ordina = (xs: AllegatoPvp[]) =>
    [...xs].sort(
      (a, b) =>
        Number(lottoNelNome(nomeAllegato(b)) === lotto && lotto != null) - Number(lottoNelNome(nomeAllegato(a)) === lotto && lotto != null) ||
        (b.dimensioneAllegato ?? 0) - (a.dimensioneAllegato ?? 0),
    );
  const perNome = ammessi.filter((a) => principale.test(nomeAllegato(a)) && !eAccessorio(nomeAllegato(a)));
  return ordina(perNome)[0] ?? ordina(ammessi.filter((a) => !accessorio.test(nomeAllegato(a))))[0] ?? null;
}

/** Tesseract e pdftoppm installati? Senza, le scansioni restano illeggibili e lo si dice. */
let ocrPresente: boolean | null = null;
export async function ocrDisponibile(): Promise<boolean> {
  if (ocrPresente !== null) return ocrPresente;
  const { execFile } = await import("node:child_process");
  const prova = (cmd: string, args: string[]) =>
    new Promise<boolean>((r) => execFile(cmd, args, { timeout: 10_000 }, (err) => r(!err)));
  ocrPresente = (await prova("tesseract", ["--version"])) && (await prova("pdftoppm", ["-v"]));
  return ocrPresente;
}

/**
 * Testo di un PDF scansionato: pagine rese a 200 dpi in scala di grigi e lette
 * con Tesseract in italiano. Lento (un paio di secondi a pagina): si leggono
 * solo le prime `pagineMassime`, dove le perizie mettono riepilogo, superfici e
 * stima, entro un tempo massimo complessivo.
 */
export async function ocrPdf(dati: Uint8Array, pagineMassime = 30, tempoMassimoMs = 10 * 60_000): Promise<string[]> {
  const { execFile } = await import("node:child_process");
  const { mkdtemp, writeFile, readdir, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const esegui = (cmd: string, args: string[], timeout: number) =>
    new Promise<string>((ok, ko) =>
      execFile(cmd, args, { timeout, maxBuffer: 20 * 1024 * 1024 }, (err, out) => (err ? ko(err) : ok(out))),
    );
  const scadenza = Date.now() + tempoMassimoMs;
  const cartella = await mkdtemp(join(tmpdir(), "qdr-ocr-"));
  try {
    const pdf = join(cartella, "doc.pdf");
    await writeFile(pdf, dati);
    await esegui("pdftoppm", ["-r", "200", "-gray", "-png", "-l", String(pagineMassime), pdf, join(cartella, "p")], 300_000);
    const immagini = (await readdir(cartella))
      .filter((f) => f.endsWith(".png"))
      .sort((a, b) => Number(/(\d+)\.png$/.exec(a)?.[1]) - Number(/(\d+)\.png$/.exec(b)?.[1]));
    const pagine: string[] = [];
    for (const img of immagini) {
      if (Date.now() > scadenza) break;
      pagine.push(await esegui("tesseract", [join(cartella, img), "-", "-l", "ita", "--psm", "6"], 120_000));
    }
    return pagine;
  } finally {
    await rm(cartella, { recursive: true, force: true });
  }
}
