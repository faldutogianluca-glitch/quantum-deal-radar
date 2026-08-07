import { Router } from "express";

import { loadSiteConfigs } from "@qdr/scrapers";

import { eseguiEnrich } from "./enrich.js";
import { eseguiPipeline, FonteSconosciuta } from "./pipeline.js";
import { getImmobile, listImmobili } from "./repository.js";

export const api = Router();

/** Un parametro non numerico (?limit=abc) diventava NaN e finiva nel binding SQL,
 *  facendo fallire la query con un 500. Qui un valore non valido viene trattato
 *  come "filtro non specificato", che e' l'interpretazione utile lato utente. */
function numeroOpzionale(v: unknown): number | undefined {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function testoOpzionale(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

api.get("/immobili", (req, res) => {
  const { fonte, comune, prezzoMin, prezzoMax, soloPraticabili, limit } = req.query;
  const righe = listImmobili({
    fonte: testoOpzionale(fonte),
    comune: testoOpzionale(comune),
    prezzoMin: numeroOpzionale(prezzoMin),
    prezzoMax: numeroOpzionale(prezzoMax),
    soloPraticabili: soloPraticabili === "true",
    limit: numeroOpzionale(limit),
  });
  res.json(righe);
});

api.get("/immobili/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ errore: "id non valido" });
    return;
  }
  const riga = getImmobile(id);
  if (!riga) {
    res.status(404).json({ errore: "non trovato" });
    return;
  }
  res.json(riga);
});

api.get("/fonti", async (_req, res) => {
  const configs = await loadSiteConfigs();
  res.json(configs.map((c) => ({ name: c.name, displayName: c.displayName, enabled: c.enabled })));
});

api.post("/scrape", async (req, res) => {
  const fonte = testoOpzionale(req.query.fonte);
  try {
    const esito = await eseguiPipeline(fonte);
    res.json(esito);
  } catch (err) {
    // una fonte inesistente e' un errore del chiamante, non del server
    const stato = err instanceof FonteSconosciuta ? 400 : 500;
    res.status(stato).json({ errore: (err as Error).message });
  }
});

api.post("/enrich", async (_req, res) => {
  try {
    const esito = await eseguiEnrich();
    res.json(esito);
  } catch (err) {
    res.status(500).json({ errore: (err as Error).message });
  }
});
