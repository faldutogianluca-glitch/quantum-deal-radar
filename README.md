# Quantum Deal Radar

App per il monitoraggio di immobili distressed (aste giudiziarie, vendite REOCO)
sui portali italiani: scraping pluggable, deduplica cross-fonte, risoluzione
zona OMI e triangolazione valutativa, dashboard web.

Monorepo TypeScript (npm workspaces), zero dipendenze nel core.

## Struttura

```
packages/
  core/       @qdr/core     dedup, geometria zone OMI, geocoding, valutazione (zero dipendenze)
  scrapers/   @qdr/scrapers adapter pluggable per i portali (cheerio), config in sites/*.json
  server/     @qdr/server   storage SQLite, pipeline, API REST, dashboard statica
data/         DB SQLite + (opzionali) dati OMI, non versionati
```

`packages/core` e' stato integrato da un modulo gia' pronto e testato (v0.2,
41 test) fornito come base del progetto: dedup a due chiavi (RGE +
geofisica), point-in-polygon sui perimetri OMI, geocoding con cache
obbligatoria, triangolazione valutativa OMI/perizia/comparabili con soglie di
divergenza esplicite. Non tocca quel modulo: la logica di dominio vive li',
il resto del monorepo ci si innesta sopra.

## Setup

```bash
npm install
npm run build
```

## Uso rapido (senza rete, con l'adapter demo)

```bash
npm run scrape     # scrape -> dedup -> salva in data/quantum-deal-radar.db
npm run serve       # dashboard su http://localhost:3000
```

L'adapter `demo` (in `packages/scrapers/sites/demo.json`) legge una fixture
HTML locale invece di un sito reale: serve a provare l'intera pipeline
(scrape -> dedup -> storage -> dashboard) senza fare alcuna richiesta di
rete, sia in sviluppo che nei test automatici.

## Aggiungere un adapter per un sito reale

I siti sono config JSON in `packages/scrapers/sites/*.json` (schema in
`packages/scrapers/src/types.ts`, `SiteConfig`). Sono gia' presenti due
template **disabilitati** (`astalegale.json`, `portale_vendite_pubbliche.json`)
con selettori CSS segnaposto: durante lo sviluppo il fetch automatico verso
questi portali e' stato bloccato (HTTP 403, anti-bot), quindi i selettori non
sono verificati contro il DOM reale.

Prima di abilitare un sito (`"enabled": true`):

1. **Leggi i termini di servizio e il `robots.txt` del sito** e conferma che
   lo scraping per il tuo uso e' consentito. `@qdr/scrapers` rispetta
   `robots.txt` di default e applica rate limiting per host — non bypassarli
   senza motivo.
2. Apri la pagina dei risultati in un browser, ispeziona il DOM e sostituisci
   i selettori nel JSON (sintassi in stile scrapy: CSS puro = testo
   dell'elemento, `css::attr(nome)` = attributo).
3. Se il sito e' protetto da anti-bot o i risultati sono renderizzati via
   JavaScript, il motore generico (`fetchMode: "static"`, fetch + cheerio)
   potrebbe non bastare: serve un adapter dedicato che implementi l'interfaccia
   `Scraper` (vedi `src/types.ts`) usando un browser headless.
4. Verifica manualmente l'output (`npm run scrape -- <nome-fonte>`, oppure lo
   endpoint `POST /api/scrape?fonte=<nome>`) prima di lasciarlo abilitato in
   modo permanente/pianificato.

## Arricchimento: zona OMI e valutazione (opzionale)

`npm run enrich` risolve la zona OMI di ogni immobile (point-in-polygon) e
calcola una valutazione triangolata (OMI / perizia / comparabili) usando
`@qdr/core`. Richiede due file preparati **una tantum**, non versionati
(vedi `.gitignore`):

- `data/zone_omi.geojson` — perimetri OMI, scaricati dall'area riservata
  dell'Agenzia delle Entrate (servizio "Forniture dati OMI") in formato
  shapefile e riproiettati:
  ```bash
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 data/zone_omi.geojson ZONE_OMI.shp
  ```
- `data/quotazioni_omi.json` — quotazioni min/max per comune+zona+tipologia,
  array di oggetti:
  ```json
  [{ "comuneCod": "F205", "zona": "B7", "tipologia": "Abitazioni civili",
     "vendMin": 1800, "vendMax": 2600, "semestre": "2025-2" }]
  ```

Senza questi file `npm run enrich` esce con un messaggio chiaro invece di
fallire: scraping e dashboard restano pienamente utilizzabili anche senza
questo passo, semplicemente senza sconto/valore stimato.

Il geocoding usa Nominatim/OpenStreetMap (1 richiesta/secondo, come impone la
sua usage policy) con cache obbligatoria su SQLite: gli indirizzi gia'
geocodificati (o falliti) non vengono ririchiesti a ogni ciclo.

## Dati scrapati = dati ostili

Titoli, comuni e URL arrivano da portali di terzi e finiscono nel DOM della
dashboard: vanno trattati come input non fidato. La sanificazione vive in
`packages/server/public/sicurezza.js` (modulo senza dipendenze dal DOM, quindi
verificabile in Node — vedi `src/sicurezza.test.ts`):

- `urlSicuro()` ammette **solo** http/https. Uno schema `javascript:` o `data:`
  in un URL scrapato eseguirebbe codice nell'origine della dashboard al clic.
- `escapeAttr()` va usata per ogni valore inserito **dentro un attributo**:
  `escapeHtml()` non neutralizza le virgolette, e un valore che ne contiene una
  chiude l'attributo e permette di iniettarne altri (`onclick`, `onerror`).

Se aggiungi campi alla dashboard, passa sempre da queste funzioni.

## Cosa NON fa

Non calcola un Opportunity Score complessivo (pesi/calibrazione su sconto,
liquidita', rischio procedurale): quello e' un livello successivo, non
incluso qui. Questo repo produce i suoi input — valore centrale, sconto,
praticabilita', flag di revisione — non il ranking finale.

## Avvertenza

Strumento di screening. Non sostituisce perizia, verifica urbanistica e
catastale, ne' il parere di geometra, notaio o commercialista. Le quotazioni
OMI sono dati Agenzia delle Entrate: citale nei tuoi output. Rispetta sempre
termini di servizio e `robots.txt` dei siti che monitori.

## Comandi

| Comando | Effetto |
|---|---|
| `npm run build` | Compila tutti i pacchetti |
| `npm test` | Esegue tutti i test (core + scrapers + server) |
| `npm run scrape` | Esegue tutti gli adapter abilitati -> dedup -> salva |
| `npm run enrich` | Zona OMI + valutazione (richiede i dati OMI, vedi sopra) |
| `npm run serve` | Avvia API + dashboard su `PORT` (default 3000) |
