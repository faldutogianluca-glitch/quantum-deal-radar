import { Router } from "express";
import type { NextFunction, Request, Response } from "express";

import { loadSiteConfigs } from "@qdr/scrapers";

import { eseguiEnrich } from "./enrich.js";
import { eseguiPipeline, FonteSconosciuta } from "./pipeline.js";
import { esclusivo, LavoroInCorso } from "./lavoro.js";
import { confermaCandidato, getImmobile, listCandidati, listImmobili, respingiCandidato, storicoPrezzi } from "./repository.js";

export const api = Router();

/** Secondi minimi fra due avvii della stessa operazione costosa. Si imposta da creaApp(). */
let cooldownSecondi = 30;
export function impostaCooldown(secondi: number): void {
  cooldownSecondi = secondi;
}
const ultimoAvvio = new Map<string, number>();

/** Limita le operazioni costose: un avvio alla volta e distanziati di almeno `cooldownSecondi`. */
function operazioneCostosa(nome: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const adesso = Date.now();
    const ultimo = ultimoAvvio.get(nome) ?? 0;
    const attesa = Math.ceil((ultimo + cooldownSecondi * 1000 - adesso) / 1000);
    if (cooldownSecondi > 0 && attesa > 0) {
      res.set("Retry-After", String(attesa)).status(429).json({ errore: `Operazione richiesta troppo di recente: riprova fra ${attesa} secondi` });
      return;
    }
    ultimoAvvio.set(nome, adesso);
    next();
  };
}

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
  const { fonte, comune, prezzoMin, prezzoMax, soloPraticabili, valutazione, soloRibassati, ordine, limit } = req.query;
  const ordinamento =
    ordine === "ribasso" || ordine === "anzianita" || ordine === "deserti" ? ordine : "recenti";
  const righe = listImmobili({
    fonte: testoOpzionale(fonte),
    comune: testoOpzionale(comune),
    prezzoMin: numeroOpzionale(prezzoMin),
    prezzoMax: numeroOpzionale(prezzoMax),
    soloPraticabili: soloPraticabili === "true",
    valutazione: valutazione === "positivo" || valutazione === "negativo" || valutazione === "non_valutato" ? valutazione : undefined,
    soloRibassati: soloRibassati === "true",
    ordine: ordinamento,
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
  // il dettaglio porta con se' la sequenza dei prezzi: e' li' che si legge
  // se e quando il venditore ha ceduto
  res.json({ ...riga, storicoPrezzi: storicoPrezzi(id) });
});

api.get("/fonti", async (_req, res) => {
  const configs = await loadSiteConfigs();
  res.json(configs.map((c) => ({ name: c.name, displayName: c.displayName, enabled: c.enabled })));
});

api.get("/candidati", (req, res) => {
  const stato = req.query.stato;
  res.json(listCandidati(stato === "confermato" || stato === "respinto" || stato === "tutti" ? stato : "aperto"));
});

/* La conferma fonde due righe: e' una decisione di una persona, non un automatismo. */
api.post("/candidati/:id/conferma", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ errore: "id non valido" }); return; }
  const sopravvissuta = confermaCandidato(id);
  if (sopravvissuta === null) { res.status(404).json({ errore: "candidato non trovato, gia' deciso o righe non piu' presenti" }); return; }
  res.json({ immobileId: sopravvissuta });
});

api.post("/candidati/:id/respingi", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ errore: "id non valido" }); return; }
  if (!respingiCandidato(id)) { res.status(404).json({ errore: "candidato non trovato o gia' deciso" }); return; }
  res.json({ ok: true });
});

api.post("/scrape", operazioneCostosa("scrape"), async (req, res) => {
  const fonte = testoOpzionale(req.query.fonte);
  try {
    const esito = await esclusivo("scraping", () => eseguiPipeline(fonte));
    res.json(esito);
  } catch (err) {
    if (err instanceof LavoroInCorso) {
      res.status(409).json({ errore: err.message });
      return;
    }
    // una fonte inesistente e' un errore del chiamante, non del server
    const stato = err instanceof FonteSconosciuta ? 400 : 500;
    res.status(stato).json({ errore: (err as Error).message });
  }
});

api.post("/enrich", operazioneCostosa("enrich"), async (_req, res) => {
  try {
    const esito = await esclusivo("arricchimento", () => eseguiEnrich());
    res.json(esito);
  } catch (err) {
    if (err instanceof LavoroInCorso) {
      res.status(409).json({ errore: err.message });
      return;
    }
    res.status(500).json({ errore: (err as Error).message });
  }
});
