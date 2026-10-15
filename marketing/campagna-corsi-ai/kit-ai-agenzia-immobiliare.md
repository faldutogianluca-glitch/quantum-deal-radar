# Kit AI per l'agenzia immobiliare: 10 istruzioni, dall'incarico al rogito

Contenuto del kit da mandare a chi commenta KIT. Testo approvato da Pitágora il 15/10/2026; il PDF è in `kit/kit-ai-agenzia-immobiliare.pdf`.

---

**Quantum RE – Osservatorio Real Estate**

## Prima regola: cosa non si incolla mai

In un'AI online (ChatGPT, Gemini, Claude e simili, nelle versioni pubbliche) non si incollano:

- nomi, telefoni, email e codici fiscali di clienti e proprietari;
- documenti d'identità, atti, visure e contratti con i dati delle persone;
- indirizzi esatti degli immobili, se il cliente non lo sa.

Si lavora su dati resi anonimi: "il proprietario", "via X", "appartamento al terzo piano". Se l'agenzia usa un'AI installata in ufficio, le regole le decide il titolare.

**Come si usano le istruzioni:**
- copiatele, sostituite le parti tra [parentesi quadre] e incollate i dati;
- l'ultima riga di ogni scheda dice cosa va controllato prima che il testo arrivi a un cliente.

---

## 1. Preparare l'appuntamento per l'incarico

```
Sei l'assistente di un agente immobiliare a [città/zona].
Ti incollo le quotazioni OMI della zona per [tipologia] e [n] annunci di immobili simili, con prezzo richiesto e metri quadri.
Fai una tabella con prezzo al metro quadro di ogni annuncio, media e valori minimo e massimo.
Segnala gli annunci fuori scala e dimmi perché potrebbero esserlo.
Ricorda che gli annunci sono prezzi richiesti, non prezzi di vendita.
[quotazioni OMI]
[annunci]
```
Da controllare: che i metri quadri degli annunci siano confrontabili (commerciali o calpestabili) e che le quotazioni OMI siano del semestre più recente.

## 2. La lettera al proprietario dopo la visita

```
Scrivi una lettera di una pagina al proprietario di [descrizione dell'immobile, senza nomi].
Spiega la valutazione con questi dati: [tabella del punto 1, stato dell'immobile, punti di forza, punti deboli].
Tono chiaro e rispettoso. Niente promesse sui tempi di vendita.
Chiudi con i prossimi passi: [incarico, foto, documenti da preparare].
```
Da controllare: che ogni numero della lettera sia nella tabella e che non ci siano promesse sul prezzo finale.

## 3. L'annuncio dalla scheda tecnica

```
Scrivi un annuncio per [portale] usando solo questi dati: [scheda tecnica: metri quadri, piano, locali, esposizione, stato, spese condominiali, classe energetica e indice di prestazione energetica].
Non aggiungere niente che non sia nei dati. Niente aggettivi come "splendido" o "unico".
Metti la classe energetica e l'indice di prestazione nel testo.
Alla fine elenca le informazioni che mancano e che un acquirente chiederebbe.
```
Da controllare:
- la classe energetica e l'indice di prestazione negli annunci di vendita e locazione sono obbligatori (D.Lgs. 192/2005, art. 6);
- foto ritoccate o arredate con l'AI vanno dichiarate come tali.

## 4. La risposta a un contatto dai portali

```
Un potenziale acquirente ha scritto questo messaggio dal portale: [messaggio, senza nome e numero].
L'immobile è: [3 righe di scheda].
Scrivi una risposta di massimo 5 righe che risponda alla sua domanda e proponga due orari di visita: [orari].
Aggiungi tre domande per capire se compra davvero: tempi, mutuo già valutato, immobile da vendere prima.
```
Da controllare: che la risposta parta entro pochi minuti e che le tre domande non suonino come un interrogatorio.

## 5. I documenti per il rogito, caso per caso

```
Prepara la lista dei documenti da raccogliere per la vendita di [tipologia] in [comune], con queste caratteristiche: [condominio sì/no, lavori fatti negli ultimi anni, provenienza (acquisto, successione, donazione), impianti rifatti sì/no, mutuo da estinguere sì/no].
Dividi tra: documenti del venditore, documenti del condominio, documenti tecnici.
Per ogni documento scrivi chi lo rilascia e perché serve.
```
Da controllare: la lista finale la conferma il notaio. Conformità catastale e urbanistica, APE e provenienza sono i punti su cui un rogito si blocca.

## 6. Planimetria catastale contro stato dei luoghi

```
Ti descrivo la planimetria catastale di un appartamento e poi come è oggi, dopo il sopralluogo.
Planimetria: [stanze, posizione di porte, muri e finestre].
Stato attuale: [cosa è diverso].
Elenca le differenze e, per ognuna, dimmi se potrebbe richiedere un aggiornamento catastale o una pratica edilizia.
Non dare risposte certe: scrivi le domande da fare al tecnico.
```
Da controllare: solo un tecnico abilitato dice se una difformità è sanabile e quanto costa.

## 7. Le obiezioni prima della trattativa

```
Domani presento una proposta d'acquisto di [prezzo] per un immobile richiesto a [prezzo richiesto].
Dati a favore dell'offerta: [comparabili, lavori da fare, tempo sul mercato].
Elenca le 5 obiezioni più probabili del venditore e per ognuna una risposta basata solo su questi dati.
```
Da controllare: che le risposte usino solo dati che potete mostrare al venditore.

## 8. La proposta d'acquisto spiegata al cliente

```
Spiega in linguaggio semplice, a un acquirente che compra per la prima volta, cosa significano queste condizioni della proposta: [caparra, termini, condizione mutuo, data del rogito].
Massimo 10 righe. Niente consigli legali: dove serve, scrivi "chiedete al notaio".
```
Da controllare: il modulo della proposta resta quello dell'agenzia. Il testo dell'AI serve solo a spiegare.

## 9. La perizia d'asta, prima lettura

```
Ti incollo il testo di una perizia di stima per un'asta giudiziaria, senza i dati delle persone.
Estrai, indicando sempre la pagina:
1. difformità urbanistiche e catastali, se sono sanabili secondo il perito, costo stimato e se è già dedotto dal valore
2. stato di occupazione e titolo dell'occupante
3. formalità che verranno cancellate e formalità che restano
4. spese condominiali insolute
5. prezzo base, offerta minima, data e modalità dell'asta
Se un dato non c'è, scrivi "non indicato". Non dedurre.
[testo della perizia]
```
Da controllare: ogni voce va riletta sulla pagina indicata. L'AI a volte sbaglia con grande sicurezza, soprattutto su date e importi.

## 10. Il post della settimana dai dati di mercato

```
Ti incollo un dato di mercato con la fonte e la data: [dato, fonte, data].
Scrivi un post di 600-900 caratteri per i proprietari di [zona]: cosa significa questo dato per chi vende oggi.
Cita la fonte. Niente previsioni presentate come certezze. Niente inviti a investire.
Chiudi con una domanda a cui si risponde con una parola.
```
Da controllare: che il dato sia quello della fonte, con la data giusta, e che il testo dica che è stato scritto con l'AI.

---

## Le tre cose da non fare mai

1. Mandare a un cliente un numero che l'AI ha scritto e che voi non avete controllato.
2. Incollare dati personali in un'AI online.
3. Pubblicare foto modificate con l'AI senza dirlo.

---

Questo kit è un estratto del laboratorio dell'edizione per l'immobiliare del corso di AI che Quantum RE prepara con Creattiva e il suo partner di formazione accreditato. Per il programma, commentate CORSO o scrivete a Gianluca Falduto.

Contenuto informativo. Non costituisce consulenza legale, fiscale o tecnica: per il vostro caso sentite il notaio, il tecnico o il consulente privacy.

Contenuto generato con AI sotto la supervisione di Gianluca Falduto.
