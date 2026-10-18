# Osservatorio delle aste immobiliari dello Stato

Vendite di immobili pubblici ancora aperte, con focus Lombardia. Questo documento
mette insieme cosa monitorare, con quale fonte del registro, e come si scarta.
Lo stato dei canali e' quello rilevato il 18 ottobre 2026: va riletto a ogni
tornata, perche' i bandi pubblici aprono e chiudono a finestre.

## I canali e la fonte che li copre

| Canale | Fonte nel registro | Fascia | Cosa c'e' adesso (ott. 2026) |
| --- | --- | --- | --- |
| Agenzia del Demanio | `demanio` | P1 | Avviso Lombardia del 15 maggio 2026, 20 lotti: apertura da verificare. Il bando da 20 immobili con offerte entro l'11 dicembre 2026 e' in **concessione di valorizzazione**, non in vendita. |
| Invimit SGR (MEF) | `invimit` | P1 | Vetrina Immobili attiva; lettera di intenti con ALER Milano, quindi lotti lombardi attesi. Filtro per regione da fare sul sito. |
| Agenzia delle Entrate-Riscossione | `ader` | P2 | Da mappare: URL della sezione aste ancora da fornire. |
| INPS | `inps` | P3 | Unico bando in elenco (n. 26035, Milano) scaduto il 7 settembre 2026. Si aspetta la prossima tornata. |
| ANBSC, beni confiscati | `anbsc` | P3 | Circa 3.163 beni in Lombardia, oltre meta' in provincia di Milano. Le vendite vere sono poche e passano dal Notariato: import manuale. |
| ALER Milano (regionale) | `aler_milano` | P3 | Bando T1/2026: 37 lotti a Garbagnate Milanese, aste dal 1 dicembre 2026. Tagli piccoli. |

ALER non e' un ente statale: sta qui perche' e' il canale pubblico piu' attivo
su Milano, e i suoi prezzi servono da riferimento anche quando i lotti non
passano il filtro.

Il Portale Vendite Pubbliche (`portale_vendite_pubbliche`) resta la fonte
autorevole per le procedure giudiziarie: quando un lotto statale compare anche
li', vince il dato del PVP in deduplica.

Tutte le fonti nuove sono `enabled: false` con `compliance.stato:
"da_verificare"`. Si aprono una per volta, dopo la lettura di `robots.txt` e
condizioni d'uso (vedi [condizioni-uso.md](condizioni-uso.md)), e dopo aver
calibrato i selettori con `cattura` e `ispeziona`.

## La pipeline

1. **Monitoraggio settimanale** delle fonti qui sopra, con `watch` o con lo
   scheduler. `novita` dice cosa e' entrato, uscito o ribassato rispetto alla
   settimana prima.
2. **Gate 0 QRE.** Binario B: residenziale 60-150 mq, libero o liberabile,
   prezzo massimo QRE sopra il prezzo base (vedi
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
