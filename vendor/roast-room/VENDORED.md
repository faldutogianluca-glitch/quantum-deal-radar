# roast-room (vendored)

Copia di https://github.com/nateherkai/roast-room (commit `f5e7b63`, 12/10/2026), licenza MIT.
Sette advisor simulati (Bezos, Paul Graham, Hormozi, Gary Vee, Dan Martell, Gino Wickman, Buffett)
dibattono una decisione di business e restituiscono un verdetto con punteggi.

- La skill è esposta a Claude Code con un symlink in `.claude/skills/roast-room`, i sette agenti
  con symlink in `.claude/agents/council-*.md`.
- Uso: `/roast-room <decisione>` (oppure `--quick`, `--seats hormozi,buffett`, `ask hormozi ...`).
- La room (facoltativa) si avvia dalla root con `npm run roast-room` e si apre su http://localhost:4730.
  Zero dipendenze, ascolta solo su 127.0.0.1, non chiama l'AI se non con `COUNCIL_RUNNER=api` nel `.env`.
- Unica modifica all'upstream: la skill salva i consigli in `vendor/roast-room/sessions/` invece che in
  `sessions/` alla root (`SKILL.md` righe 11 e 37, `references/report-template.md` riga 3), perché è
  lì che la room li legge. I consigli restano fuori da git (`.gitignore` di questa cartella), tranne
  i tre esempi.
- I permessi che l'upstream metteva nel suo `.claude/settings.json` sono in quello della root.

Per aggiornare: riclonare l'upstream, ricopiare tutto tranne `.git` e riapplicare le tre modifiche ai path.
