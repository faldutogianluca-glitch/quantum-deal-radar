import { eseguiEnrich } from "./enrich.js";
import { eseguiPipeline } from "./pipeline.js";

export interface OpzioniScheduler {
  /** Intervallo fra due esecuzioni, in minuti. */
  intervalloMinuti: number;
  /** Esegue anche l'arricchimento OMI dopo ogni scraping. */
  conEnrich?: boolean;
  /** Esegue subito un primo ciclo invece di attendere il primo intervallo. */
  subito?: boolean;
}

export interface Scheduler {
  ferma: () => void;
  /** Risolve quando il ciclo eventualmente in corso e' terminato. */
  attendiCicloCorrente: () => Promise<void>;
}

/**
 * Esecuzione periodica di scrape (+ enrich). Nessuna dipendenza esterna: un
 * timer basta, e il costo di una libreria cron non e' giustificato finche'
 * non servono espressioni di pianificazione.
 *
 * Due proprieta' che contano piu' della precisione dell'intervallo:
 *  - i cicli non si sovrappongono: se uno scraping dura piu' dell'intervallo,
 *    il successivo viene saltato invece di partire in parallelo sullo stesso DB;
 *  - un ciclo che fallisce viene registrato e non interrompe la pianificazione.
 */
export function avviaScheduler(opz: OpzioniScheduler): Scheduler {
  const intervalloMs = Math.max(1, opz.intervalloMinuti) * 60_000;
  let inCorso: Promise<void> | null = null;

  async function ciclo(): Promise<void> {
    const inizio = new Date().toISOString();
    try {
      const esito = await eseguiPipeline();
      const parti = esito.perFonte.map((f) => `${f.fonte}: ${f.trovati}`).join(", ");
      console.log(
        `[${inizio}] scraping completato (${parti || "nessuna fonte abilitata"}) -> ` +
          `${esito.nuovi} nuovi, ${esito.aggiornati} aggiornati` +
          (esito.assorbiti ? `, ${esito.assorbiti} duplicati fusi` : ""),
      );
      for (const f of esito.perFonte) {
        for (const e of f.errori) console.warn(`[${inizio}]   ! ${f.fonte}: ${e}`);
      }

      if (opz.conEnrich) {
        const arr = await eseguiEnrich();
        console.log(
          arr.eseguito
            ? `[${inizio}] arricchimento: ${arr.immobiliGeocodificati} zone risolte`
            : `[${inizio}] arricchimento saltato: ${arr.motivo}`,
        );
      }
    } catch (err) {
      // un ciclo fallito non deve fermare quelli successivi
      console.error(`[${inizio}] ciclo fallito:`, (err as Error).message);
    }
  }

  function lancia(): void {
    if (inCorso) {
      console.warn("scheduler: ciclo precedente ancora in corso, questo giro viene saltato");
      return;
    }
    inCorso = ciclo().finally(() => {
      inCorso = null;
    });
  }

  const timer = setInterval(lancia, intervalloMs);
  // il timer non deve tenere vivo il processo da solo
  timer.unref?.();

  console.log(
    `scheduler avviato: ogni ${opz.intervalloMinuti} min` + (opz.conEnrich ? " (con arricchimento)" : ""),
  );
  if (opz.subito) lancia();

  return {
    ferma: () => clearInterval(timer),
    attendiCicloCorrente: async () => {
      if (inCorso) await inCorso;
    },
  };
}
