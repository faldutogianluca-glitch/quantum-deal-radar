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
- Ogni contenuto generato con AI porta la nota AI. Lo standard è ancora da unificare: vedi `funnel/CLAUDE.md`.
- Compliance: nei contenuti pubblici niente inviti a investire, rendimenti, capitale, club deal o co-investimento.
- Il repository è pubblico, quindi qui non vanno dati personali di terzi, link al CRM o dettagli identificativi degli immobili.
