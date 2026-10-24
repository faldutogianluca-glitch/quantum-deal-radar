# Reel "Mi hanno beccato" — Deal Radar (HyperFrames)

Reel verticale 1080x1920, 30 fps, 28 s, ricavato dal reel virale di Samuel Leeds "Comment BBC"
(75.100 view, 2.805 commenti): stessa meccanica (hook-scandalo, prova, "segreto scorretto",
CTA in psicologia inversa), contenuto nostro (agente AI sulle aste + valori OMI). La tabella di
reverse engineering e il brief sono in `SPEC.md`.

## Comandi

```bash
npm run check            # lint + layout + contrasto + tempi di lettura
npm run dev              # anteprima/Studio nel browser
npm run render           # renders/reel.mp4
npm run render:variants  # un MP4 per ogni riga di variants.json (test A/B degli hook)
```

## Prima di pubblicare

Gli annunci nel messaggio delle 7:00 sono di esempio (e il video lo dice). Mettici un digest vero
di Quantum Deal Radar: in `variants.json` imposta `deal1_title`, `deal1_detail`, `deal1_pct` (e 2, 3)
e, se i dati sono reali, togli l'etichetta con `"proof_note": ""`.

Variabili: `hook_a`, `hook_b`, `hook_sub`, `stamp`, `proof_title`, `deal{1,2,3}_title`,
`deal{1,2,3}_detail`, `deal{1,2,3}_pct`, `proof_note`, `cta_keyword`. Hook, timbro e parola chiave
si ridimensionano da soli per restare su una riga.

## Audio

Solo effetti sonori (Pixabay Content License, `assets/sfx/CREDITS.md`). Il suono di tendenza si
aggiunge in app.
