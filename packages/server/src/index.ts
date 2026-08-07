import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import type { NextFunction, Request, Response } from "express";

import { api } from "./api.js";
import { avviaScheduler } from "./scheduler.js";
import "./db.js"; // assicura che lo schema sia creato prima di servire richieste

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

export function creaApp() {
  const app = express();
  app.use(express.json());
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

export function avviaServer(porta = 3000) {
  const app = creaApp();
  const server = app.listen(porta, () => {
    console.log(`Quantum Deal Radar in ascolto su http://localhost:${porta}`);
  });

  // Lo scheduler resta spento se non richiesto esplicitamente: un server che
  // inizia a scaricare da solo appena avviato e' una sorpresa sgradita.
  const minuti = Number(process.env.QDR_INTERVALLO_MINUTI);
  if (Number.isFinite(minuti) && minuti > 0) {
    avviaScheduler({ intervalloMinuti: minuti, conEnrich: process.env.QDR_WATCH_ENRICH === "true" });
  }

  return server;
}
