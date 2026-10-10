---
format: 1080x1350
duration: 45s
message: "Hai un immobile da proporre? Quantum Re lo valuta con criteri chiari e ti risponde in 48 ore."
arc: PAS — hook → pain → product intro → feature → feature → benefit → CTA
audience: partner che segnalano immobili (agenti, servicer NPL/UTP, asset manager, curatori, professionisti)
mode: collaborative
music: none
language: it
---

## Video direction

- **Canvas & palette** (from `frame.md`): canvas `bg` white; headlines in `text` navy #1B307C; ONE accent `primary` orange #EB7A32 used only on the key word / number of each frame; `text-muted` #283772 for secondary lines. Frame 3 and Frame 6 are the two "inverted" frames: full navy field with white type and orange accent — they punctuate the white rhythm. A thin navy bar (like the site header) sits at the very top edge of every white frame as brand chrome.
- **Type**: display = Playfair Display (h1/h2, every numeral, the hero lines); body/chrome/eyebrows/pills = Inter. Big, centred-to-left editorial type; one dominant element per scene.
- **Motion grammar**: long-tail eases (power3 default, smooth over bouncy; a single spring-pop allowed on the payoff element of a frame). No voiceover: reveals are paced to READING time — each on-screen line enters on its own cue, roughly one new line per ~1.2–1.6s, spread across the frame; nothing front-loaded. After the last reveal, hold still (a held read beats motion).
- **Rhythm / held frames**: Frame 2 ends on a deliberate held silence ("Nessuna risposta." sits alone ~1.5s). Frame 6 is the breather before the CTA — one slow reveal and a long hold. Frame 5 is the climax (count-up).
- **Safe area**: plan content inside the top ~83% and with ≥ 6% side margins (LinkedIn UI overlays the bottom). No captions (no narration).
- **Negative list**: no stock "AI" gradients, bokeh, glows on white, drop shadows, emoji, fake UI chrome or cursors; no invented numbers/logos/testimonials. Neither failure mode: no slideshow (dump-then-freeze), no screensaver (everything floating independently).

## Frame 1 — Hook: hai un immobile fermo?

- scene: Domanda diretta su fondo bianco; la parola chiave cambia: asta deserta → credito incagliato → cliente che deve vendere
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-hook.html
- blueprint: kinetic-type-beats (Reproduce — in-place token swap)
- type: hook
- asset_candidates:
- focal: headline type
- roles: none
- voiceover: ""
- on_screen: "Hai un immobile che non si muove?" / swap: "Un'asta andata deserta." · "Un credito incagliato." · "Un cliente che deve vendere."

Scene 1 (0.0–1.6s): white field, navy top bar. "Hai un immobile" rises in line by line (Playfair h1, navy), then "che non si muove?" lands with "non si muove?" in orange — left-aligned editorial block in the upper-middle third, ~70% width (kinetic-beat-slam, rise variant).
Scene 2 (1.6–4.2s): the question shrinks up to an eyebrow-sized line at top; below it ONE swap line in Playfair h2 changes in place by hard cut, three times on a steady beat: "Un'asta andata deserta." → "Un credito incagliato." → "Un cliente che deve vendere." (signature move: in-place token swap; same position, same size, only the words change). A small orange underline under the swap line re-draws on each swap (svg-path-draw).
Scene 3 (4.2–5.0s): the last swap holds still.

## Frame 2 — Pain: il dossier che sparisce

- scene: Tre righe brevi che cadono una alla volta, l'ultima in arancio
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/02-pain.html
- blueprint: kinetic-type-beats (Reproduce — pain statements land alone)
- type: pain_point
- asset_candidates:
- focal: "Nessuna risposta."
- roles: none
- voiceover: ""
- on_screen: "Mandi il dossier." · "Aspetti." · "Nessuna risposta."

Scene 1 (0.0–1.3s): "Mandi il dossier." slams in alone, centred, Playfair h1 navy (kinetic-beat-slam, scale-slam).
Scene 2 (1.3–2.6s): it clears; "Aspetti." enters alone, smaller and lighter (text-muted), with three Inter dots ticking after it one by one — waiting made visible.
Scene 3 (2.6–5.0s): it clears; "Nessuna risposta." lands alone in orange, Playfair h1, centred — then nothing moves. Deliberate held silence to the cut.

## Frame 3 — Product intro: Quantum Re compra

- scene: Foto hero del sito (torri col verde) con velatura navy; il logo si compone, sotto la riga "Compriamo immobili e crediti"
- duration: 6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-intro.html
- blueprint: logo-assemble-lockup (Adapt)
- type: product_intro
- asset_candidates: assets/hero-bosco-verticale.jpg — foto hero del sito, torri con verde verticale; assets/logo-quantumre.svg — logo Quantum Re
- focal: assets/logo-quantumre.svg
- roles: assets/hero-bosco-verticale.jpg = background (full-bleed, navy overlay ~70%, very slow push-in) · assets/logo-quantumre.svg = supporting (white plate behind the mark so the navy logo reads on the dark field)
- voiceover: ""
- on_screen: logo Quantum Re · "Compriamo immobili e crediti." · tag: "Aste · NPL/UTP · Off-market"

Adapt: keep the assemble-around-a-fixed-mark signature — the logo's parts build in sequence (navy ring draws, handle extends, orange house outline draws inside, wordmark fades up) — but on a photo field instead of an abstract system, and followed by the value line.
Scene 1 (0.0–2.2s): photo full-bleed under a navy overlay, slow push-in running underneath; a white rounded plate centred in the upper half; on it the logo assembles part by part (svg-path-draw: ring → handle → house → wordmark). Centred, plate ~60% width.
Scene 2 (2.2–3.8s): below the plate, "Compriamo immobili e crediti." rises in, Playfair h2 white.
Scene 3 (3.8–6.0s): three Inter pills arrive left→right under it — "Aste" · "NPL/UTP" · "Off-market" — orange outline, white text (waterfall-entry); then hold.

## Frame 4 — Feature: criteri chiari

- scene: Tre card che si impilano (buy box): Dove · Cosa · A che prezzo
- duration: 7s
- transition_in: cut
- status: animated
- src: compositions/frames/04-criteri.html
- blueprint: grid-card-assemble (Reproduce — accumulating list)
- type: feature_showcase
- asset_candidates:
- focal: the three buy-box cards
- roles: none
- voiceover: ""
- on_screen: eyebrow "CRITERI CHIARI" · titolo "Sai prima cosa cerchiamo." · card: "Dove" / "Cosa" / "A che prezzo"

Scene 1 (0.0–1.8s): white field; orange Inter eyebrow "CRITERI CHIARI" with a short accent line, then "Sai prima cosa cerchiamo." in Playfair h1 navy, left-aligned upper third.
Scene 2 (1.8–5.6s): three full-width tinted cards (card-tinted from frame.md, orange 4% fill / 20% border, no shadow) stack beneath, one every ~1.2s, each popping into its slot and staying (signature: co-resident accumulating list): card 1 — big orange numeral "01", title "Dove", line "Zone e città target"; card 2 — "02", "Cosa", "Residenziale, frazionabili, cambi d'uso"; card 3 — "03", "A che prezzo", "Sconto chiaro sul valore di mercato".
Scene 3 (5.6–7.0s): all three hold; a navy check mark draws at the right of each card in quick sequence (svg-path-draw), then stillness.

## Frame 5 — Feature: risposta in 48 ore

- scene: Il numero 48 conta in grande, poi tre pill di verdetto: GO · WATCH · SCARTA
- duration: 8s
- transition_in: cut
- status: animated
- src: compositions/frames/05-48h.html
- blueprint: dataviz-countup (Adapt — one stat + verdict chips)
- type: feature_showcase
- asset_candidates:
- focal: the "48h" numeral
- roles: none
- voiceover: ""
- on_screen: "48h" · "per una risposta motivata" · pill GO / WATCH / SCARTA · riga: "E se è no, ti diciamo a che prezzo diventa sì."

Adapt: keep the count-up signature on ONE hero stat; instead of a chart, the result is three verdict chips.
Scene 1 (0.0–2.2s): white field; a thin orange progress ring draws around centre while a huge Playfair numeral counts 0→48 inside it, then "h" settles beside it (counting-dynamic-scale + stat-bars-and-fills ring). Centred, ring ~55% of width, upper half.
Scene 2 (2.2–3.4s): "per una risposta motivata" rises under the ring, Inter body large, navy.
Scene 3 (3.4–5.4s): three pills spring-pop in a row below, one by one: "GO" (navy fill, white text), "WATCH" (orange outline), "SCARTA" (muted outline) (spring-pop-entrance).
Scene 4 (5.4–8.0s): the closing line "E se è no, ti diciamo a che prezzo diventa sì." rises in under the pills, Playfair h3 navy with "diventa sì" in orange; hold still to the end.

## Frame 6 — Benefit: un partner che compra davvero

- scene: Riga serif grande su fondo navy pieno, accento arancio
- duration: 5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/06-benefit.html
- blueprint: kinetic-type-beats (Adapt — two-line value payoff, no swap)
- type: benefit_highlight
- asset_candidates:
- focal: "Più operazioni chiuse."
- roles: none
- voiceover: ""
- on_screen: "Meno dossier a vuoto." · "Più operazioni chiuse."

Adapt: two beats instead of a swap — the second line is the payoff.
Scene 1 (0.0–1.8s): full navy field. "Meno dossier a vuoto." rises in, Playfair h1 white at ~60% opacity, left-aligned at middle.
Scene 2 (1.8–5.0s): "Più operazioni chiuse." rises in beneath, Playfair h1 white with "chiuse." in orange; a short orange rule draws under it (svg-path-draw). Long held read — the breather before the CTA.

## Frame 7 — CTA: segnalaci un immobile

- scene: Logo su bianco, invito all'azione e URL; barra navy in basso come sul sito
- duration: 8s
- transition_in: cut
- status: animated
- src: compositions/frames/07-cta.html
- blueprint: kinetic-type-beats (Reproduce — closing line beat by beat, lands on logo + URL)
- type: cta
- asset_candidates: assets/logo-quantumre.svg — logo Quantum Re
- focal: assets/logo-quantumre.svg
- roles: assets/logo-quantumre.svg = supporting (brand sign-off, top-centre)
- voiceover: ""
- on_screen: "Segnalaci un immobile." · "Risposta in 48 ore." · "quantumre.it"

Scene 1 (0.0–1.6s): white field, navy top bar. The logo fades and scales up gently into the top-centre (~55% width) (spring-pop-entrance, soft).
Scene 2 (1.6–3.4s): "Segnalaci un immobile." rises in below the logo, Playfair h1 navy, centred.
Scene 3 (3.4–4.8s): "Risposta in 48 ore." rises in, Inter large, text-muted, with "48 ore" in orange.
Scene 4 (4.8–8.0s): a navy pill button with white Inter text "quantumre.it" presses in (press-release-spring) centred below; hold still to the end. This is the only frame with a real exit: final 0.4s fade to white.
