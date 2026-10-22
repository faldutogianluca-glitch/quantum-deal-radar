# Test A/B: stile grafico delle pillole (ottobre-novembre 2026)

**Domanda:** a parità di contenuto e di formato, rende di più lo stile dark-gold (A) o il blu e arancio (B)?

**Unica variabile:** lo stile dell'immagine. Testo, rubrica, formato (1200×1200 su LinkedIn, JPG 1080×1080 su Instagram e Facebook), nota AI, CTA e disclaimer restano uguali tra A e B. Le immagini si generano con `THEME=gold` (A) o `THEME=blu` (B) in `scripts/immagini_pillole.py`.

## Calendario (approvato da Pitágora il 13/10/2026)

| Pillola | Data e ora | Variante |
|---|---|---|
| n. 4 Consap under 36 | ven 16/10, 08:15 | A dark-gold (programmata) |
| n. 5 Caparra | lun 19/10, 12:45 | B blu (programmata) |
| n. 6 Prima casa all'asta | lun 26/10, 12:45 | A dark-gold (programmata) |
| n. 7 Catasto e Comune | ven 30/10, 08:15 | B blu (programmata) |
| n. 8 APE | lun 2/11, 12:45 | B blu (programmata) |
| n. 9 Perizia d'asta | ven 6/11, 08:15 | A dark-gold (programmata) |
| n. 10 Costi accessori | lun 9/11, 12:45 | A dark-gold (estensione, programmata) |
| n. 11 Leggere un annuncio | ven 13/11, 08:15 | B blu (estensione, programmata) |
| n. 12 Detrazione interessi | lun 16/11, 12:45 | vincitore, deciso il 14/11 |

Ogni stile esce sia di lunedì sia di venerdì, così il giorno non falsa il confronto. Le stesse immagini escono anche su Instagram e Facebook alle 18:15, per avere un campione più ampio.

## Cosa misuriamo (Metricool, 7 giorni dopo ogni post)

- Tasso di interazione = (reazioni + commenti + condivisioni) / impression
- Impression
- Commenti, perché ogni pillola chiude con una domanda

**Regola di decisione:** vince lo stile con un tasso di interazione medio più alto di almeno il 20% su 3 post per variante. Sotto il 20% è un pareggio: si sceglie per coerenza di brand. Con 6 post il risultato è indicativo, non statistico.

## Fuori dal test

Nome ("Quantum RE" o "Quantum Re") e nota AI non si testano: non spostano le metriche in modo misurabile e la nota AI deve essere identica ovunque per ragioni di trasparenza. Vanno decisi una volta sola.

## Estensione (13/10/2026)

Le pillole 10 e 11 allungano il test a 4 post per variante. Ogni stile esce 2 volte di lunedì e 2 volte di venerdì.

**Sabato 14/11:** le pillole 4–9 hanno già 7 giorni di dati. Si leggono le metriche, si applica la regola del 20% e si sceglie lo stile della pillola 12.
- La pillola 12 è già programmata con l'immagine A. Se vince B, si aggiorna il post in Metricool con la versione `-blu` (testo approvato, cambia solo l'immagine).
- Con un pareggio si resta su A.

Le pillole 10 e 11 entrano nel conteggio finale quando avranno i loro 7 giorni (16/11 e 20/11).

**Pillole 13–15 (20/11, 23/11, 27/11):** escono nello stile vincitore. Le bozze partono con l'immagine A; se vince B, il 14/11 si sostituiscono con le versioni `-blu`, già pronte in `output/immagini/` e `marketing/social/pillole/`.

## Aggiornamento del 22/10/2026

Dalla pillola 6 in poi le copie Instagram e Facebook sono in bozza (decisione di Pitágora: niente immagini statiche su IG/FB, dove raggiungono 0-4 persone). Il test si legge solo su LinkedIn. Dal 26/10 tutti i post LinkedIn escono alle 11:00 invece che alle 08:15/12:45: il cambio vale per entrambe le varianti, quindi non sposta il confronto. Il promemoria del 14/11 è stato aggiornato di conseguenza.
