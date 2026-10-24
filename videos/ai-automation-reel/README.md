# Reel "Automazione AI per aziende" (HyperFrames)

Reel verticale 1080x1920, 30 fps, 25 s, scritto in HTML + GSAP e renderizzato in MP4 con
[HyperFrames](https://github.com/heygen-com/hyperframes). Brief e regole visive in `SPEC.md`.

## Requisiti

Node 22+, FFmpeg. Chromium viene gestito dalla CLI.

## Comandi

```bash
npm run check            # lint + layout + contrasto + tempi di lettura
npm run dev              # anteprima/Studio nel browser
npm run render           # renders/reel.mp4
npm run render:variants  # un MP4 per ogni riga di variants.json (test A/B)
```

## Struttura del video

| Tempo     | Beat     | Cosa succede                                                |
| --------- | -------- | ----------------------------------------------------------- |
| 0-3 s     | Hook     | testo gia' in campo al frame 0 (fa anche da copertina)      |
| 3-8 s     | Problema | 6 email si impilano, contatore 0 -> 127                     |
| 8-10 s    | Svolta   | "Poi abbiamo collegato un agente AI."                       |
| 10-17.5 s | Demo     | email -> agente -> campi estratti -> gestionale, 127 in 47 s |
| 17.5-21 s | Payoff   | "-15 ORE a settimana. Per persona."                         |
| 21-25 s   | CTA      | "Commenta AUTOMAZIONE" (comment-gate)                       |

## Varianti A/B

Tutti i testi chiave sono variabili del root (`data-composition-variables` in `index.html`).
In `variants.json` ogni riga sovrascrive solo i campi che cambia; le chiavi ignote fanno fallire
il render (`--strict-variables`). Numeri e parola chiave si ridimensionano da soli per restare
su una riga, quindi un copy piu' lungo non rompe l'impaginazione.

Variabili: `hook_top`, `hook_number`, `hook_bottom`, `pain_words`, `turn_line`, `demo_seconds`,
`saved_hours`, `saved_sub`, `cta_question`, `cta_keyword`, `cta_promise`.

## Audio

Solo effetti sonori (Pixabay Content License, vedi `assets/sfx/CREDITS.md`), ciascuno legato a
un'azione a schermo. Niente musica di fondo apposta: il suono di tendenza si aggiunge in app su
TikTok/Reels, che spinge i video con audio trending.
