---
format: 1080x1920
duration: 16s
message: "Con il voucher regionale, un corso di AI da 1.500 euro costa 150 euro a un'agenzia fino a 9 addetti."
arc: hook → svolta → risposta → CTA
audience: agenti immobiliari, imprese edili e studi tecnici in Lombardia
mode: collaborative
music: none
language: it
---

## Video direction

Stesso stile dei video Quantum RE approvati (../quantumre-promo-9x16): fondo bianco, navy #1B307C, arancio #E07430 su bianco (#EB7A32 su navy), Playfair Display + Inter da assets/fonts, GSAP da assets/vendor. Ease power3, una cosa nuova alla volta, letture tenute. Area sicura Reels/TikTok: y 230–1500, x 80–940. Titoli ≥ 110px. Senza audio: il video si legge senza suono.
Ogni video chiude con la nota "Contenuto generato con AI sotto la supervisione di Gianluca Falduto." nella card finale. Niente loghi di Regione, UE o FSE+.

## Frame 1 — Hook

- scene: Etichetta "Esempio" + "Un corso di AI da 1.500 €."
- duration: 3s
- transition_in: cut
- status: outline
- src: compositions/frames/01-hook.html
- blueprint: kinetic-type-beats

Il prezzo è un esempio uguale al tetto del voucher: l'etichetta lo dice.

## Frame 2 — Il conto

- scene: Barra che si riempie al 90% con "voucher regionale"; contatore 1.500 € → 150 €; "per agenzie fino a 9 addetti e professionisti"
- duration: 4.5s
- transition_in: cut
- status: outline
- src: compositions/frames/02-il-conto.html
- rules: stat-bars-and-fills, counting-dynamic-scale

Il 150 arancio arriva alla fine e resta.

## Frame 3 — Le condizioni

- scene: Tre righe: corso a Catalogo con ente accreditato · almeno il 75% delle ore · contributo a corso finito; sotto: 70% da 10 a 50 addetti, 50% oltre
- duration: 4s
- transition_in: crossfade
- status: outline
- src: compositions/frames/03-le-condizioni.html
- rules: waterfall-entry

Onestà sulle regole: niente "gratis".

## Frame 4 — CTA

- scene: "Edizione per l'immobiliare" + pillola "Commentate CORSO" + "Il prezzo del corso arriva con le date." + nota AI
- duration: 4.5s
- transition_in: cut
- status: outline
- src: compositions/frames/04-cta.html
- blueprint: cta-morph-press

Tenuta lunga sulla pillola.

