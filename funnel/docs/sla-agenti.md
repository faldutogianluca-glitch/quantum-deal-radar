# SLA del canale agenti: definizioni da confermare

Bozza del 24/10/2026. Le promesse pubbliche ("risposta motivata entro 48 ore", "offerta vincolante entro 7-10 giorni dai documenti", "nessuna rinegoziazione dopo la lettera d'intenti salvo fatti nuovi documentati") **non sono state modificate**. Questo documento dice cosa servirebbe perché fossero sostenibili e cosa occorre decidere. Le parti da decidere sono segnate **DECISIONE**.

## Cosa dice oggi la promessa, e cosa non dice

La promessa non specifica: quando parte l'orologio, se le 48 ore includono il weekend, cosa succede se la segnalazione è incompleta, chi risponde e chi sostituisce. Senza queste risposte il numero "48" non è misurabile.

## Definizioni proposte

| Voce | Proposta | Stato |
|---|---|---|
| Evento iniziale | Il deal esiste in "Deal immobiliari QRE", fase Segnalato, con **dati minimi**: riferimento dell'immobile (indirizzo o link all'annuncio), tipologia, contatto del segnalatore, fonte registrata. | DECISIONE sui dati minimi |
| Segnalazione incompleta | Entro 12 ore si chiede l'integrazione per iscritto. L'orologio delle 48 ore parte quando i dati minimi arrivano (`completaIl`). | DECISIONE |
| Orologio delle 48 ore | **Ore solari, weekend compreso**, coerente con la promessa pubblica attuale. | **DECISIONE**: se non c'è copertura nel weekend, o si assegna un sostituto che risponde, o si cambia il testo pubblico (per esempio "2 giorni lavorativi"). Non cambio le promesse senza conferma. |
| Cosa conta come "feedback motivato" | Un verdetto GO, WATCH o SCARTA con il motivo scritto e, per WATCH e SCARTA, la condizione o il prezzo che lo cambierebbe (modelli in `marketing/modelli-risposta-go-watch-scarta.md`). Una conferma di ricezione **non** conta. | Proposta |
| Documenti completi | Elenco minimo concordato per tipo di immobile, spuntato in HubSpot (`data_documenti_completi`). Senza elenco la finestra dei 7-10 giorni non parte. | DECISIONE sull'elenco |
| Finestra 7-10 giorni | Giorni solari dal giorno dei documenti completi. L'offerta arriva fra il 7° e il 10° giorno. | Proposta |
| Offerta vincolante | Solo dopo i controlli necessari (due diligence documentale e urbanistica, verifica della praticabilità). Se i controlli non sono finiti entro il 10° giorno, la comunicazione è scritta e motivata e l'immobile passa a WATCH: **non si promette un'offerta che i controlli non permettono**. | DECISIONE |
| Responsabile | `{{responsabile}}`: non assegnato. | **BLOCCATO**: serve il nome. |
| Sostituto | `{{sostituto}}`: non assegnato. | **BLOCCATO**: serve il nome. |
| Weekend e festivi | Il responsabile o il sostituto controlla le segnalazioni almeno una volta al giorno, anche sabato e domenica. Le festività nazionali sono in `packages/core/src/funnel.ts`; il patrono locale no. | DECISIONE |
| Escalation | A 24 ore senza feedback: promemoria al responsabile. A 40 ore: avviso al sostituto e a Pitágora. A 48 ore: ritardo registrato con il motivo. | Proposta |
| Dopo la lettera d'intenti | Nessuna rinegoziazione del prezzo salvo fatti nuovi **documentati**; ogni deroga si annota sul deal. | Già pubblico |

## Capacità: la verifica che manca

Il rispetto delle 48 ore dipende dal numero di segnalazioni e dal tempo di screening di ognuna. Non ho dati di volume né di tempo medio di screening: `{{segnalazioni_a_settimana}}` e `{{minuti_per_screening}}` sono segnaposto. Con quei due numeri si stima il carico settimanale (segnalazioni × minuti) e si decide se un solo responsabile basta. Fino ad allora la sostenibilità è **non verificata**.

## Pilota proposto: quattro settimane

Da confermare: finestra, canale agenti per primo, soglia minima di campione (proposta: 20 segnalazioni in target; è una scelta di prudenza, non una soglia statistica). Si misura con `metrichePilota()`:

- segnalazioni in target e completezza della fonte;
- feedback in tempo, in ritardo, in corso, non misurabili; tempo mediano;
- passaggi a documenti completi, offerta, acquisizione;
- tutto per canale.

Esiti ammessi: `nessun_evento`, `campione_insufficiente`, `misurato`. **Nessuno di questi è un successo.** Una simulazione prova che il calcolo funziona; gli esiti commerciali richiedono dati reali e non si deducono dalle visualizzazioni sui social.
