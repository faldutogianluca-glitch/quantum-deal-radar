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
| Prova prima/dopo | Stesso script sul codice nuovo: 2 e 2. Test aggiunti: `core/src/dedupIdentita.test.ts` (14) e `server/src/identita.test.ts` (10). La suite core passa da 41 a 56 test. |
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

## R-02 · "Solo praticabili" include gli immobili non valutati

| Campo | Valore |
|---|---|
| Priorità | Alta |
| Riproduzione | Sul codice originale: `valuta()` su un immobile senza nessuna base di stima e senza data restituisce `praticabile: true` con il solo flag `dato_mancante`. Il filtro `(praticabile IS NULL OR praticabile = 1)` includeva anche tutti gli immobili mai valutati, come i tre della demo. |
| Cause | (1) `praticabile` era un booleano: l'assenza di blocchi noti diventava "praticabile". (2) Il filtro trattava NULL come positivo. (3) La data d'asta mancante non fermava nulla. |
| Correzione | `core/valutazione.ts`: `esito` a tre stati (**positivo, negativo, non_valutato**); `praticabile` vale true/false/**null**; `datiEconomici` (assenti/parziali/completi), `vincoli` (bloccanti/nessuno_noto/non_verificabili) e `mancanti` (dato mancante e prossimo controllo) riportati **separatamente**. Una vendita giudiziaria senza data è non valutata; una data illeggibile non vale come termine lontano; stime divergenti non producono verdetto. Server: colonne `esito_valutazione`, `dati_economici`, `vincoli_operativi`, `mancanti_json`; il filtro `soloPraticabili` ammette solo `esito_valutazione = 'positivo' AND praticabile = 1`; nuovo parametro `?valutazione=positivo\|negativo\|non_valutato`; `enrich` assegna l'esito "non valutato" con motivo anche quando mancano le quotazioni OMI; dashboard e dettaglio mostrano stato, dati mancanti e prossimo controllo. |
| Prova prima/dopo | Prima: `praticabile: true` su un immobile senza base di stima. Dopo: `praticabile: null`, esito `non_valutato`. Test: `core/src/valutazioneStati.test.ts` (16 test), `server/src/praticabilita.test.ts` (4 test): tre immobili mai valutati → filtro solo-praticabili vuoto; positivo/negativo/non valutato separati; le righe valutate dal motore precedente non contano come positive. |
| Esito | **verificato** (su dati sintetici) |
| Limite residuo | Il verdetto commerciale GO/WATCH/SCARTA resta nella skill di screening: il codice non lo calcola. I dati indispensabili sono una scelta di lavoro (base di stima; termine per le vendite giudiziarie): vanno confermati con chi usa il radar. |

## R-07 · OMI pesata due volte e semestre ignorato

| Campo | Valore |
|---|---|
| Priorità | Medio-alta |
| Riproduzione | Perizia 320.000 €, OMI 3.000-3.600 €/mq su 100 mq. Calcolo indipendente con l'OMI come una fonte sola: (0,85×320.000 + 0,275×300.000 + 0,275×360.000) / 1,40 = **323.928,57**. Codice originale: **325.641,03** (min e max sommati ciascuno col peso pieno, OMI al doppio). |
| Correzione | I due estremi dividono il peso di una fonte (`confidenza / n`); la forbice resta disponibile come `intervalloOmi`; un solo estremo è segnalato (`omi_estremo_singolo`) e vale come punto. Politica del semestre configurabile (`parametri.semestreOmi`): oltre `maxEtaSemestri` o con semestre non riconoscibile si può **avvisare**, **penalizzare** (predefinito, ×0,7) o **non valutare**. I valori predefiniti sono prudenti e non calibrati. |
| Prova | `valutazioneStati.test.ts`: 323.928,57 e 306.071,43 (solo estremo minimo) calcolati a mano nei commenti; tre politiche del semestre; formati del semestre. |
| Esito | **verificato** |
| Limite residuo | I pesi di confidenza (perizia 0,85, OMI 0,55, comparabili 0,65) restano assunzioni di lavoro: la valutazione porta `pesiEuristici: true` e non va presentata come accuratezza misurata. Non esistono esiti reali per calibrarli. |

## R-03 · Nessuna autenticazione applicativa e ascolto su tutte le interfacce

| Campo | Valore |
|---|---|
| Priorità | Alta se esposto in rete |
| Riproduzione | Codice originale: `app.listen(porta)` senza indirizzo → ascolto su **tutte le interfacce** (`express().listen(0)` riporta `0.0.0.0`). `GET /api/immobili` e `POST /api/scrape`, `/api/enrich` rispondono senza credenziali. |
| Correzione | `server/src/accesso.ts`: ascolto predefinito su `127.0.0.1`; un indirizzo remoto **senza** `QDR_TOKEN` (almeno 24 caratteri) fa fallire l'avvio con un messaggio; con il token servono `Authorization: Bearer` (script) o Basic (browser) su API **e** dashboard, confronto a tempo costante; il token nell'URL non vale; tentativi falliti limitati per indirizzo (429 con `Retry-After`); controllo di `Host` e `Origin` contro DNS rebinding e richieste cross-site (421/403); intestazioni di sicurezza e CSP; `x-powered-by` rimosso. `server/src/lavoro.ts`: un solo scraping o arricchimento alla volta, anche fra API e scheduler (409); cooldown di 30 s fra gli avvii (429). |
| Prova prima/dopo | Prima: ascolto `0.0.0.0` senza credenziali. Dopo, con il server vero: avvio predefinito su `127.0.0.1`; `QDR_HOST=0.0.0.0` senza token → uscita 1 con messaggio; con token → 401 senza credenziali; POST con `Origin` estraneo → 403. 19 test in `server/src/accesso.test.ts`, fra cui: credenziali assenti e sbagliate (5 varianti), token in URL, dashboard con credenziali giuste, il token assente dal JavaScript pubblico, blocco dopo 3 falli, Host ostile 421, POST cross-site 403, cooldown 429, concorrenza 409. |
| Esito | **verificato** per il perimetro: uso locale o dietro un proxy TLS con token. |
| Limite residuo | Non c'è TLS nel server né gestione di più utenti o ruoli: un solo token condiviso. Il limite dei tentativi è in memoria (si azzera al riavvio) e per indirizzo IP: dietro un proxy tutti gli accessi arrivano dallo stesso indirizzo se `trust proxy` non è configurato. Non è stata eseguita una verifica di sicurezza indipendente. |

## R-04 · Installazione e test non ripetibili

| Campo | Valore |
|---|---|
| Priorità | Media |
| Riproduzione | La revisione aveva 11 fallimenti finché non si rigenerava la fixture PDF (assente nell'archivio leggero, ma **tracciata** nel repository) e serviva configurare Chromium a mano. Senza Chromium i test del browser venivano **saltati in silenzio**: 8 su 9 saltati e suite verde. I test dello scheduler dipendevano dalla rete (R-00). |
| Correzione | `npm test` = `scripts/test.mjs`: controlla Node ≥ 22.5, rigenera la fixture se manca, trova Chromium (variabile, `PLAYWRIGHT_BROWSERS_PATH`, cartelle predefinite), **fallisce** se non lo trova o se ci sono test saltati, riassume test/passati/falliti/saltati. `--senza-browser` salta dichiarandolo. Workflow GitHub Actions `.github/workflows/ci.yml` (`npm ci`, Chromium, build, test). Lockfile già presente e usato (`npm ci`). |
| Prova | `npm test` → 274 test, 274 passati, 0 falliti, 0 saltati. Chromium non avviabile in modalità rigorosa → i test del browser **falliscono** con "Chromium richiesto ma non avviabile". `--senza-browser` → 8 saltati dichiarati, exit 0. |
| Esito | **verificato** in questo ambiente; il workflow CI **non verificato** (non eseguito su GitHub in questa sessione). |
| Limite residuo | La verifica da clone pulito è nella sezione finale. TLS e firme: nessuna verifica è stata disattivata; le vulnerabilità delle dipendenze sono trattate in R-05. |

## R-05 · Dipendenze con vulnerabilità note (trovato durante la verifica)

| Campo | Valore |
|---|---|
| Priorità | Alta (1 critica) |
| Riproduzione | `npm audit` sul lockfile originale: 5 vulnerabilità (1 critica in `proxy-addr`, 2 alte in `body-parser` e `undici`, 2 moderate in `express` e `qs`). Non era un rilievo della revisione: l'ho trovato eseguendo l'installazione ripetibile. |
| Correzione | `npm audit fix` (solo aggiornamenti compatibili: express 4.22.3, body-parser 1.20.9, proxy-addr 2.0.8, qs 6.16.1, undici 7.30.1); lockfile aggiornato. |
| Prova prima/dopo | `npm audit`: 5 → **0** vulnerabilità. Suite completa dopo l'aggiornamento: 274 test, 274 passati, 0 saltati. |
| Esito | **verificato** per quanto riguarda il database pubblico degli avvisi consultato oggi. |
| Limite residuo | `npm audit` non prova l'assenza di vulnerabilità non ancora note. Non è stata fatta una revisione indipendente del codice. Il controllo va ripetuto periodicamente (o con Dependabot). |
