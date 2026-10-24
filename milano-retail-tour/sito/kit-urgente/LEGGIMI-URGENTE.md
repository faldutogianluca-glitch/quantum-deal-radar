# Pubblicare la pagina Radar corretta e il PDF (10 minuti)

Stato al 24/10/2026: su milanoretailtour.com è online `/mirt-radar-2027/` con la **prima versione** della landing (16/10 mattina).
Promette "Ti mandiamo il Radar via email a breve" ma l'email non parte mai (il modulo è AJAX e FormSubmit non manda
l'autorisposta via AJAX) e il PDF `/download/MiRT-Radar-2027.pdf` non esiste. Chi compila oggi non riceve niente.
I post programmati dal 26/10 puntano a `/radar/`, `/guide/`, `/cliente-chiede-ai-dove-comprare/` e ai PDF: tutti 404.

## Cosa fa il kit
- Copia in `src/site/content/` la landing corretta (`radar.html`, `en__radar.html`: pulsante "Apri il PDF" subito dopo l'invio,
  nessuna promessa di email), la pagina `/guide/` (hub dei 4 PDF per il link in bio) e l'articolo 1 (IT+EN).
- Scarica da GitHub in `public/download/` il PDF del Radar, l'anteprima e le 6 guide.
- Aggiunge le voci a `src/site/pages.json`: `radar`, `en/radar`, `guide`, `en/guide`, l'articolo 1 e **sostituisce**
  `mirt-radar-2027` / `en/mirt-radar-2027` con lo stesso file corretto (così la pagina già online si aggiorna e i due indirizzi
  convivono). Con l'opzione "tutto" aggiunge anche gli altri 7 articoli.
- Fa una copia `pages.json.bak` prima di scrivere.

## Passi
1. Apri la cartella del progetto del sito (quella con `package.json`, `src/site/pages.json`, `src/site/content/`).
   È lo stesso progetto da cui è stata pubblicata `/mirt-radar-2027/` il 19/10.
2. Scarica questa cartella `kit-urgente` (dal repo GitHub `quantum-deal-radar`, `milano-retail-tour/sito/kit-urgente`,
   oppure dalla cartella Drive "Milano Retail Tour – piano editoriale MiRT Radar").
3. Windows, PowerShell nella cartella del progetto:
   `powershell -ExecutionPolicy Bypass -File C:\percorso\kit-urgente\applica.ps1 -Kit C:\percorso\kit-urgente`
   (aggiungi `-Tutto` per pubblicare anche gli altri 7 articoli).
   macOS/Linux: `bash /percorso/kit-urgente/applica.sh /percorso/kit-urgente` (aggiungi `tutto`).
4. `npm run build`
5. Carica `dist/` sul server IIS come le altre volte (bastano le cartelle nuove o cambiate: `radar`, `en/radar`,
   `mirt-radar-2027`, `en/mirt-radar-2027`, `guide`, `en/guide`, `cliente-chiede-ai-dove-comprare`,
   `en/cliente-chiede-ai-dove-comprare`, `download`, `_astro`, `sitemap.xml`, `search-index`).
6. Verifica: https://www.milanoretailtour.com/radar/ e `/download/MiRT-Radar-2027.pdf` devono rispondere;
   compila il modulo con un'email di prova: deve comparire il pulsante "Apri il PDF" e arrivare la notifica a info@.

## Se qualcosa non torna
- `pages.json` ha una struttura diversa dal 2/10: lo script aggiunge comunque le chiavi; controlla il diff con `pages.json.bak`.
- Il progetto non è più in `src/site/`: copia a mano i file di `content/` nella cartella dei frammenti e le voci di
  `pages-aggiunte-urgenti.json` nell'elenco delle pagine.
- Preferisci un solo indirizzo per il Radar: tieni `radar` e togli `mirt-radar-2027` solo dopo aver aggiunto un redirect,
  perché la pagina è già indicizzata nella sitemap.

Dettagli e verifiche: `milano-retail-tour/GO-LIVE-GATE.md` nel repo.
