# Link tracciati verso la pagina di valutazione

Deciso da Pitágora il 22/10/2026. La pagina https://valutazione.quantumre.it/ è una landing HubSpot con il modulo HubSpot nativo e HubSpot Analytics attivo (verificato il 22/10/2026 nel codice della pagina). HubSpot legge i parametri `utm_*` del link di arrivo e li salva sul contatto che compila il modulo: così ogni richiesta di valutazione porta scritta la rete da cui arriva, senza installare altro.

## I link, uno per rete e posizione

| Dove va | Link |
|---|---|
| Bio TikTok | https://valutazione.quantumre.it/?utm_source=tiktok&utm_medium=bio |
| Bio Instagram | https://valutazione.quantumre.it/?utm_source=instagram&utm_medium=bio |
| Primo commento LinkedIn | https://valutazione.quantumre.it/?utm_source=linkedin&utm_medium=comment |
| Testo dei post Facebook | https://valutazione.quantumre.it/?utm_source=facebook&utm_medium=post |
| Descrizione YouTube | https://valutazione.quantumre.it/?utm_source=youtube&utm_medium=description |
| Newsletter Immobili in Movimento | https://valutazione.quantumre.it/?utm_source=newsletter&utm_medium=email |
| Linktree (se usato) | https://valutazione.quantumre.it/?utm_source=linktree&utm_medium=bio |
| Card finale dei video | resta `valutazione.quantumre.it` scritto corto: non è cliccabile, il click arriva dalla bio o dal commento |

Per una campagna specifica si aggiunge `&utm_campaign=` con il nome della serie: `libro`, `impegni-scritti`, `pillole`, `corsi-ai`; per i post del piano senza serie si usa `piano`. Ogni rete ha il proprio `utm_source` (`linkedin`, `facebook`, `instagram`, `tiktok`, `youtube`, `newsletter`): un click da Instagram non si conta mai come Facebook. Un post che esce insieme su più reti con un solo testo non può distinguere le reti: dove il link è cliccabile si crea un post per rete (o si cambia testo per rete), altrimenti si dichiara che la sorgente è aggregata. Regola del 24/10/2026; i post già programmati in Metricool da separare sono in elenco per approvazione, non sono stati modificati.

## Regole

- Nei testi dove il link è solo scritto e non cliccabile (didascalie Instagram e TikTok, card dei video) si tiene la forma corta `valutazione.quantumre.it`: il parametro renderebbe il testo illeggibile e non verrebbe cliccato comunque.
- Dove il link è cliccabile (Facebook, YouTube, primo commento LinkedIn e Instagram, bio, newsletter) si usa sempre la versione tracciata.
- I post già programmati in Metricool sono stati aggiornati con questi link il 22/10/2026: 56 post modificati, 20 senza link cliccabile lasciati come sono (didascalie Instagram e TikTok, post del corso AI). I nuovi post li usano dalla creazione.

## Come leggere i risultati

In HubSpot: Contatti > filtro per proprietà "Original Traffic Source Drill-Down 1/2" oppure per le proprietà `utm_source` e `utm_campaign` del modulo (vanno aggiunte come campi nascosti del modulo, con lo stesso nome dei parametri: HubSpot li compila da solo dall'indirizzo della pagina (passi in `marketing/funnel-completion-checklist.md`)). Report mensile: richieste di valutazione per `utm_source`, confrontate con le visualizzazioni della stessa rete in Metricool.
