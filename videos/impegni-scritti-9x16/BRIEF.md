# Impegni scritti: serie avatar (9:16 e 4:5)

Quattro video, uno per impegno di Quantum RE verso chi segnala un immobile: 48 ore, 7-10 giorni, zero rinegoziazioni, il cliente resta tuo. I copioni sono quelli approvati in `marketing/video-avatar/impegni-scritti.md`.

- **Avatar:** HeyGen, look 2 (felpa nera), con la voce clonata di Gianluca Falduto. Generati via API il 20/10/2026 in 1080×1920.
- **Stile:** lo stesso della pillola sulla caparra (dark-gold), scelto da Pitágora il 20/10/2026 perché è il video più visto su TikTok. Le correzioni vengono dall'analisi in `marketing/analisi-tiktok-2026-10.md`:
  - titolo d'aggancio già nel fotogramma 0;
  - volto sempre visibile, in un riquadro tondo durante le schede;
  - sottotitoli al 67% dell'altezza, fuori dalla descrizione di TikTok;
  - riquadri che non spezzano le parole;
  - voce a −14 LUFS.
- **Sottotitoli:** impressi nel video, parola per parola, con la parola detta in oro. Il testo viene dal copione approvato e i tempi dalla trascrizione (Parakeet, italiano), allineati parola per parola. Così "Quantum RE", "rogito" e "7-10" escono scritti giusti anche dove la trascrizione sbaglia.
- **Card finale:** logo, impegno, valutazione.quantumre.it e "Video con avatar AI di Gianluca Falduto. Contenuto generato con AI sotto la supervisione di Gianluca Falduto."
- **Generatore:** `genera.py` scrive `index.html` dell'episodio N in tutti e due i progetti. I render sono in `renders/impegni-scritti-N-{9x16,4x5}.mp4`.

**Sorgenti non salvati nel repository** (troppo pesanti, si riscaricano con `GET /v3/videos/{id}`): video 1 `cf8008daebb79ac1f67c7a69e2772347`, video 2 `8f5dfe96d8cdccc97540ad2123afc7a7`, video 3 `ebfc525cae7232bb7d3c8cea8413e8e7`, video 4 `dd56bb859747f87c680d2e7a579f03bd`. In `assets/avatar/vN.mp4` va la versione muta (`ffmpeg -an`). Le voci, a −14 LUFS, sono nei file `vN-audio.m4a`.
