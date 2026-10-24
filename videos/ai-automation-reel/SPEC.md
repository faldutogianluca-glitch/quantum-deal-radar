# SPEC — Reel "Automazione AI per aziende"

GOAL:    l'imprenditore si riconosce nel problema (3 ore al giorno di copia-incolla),
         vede l'agente AI risolverlo in pochi secondi e commenta la parola chiave per avere lo schema.
OUTPUT:  HyperFrames, 1080 x 1920 (9:16), 30 fps, MP4
TIME:    25 s x 30 fps = 750 frame. Nessuna musica di sottofondo: l'audio di tendenza
         si aggiunge in app (TikTok/Reels premiano i suoni trending). SFX solo su azioni visibili.

LOOK:    neo-brutalista da etichetta industriale.
         ground #FFD400 (giallo segnaletica, piatto, nessun gradiente) / #FFFFFF nella demo;
         ink #0D0D0D per ogni parola e ogni bordo (6 px);
         accent #FF3D00, una sola parola per inquadratura (il numero, "AI", la parola chiave);
         card bianche, bordo 6 px ink, ombra dura 12 px 12 px 0 ink, raggio 0;
         display Archivo Black, tracking -0.02em, 96-260 px; body Inter 600/800, 34-44 px.

OBJECTS: email = card bianca con mittente, oggetto e riga di anteprima grigia;
         agente AI = blocco nero con etichetta "AGENTE AI" e barra di avanzamento accent;
         gestionale = tabella con intestazione nera e righe che si riempiono.

MOTION:  arrivi expo.out / power4.out 0.4-0.6 s; uscite power3.in, 40-50 % piu' brevi;
         stagger parole 0.08 s; card in caduta back.out(1.4) (rimbalzo solo sulla posizione);
         flood di colore power2.inOut 0.4 s; titoli fermi dopo l'atterraggio.

SHOTS:   f0-90    HOOK   testo gia' in campo al frame 0 (thumbnail). "3 ORE" in accent, punch-in a 0.5 s.
         f90-240  PROBLEMA 7 email cadono e si accumulano, contatore 0 -> 127,
                  "Copia. Incolla. Ripeti." parola per parola. pop sulle card.
         f240-300 SVOLTA flood bianco, "Poi abbiamo collegato un agente AI." whoosh.
         f300-525 DEMO email -> agente -> campi estratti -> riga nel gestionale,
                  poi righe a raffica e contatore 1 -> 127 "in 47 secondi". tick sui campi.
         f525-630 PAYOFF flood giallo, riser -> impatto, "-15 ORE a settimana. Per persona."
         f630-750 CTA "Vuoi lo schema? Commenta AUTOMAZIONE", tiene >= 2 s.

SAFE:    tutto il testo tra y 168 e y 1330, x 80-940 (niente sotto la colonna di azioni a destra).

BANNED:  fondo scuro con elementi piccoli al centro; glow, neon, particelle; gradienti viola/blu,
         glass card; tutto centrato; tutto che entra in fade+slide-up; titoli che si muovono mentre si leggono;
         logo nell'angolo; tre card in fila / griglie KPI; emoji (il font di render non le garantisce).

QA:      f0 (hook leggibile senza audio), f150 (pila email + contatore), f270 (svolta),
         f390 (campi estratti), f500 (127 in 47 s), f600 (payoff), f740 (CTA).

VARIANTI: ogni testo chiave e' una variabile del root (`data-composition-variables`):
          `variants.json` + `npm run render:variants` genera un MP4 per riga (test A/B degli hook).
