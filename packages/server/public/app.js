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
  const ordine = document.getElementById("f-ordine").value;
  if (fonte) p.set("fonte", fonte);
  if (comune) p.set("comune", comune);
  if (prezzoMin) p.set("prezzoMin", prezzoMin);
  if (prezzoMax) p.set("prezzoMax", prezzoMax);
  if (soloPraticabili) p.set("soloPraticabili", "true");
  if (soloRibassati) p.set("soloRibassati", "true");
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
        <dt>Tribunale</dt><dd>${escapeHtml(imm.tribunale ?? "N/D")} ${imm.numero_rge ? "RGE " + imm.anno_rge + "/" + imm.numero_rge : ""}</dd>
        <dt>Fonte</dt><dd>${escapeHtml(imm.fonte)}</dd>
        <dt>Prima rilevazione</dt><dd>${imm.first_seen_at} (${giorniInRadar(imm)} giorni fa)</dd>
      </dl>
      ${storicoHtml(imm.storicoPrezzi)}
      ${flags.length ? `<ul class="flags">${flags.map((f) => `<li>${escapeHtml(f.tipo)}: ${escapeHtml(f.dettaglio)}</li>`).join("")}</ul>` : ""}
      ${link ? `<a class="external-link" href="${escapeAttr(link)}" target="_blank" rel="noopener noreferrer">Vedi annuncio originale &rarr;</a>` : ""}
    </div>
  `;
  overlay.classList.remove("hidden");
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
      ? `Arricchimento completato: ${esito.immobiliGeocodificati} geocodificati${esito.immobiliValutati != null ? ", " + esito.immobiliValutati + " valutati" : ""}.`
      : esito.motivo,
  );
});

caricaFonti();
caricaListino();
