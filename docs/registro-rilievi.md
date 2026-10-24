# Registro dei rilievi: revisione del 24/10/2026

Fonte: valutazione di Quantum RE del 24/10/2026 e istruzioni di lavoro collegate. Ogni rilievo è stato riverificato sulla versione attuale del repository prima di intervenire.

Esiti ammessi: **verificato**, **fallito**, **non verificato**, **bloccato**, **non applicabile**. Una checklist compilata sulla carta non chiude un controllo.

Ambiente di verifica: Node 22.22, SQLite integrato, Chromium da `/opt/pw-browsers`, sessione isolata con database temporanei. I dati dei test sono sintetici e indicati come tali. Non sono stati toccati HubSpot, Metricool né dati di produzione.

## Baseline (24/10/2026, prima delle modifiche)

| Suite | Test | Passati | Falliti | Saltati |
|---|---|---|---|---|
| core | 41 | 41 | 0 | 0 |
| scrapers | 115 | 115 | 0 | 0 |
| server | 48 | 44 | 4 | 0 |

Build: riuscita. Fixture PDF rigenerata con `node packages/scrapers/fixtures/generaPdf.mjs`. Chromium: `QDR_CHROMIUM_PATH`.

## R-00 · Test dello scheduler dipendenti dalla rete

| Campo | Valore |
|---|---|
| Priorità | Media (affidabilità dei test e dell'installazione ripetibile) |
| Riproduzione | `node --test packages/server/dist/scheduler.test.js` con la rete attiva: 4 test su 4 falliscono con "54 !== 3". Il ciclo dello scheduler lancia tutte le fonti abilitate e scarica davvero Reperform (51 immobili) oltre ai 3 della demo. La revisione precedente li aveva visti passare perché nel suo ambiente la rete era assente. |
| Causa | Nessun modo di limitare le fonti nei test: `getAllScrapers()` legge sempre `packages/scrapers/sites`. |
| Correzione | Variabile `QDR_SITES_DIR` in `registry.ts`; il test dello scheduler usa una cartella temporanea con la sola fonte demo (fixture locale). |
| Prova prima/dopo | Prima: 44/48 sul server. Dopo: 4/4 sullo scheduler, nessun accesso alla rete dal test. |
| Esito | **verificato** |
| Limite residuo | Altri test che usano `getAllScrapers()` senza `QDR_SITES_DIR` restano esposti allo stesso rischio: oggi nessuno lo fa (verificato leggendo i test). |

## R-01 · Immobili diversi diventano un solo record (critico)

| Campo | Valore |
|---|---|
| Priorità | Critica |
| Riproduzione | Sul codice originale (`git show HEAD:packages/core/src/dedup.ts`, compilato a parte): due appartamenti allo stesso civico, interni 2 e 3, 80 mq e tre locali → **1 record** (atteso 2). Due procedure giudiziarie diverse (RGE 100 e 101) allo stesso indirizzo → **1 record** (atteso 2). |
| Cause | (1) `normalizzaIndirizzo` scarta interno, scala, piano e subalterno e la chiave geofisica non li ricostruisce. (2) Union-find: qualunque chiave condivisa fonde, anche con identificativi giudiziari incompatibili. (3) In archivio `chiave_dedup` è UNIQUE e l'upsert sovrascrive: due beni con la stessa chiave si cancellavano a vicenda. (4) L'assorbimento di un doppione eliminava la riga con `ON DELETE CASCADE`, perdendone lo storico prezzi. |
| Correzione | `core/dedup.ts`: `identitaUnita()` (interno, scala, piano, subalterno, anche dall'indirizzo grezzo), `confronta()` con esiti **certa / candidata / esclusa / diversa**, `analizzaDuplicati()` (fonde solo i legami certi, scarta i gruppi con coppie incompatibili, risultato indipendente dall'ordine), `chiaveArchivio()` unica per bene. Server: tabella `origini_immobile` (ogni origine fusa resta riconoscibile), tabella `candidati_duplicato` con stati aperto/confermato/respinto, funzioni `confermaCandidato`/`respingiCandidato`, storico prezzi e origini spostati alla riga che sopravvive, rete di sicurezza che non lascia sovrascrivere due record distinti. |
| Prova prima/dopo | Stesso script sul codice nuovo: 2 e 2. Test aggiunti: `core/src/dedupIdentita.test.ts` (12) e `server/src/identita.test.ts` (10). La suite core passa da 41 a 56 test. |
| Casi obbligatori | Interni 2 e 3 stesso edificio: **verificato** (anche stessa fonte, scala/piano/subalterno diversi). Procedura/anno/tribunale/lotto incompatibili con chiave geofisica identica: **verificato**. Stesso annuncio riletto: **verificato** (idempotente, prezzo annotato solo se cambia). Duplicato confermato tra fonti: **verificato** (provenienza `idFonti`, conflitti in `noteMerge`, rilettura da fonte secondaria senza nuovo record). Identificativi incompleti e legame transitivo ambiguo: **verificato** (candidato, nessun record perso). Indipendenza dall'ordine: **verificato** (tutte le 120 permutazioni di un insieme di 5 record). |
| Cambio di comportamento deciso | L'aggancio automatico pre-asta → asta per sola somiglianza di indirizzo non esiste più: diventa un candidato da verificare. Si fonde se le fonti dichiarano lo stesso interno o subalterno, o la stessa procedura e lo stesso lotto. Due test esistenti sono stati riscritti per descrivere questa regola. Effetto atteso: più duplicati residui da verificare, nessuna fusione errata. |
| Esito | **verificato** (su dati sintetici) |
| Limite residuo | La qualità dei candidati dipende da quanti portali pubblicano interno e subalterno: senza, ogni bene resta un candidato. Le soglie di somiglianza (bucket di 10 mq) non sono state misurate su dati reali. Manca un'interfaccia per confermare o respingere i candidati dalla dashboard (esistono le funzioni e l'elenco via API, vedi R-03). |

## R-01b · Dati già fusi: analisi, backup, migrazione su copia, ripristino

| Campo | Valore |
|---|---|
| Priorità | Alta |
| Riproduzione | Un database dello schema precedente con una riga fusa per sola somiglianza (`GEO|...`, due fonti) non è distinguibile da una fusa per procedura senza ispezione. |
| Correzione | `server/src/migra.ts` e `migraCli.ts` (`npm run migra`): `analizza` (sola lettura), `copia` (VACUUM INTO + SHA-256 + integrity check), `prova` (backup, migrazione sulla copia, ripristino provato), `applica` (richiede `--conferma`), `ripristina` (rifiuta un backup con checksum diverso). Le righe fuse per sola somiglianza ricevono `fusione_da_verificare = 1`. Lo schema è in `schema.ts`, senza effetti collaterali. |
| Difetto trovato dalla prova | Aprire un database impostava la modalità WAL e ne cambiava il file anche quando il server rifiutava di partire. Corretto: il controllo di versione avviene prima di qualsiasi scrittura. |
| Politica | Un database con dati e schema precedente **non viene modificato all'avvio**: il server si ferma e indica `npm run migra`. `QDR_ACCETTA_MIGRAZIONE=1` è la scelta esplicita. |
| Prova | `server/src/migra.test.ts` (6 test) su un database sintetico con lo schema precedente: originale intatto (SHA-256 uguale), tutte le verifiche "verificato", ripristino con checksum uguale, backup alterato rifiutato. |
| Esito | **verificato** su database sintetico. **non verificato** sui dati reali: nessun database di produzione è disponibile in questa sessione. |
| Limite residuo | Se la vecchia deduplica ha eliminato una riga, l'originale non è recuperabile dal database: la riga fusa resta segnata e va riscostruita dalle fonti o da un backup precedente. Non si ricostruisce nulla di inventato. |
| Azione necessaria | Eseguire `npm run migra -- analizza <db>` e poi `prova` sul database reale, e confermare prima di `applica`. |
