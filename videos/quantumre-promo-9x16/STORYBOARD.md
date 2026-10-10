---
format: 1080x1920
duration: 25s
message: "Hai un immobile da proporre? Quantum Re lo valuta con criteri chiari e ti risponde in 48 ore."
arc: hook → product intro → feature → feature → CTA (cutdown of the approved 4:5 partner film)
audience: partner che segnalano immobili
mode: autonomous
music: none
language: it
---

## Video direction

Same as the approved 4:5 film (../quantumre-promo/STORYBOARD.md § Video direction): white canvas, navy #1B307C headlines, single orange accent #E07430 on white (#EB7A32 allowed on navy), Playfair Display display + Inter body, power3 long-tail eases, one spring-pop payoff per frame, reveals paced to reading time, end each frame on a held read. Vertical safe area: key content between y=230 and y=1500, x from 80 to 940 (TikTok/Reels UI covers the top, the bottom ~22% and the right edge). Type is BIGGER than the 4:5 film (phone viewing): headlines ≥ 120px. Faster tempo: ~1s per reveal.

## Frame 1 — Hook

- scene: Domanda + parola che cambia (asta deserta → credito incagliato → cliente che deve vendere)
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-hook.html
- blueprint: kinetic-type-beats (Reproduce — in-place token swap)
- type: hook
- asset_candidates:
- reference: ../quantumre-promo/compositions/frames/01-hook.html

Port of approved frame 01-hook to 1080x1920, same copy and moves, retimed: question builds 0–1.5s, shrinks to eyebrow, three swaps at ~1.6 / 2.6 / 3.6s, hold to 5s.

## Frame 2 — Quantum Re compra

- scene: Foto con velatura navy, logo che si compone, "Compriamo immobili e crediti." + pill Aste · NPL/UTP · Off-market
- duration: 5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-intro.html
- blueprint: logo-assemble-lockup (Adapt)
- type: product_intro
- asset_candidates: assets/hero-clean.jpg — foto hero pulita; assets/logo-quantumre.svg — logo Quantum Re
- reference: ../quantumre-promo/compositions/frames/03-intro.html

Port of approved frame 03-intro to 1080x1920, retimed to 5s: logo draws 0–1.6s, line at 1.8s, pills from 3.0s, hold.

## Frame 3 — Criteri chiari

- scene: "Sai prima cosa cerchiamo." + tre card Dove · Cosa · A che prezzo
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/03-criteri.html
- blueprint: grid-card-assemble (Reproduce)
- type: feature_showcase
- asset_candidates:
- reference: ../quantumre-promo/compositions/frames/04-criteri.html

Port of approved frame 04-criteri to 1080x1920, retimed to 5s: eyebrow+title 0–1.2s, cards at 1.3 / 2.1 / 2.9s, checks 3.8–4.3s, hold. Same card copy.

## Frame 4 — 48 ore

- scene: 48h che conta nell'anello, pill GO / WATCH / SCARTA, "E se è no, ti diciamo a che prezzo diventa sì."
- duration: 6s
- transition_in: cut
- status: animated
- src: compositions/frames/04-48h.html
- blueprint: dataviz-countup (Adapt)
- type: feature_showcase
- asset_candidates:
- reference: ../quantumre-promo/compositions/frames/05-48h.html

Port of approved frame 05-48h to 1080x1920, retimed to 6s: count-up 0–1.6s, subline 1.6s, pills 2.4 / 2.8 / 3.2s, closing line 3.9s, hold.

## Frame 5 — CTA

- scene: Logo, "Segnalaci un immobile.", "Risposta in 48 ore.", pill quantumre.it
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/05-cta.html
- blueprint: kinetic-type-beats (Reproduce)
- type: cta
- asset_candidates: assets/logo-quantumre.svg — logo Quantum Re
- reference: ../quantumre-promo/compositions/frames/07-cta.html

Port of approved frame 07-cta to 1080x1920, retimed to 5s: logo 0–1s, line 1.0s, sub 2.0s, URL pill 2.8s (press at 3.3s), hold, final 0.3s fade to white.
