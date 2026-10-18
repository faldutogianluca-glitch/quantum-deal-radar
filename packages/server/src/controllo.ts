import type { ImmobileRow } from "./repository.js";

/**
 * Controllo di qualita' dei dati in archivio: la parte "verifica" della regola di
 * lavoro in CLAUDE.md, resa un comando.
 *
 * Ogni controllo nasce da un difetto vero, trovato sui dati reali e non dai test:
 * superfici lette come zero, due box gemelli fusi in un falso ribasso, civici
 * declassati dal geocoding, valori di uscita comunali usati per la periferia.
 * Il codice corretto non basta: se lo stesso sintomo ricompare con una fonte
 * nuova, qui si vede prima che diventi una decisione sbagliata.
 */

export type Gravita = "grave" | "attenzione";

export interface Anomalia {
  codice: string;
  gravita: Gravita;
  descrizione: string;
  /** Quante righe la presentano. */
  n: number;
  /** Fino a cinque esempi, per andare a vedere. */
  esempi: string[];
}

export interface StoricoRiga {
  immobile_id: number;
  prezzo: number;
  rilevato_il: string;
}

const etichetta = (r: ImmobileRow): string =>
  `#${r.id} ${r.fonte} ${r.id_esterno} · ${(r.titolo ?? r.indirizzo_raw ?? "").slice(0, 60)}`;

/** A/1-A/9 e A/11, oppure categoria ignota: e' li' che la superficie deve esserci. */
const residenziale = (r: ImmobileRow): boolean => {
  const c = (r.sottotipo_asset ?? "").toUpperCase().replace(/[\s/]/g, "");
  const m = /^([A-F])(\d{1,2})$/.exec(c);
  return !m || (m[1] === "A" && m[2] !== "10");
};

export function controllaDati(righe: ImmobileRow[], storico: StoricoRiga[] = [], oggi = new Date()): Anomalia[] {
  const anomalie: Anomalia[] = [];
  const aggiungi = (codice: string, gravita: Gravita, descrizione: string, trovate: ImmobileRow[] | string[]) => {
    if (trovate.length === 0) return;
    const esempi = trovate.slice(0, 5).map((x) => (typeof x === "string" ? x : etichetta(x)));
    anomalie.push({ codice, gravita, descrizione, n: trovate.length, esempi });
  };
  const attive = righe.filter((r) => r.fonte !== "demo");

  aggiungi(
    "superficie_assente",
    "grave",
    "Residenziale senza superficie plausibile: il Gate 0 non si calcola. Controlla il selettore o parseSuperficie.",
    attive.filter((r) => residenziale(r) && r.qre_esito !== "fuori_perimetro" && !(r.mq && r.mq >= 15)),
  );
  aggiungi(
    "prezzo_assente",
    "attenzione",
    "Annuncio senza prezzo.",
    attive.filter((r) => r.prezzo == null),
  );

  // un comune con almeno una zona risolta e' coperto dai perimetri: le altre sue righe
  // senza zona sono un geocoding fallito, non un comune mancante
  const coperti = new Set(attive.filter((r) => r.livello_zona === "zona").map((r) => r.comune_cod ?? r.comune));
  aggiungi(
    "zona_non_risolta",
    "attenzione",
    "Comune coperto dai perimetri OMI ma zona non risolta: indirizzo non trovato o impreciso.",
    attive.filter((r) => r.livello_zona !== "zona" && coperti.has(r.comune_cod ?? r.comune)),
  );

  // Gate 0: un verdetto positivo deve poggiare su una zona o sui comparabili
  aggiungi(
    "verdetto_senza_zona",
    "grave",
    "Gate 0 positivo con valore di uscita OMI e zona non risolta: il valore comunale non descrive il lotto.",
    attive.filter(
      (r) => (r.qre_esito === "passa" || r.qre_esito === "al_limite") &&
        r.qre_valore_fonte !== "comparabili" && r.livello_zona !== "zona",
    ),
  );
  // un verdetto positivo su un bene che non e' un'abitazione: le quotazioni usate sono
  // residenziali. Nato da due negozi del PVP che passavano il Gate 0 (18/10/2026)
  aggiungi(
    "verdetto_non_residenziale",
    "grave",
    "Gate 0 positivo su un bene commerciale o senza abitazioni: il valore di uscita residenziale non lo descrive.",
    attive.filter(
      (r) => (r.qre_esito === "passa" || r.qre_esito === "al_limite" || r.qre_esito === "solo_poca_concorrenza") &&
        (/COMMERCIAL|NEGOZI|UFFICI|CAPANNON|LABORATORI|MAGAZZIN|DEPOSIT|GARAGE|AUTORIMESS/i.test(r.sottotipo_asset ?? "") ||
          /^\s*(negozio|ufficio|capannone|laboratorio|magazzino|box)\b/i.test(r.titolo ?? "")),
    ),
  );
  // valore di uscita lontanissimo dalla valutazione dell'immobile com'e': uno dei due e' sbagliato
  aggiungi(
    "uscita_incoerente",
    "attenzione",
    "Valore di uscita oltre il doppio, o sotto la meta', del valore attuale stimato: verifica la fonte del valore.",
    attive.filter((r) => {
      if (!r.qre_valore_mq || !r.valore_centrale || !r.mq) return false;
      const rapporto = (r.qre_valore_mq * r.mq) / r.valore_centrale;
      return rapporto > 2 || rapporto < 0.5;
    }),
  );

  // annunci gemelli: stessa fonte, stesso indirizzo, codici diversi. Possono essere
  // beni diversi (box allo stesso civico) o lo stesso bene ripubblicato
  const perIndirizzo = new Map<string, ImmobileRow[]>();
  for (const r of attive) {
    if (!r.indirizzo_raw || !r.comune) continue;
    const k = `${r.fonte}|${r.comune}|${r.indirizzo_raw.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
    perIndirizzo.set(k, [...(perIndirizzo.get(k) ?? []), r]);
  }
  const gemelli = [...perIndirizzo.values()].filter((g) => g.length > 1);
  aggiungi(
    "annunci_gemelli",
    "attenzione",
    "Stessa fonte e stesso indirizzo con codici diversi: beni distinti o bene ripubblicato. Restano righe separate; verificare.",
    gemelli.map((g) => `${g[0]!.fonte} ${g[0]!.comune} ${g[0]!.indirizzo_raw}: ${g.map((r) => `#${r.id} ${r.prezzo ?? "-"}`).join(", ")}`),
  );

  // ribasso di oltre il 40% in un colpo: raro davvero, frequente come errore di fusione
  const perImmobile = new Map<number, StoricoRiga[]>();
  for (const s of storico) perImmobile.set(s.immobile_id, [...(perImmobile.get(s.immobile_id) ?? []), s]);
  const sospetti: string[] = [];
  for (const [id, voci] of perImmobile) {
    voci.sort((a, b) => a.rilevato_il.localeCompare(b.rilevato_il));
    for (let i = 1; i < voci.length; i++) {
      const calo = 1 - voci[i]!.prezzo / voci[i - 1]!.prezzo;
      if (calo > 0.4) sospetti.push(`#${id}: ${voci[i - 1]!.prezzo} -> ${voci[i]!.prezzo} (${(calo * 100).toFixed(0)}%)`);
    }
  }
  aggiungi(
    "ribasso_sospetto",
    "grave",
    "Calo di prezzo oltre il 40% in un solo passaggio: verifica che non siano due annunci fusi.",
    sospetti,
  );

  // fonti ferme: nessun aggiornamento da piu' di 14 giorni su una fonte che ha righe
  const ultimaPerFonte = new Map<string, string>();
  for (const r of attive) {
    if ((ultimaPerFonte.get(r.fonte) ?? "") < r.scraped_at) ultimaPerFonte.set(r.fonte, r.scraped_at);
  }
  const soglia = new Date(oggi.getTime() - 14 * 86_400_000).toISOString();
  aggiungi(
    "fonte_ferma",
    "attenzione",
    "Fonte senza aggiornamenti da oltre 14 giorni: scraping fermo o selettori cambiati.",
    [...ultimaPerFonte].filter(([, ultima]) => ultima < soglia).map(([fonte, ultima]) => `${fonte}: ultimo dato ${ultima.slice(0, 10)}`),
  );

  return anomalie.sort((a, b) => (a.gravita === b.gravita ? b.n - a.n : a.gravita === "grave" ? -1 : 1));
}
