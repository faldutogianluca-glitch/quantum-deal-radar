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

**Se un comando sembra non stampare niente**, lancia l'eseguibile direttamente,
saltando il wrapper npm:

```powershell
node packages/server/dist/cli.js cattura "https://sito.it/risultati" pagina.html
```

I comandi `npm run <x>` ricompilano prima di eseguire, quindi passano da una
catena `npm run build && node ...`: se la compilazione fallisce, la catena si
interrompe e il comando non parte affatto. Lanciando direttamente si vede subito
di cosa si tratta. `cattura` in particolare impiega circa un minuto e stampa
l'avanzamento riga per riga (`... avvio Chromium`, `... attendo che il DOM
smetta di cambiare`): se quelle righe scorrono, sta lavorando, non e' bloccato.

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

**`demo` e `reperform` sono abilitate.** Tutte le altre fonti hanno
`enabled: false`. Gli URL sono quelli verificati dal titolare del progetto; i
selettori restano segnaposto e vanno calibrati sul DOM reale, una fonte per
volta, con `cattura` e `ispeziona`.

### Fasce di lavorazione

Il campo `fascia` registra l'ordine con cui affrontare le fonti, deciso dal
titolare del progetto. E' cosa diversa da `priorita`, che serve alla deduplica
per stabilire quale fonte prevale sul dato: una fonte puo' essere facile da
attaccare e insieme poco autorevole sul prezzo.

| Fascia | Fonti | Perche' |
| --- | --- | --- |
| **P1** | Reperform, RE-Impresa, BPER Leasing, Credemleasing, Alba Leasing, Intesa Proprieta', iQera, MPS, Agenzia del Demanio, Banca d'Italia, Ferservizi | Cataloghi pubblici consultabili senza autenticazione |
| **P2** | BNL Immobili, i-Resales, Quimmo, Portale Vendite Pubbliche, Astalegale, UCLAM | Pubbliche ma con riserve: registrazione per il dato completo, aree protette, o servizi pubblici da trattare con riguardo |
| **P3** | Credit Agricole, CDP, INPS, BPER Real Estate, Banco BPM/Phoenix | Documenti datati, molto rumore da classificare, o nessun catalogo pubblico |

Alcune indicazioni operative che i config riportano per esteso:

- **iQera** e **Intesa Proprieta'** vanno ispezionate a livello di rete prima di
  scrivere selettori CSS: se dietro la pagina c'e' un endpoint JSON, quello e'
  piu' stabile e piu' leggero del DOM.
- **Credemleasing** mette in vendita immobili, macchinari e veicoli nella stessa
  sezione: il connettore deve filtrare la sola categoria immobiliare.
- **CDP** pubblica gli avvisi immobiliari mescolati a molto materiale che non
  c'entra: serve un classificatore, altrimenti il rumore supera il segnale.
- **Credit Agricole** e **INPS** espongono elenchi che possono essere datati: per
  ogni documento vanno registrate data e validita' della procedura.
- **MPS** e **Agenzia del Demanio** *non* sono fonti solo-PDF, come si era
  ipotizzato in un primo momento: hanno un portale con ricerca e filtri. Si
  attaccano in HTML, e i PDF dei bandi restano un approfondimento.

### Limiti che il connettore rispetta

Alcune fonti sono pubbliche ma pongono condizioni. Sono scritte nel campo
`compliance.note` e valgono come vincoli di progetto:

- **Quimmo** usa reCAPTCHA in alcune aree. Il connettore si ferma alle
  informazioni pubbliche: niente autenticazione, niente partecipazione alle
  aste, nessun tentativo di aggirare una protezione.
- **Portale Vendite Pubbliche**: la ricerca pubblica e' consultabile senza
  autenticazione, mentre SPID/CIE/CNS riguardano funzioni che restano fuori. Si
  raccolgono solo annunci e documenti pubblici, senza automatizzare login ne'
  attivita' dispositive, e con `rateLimitSeconds: 30` — e' un servizio pubblico.
- **Reperform**: il login serve alle funzioni operative e alla partecipazione,
  che il connettore non tocca.
- **BNL Immobili**: dal pubblico si ricavano i metadati; per le caratteristiche
  complete BNL richiede la registrazione, quindi serve un accordo o un feed.

### Fonti in PDF

Banca d'Italia, Credit Agricole, CDP e INPS non pubblicano schede HTML: mettono
online un documento. `fetchMode: "pdf"` lo scarica (rispettando `robots.txt` e
il vaglio di conformita' come qualunque altra fonte), ne estrae il testo e ne
ricava i lotti.

Il testo di un PDF non ha struttura: e' una sequenza di righe. Invece di un
selettore per campo si usa **una sola espressione regolare a gruppi nominati**,
dove ogni nome e' un campo dell'immobile:

```json
"pdf": {
  "rigaLotto": "^Lotto (?<numeroLotto>\\d+) - (?<comune>[A-Z' ]+) \\([A-Z]{2}\\) - (?<indirizzoRaw>.+?) - (?<sottotipoAsset>.+?) - (?<mqRaw>[\\d.,]+) mq - Euro (?<prezzoRaw>[\\d.,]+)",
  "rigaSospetta": "^Lotto \\d+",
  "dataDocumento": "Aggiornamento: (\\d{1,2} \\w+ \\d{4})"
}
```

Nomi riconosciuti: `titolo`, `comune`, `indirizzoRaw`, `numeroLotto`,
`tribunale`, `tipoVendita`, `sottotipoAsset`, `statoOccupazionale` (testo tale
e quale), `prezzoRaw` e `mqRaw` (numeri), `dataAstaRaw` e `termineOfferteRaw`
(date italiane).

Per scriverla si guarda il testo vero:

```bash
npm run pdftesto -- "https://ente.it/elenco.pdf" testo.txt
```

Salva il testo estratto e stampa le righe piu' lunghe, che sono quasi sempre
quelle di tabella.

**Due trappole che costano care.** I campi separati da trattini sembrano
invitare a scrivere `[^-]+` per ciascuno, ma un valore puo' contenere a sua
volta un trattino ("Edificio cielo-terra") e quel lotto sparirebbe in silenzio:
servono quantificatori pigri ancorati al pezzo riconoscibile che segue. E i PDF
usano apostrofi e trattini tipografici (`’ – —`), che il modulo normalizza
prima di applicare le regex — senza, una regex scritta con l'apostrofo dritto
non troverebbe niente e il motivo sarebbe invisibile.

`rigaSospetta` descrive una riga che *sembra* un lotto. Quelle che la
soddisfano ma che `rigaLotto` non sa leggere vengono riportate come non lette,
invece di sparire: e' cosi' che ci si accorge di un documento ristrutturato,
prima di ritrovarsi con zero risultati e nessuna spiegazione. Sulla stessa
logica, uno scraping che riconosce **zero** lotti in un PDF che pero' esiste
viene segnalato come errore, non come risultato vuoto.

`dataDocumento` cattura la data dichiarata dentro il documento. Serve perche'
alcuni enti lasciano online elenchi fermi da anni: oltre i dodici mesi lo
scraping avvisa che la procedura va verificata prima di inseguire immobili
probabilmente gia' venduti.

`pdfjs-dist` e' una **dipendenza opzionale**, come Playwright: chi non usa
fonti PDF non deve installarla.

### Motori non ancora implementati

Un valore di `fetchMode` e' dichiarato ma non implementato, e le fonti che lo
usano lo dicono con un messaggio esplicito invece di fallire in modo oscuro:

- **`manuale`** — nessun catalogo pubblico consultabile. Riguarda **BPER Real
  Estate** e **Banco BPM/Phoenix**: i dati arrivano per contatto diretto, feed,
  email o data room, e serve un percorso di importazione, non uno scraper.

La pagina di **Banca d'Italia** riporta anche manifestazioni di interesse e
trattative in corso: e' un segnale competitivo, dice se si e' soli su un
immobile prima di muoversi.

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
   a essere le schede dei risultati.

   Se trova un banner di consenso ai cookie lo chiude **rifiutando i cookie
   facoltativi** (Cookiebot, OneTrust, Iubenda e i banner artigianali
   riconosciuti dal testo del pulsante). Serve perche' molti portali non
   montano affatto la lista finche' il banner e' aperto: senza questo passaggio
   la cattura restituisce intestazione, footer e dialogo dei cookie, e sembra
   che il sito non abbia annunci.

   Alcuni portali pero' non mostrano nulla senza consenso pieno. In quel caso il
   consenso si concede **esplicitamente**, mai per inerzia:

   ```bash
   npm run cattura -- "https://sito.it/risultati" pagina.html --accetta-cookie
   ```

   Il flag va ripetuto a ogni invocazione, e il comando stampa che cosa ha
   accettato. Per lo scraping vero l'equivalente si scrive nel config della
   fonte, `browser.consensoCookie: "accetta"`, cosi' la scelta resta leggibile
   accanto alla fonte a cui si applica invece di essere un comportamento
   implicito. Il default, in entrambi i casi, resta il rifiuto.

   Un pulsante "accetta solo i necessari" non viene mai contato come consenso
   pieno, nemmeno in modalita' `accetta`: comincia per "accetta" e la
   somiglianza basterebbe a registrare un consenso che non c'e' stato. Da li' si parte per `listSelector`, e i
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
| `npm run verifica` | Controlla il `robots.txt` di **tutte** le fonti configurate e stampa il quadro |
| `npm run verifica -- <url>` | Dettaglio di una sola fonte, col `robots.txt` integrale |
| `npm run cattura -- <url> [file]` | Salva l'HTML di una pagina e propone i selettori delle schede |
| `npm run ispeziona -- <file> <sel>` | Dal file salvato, elenca i campi interni a una scheda |
| `npm run ispeziona -- <file> "testo:<parola>"` | Cerca un testo nel file e mostra i contenitori che lo avvolgono |
| `npm run pdftesto -- <url-o-file> [out]` | Estrae il testo di un PDF e propone le righe candidate a essere i lotti |
