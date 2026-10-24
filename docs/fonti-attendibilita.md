# Attendibilita' delle fonti

Generato da `node scripts/tabella-fonti.mjs` leggendo `packages/scrapers/sites/*.json` e `docs/verifiche-fonti.json`. Non va modificato a mano: "verificata live" compare solo dove esiste una verifica registrata.

Totali: 23 fonti configurate, 2 abilitate, 1 verificate live.

| Fonte | Configurata | Abilitata | Autorizzata (condizioni d'uso) | Modo | Testata su fixture | Selettori | Verificata live (ultima) | Campi configurati |
|---|---|---|---|---|---|---|---|---|
| alba_leasing | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url |
| astalegale | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, sottotipoAsset |
| banca_italia | si | no | da_verificare | pdf | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |
| banco_bpm_phoenix | si | no | da_verificare | manuale | no: solo il motore generico | non dichiarata | NO | titolo, url |
| bnl_immobili | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |
| bper_leasing | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |
| bper_real_estate | si | no | solo_contatto | manuale | no: solo il motore generico | non dichiarata | NO | titolo, url |
| cdp_fintecna | si | no | da_verificare | pdf | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |
| credemleasing | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url |
| credit_agricole | si | no | da_verificare | pdf | no: solo il motore generico | non dichiarata | NO | titolo, url |
| demanio | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url |
| demo | si | si | n/a (fixture locale) | file | si (demo_listings.html) | n/a | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, sottotipoAsset |
| ferservizi | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url |
| i_resales | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |
| inps | si | no | da_verificare | pdf | no: solo il motore generico | non dichiarata | NO | titolo, url |
| intesa_proprieta | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |
| iqera | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url |
| mps_bandi | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |
| portale_vendite_pubbliche | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, sottotipoAsset |
| quimmo | si | no | consentito (2026-08-08) | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |
| re_impresa | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |
| reperform | si | si | consentito (2026-08-08) | browser | si (reperform_scheda.html) | su HTML reale | si, 2026-10-24: 51 righe, 0 errori | titolo, comune, url, idEsterno, immagineUrl, nEsperimentiDeserti, numeroLotto, lat, lon, tipoVendita |
| uclam | si | no | da_verificare | browser | no: solo il motore generico | non dichiarata | NO | titolo, url, immagineUrl, prezzoRaw, comune, dataAstaRaw, indirizzoRaw, sottotipoAsset |

## Cosa significa ogni colonna

- **Autorizzata**: esito della lettura delle condizioni d'uso registrato nel file della fonte. `da_verificare` blocca lo scraper. `solo_contatto` e `vietato` non si raccolgono.
- **Testata su fixture**: esiste un HTML o PDF di prova specifico della fonte e un test che lo usa. "Solo il motore generico" significa che i selettori della fonte non sono mai stati provati.
- **Selettori**: "su HTML reale" se le note dichiarano la calibrazione su una pagina catturata; altrimenti "non dichiarata": va calibrata (`npm run calibra`) prima di abilitarla.
- **Verificata live**: una esecuzione reale con esito osservato, registrata con data. Non e' una garanzia sul futuro: i portali cambiano.

## Limiti dichiarati delle verifiche live

### reperform

- Il portale pubblica solo la 'Valutazione media', che non e' un prezzo: nessun prezzo, nessuna perizia, nessun mq, nessun indirizzo, nessuna data.
- Tutti i 51 immobili risultano quindi NON VALUTATI.
- Tutte le righe sono in tipo vendita 'Vetrina in corso': non sono aste con termine certo.
- L'idempotenza della rilettura e' provata dai test su fixture, non da una seconda esecuzione live (per non caricare il sito).
- Zona OMI e valutazione non eseguite: i dati OMI non sono presenti in questo ambiente.

## Stato complessivo

Solo le fonti con tutte le colonne positive possono alimentare il radar: oggi sono **1** (la fonte `demo` e' una fixture locale, non un mercato). Le altre non vanno abilitate in massa: ognuna richiede lettura delle condizioni d'uso, calibrazione dei selettori su HTML reale e una prima esecuzione verificata.
