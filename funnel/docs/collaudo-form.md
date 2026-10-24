# Collaudo dei moduli: piano ed esiti

Piano del 24/10/2026. **Nessun collaudo è stato eseguito**: richiede le landing live, i moduli HubSpot pubblicati e contatti di test autorizzati da Pitágora. Gli esiti restano `non verificato` finché qualcuno non esegue la prova e la registra in `collaudo-form-esiti.json`. Una tabella compilata senza esecuzione non chiude nessun controllo.

## Regole del collaudo

- Contatti di test autorizzati: indirizzi di posta controllati da chi collauda, con un marcatore riconoscibile (per esempio `+collaudo` nell'indirizzo). Nessun dato di persone reali.
- Dopo la prova i contatti e i deal di test si eliminano, annotando che sono stati eliminati.
- L'esecuzione è un passo che richiede il via libera di Pitágora su moduli, indirizzi di test e notifiche.

## Casi per ogni modulo attivo

| # | Caso | Atteso | Come si verifica |
|---|---|---|---|
| 1 | Apertura del link tracciato (`?utm_source=<rete>&utm_medium=...&utm_campaign=...`) | La pagina si apre; l'indirizzo conserva i parametri | Browser, barra degli indirizzi |
| 2 | Invio del modulo con tutti i dati | Pagina di conferma corretta per quel modulo | Pagina dopo l'invio |
| 3 | Salvataggio degli UTM | Sul contatto: `utm_source`, `utm_medium`, `utm_campaign` uguali a quelli del link | Scheda contatto |
| 4 | Attribuzione corretta per rete | `utm_source` = la rete del link; **Instagram non risulta come Facebook** | Provare un link per ogni rete |
| 5 | Contatto e deal creati, senza duplicati | Un contatto; un deal in "Deal immobiliari QRE", fase Segnalato, con fonte compilata | Scheda contatto e pipeline |
| 6 | Notifica | Arriva al responsabile entro 2 minuti | Casella del responsabile |
| 7 | Conferma al visitatore | Messaggio corretto, con la nota AI, senza promesse diverse da quelle pubbliche | Casella del contatto di test |
| 8 | Avanzamento di stato | Spostando il deal fra le fasi, le date (`data_feedback`, ecc.) si compilano | Scheda deal |
| 9 | **Invio ripetuto** (stesso indirizzo, stesso immobile) | Il contatto si aggiorna; **nessun secondo deal** per lo stesso immobile | Elenco deal |
| 10 | **Dati mancanti** (modulo con campi obbligatori vuoti; indirizzo email non valido) | Il modulo rifiuta l'invio con un messaggio; nessun contatto creato | Provare l'invio |
| 11 | Consenso | Senza la casella di consenso il modulo non parte | Provare l'invio |
| 12 | Pagina da telefono | Il modulo si compila e si invia da un telefono | Prova su telefono |

## Moduli da collaudare (da confermare con le landing costruite)

| Modulo | Casi | Esito |
|---|---|---|
| Proprietari (valutazione) | 1-12 | non verificato |
| Agenti e segnalatori | 1-12 | non verificato |
| Nuda proprietà | 1-12 | non verificato |
| Checklist per chi compra | 1-4, 7, 9-12 | non verificato |
| Newsletter | 1-4, 7, 9-12 | non verificato |

Gli esiti si registrano in `funnel/docs/collaudo-form-esiti.json` con data, chi ha eseguito e, per ogni caso, `verificato`, `fallito` o `non verificato` più una nota.
