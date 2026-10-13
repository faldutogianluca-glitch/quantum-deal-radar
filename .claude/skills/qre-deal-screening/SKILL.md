---
name: "qre-deal-screening"
description: Seleziona e valuta i deal di Quantum Re con il metodo QRE (Gate 0 sulle aste, binari A/B, prezzo massimo d'offerta) e restituisce un verdetto GO / WATCH / SCARTA con conto economico, soglie, sensitivity e prezzo massimo d'acquisto. Usala ogni volta che Pitágora condivide un immobile o un elenco di aste da valutare (annuncio, avviso d'asta, perizia, dossier NPL, palazzina da frazionare, cambio di destinazione d'uso, il file "Aste in evidenza") o chiede se un deal "sta in piedi", quanto offrire, che margine fa, quali aste selezionare o di confrontare più immobili, anche se non nomina QRE.
---

# QRE Deal Screening

Questa skill applica il metodo d'investimento di Quantum Re S.r.l. (aste giudiziarie, distressed, NPL, club deal in Lombardia, ticket 200k–1,2M €). L'obiettivo è una decisione rapida e difendibile davanti ai soci di un club deal: per questo il verdetto viene prima di tutto e ogni numero dichiara le sue ipotesi.

## Soglie del metodo

- Margine lordo >= 30% per i club deal distressed (Milano e provincia). Formula: (valore post-rigenerazione − costi di acquisto − costi di rigenerazione) / costi totali. Coincide con il ROI lordo sul capitale investito.
- ROI lordo minimo assoluto 20%: sotto questa soglia è sempre SCARTA.
- IRR annuo >= 12%.
- Logica di asimmetria alla Zell: conta quanto si può perdere nel caso peggiore, non solo quanto si guadagna nel caso base.

## Costi dei lavori

- **Ristrutturazione leggera**: 400 €/mq, più 5% di imprevisti e 10 €/mq di pratiche.
- **Cambio d'uso o frazionamento**: 1.200 €/mq, più 5% di imprevisti e 10 €/mq di pratiche.

Con lavori da 1.200 €/mq il valore di vendita va stimato sul nuovo o ristrutturato per il taglio previsto (per esempio bilocali), non sulla media di zona, altrimenti ogni conversione risulta SCARTA. Se la perizia mostra un degrado importante, stima i lavori a parte anche per un intervento "leggero".

## Gate 0 per le aste (prima della perizia)

Ogni asta passa un controllo di 5 minuti sui dati dell'avviso. Dettagli, dati storici e formula in `references/gate0-aste.md`.

- **Zona**: Milano e comuni della città metropolitana già presenti nello storico; fuori Lombardia si scarta.
- **Tipologia**: residenziale, o non residenziale con cambio d'uso possibile.
- **Prezzo massimo QRE / offerta minima ≥ 1,10**; sotto 1,00 non si partecipa, tra 1,00 e 1,10 solo all'offerta minima.
- **Sconto dell'offerta minima sul mercato ≥ 50%** (con lavori leggeri).
- **Stato occupazionale**: libero o liberabile entro 12 mesi.
- **Perizia**: semaforo non ROSSO con `perizia-analyzer`.

Due binari:
- **A. Club deal (prioritario)**: almeno 200 mq, frazionabile o convertibile, ticket 200.000-1.200.000 €, margine ≥ 30%, IRR ≥ 12%. È dove lo storico mostra un vantaggio: le aste grandi e complesse si vincono vicino all'offerta minima.
- **B. Unità singola**: 60-150 mq, margine minimo 20%. Le aste contese su piccoli appartamenti finiscono in mediana a 1,59 volte l'offerta minima: non inseguire.

## Filtri di screening (prima dei numeri)

Un immobile entra nella valutazione solo se:
- ha superficie di almeno 200 mq;
- ha potenziale di frazionamento o di cambio destinazione d'uso in residenziale.

Si scarta subito in caso di: vincoli di Soprintendenza non risolvibili, ubicazione marginale, condizioni strutturali con costi di rigenerazione superiori al recuperabile. Se un filtro fallisce, dillo in prima riga e fermati: niente conto economico su un immobile fuori perimetro, salvo che Pitágora lo chieda.

## Procedura

1. Raccogli i dati: indirizzo, superficie commerciale e SLP, categoria catastale, stato occupazionale, prezzo base / offerta minima (in asta l'offerta minima è il prezzo base ridotto di un quarto), costi di rigenerazione, valore di rivendita (€/mq e numero/taglio delle unità), durata in mesi.
2. Se c'è una perizia CTU, usa prima la skill `perizia-analyzer` e porta qui i costi nascosti che trova (sanatorie, spese condominiali arretrate, liberazione).
3. Calcola i numeri con lo script, mai a mano:
   ```bash
   python scripts/qre_calc.py --acquisto <€> --oneri <€> --rigenerazione <€> \
     --valore-post <€> --mesi <n> --costi-vendita-pct <%> --soglia-margine 30
   ```
   Includi negli oneri imposte, notaio, professionisti e oneri urbanistici del cambio d'uso. Se Pitágora non indica i costi di vendita, usa il 3% e dichiaralo.
4. Verifica che il valore di rivendita sia credibile: €/mq di zona per il nuovo/ristrutturato e taglio delle unità. Se fai ricerche, cita le fonti; se stimi, scrivi "stima da verificare".
5. Controlla l'avviso di vendita: scadenza offerte, modalità (sincrona o asincrona), rilancio minimo, termine del saldo (di solito 120 giorni, perentorio). Se offri sotto il prezzo base, segnala il rischio di istanze di assegnazione ex art. 588 c.p.c. Lo stato occupazionale lo decidono la legge e la perizia, non la formula dell'avviso: un contratto opponibile resta tale.
6. Assegna il verdetto finale. Lo script dà solo il verdetto numerico: il verdetto QRE tiene conto anche di rischi e asimmetria. Un deal numericamente GO con un rischio legale aperto diventa WATCH.

## Formato di output

Usa sempre questa struttura:

**Verdetto: GO / WATCH / SCARTA** — motivazione in una frase con il numero chiave.

| Voce | Importo |
| --- | --- |
| Acquisto | |
| Oneri e professionisti | |
| Rigenerazione | |
| Costo totale | |
| Valore post-rigenerazione | |
| Costi di vendita | |
| Utile lordo | |
| Margine / ROI lordo | |
| IRR annuo | |

Poi, in prosa breve:
- **Sensitivity**: come cambiano margine e IRR con vendita −10% / −20%, rigenerazione +15%, tempi +6 mesi.
- **Prezzo massimo d'acquisto** che rispetta la soglia di margine: è il numero da portare in offerta.
- **Asimmetria**: caso peggiore realistico e come limitarlo (prezzo d'ingresso, uscita alternativa, frazionamento parziale).
- **Rischi e dati mancanti**: cosa va verificato e da dove (perizia, Comune, catasto, amministratore di condominio).

Dopo il verdetto, proponi di registrare o spostare il deal nella pipeline HubSpot "Deal immobiliari QRE" (Segnalato → Screening QRE → WATCH → GO – Due diligence → Offerta presentata → Acquisito / SCARTA-Perso), con la data dell'asta come data di chiusura. Chiedi sempre conferma prima di scrivere in HubSpot.

Quando confronti più immobili, aggiungi una tabella di sintesi: immobile, verdetto, margine, IRR, prezzo max, rischio principale. Ordina dal migliore al peggiore.

## Avvertenze

- Il calcolo dell'IRR presuppone esborso a t0 e incasso a fine operazione, senza leva. Se c'è finanziamento o vendita frazionata, dillo e ragiona sui flussi reali.
- Se i dati forniti non tornano (per esempio un totale diverso dalla somma delle voci), segnalalo prima di procedere.
- Le superfici del file "Aste in evidenza" possono essere sbagliate: usa sempre la superficie della perizia (commerciale o omogeneizzata).
- L'imposta di registro (9% per la società) si calcola sul prezzo offerto: alzando l'offerta crescono anche gli oneri.
- La valutazione non sostituisce la due diligence legale e tecnica.
