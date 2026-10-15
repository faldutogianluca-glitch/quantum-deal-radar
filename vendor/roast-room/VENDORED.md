# roast-room (vendored)

Copia di https://github.com/faldutogianluca-glitch/roast-room (commit `32c035a`, 14/10/2026), il fork in italiano
di https://github.com/nateherkai/roast-room (licenza MIT).
Otto advisor simulati discutono una decisione di business e restituiscono un verdetto con punteggi, in italiano:
Bezos, Paul Graham, Hormozi, Gary Vee, Dan Martell, Gino Wickman, Buffett e Il Veterano (archetipo per immobili,
aste e distressed in Italia, costruito da fonti pubbliche italiane; non è una persona reale).

- La skill è esposta a Claude Code con un symlink in `.claude/skills/roast-room`, gli otto agenti con symlink in
  `.claude/agents/council-*.md`.
- Uso: `/roast-room <decisione>` (oppure `--quick`, `--seats veterano,buffett`, `ask veterano ...`).
- La room (facoltativa) si avvia dalla root con `npm run roast-room` e si apre su http://localhost:4730.
  Zero dipendenze, ascolta solo su 127.0.0.1, non chiama l'AI se non con `COUNCIL_RUNNER=api` nel `.env`.
- Contesto del business: `business.md` (pubblico). I numeri riservati vanno in `business.private.md` in questa
  cartella, che è in `.gitignore` (modello in `business.private.example.md`).
- Modifiche rispetto al fork, solo di percorso, perché qui la skill gira dalla root del monorepo:
  - `SKILL.md`: i consigli si salvano in `vendor/roast-room/sessions/` (dove la room li legge) e il contesto
    si legge da `vendor/roast-room/business.md` e `business.private.md`;
  - `references/report-template.md`: percorso del verbale di esempio.
  I consigli restano fuori da git (`.gitignore` di questa cartella), tranne i tre esempi.
- I permessi che l'upstream metteva nel suo `.claude/settings.json` sono in quello della root.

Per aggiornare: `git archive` del fork (o riclonarlo), ricopiare tutto tranne `.git` e riapplicare le modifiche
di percorso qui sopra.
