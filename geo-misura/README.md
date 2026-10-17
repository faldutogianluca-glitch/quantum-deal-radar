# Misura della visibilità nelle risposte AI

Misura di partenza (e poi mensile) per creattiva.com, quantumre.it e
milanoretailtour.com: 30 domande per sito, poste a ChatGPT, Perplexity e Gemini
con la ricerca web attiva, 3 volte ciascuna.

- `domande.csv`: le 90 domande. Il tipo **scoperta** non contiene il nome del brand
  (sono quelle che misurano la visibilità vera), il tipo **brand** controlla cosa
  sanno le AI dell'azienda. Da rivedere prima della prima misura: dopo, non si
  cambiano più, altrimenti il confronto mese su mese non vale.
- `siti.json`: nomi e domini da cercare nelle risposte.
- `misura.py`: lo script (solo Python standard, nessuna libreria da installare).

## Come lanciarla (Windows, PowerShell)

1. Crea le chiavi API: [OpenAI](https://platform.openai.com/api-keys),
   [Perplexity](https://www.perplexity.ai/account/api),
   [Gemini](https://aistudio.google.com/apikey). Ne basta una per iniziare: i
   motori senza chiave vengono saltati.
2. Nella cartella `geo-misura`:

   ```powershell
   $env:OPENAI_API_KEY = "..."
   $env:PERPLEXITY_API_KEY = "..."
   $env:GEMINI_API_KEY = "..."
   python misura.py
   ```

   Su Mac o Linux: `export OPENAI_API_KEY=...` e così via.
3. Il risultato è in `risultati/riepilogo.md`; il dettaglio di ogni risposta
   (testo, fonti, errori) in `risultati/risultati_<data>.csv`.

Sono 90 domande × 3 motori × 3 ripetizioni = 810 richieste: circa un'ora. Se si
interrompe, rilancialo e riprende da dove era arrivato. Il costo dipende dai
listini dei tre fornitori (ricerca web inclusa): controllalo sulle pagine prezzi
prima di partire, oppure prova con `--ripetizioni 1 --siti quantumre`.

I modelli si cambiano con `OPENAI_MODEL`, `PERPLEXITY_MODEL`, `GEMINI_MODEL`.
Per confrontare due mesi, usa sempre gli stessi modelli.

## Google AI Overviews

Non hanno un'API pubblica. Per le stesse domande, una volta al mese: ricerca su
google.it in una finestra in incognito, e annota a mano in un foglio se compare
l'AI Overview, se il sito è tra i link e chi c'è al suo posto.

## Limiti

Le risposte via API non sono identiche a quelle dell'app (niente cronologia
dell'utente, modelli a volte diversi), e cambiano da una volta all'altra: per
questo ogni domanda si pone 3 volte e si guarda la media. Conta il confronto nel
tempo con lo stesso metodo, non il singolo numero.
