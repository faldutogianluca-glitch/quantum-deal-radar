# Routine della domenica: newsletter "Immobili in Movimento"

Fonte: handoff della sessione Cowork dell'11/10/2026, integrato qui il 13/10/2026. Voce completa in `docs/linkedin-voice.md`, registro in `docs/linkedin-log.md`.

Ogni domenica pomeriggio si prepara la **bozza** dell'edizione successiva. Pitágora la pubblica a mano il lunedì. Nulla si pubblica o si invia senza la sua conferma.

## Passi

1. **Leggere voce e registro.** Il numero dell'edizione è l'ultimo del registro più uno.
2. **Ricercare le notizie della settimana.**
   - Temi: mercato immobiliare in Italia, Milano e Lombardia, aste e NPL, tassi (BCE, Euribor), mutui, Europa (Eurostat).
   - Fonti preferite: Istat, Banca d'Italia, Agenzia Entrate–OMI, Eurostat, BCE, Nomisma, Tecnoborsa, FIMAA, Scenari Immobiliari, idealista, Immobiliare.it, Il Sole 24 Ore.
   - Ogni numero ha fonte e data. I dati degli annunci sono prezzi richiesti, non prezzi di atto.
3. **Tesi.** Una tesi forte, diversa da quelle delle ultime tre edizioni (vedi il registro).
4. **Struttura.**
   - Apertura con numeri accostati o con una scena reale, poi la lettura.
   - Sezioni con titoli brevi in MAIUSCOLO.
   - Un esempio con i conti.
   - Sezioni fisse:
     - "Come uso tutto questo quando valutiamo un'operazione" (3 domande);
     - "La regola che non cambio";
     - "Dove guardo nei prossimi tre mesi";
     - "La domanda di questa settimana" (risposta con una parola o un numero).
   - Se l'edizione precedente prometteva le risposte e nel registro non ci sono, si mette il segnaposto `{{risposte dai commenti da incollare}}`.
5. **Chiusura.**
   - Firma: Gianluca Falduto, Amministratore Delegato, "Quantum RE – Osservatorio Real Estate".
   - Fonti con le date.
   - Disclaimer: "Contenuto informativo ed editoriale. Non costituisce consulenza finanziaria, immobiliare o fiscale, né raccomandazione personalizzata. Le valutazioni espresse sono opinioni dell'autore e non previsioni."
   - Nota AI, standard unico dal 13/10/2026: "Contenuto generato con AI sotto la supervisione di Gianluca Falduto."
   - Sempre "Quantum RE". Nessun hashtag nell'edizione.
6. **Revisione di stile** con la skill `li-human`.
   - Gli script funzionano in Claude Code: commit fissato nella skill, solo libreria standard, si lanciano con `python3 -I`.
   - Fingerprint (trattini lunghi, caratteri invisibili, virgolette curve) e slop si applicano anche all'italiano.
   - Il controllo VOICE è tarato sull'inglese e dà circa 30 su qualsiasi testo italiano: non va usato come criterio.
   - Al massimo 2 o 3 frasi del tipo "Non è X. È Y.".
   - Testata, firma e nota AI restano fuori dalla revisione automatica.
7. **Materiali extra.**
   - Titolo e sottotitolo.
   - Post di lancio: massimo 600 caratteri e 3 hashtag, link nel primo commento.
   - Copertina 1200×644 dark-gold con `python scripts/copertina_newsletter.py`: si aggiunge un blocco in `EDIZIONI` con i numeri verificati. L'immagine va in `output/copertine/`.
8. **Salvataggio.**
   - Salvare `docs/newsletter/edizione-<n>.md` con la bozza, il post di lancio e l'elenco dei dati da verificare.
   - Aggiornare `docs/linkedin-log.md`.

## Compliance (decisa da Pitágora il 13/10/2026)

La regola sui contenuti pubblici vale anche per la newsletter: niente inviti a investire, rendimenti, capitale, club deal o co-investimento, e niente confronti tra immobili e titoli di Stato.

- I dati di mercato restano: prezzi, canoni, inflazione, tassi dei mutui, costi.
- Il metodo si racconta con il margine sul costo come criterio interno d'acquisto e con i costi del tempo, non con ROI o IRR.
- Ogni bozza chiude con una sezione "Revisione compliance" che ricerca nel testo le parole escluse.

La newsletter non è programmata in Metricool: esce a mano dal profilo di Pitágora.

## Ogni settimana prima del lunedì

- **Venerdì:** riallineare BTP 10 anni, spread, Euribor 12M, Eurirs 25 anni e gli ultimi dati Istat usati nella bozza.
- **Sabato:** incollare nel registro le risposte alla domanda della settimana precedente. Se non arrivano, dirlo apertamente nell'edizione.
- Verificare sulle fonti primarie i punti elencati in fondo alla bozza.
