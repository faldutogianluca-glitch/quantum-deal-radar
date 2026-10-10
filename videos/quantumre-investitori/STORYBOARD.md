---
format: 1080x1350
duration: 42s
message: "Quantum Re seleziona e compra immobili e crediti con un metodo rigoroso: investi con chi compra con i numeri."
arc: hook → problem → product intro → method → selectivity → benefit → CTA
audience: investitori privati e professionali, family office
mode: collaborative
music: none
language: it
---

## Video direction

Identical to the approved partner film (../quantumre-promo/STORYBOARD.md § Video direction): white canvas with navy top bar, navy #1B307C headlines, ONE orange accent #E07430 on white (#EB7A32 on navy), Playfair Display display + Inter body, power3 long-tail eases, one spring-pop payoff per frame, reveals paced to reading time (~1.2–1.6s per line), every frame ends on a held read. Frames 3 and 6 are the navy "inverted" frames. Content in the top ~83%, ≥6% side margins. No invented numbers, no return promises, no stock gradients, no shadows. Fonts: assets/fonts/*.woff2; GSAP: assets/vendor/gsap.min.js.

## Frame 1 — Hook: il margine si fa all'acquisto

- scene: Frase serif grande; la parola chiave "all'acquisto" arriva in arancio
- duration: 5s
- transition_in: cut
- status: outline
- src: compositions/frames/01-hook.html
- blueprint: kinetic-type-beats (Reproduce)
- type: hook
- asset_candidates:
- on_screen: "Nel real estate" · "il margine si fa" · "all'acquisto."
- reference: ../quantumre-promo/compositions/frames/01-hook.html (same type system and line-by-line rise)

Scene 1 (0.0–2.6s): white field, navy top bar. "Nel real estate" / "il margine si fa" rise in line by line, Playfair h1 navy, left-aligned upper-middle.
Scene 2 (2.6–5.0s): "all'acquisto." slams in on its own line in orange; an orange underline draws under it; hold.

## Frame 2 — Problem: le occasioni vere sono difficili da trovare

- scene: Tre parole-chiave che arrivano e poi la riga "Ma servono metodo, tempo e rete."
- duration: 6s
- transition_in: cut
- status: outline
- src: compositions/frames/02-problem.html
- blueprint: kinetic-type-beats (Adapt — three tokens then payoff line)
- type: pain_point
- asset_candidates:
- on_screen: "Aste." · "Crediti NPL/UTP." · "Off-market." · "Le occasioni ci sono." · "Ma servono metodo, tempo e rete."
- reference: ../quantumre-promo/compositions/frames/02-pain.html (same slam-alone rhythm)

Scene 1 (0.0–2.4s): "Aste." / "Crediti NPL/UTP." / "Off-market." each slam in alone, centred, Playfair h1 navy, ~0.8s apart (each replaces the previous).
Scene 2 (2.4–3.8s): "Le occasioni ci sono." rises in, Playfair h2 navy.
Scene 3 (3.8–6.0s): "Ma servono metodo, tempo e rete." rises in beneath, with "metodo, tempo e rete" in orange; hold.

## Frame 3 — Quantum Re seleziona e compra

- scene: Foto hero con velatura navy, logo che si compone, riga "Selezioniamo e compriamo immobili e crediti."
- duration: 6s
- transition_in: crossfade
- status: outline
- src: compositions/frames/03-intro.html
- blueprint: logo-assemble-lockup (Adapt)
- type: product_intro
- asset_candidates: assets/hero-clean.jpg — foto hero pulita; assets/logo-quantumre.svg — logo Quantum Re
- on_screen: logo · "Selezioniamo e compriamo" / "immobili e crediti." · pills "Aste" · "NPL/UTP" · "Off-market"
- reference: ../quantumre-promo/compositions/frames/03-intro.html (reuse it: identical shot, only the headline copy changes)

Same shot and timing as the approved partner frame 03-intro; only the headline changes.

## Frame 4 — Il metodo

- scene: Eyebrow "IL METODO", titolo, tre card numerate: Selezione · Analisi · Offerta
- duration: 7s
- transition_in: cut
- status: outline
- src: compositions/frames/04-metodo.html
- blueprint: grid-card-assemble (Reproduce)
- type: feature_showcase
- asset_candidates:
- on_screen: eyebrow "IL METODO" · "Ogni deal passa da tre filtri." · 01 "Selezione" — "Criteri chiari su zona, tipologia e prezzo" · 02 "Analisi" — "Perizia, valori OMI e comparabili" · 03 "Offerta" — "Prezzo massimo motivato, mai al rialzo"
- reference: ../quantumre-promo/compositions/frames/04-criteri.html (same cards and timing, new copy)

Same shot and timing as the approved partner frame 04-criteri, with this copy.

## Frame 5 — Molti no, pochi sì

- scene: Griglia di quadratini (immobili analizzati) che si spengono uno a uno; restano pochi quadratini arancio; riga finale
- duration: 7s
- transition_in: cut
- status: outline
- src: compositions/frames/05-selezione.html
- blueprint: compose
- type: benefit_highlight
- asset_candidates:
- on_screen: "Diciamo molti no." · "Per dire sì solo ai deal" · "che stanno in piedi."

Scene 1 (0.0–1.6s): white field; a grid of ~10x8 small navy outlined house icons (or rounded squares) fills the upper half, appearing row by row (waterfall). Centred, ~75% width.
Scene 2 (1.6–3.8s): "Diciamo molti no." rises in under the grid (Playfair h2 navy) as most tiles fade to light grey one after another in a deterministic scattered order; ~6 tiles remain and turn solid orange with a small spring-pop.
Scene 3 (3.8–7.0s): "Per dire sì solo ai deal" / "che stanno in piedi." rises in, with "che stanno in piedi." in orange; hold. No numbers are shown (the grid is illustrative).

## Frame 6 — Benefit: investi con chi compra con i numeri

- scene: Fondo navy pieno, due righe serif, accento arancio
- duration: 5s
- transition_in: crossfade
- status: outline
- src: compositions/frames/06-benefit.html
- blueprint: kinetic-type-beats (Adapt)
- type: benefit_highlight
- asset_candidates:
- on_screen: "Investi con chi compra" · "con i numeri." 
- reference: ../quantumre-promo/compositions/frames/06-benefit.html (same shot, new copy)

Same shot and timing as the approved partner frame 06-benefit: first line at 60% white, second line white with "con i numeri." in orange and the orange rule.

## Frame 7 — CTA: parliamone

- scene: Logo, "Vuoi investire con noi?", "Parliamone.", pill quantumre.it, riga informativa piccola
- duration: 6s
- transition_in: cut
- status: outline
- src: compositions/frames/07-cta.html
- blueprint: kinetic-type-beats (Reproduce)
- type: cta
- asset_candidates: assets/logo-quantumre.svg — logo Quantum Re
- on_screen: logo · "Vuoi investire con noi?" · "Parliamone." · pill "quantumre.it" · small Inter text-muted line at the bottom of the content area: "Comunicazione informativa. Non costituisce offerta di strumenti finanziari."
- reference: ../quantumre-promo/compositions/frames/07-cta.html (same shot, new copy, retimed to 6s)

Same shot as the approved partner CTA, retimed: logo 0–1.2s, "Vuoi investire con noi?" 1.2s, "Parliamone." (orange) 2.4s, URL pill 3.4s, disclaimer fades in 4.0s, hold, last 0.4s fade to white.
