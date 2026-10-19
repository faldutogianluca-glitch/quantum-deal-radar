# Decisione del 18 ottobre 2026: dal canale statale alle aste giudiziarie, binario A

Verbale della war room: cinque analisi indipendenti (investitore value-add,
operatore di aste in Lombardia, CTO, avvocato delle esecuzioni, reverse
engineering dei migliori operatori e dell'obiettivo). Ognuna ha letto lo stesso
dossier e scelto da sola. Tutte e cinque hanno scelto la stessa direzione.

## Diagnosi, senza attenuanti

- **Il radar e' acceso dove non c'e' niente.** Canale statale in Lombardia: 51
  lotti Demanio tutti scaduti, Invimit a zero, nessuna vendita aperta. Lotti su
  cui agire oggi: zero. Deal arrivati in pipeline dal radar: zero.
- **Il cuore del business e' spento.** Il Portale Vendite Pubbliche (aste
  giudiziarie, dove sta tutto lo storico QRE) ha selettori segnaposto e
  conformita' da verificare. Astalegale idem.
- **Il motore e' tarato sul binario sbagliato.** Il binario B e' quello che lo
  storico QRE dice di non inseguire: 18 aste perse su 19, con offerte fra il 47%
  e l'87% del prezzo vincente. Sulle unita' piccole vince chi accetta margini del
  5-10%; con il 30% non si vince. L'unica vittoria e' binario A: Bollate, 210 mq,
  all'offerta minima. La scelta di B e' nata da una descrizione sbagliata dei
  binari, fatta dall'assistente.
- **"84%" e' una metrica di vanita'.** Misura il codice, non i deal.
- **Il modello economico e' ottimista dove conta:**
  - durata fissata a 12 mesi, quando in giudiziaria fra saldo, decreto di
    trasferimento, liberazione, lavori e vendita servono realisticamente 20-24
    mesi. Lo stesso 30% a 24 mesi vale un IRR del 14% lordo;
  - fiscalita' assente: con l'IRES al 24% il 30% lordo su 24 mesi scende verso
    un IRR netto intorno all'11%, sotto la soglia del 12%;
  - lavori a 400 EUR/mq ottimistici per Milano 2026: a 800 EUR/mq il caso di
    riferimento passa dal 30% al 16%;
  - carry, spese condominiali arretrate (art. 63 disp. att. c.c.), costi di
    liberazione e leva non modellati;
  - il prior statale 1,10 non ha nessuna osservazione lombarda.
- **I blocchi veri non sono nel codice:**
  - capitale e proof of funds ("investitori da definire");
  - struttura legale del club deal: rischio di qualifica come OICR e
    abusivismo (art. 166 TUF);
  - antiriciclaggio all'aggiudicazione (art. 585 c.p.c.);
  - compensi ai partner (L. 39/1989);
  - HubSpot non collegato.

## Decisione

**Opzione 4, con priorita' esplicite.**

1. **Priorita' 1, 60% dello sforzo: radar sulle aste giudiziarie, binario A.**
   PVP, poi Astalegale o un aggregatore con licenza. Tribunali di Milano e Monza
   per primi, poi Lombardia. Filtro: almeno 200 mq o multi-unita' o cambio d'uso
   possibile, e lotti gia' andati deserti almeno una volta. Ogni lotto che passa
   diventa un deal "Segnalato" in HubSpot, con perizia e link.
2. **Priorita' 2, 30%: sourcing da partner e off-market.** Curatori (procedure
   competitive), servicer UTP/NPL single name, REOCO. Con intake in HubSpot e SLA
   di 48 ore.
3. **Priorita' 3, 10%: canale statale e binario B congelati.** Il connettore
   Demanio resta acceso in modo passivo, senza nuovo sviluppo. Si riattiva quando
   la Vetrina avra' lotti lombardi aperti.

## Prima di qualunque offerta

- **Parere di uno studio TUF e fiscale su quattro quesiti scritti:**
  1. struttura del club deal (rischio OICR);
  2. antiriciclaggio all'aggiudicazione per un veicolo societario;
  3. compensi ai partner;
  4. IVA e registro per una societa' che compra in asta e rivende.
  5. riuso dei dati del Portale delle Vendite Pubbliche da parte di un operatore
     commerciale, per uso interno e senza ripubblicazione: le note legali di
     giustizia.it lo consentono "per finalita' non commerciali". Il connettore
     e' acceso dal 18/10/2026 per decisione del titolare. Il 19/10/2026 il
     titolare ha dichiarato l'uso personale dei dati (docs/condizioni-uso.md):
     il quesito resta solo per il caso in cui i dati servano a una societa',
     a un club deal o a investitori.
- **Capitale impegnato per iscritto prima della cauzione.** Su un ticket di
  300k: 30k di cauzione per ogni offerta, quindi 60-90k liquidi per 2-3 offerte
  in parallelo, piu' il saldo entro 120 giorni.
- **Il modello si ricalibra sul consuntivo reale di Bollate:** tempi da
  aggiudicazione a saldo, decreto, liberazione e vendita; costi effettivi;
  imposte. Fino ad allora durata, lavori e fiscalita' del motore restano ipotesi
  dichiarate ottimistiche.

## Criteri di stop

| Entro | Misura | Se non e' rispettata |
| --- | --- | --- |
| 45-60 giorni | Almeno 15 lotti binario A al mese che passano il Gate 0 con perizia letta, con meno del 10% di dati mancanti | Si ferma lo scraping; restano alert dell'aggregatore e delegati |
| 90 giorni | Almeno un'offerta depositata con funding firmato pari almeno a prezzo + 20% | Si sospende il modello club deal |
| 90 giorni | Almeno 3 segnalazioni da partner a "GO DD" | Si ridimensiona il programma partner |
| 120 giorni | Almeno 3-4 offerte depositate al tetto ricalcolato | Si rivede la tesi, non il codice |
| 180 giorni | Almeno un'aggiudicazione | Si rivede la tesi, non il codice |
| Su 20 o piu' esiti A tracciati | Mediana di aggiudicazione non oltre 1,25 volte l'offerta minima | La tesi "A si vince al minimo" e' morta: solo off-market |

## Dall'obiettivo all'indietro

Obiettivo: un deal acquisito con margine almeno del 30% entro 6 mesi, poi un
club deal. Le cadenze sono stime.

- **Aggiudicazione entro i mesi 2-3**, per stare nei 120 giorni del saldo.
- **4-5 offerte vincolanti in circa 10 settimane**: sul binario A, puntando
  all'offerta minima su lotti gia' andati deserti, e' plausibile vincerne una su
  4-5.
- **Circa 10 lotti approfonditi**: perizia, sopralluogo col custode, occupazione,
  urbanistica, frazionamento. Circa uno a settimana.
- **Circa 100 lotti analizzati**: 8-10 a settimana.

## Sette giorni

1. Verifica di robots.txt e condizioni d'uso del PVP: decisione del titolare
   (fatto il 18/10/2026: consentito per uso interno, quesito al parere legale).
2. Calibrazione dell'adapter PVP su Milano e Monza con filtro binario A, ed
   esecuzione giornaliera su un runner gestito invece del PC locale.
3. Consuntivo di Bollate per ricalibrare il modello.
4. Incarico allo studio TUF e fiscale.
5. Selezione manuale di 3 lotti binario A a Milano o Monza e richiesta di
   sopralluogo al custode entro venerdi'.

## Fonti principali del reverse engineering

- Regola del 70% e dati ATTOM sui fix & flip:
  https://www.kiavi.com/blog/what-is-70-rule-in-house-flipping
- Aste deserte e ribassi:
  https://avvocaticartellesattoriali.com/2026/07/16/aste-giudiziarie-deserte-cosa-succede-al-debitore-e-quali-strade-percorribili/
- Lotti venduti in media alla 2,2esima asta (Immobiliallasta):
  https://financecommunity.it/aste-immobiliari-in-italia-per-un-lotto-ne-servono-in-media-2-2-lanalisi-di-immobiliallasta-it/
- PropStream, flusso zona, filtro, lista, contatto:
  https://www.propstream.com/news/7-powerful-ways-real-estate-pros-use-propstream-to-land-more-deals
- Mutuo per aste:
  https://bpf.it/wp-content/uploads/attachments/Mutui_Ipotecari_Aste_Giudiziarie.pdf
