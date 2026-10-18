# Quantum Deal Radar — regole di lavoro

Radar delle vendite immobiliari pubbliche e distressed per Quantum Re (metodo
QRE). Lingua del progetto: italiano, nel codice, nei commenti, nei commit e
nelle risposte. Il README spiega architettura e comandi; `docs/` contiene
metodo (`economia-deal-binario-b.md`), canali (`osservatorio-aste-statali.md`)
e condizioni d'uso delle fonti (`condizioni-uso.md`).

## Regola permanente: revisione, verifica, rettifica, miglioramento

Ogni intervento, anche piccolo, si chiude con questo ciclo. Non e' una fase
finale opzionale: un lavoro che non lo ha passato non e' finito.

1. **Revisione.** Rileggi il diff come lo leggerebbe chi lo deve smontare.
   Per un cambiamento non banale fai rivedere il codice da un revisore
   indipendente (un subagente che non ha scritto il codice), chiedendo bug
   reali, verificati con uno script, non opinioni.
2. **Verifica sui dati veri, non solo sui test.** I difetti piu' gravi di
   questo progetto non li ha trovati nessun test: superfici lette come zero,
   due box gemelli fusi in un falso ribasso del 29%, civici declassati dal
   geocoding, il valore OMI del centro usato per la periferia. Dopo ogni
   modifica che tocca dati o calcoli:
   - `npm run verifica-tutto` (build, test, controllo dei dati in archivio);
   - se la fonte e' abilitata, un giro reale: `scrape <fonte>`, `enrich`,
     `controllo`, e una lettura a campione delle righe prodotte;
   - se cambia la dashboard, una prova nel browser (Chromium e' in
     `/opt/pw-browsers`).
3. **Rettifica.** Ogni difetto trovato si corregge alla radice e porta con se'
   un test di regressione che fallisce senza la correzione. Se il sintomo puo'
   ripresentarsi con una fonte nuova, aggiungi un controllo in
   `packages/server/src/controllo.ts`.
4. **Miglioramento.** Chiediti cosa farebbe meglio chi e' fra i migliori in
   quella competenza (underwriting, scraping, geodati, statistica) e fallo se
   e' nel perimetro; altrimenti scrivilo come prossimo passo.
5. **Resoconto onesto.** Riporta cosa e' stato verificato e come, cosa no, e
   gli errori commessi, anche i tuoi. Una percentuale di completamento va
   motivata area per area. Mai dichiarare "fatto" cio' che non e' stato visto
   funzionare.

## Vincoli che non si negoziano

- **Conformita' delle fonti.** Una fonte parte solo con `compliance.stato:
  "consentito"`, deciso dal titolare dopo la lettura di robots.txt e
  condizioni d'uso. Mai automatizzare login, mai aggirare protezioni, mai
  raccogliere da portali che vietano la raccolta automatica (i comparabili dei
  portali di annunci arrivano solo da export con licenza o raccolta manuale).
- **Rispetto dei siti.** `rateLimitSeconds` e i tetti per esecuzione si
  rispettano anche nei nuovi tentativi; i test non vanno mai in rete.
- **Un numero dichiara da dove viene.** Parametri del metodo: dato misurato
  con fonte e data, oppure ipotesi dichiarata come tale. Mai un valore
  inventato con l'aspetto di un dato.
- **Meglio nessun verdetto che uno sbagliato.** Se il valore di uscita non e'
  affidabile (zona non risolta, comparabili scarsi) il Gate 0 esce
  `dati_mancanti`, non con un numero.
- Il modulo `@qdr/core` si modifica solo per correggere difetti, con test.
- Mai nomi di modelli nei commit, nel codice o nei documenti.

## Comandi utili

```bash
npm run verifica-tutto          # build + test + controllo dei dati
node packages/server/dist/cli.js scrape demanio
node packages/server/dist/cli.js enrich
node packages/server/dist/cli.js controllo
npm run omi                     # quotazioni OMI di Milano (open data del Comune)
```
