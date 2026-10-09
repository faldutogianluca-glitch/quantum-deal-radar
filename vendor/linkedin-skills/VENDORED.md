# linkedin-skills (vendored)

Copia di https://github.com/sergebulaev/linkedin-skills, versione 1.1.19 (commit `bfa41ff`), licenza MIT.

- Le 12 skill sono esposte a Claude Code tramite symlink in `.claude/skills/`.
- `.claude/references` punta a `references/` qui, perché le skill la citano come `../../references/...`.
- Gli helper Python (`lib/`) si importano come `lib.*` lanciando Python da questa cartella:
  `cd vendor/linkedin-skills && pip install -r requirements.txt`.
- Le chiavi opzionali (APIFY_TOKEN, Publora, Pixfaro) vanno in un `.env` copiato da `.env.example` (già in `.gitignore`).

Per aggiornare: riclonare l'upstream e ricopiare `skills/`, `lib/`, `references/`.
