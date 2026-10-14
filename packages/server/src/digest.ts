import type { ImmobileRow, Novita, Ribasso } from "./repository.js";
import { MAX_CARATTERI } from "./whatsapp.js";

/*
 * Il digest dei movimenti, nella forma che serve a un messaggio.
 *
 * Diverso dalla stampa a terminale, e non per gusto: un messaggio si legge
 * sul telefono, ha un tetto di 4096 caratteri e arriva mentre si sta facendo
 * altro. Quindi i ribassi per primi e per intero, i nuovi in forma breve, i
 * rincari ridotti a un conteggio. Un rincaro a terminale e' un'informazione
 * utile; dentro una notifica e' rumore che allontana dalla prima riga quello
 * su cui bisogna muoversi oggi.
 *
 * Tutto qui dentro e' puro: nessuna rete, nessun database. E' la parte che
 * conviene poter provare senza mandare messaggi veri.
 */

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const pct = (q: number) => `${Math.round(Math.abs(q) * 100)}%`;

/**
 * Identita' di un ribasso gia' segnalato.
 *
 * Include il momento della rilevazione, non solo l'immobile: se lo stesso
 * immobile cala una seconda volta e' una notizia nuova e va rimandata. Senza
 * la data, il secondo ribasso resterebbe invisibile proprio perche' il primo
 * era gia' stato visto.
 */
export function chiaveRibasso(r: Ribasso): string {
  return `ribasso:${r.immobile.id}:${r.quando}`;
}

/** Un immobile entra in radar una volta sola: la chiave non ha bisogno di data. */
export function chiaveNuovo(i: ImmobileRow): string {
  return `nuovo:${i.id}`;
}

export function chiaveRincaro(r: Ribasso): string {
  return `rincaro:${r.immobile.id}:${r.quando}`;
}

/** Tutte le chiavi contenute in un digest, nell'ordine in cui compaiono. */
export function chiaviDi(n: Novita): string[] {
  return [
    ...n.ribassati.map(chiaveRibasso),
    ...n.nuovi.map(chiaveNuovo),
    ...n.rincarati.map(chiaveRincaro),
  ];
}

/** Toglie da un digest cio' che e' gia' stato notificato. */
export function filtraNovita(n: Novita, giaVisti: ReadonlySet<string>): Novita {
  return {
    giorni: n.giorni,
    ribassati: n.ribassati.filter((r) => !giaVisti.has(chiaveRibasso(r))),
    nuovi: n.nuovi.filter((i) => !giaVisti.has(chiaveNuovo(i))),
    rincarati: n.rincarati.filter((r) => !giaVisti.has(chiaveRincaro(r))),
  };
}

export function vuoto(n: Novita): boolean {
  return n.ribassati.length === 0 && n.nuovi.length === 0 && n.rincarati.length === 0;
}

function descrivi(i: ImmobileRow, max: number): string {
  const testo = [i.comune, i.titolo].filter(Boolean).join(" - ") || i.fonte;
  return testo.length > max ? testo.slice(0, max - 1) + "…" : testo;
}

function bloccoRibasso(r: Ribasso): string {
  const righe = [
    `*-${pct(r.calo)}*  ${euro.format(r.prezzoPrima)} → ${euro.format(r.prezzoDopo)}`,
    descrivi(r.immobile, 70),
  ];
  if (r.immobile.url) righe.push(r.immobile.url);
  return righe.join("\n");
}

function bloccoNuovo(i: ImmobileRow): string {
  const prezzo = i.prezzo != null ? euro.format(i.prezzo) : "prezzo non pubblicato";
  return `${prezzo} · ${descrivi(i, 60)}`;
}

/**
 * Compone il messaggio, rispettando il tetto di caratteri.
 *
 * Il taglio avviene fra un blocco e l'altro, mai dentro: mezzo annuncio con
 * un link troncato e' peggio di un annuncio in meno. Cio' che non entra viene
 * contato in chiusura, cosi' chi legge sa che la dashboard ha altro da
 * mostrare invece di credere che quello sia tutto.
 */
export function componiMessaggio(n: Novita, limite = MAX_CARATTERI): string {
  if (vuoto(n)) return `Quantum Deal Radar: nessun movimento negli ultimi ${n.giorni} giorni.`;

  const intestazione = `*Quantum Deal Radar* \u00b7 ultimi ${n.giorni} giorni`;
  // si riserva spazio per la riga di coda prima di cominciare a riempire,
  // altrimenti l'avviso su cio' che manca sarebbe la prima cosa a non entrare
  const CODA_RISERVATA = 60;
  const tetto = limite - CODA_RISERVATA;

  const parti: string[] = [intestazione];
  let lunghezza = intestazione.length;
  let omessi = 0;

  /** Aggiunge un blocco se ci sta. Non conta nulla: il conteggio sta nei cicli. */
  const aggiungi = (blocco: string): boolean => {
    const costo = blocco.length + 2; // la riga vuota di separazione
    if (lunghezza + costo > tetto) return false;
    parti.push(blocco);
    lunghezza += costo;
    return true;
  };

  /** Una sezione entra solo se ci sta il titolo: un titolo senza voci sarebbe bugiardo. */
  const sezione = <T,>(voci: T[], titolo: string, rendi: (v: T) => string): void => {
    if (voci.length === 0) return;
    if (!aggiungi(titolo)) {
      omessi += voci.length;
      return;
    }
    let messi = 0;
    for (const v of voci) {
      if (!aggiungi(rendi(v))) break;
      messi++;
    }
    omessi += voci.length - messi;
  };

  sezione(n.ribassati, `\u25bc *RIBASSATI* (${n.ribassati.length})`, bloccoRibasso);
  sezione(n.nuovi, `\u25cf *NUOVI* (${n.nuovi.length})`, bloccoNuovo);

  // Un rincaro non richiede di muoversi: sapere che ce ne sono stati basta,
  // e il dettaglio resta a terminale e in dashboard.
  if (n.rincarati.length > 0) {
    aggiungi(`\u25b2 ${n.rincarati.length} rincarati (venditori che non hanno fretta)`);
  }

  if (omessi > 0) parti.push(`\u2026 e altri ${omessi}: apri la dashboard.`);

  return parti.join("\n\n");
}
