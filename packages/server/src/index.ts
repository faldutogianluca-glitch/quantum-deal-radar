import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import type { NextFunction, Request, Response } from "express";

import { autenticazione, controlloOrigine, intestazioniSicurezza, LimiteFallimenti, leggiConfigAccesso } from "./accesso.js";
import type { ConfigAccesso } from "./accesso.js";
import { api, impostaCooldown } from "./api.js";
import { avviaScheduler } from "./scheduler.js";
import "./db.js"; // assicura che lo schema sia creato prima di servire richieste

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

export function creaApp(config: ConfigAccesso = leggiConfigAccesso()) {
  const app = express();
  app.disable("x-powered-by");
  impostaCooldown(config.cooldownOperazioniSecondi);
  const limite = new LimiteFallimenti(config.maxFallimenti, config.finestraFallimentiSecondi * 1000);

  app.use(intestazioniSicurezza);
  app.use(controlloOrigine(config));
  app.use(autenticazione(config, limite));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", api);
  app.use(express.static(PUBLIC_DIR));

  // Il gestore di default di Express rimanda al client lo stack trace completo,
  // che espone percorsi e struttura interna. Qui l'errore resta nei log del server.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("errore non gestito:", err);
    res.status(500).json({ errore: "Errore interno del server" });
  });

  return app;
}

export function avviaServer(porta = 3000, config: ConfigAccesso = leggiConfigAccesso()) {
  const app = creaApp(config);
  // Ascolto esplicito sull'interfaccia configurata: senza indirizzo, Node ascolta su tutte.
  const server = app.listen(porta, config.host, () => {
    console.log(
      config.remoto
        ? `Quantum Deal Radar in ascolto su ${config.host}:${porta} con autenticazione. ` +
            "Il traffico deve passare da un proxy con TLS: il server non cifra."
        : `Quantum Deal Radar in ascolto su http://${config.host}:${porta} (solo questo computer)` +
            (config.token ? ", con autenticazione." : ", senza autenticazione."),
    );
  });

  // Lo scheduler resta spento se non richiesto esplicitamente: un server che
  // inizia a scaricare da solo appena avviato e' una sorpresa sgradita.
  const minuti = Number(process.env.QDR_INTERVALLO_MINUTI);
  if (Number.isFinite(minuti) && minuti > 0) {
    avviaScheduler({ intervalloMinuti: minuti, conEnrich: process.env.QDR_WATCH_ENRICH === "true" });
  }

  return server;
}
