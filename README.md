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

Serve Node 22.5 o superiore (`node -v`). Lo sviluppo e i test girano su Node 22.

Non ci sono moduli nativi da compilare: la persistenza usa `node:sqlite`, la
libreria SQLite integrata in Node. Quindi niente Visual Studio Build Tools,
niente Python, niente `node-gyp` — `npm install` scarica e basta, su qualunque
versione di Node abbastanza recente.

```bash
npm install
npm run build
```

### Windows / PowerShell

I comandi qui sotto sono in stile bash. Su PowerShell **non usare `\` per andare
a capo**: non e' un carattere di continuazione e finisce fra gli argomenti. Scrivi
il comando su una riga sola, oppure usa il backtick `` ` `` come continuazione.

Gli URL vanno sempre fra virgolette, perche' contengono `?` e `&`:

```powershell
npm run verifica -- "https://www.reperform.com/mappa?pre=1"
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

## Registro delle fonti

`packages/scrapers/sites/*.json` contiene una voce per ogni fonte da monitorare.
Ogni voce porta **due numeri distinti, che non vanno confusi**:

| Campo | Significato |
|---|---|
| `ordineMonitoraggio` | Quali fonti guardare per prime. E' la graduatoria operativa. |
| `priorita` | Quanto ci si fida del dato: la fonte con numero piu' basso **vince sui conflitti** in `deduplica()`. |

Sono ordinamenti diversi e a volte opposti. Il PVP e' 8° per interesse
operativo, ma e' `priorita: 1` perche' porta l'RGE e la base d'asta ufficiale:
se un servicer pubblica un prezzo richiesto diverso, deve prevalere il dato del
tribunale. Applicare la graduatoria operativa al campo `priorita` farebbe
sovrascrivere il dato ufficiale con quello commerciale.

### Il campo `compliance`

Ogni fonte porta l'esito della verifica di conformita', che e' una decisione
umana e va registrata:

```json
"compliance": {
  "stato": "da_verificare",
  "verificatoIl": "2026-08-07",
  "note": "robots.txt consente /ricerca; ToS art. 5 non vieta l'uso personale",
  "crawlDelay": 10
}
```

**Uno scraper con `stato` diverso da `"consentito"` si rifiuta di partire.** Non
e' un default permissivo con un avviso: e' un blocco. Scaricare da un sito terzo
va deciso consapevolmente, non ereditato dalla configurazione. Gli stati sono
`da_verificare` (iniziale), `consentito`, `vietato`, `solo_contatto`.

Se il sito dichiara un `Crawl-delay`, alza `rateLimitSeconds` almeno a quel
valore.

### Ricerche parametriche

I siti che espongono deep-link (una pagina per comune, per tribunale…) si
configurano con `urlTemplate` invece di `searchUrl`:

```json
"urlTemplate": "https://www.quimmo.it/annunci-immobiliari/{comune}",
"parametri": { "comune": ["milano", "bergamo"] }
```

Genera una ricerca per combinazione. E' preferibile a scaricare il catalogo
nazionale e filtrare dopo: meno richieste al sito, meno probabilita' di essere
bloccati, e si scarica solo cio' che interessa.

### Coordinate gia' nella pagina

Alcuni portali espongono la posizione dell'immobile in attributi come
`data-lat`/`data-lng`. Configurando i campi `lat` e `lon` l'arricchimento usa
quel punto direttamente: **niente geocoding**, quindi nessuna richiesta a
Nominatim, nessun limite di una al secondo e nessuna imprecisione di un
indirizzo interpretato. La zona OMI si risolve con il solo point-in-polygon.

### Stato attuale

**`demo` e `reperform` sono abilitate.** Tutte le fonti reali hanno `enabled: false` e
`compliance.stato: "da_verificare"`; gli URL di ricerca sono quelli reali dove
noti, ma **i selettori sono ancora segnaposto** e vanno calibrati sul DOM.
Dove nemmeno l'URL e' noto resta `DA-COMPILARE.invalid`, dominio che per
RFC 2606 non risolve mai, e lo scraper si rifiuta comunque di partire.

### Canali non automatizzabili

Non tutte le fonti sono portali da cui si possano estrarre schede:

- **BPER Real Estate** e' un canale a contatto diretto: non ha un catalogo da
  monitorare e non esiste un adapter possibile. Resta un'attivita' umana. E'
  in registro solo per completezza, con `compliance.stato: "solo_contatto"`.
- **Banca d'Italia** pubblica l'elenco degli immobili come **PDF allegato**, non
  come schede HTML: un parser di selettori CSS non serve a nulla. Serve un
  adapter dedicato che vigili sugli allegati (nuovo file o modifica di uno
  esistente). La stessa pagina riporta manifestazioni di interesse e trattative
  in corso: e' un segnale competitivo, dice se si e' soli su un immobile prima
  di muoversi.
- **MPS e CDP/Fintecna** pubblicano bandi e avvisi tipicamente in PDF. Verificare
  se le pagine espongano davvero schede HTML, altrimenti vale lo stesso discorso.

### Fonti specchio e verifica del dedup

Le aste **BNL passano da Astalegale** (e quindi anche da `asteimmobili.it`): gli
stessi lotti arrivano da due fonti. Non e' una fonte in piu' da scaricare — e' il
banco di prova della deduplicazione. Se lo stesso lotto arriva da BNL e da
Astalegale e non collassa in una riga sola, la chiave giudiziaria non sta
funzionando.

## Aggiungere un adapter per un sito reale

I siti sono config JSON in `packages/scrapers/sites/*.json` (schema in
`packages/scrapers/src/types.ts`, `SiteConfig`). Sono gia' presenti due
template **disabilitati** (`astalegale.json`, `portale_vendite_pubbliche.json`)
con selettori CSS segnaposto: durante lo sviluppo il fetch automatico verso
questi portali e' stato bloccato (HTTP 403, anti-bot), quindi i selettori non
sono verificati contro il DOM reale.

Prima di abilitare un sito (`"enabled": true`):

1. **Verifica `robots.txt` e i termini di servizio.** Per il primo c'e' un
   comando:

   ```bash
   npm run verifica -- https://sito.it/pagina-risultati
   ```

   Stampa il `robots.txt` integrale, il `Crawl-delay` dichiarato, le regole
   applicabili e se quel percorso e' consentito. `@qdr/scrapers` rispetta
   `robots.txt` di default e applica rate limiting per host — non bypassarli
   senza motivo.

   **`robots.txt` non esaurisce la questione**: le condizioni d'uso possono
   vietare la raccolta automatica anche dove `robots.txt` tace. Quelle vanno
   lette a parte, e la valutazione finale spetta a te.
2. **Cattura la pagina** e fatti proporre i selettori:

   ```bash
   npm run cattura -- "https://sito.it/risultati" pagina.html
   ```

   Carica la pagina con Chromium (quindi vede anche i risultati resi via
   JavaScript), la salva su file e stampa le classi che si ripetono, candidate
   a essere le schede dei risultati. Da li' si parte per `listSelector`, e i
   selettori dei singoli campi si ricavano guardando il file salvato — senza
   ripetere richieste al sito a ogni tentativo.

   I candidati sono ordinati per **varieta' del contenuto**, non per numero di
   occorrenze: e' quello che distingue un elenco di annunci, dove ogni scheda ha
   un testo suo, da menu, footer e classi di impaginazione, che ripetono sempre
   lo stesso testo. La colonna "testi distinti" mostra la misura.

   Se nessun candidato corrisponde a cio' che vedi nel browser, cerca per
   contenuto: prendi una parola dal titolo di un immobile visibile nella pagina e

   ```bash
   npm run ispeziona -- pagina.html "testo:Navigli"
   ```

   risale dal testo ai suoi contenitori, indicando per ogni classe quante volte
   ricorre nella pagina: quella il cui conteggio somiglia al numero di annunci
   visibili e' il `listSelector`. Se invece la parola non compare affatto nel
   file, il problema non e' il selettore ma la cattura: i risultati arrivano
   dopo un'interazione (form di ricerca, consenso ai cookie) che il comando non
   ha compiuto.

   Scelto il blocco della scheda, `ispeziona` ne elenca i campi interni con i
   valori d'esempio, sempre dal file salvato:

   ```bash
   npm run ispeziona -- pagina.html ".blocco-annuncio"
   ```

   Per ogni classe interna riporta su quante schede compare — un campo presente
   ovunque e' affidabile, uno presente solo su alcune va trattato come opzionale
   — e i valori trovati, che rendono evidente quale porta il titolo, quale il
   prezzo e cosi' via.

   La sintassi e' in stile scrapy: CSS puro = testo dell'elemento,
   `css::attr(nome)` = attributo. Quando il valore va ancora estratto da cio' che
   il selettore restituisce, il campo diventa un oggetto con una regex:

   ```json
   "immagineUrl": { "selettore": ".copertina::attr(style)", "regex": "url\\('([^']+)'\\)" },
   "nEsperimentiDeserti": { "selettore": ".email a::attr(href)",
                            "regex": "esperimento:\\s*(\\d+)", "offset": -1 }
   ```

   Serve piu' spesso di quanto sembri: i portali nascondono i dati utili in
   attributi `style`, query string di link e testo misto. `offset` copre i
   conteggi sfasati di uno — "esperimento n. 1" significa zero tentativi andati
   deserti. Se la regex non trova nulla il campo resta vuoto invece di ricevere
   il testo intero: un valore sbagliato passa inosservato, uno assente no.
3. Se il sito e' protetto da anti-bot o rende i risultati via JavaScript,
   `fetchMode: "static"` (fetch + cheerio) vede una pagina vuota: usa
   `fetchMode: "browser"`, che carica la pagina con Chromium headless. In quel
   caso imposta anche `browser.attendiSelettore` sullo stesso valore di
   `listSelector`, altrimenti si rischia di leggere il markup prima che i
   risultati siano stati resi.
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

## Motore browser (per siti JavaScript o con anti-bot)

`fetchMode: "browser"` carica la pagina con Chromium headless invece di un
semplice `fetch`. Playwright e' una **dipendenza opzionale**: viene importato
solo quando serve, quindi chi usa unicamente il fetch statico non deve
scaricare un browser. Per abilitarlo:

```bash
npx playwright install chromium
```

Se l'ambiente ha gia' un Chromium (immagini CI, container preconfigurati),
indicalo con `QDR_CHROMIUM_PATH=/percorso/del/chrome` invece di scaricarne
un altro.

Il motore browser rispetta `robots.txt` e il rate limiting esattamente come
quello statico: non e' una scorciatoia per aggirare le regole del sito.

## Esecuzione periodica

```bash
npm run watch          # ogni 6 ore (default), si ferma con Ctrl-C
npm run watch -- 60    # ogni 60 minuti
```

Variabili:

| Variabile | Effetto |
|---|---|
| `QDR_INTERVALLO_MINUTI` | Intervallo. Se impostata, **anche `npm run serve` pianifica** lo scraping. |
| `QDR_WATCH_ENRICH=true` | Esegue anche l'arricchimento OMI a ogni ciclo. |

Lo scheduler e' spento di default: un server che inizia a scaricare da solo
appena avviato e' una sorpresa sgradita. I cicli non si sovrappongono — se uno
scraping dura piu' dell'intervallo il giro successivo viene saltato invece di
partire in parallelo sullo stesso database — e un ciclo fallito non interrompe
la pianificazione.

## Storico dei prezzi

Buona parte del lavoro consiste nell'attendere che il prezzo scenda, o nel fare
un'offerta al ribasso a un venditore motivato. Il dato che conta non e' quindi
il prezzo di oggi, ma **come si e' mosso nel tempo**.

Ogni variazione di prezzo viene registrata in `storico_prezzi` — solo le
variazioni, non ogni ciclo di scraping, altrimenti la sequenza dei ribassi
diventerebbe illeggibile fra migliaia di righe identiche.

Da qui la dashboard ricava:

- **badge "ribassato N%"** sulla scheda, calcolato sul primo prezzo rilevato;
- **"in radar da N giorni"** oltre i 30: un invenduto di lunga data segnala
  spesso un venditore piu' disposto a trattare;
- nel dettaglio, la **sequenza completa** con il calo di ogni passaggio.

Filtri e ordinamenti corrispondenti: `soloRibassati=true`, `ordine=ribasso`
(calo maggiore per primo), `ordine=anzianita` (in radar da piu' tempo).

### Quando il prezzo non c'e'

Alcune fonti pubblicano l'immobile senza un prezzo di vendita — le pre-aste di
Reperform, per esempio, espongono solo una valutazione della piattaforma. Li' lo
storico dei prezzi non ha nulla da registrare, e il segnale di un venditore
motivato e' un altro: il numero di **esperimenti d'asta andati deserti**. Ogni
tentativo fallito e' una posizione negoziale piu' debole per chi vende.

La dashboard lo mostra come badge e permette di ordinare per quel valore
(`ordine=deserti`).

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
| `npm run watch` | Rilancia lo scraping a intervalli regolari |
| `npm run verifica -- <url>` | Legge il `robots.txt` di un sito e dice se il percorso e' consentito |
| `npm run cattura -- <url> [file]` | Salva l'HTML di una pagina e propone i selettori delle schede |
| `npm run ispeziona -- <file> <sel>` | Dal file salvato, elenca i campi interni a una scheda |
| `npm run ispeziona -- <file> "testo:<parola>"` | Cerca un testo nel file e mostra i contenitori che lo avvolgono |
