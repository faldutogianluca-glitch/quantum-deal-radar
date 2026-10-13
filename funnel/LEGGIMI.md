# Come partire con Claude Code

1. Scompattate lo zip in una cartella, per esempio `Documenti/quantum-re`.
2. Se Claude Code non è installato, seguite la guida ufficiale: https://docs.claude.com/en/docs/claude-code/setup
3. Aprite il terminale nella cartella e lanciate `claude`.
4. Claude legge da solo `CLAUDE.md` (ruolo, regole, buy box, stile) e trova le skill in `.claude/skills/`. La cartella `.claude` è nascosta: su Mac la vedete con Cmd+Maiusc+punto.
5. Per controllare che le skill siano caricate, scrivete `/skills`. Prima richiesta di prova: "Leggi docs/linkedin-log.md e dimmi a che punto sono le pillole".

## Cosa c'è dentro

- `CLAUDE.md`: istruzioni del progetto "Funnel Quantum RE".
- `docs/`: gli 8 documenti del progetto (voce, registro, newsletter 36 e 37, post, outreach servicer/SGR).
- `assets/logo/`: i 5 file del logo.
- `.claude/skills/`: li-post, li-human, li-dm, qre-deal-screening, qre-funnel-review, qre-intake-segnalazioni, qre-kit-credibilita, qre-partner-outreach, perizia-analyzer.
- `scripts/immagini_pillole.py` e `output/immagini/`: lo script delle immagini dark-gold e le immagini delle pillole n. 4–6.

## Cosa non c'è

- I connettori (HubSpot, Gmail, Google Drive, ClickUp) non passano con lo zip: in Claude Code vanno aggiunti come server MCP (`claude mcp add`).
- La memoria di claude.ai e le attività programmate restano su claude.ai.
