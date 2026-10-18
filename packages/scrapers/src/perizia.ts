import type { Conformita } from "@qdr/core";

/**
 * Lettura della perizia di stima allegata a un annuncio giudiziario.
 *
 * La superficie, il valore di mercato stimato dall'esperto, la conformita'
 * edilizia e lo stato di occupazione stanno quasi sempre solo li': il PVP non
 * li riporta nei suoi campi e il delegato li scrive nella descrizione solo a
 * volte. Senza superficie il Gate 0 non si calcola.
 *
 * Le perizie non hanno una struttura comune, ma la maggior parte segue due
 * modelli: quello del Tribunale di Milano (indice sintetico, tabella delle
 * superfici con "mq. lordi mq. commerciali") e quello del software di stima
 * molto usato a Monza ("Consistenza commerciale complessiva unita' principali").
 * Si leggono solo le formule riconosciute: dove nessuna corrisponde il campo
 * resta vuoto. Un numero preso dalla riga sbagliata di una perizia di 40
 * pagine e' peggio di nessun numero.
 *
 * Del testo non si salva nulla: contiene nomi, codici fiscali e indirizzi di
 * debitori, esperti e occupanti. Restano solo i numeri estratti.
 */

export interface EsitoPerizia {
  /** Falso per le scansioni senza testo e i PDF con font senza mappatura: servirebbe l'OCR. */
  leggibile: boolean;
  mq: number | null;
  /** Da quale formula viene la superficie: serve a chi controlla. */
  fonteMq: "consistenza_commerciale" | "tabella_commerciale" | "superficie_commerciale" | "catastale" | null;
  /** Valore di mercato stimato dall'esperto, prima delle decurtazioni per la vendita giudiziaria. */
  valoreMercato: number | null;
  conformita: Conformita | null;
  statoOccupativo: string | null;
}

/** "1.424,00" -> 1424, "58,7" -> 58.7, "132.075,00" -> 132075 */
function importo(s: string | undefined): number | null {
  if (!s) return null;
  let t = s.trim().replace(/[.,]+$/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "");
  t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const NUMERO = String.raw`(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)`;

/**
 * Un PDF con testo vero contiene parole italiane comuni a centinaia. Una
 * scansione non ne ha, un font senza mappatura produce simboli.
 */
export function testoLeggibile(testo: string): boolean {
  const parole = testo.match(/\b(il|la|di|del|della|che|per|con|immobile|stima|valore)\b/gi)?.length ?? 0;
  return parole >= 40;
}

function superficie(testo: string): Pick<EsitoPerizia, "mq" | "fonteMq"> {
  // modello del software di stima: il totale del lotto, gia' omogeneizzato
  const consistenza = new RegExp(String.raw`Consistenza commerciale complessiva unit[aà'] principali:\s*${NUMERO}\s*(?:m²|m2|mq)`, "i").exec(testo);
  if (consistenza) return { mq: importo(consistenza[1]), fonteMq: "consistenza_commerciale" };

  // modello di Milano: riga dei totali sopra "mq. lordi mq. commerciali"
  const tabella = new RegExp(String.raw`${NUMERO}\s+${NUMERO}\s*\n?\s*mq\.?\s*lord[ie]\s+mq\.?\s*commercial[ie]`, "i").exec(testo);
  if (tabella) return { mq: importo(tabella[2]), fonteMq: "tabella_commerciale" };

  // "superficie commerciale complessiva di 85,40 mq", "Superficie commerciale dell'appartamento = mq.58,00":
  // l'unita' deve esserci, prima o dopo il numero
  const unita = String.raw`(?:m²|m2|m\?|mq)`;
  const commerciale = new RegExp(
    String.raw`superficie\s+(?:lorda\s+)?commerciale\s*(?:complessiva|totale|omogeneizzata|dell'appartamento|dell'unit[aà'] immobiliare)?[^\d\n]{0,25}?` +
      String.raw`(?:${unita}\.?\s*${NUMERO}|${NUMERO}\s*${unita})`,
    "i",
  ).exec(testo);
  if (commerciale) return { mq: importo(commerciale[1] ?? commerciale[2]), fonteMq: "superficie_commerciale" };

  // ultima risorsa: la superficie catastale, che comprende balconi e accessori
  const catastale = new RegExp(
    String.raw`Superficie\s+Catastale\s+Totale\s*:?\s*(?:${unita}\.?\s*${NUMERO}|${NUMERO}\s*${unita})`,
    "i",
  ).exec(testo);
  if (catastale) return { mq: importo(catastale[1] ?? catastale[2]), fonteMq: "catastale" };

  return { mq: null, fonteMq: null };
}

function valoreMercato(testo: string): number | null {
  const formule = [
    // software di stima
    String.raw`Valore di Mercato dell'immobile nello stato di fatto e di diritto in cui si trova:\s*€\.?\s*${NUMERO}`,
    // Milano: il valore del lotto prima delle decurtazioni
    String.raw`Valore\s+LOTTO\s+(?:UNICO|N?\.?\s*\d+|[A-Z])\s*(?:€|Euro)\s*${NUMERO}`,
    String.raw`Complessivamente\W+LOTTO\s+(?:UNICO|N?\.?\s*\d+|[A-Z])\s*(?:€|Euro)\s*${NUMERO}`,
    String.raw`Valore\s+Totale\s*[=:]?\s*(?:€|Euro)\s*${NUMERO}`,
  ];
  for (const f of formule) {
    const m = new RegExp(f, "i").exec(testo);
    if (m) return importo(m[1]);
  }
  return null;
}

/**
 * Conformita' edilizia e urbanistica dai giudizi dell'esperto. La catastale non
 * conta qui: si sistema con una variazione, non con una sanatoria.
 */
function conformita(testo: string): Conformita | null {
  const giudizi = [
    ...testo.matchAll(
      /conformit[aà']\s+(edilizia|urbanistica|urbanistico-edilizia)\s*:?\s*\n?\s*(non conforme|no\b|s[iì]\s+parziale|s[iì]\b|conforme|nessuna difformit)/gi,
    ),
  ].map((m) => m[2]!.toLowerCase());
  if (giudizi.length === 0) return null;
  const nonConforme = giudizi.some((g) => g.startsWith("non") || g === "no" || g.includes("parziale"));
  if (!nonConforme) return "conforme";
  if (/\b(non\s+sanabil|insanabil)/i.test(testo)) return "insanabile";
  // l'esperto ha quantificato la regolarizzazione: e' sanabile, a quel costo
  if (/(spese|costi|oneri)\s+(?:di|per)\s+(?:la\s+)?regolarizzazione|\bsanabil|\bregolarizzabil/i.test(testo)) return "sanabile";
  return "non_verificata";
}

function statoOccupativo(testo: string): string | null {
  const frase =
    /Stato occupativo\s*\n\s*([^\n]{5,200})/i.exec(testo)?.[1] ??
    /(?:Alla data del|Al momento del) sopralluogo[^.\n]{0,60}?\s+risulta(?:no|va|vano)?\s+([^.\n]{3,120})/i.exec(testo)?.[1] ??
    null;
  if (!frase) return null;
  const f = frase.toLowerCase();
  if (/locazion|contratto|conduttore|affitt/.test(f)) return "Occupato con contratto (perizia)";
  if (/liber/.test(f) && !/non\s+liber/.test(f)) return "Libero (perizia)";
  if (/occupat|abitat|in uso/.test(f)) return "Occupato (perizia)";
  return null;
}

export function leggiPerizia(pagine: string[]): EsitoPerizia {
  const testo = pagine.join("\n");
  if (!testoLeggibile(testo)) {
    return { leggibile: false, mq: null, fonteMq: null, valoreMercato: null, conformita: null, statoOccupativo: null };
  }
  const s = superficie(testo);
  return {
    leggibile: true,
    // sotto i 15 mq non e' la superficie di un lotto, e' una riga letta male
    mq: s.mq && s.mq >= 15 ? s.mq : null,
    fonteMq: s.mq && s.mq >= 15 ? s.fonteMq : null,
    valoreMercato: valoreMercato(testo),
    conformita: conformita(testo),
    statoOccupativo: statoOccupativo(testo),
  };
}

export interface AllegatoPvp {
  nomeFile?: string | null;
  linkAllegato?: string | null;
  codiceTipoAllegato?: string | null;
  dimensioneAllegato?: number | null;
}

/**
 * La perizia fra gli allegati di un annuncio. Sotto lo stesso codice PERIZ i
 * delegati caricano anche visure, planimetrie e foto: vince il file che si
 * chiama perizia, stima o relazione, poi il piu' grande fra gli altri.
 */
export function scegliPerizia(allegati: AllegatoPvp[]): AllegatoPvp | null {
  const nome = (a: AllegatoPvp) => decodeURIComponent((a.nomeFile ?? a.linkAllegato ?? "").split("/").pop()!.split("?")[0]!);
  const candidati = allegati.filter(
    (a) => a.linkAllegato && /^(PERIZ|STIMA)$/i.test(a.codiceTipoAllegato ?? "") && /\.pdf$/i.test(nome(a)),
  );
  const accessorio = /allegat|visura|mappa|planimetr|foto|catast|elaborat|integrazion|ipotecar/i;
  const perNome = candidati.filter((a) => /perizi|periza|stima|relazione/i.test(nome(a)) && !accessorio.test(nome(a)));
  const ordina = (xs: AllegatoPvp[]) => [...xs].sort((a, b) => (b.dimensioneAllegato ?? 0) - (a.dimensioneAllegato ?? 0));
  return ordina(perNome)[0] ?? ordina(candidati.filter((a) => !accessorio.test(nome(a))))[0] ?? null;
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
 * stima.
 */
export async function ocrPdf(dati: Uint8Array, pagineMassime = 30): Promise<string[]> {
  const { execFile } = await import("node:child_process");
  const { mkdtemp, writeFile, readdir, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const esegui = (cmd: string, args: string[], timeout: number) =>
    new Promise<string>((ok, ko) =>
      execFile(cmd, args, { timeout, maxBuffer: 20 * 1024 * 1024 }, (err, out) => (err ? ko(err) : ok(out))),
    );
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
      pagine.push(await esegui("tesseract", [join(cartella, img), "-", "-l", "ita", "--psm", "6"], 120_000));
    }
    return pagine;
  } finally {
    await rm(cartella, { recursive: true, force: true });
  }
}
