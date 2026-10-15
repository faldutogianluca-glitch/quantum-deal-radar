---
format: 1080x1920
duration: 15s
message: "Nel Catalogo regionale ci sono 205 corsi di AI e nessuno per l'immobiliare: Quantum RE prepara l'edizione dedicata."
arc: hook → svolta → risposta → CTA
audience: agenti immobiliari, imprese edili e studi tecnici in Lombardia
mode: collaborative
music: none
language: it
---

## Video direction

Stesso stile dei video Quantum RE approvati (../quantumre-promo-9x16): fondo bianco, navy #1B307C, arancio #E07430 su bianco (#EB7A32 su navy), Playfair Display + Inter da assets/fonts, GSAP da assets/vendor. Ease power3, una cosa nuova alla volta, letture tenute. Area sicura Reels/TikTok: y 230–1500, x 80–940. Titoli ≥ 110px. Senza audio: il video si legge senza suono.
Ogni video chiude con la nota "Contenuto generato con AI sotto la supervisione di Gianluca Falduto." nella card finale. Niente loghi di Regione, UE o FSE+.

## Frame 1 — Hook: 205

- scene: "Corsi di AI nel Catalogo della Regione Lombardia" + contatore 0 → 205
- duration: 3s
- transition_in: cut
- status: built
- src: compositions/frames/01-hook.html
- blueprint: dataviz-countup

Eyebrow in arancio, il numero sale fino a 205 in navy, sotto "corsi di intelligenza artificiale".

## Frame 2 — Il vuoto: 0

- scene: 205 si rimpicciolisce in alto; "Con «immobiliare» nel titolo:" e uno 0 arancio enorme che entra di colpo
- duration: 3.5s
- transition_in: cut
- status: built
- src: compositions/frames/02-il-vuoto.html
- rules: kinetic-beat-slam, scale-swap-transition

È il colpo del video: lo 0 deve arrivare secco e restare 1,5 s.

## Frame 3 — La risposta

- scene: "L'edizione per l'immobiliare" + due blocchi 18 ore online in diretta / 12 ore in presenza a Milano + "Con Creattiva e il suo partner accreditato"
- duration: 4s
- transition_in: crossfade
- status: built
- src: compositions/frames/03-la-risposta.html
- blueprint: grid-card-assemble

I blocchi entrano uno dopo l'altro; sotto, in piccolo, "Voucher regionale fino al 90%".

## Frame 4 — CTA

- scene: Logo, "Commentate CORSO" (pillola navy), "Vi mandiamo programma e conto per la vostra azienda", fonte e nota AI
- duration: 4.5s
- transition_in: cut
- status: built
- src: compositions/frames/04-cta.html
- blueprint: cta-morph-press

Tenuta lunga sulla pillola: è l'azione da fare.

