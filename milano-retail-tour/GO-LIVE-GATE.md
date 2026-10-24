# Go-live gate: campagna MiRT Radar, lancio 26 ottobre 2026

Controllo eseguito il **24 ottobre 2026, 09:36-09:50 (Europe/Rome)** con richieste HTTP reali (curl, redirect seguiti), lettura della sitemap del sito, DNS pubblico, documentazione FormSubmit nel testo originale e lettura di **tutti** i post programmati su Metricool dal 26/10 al 18/12 (9 finestre, 62 post).

## Verdetto

**Il lancio del 26/10 non è pronto dal lato sito, e c'è una trappola già online.** La sitemap rivela che una pagina Radar è stata pubblicata il 19/10 a `/mirt-radar-2027/` (IT e EN), ma è la **prima versione del 16/10**: promette "Ti mandiamo il Radar via email a breve", non ha il pulsante PDF, il modulo è AJAX (quindi FormSubmit non manda nessuna email al visitatore) e il PDF non esiste in nessun percorso del sito. Chi compila oggi quel modulo non riceve niente. Tutte le altre pagine della campagna (`/radar/`, `/guide/`, articoli, PDF) rispondono 404. I post social sono programmati; i difetti trovati sono elencati sotto.

Il controllo automatico delle 10:00 di sabato è stato **sospeso**: avrebbe sostituito i link `/radar/` con `/contatti/`, scelta sbagliata ora che esiste `/mirt-radar-2027/`. Nuovo controllo domenica 25/10 alle 18:00: verifica gli URL e, se ancora 404, NON tocca Metricool ma manda a Gianluca le due opzioni (rinvio della settimana 1, oppure repoint dei link).

## Scoperta principale: la pagina Radar già online

| Cosa | Risultato |
|---|---|
| URL | `https://www.milanoretailtour.com/mirt-radar-2027/` e `/en/mirt-radar-2027/`, entrambi 200, in sitemap, last-modified 19/10/2026 13:10 GMT |
| Versione | Prima versione della landing (16/10 mattina): campi `name, email, negozio, punti_vendita, privacy, newsletter`; `_subject` "Richiesta MiRT Radar 2027"; manca `source`; manca il blocco anteprima; manca il link Diagnosi |
| Promessa | Sotto il pulsante: "Ti arriva via email". Blocco di successo: "Grazie, richiesta ricevuta! Ti mandiamo il Radar via email a breve." Nessun pulsante PDF |
| Consegna reale | Nessuna: il modulo è AJAX, FormSubmit non manda `_autoresponse` via AJAX (e la pagina non lo ha nemmeno), il PDF è 404 in `/download/`, `/downloads/`, `/files/`, `/pdf/` e alla radice. Arriva solo la notifica a info@: qualcuno deve mandare il PDF a mano |
| Stack del sito | Astro statico su IIS 10 (stessa impronta di creattiva.com: `hdr-search`, `/search-index/it.json`, `/_astro/`). Il sito è quindi un progetto Astro gestito da chi ha pubblicato il 19/10, verosimilmente lo stesso progetto "MilanoRetailTour website" della lista ClickUp |
| Blog | Gli articoli del sito stanno alla radice (`/ai-in-negozio-da-dove-partire/`, 19/10/2026), come i nostri slug: la struttura del pacchetto è compatibile |

**Cosa serve (chi gestisce il progetto del sito):** pubblicare la versione attuale di `radar.html` / `en__radar.html` (pacchetto aggiornato oggi: niente promessa email, pulsante PDF nel blocco di successo), caricare i PDF in `/download/`, pubblicare `/guide/` e gli articoli, e decidere lo slug: tenere `/mirt-radar-2027/` e aggiungere `/radar/` come redirect o alias, oppure il contrario. I 20 link `/radar/` nei post programmati devono corrispondere.

## Verifiche superate

| ID | Verifica | Evidenza |
|---|---|---|
| G01 | Homepage, /contatti/, /en/contact-us/, /eventi/, /team/, /clienti/, /mirt-ai/, /format/, /tour/ rispondono 200 | curl 24/10 09:36 |
| G02 | CSP del sito permette FormSubmit: `connect-src 'self' https://formsubmit.co; form-action 'self' https://formsubmit.co` | sorgente /contatti/ |
| G03 | Nessun placeholder `{{…}}` in nessuno dei 62 post programmati dal 26/10 al 18/12 | getScheduledPosts, 9 finestre |
| G03b | Tutti i 62 post hanno media, data, reti e flag coerenti; sondaggio LinkedIn del 20/11 con 4 opzioni, 7 giorni; post 12 FB/IG con lettere A-D | idem |
| G03c | experience.milanoretailtour.com **non esiste** (NXDOMAIN su DNS pubblico Google): il punto G del revisore esterno era infondato | dns.google, 24/10 |
| G03d | Documentazione FormSubmit letta nel testo originale: "autoresponse won't work with forms that are disabled reCAPTCHA and forms that are submitting through AJAX" | formsubmit.co/documentation, 24/10 |
| G04 | Il placeholder `{{LINK_DIAGNOSI}}` esisteva solo nel file del repo `social/2026-10/posts.json` (post 3 e 6): corretto il 24/10 | commit di oggi |
| G05 | Ogni video ha due post (IG/FB/LinkedIn con "Commenta PAROLA"; TikTok/YouTube con "link in bio"), flag contenuto AI attivi, disclosure avatar nel testo | Metricool, post 402778686 / 402780778 / 402780798 / 402780811 |
| G06 | Le didascalie hanno una sola CTA; link articolo o Radar nel primo commento | Metricool |
| G07 | La landing Radar mostra il pulsante "Apri il PDF" subito dopo l'invio: la consegna del PDF non dipende dall'email | `sito/content/radar.html`, blocco `data-success` |

## Verifiche fallite

| ID | Verifica | Risultato | Azione |
|---|---|---|---|
| F01 | /radar/, /en/radar/ | 404 | Pubblicare il pacchetto (chi gestisce l'hosting). Scadenza: domenica 25/10 sera |
| F02 | /guide/, /en/guide/ | 404 | Idem. Senza questa pagina il "link in bio" di TikTok/YouTube/Instagram non ha destinazione |
| F03 | /cliente-chiede-ai-dove-comprare/ (+EN), articolo della settimana 1 | 404 | Idem. Il post del 26/10 8:00 e il video A1 del 29/10 lo linkano nel primo commento |
| F04 | /download/MiRT-Radar-2027.pdf e /download/guide/*.pdf | 404 | Idem. Finché 404, i PDF si mandano dai link raw GitHub indicati in `guide/COMMENTA-E-RICEVI.md` |
| F05 | Autorisposta del modulo Radar | **Non funziona per progetto**: la documentazione FormSubmit dice "autoresponse won't work with forms that are submitting through AJAX", e il sito invia ogni `form[data-ajax]` via fetch | Corretto il 24/10: tolta dalla pagina ogni promessa "ti arriva anche via email"; la consegna è il pulsante PDF nel blocco di successo. Istruzioni aggiornate. `_autoresponse` resta solo per chi non ha JavaScript |
| F06 | /diagnosi/, /grazie/, /servizi/ | 404, mai costruite | I 23 pulsanti "Prenota la Diagnosi" puntano a /contatti/?diagnosi (200, modulo generico). Funziona ma converte peggio. Costruire con `PROMPT-FUNNEL.md` |
| F06b | Promessa "ti mandiamo **in privato** la guida" nei 7 post del lunedì (26/10 402044777, 2/11 402045025, 9/11 402045092, 16/11 402045223, 23/11 402045293, 30/11 402045336, 7/12 402045370) e nel video A4 soc 402749944. Su LinkedIn la pagina non può aprire DM: la promessa non si può mantenere. La regola del 22/10 (playbook) prevede "ti mandiamo la guida gratuita" senza "in privato"; i post del lunedì non sono stati aggiornati | 8 post | **Corretto il 24/10 ore 10:30** su approvazione di Gianluca: "in privato" tolto dai 7 post del lunedì (nuovi ID 404845803, 404849226, 404850014, 404850045, 404850070, 404850093, 404850119) |
| F06c | Video A4 soc (19/11, 402749944) è rimasto alla versione 2: link all'articolo nel testo invece che nel primo commento, "in privato" nel testo. Non compare in `v3-done.txt` | Metricool | **Corretto il 24/10**: nuovo ID 404850170, una CTA, link articolo nel primo commento |
| F07 | Biografie: i materiali nuovi chiamano Gianluca "co-fondatore"; la pagina /team/ dice che Creattiva è stata fondata nel 2004 da Andrea Bertagnolio e Maria Roberta Castelli e descrive Gianluca come Business Development | Incoerenza | Corretto in PROMPT-FUNNEL.md e nel contesto. Resta in PROMPT-SITO.md (superato) e in piano-video-storie.md. Gianluca deve dire quale formulazione usare |

## Verifiche non eseguite o bloccate

| ID | Verifica | Perché |
|---|---|---|
| N01 | Invio reale del modulo Radar end-to-end | La pagina non è online; FormSubmit è già attivo per info@ (il modulo contatti usa lo stesso indirizzo). Da fare appena /radar/ risponde 200 |
| N03 | Eventi 12/11 e 11/12 "Anteprima Milano Retail Tour" | La pagina /eventi/ li elenca con "I dettagli saranno pubblicati a breve" e senza modulo di iscrizione. Non è un difetto bloccante per la campagna, ma è un'occasione persa: decidere se tenerli, dare dettagli e un modulo di interesse |
| N04 | Video MP4 e pronuncia | I file sono nel repo (non in questo controllo); le criticità di pronuncia sono documentate, la rigenerazione attende crediti HeyGen |
| N05 | ManyChat / risposta ai commenti | Nessun sistema configurato: le risposte sono manuali dalla inbox Metricool entro 24 ore. Serve un responsabile nominato prima del 26/10 |

## Rischi per contenuto programmato (settimana 1)

| Data | Post | Dipende da | Se il sito è ancora 404 |
|---|---|---|---|
| lun 26/10 8:00 | Post 1 articolo (IG/FB/LinkedIn), id 404845803 | /cliente-chiede-ai-dove-comprare/ nel primo commento | Piano B: primo commento senza link, PDF guida AI da link raw GitHub a chi commenta |
| mar 27/10 12:00 | Video B1 soc 402778686 / bio 402780778 | /radar/ (primo commento), /guide/ (bio) | Piano B: primo commento senza link; bio → raw GitHub del Radar |
| mer 28/10 8:00 | Carosello post 2, id 397523286 | /radar/ nel primo commento | Piano B |
| mer 28/10 12:00 | Short YouTube, id 402755347 | /guide/ nel testo | Piano B: testo con link raw GitHub |
| gio 29/10 12:00 | Video A1 soc 402780798 / bio 402780811 | articolo, /guide/ | Piano B |
| ven 30/10 8:00 | Post 3, id 397523716 | /contatti/ (200) | Nessun rischio |
| V0 lancio Radar | non programmato | /radar/ online | Si programma il giorno in cui /radar/ risponde 200 |

Il piano B (`scratchpad hg/fallback.py`, link → /contatti/) **non viene più applicato in automatico**: con `/mirt-radar-2027/` online il repoint giusto dipende da quella pagina. Domenica 25/10 alle 18:00 il controllo automatico ricontrolla gli URL e, se serve, chiede a Gianluca di scegliere tra rinvio della settimana 1 e repoint dei link.

## Cosa serve per chiudere il gate

0. **Subito**: sostituire su `/mirt-radar-2027/` la vecchia landing con quella attuale (pulsante PDF, niente promessa email) e caricare `/download/MiRT-Radar-2027.pdf`, oppure togliere la pagina finché non è pronta. Finché resta così, ogni richiesta va soddisfatta a mano da info@ con il PDF.
1. Chi gestisce il progetto del sito pubblica `pacchetto-sito-mirt.zip` (tutto insieme) e allinea lo slug del Radar (`/radar/` ↔ `/mirt-radar-2027/`). Dopo: ripetere G01-G07 e N01.
2. Gianluca nomina chi risponde ai commenti dal 26/10.
3. Gianluca conferma la formulazione delle biografie (F07).
4. Facoltativo ma consigliato prima che arrivi traffico: costruire /diagnosi/, /grazie/, /servizi/ e il tracciamento lead con `PROMPT-FUNNEL.md`.
