# Go-live gate: campagna MiRT Radar, lancio 26 ottobre 2026

Controllo eseguito il **24 ottobre 2026 alle 09:36 (Europe/Rome)** con richieste HTTP reali (curl, redirect seguiti) e lettura dei post programmati su Metricool per la settimana 26-31 ottobre.

## Verdetto

**Il lancio del 26/10 non è pronto dal lato sito.** Tutte le pagine della campagna rispondono 404. I contenuti social sono programmati e corretti. Se il sito non va online entro domenica sera, sabato 24/10 alle 10:00 il controllo automatico applica il piano B (didascalie della prima settimana senza link al sito, video di lancio V0 rinviato).

## Verifiche superate

| ID | Verifica | Evidenza |
|---|---|---|
| G01 | Homepage, /contatti/, /en/contact-us/, /eventi/, /team/, /clienti/, /mirt-ai/, /format/, /tour/ rispondono 200 | curl 24/10 09:36 |
| G02 | CSP del sito permette FormSubmit: `connect-src 'self' https://formsubmit.co; form-action 'self' https://formsubmit.co` | sorgente /contatti/ |
| G03 | Nessun placeholder `{{…}}` nei post programmati su Metricool 26-31/10 (il post del 30/10 ha il link /contatti/ risolto) | getScheduledPosts, 8 post letti |
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
| F07 | Biografie: i materiali nuovi chiamano Gianluca "co-fondatore"; la pagina /team/ dice che Creattiva è stata fondata nel 2004 da Andrea Bertagnolio e Maria Roberta Castelli e descrive Gianluca come Business Development | Incoerenza | Corretto in PROMPT-FUNNEL.md e nel contesto. Resta in PROMPT-SITO.md (superato) e in piano-video-storie.md. Gianluca deve dire quale formulazione usare |

## Verifiche non eseguite o bloccate

| ID | Verifica | Perché |
|---|---|---|
| N01 | Invio reale del modulo Radar end-to-end | La pagina non è online; FormSubmit è già attivo per info@ (il modulo contatti usa lo stesso indirizzo). Da fare appena /radar/ risponde 200 |
| N02 | experience.milanoretailtour.com (riferimenti a un'Anteprima del 16 aprile segnalati dal revisore) | Host non raggiungibile dal proxy di questa sessione. Da controllare a mano nel browser |
| N03 | Eventi 12/11 e 11/12 "Anteprima Milano Retail Tour" | La pagina /eventi/ li elenca con "I dettagli saranno pubblicati a breve" e senza modulo di iscrizione. Non è un difetto bloccante per la campagna, ma è un'occasione persa: decidere se tenerli, dare dettagli e un modulo di interesse |
| N04 | Video MP4 e pronuncia | I file sono nel repo (non in questo controllo); le criticità di pronuncia sono documentate, la rigenerazione attende crediti HeyGen |
| N05 | ManyChat / risposta ai commenti | Nessun sistema configurato: le risposte sono manuali dalla inbox Metricool entro 24 ore. Serve un responsabile nominato prima del 26/10 |

## Rischi per contenuto programmato (settimana 1)

| Data | Post | Dipende da | Se il sito è ancora 404 |
|---|---|---|---|
| lun 26/10 8:00 | Post 1 articolo (IG/FB/LinkedIn), id 402044777 | /cliente-chiede-ai-dove-comprare/ nel primo commento | Piano B: primo commento senza link, PDF guida AI da link raw GitHub a chi commenta |
| mar 27/10 12:00 | Video B1 soc 402778686 / bio 402780778 | /radar/ (primo commento), /guide/ (bio) | Piano B: primo commento senza link; bio → raw GitHub del Radar |
| mer 28/10 8:00 | Carosello post 2, id 397523286 | /radar/ nel primo commento | Piano B |
| mer 28/10 12:00 | Short YouTube, id 402755347 | /guide/ nel testo | Piano B: testo con link raw GitHub |
| gio 29/10 12:00 | Video A1 soc 402780798 / bio 402780811 | articolo, /guide/ | Piano B |
| ven 30/10 8:00 | Post 3, id 397523716 | /contatti/ (200) | Nessun rischio |
| V0 lancio Radar | non programmato | /radar/ online | Si programma il giorno in cui /radar/ risponde 200 |

Il piano B è `scratchpad hg/fallback.py`, applicato dal controllo automatico di sabato 24/10 alle 10:00 solo se /radar/ è ancora 404; Gianluca può chiedere di rinviare invece di applicarlo.

## Cosa serve per chiudere il gate

1. Chi gestisce l'hosting pubblica `pacchetto-sito-mirt.zip` (tutto insieme). Dopo: ripetere G01-G07 e N01.
2. Gianluca nomina chi risponde ai commenti dal 26/10.
3. Gianluca conferma la formulazione delle biografie (F07).
4. Facoltativo ma consigliato prima che arrivi traffico: costruire /diagnosi/, /grazie/, /servizi/ e il tracciamento lead con `PROMPT-FUNNEL.md`.
