---
name: qre-intake-segnalazioni
description: Gestisce l'arrivo di una nuova segnalazione di immobile o credito da un partner (agente, servicer, asset manager, curatore, professionista, proprietario) — triage rapido Gate 0, registrazione della fonte per HubSpot, risposta al segnalatore entro 48h con feedback motivato (GO / WATCH / SCARTA e a che prezzo diventerebbe interessante). Usala ogni volta che Pitágora incolla o inoltra un immobile ricevuto da qualcuno ("mi ha mandato", "segnalazione", "l'agente mi propone", "cosa rispondo a"), o chiede come rispondere a chi gli ha proposto un deal, anche se non nomina l'intake.
---

# QRE Intake Segnalazioni

La velocità e la qualità della risposta al segnalatore sono il vantaggio competitivo di Quantum Re. Ogni segnalazione riceve una risposta motivata entro 48 ore, anche quando è uno scarto.

## Flusso

1. **Identifica la fonte**: nome, tipo (agente / servicer / AM-SGR / curatore-delegato / professionista / proprietario / altro), livello se noto (A/B/C), canale di arrivo. Se manca, chiedilo in una riga.
2. **Estrai i dati minimi**: indirizzo, superficie, destinazione catastale, stato, occupazione, prezzo richiesto o base d'asta, situazione legale (ipoteche, pignoramento, procedura), documenti disponibili.
3. **Triage Gate 0** (10 secondi, prima dell'analisi completa):
   - Fuori buy box evidente (zona marginale, ticket fuori range, vincoli non risolvibili, nessun potenziale di frazionamento/cambio d'uso per il binario A) → SCARTA rapido.
   - Dati insufficienti → WATCH con lista precisa dei documenti mancanti.
   - Dentro il buy box → passa all'analisi.
4. **Analisi**: per la valutazione economica usa la skill **qre-deal-screening**; se c'è una perizia usa anche **perizia-analyzer**. Non duplicare qui i loro calcoli.
5. **Risposta al segnalatore** (vedi sotto).
6. **Scheda HubSpot** (vedi sotto).

## Risposta al segnalatore

Tre modelli, adattati al canale (email o WhatsApp), firmati Gianluca Falduto:

- **GO / interesse**: ringrazia, conferma interesse, indica i prossimi passi concreti (sopralluogo, documenti, tempistica dell'offerta), ricorda all'agente il mandato di rivendita se applicabile.
- **WATCH**: elenca esattamente cosa serve per decidere e la data entro cui rispondi dopo averlo ricevuto.
- **SCARTA**: motivo in una frase e, quando ha senso, **il prezzo o la condizione a cui diventerebbe GO** ("a €X tutto compreso lo guarderemmo"). Chiudi chiedendo il prossimo immobile simile al buy box.

Il feedback motivato allena il partner: più è specifico, più le segnalazioni successive saranno in target.

## Scheda HubSpot (output standard)

```
Deal: [indirizzo, comune]
Fonte: [nome] — tipo: [...] — livello: [A/B/C] — canale: [...]
Data ricezione: [...]   Data risposta: [...]   Ore alla risposta: [...]
Stage pipeline "Deal immobiliari QRE": [Segnalato / Screening QRE / WATCH / GO – Due diligence / SCARTA-Perso]
In buy box: [sì/no]   Binario: [A/B]
Motivo scarto (se SCARTA): [...]   Prezzo a cui diventerebbe GO: [...]
Prossimo step + data: [...]
```

Se il connettore HubSpot è attivo, proponi di creare o aggiornare deal e contatto con questi campi, ma chiedi conferma prima di scrivere.

## Regole

- Mai lasciare una segnalazione senza risposta: lo scarto silenzioso brucia il partner.
- Mai scavalcare l'agente che ha segnalato, anche se il proprietario è rintracciabile.
- Non condividere con un segnalatore informazioni riservate di altri deal o di altri partner.
