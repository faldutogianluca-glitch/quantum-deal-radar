# Milano Retail Tour: pagine da pubblicare su milanoretailtour.com

Ciao, questo pacchetto contiene le pagine nuove per la campagna "MiRT Radar 2027". Sono una landing page, un PDF scaricabile e 8 articoli del blog, tutti in italiano e inglese.
Il sito resta com'è: si aggiungono solo pagine, senza modificare quelle esistenti.

## Cosa c'è nel pacchetto

| Cartella / file | Contenuto |
|---|---|
| `content/*.html` | 18 frammenti HTML (9 IT + 9 EN, i file EN iniziano con `en__`). Sono solo il contenuto della pagina, senza header e footer: vanno inseriti nel template del sito come le altre pagine. |
| `download/MiRT-Radar-2027.pdf` | Il PDF che si scarica dalla landing page |
| `download/mirt-radar-2027-anteprima.jpg` | L'immagine di anteprima usata nella landing page |
| `pages-json-aggiunte.json` | Per ogni pagina: indirizzo (slug), titolo SEO, meta description, lingua, file e data di pubblicazione. Sono da aggiungere all'elenco delle pagine del sito. |

I frammenti usano **solo le classi CSS già presenti nel sito** (`fmt`, `fmt-card`, `fmt-lead`, `fmt-cols`, `fmt-tags`, `fmt-checks`, `fmt-cta`, `ai-kicker`, `ai-rules`…).
Non contengono stili o script inline, quindi rispettano la Content Security Policy attuale.

## Indirizzi e date

Ogni pagina va pubblicata **entro** la data indicata, perché i post social programmati su Metricool rimandano a questi indirizzi.

| Indirizzo | Versione EN | Online entro |
|---|---|---|
| `/download/MiRT-Radar-2027.pdf` e `/download/mirt-radar-2027-anteprima.jpg` | – | **26/10/2026** |
| `/radar/` | `/en/radar/` | **26/10/2026** |
| `/cliente-chiede-ai-dove-comprare/` | `/en/cliente-chiede-ai-dove-comprare/` | **26/10/2026** |
| `/chi-chiude-chi-resiste/` | `/en/chi-chiude-chi-resiste/` | 2/11/2026 |
| `/commesso-aumentato/` | `/en/commesso-aumentato/` | 9/11/2026 |
| `/commercio-agentico-2026/` | `/en/commercio-agentico-2026/` | 16/11/2026 |
| `/regole-2026-negozi/` | `/en/regole-2026-negozi/` | 23/11/2026 |
| `/flagship-milano-2026/` | `/en/flagship-milano-2026/` | 30/11/2026 |
| `/recommerce-negozio/` | `/en/recommerce-negozio/` | 7/12/2026 |
| `/trend-2027-agenda/` | `/en/trend-2027-agenda/` | 14/12/2026 |

La soluzione più semplice è pubblicare **tutto subito**: le date indicate sono solo il limite massimo.

## Modulo della landing page (/radar/)

- Il modulo invia a FormSubmit (`https://formsubmit.co/info@milanoretailtour.com`), che è **già attivato**: non serve fare nulla.
- Chi compila il modulo riceve un'email automatica con il link a `/download/MiRT-Radar-2027.pdf`. Per questo il PDF deve stare esattamente a quell'indirizzo.
- Se la CSP del sito limita `form-action` o `connect-src`, va aggiunto `https://formsubmit.co`.

## Verifica dopo la pubblicazione

1. Aprire `https://www.milanoretailtour.com/radar/` e `/en/radar/`: la pagina deve avere lo stile del sito e mostrare l'immagine di anteprima.
2. Aprire `https://www.milanoretailtour.com/download/MiRT-Radar-2027.pdf`: il PDF si deve scaricare.
3. Compilare il modulo con un'email di prova: deve arrivare l'email automatica e una notifica a info@milanoretailtour.com.
4. Aprire due o tre articoli e controllare che i pulsanti verso `/radar/` e `/contatti/?diagnosi` funzionino.
5. Se c'è una sitemap, aggiungere i nuovi indirizzi.

Per qualsiasi dubbio scrivete a Gianluca Falduto.
