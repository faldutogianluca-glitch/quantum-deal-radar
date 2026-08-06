import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { api } from "./api.js";
import "./db.js"; // assicura che lo schema sia creato prima di servire richieste

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

export function creaApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", api);
  app.use(express.static(PUBLIC_DIR));
  return app;
}

export function avviaServer(porta = 3000) {
  const app = creaApp();
  return app.listen(porta, () => {
    console.log(`Quantum Deal Radar in ascolto su http://localhost:${porta}`);
  });
}
