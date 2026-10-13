---
name: "perizia-analyzer"
description: Analizza una perizia di stima CTU di un'asta giudiziaria (o una perizia bancaria / di un dossier NPL) ed estrae red flag, costi nascosti e un semaforo di rischio pronto per lo screening QRE. Usala ogni volta che Pitágora carica o cita una perizia, un avviso di vendita, una relazione del CTU o un documento del PVP, o chiede "cosa c'è di strano in questa perizia", abusi, occupazione, formalità, spese condominiali o costi di liberazione, anche se non usa la parola "perizia".
---

# Perizia Analyzer

Questa skill legge la perizia come la leggerebbe un investitore esperto in aste: cerca ciò che il prezzo base non mostra. Il risultato alimenta la skill `qre-deal-screening`, quindi ogni costo nascosto va quantificato, anche a stima.

Per leggere il PDF segui prima la skill di lettura PDF disponibile (pdf-reading). Le perizie spesso sono scansioni: se il testo non si estrae, usa l'OCR o guarda le pagine come immagini.

## Cosa estrarre

Lavora sezione per sezione con la checklist in `references/checklist-perizia.md`. In sintesi:

1. **Identificazione**: tribunale, numero di procedura (R.G.E.), lotto, indirizzo, dati catastali, superficie commerciale.
2. **Conformità**: catastale e urbanistico-edilizia. Per ogni difformità: tipo, se sanabile, costo stimato dal CTU e se è già dedotto dal valore.
3. **Stato di occupazione**: libero, occupato dall'esecutato o da terzi. Per i contratti di locazione: data certa e registrazione rispetto al pignoramento (opponibilità), durata, canone.
4. **Formalità**: quelle che il decreto di trasferimento cancellerà (ipoteche, pignoramenti) e quelle che restano a carico dell'acquirente (servitù, vincoli, domande giudiziali, convenzioni urbanistiche).
5. **Condominio**: spese insolute. L'aggiudicatario risponde in solido delle spese dell'anno in corso e di quello precedente (art. 63 disp. att. c.c.).
6. **Stato manutentivo e impianti**: conformità impianti, APE, interventi urgenti.
7. **Vincoli**: Soprintendenza, paesaggistici, prelazioni.
8. **Valutazione del CTU**: metodo, €/mq usato, comparabili, deprezzamenti applicati (assenza di garanzia, stato, occupazione) e se sono congrui.
9. **Dati di vendita**: prezzo base, offerta minima (prezzo base − 25%), rilancio minimo, data asta, custode, tentativi precedenti andati deserti.
10. **Tipo di procedura**: esecuzione o giudizio di divisione. Nella divisione l'occupante è spesso un comproprietario e la domanda di divisione trascritta compare tra le formalità: chiedi al delegato se verrà cancellata.
11. **Superficie reale**: confronta la superficie della perizia con quella indicata da Pitágora o nel file "Aste in evidenza" e segnala ogni differenza, perché cambia tutto lo screening.

Se Pitágora carica anche l'avviso di vendita, leggilo insieme alla perizia: scadenza e modalità delle offerte, termine del saldo, istanze di assegnazione, eventuali precisazioni del delegato su accessi o pertinenze.

## Formato di output

**Semaforo: VERDE / GIALLO / ROSSO** — una frase sul rischio principale.

Poi:

| Area | Esito | Costo nascosto stimato | Note |
| --- | --- | --- | --- |
| Conformità urbanistica | | | |
| Conformità catastale | | | |
| Occupazione / liberazione | | | |
| Formalità non cancellabili | | | |
| Spese condominiali | | | |
| Impianti e manutenzione | | | |
| Vincoli | | | |

- **Totale costi nascosti stimati**: la somma, con la sua forchetta.
- **Red flag**: elenco breve, dalla più grave.
- **Domande aperte**: cosa chiedere al custode, al Comune, all'amministratore o all'avvocato.
- **Dati per lo screening QRE**: prezzo base, offerta minima, superficie, costi nascosti, tempi di liberazione stimati. Se Pitágora vuole il verdetto, passa questi dati a `qre-deal-screening`.

Cita sempre la pagina della perizia da cui prendi un dato: Pitágora deve poterlo ritrovare in pochi secondi.

## Semaforo: criteri

- **ROSSO**: abusi non sanabili, contratto di locazione opponibile di lunga durata (attenzione ai 4+4 con rinnovo automatico se la scadenza è passata senza disdetta), formalità gravi non cancellabili, accesso o servizi (fognatura, passo) su terreni di terzi senza servitù trascritta, vincoli che bloccano frazionamento o cambio d'uso.
- **GIALLO**: difformità sanabili con costo rilevante, occupazione da liberare, spese condominiali elevate, perizia datata o con comparabili deboli.
- **VERDE**: nessuna delle precedenti, oppure solo costi minori già quantificati.

## Avvertenze

- La perizia può essere datata: verifica la data e segnala se lo stato potrebbe essere cambiato.
- L'analisi non sostituisce il parere dell'avvocato. Per Preaste e per i club deal resta obbligatoria la revisione legale.
