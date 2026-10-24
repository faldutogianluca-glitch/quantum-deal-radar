# quantum-deal-radar

Radar per opportunità immobiliari da fonti pubbliche (TypeScript/Node in `packages/`, skill e plugin di Claude Code in `.claude/` e `vendor/`).

## Skill: usa sempre quelle giuste

Prima di un compito specializzato (dominio, strumento o workflow specifico):

1. **Controlla le skill già installate** e usa quella più adatta. Disponibili: plugin marketing, sales, small-business, finance, productivity, `anthropic-skills:*`, skill LinkedIn in `.claude/skills/`, ECC curato (`ecc:*`, vedi `vendor/ecc/CURATION.md`).
2. **Se nessuna copre il compito**, cerca con la skill `find-skills` (`npx skills find <query>`).
3. **Verifica prima di proporre**: installazioni (preferibilmente 1K+), fonte affidabile, stelle del repo, e leggi il `SKILL.md` e gli eventuali script.
4. **Proponi e chiedi conferma** all'utente: non installare mai una skill di terze parti senza il suo ok.
5. **Installa a livello di progetto**, non con `-g`: copia la skill in `.claude/skills/<nome>/` e fai commit (il container cloud è effimero, le installazioni globali si perdono).
6. **Evita doppioni**: non aggiungere una skill che replica una già installata; se una nuova è migliore, proponi di sostituire la vecchia.

## Ispezionare i portali (playwright-cli)

Per studiare la struttura di un portale prima di scriverne la config in `packages/scrapers/sites/*.json` usa la skill `playwright-cli`. Il comando non resta installato tra una sessione cloud e l'altra:

```bash
npm i -g @playwright/cli@0.1.22
playwright-cli --config .playwright/cloud.config.json open <url>   # nel cloud: usa il Chromium in /opt/pw-browsers
```

In locale ometti `--config` (usa Chrome installato). Rispetta `robots.txt` e i limiti dei siti, come fa `packages/scrapers/src/robots.ts`.
