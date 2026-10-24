# Passaggio alla nuova sessione (16 ottobre 2026)

## Stato
- Metricool, brand "Milano Retail Tour" (id 7459347, Europe/Rome), tutto programmato:
  - Avvio: 17/10 10:00, 19/10, 21/10 (carosello + Short alle 12:00), 23/10 alle 8:00. File in social/2026-10-avvio/.
  - Settimane 1–8: post 1–24 (lun/mer/ven alle 8:00) e Short 1–8 (mer alle 12:00), tranne il post 21.
- Post 21 (ven 11/12): testo in social/2026-12/posts-w7.json, attende i risultati del sondaggio LinkedIn del post 12 (chiude il 27/11). Manca l'immagine mirt-radar-21.jpg.
- Articoli A1–A8 su Drive (cartella "content"), da pubblicare sul sito il lunedì indicato. /radar/ e il PDF devono andare online prima del 28/10.
- Copioni HeyGen di Andrea Bertagnolio (socio fondatore, autorizzato): social/heygen/copioni-andrea.md. Primo video giovedì 29/10 alle 12:00.
- Piano: https://claude.ai/code/artifact/a4633b5e-ef8c-4b06-9471-612c6627ad01

## Attività programmate da ricreare nella nuova sessione
1. Ogni giovedì alle 8:58 (Europe/Rome), nome "MiRT Radar – ricerca settimanale", prompt:

Ricerca settimanale per il piano editoriale "MiRT Radar" di Milano Retail Tour. 1) Cerca le notizie degli ultimi 7 giorni su retail specializzato, innovazione nei negozi e AI applicata al retail (Italia e mondo), aprendo le fonti e annotando data e URL. 2) Scrivi il primo articolo del calendario del piano che non è ancora pronto (o sostituiscilo con una notizia più forte, segnalandolo), in italiano e in inglese, nel formato del sito (milano-retail-tour/sito/content, voci in pages-json-aggiunte.json), con fonti verificate e il riquadro verso il Radar; caricalo anche nella cartella Drive del sito. 3) Scrivi i 3 post della stessa settimana (lunedì, mercoledì carosello, venerdì) con le immagini generate da social/tool/render.mjs nello stile del brand kit, in un posts.json della settimana, e uno Short per YouTube dal carosello con social/tool/shorts.py. 3b) Aggiungi a social/heygen/copioni-andrea.md il copione del video HeyGen della settimana (avatar e voce di Andrea Bertagnolio, socio fondatore, autorizzato): 30-45 secondi, prima persona, numeri in lettere, sovrimpressioni, didascalia con «Video realizzato con avatar AI di Andrea Bertagnolio», pubblicazione il giovedì alle 12:00. Controlla nella cartella Drive del piano (1PL_PG3KPjwooJqEANDvP3O98JRL-mfsu) se Gianluca ha caricato MP4 heygen-NN-*.mp4: per ognuno programmalo su Metricool come Short YouTube (isAiGeneratedContent true) e Reel Instagram e Facebook (isAiGenerated true) alla data del copione, dopo il controllo dei doppioni. 4) Aggiorna il piano editoriale su claude.ai (stato nel calendario e sezioni pronte). 5) Programma su Metricool, brand "Milano Retail Tour" (id 7459347), i post su LinkedIn, Facebook e Instagram alle 8:00 e lo Short su YouTube il mercoledì alle 12:00, controllando prima che non ci siano doppioni. 6) Commit e push sul ramo claude/milano-retail-tour-editorial-3m3toj e riassumi a Gianluca cosa c'è da approvare.

2. Una volta, il 28/11/2026 alle 9:00: chiedere a Gianluca i risultati del sondaggio del post 12, completare il post 21, creare mirt-radar-21.jpg, programmarlo l'11/12 alle 8:00 e aggiornare la riga 21 del piano.

## Video HeyGen di Andrea (aggiornato il 20/10)
- Avatar: foto reali di Andrea nel cortile (look 9269031a per le storie, 3899995b per i trend, 9ed252d9 per il lancio). Voce HeyGen "Andrea" (4e764f2d77d1402481b9e91b8a6d7d25). Impaginazione con social/heygen/tool/impagina.py.
- Programmati su Metricool alle 12:00 su YouTube Short, Instagram Reel, Facebook Reel, TikTok e LinkedIn (flag AI attivi):
  B1 27/10 (400943761), B2 3/11 (400943975), B3 10/11 (400944034), B4 17/11 (400944097), B5 24/11 (400944147),
  B6 1/12 (400944225), B7 8/12 (400944402), B8 15/12 (400944453), A1 29/10 (400944569), A2 5/11 (400944623).
- Pronto ma non programmato: V0 lancio Radar (heygen-b00-radar-lancio.mp4), da pubblicare il giorno in cui /radar/ va online.
- Da fare quando c'è credito API HeyGen: A3–A8 (giovedì 12/11 → 17/12), script in social/heygen/copioni-andrea.md, job in social/heygen/video-jobs.json.
- Se /radar/ e gli articoli non sono online alla data del post, aggiornare i link delle descrizioni con /contatti/.

## Video A3–A8 (programmati 20/10, dopo la ricarica dei crediti API)
Metricool, ore 12:00, YouTube Short + IG Reel + FB Reel + TikTok + LinkedIn:
- A3 commesso aumentato, gio 12/11, ID 401460895
- A4 commercio agentico, gio 19/11, ID 401461286
- A5 regole 2026, gio 26/11, ID 401461354
- A6 flagship Milano, gio 3/12, ID 401461418
- A7 usato e permuta, gio 10/12, ID 401461466
- A8 trend 2027, gio 17/12, ID 401461511
I link puntano agli articoli del blog: devono essere online prima delle date, altrimenti cambiare i testi su /contatti/.

## "Commenta e ricevi" (21/10)
Riga "Commenta <PAROLA> e ti mandiamo…" aggiunta su Metricool a 23 post: 7 post articolo del lunedì (26/10, 2/11, 9/11, 16/11, 23/11, 30/11, 7/12) e 16 video HeyGen (B1–B8, A1–A8).
Parole: AI → guida visibilità AI · COMMESSO → kit commesso · FLAGSHIP → 5 idee flagship · RADAR → MiRT Radar 2027.
Non toccati: caroselli e post 23/10, 14/12, 16/12 (hanno già "Scrivi RADAR"), post Diagnosi/Explore (una sola CTA), Shorts solo YouTube, sondaggio.
Risposte DM e link: `guide/COMMENTA-E-RICEVI.md`. PDF: `sito/download/guide/`.

## Video divisi per rete (22/10)
Ogni video HeyGen ora è due post Metricool alle 12:00:
- IG + FB + LinkedIn: file `heygen-*.mp4`, cartello finale e testo "Commenta <PAROLA>".
- TikTok + YouTube: file `heygen-*-bio.mp4`, cartello finale e testo "Scopri di più: link in bio" (bio → /guide/).
ID in `scratchpad/hg/split-done.txt` (copiato sotto).
B8 (15/12): sistemato il 22/10, post IG/FB/LinkedIn = 402754071, TikTok/YouTube = 402750507.
- B1 soc=402738782 bio=402749362
- A1 soc=402749516 bio=402749538
- B2 soc=402749560 bio=402749576
- A2 soc=402749602 bio=402749636
- B3 soc=402749722 bio=402749767
- A3 soc=402749799 bio=402749820
- B4 soc=402749891 bio=402749910
- A4 soc=402749944 bio=402749961
- B5 soc=402750042 bio=402750065
- A5 soc=402750103 bio=402750126
- B6 soc=402750166 bio=402750201
- A6 soc=402750264 bio=402750291
- B7 soc=402750349 bio=402750380
- A7 soc=402750419 bio=402750455
- B8 soc=DENIED(402047120 still 5 networks) bio=402750507
- A8 soc=402750529 bio=402750556

## Audit e correzioni del 22/10
- Scheduled task ricreati in questa sessione: "MiRT Radar – ricerca settimanale" (trig_01K5uE4mPX1E9KuZiezhuv5J, giovedì 8:58 Rome), "MiRT: risultati sondaggio per il post 21" (trig_01LRotDKEdta17x2z2BqRYzu, 28/11 9:00 Rome), "controllo sito prima del lancio" (trig_0196guDFiPCZFBi6m24iysJi, sabato 24/10 10:00 Rome: se il sito è online programma V0, altrimenti applica scratchpad hg/fallback.py).
- Video v3: audio rigenerato per 15 video (A1–A7, B1–B8) senza "link in descrizione"; chiusura "come riceverlo lo vedi qui sotto". Cartello finale IG/FB/LinkedIn senza "in privato". Copioni aggiornati in scratchpad hg/jobs.json (backup jobs-before-v3.json).
- Didascalie video: una sola CTA ("Commenta <PAROLA> e ti mandiamo…"), link articolo/Radar/Diagnosi nel primo commento; TikTok/YouTube "link in bio" + URL /guide/ (cliccabile su YouTube). Gli 8 Short YouTube-only puntano a /guide/.
- Playbook guide/COMMENTA-E-RICEVI.md: ManyChat free plan insufficiente (serve Pro), LinkedIn = risposta pubblica sotto il commento.
- Sito: ancora 404 al 22/10. Pacchetto in pacchetto-sito-mirt.zip; scadenza 26/10.

## ID Metricool dopo le didascalie v3 (23/10, una CTA per post, link nel primo commento)
- B1 soc=402778686
- B1 bio=402780778
- A1 soc=402780798 bio=402780811
- B2 soc=402780831 bio=402780846
- A2 soc=402780864 bio=402780889
- B3 soc=402780910 bio=402780986
- A3 soc=402781043 bio=402781060
- B4 soc=502?  bio=402791103
- B4 soc=402795056
- B5 soc=402802428
- B5 bio=402865935
- A5 soc=403892428
- A5 bio=403893230
- B6 soc=403893420 bio=403905676
- A6 soc=403908319 bio=403908375
- B7 soc=403908422 bio=403908484
- A7 soc=403908541 bio=403909037
- B8 soc=403909091 bio=403909220
- A8 soc=403909253 bio=403909310
- Short YouTube-only con link /guide/: 402755347, 402755411, 402755454, 402755468, 402755477, 402755508, 402755524, 402755540

## Pronuncia dei video (23/10, segnalazione di Gianluca)
Controllo con Whisper su tutti i 17 audio: parole lette male = MiRT (V0, B1, B5, B7, A8), Bertagnolio (V0, A1), L'Oréal Luxe (B7), heritage (B3), AgID (A5), glitch su "sostituisce" (B2).
Regola per i copioni futuri (scritta anche in social/heygen/copioni-andrea.md): nello script "Mirt", "Bertagnòlio", "Loreàl Lùx", niente parole inglesi evitabili, acronimi per esteso; i sottotitoli vengono riportati alla grafia corretta con scratchpad hg/srt-fix.json.
Da fare appena i crediti API HeyGen sono ricaricati (~100 crediti a video, 9 video ≈ 900): `python3 scratchpad/hg/regen-v4.py` (testi già pronti in jobs.json, chiave text_v4), poi commit/push dei 18 file e aggiornamento dei 18 post Metricool corrispondenti (ID in questo file).

## 24/10: "in privato" tolto dai post del lunedì e A4 riallineato (nuovi ID Metricool)
Su LinkedIn la pagina non può aprire DM: le didascalie ora dicono "ti mandiamo la guida gratuita" (senza "in privato"), come da regola del 22/10.
- Post 1 (26/10) 402044777 → 404845803
- Post 4 (2/11) 402045025 → 404849226
- Post 7 (9/11) 402045092 → 404850014
- Post 10 (16/11) 402045223 → 404850045
- Post 13 (23/11) 402045293 → 404850070
- Post 16 (30/11) 402045336 → 404850093
- Post 19 (7/12) 402045370 → 404850119
- Video A4 soc (19/11) 402749944 → 404850170 (ora formato v3: una CTA, link articolo nel primo commento)
Controllo sito: il trigger di sabato 10:00 è stato sospeso (avrebbe sostituito /radar/ con /contatti/ mentre esiste /mirt-radar-2027/) e spostato a domenica 25/10 18:00 Rome, senza modifiche automatiche a Metricool. Dettagli in GO-LIVE-GATE.md.
