# SPEC — Reel "Mi hanno beccato" (Deal Radar)

## Reverse engineering del modello

Modello: Samuel Leeds, reel "Comment BBC" (Instagram, 21/10/2026)
https://www.instagram.com/reel/Dew2kcvudM3/ — 75.100 view, 1.450 like, 2.805 commenti
(3,7 commenti ogni 100 view: la CTA lavora molto piu' del contenuto).

| Meccanica del modello                                        | Come la riusiamo                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Hook "scandalo": "The BBC just exposed me yet again" + testo | "Mi hanno beccato. Di nuovo." + timbro COLPEVOLE                 |
| Prova di terzi (spezzone Panorama) che rompe il ritmo        | Il messaggio delle 7:00 con 3 immobili veri da Reperform         |
| Strategia spiegata come un "segreto scorretto", sarcastico   | Agente AI che legge le aste di banche e leasing, segna le deserte |
| Finta vergogna ("I feel so ashamed")                         | "Lo so. E' scorretto. Mi vergogno tantissimo. (no.)"             |
| CTA in psicologia inversa ("non fatelo... ho la lista")      | "Non fatelo anche voi... ma poi lo usereste. Commenta RADAR"     |

Cosa NON copiamo: il volto in auto (100 s di parlato) e lo spezzone TV vero. Qui il formato e'
motion graphics da 28 s; la prova e' l'output del nostro prodotto, non un finto servizio tv.

## Brief

GOAL:    l'investitore/developer pensa "lo voglio anch'io" e commenta RADAR.
OUTPUT:  HyperFrames, 1080 x 1920, 30 fps, MP4. TIME: 28 s = 840 frame. Solo SFX, audio trending in app.
LOOK:    stesso sistema del reel "Automazione AI" (serie riconoscibile): ground #FFD400, ink #0D0D0D,
         accent #D93000 una parola per inquadratura, card bianche bordo 6 px + ombra dura 12 px;
         Archivo Black display, Inter body. Il timbro COLPEVOLE e' l'unico elemento ruotato.
OBJECTS: messaggio WhatsApp-like (intestazione mittente + ora, righe affare con sconto in evidenza);
         timbro rettangolare con bordo 10 px.
MOTION:  come SPEC del primo reel; il timbro "sbatte" (scale 2.2 -> 1 in 0.25 s, power4.out) con impatto.

SHOTS:   f0-96    HOOK    "Mi hanno beccato." gia' in campo al frame 0; timbro a 0.9 s.
         f96-270  PROVA   "Ogni mattina, alle 7:00" + messaggio con 3 aste e sconti che contano.
         f270-495 SEGRETO flood bianco, 4 righe: aste di banche e leasing / deserte / solo occasioni / prima delle agenzie.
         f495-600 VERGOGNA flood giallo, "Lo so. E' scorretto." + "(no.)".
         f600-840 CTA     psicologia inversa, chiave RADAR, tiene 3.4 s.

SAFE:    testo tra y 168 e 1330, x 80-940.
BANNED:  quelli del primo reel + finti loghi di testate/tv, dati presentati come reali senza etichetta.
QA:      f0, f45 (timbro), f165 (3 immobili reali), f420 (4 righe), f570 (no.), f820 (CTA).

DATI:    il messaggio usa dati reali del 24/10/2026: annunci del Portale delle Vendite Pubbliche
         (base d'asta ufficiale) confrontati con le quotazioni OMI della zona (Agenzia delle
         Entrate - OMI, semestre 2026-1), valore centrale = media della forbice min/max per i mq
         dichiarati nell'annuncio. Roma, via Caraglio 23, app. 83,5 m2, zona E27 (1.650-2.300 EUR/m2):
         108.000 vs 164.992 = -35%. Osio Sotto (BG), autorimessa 35 m2, zona B1 (quotazione Box):
         13.280 vs 20.125 = -34%. Satriano (CZ), abitazione 154 m2, zona E1: 119.618 vs 164.010 = -27%.
         Ogni stima e' su una sola base (OMI), senza perizia: il sistema la segnala come "stima singola".
         Totale in DB: 121 immobili (70 PVP + 51 Reperform).
