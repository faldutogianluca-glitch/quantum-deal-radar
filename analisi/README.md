# Analisi dei lotti

Modelli fix & flip con formule vive, costruiti con la skill
`moolaski-financial-analyst`. Fogli: Cover, Inputs (blu = dato o ipotesi
inserita a mano, con la fonte), CF mensile, Outputs, Checks. Lo scenario si
cambia in Inputs (1 base, 2 favorevole, 3 sfavorevole).

```bash
python3 analisi/modello_fix_flip.py arluno     # lotti in analisi/lotti_fix_flip.py
python3 .claude/skills/moolaski-financial-analyst/scripts/check_workbook.py analisi/arluno-carso-fix-and-flip.xlsx
```

Per un lotto nuovo si copia un blocco di `lotti_fix_flip.py` e si riscrive
ogni riga dalla perizia e dall'avviso: un valore senza fonte resta IPOTESI.

## Risultati al 18/10/2026

Prezzo massimo d'offerta = il piu' basso fra margine 30% sul costo e IRR 12%
ante imposte. Margini ante imposte.

| Lotto | Base / minima | Prezzo massimo (base / fav. / sfav.) | Margine alla minima (base / fav. / sfav.) | Lettura |
|---|---|---|---|---|
| 4642104 Milano, via Ornato 82 | 402.000 / 301.500 | 240.093 / 298.008 / 158.371 | 9,8% (base) | Sotto la minima anche nel favorevole; rischio sottotetto non determinabile |
| 4635523 Arluno, via Del Carso 2-4-6 | 112.800 / 84.600 | 69.221 / 83.207 / 48.491 | 14,3% / 28,5% / -4,0% | Non azionabile: all'offerta minima serve un'uscita di 1.781 EUR/mq per il 30% (1.339 per il pareggio) contro 1.450-1.700 dell'OMI ottimo; secondo avviso |
| 4642237 Basiano, via Manzoni 7 | 58.856 / 44.142 | 31.923 / 56.309 / -5.732 | 17,9% / 43,0% / -13,2% | Azionabile solo alla minima e solo se il sopralluogo conferma il favorevole (lavori leggeri, nessuna quota su copertura e facciate) |

Il radar dava Basiano "passa" (prezzo massimo 71.950): il Gate 0 usa lavori
standard (400 EUR/mq sulla superficie commerciale, 12 mesi) e non vede ne' lo
stato "da riordinare" ne' le parti comuni in pessimo stato. Il Gate 0 e' un
filtro, il modello e' la valutazione.

Nessuno dei tre lotti, ai prezzi attesi di aggiudicazione (1,20 x base),
raggiunge la soglia QRE. Sono unita' sotto i 200 mq, cioe' operazioni da
binario B: i candidati binario A si elencano con `node packages/server/dist/cli.js binario-a`.
