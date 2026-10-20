# quantum-deal-radar

Repository di Quantum Re S.r.l. (Gianluca Falduto, "Pitágora"). Tre aree:

| Cartella | Cosa contiene | Istruzioni |
|---|---|---|
| `packages/`, `data/` | App Quantum Deal Radar: monitoraggio aste e REOCO, zone OMI, valutazione (TypeScript, npm workspaces) | `README.md` |
| `marketing/`, `videos/` | Piano social: post, caroselli, immagini, video HyperFrames, calendario Metricool (`marketing/calendario-pubblicazioni.json`), anteprime | `marketing/piano-editoriale-linkedin.md` |
| `funnel/` | Funnel e Osservatorio: newsletter "Immobili in Movimento", "La casa in pillole", voce LinkedIn, sourcing | `funnel/CLAUDE.md` |

Le skill sono in `.claude/skills/`. Quelle di Quantum Re sono `qre-*`, `perizia-analyzer`, `li-post`, `li-human` e `li-dm`. Le skill `hyperframes*` servono per i video, le `linkedin-*` per i contenuti LinkedIn.

## Regole comuni

- Nessuna pubblicazione e nessun invio senza conferma di Pitágora. I numeri non si inventano mai: dove mancano si usano segnaposto `{{...}}`.
- Ogni testo pubblico (post, pillole, newsletter, didascalie dei video) porta la nota AI, scritta così: "Contenuto generato con AI sotto la supervisione di Gianluca Falduto." Nei video va anche nella card finale.
- Ogni video con parlato (avatar HeyGen compresi) esce con i sottotitoli in italiano impressi nel video. In HeyGen si attivano prima di generare; se l'MP4 arriva senza, si aggiungono qui prima della pubblicazione.
- Compliance: nei contenuti pubblici niente inviti a investire, rendimenti, capitale, club deal o co-investimento.
- Libro "La tua casa non entra nella tomba" (nuda proprietà): ogni post o video che ne deriva porta il link d'acquisto https://www.amazon.it/dp/B0GW41L8J8 e manda i proprietari su https://valutazione.quantumre.it/ (senza www) (regole e verifiche in `marketing/libro-nuda-proprieta/analisi-libro.md`). L'aneddoto dell'investimento in Quantum RE (p. 208) e i rendimenti del libro non vanno mai nei contenuti pubblici.
- Il repository è pubblico, quindi qui non vanno dati personali di terzi, link al CRM o dettagli identificativi degli immobili.
