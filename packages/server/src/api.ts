import { Router } from "express";

import { loadSiteConfigs } from "@qdr/scrapers";

import { eseguiEnrich } from "./enrich.js";
import { eseguiPipeline } from "./pipeline.js";
import { getImmobile, listImmobili } from "./repository.js";

export const api = Router();

api.get("/immobili", (req, res) => {
  const { fonte, comune, prezzoMin, prezzoMax, soloPraticabili, limit } = req.query;
  const righe = listImmobili({
    fonte: typeof fonte === "string" && fonte ? fonte : undefined,
    comune: typeof comune === "string" && comune ? comune : undefined,
    prezzoMin: prezzoMin ? Number(prezzoMin) : undefined,
    prezzoMax: prezzoMax ? Number(prezzoMax) : undefined,
    soloPraticabili: soloPraticabili === "true",
    limit: limit ? Number(limit) : undefined,
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
  const fonte = typeof req.query.fonte === "string" ? req.query.fonte : undefined;
  try {
    const esito = await eseguiPipeline(fonte);
    res.json(esito);
  } catch (err) {
    res.status(500).json({ errore: (err as Error).message });
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
