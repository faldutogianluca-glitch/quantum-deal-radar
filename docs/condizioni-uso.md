# Lettura delle condizioni d'uso — schede di lavoro

Le fonti P1 che pubblicano prezzi, quindi quelle che alimentano davvero lo
storico e il digest dei ribassi. Il `robots.txt` di ognuna e' gia' stato
verificato: nessuna e' vietata. Resta la lettura delle condizioni d'uso, che e'
una decisione umana e non la puo' prendere il codice.

**Cosa non e' questo documento.** Non e' un parere legale e non contiene una
lettura delle condizioni: quei testi vanno aperti e letti. Qui c'e' solo cosa
guardare e dove, perche' sono sempre gli stessi quattro punti e cercarli a
memoria ogni volta fa perdere tempo.

## I quattro punti che decidono

Nelle condizioni d'uso di un portale italiano la risposta sta quasi sempre in
una di queste voci. Le prime due bastano a decidere; le altre due cambiano
*come* si raccoglie, non *se*.

1. **Raccolta automatizzata.** Cerca "strumenti automatici", "robot", "spider",
   "crawler", "scraping", "estrazione sistematica", "data mining". Un divieto
   esplicito chiude il discorso: la fonte passa a `vietato` e non se ne parla
   piu'.
2. **Riuso dei contenuti.** Cerca "riproduzione", "estrazione", "reimpiego",
   "banca dati", "uso personale", "uso commerciale". Molti portali consentono
   la consultazione e vietano il riuso: monitorare i prezzi per decidere se fare
   un'offerta e' uso personale, ripubblicare l'inventario non lo e'.
3. **Registrazione.** Se il dato completo sta dietro un account, il connettore
   si ferma alla parte pubblica. Non si automatizza un login: lo abbiamo gia'
   stabilito per Quimmo e per il PVP, e vale allo stesso modo qui.
4. **Frequenza e carico.** Cerca "carico", "interferenza", "sovraccarico". Se il
   sito indica un limite, `rateLimitSeconds` va alzato a quel valore. In assenza
   di indicazioni, cinque secondi fra due richieste sono prudenti per un
   catalogo di poche centinaia di schede.

Dove si trovano: piede pagina, voci "Note legali", "Termini e condizioni",
"Condizioni di utilizzo", "Privacy e cookie", "Disclaimer".

## Come si registra l'esito

Nel file della fonte, in `packages/scrapers/sites/<nome>.json`:

```json
"compliance": {
  "stato": "consentito",
  "verificatoIl": "2026-08-10",
  "note": "Note legali lette il 10/08/2026: nessun divieto di raccolta automatica; art. X consente l'uso personale. Restano esclusi i percorsi vietati dal robots.txt."
}
```

Gli stati sono `consentito`, `vietato`, `solo_contatto`, e `da_verificare`
finche' nessuno ha guardato. **La nota conta quanto lo stato**: fra sei mesi,
davanti a una fonte che ha smesso di funzionare, serve sapere su quale base era
stata aperta.

Fino a quel momento lo scraper si rifiuta di partire — non e' un avviso, e' un
blocco.

---

## re_impresa — RE-Impresa (partner UniCredit Leasing)

| | |
|---|---|
| **Pagina da leggere** | https://www.re-impresa.it/ → note legali a piede pagina |
| **URL della raccolta** | `/risultati-annunci/index.html?Contratto=V&…` |
| **robots.txt** | **Nessuno** (404 verificato). Nessuna direttiva, quindi nessun limite da quel lato. |
| **Percorsi esclusi** | Nessuno da robots.txt. |
| **Priorita' dedup** | 40 — servicer, cede al dato di un tribunale |

**Attenzione particolare.** E' un partner di UniCredit Leasing: le condizioni
potrebbero rimandare a quelle del gruppo invece di essere proprie. Se il piede
pagina rimanda a un altro dominio, e' quel testo che vale.

L'assenza di `robots.txt` non e' un permesso: significa solo che il sito non ha
dichiarato restrizioni per i crawler. Le condizioni d'uso restano l'unica fonte.

**Esito:** `da_verificare` → ______________  data: __________

---

## bper_leasing — BPER Leasing

| | |
|---|---|
| **Pagina da leggere** | https://www.bperleasing.it/ → note legali / condizioni |
| **URL della raccolta** | `/beni-in-vendita/` |
| **robots.txt** | **Presente, consente** il percorso (verificato) |
| **Percorsi esclusi** | Quelli che il robots.txt vieta, gia' rispettati dal connettore |
| **Priorita' dedup** | 30 |

**Attenzione particolare.** E' un istituto bancario: le note legali sono
tipicamente estese e coprono l'intero sito, non la sola sezione immobiliare.
Il punto da isolare e' se il divieto di riuso riguardi *tutti* i contenuti o i
soli marchi e materiali editoriali — sono due cose diverse, e i cataloghi di
beni in vendita spesso stanno nella seconda categoria.

**Nota tecnica, per dopo:** vale la pena guardare se dietro la pagina ci sia un
endpoint JSON. Sarebbe piu' stabile dei selettori CSS e piu' leggero per il
sito, il che e' anche un argomento di riguardo verso di loro.

**Esito:** `da_verificare` → ______________  data: __________

---

## credemleasing — Credemleasing

| | |
|---|---|
| **Pagina da leggere** | https://credemleasing.it/ → note legali |
| **URL della raccolta** | da individuare: la sezione "Beni in vendita" |
| **robots.txt** | **Presente, consente** (verificato) |
| **Percorsi esclusi** | Quelli vietati dal robots.txt |
| **Priorita' dedup** | 30 |

**Serve anche l'URL vero.** Nel config c'e' la home: mentre leggi le condizioni,
prendi il percorso della pagina che elenca i beni. Serve comunque prima di poter
calibrare.

**Attenzione particolare.** La sezione mette insieme immobili, macchinari e
veicoli. Il connettore deve filtrare la sola categoria immobiliare — e vale la
pena verificare che l'elenco esponga un filtro per categoria nell'URL: se lo fa,
si scarica solo cio' che interessa invece di prendere tutto e scartare dopo.
Meno richieste al sito, e piu' rispetto per un catalogo che non ci riguarda per
tre quarti.

**Esito:** `da_verificare` → ______________  data: __________

---

## alba_leasing — Alba Leasing

| | |
|---|---|
| **Pagina da leggere** | https://remarketing.albaleasing.eu/ → condizioni del portale remarketing |
| **URL della raccolta** | la radice del portale remarketing |
| **robots.txt** | **Presente, consente** (verificato) |
| **Percorsi esclusi** | Quelli vietati dal robots.txt |
| **Priorita' dedup** | 30 |

**Attenzione particolare.** E' un portale dedicato al remarketing, quindi le
condizioni potrebbero essere quelle *del portale* e non quelle del sito
istituzionale di Alba Leasing. Sono documenti distinti: vale quello del
sottodominio da cui si raccoglie.

Un portale di remarketing e' spesso pensato per essere consultato da operatori.
Se le condizioni prevedono una registrazione per l'uso professionale, la parte
pubblica resta consultabile ma il connettore non deve superare quella soglia.

**Esito:** `da_verificare` → ______________  data: __________

---

## demanio — Agenzia del Demanio, Vetrina Vendita Immobili dello Stato

Letta il 18/10/2026. Qui c'e' anche cio' che il testo dice, non solo dove
guardare, perche' il sito non ha condizioni d'uso proprie da aprire.

| | |
|---|---|
| **Pagine lette** | https://venditaimmobili.agenziademanio.it/AsteDemanio/sito.php (piede pagina: Chi siamo, Documenti, Faq, Contatti) e le "note legali" di www.agenziademanio.it, che rimandano a https://www.agenziademanio.it/it/agenzia/privacy/ |
| **URL della raccolta** | `/AsteDemanio/sito.php/ricerca/?f_ricerca=vendite&f_regione=03&f_destinazione=Residenziale&f_np=N` e le schede `/AsteDemanio/sito.php/immobile?id-immobile=N` |
| **robots.txt** | **Nessuno**, su entrambi i domini (404 verificato il 18/10/2026). |
| **Raccolta automatizzata** | Nessun divieto trovato: la Vetrina non ha condizioni d'uso, le note legali dell'Agenzia trattano solo privacy e cookie. |
| **Riuso dei contenuti** | Nessuna licenza dichiarata; solo "Copyright © Agenzia del Demanio 2015" a piede pagina. Per i dati pubblicati da una PA senza licenza, l'art. 52, comma 2, del Codice dell'amministrazione digitale prevede che si intendano rilasciati come dati di tipo aperto ("open by default"). |
| **Registrazione** | Non serve: elenco e schede sono pubblici. L'area riservata (italianpublicrealestate) non si tocca. |
| **Carico** | Nessuna indicazione. Il connettore apre fino a 8 pagine di elenco e 80 schede per esecuzione, una richiesta ogni 5 secondi. |

**Lettura proposta, da confermare:** nessun ostacolo a `consentito`, per l'uso
interno di monitoraggio. L'art. 52 del CAD va verificato sul testo vigente se
i dati dovessero essere ripubblicati.

**Esito:** `da_verificare` → **consentito**  data: **18/10/2026** (decisione del titolare del progetto)

---

## invimit — Invimit SGR, Vetrina Immobili

| | |
|---|---|
| **Pagina da leggere** | https://vetrinaimmobili.invimit.it/ → piede pagina "Policy" e "Privacy policy" |
| **URL della raccolta** | `https://vetrinaimmobili.invimit.it/` (una sola pagina, la tabella) |
| **robots.txt** | `Disallow:` vuoto (verificato il 18/10/2026): nessun percorso escluso. |
| **Carico** | Una richiesta per esecuzione. |

Invimit e' una SGR, quindi una societa' privata a capitale pubblico: l'"open by
default" del CAD non le si applica automaticamente, e le sue policy vanno lette.

**Esito:** `da_verificare` → ______________  data: __________

---

## portale_vendite_pubbliche — Portale delle Vendite Pubbliche (Ministero della Giustizia)

Letta il 18/10/2026. Fonte di priorita' 1 per la decisione del 18/10/2026
(aste giudiziarie, binario A).

| | |
|---|---|
| **Pagine lette** | https://pvp.giustizia.it/pvp/ (ricerca pubblica) e le note legali di https://www.giustizia.it (aggiornate al 2/12/2025) |
| **URL della raccolta** | L'API JSON che la pagina di ricerca chiama senza autenticazione: `POST /ric-496b258c-986a1b71/ric-ms/ricerca/vendite` (elenco) e `GET /ve-3f723b85-986a1b71/ve-ms/vendite/{id}/restricted` (dettaglio). Gli stessi dati che vede chiunque apra il portale. |
| **robots.txt** | **Nessuno** (404 su pvp.giustizia.it/robots.txt, verificato il 18/10/2026). |
| **Raccolta automatizzata** | Nessun divieto esplicito trovato nelle note legali. |
| **Riuso dei contenuti** | Le note legali di giustizia.it consentono il riuso **per finalita' non commerciali**, garantendo l'integrita' dei contenuti e citando la fonte. |
| **Registrazione** | Non serve per la ricerca. Le funzioni con SPID, CIE o CNS (deposito offerte) restano fuori e non si automatizzano. |
| **Dati personali** | Il dettaglio contiene delegato e custode (nomi, codici fiscali, contatti). Il connettore non li salva: resta il link all'annuncio. |
| **Perizie** | Scaricate da `resource-pvp.giustizia.it`, l'host che la pagina di dettaglio usa senza autenticazione per gli allegati (lo dichiara la configurazione pubblica del portale, `bo-ms/fe-config`). Il suo robots.txt risponde 403 come ogni chiave inesistente del bucket: per RFC 9309 equivale a nessuna restrizione. Delle perizie si conservano solo numeri (superficie, valore, conformita', occupazione), mai il testo, che contiene nomi e codici fiscali. |
| **Protezioni** | Il 18/10/2026 la pagina di dettaglio ha bloccato un browser automatico ("Web Page Blocked", firewall applicativo). Non si aggira: il connettore non usa il browser sul PVP, solo l'API JSON e gli allegati, che rispondono normalmente. |
| **Carico** | Una richiesta ogni 6 secondi, piu' lenta nei nuovi tentativi. Per esecuzione: fino a 20 pagine di elenco da 50 per tribunale e categoria, fino a 400 dettagli, ciascuno con una ricerca delle aste precedenti. |

**Lettura proposta, da confermare:** il punto aperto e' la clausola "finalita'
non commerciali". QRE usa i dati internamente per decidere se e quanto offrire:
e' lo scopo di pubblicita' legale per cui il portale esiste, e nulla viene
ripubblicato o rivenduto. Ma QRE e' un operatore commerciale, e la clausola non
distingue. Due strade:

1. `consentito` per l'uso interno, senza ripubblicazione, con il quesito
   aggiunto al parere legale gia' previsto dalla decisione del 18/10/2026;
2. attendere il parere, e nel frattempo usare la ricerca del portale a mano o
   un aggregatore con licenza (Astalegale o simili).

**Esito:** `da_verificare` → **consentito** per uso interno, senza ripubblicazione
(strada 1)  data: **18/10/2026** (decisione del titolare del progetto). Il
quesito sulla clausola "finalita' non commerciali" e' aggiunto al parere legale
(docs/decisione-2026-10-18.md). Se il parere fosse negativo, la fonte si spegne
e si passa alla ricerca manuale o a un aggregatore con licenza.

---

## omi_agenzia — Quotazioni e perimetri OMI dell'Agenzia delle Entrate

Letta il 18/10/2026. Serve al Gate 0 fuori da Milano citta': senza zona e
quotazione il valore di uscita manca e il verdetto e' `dati_mancanti`.

| | |
|---|---|
| **Quotazioni** | Solo dall'area riservata (Fisconline, Entratel o SPID), servizio "Forniture dati OMI", gratuito (provvedimenti n. 73158/2018 e n. 284700/2022). Il login non si automatizza: il titolare scarica il CSV e il radar lo importa (`npm run omi -- importa`). |
| **Perimetri** | Dall'area riservata ("Perimetri di zona") o dal visualizzatore pubblico GEOPOI, pulsante "Download perimetri" (`perimetri.php`, KML in zip, per comune o provincia, senza login). |
| **Valori dal visualizzatore pubblico** | GEOPOI mostra i valori zona per zona. Ricavarli tutti richiederebbe migliaia di richieste a un servizio dell'Agenzia: e' raccolta automatizzata, non si fa senza una decisione esplicita. |
| **robots.txt** | www1.agenziaentrate.gov.it: assente (404). www.agenziaentrate.gov.it: 403 dalla CDN. |
| **Riuso** | Citare "Agenzia Entrate - OMI". Le condizioni non dicono se l'uso commerciale sia ammesso (lo nota anche onData, che ha ripubblicato i dati 2016-2018 su GitHub). Uso interno del radar, nessuna ripubblicazione. |
| **Alternative scartate** | Ripubblicazioni open data: solo il Comune di Milano (gia' usata). La copia di onData si ferma al 2018. |

**Esito:** importazione manuale delle forniture: nessun ostacolo. Download
automatico dei perimetri provinciali da GEOPOI (due file a semestre):
`da_verificare`, decisione del titolare.

---

## Dopo la lettura

Per ogni fonte che passa a `consentito`:

```bash
npm run calibra -- <nome-fonte>
```

Cattura, riconosce le schede e propone i selettori guardando i valori. La bozza
finisce in `calibrazione-<fonte>.json` e **non** viene applicata: va riletta
prima, perche' un selettore sbagliato riempie il database di valori plausibili e
sbagliati, che e' peggio di un campo vuoto.

Su una fonte ancora `da_verificare`, `calibra` si rifiuta di partire — ed e'
voluto.
