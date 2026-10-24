# Modello di attribuzione: canale, segnalatore e fonte del deal

Bozza del 24/10/2026 da approvare. **Non applicata in HubSpot**: ogni modifica al CRM richiede la conferma di Pitágora su una modifica concreta (sezione "Modifiche proposte").

## Stato verificato in HubSpot (sola lettura dello schema, 24/10/2026)

| Elemento | Stato |
|---|---|
| Pipeline deal | Due: "Sales Pipeline" (predefinita di HubSpot) e **"Deal immobiliari QRE"** (id 4205981913). Non esiste una pipeline "Quantum RE sourcing". |
| Fasi di "Deal immobiliari QRE" | Segnalato (5%) → Screening QRE (10%) → WATCH (20%) → GO – Due diligence (40%) → Offerta presentata (60%) → Acquisito (100%) / SCARTA / Perso (0%) |
| Proprietà del deal per fonte o segnalatore | **Nessuna trovata** cercando "fonte", "source", "utm", "canale", "partner", "segnalat", "origine", "provenienza", "referral", "agente". Esistono solo le proprietà automatiche di HubSpot (`hs_analytics_source`, `hs_analytics_source_data_1`, ultime sorgenti, `hs_object_source_label`). |
| Proprietà del contatto per UTM | Nessuna `utm_source`, `utm_medium`, `utm_campaign`. Esiste `fonte_mrt`, di un altro progetto (Milano Retail Tour). |

Conseguenza: la regola di `funnel/CLAUDE.md` "ogni deal ha una Fonte tracciata in HubSpot" **non è oggi sostenuta da un campo**. È un'indicazione di lavoro, non un controllo.

## Tre cose diverse, tre campi diversi

| Concetto | Domanda | Dove vive | Si può riscrivere? |
|---|---|---|---|
| **Canale marketing** | Da quale post, bio o link è arrivato il contatto? | Sorgente automatica di HubSpot (`hs_analytics_source*`, immutabile) più `utm_source`, `utm_medium`, `utm_campaign` salvati dal modulo | No. La prima attribuzione si conserva; i contatti successivi si aggiungono, non la sostituiscono. |
| **Partner segnalatore** | Chi ha portato l'immobile? (agente, servicer, professionista) | Associazione del deal al contatto/azienda con etichetta "Segnalatore" | Solo con una nota che spiega perché. |
| **Fonte del deal** | Da che tipo di origine arriva l'operazione? | Proprietà del deal `fonte_deal` (enumerazione, vedi sotto) | Solo da una persona, con motivo. |

Un agente può arrivare da LinkedIn (canale), essere il segnalatore del deal e il deal avere come fonte "agente". Se si tengono in un campo solo, un'analisi per rete finisce per contare gli agenti come "social" e viceversa.

## Valori di `fonte_deal`

`agente`, `proprietario_diretto`, `servicer_npl`, `asset_manager_sgr`, `professionista` (curatore, delegato, notaio, commercialista), `portale_aste`, `ricerca_interna`, `altro`. Sono i quattro canali di `funnel/CLAUDE.md` più il canale secondario e le fonti proprie del radar.

## Regole di attribuzione

1. **Prima attribuzione immutabile.** Il canale iniziale di un contatto non si cambia: HubSpot lo mantiene in `hs_analytics_source`. Un secondo passaggio è una nuova attività, non una riscrittura.
2. **Niente attribuzioni presunte.** Se non c'è un UTM né una fonte dichiarata, il canale è "non noto", non "social".
3. **Un link, una rete.** Ogni rete usa il proprio `utm_source` (vedi `marketing/link-tracciati.md`). Instagram non si registra come Facebook.
4. **Il deal eredita, non indovina.** Alla creazione il deal copia dal contatto il canale iniziale; il segnalatore e la fonte si compilano a mano o dal modulo.
5. **Un contatto, un deal per immobile.** Un invio ripetuto dello stesso modulo aggiorna il contatto esistente (HubSpot unisce per email) e non crea un secondo deal per lo stesso immobile.

## Modifiche proposte (da approvare, non eseguite)

| # | Dove | Modifica | Perché |
|---|---|---|---|
| 1 | Contatto | Creare `utm_source`, `utm_medium`, `utm_campaign` (testo, campo nascosto del modulo) | Salvano il parametro di arrivo; oggi non esistono. |
| 2 | Deal | Creare `fonte_deal` (enumerazione, valori sopra) obbligatoria alla creazione in "Deal immobiliari QRE" | Rende vera la regola "niente deal senza fonte". |
| 3 | Deal | Creare `canale_marketing_iniziale` (testo), copiato dal contatto alla creazione | Tiene il canale accanto al deal anche se il contatto cambia. |
| 4 | Deal | Etichetta di associazione "Segnalatore" tra deal e contatto/azienda | Distingue il segnalatore dal proprietario o dal compratore. |
| 5 | Deal | Proprietà data `data_feedback`, `data_documenti_completi`, `data_offerta` | Servono a misurare SLA e tempi (vedi `sla-agenti.md`). |
| 6 | Moduli | Campi nascosti `utm_*` in tutti i moduli attivi | Senza, l'attribuzione ai canali non si legge. |
| 7 | Pipeline | **Usare "Deal immobiliari QRE"; non crearne un'altra.** Nessuna nuova fase richiesta: Segnalato = segnalazione ricevuta; Screening QRE = in valutazione (orologio delle 48 ore); WATCH / GO – Due diligence / SCARTA = verdetto; Offerta presentata; Acquisito | Evita due pipeline in parallelo. |

## Cosa va letto nel report

Segnalazioni in target per canale e per fonte del deal; completezza della fonte (canale e segnalatore entrambi presenti); tempi e percentuale di risposte entro SLA; passaggi a documenti, offerta e acquisizione; tempo impiegato per canale. Le definizioni e la funzione di calcolo sono in `packages/core/src/funnel.ts`.
