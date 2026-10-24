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

Il messaggio delle 7:00 usa dati reali del 24/10/2026: annunci del PVP con la base d'asta
ufficiale e lo sconto sul valore OMI della zona calcolato da Deal Radar (dettagli e numeri in
`SPEC.md`). Per un giorno diverso, dalla radice del repo: `npm run scrape`, `npm run enrich`,
`npm run omi -- quotazioni --geopoi`, `npm run enrich`; poi aggiorna in `variants.json` (o nei
default di `index.html`) `proof_msg`, `deal{1,2,3}_title`, `deal{1,2,3}_detail`,
`deal{1,2,3}_badge` e la data in `proof_note`. Gli sconti mostrati sono quelli che il sistema
ha calcolato davvero, mai arrotondati verso l'alto.

Variabili: `hook_a`, `hook_b`, `hook_sub`, `stamp`, `proof_title`, `proof_msg`,
`deal{1,2,3}_title`, `deal{1,2,3}_detail`, `deal{1,2,3}_badge`, `proof_note`, `s1_a`, `s1_b`,
`s2`, `s3`, `s4`, `cta_keyword`. Hook, timbro e parola chiave
si ridimensionano da soli per restare su una riga.

## Audio

Solo effetti sonori (Pixabay Content License, `assets/sfx/CREDITS.md`). Il suono di tendenza si
aggiunge in app.
