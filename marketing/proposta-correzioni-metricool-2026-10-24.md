# Proposta di correzioni Metricool — 24/10/2026 (DA APPROVARE, nulla è stato modificato)

Fonte: lettura in sola lettura di Metricool (brand "Quantum RE Srl"): 121 post, 75 programmati e 46 bozze, finestre 24/10–31/12, 0 finestre non lette. Riconciliazione con `marketing/calendario-pubblicazioni.json`: nessuno scollamento di stato o orario per le voci con `metricool_uuid`.

## 1. Nome sbagliato in due bozze
| Post | Data | Reti | Correzione proposta |
|---|---|---|---|
| 402347741 | 05/11 12:30 | Facebook, Instagram, YouTube | "Quantum Re" → "Quantum RE" |
| 397047697 | 19/11 18:15 | Facebook, Instagram | "Quantum Re" → "Quantum RE" |
| 402344434 (titolo TikTok) | 28/10 | TikTok | "Criteri di acquisto Quantum Re" → "…Quantum RE" |

## 2. Bozze segnaposto del 31/12 alle 23:00
402751640, 402751654, 402751674: testo "[CANCELLARE: …]", senza nota AI. Proposta: cancellarle, o tenerle e ignorarle. Nessuna è programmata.

## 3. Bozze senza voce nel calendario (4)
397047264 (17/11), 397047697 (19/11), 397047787 (24/11), 397047838 (26/11), tutte alle 18:15. Proposta: decidere se aggiungerle al calendario o eliminarle.

## 4. Attribuzione: un solo `utm_source=facebook` per più reti (14 post)
Per la regola del 24/10 (`marketing/link-tracciati.md`) ogni rete ha il proprio `utm_source`. Oggi i click di Instagram, TikTok e YouTube risultano Facebook.
- Quattro reti (Facebook, Instagram, TikTok, YouTube): 402751987 (25/10), 402752433 (29/10), 402753237 (01/11), 404480903 (05/11), 402755341 (08/11), 402756183 (12/11), 402756206 (15/11), 404502116 (22/11), 404502221 (29/11), 404502307 (06/12).
- Due reti (Facebook, TikTok), campagna libro, 10:00: 402756277 (18/11), 402757011 (25/11), 402778581 (09/12), 402781083 (16/12).

Opzioni:
- **A (consigliata, a basso rischio):** non toccare i post; nel report l'attribuzione di questi 14 si dichiara "aggregata Facebook/Instagram/TikTok/YouTube". Nessun rischio sui post già pronti.
- **B:** dividere ogni post per rete, ognuno con il proprio link. Più preciso, ma moltiplica i post e va rifatta la programmazione.
- Su TikTok e Instagram il link nella didascalia non è cliccabile: l'attribuzione vera passa dalla bio (già tracciata per rete). Per questi due l'opzione B darebbe poco.

## 5. Dati di contorno
Parole vietate: nessuna in nessun post. Nota AI esatta: 118 su 121 (le 3 mancanti sono le bozze segnaposto). Link Amazon del libro: 23 post. 64 post non hanno link tracciato; molti citano solo `valutazione.quantumre.it (link in bio)`, coerente con la regola per i testi non cliccabili.

## 6. Calendario locale
Il testo locale di molte voci (`primo_commento`, rinvii) non coincide con Metricool: lo script segnala 105 voci come `copia_locale`. Va riallineato dal testo reale, non il contrario. Non fatto: serve la tua conferma sul metodo (esportazione dal testo Metricool).
