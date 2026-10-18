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

Il prezzo massimo e' il **piu' basso fra tre vincoli**, e il radar dice quale
lo fissa:

1. **Margine:** 30% per l'offerta, 20% per il tetto.
2. **IRR minimo 12%:** con la spesa all'inizio e l'incasso alla fine equivale
   a un margine di 1,12^(mesi/12) - 1. Con la durata di riferimento di 12 mesi
   chiede il 12% e non lega mai; lega se si allunga la durata del modello (il
   parametro `mesi` di `qre.ts`): a 36 mesi chiede il 40,5%. Oggi la durata e'
   la stessa per tutti i lotti, non stimata lotto per lotto.
3. **Stress test a capitale salvo:** uscita -15%, lavori +15%, sei mesi in
   piu', margine zero. Con la quotazione OMI al livello di comune, invece che
   di zona, l'uscita si stressa del 25%: un dato piu' incerto paga di piu'.

Ogni vincolo ha la stessa forma chiusa, perche' tutti i costi sono lineari nel
prezzo:

```
P = (V x 0,97 / (1 + margine) - lavori - 3.900 - 417 x mesi) / 1,09
```

dove V e' il valore di vendita a ristrutturazione fatta, 3.900 EUR i costi una
tantum (APE, utenze, imposte fisse, notaio) e 417 EUR/mese la gestione
(5.000 EUR l'anno). A 12 mesi coincide con la formula del metodo QRE.

Prezzi massimi d'aggiudicazione con la zona OMI risolta, arrotondati:

| Valore ristrutturato | 70 mq | 100 mq | 140 mq |
| --- | --- | --- | --- |
| 3.000 EUR/mq | 108k / 117k | 158k / 171k | 224k / 244k |
| 3.500 EUR/mq | 132k / 143k | 192k / 209k | 272k / 297k |
| 4.000 EUR/mq | 156k / 170k | 226k / 247k | 320k / 350k |
| 4.500 EUR/mq | 180k / 196k | 260k / 285k | 368k / 403k |
| 5.000 EUR/mq | 204k / 223k | 295k / 323k | 416k / 456k |
| 6.000 EUR/mq | 252k / 276k | 363k / 397k | 512k / 560k |

In ogni cella il primo numero e' l'offerta (margine 30%), il secondo il tetto.
L'offerta e' sempre fissata dal margine; il tetto, quasi ovunque, dallo stress
test: al 20% di margine un'uscita -15% mangerebbe il capitale.

**La regola pratica:** nel binario B si compra solo con almeno il 35-40% di
sconto sul valore ristrutturato. Piu' la zona e' economica, piu' sconto serve,
perche' i lavori pesano di piu' sul totale.

## Il valore di uscita: comparabili ristrutturati

Tutto il modello poggia sul valore di vendita a lavori finiti: un errore del
10% li' sposta il margine di 13 punti. Il radar lo stima cosi':

1. **Comparabili ristrutturati vicini.** Nuovi o ristrutturati, entro 500 m
   (1 km se non bastano), degli ultimi 12 mesi, fra 0,65 e 1,5 volte la
   superficie del lotto. Lo stato e' il filtro piu' importante: un "buono"
   o un "da ristrutturare" racconta un altro prodotto.
2. **Omogeneizzazione.** Prezzo richiesto x 0,90 per arrivare al rogito,
   nuovo x 0,92 per arrivare al ristrutturato, e il taglio: EUR/mq che
   scendono con la superficie con elasticita' 0,1 (un comparabile da 70 mq si
   riporta a un lotto da 100 mq moltiplicando per 0,965). Sono ipotesi
   dichiarate, da ricalibrare sui rogiti propri.
3. **Stima robusta.** Si tolgono gli anomali (regola di Tukey), poi mediana
   pesata per distanza: un comparabile a 300 m pesa la meta' di uno sul posto.
4. **Affidabilita'.** Servono almeno 5 comparabili e una dispersione fra primo e
   terzo quartile entro il 30%. Altrimenti si resta sul massimo OMI.

Quando i comparabili sono usati, lo stress test sull'uscita e' la loro
dispersione misurata, fra un minimo del 10% e un massimo del 25%: comparabili
molto coerenti consentono un'offerta piu' alta, comparabili sparsi la
abbassano. Il dettaglio di ogni lotto mostra i comparabili usati uno per uno,
quanti ne sono rimasti fuori e perche', e lo scarto rispetto al massimo OMI:
oltre il 25% vale la pena capire chi dei due sbaglia.

## Il prezzo che conta e' quello di aggiudicazione

Confrontare il prezzo massimo con il prezzo base e' l'errore piu' comune: chi
lo fa "trova" lotti che poi non vince mai. Lo storico QRE (19 aste giudiziarie
con aggiudicazione registrata, 2022-2026) dice che le unita' piccole si chiudono
in mediana a 1,20 volte il prezzo base. Il radar quindi:

- stima il **prezzo atteso** come base x moltiplicatore;
- calcola l'**offerta minima ammessa**: la base nelle vendite statali, tre
  quarti della base nelle giudiziarie;
- classifica il lotto:

| Esito | Condizione |
| --- | --- |
| `passa` | Prezzo atteso entro l'offerta massima |
| `al_limite` | Prezzo atteso fra offerta e tetto: si offre fino al tetto |
| `solo_poca_concorrenza` | Si entra (offerta minima entro il tetto), ma il prezzo atteso supera il tetto |
| `scarta` | Neppure l'offerta minima sta entro il tetto |

`solo_poca_concorrenza` non e' uno scarto: e' l'asta su cui si offre al tetto e
si accetta di perderla. Sulle aste deserte o fuori stagione e' li' che si vince.
In giudiziaria, se il tetto sta sotto la base, il radar ricorda il rischio di
istanze di assegnazione del creditore (art. 588 c.p.c.).

**In trattativa la logica si rovescia.** REOCO e banche pubblicano un prezzo
richiesto, non una base d'asta: non c'e' gara e si chiude sotto la richiesta.
Per queste fonti il prezzo atteso e' la richiesta x 0,90 (lo stesso haircut
richiesta-rogito di `@qdr/core`), non c'e' offerta minima, e quando il lotto
non regge il radar dice quanto sconto sulla richiesta servirebbe per arrivare
all'offerta massima: e' il numero da portare in negoziazione.

## Il moltiplicatore impara dagli esiti

Ogni aggiudicazione osservata, anche di aste a cui non si e' partecipato, si
registra:

```bash
node packages/server/dist/cli.js esito <id-immobile> <prezzo-aggiudicazione> [--vinto]
```

Giudiziarie, statali, trattative e altre aste si calibrano separatamente; per
le trattative si registra il prezzo di chiusura. Da cinque esiti in su il
moltiplicatore della famiglia e' la mediana osservata invece del default, e il
radar dichiara su quanti dati poggia. Per le vendite statali non abbiamo ancora
uno storico: il default 1,20 viene dalle giudiziarie ed e' probabilmente
prudente. Sono i primi cinque esiti statali a dirci quanto.

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

Verdetto numerico: GO. Tetto: 284.700 EUR, fissato dallo stress test (il margine del 20% da solo ne
consentirebbe 286.100).

| Scenario | Margine | IRR |
| --- | --- | --- |
| Base | 30,2% | 30,2% |
| Vendita -10% | 17,2% | 17,2% |
| Vendita -20% | 4,1% | 4,1% |
| Lavori +15% | 27,8% | 27,8% |
| Tempi +6 mesi | 29,2% | 18,6% |

Sei mesi in piu' costano anche 2.500 EUR di gestione: per questo il margine
scende di un punto, e l'IRR molto di piu'.

Il caso base tiene conto del prezzo d'acquisto, non della gara: con una base
di 217.000 EUR e l'aggiudicazione attesa a 1,20 volte, si arriverebbe a
260.000 EUR proprio sull'offerta massima.

**Dove si rompe il modello.** I lavori e i tempi pesano poco; il prezzo di
uscita pesa tutto. Con un'uscita del 10% piu' bassa, un deal comprato al 30%
scende al 17% e va sotto la soglia del 20%. Per questo si offre al prezzo
calcolato col 30% e il 20% resta il tetto, non l'obiettivo.

## Asimmetria

- **Caso peggiore realistico:** uscita -20% e sei mesi in piu'. Margine 3,4%,
  IRR 2,2%: capitale restituito, nessuna perdita.
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
  d'asta. Se anche la base supera il tetto, il lotto si scarta senza perizia;
  se la base sta sotto il tetto ma l'aggiudicazione attesa no, il lotto resta
  come `solo_poca_concorrenza`: un'offerta al tetto, sapendo che vince solo se
  la gara e' poco partecipata.
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
5. Esito QRE `passa` o `al_limite`; `solo_poca_concorrenza` solo per un'offerta
   al tetto.
6. Perizia o scheda tecnica senza semaforo rosso.

Chi passa va in pipeline con l'offerta massima come offerta e il tetto come
limite invalicabile. Il radar calcola i punti 2 e 5 da solo a ogni enrich.
