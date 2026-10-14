import {
  chiaviDi,
  componiMessaggio,
  filtraNovita,
  vuoto,
} from "./digest.js";
import { giaNotificati, novita, segnaNotificati, type Novita } from "./repository.js";
import {
  configurazioneWhatsApp,
  inviaTemplate,
  inviaTesto,
  type ConfigWhatsApp,
} from "./whatsapp.js";

/** Nome del canale nel registro: ne arriveranno altri (email, Telegram). */
export const CANALE = "whatsapp";

/**
 * Testo del template da far approvare in WhatsApp Manager, se si vuole che
 * l'invio parta da solo fuori dalla finestra di 24 ore.
 *
 * Tre parametri, nessuno con a capo: Meta rifiuta i parametri che contengono
 * ritorni a capo, tabulazioni o quattro spazi di fila. E' il motivo per cui
 * in modalita' template non si manda il digest intero ma un riepilogo.
 */
export const TESTO_TEMPLATE_CONSIGLIATO =
  "Quantum Deal Radar: {{1}}. Movimento maggiore: {{2}}. {{3}}";

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** I tre parametri del template, garantiti su riga singola. */
export function parametriTemplate(n: Novita): string[] {
  const conteggi = [
    n.ribassati.length > 0 ? `${n.ribassati.length} ribassi` : null,
    n.nuovi.length > 0 ? `${n.nuovi.length} nuovi` : null,
  ].filter(Boolean);

  const migliore = n.ribassati[0];
  const dettaglio = migliore
    ? `-${Math.round(migliore.calo * 100)}% ${euro.format(migliore.prezzoPrima)} ` +
      `-> ${euro.format(migliore.prezzoDopo)} ${[migliore.immobile.comune, migliore.immobile.titolo]
        .filter(Boolean)
        .join(" - ")
        .slice(0, 60)}`
    : "nessun ribasso";

  return [
    conteggi.join(" e ") || "nessun movimento",
    dettaglio,
    "Dettaglio completo in dashboard.",
  ].map(ripulisci);
}

/**
 * Riduce un parametro a riga singola.
 *
 * Non e' cosmesi: con un a capo dentro, Meta respinge l'intero messaggio con
 * un errore che non nomina il parametro colpevole.
 */
export function ripulisci(testo: string): string {
  return testo.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
}

export interface OpzioniNotifica {
  giorni: number;
  /** Compone il messaggio e lo mostra, senza inviarlo e senza segnarlo. */
  prova?: boolean;
  /** Ignora il registro: rimanda anche cio' che era gia' stato notificato. */
  rinvia?: boolean;
  /** Iniettabile nei test, per non toccare la rete. */
  env?: NodeJS.ProcessEnv;
}

export interface EsitoNotifica {
  inviato: boolean;
  /** Il testo composto: c'e' anche quando l'invio non e' avvenuto. */
  messaggio: string;
  /** Quante voci nuove conteneva il digest dopo il filtro del registro. */
  voci: number;
  /** Perche' non e' partito, quando non e' un errore (niente di nuovo, prova). */
  motivo?: string;
  errore?: string;
  wamid?: string;
}

/**
 * Compone e invia il digest dei movimenti.
 *
 * L'ordine delle operazioni e' deliberato: si segna nel registro **dopo**
 * l'invio riuscito. Segnare prima significherebbe che un messaggio non
 * partito porta con se' il ribasso, che non verra' piu' ripresentato. Un
 * doppione si ignora; un ribasso mai arrivato no.
 */
export async function inviaDigest(opz: OpzioniNotifica): Promise<EsitoNotifica> {
  const completo = novita(opz.giorni);
  const daMandare = opz.rinvia ? completo : filtraNovita(completo, giaNotificati(chiaviDi(completo)));
  const chiavi = chiaviDi(daMandare);
  const messaggio = componiMessaggio(daMandare);
  const voci = chiavi.length;

  if (vuoto(daMandare)) {
    const motivo = vuoto(completo)
      ? `nessun movimento negli ultimi ${opz.giorni} giorni`
      : "tutti i movimenti della finestra erano gia' stati notificati";
    return { inviato: false, messaggio, voci: 0, motivo };
  }

  if (opz.prova) {
    return { inviato: false, messaggio, voci, motivo: "prova: nessun invio, nessuna registrazione" };
  }

  const cfg = configurazioneWhatsApp(opz.env);
  if (!cfg.ok) {
    return {
      inviato: false,
      messaggio,
      voci,
      errore: `${cfg.spiegazione}\nMancano: ${cfg.mancanti.join(", ")}`,
    };
  }

  const esito = await spedisci(cfg.config, daMandare, messaggio);
  if (!esito.inviato) return { inviato: false, messaggio, voci, errore: esito.errore };

  segnaNotificati(chiavi, CANALE);
  return { inviato: true, messaggio, voci, wamid: esito.wamid };
}

function spedisci(cfg: ConfigWhatsApp, n: Novita, messaggio: string) {
  return cfg.template ? inviaTemplate(cfg, parametriTemplate(n)) : inviaTesto(cfg, messaggio);
}
