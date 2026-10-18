# Note per Quantum Re: aste giudiziarie in Italia

Aggiunta del progetto quantum-deal-radar alla skill originale (looskis/moolaski,
commit 9915aae, MIT). La logica dei modelli resta quella delle guide; cambiano le
voci. Ogni numero porta la sua fonte o la scritta "ipotesi": e' la regola del
progetto (CLAUDE.md, "un numero dichiara da dove viene").

## Dove prendere gli input

| Input | Fonte nel radar | Note |
|---|---|---|
| Prezzo base, offerta minima, rilancio | PVP (archivio, colonne prezzo; offerta minima = 75% della base) | Dato |
| Superficie, valore di perizia, conformita', occupazione | Perizia letta dal radar (`data/perizie_pvp.json`) o perizia allegata | Dato, citare la formula |
| Aste gia' andate deserte | Archivio (`n_esperimenti_deserti`) | Inferenza: deserta o decaduta |
| Valore di uscita | Comparabili ristrutturati se ci sono; altrimenti OMI stato OTTIMO della zona (Agenzia Entrate, semestre importato) | Dato con fonte e semestre |
| Prezzo d'aggiudicazione atteso | Moltiplicatore QRE giudiziarie 1,20 x base (storico QRE, si ricalibra sugli esiti) | Stima del progetto |

## Voci italiane al posto di quelle americane

| Guida originale | In Italia (acquisto in asta da parte di una societa') | Stato |
|---|---|---|
| Closing costs all'acquisto | Imposta di registro 9% sul prezzo di aggiudicazione (societa': niente prezzo-valore), ipotecaria e catastale 50 EUR ciascuna; compenso del delegato per il trasferimento; cancellazione dei gravami | **Ipotesi da verificare** con il parere fiscale previsto dalla decisione del 18/10/2026: regimi agevolati per imprese che rivendono, IVA se il debitore e' un'impresa |
| Property tax, insurance | IMU (aliquota del comune), assicurazione, utenze | Ipotesi, per comune |
| Arretrati | Spese condominiali dell'anno in corso e del precedente (art. 63 disp. att. c.c.): l'aggiudicatario ne risponde in solido | Dato dalla perizia quando le riporta |
| Hard money / construction loan | Capitale proprio del club deal (cauzione 10% all'offerta, saldo entro 120 giorni); eventuale mutuo per aste | Struttura da decidere |
| Marketing period | Tempi giudiziari prima dei lavori: saldo (fino a 120 gg), decreto di trasferimento (1-3 mesi), liberazione se occupato (3-12 mesi); poi lavori e vendita | Durata totale realistica 20-24 mesi (decisione del 18/10/2026) |
| Rehab budget | Lavori a Milano 2026: 800-1.200 EUR/mq per una ristrutturazione completa; binario A 1.200 EUR/mq + 5% imprevisti + 10 EUR/mq pratiche | **Ipotesi** dichiarata nella decisione, da ricalibrare sul consuntivo di Bollate |
| Selling costs | Agenzia 3% + IVA sul prezzo di vendita (ipotesi); notaio a carico dell'acquirente | Ipotesi |
| Income tax | IRES 24% sull'utile della societa' (piu' IRAP sul valore della produzione, da verificare) | Aliquota di legge; base imponibile da parere |

## Soglie QRE

Margine obiettivo 30% sul costo totale (soglia minima 20%), IRR minimo 12%, ticket
200 mila - 1,2 milioni (memoria del progetto, `docs/economia-deal-binario-b.md`).

## Formato

Rispondi in italiano; nel file Excel etichette in italiano, importi in EUR, date
gg/mm/aaaa. Il `Cover` dice il prezzo massimo d'offerta, il punto di pareggio sul
valore di uscita e le ipotesi da confermare.
