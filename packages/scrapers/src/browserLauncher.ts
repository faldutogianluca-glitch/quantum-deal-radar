/**
 * Avvio di Chromium con messaggi comprensibili.
 *
 * Playwright, quando manca il binario del browser, produce un errore che parla
 * di percorsi interni e build number: chi lo legge non capisce che gli basta un
 * comando. Qui i due modi di fallire — libreria assente, browser non scaricato —
 * diventano istruzioni esplicite.
 */

export interface BrowserAvviato {
  browser: import("playwright").Browser;
  chiudi: () => Promise<void>;
}

export async function avviaChromium(): Promise<BrowserAvviato> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Il motore browser richiede Playwright, che non risulta installato.\n" +
        "  Esegui:  npm install playwright && npx playwright install chromium",
    );
  }

  // Un ambiente che ha gia' un Chromium (immagini CI, container preconfigurati)
  // puo' indicarlo qui invece di farne scaricare un altro.
  const eseguibile = process.env.QDR_CHROMIUM_PATH;

  try {
    const browser = await chromium.launch(eseguibile ? { executablePath: eseguibile } : {});
    return { browser, chiudi: () => browser.close() };
  } catch (err) {
    const messaggio = (err as Error).message;
    // Playwright segnala l'assenza del binario con "Executable doesn't exist"
    if (/executable doesn't exist|please run.*playwright install/i.test(messaggio)) {
      throw new Error(
        "Chromium non e' stato ancora scaricato.\n" +
          "  Esegui:  npx playwright install chromium\n" +
          "  Oppure, se hai gia' un Chromium sul sistema, indicalo con la variabile\n" +
          "  d'ambiente QDR_CHROMIUM_PATH.\n" +
          `  (dettaglio originale: ${messaggio.split("\n")[0]})`,
      );
    }
    throw err;
  }
}
