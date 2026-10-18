import { escapeAttr, escapeHtml, urlSicuro } from "./sicurezza.js";

const griglia = document.getElementById("griglia");
const risultatiCount = document.getElementById("risultati-count");
const form = document.getElementById("filtri");
const azioneStato = document.getElementById("azione-stato");

const formatoEuro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtEuro = (v) => (v == null ? null : formatoEuro.format(v));

async function caricaFonti() {
  const fonti = await fetch("/api/fonti").then((r) => r.json());
  const select = document.getElementById("f-fonte");
  for (const f of fonti) {
    const opt = document.createElement("option");
    opt.value = f.name;
    opt.textContent = f.displayName + (f.enabled ? "" : " (disabilitata)");
    select.appendChild(opt);
  }
}

function parametriFiltro() {
  const p = new URLSearchParams();
  const fonte = document.getElementById("f-fonte").value;
  const comune = document.getElementById("f-comune").value;
  const prezzoMin = document.getElementById("f-prezzo-min").value;
  const prezzoMax = document.getElementById("f-prezzo-max").value;
  const soloPraticabili = document.getElementById("f-praticabili").checked;
  const soloRibassati = document.getElementById("f-ribassati").checked;
  const soloQre = document.getElementById("f-qre").checked;
  const ordine = document.getElementById("f-ordine").value;
  if (fonte) p.set("fonte", fonte);
  if (comune) p.set("comune", comune);
  if (prezzoMin) p.set("prezzoMin", prezzoMin);
  if (prezzoMax) p.set("prezzoMax", prezzoMax);
  if (soloPraticabili) p.set("soloPraticabili", "true");
  if (soloRibassati) p.set("soloRibassati", "true");
  if (soloQre) p.set("soloQre", "true");
  if (ordine && ordine !== "recenti") p.set("ordine", ordine);
  return p;
}

/** Calo rispetto al primo prezzo rilevato: e' il segnale di un venditore che cede. */
function ribasso(imm) {
  const iniziale = imm.prezzo_iniziale;
  if (iniziale == null || imm.prezzo == null || iniziale <= 0) return null;
  if (imm.prezzo >= iniziale) return null;
  return {
    pct: ((1 - imm.prezzo / iniziale) * 100).toFixed(0),
    iniziale,
    attuale: imm.prezzo,
  };
}

/** Da quanti giorni l'immobile e' sotto osservazione: un invenduto di lunga data
 *  e' spesso un venditore piu' disposto a trattare. */
function giorniInRadar(imm) {
  if (!imm.first_seen_at) return 0;
  return Math.floor((Date.now() - new Date(imm.first_seen_at).getTime()) / 86400000);
}

function scheda(imm) {
  const div = document.createElement("div");
  div.className = "listing-card";
  div.addEventListener("click", () => mostraDettaglio(imm.id));

  const badges = [];
  if (imm.sconto_su_valore != null) {
    badges.push(`<span class="badge sconto">sconto ${(imm.sconto_su_valore * 100).toFixed(0)}%</span>`);
  }
  const calo = ribasso(imm);
  if (calo) badges.push(`<span class="badge ribasso">ribassato ${calo.pct}%</span>`);
  const giorni = giorniInRadar(imm);
  if (giorni >= 30) badges.push(`<span class="badge">in radar da ${giorni} gg</span>`);
  // ogni tentativo andato deserto e' un venditore piu' disposto a trattare
  if (imm.n_esperimenti_deserti > 0) {
    const n = imm.n_esperimenti_deserti;
    // il plurale italiano cambia la desinenza, non si ottiene aggiungendo una lettera
    badges.push(`<span class="badge deserti">${n} ${n === 1 ? "asta deserta" : "aste deserte"}</span>`);
  }
  // Gate 0 QRE: solo gli esiti su cui si agisce, gli scarti non fanno rumore
  if (imm.qre_esito === "passa") badges.push(`<span class="badge qre-passa">QRE: passa</span>`);
  if (imm.qre_esito === "al_limite") badges.push(`<span class="badge qre-limite">QRE: al limite</span>`);
  if (imm.qre_esito === "solo_poca_concorrenza") badges.push(`<span class="badge qre-pochi">QRE: solo se in pochi</span>`);
  if (imm.praticabile === 0) badges.push(`<span class="badge flag">non praticabile</span>`);
  if (imm.livello_zona === "comune") badges.push(`<span class="badge">zona non risolta</span>`);

  div.innerHTML = `
    <h3>${escapeHtml(imm.titolo || imm.indirizzo_raw || "Immobile senza titolo")}</h3>
    <p class="listing-price">${fmtEuro(imm.prezzo) ?? "Prezzo non disponibile"}</p>
    <p class="listing-meta">${escapeHtml(imm.comune ?? "")}${imm.data_asta ? " &middot; asta " + imm.data_asta : ""}</p>
    <div class="badge-row"><span class="badge">${escapeHtml(imm.fonte)}</span>${badges.join("")}</div>
  `;
  return div;
}


async function caricaListino() {
  const params = parametriFiltro();
  const righe = await fetch(`/api/immobili?${params}`).then((r) => r.json());
  griglia.innerHTML = "";
  risultatiCount.textContent = `${righe.length} immobili trovati`;

  if (righe.length === 0) {
    griglia.innerHTML = `<p class="empty-state">Nessun immobile in database. Usa "Avvia scraping" (fonte "demo" attiva di default) per popolare i dati.</p>`;
    return;
  }
  for (const imm of righe) griglia.appendChild(scheda(imm));
}

async function mostraDettaglio(id) {
  const imm = await fetch(`/api/immobili/${id}`).then((r) => r.json());
  const overlay = document.getElementById("dettaglio-overlay");
  const contenuto = document.getElementById("dettaglio-contenuto");

  const flags = imm.flags_json ? JSON.parse(imm.flags_json) : [];
  const link = urlSicuro(imm.url, window.location.origin);

  contenuto.innerHTML = `
    <div class="dettaglio">
      <h2>${escapeHtml(imm.titolo || imm.indirizzo_raw || "Immobile")}</h2>
      <dl>
        <dt>Prezzo</dt><dd>${fmtEuro(imm.prezzo) ?? "N/D"} ${imm.tipo_prezzo ? "(" + imm.tipo_prezzo + ")" : ""}</dd>
        <dt>Valore stimato</dt><dd>${fmtEuro(imm.valore_centrale) ?? "N/D"}</dd>
        <dt>Sconto su valore</dt><dd>${imm.sconto_su_valore != null ? (imm.sconto_su_valore * 100).toFixed(1) + "%" : "N/D"}</dd>
        <dt>Comune</dt><dd>${escapeHtml(imm.comune ?? "N/D")}</dd>
        <dt>Indirizzo</dt><dd>${escapeHtml(imm.indirizzo_raw ?? "N/D")}</dd>
        <dt>Zona OMI</dt><dd>${escapeHtml(imm.zona_omi ?? "N/D")} ${imm.livello_zona ? "(" + imm.livello_zona + ")" : ""}</dd>
        <dt>Data asta</dt><dd>${escapeHtml(imm.data_asta ?? "N/D")}</dd>
        <dt>Esperimenti deserti</dt><dd>${imm.n_esperimenti_deserti ?? "N/D"}</dd>
        <dt>Stato vendita</dt><dd>${escapeHtml(imm.tipo_vendita ?? "N/D")}</dd>
        <dt>Tribunale</dt><dd>${escapeHtml(imm.tribunale ?? "N/D")} ${imm.numero_rge ? "RGE " + imm.anno_rge + "/" + imm.numero_rge : ""}</dd>
        <dt>Fonte</dt><dd>${escapeHtml(imm.fonte)}</dd>
        <dt>Prima rilevazione</dt><dd>${imm.first_seen_at} (${giorniInRadar(imm)} giorni fa)</dd>
      </dl>
      ${qreHtml(imm)}
      ${storicoHtml(imm.storicoPrezzi)}
      ${flags.length ? `<ul class="flags">${flags.map((f) => `<li>${escapeHtml(f.tipo)}: ${escapeHtml(f.dettaglio)}</li>`).join("")}</ul>` : ""}
      ${link ? `<a class="external-link" href="${escapeAttr(link)}" target="_blank" rel="noopener noreferrer">Vedi annuncio originale &rarr;</a>` : ""}
    </div>
  `;
  overlay.classList.remove("hidden");
}

const fmtPct = (v) => (v == null ? "N/D" : (v * 100).toFixed(1) + "%");
const NOMI_VINCOLO = { margine: "margine", irr: "IRR minimo sulla durata", stress: "stress test" };

/** Il Gate 0 QRE: quanto offrire, a quanto si chiudera' l'asta, e cosa regge se va male. */
function qreHtml(imm) {
  if (!imm.qre_esito) return "";
  const d = imm.qre_dettaglio_json ? JSON.parse(imm.qre_dettaglio_json) : null;
  const riga = (nome, s) => s ? `<tr><td>${nome}</td><td>${fmtPct(s.margine)}</td><td>${fmtPct(s.irr)}</td></tr>` : "";
  return `
    <div class="storico">
      <h3>Gate 0 QRE &middot; ${escapeHtml(imm.qre_esito.replaceAll("_", " "))}</h3>
      <p>${escapeHtml(imm.qre_motivo ?? "")}</p>
      <dl>
        <dt>Valore di uscita</dt><dd>${imm.qre_valore_mq != null ? fmtEuro(imm.qre_valore_mq) + "/mq" : "N/D"}${imm.qre_valore_fonte ? " (" + (imm.qre_valore_fonte === "comparabili" ? "comparabili ristrutturati" : "massimo OMI") + ")" : ""}</dd>
        <dt>Offerta massima</dt><dd>${fmtEuro(imm.qre_pmax_obiettivo) ?? "N/D"}${imm.qre_vincolo ? " (vincolo: " + escapeHtml(NOMI_VINCOLO[imm.qre_vincolo] ?? imm.qre_vincolo) + ")" : ""}</dd>
        <dt>Tetto</dt><dd>${fmtEuro(imm.qre_pmax_tetto) ?? "N/D"}</dd>
        <dt>Offerta minima ammessa</dt><dd>${fmtEuro(imm.qre_prezzo_ingresso) ?? "N/D"}</dd>
        <dt>Prezzo atteso di aggiudicazione</dt><dd>${fmtEuro(imm.qre_prezzo_atteso) ?? "N/D"}</dd>
      </dl>
      ${d && d.base ? `<table class="qre-tabella"><tr><th>Comprando all'offerta</th><th>Margine</th><th>IRR</th></tr>${riga("Caso base", d.base)}${riga("Stress test", d.stress)}</table>` : ""}
      ${comparabiliHtml(d)}
      ${d ? `<p class="qre-ipotesi">Aggiudicazione attesa: ${escapeHtml(d.moltiplicatore.fonte)}.<br>${d.ipotesi.map(escapeHtml).join("<br>")}</p>` : ""}
    </div>`;
}

/** I comparabili usati: chi decide un'offerta deve poterli aprire uno per uno. */
function comparabiliHtml(d) {
  const c = d && d.uscita && d.uscita.comparabili;
  if (!c) return "";
  const e = c.esclusi;
  const intestazione = `<p><strong>Comparabili</strong> ${escapeHtml(c.ambito)}: ${c.n} usati${c.affidabile ? "" : " &middot; non affidabili, " + escapeHtml(c.motivo)}` +
    (c.p25 != null ? ` &middot; forbice ${fmtEuro(c.p25)} - ${fmtEuro(c.p75)}/mq (${fmtPct(c.dispersione)})` : "") +
    (d.uscita.divergenzaOmi != null ? ` &middot; ${d.uscita.divergenzaOmi >= 0 ? "+" : ""}${fmtPct(d.uscita.divergenzaOmi)} sul massimo OMI` : "") +
    `<br><span class="qre-ipotesi">Esclusi: ${e.stato} per stato, ${e.data} per data, ${e.taglio} per taglio, ${e.distanza} per distanza, ${e.anomali} anomali.</span></p>`;
  if (!c.usati.length) return intestazione;
  const righe = c.usati.slice(0, 10).map((u) => {
    const link = urlSicuro(u.url, window.location.origin);
    const nome = escapeHtml(u.indirizzo ?? "senza indirizzo");
    return `<tr><td>${link ? `<a href="${escapeAttr(link)}" target="_blank" rel="noopener noreferrer">${nome}</a>` : nome}</td>` +
      `<td>${Math.round(u.mq)} mq</td><td>${escapeHtml(u.stato)}</td><td>${u.distanza != null ? Math.round(u.distanza) + " m" : "-"}</td>` +
      `<td>${fmtEuro(u.prezzoMq)}</td><td>${fmtEuro(u.prezzoMqOmogeneo)}</td></tr>`;
  }).join("");
  return intestazione +
    `<table class="qre-tabella"><tr><th>Comparabile</th><th>Mq</th><th>Stato</th><th>Distanza</th><th>EUR/mq</th><th>Omogeneo</th></tr>${righe}</table>`;
}

/** La sequenza dei prezzi: quante volte e' calato, di quanto, e da quanto e' fermo. */
function storicoHtml(storico) {
  if (!storico || storico.length === 0) return "";
  if (storico.length === 1) {
    return `<p class="storico-nota">Prezzo invariato da quando e' in radar (${fmtEuro(storico[0].prezzo)}).</p>`;
  }
  const primo = storico[0].prezzo;
  const righe = storico.map((v, i) => {
    const delta = i === 0 ? "" : ` (${v.prezzo < storico[i - 1].prezzo ? "&darr;" : "&uarr;"} ${Math.abs(((1 - v.prezzo / storico[i - 1].prezzo) * 100)).toFixed(0)}%)`;
    return `<li><span class="storico-data">${v.rilevato_il.slice(0, 10)}</span> ${fmtEuro(v.prezzo)}${delta}</li>`;
  }).join("");
  const totale = ((1 - storico[storico.length - 1].prezzo / primo) * 100).toFixed(0);
  return `<div class="storico"><h3>Storico prezzi <span class="storico-totale">${totale > 0 ? "&minus;" + totale + "% dal primo rilevamento" : ""}</span></h3><ul>${righe}</ul></div>`;
}

document.getElementById("chiudi-dettaglio").addEventListener("click", () => {
  document.getElementById("dettaglio-overlay").classList.add("hidden");
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  caricaListino();
});

async function eseguiAzione(bottone, url, messaggioOk) {
  bottone.disabled = true;
  azioneStato.textContent = "In corso...";
  try {
    const esito = await fetch(url, { method: "POST" }).then((r) => r.json());
    azioneStato.textContent = messaggioOk(esito);
    await caricaListino();
  } catch (err) {
    azioneStato.textContent = "Errore: " + err.message;
  } finally {
    bottone.disabled = false;
  }
}

document.getElementById("btn-scrape").addEventListener("click", (e) => {
  eseguiAzione(e.target, "/api/scrape", (esito) => `Scraping completato: ${esito.nuovi} nuovi, ${esito.aggiornati} aggiornati.`);
});

document.getElementById("btn-enrich").addEventListener("click", (e) => {
  eseguiAzione(e.target, "/api/enrich", (esito) =>
    esito.eseguito
      ? `Arricchimento completato: ${esito.immobiliGeocodificati} geocodificati${esito.immobiliValutati != null ? ", " + esito.immobiliValutati + " valutati, " + esito.immobiliQre + " passano il Gate 0 QRE" : ""}.`
      : esito.motivo,
  );
});

caricaFonti();
caricaListino();
