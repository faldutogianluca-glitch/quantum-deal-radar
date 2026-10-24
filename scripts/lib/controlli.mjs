/**
 * Controlli automatici sul calendario delle pubblicazioni.
 *
 * Verificano il TESTO e i CAMPI, non il significato: la revisione umana resta necessaria. Non sono
 * una verifica legale: applicano le regole interne del progetto (CLAUDE.md). Un testo che rimanda
 * a un altro documento non e' verificabile qui: finisce in "non_verificato", non in "ok".
 */
export const NOTA_AI = "Contenuto generato con AI sotto la supervisione di Gianluca Falduto.";
export const AMAZON = "https://www.amazon.it/dp/B0GW41L8J8";

const RE_NOME_ERRATO = /\bQuantum Re\b(?!\s+S\.r\.l)/;
const RE_SEGNAPOSTO = /\{\{[^}]*\}\}/;
const RE_RINVIO = /(^|\s)(vedi |\(vedi |didascalia dal testo|testo completo|testo programmato in metricool)/i;
// parole vietate nei contenuti pubblici; le frasi ammesse sono le formule di non-offerta e i termini giuridici
const VIETATE = [
  [/\binvest\w*/gi, "invito a investire o termine di investimento"],
  [/\brendiment\w*/gi, "rendimenti"],
  [/club\s*deal/gi, "club deal"],
  [/co-?investiment\w*/gi, "co-investimento"],
  [/\bBTP\b/g, "confronto con titoli di Stato"],
  [/\bgratis\b/gi, "'gratis'"],
  [/\bcapitale\b/gi, "capitale"],
];
const AMMESSE = [
  /sollecitazione all'investimento/gi,
  /offerta di strumenti finanziari/gi,
  /quota capitale/gi,
  /non costituisce (?:un'?\s*)?(?:offerta|consulenza)(?: di strumenti finanziari)?(?: ne'| né| e)?(?: sollecitazione)?(?: all'investimento)?/gi,
];

const tuttoIlTesto = (e) => `${e.testo ?? ""}\n${e.primo_commento ?? ""}`;
const reti = (e) => (Array.isArray(e.reti) ? e.reti : String(e.reti ?? e.rete ?? "").split(/[,+/ ]+/)).map((s) => s.trim().toLowerCase()).filter(Boolean);
const eRinvio = (t) => !t || RE_RINVIO.test(t.trim().slice(0, 120));

function rimuoviAmmesse(t) {
  let s = t;
  for (const re of AMMESSE) s = s.replace(re, " ");
  return s;
}

export function estraiLink(testo) {
  const out = [];
  for (const m of testo.matchAll(/https?:\/\/[^\s)>"']+/g)) {
    let url;
    try { url = new URL(m[0].replace(/[.,;]+$/, "")); } catch { continue; }
    if (url.hostname.replace(/^www\./, "") === "valutazione.quantumre.it") {
      out.push({ url: url.href, www: url.hostname.startsWith("www."), utm_source: url.searchParams.get("utm_source"), utm_medium: url.searchParams.get("utm_medium"), utm_campaign: url.searchParams.get("utm_campaign") });
    }
  }
  return out;
}

/** Controlla una voce. `oggi` serve a distinguere le voci future (errori) da quelle storiche (segnalazioni). */
export function controllaVoce(e, oggi) {
  const esiti = [];
  const add = (livello, regola, dettaglio) => esiti.push({ id: e.id, livello, regola, dettaglio });
  const data = e.quando ? new Date(e.quando) : null;
  const dataValida = data !== null && !Number.isNaN(data.getTime());
  // una data mancante o illeggibile in una voce programmata e' un errore, non uno "storico"
  const futura = dataValida ? data >= oggi : e.stato === "programmato";
  const attiva = e.stato === "programmato" && futura;
  const lv = attiva ? "errore" : "storico";
  const testo = e.testo ?? "";
  const tutto = tuttoIlTesto(e);
  const completo = !eRinvio(testo);

  if (e.stato === "programmato" && !dataValida) add("errore", "data", "voce programmata senza data leggibile");
  if (RE_NOME_ERRATO.test(tutto)) add(lv, "nome", 'scrive "Quantum Re" invece di "Quantum RE"');
  if (RE_SEGNAPOSTO.test(tutto) && e.stato === "programmato") add(lv, "segnaposto", "contiene segnaposto {{...}}: una bozza incompleta non e' pronta");
  if (completo) {
    if (!testo.includes(NOTA_AI)) add(lv, "nota_ai", "manca la nota AI esatta");
  } else if (e.stato === "programmato") {
    add("non_verificato", "testo_integrale", "il campo testo e' un rinvio: nota AI, nome e parole vietate non verificabili qui");
  }
  const pulito = rimuoviAmmesse(tutto);
  for (const [re, nome] of VIETATE) {
    const m = pulito.match(re);
    if (m) add(lv, "parole_vietate", `${nome}: "${m[0]}"`);
  }
  const libro = /La tua casa non entra nella tomba/i.test(tutto) || /^libro/.test(e.id ?? "");
  if (libro && completo) {
    if (!tutto.includes(AMAZON)) add(lv, "libro_amazon", "manca il link Amazon del libro");
    if (!/valutazione\.quantumre\.it/.test(tutto)) add(lv, "libro_valutazione", "manca la destinazione valutazione.quantumre.it");
  }
  const link = estraiLink(tutto);
  const r = reti(e);
  for (const l of link) {
    if (l.www) add(lv, "link_www", "usa www.valutazione.quantumre.it: il progetto vuole l'indirizzo senza www");
  }
  const cliccabili = estraiLink(e.primo_commento ?? "");
  for (const l of cliccabili) {
    if (!l.utm_source) add(lv, "utm_assente", "link cliccabile senza utm_source");
    else if (r.length && !r.includes(l.utm_source)) add(lv, "utm_rete", `utm_source=${l.utm_source} non corrisponde alle reti della voce (${r.join(", ")})`);
    else if (r.length > 1) add("attribuzione", "utm_condiviso", `un solo link (utm_source=${l.utm_source}) per ${r.length} reti: i contatti delle altre reti risultano attribuiti a ${l.utm_source}`);
  }
  if (e.stato === "programmato" && futura && (!e.approvato_da || !e.approvato_il)) {
    add("errore", "approvazione", "voce programmata senza approvato_da/approvato_il");
  }
  if (e.stato === "programmato" && !futura && (!e.approvato_da || !e.approvato_il)) {
    add("storico", "approvazione", "voce gia' passata senza approvazione documentata nel calendario");
  }
  return esiti;
}

/** Riconciliazione con una lettura di Metricool (una riga JSON per post: uuid, id, d, draft). */
export function riconcilia(voci, snapshot, dal) {
  const esiti = [];
  const perUuid = new Map(snapshot.map((p) => [String(p.uuid), p]));
  const inCal = new Set();
  for (const e of voci) {
    if (!e.metricool_uuid || new Date(e.quando) < dal) continue;
    inCal.add(String(e.metricool_uuid));
    const p = perUuid.get(String(e.metricool_uuid));
    if (!p) {
      esiti.push({ id: e.id, livello: "errore", regola: "metricool_assente", dettaglio: "voce di calendario senza post corrispondente in Metricool" });
      continue;
    }
    const attivaCal = e.stato === "programmato";
    if (attivaCal === Boolean(p.draft)) esiti.push({ id: e.id, livello: "errore", regola: "stato_diverso", dettaglio: `calendario: ${e.stato}; Metricool: ${p.draft ? "bozza" : "programmato"}` });
    const orarioCal = String(e.quando).slice(0, 16);
    if (p.d && String(p.d).slice(0, 16) !== orarioCal) esiti.push({ id: e.id, livello: "errore", regola: "orario_diverso", dettaglio: `calendario ${orarioCal}; Metricool ${String(p.d).slice(0, 16)} (Europe/Rome)` });
  }
  for (const p of snapshot) {
    if (!inCal.has(String(p.uuid))) esiti.push({ id: String(p.id), livello: p.draft ? "bozza_orfana" : "errore", regola: "calendario_assente", dettaglio: `post Metricool ${p.id} (${String(p.d).slice(0, 16)}, ${p.draft ? "bozza" : "programmato"}) senza voce nel calendario` });
  }
  return esiti;
}

export function riepilogo(esiti) {
  const per = {};
  for (const e of esiti) per[e.livello] = (per[e.livello] ?? 0) + 1;
  return per;
}

/**
 * Controlli sul testo REALE in Metricool (snapshot gia' sintetizzato: ai_note, quantum_re_errato,
 * parole_vietate, links, networks). E' la fonte di verita' per cio' che esce: il calendario locale
 * puo' essere una copia non aggiornata del testo.
 */
export function controllaSnapshot(snapshot) {
  const esiti = [];
  for (const p of snapshot) {
    const id = String(p.id);
    const lv = p.draft ? "bozza" : "errore";
    const add = (regola, dettaglio, livello = lv) => esiti.push({ id, livello, regola, dettaglio });
    if (!p.ai_note) add("nota_ai", "manca la nota AI esatta");
    if (p.quantum_re_errato > 0) add("nome", `"Quantum Re" scritto ${p.quantum_re_errato} volte`);
    if (p.titolo_tiktok && /Quantum Re\b(?!\s+S\.r\.l)/.test(p.titolo_tiktok)) add("nome", '"Quantum Re" nel titolo TikTok');
    for (const v of p.parole_vietate ?? []) add("parole_vietate", String(v));
    const reti = p.networks ?? [];
    const tracciati = (p.links ?? []).filter((l) => l.utm_source);
    for (const l of tracciati) {
      if (reti.length === 1 && l.utm_source !== reti[0]) add("utm_rete", `utm_source=${l.utm_source} su post ${reti[0]}`);
    }
    if (reti.length > 1 && tracciati.length === 1) {
      add("utm_condiviso", `${reti.length} reti con un solo link (utm_source=${tracciati[0].utm_source}): ${reti.filter((r) => r !== tracciati[0].utm_source).join(", ")} non distinguibili`, "attribuzione");
    }
  }
  return esiti;
}
