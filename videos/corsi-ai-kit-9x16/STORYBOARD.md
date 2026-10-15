---
format: 1080x1920
duration: 19s
message: "Cinque istruzioni AI che un'agenzia può usare domattina: il kit completo si chiede commentando KIT."
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

- scene: "5 istruzioni AI per l'agenzia." + "Da usare domattina." in arancio
- duration: 3s
- transition_in: cut
- status: built
- src: compositions/frames/01-hook.html
- blueprint: kinetic-type-beats

Due righe che salgono, la seconda con l'accento arancio.

## Frame 2 — La regola

- scene: Fondo navy: "Prima regola" + "Nell'AI online non si incollano nomi, codici fiscali e documenti dei clienti."
- duration: 3.5s
- transition_in: crossfade
- status: built
- src: compositions/frames/02-la-regola.html
- rules: waterfall-entry

Dà credibilità: prima cosa non fare.

## Frame 3 — Le cinque

- scene: Lista che si compone riga per riga: 1 Annuncio dalla scheda tecnica · 2 Risposta ai portali · 3 Documenti per il rogito · 4 Planimetria e stato dei luoghi · 5 Obiezioni prima della trattativa
- duration: 8s
- transition_in: cut
- status: built
- src: compositions/frames/03-le-cinque.html
- rules: waterfall-entry, svg-path-draw

Una riga ogni ~1,4 s; ogni riga prende la spunta "da controllare" mentre entra la successiva.

## Frame 4 — CTA

- scene: "Il kit completo: 10 istruzioni, dall'incarico al rogito" + pillola "Commentate KIT" + nota AI
- duration: 4.5s
- transition_in: cut
- status: built
- src: compositions/frames/04-cta.html
- blueprint: cta-morph-press

Tenuta lunga sulla pillola.

