# Osservatorio delle aste immobiliari dello Stato

> **Congelato il 18/10/2026** (vedi [decisione-2026-10-18.md](decisione-2026-10-18.md)):
> in Lombardia il canale statale non ha lotti aperti. Il connettore Demanio resta
> acceso in modo passivo; nessun nuovo sviluppo finche' la Vetrina non avra' lotti
> lombardi aperti.

Vendite di immobili pubblici ancora aperte, con focus Lombardia. Questo documento
mette insieme cosa monitorare, con quale fonte del registro, e come si scarta.
Lo stato dei canali e' quello rilevato il 18 ottobre 2026: va riletto a ogni
tornata, perche' i bandi pubblici aprono e chiudono a finestre.

## I canali e la fonte che li copre

| Canale | Fonte nel registro | Connettore | Cosa c'e' adesso (verificato il 18/10/2026) |
| --- | --- | --- | --- |
| Agenzia del Demanio | `demanio` | Pronto, calibrato sulla Vetrina reale: elenco Lombardia residenziale e schede con prezzo, superficie, stato, scadenza, aggiudicazione | 51 schede residenziali lombarde in Vetrina, tutte scadute: l'ultimo avviso di vendita lombardo (Brescia, Como, Lecco, Milano, Varese) chiudeva il 6 maggio 2026. Le procedure lombarde aperte (scadenze 11 e 21 dicembre 2026) sono concessioni di valorizzazione, non vendite. |
| Invimit SGR (MEF) | `invimit` | Pronto, calibrato sulla tabella della Vetrina Immobili | 7 immobili in tabella, nessuno in Lombardia (Napoli, Firenze). Da seguire la lettera di intenti con ALER Milano. |
| INPS | `inps` | Da fare: gli avvisi rimandano alle schede della Rete Aste Notarili | L'elenco "in corso" contiene solo bandi di settembre 2026, gia' scaduti (fra cui 26035 Milano e 26036 Lacchiarella). Le aste stanno su notariato.it/ran, che il 18/10/2026 rispondeva 503 e presenta una catena TLS incompleta: da riprovare. |
| ALER Milano (regionale) | `aler_milano` | Pronto sul PDF del bando T1/2026 (37 lotti letti) | Aste dal 1 dicembre 2026. Analisi completa in [economia-deal-binario-b.md](economia-deal-binario-b.md): con i valori di zona nessun lotto regge il binario B. |
| Agenzia delle Entrate-Riscossione | `ader` | Da mappare | Non ho trovato una vetrina pubblica di vendite immobiliari sul sito di AdER. Da chiarire se queste vendite abbiano un canale proprio o finiscano comunque sul PVP, che il radar gia' monitora. |
| ANBSC, beni confiscati | `anbsc` | Import manuale da CSV | Circa 3.163 beni in Lombardia, oltre meta' in provincia di Milano; le vendite sono poche e passano dal Notariato. |

ALER non e' un ente statale: sta qui perche' e' il canale pubblico piu' attivo
su Milano, e i suoi prezzi servono da riferimento anche quando i lotti non
passano il filtro.

Il Portale Vendite Pubbliche (`portale_vendite_pubbliche`) resta la fonte
autorevole per le procedure giudiziarie: quando un lotto statale compare anche
li', vince il dato del PVP in deduplica.

Tutte le fonti nuove sono `enabled: false` con `compliance.stato:
"da_verificare"`. Per Demanio e Invimit il `robots.txt` e' verificato e la
scheda delle condizioni d'uso e' pronta in [condizioni-uso.md](condizioni-uso.md):
manca solo la decisione, che spetta al titolare. Poi `enabled: true` e
`compliance.stato: "consentito"`, e la fonte gira.

## La pipeline

1. **Monitoraggio settimanale** delle fonti qui sopra, con `watch` o con lo
   scheduler. `novita` dice cosa e' entrato, uscito o ribassato rispetto alla
   settimana prima.
2. **Gate 0 QRE.** Binario B: residenziale 60-150 mq, libero o liberabile,
   aggiudicazione attesa entro l'offerta massima QRE (vedi
   [economia-deal-binario-b.md](economia-deal-binario-b.md)). Binario A: almeno
   200 mq con potenziale di frazionamento o cambio d'uso. Le concessioni di
   valorizzazione si scartano a prescindere: non sono acquisti.
3. **Screening QRE** sui superstiti: margine lordo minimo 20% nel binario B,
   30% nel binario A.
4. **Tracciamento** di ogni lotto nella pipeline "Deal immobiliari QRE" del CRM.

## Binario scelto

Il 18 ottobre 2026 si e' scelto di partire dal **binario B, unita' singole**:
avvisi di vendita Demanio sotto i 400.000 euro, unita' dei bandi INPS e
Invimit, alloggi ALER. I numeri sono in
[economia-deal-binario-b.md](economia-deal-binario-b.md). Il binario A (club
deal su fabbricati cielo-terra) resta il prioritario nel metodo QRE e si apre
quando ci sara' un primo deal chiuso da mostrare ai soci.

## Fonti delle informazioni

- [Teleborsa, Demanio: 20 immobili a bando](https://www.teleborsa.it/DettaglioNews/93_2026-07-21_TLB/Agenzia-del-Demanio-a-bando-20-immobili-dello-Stato.html)
- [Agenzia del Demanio, gare e aste immobiliari](https://www.agenziademanio.it/opencms/it/gare-aste/immobiliare?garaFilters=r%3A03%7Cs%3Aincorso%7Ctp%3Avenditaimmobili)
- [Demanio, Vetrina immobiliare](https://venditaimmobili.agenziademanio.it/AsteDemanio/sito.php)
- [INPS, bandi d'asta in corso](https://www.inps.it/it/it/avvisi-bandi-e-fatturazione/aste-immobiliari-inps/bandi-d-asta-in-corso.html)
- [ALER Milano, bando T1/2026](https://alermipianovendite.it/bando-t1-2026/)
- [Invimit, lettera di intenti con ALER Milano](https://www.invimit.it/invimit-e-aler-milano-sottoscrivono-lettera-di-intenti-per-valorizzazione-di-immobili-di-proprieta-dellazienda-lombarda/)
- [Italpress, beni confiscati in Lombardia](https://www.italpress.com/?p=424478)
- [idealista, aste immobiliari nel primo semestre 2026](https://www.idealista.it/news/aste-immobiliari/2026/07/01/400642-il-mercato-delle-aste-immobiliari-in-italia-nella-prima-meta-del-2026)
- [Vetrina Demanio, ricerca Lombardia residenziale](https://venditaimmobili.agenziademanio.it/AsteDemanio/sito.php/ricerca/?f_ricerca=vendite&f_regione=03&f_destinazione=Residenziale) e [vendite aggiudicate](https://venditaimmobili.agenziademanio.it/AsteDemanio/sito.php/ricerca/?f_ricerca=vendite&f_aggiudicati=1)
- [Invimit, Vetrina Immobili](https://vetrinaimmobili.invimit.it/)
- [INPS, bandi d'asta in corso](https://www.inps.it/it/it/avvisi-bandi-e-fatturazione/aste-immobiliari-inps/bandi-d-asta-in-corso.html)
- [ALER Milano, bando T1/2026 (PDF)](https://alermipianovendite.it/downloads/telematiche/bando_t1_26.pdf)
- [Comune di Milano, quotazioni OMI compravendita 2024/2](https://dati.comune.milano.it/dataset/ds2940-quotazioni-immobiliari-omi-compravendita-semestre-2024-2)
- [Banca d'Italia, Sondaggio congiunturale sul mercato delle abitazioni, II trimestre 2026](https://www.bancaditalia.it/pubblicazioni/sondaggio-abitazioni/2026-sondaggio-abitazioni/02/index.html)
