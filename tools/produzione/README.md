# Strumenti di produzione

Gli script che generano i video con l'avatar, li montano con HyperFrames e aggiornano Metricool. Prima stavano solo nella cartella temporanea di una sessione: da qui in poi la copia valida è questa.

## Preparazione

1. Crea la cartella di lavoro e collegala al percorso usato dagli script:
   `mkdir -p ~/qre-work/hg/out ~/qre-work/impegni && ln -sfn ~/qre-work /tmp/qre-work`
2. Copia `heygen/gen.py` in `~/qre-work/hg/` e i file `montaggio/*.sh` e `montaggio/gen.py` in `~/qre-work/impegni/`.
3. Variabile d'ambiente `HEYGEN_API_KEY` (mai nel repository).
4. Node con `npx hyperframes@0.8.161`, ffmpeg, Python 3.

## Cosa fa ogni cosa

| File | Scopo |
|---|---|
| `heygen/gen.py` | Crea i video avatar su HeyGen (comandi `serie`, `pillole`, `pillole2`, `libro`, `poll`). Look 2, voce clonata, velocità 1,07 per pillole e libro. |
| `heygen/upload_finali.py` | Carica i video finali nella libreria HeyGen. |
| `montaggio/prep.sh N` | Prepara l'episodio N: audio a -14 LUFS, trascrizione parola per parola. |
| `montaggio/run_pillole2.sh`, `run_video4.sh`, `run_libro.sh` | Pipeline complete: attesa HeyGen, trascrizione, montaggio, controllo, render. |
| `montaggio/gen.py` | Copia di `videos/impegni-scritti-9x16/genera.py`, che è la fonte. |
| `metricool/applica_utm.py` | Riporta nel calendario gli id Metricool dopo un aggiornamento. |
| `metricool/rec*.py` | Verifiche e registrazioni dei risultati degli aggiornamenti. |

## Regole

- Nessuna chiave o token nei file. Le chiavi sono variabili d'ambiente.
- Ogni video con parlato esce con i sottotitoli in italiano impressi, la nota AI e il dolore del target nella prima frase (`CLAUDE.md`).
- Non si spende credito HeyGen senza il sì di Pitágora sui copioni.
