# Economia del deal: binario B (unita' singola)

Decisione del 18 ottobre 2026: l'osservatorio delle aste statali parte dal
binario B. Questo documento fissa i numeri con cui un lotto si compra o si
scarta. I calcoli seguono il metodo QRE (script `qre_calc.py` della skill di
screening); i valori di mercato sono **stime da verificare** sulla microzona
prima di ogni offerta.

## Il perimetro

| Parametro | Binario B |
| --- | --- |
| Taglio | 60-150 mq, residenziale |
| Intervento | Ristrutturazione leggera: 400 EUR/mq + 5% imprevisti + 10 EUR/mq di pratiche |
| Margine lordo minimo | 20% (soglia assoluta del metodo) |
| Margine obiettivo in offerta | 30%, per reggere un errore del 10% sul prezzo di uscita |
| IRR annuo minimo | 12% |
| Durata di riferimento | 12 mesi: aggiudicazione e saldo, 3-4 mesi di lavori, vendita |
| Uscita | Vendita a privato, costi di vendita 3% |

Il Gate 0 dei 200 mq vale per il binario A e non si applica qui: nel binario
B il filtro di superficie e' 60-150 mq.

## Struttura dei costi

Per ogni lotto:

- **Acquisto:** prezzo di aggiudicazione.
- **Imposta di registro 9%** sul prezzo (cessione da ente non soggetto IVA a
  societa'), piu' ipotecaria e catastale fisse (100 EUR). Sale con l'offerta.
- **Costi fissi 5.800 EUR:** APE 300, utenze 500, gestione 5.000.
- **Notaio e professionisti:** 3.000 EUR, stima da verificare.
- **Lavori:** mq x 430 EUR (400 + 5% imprevisti + 10 di pratiche).
- **Vendita:** 3% del valore di uscita.

## Il prezzo massimo

```
P_max = (V x 0,97 / (1 + soglia) - mq x 430 - 8.900) / 1,09
```

dove V e' il valore di vendita a ristrutturazione fatta e 8.900 EUR sono costi
fissi, imposte fisse e notaio. Prezzi massimi d'aggiudicazione, arrotondati:

| Valore ristrutturato | 70 mq | 100 mq | 140 mq | Sconto sul valore |
| --- | --- | --- | --- | --- |
| 3.000 EUR/mq | 108k / 120k | 158k / 175k | 224k / 248k | 41-43% |
| 3.500 EUR/mq | 132k / 146k | 192k / 212k | 272k / 300k | 39-40% |
| 4.000 EUR/mq | 156k / 172k | 226k / 249k | 320k / 352k | 37-39% |
| 4.500 EUR/mq | 180k / 198k | 260k / 286k | 368k / 404k | 36-37% |
| 5.000 EUR/mq | 204k / 224k | 295k / 323k | 416k / 456k | 35-36% |
| 6.000 EUR/mq | 252k / 276k | 363k / 397k | 512k / 560k | 33-34% |

In ogni cella il primo numero e' il prezzo con margine 30% (da portare in
offerta), il secondo quello con margine 20% (tetto oltre cui non si sale). Lo
sconto e' calcolato al margine 20%.

**La regola pratica:** nel binario B si compra solo con almeno il 35-40% di
sconto sul valore ristrutturato. Piu' la zona e' economica, piu' sconto serve,
perche' i lavori pesano di piu' sul totale.

## Caso di riferimento

Appartamento di 100 mq, valore ristrutturato 4.500 EUR/mq (450.000 EUR, stima
da verificare), aggiudicato a 260.000 EUR.

| Voce | Importo |
| --- | --- |
| Acquisto | 260.000 |
| Oneri e professionisti | 32.300 |
| Rigenerazione | 43.000 |
| Costo totale | 335.300 |
| Valore post-rigenerazione | 450.000 |
| Costi di vendita (3%) | 13.500 |
| Utile lordo | 101.200 |
| Margine / ROI lordo | 30,2% |
| IRR annuo (12 mesi) | 30,2% |

Verdetto numerico: GO. Prezzo massimo per la soglia del 20%: 288.450 EUR.

| Scenario | Margine | IRR |
| --- | --- | --- |
| Base | 30,2% | 30,2% |
| Vendita -10% | 17,2% | 17,2% |
| Vendita -20% | 4,1% | 4,1% |
| Lavori +15% | 27,7% | 27,7% |
| Tempi +6 mesi | 30,2% | 19,2% |

**Dove si rompe il modello.** I lavori e i tempi pesano poco; il prezzo di
uscita pesa tutto. Con un'uscita del 10% piu' bassa, un deal comprato al 30%
scende al 17% e va sotto la soglia del 20%. Per questo si offre al prezzo
calcolato col 30% e il 20% resta il tetto, non l'obiettivo.

## Asimmetria

- **Caso peggiore realistico:** uscita -20% e sei mesi in piu'. Margine circa
  4%, capitale restituito, nessuna perdita.
- **Uscita alternativa:** locazione. A 100 mq e un canone stimato di 1.400-1.600
  EUR/mese su Milano semicentrale (stima da verificare), il rendimento lordo
  sul costo totale e' circa 5-5,5%: non e' l'obiettivo, ma ferma la perdita.
- **Leva sul capitale:** un deal da circa 335.000 EUR immobilizza capitale per
  un anno. Con un mutuo o un finanziamento ponte l'IRR sull'equity sale, ma
  questo modello e' senza leva: va ricalcolato sui flussi reali.

## Specifico delle vendite statali

- **Concorrenza:** il dato storico QRE (aste giudiziarie aggiudicate in
  mediana a 1,59 volte l'offerta minima) viene dai tribunali. Le vendite di
  Demanio, INPS e Invimit hanno meno pubblicita' e meno partecipanti, ma non
  c'e' ancora uno storico nostro: vanno registrati i prezzi di aggiudicazione
  di ogni tornata, anche di quelle a cui non si partecipa.
- **Niente offerta minima ridotta:** negli avvisi statali di norma si offre dal
  prezzo base in su, salvo l'invito a offrire del Demanio, che e' senza base
  d'asta. Il confronto e' tra P_max e prezzo base: se P_max e' sotto la base,
  il lotto si scarta senza perizia.
- **ALER Milano rientra nel binario B:** gli alloggi del bando T1/2026 hanno il
  taglio giusto. Va pero' letto nel bando se ci sono vincoli di rivendita o di
  destinazione: un divieto di alienazione pluriennale renderebbe impossibile la
  rivendita, e farebbe scartare il lotto.
- **Stato occupazionale:** gli enti pubblici vendono spesso unita' occupate,
  con diritti di prelazione degli inquilini. Libero o liberabile entro 12 mesi,
  come da Gate 0.

## Gate 0 per il binario B, in ordine

1. Lombardia, Milano e citta' metropolitana.
2. Residenziale, 60-150 mq.
3. Libero o liberabile entro 12 mesi; nessuna prelazione esercitabile.
4. Nessun vincolo di rivendita.
5. P_max al 20% sopra il prezzo base, con il valore ristrutturato di zona.
6. Perizia o scheda tecnica senza semaforo rosso.

Chi passa va in pipeline con P_max al 30% come offerta e P_max al 20% come tetto.
