---
format: 1080x1920
duration: 27s
message: "Quantum Re seleziona e compra immobili e crediti con un metodo rigoroso, basato sui numeri."
arc: hook → product intro → method → selectivity → payoff → CTA (cutdown of the approved 4:5 method film)
audience: pubblico professionale del real estate
mode: autonomous
music: none
language: it
---

## Video direction

Same as the approved 9:16 partner film (../quantumre-promo-9x16/STORYBOARD.md § Video direction): white canvas, navy #1B307C, orange #E07430 on white (#EB7A32 on navy), Playfair Display + Inter, power3 eases, reveals ~1s apart, held reads. Safe area y 230–1500, x 80–940. Headlines ≥120px. Fonts assets/fonts/*.woff2, GSAP assets/vendor/gsap.min.js.

## Frame 1 — Hook

- scene: "Nel real estate / il margine si fa / all'acquisto."
- duration: 4s
- transition_in: cut
- status: outline
- src: compositions/frames/01-hook.html
- blueprint: kinetic-type-beats (Reproduce)
- type: hook
- asset_candidates:
- reference: ../quantumre-investitori/compositions/frames/01-hook.html

Port of the approved 4:5 frame to 1080x1920, retimed to 4s: first two lines rise 0.1 / 0.6s, "all'acquisto." slams in orange at 1.8s, underline at 2.2s, hold.

## Frame 2 — Selezioniamo e compriamo

- scene: Foto, logo, "Selezioniamo e compriamo immobili e crediti.", pill
- duration: 5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-intro.html
- blueprint: logo-assemble-lockup (Adapt)
- type: product_intro
- asset_candidates: assets/hero-clean.jpg — foto hero; assets/logo-quantumre.svg — logo

Reused from the approved 9:16 partner film with the method headline.

## Frame 3 — Il metodo

- scene: "Ogni deal passa da tre filtri." + Selezione · Analisi · Offerta
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/03-metodo.html
- blueprint: grid-card-assemble (Reproduce)
- type: feature_showcase
- asset_candidates:

Reused from the approved 9:16 partner film with the method copy.

## Frame 4 — Molti no, pochi sì

- scene: Griglia di casette che si spengono, ne restano poche in arancio; "Diciamo molti no. Per dire sì solo ai deal che stanno in piedi."
- duration: 6s
- transition_in: cut
- status: outline
- src: compositions/frames/04-selezione.html
- blueprint: compose
- type: benefit_highlight
- asset_candidates:
- reference: ../quantumre-investitori/compositions/frames/05-selezione.html

Port of the approved 4:5 frame to 1080x1920, retimed to 6s: grid in 0–1.2s (grid taller: 8 cols x 10 rows, ~80% width), fade-out + "Diciamo molti no." 1.3–3.2s, orange survivors pop ~3.0s, closing lines 3.4s, hold.

## Frame 5 — Solo numeri

- scene: Fondo navy: "Niente intuito. / Niente azzardi. / Solo numeri."
- duration: 3s
- transition_in: crossfade
- status: outline
- src: compositions/frames/05-numeri.html
- blueprint: kinetic-type-beats (Adapt)
- type: benefit_highlight
- asset_candidates:
- reference: ../quantumre-investitori/compositions/frames/06-benefit.html

Port of the approved 4:5 frame to 1080x1920, retimed to 3s: first two lines (60% white) 0.1 / 0.5s, "Solo numeri." with "numeri." orange at 1.1s, rule at 1.5s, hold.

## Frame 6 — CTA

- scene: Logo, "Scopri come lavoriamo.", "Il metodo Quantum Re.", pill quantumre.it, two small notes
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/06-cta.html
- blueprint: kinetic-type-beats (Reproduce)
- type: cta
- asset_candidates: assets/logo-quantumre.svg — logo

Reused from the approved 9:16 partner CTA with the method copy and both notes.
