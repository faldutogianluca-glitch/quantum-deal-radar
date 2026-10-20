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

## Video A3–A8 (stato 20/10)
- A3 "Il commesso aumentato" (gio 12/11) non generato: HeyGen ha risposto "Insufficient credit" sui crediti **API** (54 rimasti non bastano per un video di ~60 s).
- A4–A8 (gio 19/11 → 17/12) in attesa dello stesso ricarico. Copioni e frasi in `scratchpad/hg/jobs.json` e `social/heygen/copioni-andrea.md`.
- Dopo la ricarica: rilanciare `produci.py` (togliere `skip`), impaginare, pubblicare su GitHub e programmare su Metricool alle 12:00 (5 reti).
