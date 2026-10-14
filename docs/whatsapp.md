# WhatsApp: alert di ribasso e contatto ai partner

Due usi diversi, una sola infrastruttura: la **Cloud API ufficiale di Meta**.
Un numero business, un account, e sia gli alert che l'outreach ci passano sopra.

## Perche' non una libreria presa da GitHub

Cercando "WhatsApp SaaS" si trovano soprattutto progetti costruiti su **Baileys**
o **whatsapp-web.js** (fra cui Evolution API in modalita' predefinita, OpenWA, e
molti pannelli rivenduti come SaaS). Funzionano fingendosi WhatsApp Web con le
credenziali di un account personale.

Il problema non e' tecnico: e' che **violano le condizioni d'uso**, e il blocco
del numero e' definitivo e senza appello. Per Quantum RE quel numero e' lo stesso
con cui si parla con agenti, servicer, curatori e venditori. Non e' un rischio
accettabile per risparmiare qualche centesimo a messaggio.

La Cloud API si paga a conversazione e non ha rischio di blocco. Il codice qui
dentro non usa nessuna libreria: una `POST` con `fetch`, nativo da Node 18.

## Parte 1 — alert di ribasso (gia' funzionante)

### Configurazione

Le credenziali stanno nell'ambiente, **mai nei file di config**: un token della
Cloud API da' accesso in scrittura al numero aziendale, e i file dentro `sites/`
finiscono su git.

| Variabile | Obbligatoria | Cos'e' |
|---|---|---|
| `QDR_WHATSAPP_TOKEN` | si | Token di accesso dell'app Meta |
| `QDR_WHATSAPP_PHONE_ID` | si | Phone Number ID del mittente (l'ID numerico, non il numero) |
| `QDR_WHATSAPP_A` | si | Destinatario in E.164. Spazi e `+` vengono tolti da soli |
| `QDR_WHATSAPP_TEMPLATE` | no | Nome di un template approvato. Senza, si manda testo libero |
| `QDR_WHATSAPP_LINGUA` | no | Lingua del template, default `it` |
| `QDR_WHATSAPP_VERSIONE` | no | Versione Graph API, default `v21.0` |

Si ricavano da developer.facebook.com -> la tua app -> WhatsApp -> API Setup.

PowerShell, per una sessione:

```powershell
$env:QDR_WHATSAPP_TOKEN  = "EAAG..."
$env:QDR_WHATSAPP_PHONE_ID = "123456789012345"
$env:QDR_WHATSAPP_A      = "393401234567"
```

### Uso

```
npm run notifica -- --prova        # compone e mostra il messaggio, non invia
npm run notifica                   # invia il digest degli ultimi 7 giorni
npm run notifica -- 30             # finestra di 30 giorni
npm run notifica -- --rinvia       # rimanda anche cio' che era gia' partito
```

Partire sempre da `--prova`: non tocca ne' la rete ne' il registro.

### La finestra di 24 ore

Meta accetta **testo libero solo entro 24 ore** dall'ultimo messaggio scritto
dall'altra persona. Fuori da quella finestra passa solo un template approvato in
anticipo. Chi prova per la prima volta sbatte quasi sempre contro l'errore
**131047**, che il comando traduce invece di restituirlo grezzo.

Due vie:

- **per provare**: scrivi un messaggio qualsiasi dal tuo WhatsApp al numero
  business. Riapre la finestra per 24 ore e il testo libero passa.
- **per un invio automatico**: fai approvare un template in WhatsApp Manager ->
  Modelli di messaggio, e mettine il nome in `QDR_WHATSAPP_TEMPLATE`.

Testo consigliato per il template (categoria *Utility*, lingua *it*):

```
Quantum Deal Radar: {{1}}. Movimento maggiore: {{2}}. {{3}}
```

Tre parametri. **I parametri di un template non possono contenere a capo**,
tabulazioni o quattro spazi di fila: Meta respinge l'intero messaggio senza dire
quale parametro sia il colpevole. Per questo in modalita' template non si manda
il digest intero ma un riepilogo su riga singola, con il dettaglio in dashboard.

### Perche' non ricevi lo stesso ribasso due volte

Ogni movimento notificato finisce nella tabella `notifiche_inviate`. Senza quel
registro, un digest giornaliero su finestra di sette giorni rimanderebbe lo
stesso ribasso per sette mattine, e chi riceve avvisi ripetuti smette di
leggerli — a quel punto l'unico ribasso che conta e' quello che passa inosservato.

La chiave include il momento della rilevazione, quindi **un secondo ribasso sullo
stesso immobile riparte**: e' una notizia nuova.

La registrazione avviene **dopo** l'invio riuscito, mai prima. Se il messaggio
non parte, niente viene segnato e al tentativo successivo il movimento torna.
Un doppione si ignora; un ribasso mai arrivato no.

### Invio automatico

```
QDR_WATCH_NOTIFICA=true npm run watch -- 360
```

Senza quella variabile `watch` stampa e basta. E' voluto: un processo in
background non deve cominciare a mandare messaggi a un numero vero perche'
qualcuno ha aggiornato il codice.

## Parte 2 — contatto ad agenti e servicer (da fare)

Questo **non e' codice**, ed e' il motivo per cui non si installa in un
pomeriggio. L'ordine conta, ogni passo dipende dal precedente:

1. **Meta Business Manager verificato.** Verifica dell'azienda con visura. Da
   qualche giorno a qualche settimana.
2. **Un numero dedicato.** Un numero gia' attivo su WhatsApp normale va prima
   liberato. Non usare il numero personale.
3. **Template approvati per l'outreach.** Ogni messaggio non richiesto deve
   stare su un template pre-approvato, categoria *Marketing* (costa piu' di
   *Utility*). L'approvazione richiede ore o giorni e puo' essere rifiutata.
4. **Solo allora** una piattaforma ha senso. Le due valide, entrambe sulla
   Cloud API ufficiale:
   - [Whatomate](https://github.com/shridarpatil/whatomate) — Go + Vue, binario
     singolo, campagne e chatbot, multi-tenant con ruoli.
   - [open-bsp-api](https://github.com/matiasbattocchia/open-bsp-api) — Deno +
     Supabase, multi-tenancy nativa, copre anche Instagram.

Prima del punto 3, installare una piattaforma significa guardare una schermata
di login vuota.

**Limite che conviene sapere prima**: il contatto a freddo su WhatsApp verso un
agente che non ha mai acconsentito e' soggetto al GDPR come qualsiasi altro
canale, e Meta richiede un opt-in dimostrabile. Per il primo contatto con una
fonte nuova, email e telefono restano piu' semplici da giustificare; WhatsApp
rende molto bene *dopo*, quando il rapporto c'e' gia'.
