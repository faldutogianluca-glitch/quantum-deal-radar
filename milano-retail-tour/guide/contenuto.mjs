// Contenuto delle guide gratuite "commenta la parola e ricevi il PDF".
// Ogni guida: slug, parola chiave, copertina, blocchi. I dati vengono dagli articoli del blog (fonti verificate).
// Tipi di blocco: text, facts, checklist, prompts, table, steps, ideas.

export const guide = {
  it: [
    {
      slug: 'MiRT-guida-negozio-visibile-AI',
      keyword: 'AI',
      kicker: 'Guida pratica MiRT',
      title: 'Il tuo negozio esiste per l’AI?',
      sub: 'La checklist in 20 punti e il test dei tre assistenti per farti consigliare quando il cliente chiede all’AI dove comprare.',
      pages: [
        [
          { type: 'text', kicker: 'Perché questa guida', title: 'Il cliente non cerca più come prima', body: [
            'Quando un cliente chiede a un assistente AI “dove trovo un ottico vicino a Porta Venezia aperto il sabato?”, la risposta nomina due o tre negozi, non dieci. L’assistente la compone leggendo la scheda Google, il sito, le recensioni e gli articoli che parlano di te.',
            'Se quelle informazioni sono vaghe o vecchie, consiglierà qualcun altro. Il negozio specializzato ha la competenza che serve per una buona risposta, ma spesso non la scrive da nessuna parte.' ] },
          { type: 'facts', items: [
            ['-15%', 'scoperta dei prodotti con la ricerca tradizionale in Italia, in meno di un anno (Salesforce, 2026)'],
            ['+38%', 'scoperta attraverso nuovi canali come gli assistenti AI, nello stesso periodo (Salesforce, 2026)'],
            ['34%', 'degli italiani ha usato un assistente AI per fare acquisti nell’ultimo anno; 52% nella Gen Z (Adyen, 2026)'],
            ['12%', 'degli acquirenti chiede consiglio a un assistente AI direttamente in corsia (Salesforce, 2026)'] ] },
          { type: 'text', kicker: 'Come usarla', title: 'Un’ora oggi, dieci minuti al mese', body: [
            'Spunta i 20 punti della checklist: quelli vuoti sono il tuo piano di lavoro. Poi fai il test dei tre assistenti e ripetilo ogni mese. Quasi tutto è gratuito e non richiede competenze tecniche.' ] }
        ],
        [
          { type: 'checklist', kicker: 'Checklist · 1 di 2', title: 'Scheda Google e sito', groups: [
            ['La scheda Google', [
              'La categoria principale è precisa (“ottico”, “profumeria artistica”, “ferramenta”), non generica.',
              'Ho aggiunto le categorie secondarie che descrivono cos’altro faccio.',
              'Gli orari sono giusti, compresi festivi e dicembre.',
              'Ci sono foto recenti di vetrina, interno, prodotti e persone.',
              'La descrizione dice servizi, marchi trattati e quartiere.',
              'Rispondo alle domande che i clienti fanno nella sezione “Domande e risposte”.' ]],
            ['Il sito', [
              'Ho una pagina che elenca servizi, marchi e specialità.',
              'Il quartiere e i punti di riferimento vicini sono scritti per esteso.',
              'C’è una sezione con le domande che i clienti mi fanno davvero, con le parole che usano loro.',
              'Indirizzo, telefono e orari sono in testo, non solo in un’immagine.',
              'I prodotti principali sono online, anche senza e-commerce.' ]] ] }
        ],
        [
          { type: 'checklist', kicker: 'Checklist · 2 di 2', title: 'Recensioni e coerenza', groups: [
            ['Le recensioni', [
              'Chiedo una recensione ai clienti contenti, di persona o con un messaggio.',
              'Rispondo a tutte le recensioni entro pochi giorni, anche a quelle negative.',
              'Nelle risposte nomino il servizio (“grazie per aver scelto la nostra regolazione delle montature”).',
              'Le recensioni recenti sono più di quelle vecchie di un anno.' ]],
            ['La coerenza', [
              'Nome, indirizzo e telefono sono identici su sito, Google, Instagram, Facebook ed elenchi online.',
              'Gli orari sono gli stessi su tutti i canali.',
              'La bio di Instagram e Facebook dice cosa vendo e dove.',
              'Il link del sito funziona da ogni profilo.',
              'Con Google Merchant Center mostro i prodotti disponibili in negozio (facoltativo, ma utile).' ]] ] },
          { type: 'text', kicker: 'Il tuo punteggio', title: 'Quanti punti hai spuntato?', body: [
            '16–20: sei leggibile, ora misura con il test. 10–15: le basi ci sono, completa i punti vuoti questo mese. Meno di 10: parti dalla scheda Google, è la fonte che gli assistenti leggono di più per i negozi.' ] }
        ],
        [
          { type: 'prompts', kicker: 'Il test dei tre assistenti', title: 'Chiedi all’AI chi consiglia', intro: 'Fai queste domande a ChatGPT, a Gemini e alla modalità AI di Google. Sostituisci le parti tra parentesi.', items: [
            'Dove compro [il tuo prodotto] vicino a [il tuo quartiere], a Milano?',
            'Qual è il miglior [tipo di negozio] a [quartiere] per [un bisogno preciso, es. lenti progressive]?',
            'Cosa sai di [nome del tuo negozio] a [città]? Che servizi offre e quali sono gli orari?' ] },
          { type: 'table', title: 'Annota i risultati ogni mese', cols: ['Data', 'Assistente', 'Chi viene citato', 'Perché (cosa legge)', 'Io ci sono?'], rows: 6 }
        ],
        [
          { type: 'steps', kicker: 'Cosa fare lunedì', title: 'Sei mosse, quasi tutte gratuite', items: [
            ['Sistema la scheda Google', 'Categoria precisa, orari giusti, foto recenti, una descrizione con servizi e marchi.'],
            ['Scrivi la tua competenza', 'Una pagina del sito con servizi, marchi, specialità, quartiere e le domande dei clienti.'],
            ['Cura le recensioni', 'Chiedile ai clienti contenti e rispondi a tutte nominando il servizio.'],
            ['Rendi tutto coerente', 'Stessi nome, indirizzo, telefono e orari su ogni canale.'],
            ['Mostra cosa hai', 'Metti online i prodotti principali, anche senza vendere online.'],
            ['Fai la prova', 'Il test dei tre assistenti, una volta al mese.'] ] },
          { type: 'text', kicker: 'E l’AI?', title: 'Prima il retail, poi l’AI', body: [
            'Le sei mosse non richiedono intelligenza artificiale: sono le basi del negozio, scritte bene. L’AI arriva dopo e fa risparmiare tempo: aiuta a scrivere le descrizioni, a preparare le risposte alle recensioni (che poi una persona controlla) e a tenere d’occhio ogni mese cosa dicono gli assistenti di te e dei concorrenti.' ] }
        ]
      ],
      sources: [
        ['Salesforce, State of Commerce, comunicato del 29 luglio 2026', 'https://www.salesforce.com/it/news/press-releases/2026/07/29/lultimo-state-of-commerce-di-salesforce-fotografa-un-nuovo-inizio-del-percorso-dacquisto-in-italia-guidato-dallai/'],
        ['Adyen, ricerca su consumatori e retailer italiani, 8 luglio 2026', 'https://www.adyen.com/it_IT/press-and-media/e-se-l-ai-comprasse-al-posto-tuo-oltre-il-40-degli-italiani-dice-si-ricerca-adyen'] ]
    },
    {
      slug: 'MiRT-kit-commesso-aumentato',
      keyword: 'COMMESSO',
      kicker: 'Kit pratico MiRT',
      title: 'Il kit del commesso aumentato',
      sub: 'I moduli per raccogliere le domande dei clienti, scrivere le risposte del titolare e usare l’AI al banco senza perdere il controllo.',
      pages: [
        [
          { type: 'text', kicker: 'Perché questo kit', title: 'Il cliente entra con il telefono in mano', body: [
            'Il negozio conta ancora, e il commesso di più. Ma il cliente arriva informato: il commesso deve saperne almeno quanto il suo telefono.',
            'Nel negozio specializzato la competenza c’è già: sta nel titolare e nei commessi storici. Il problema è che non si moltiplica. Il sabato pomeriggio il titolare è uno, i clienti sono dieci. Questo kit serve a scrivere quella competenza, così che tutti possano usarla, con o senza AI.' ] },
          { type: 'facts', items: [
            ['87%', 'dei ricavi del retail è ancora legato al negozio fisico (IHL Group, 2026)'],
            ['79%', 'degli acquirenti italiani usa lo smartphone mentre fa shopping (Salesforce, 2026)'],
            ['2.300+', 'negozi Ace Hardware in cui i commessi hanno un assistente AI per prodotti e procedure'],
            ['45%', 'dei retailer mette gli strumenti per i commessi tra gli investimenti tecnologici principali del 2026 (IHL Group)'] ] },
          { type: 'steps', kicker: 'Il metodo in 3 settimane', title: 'Dal taccuino all’assistente', items: [
            ['Settimana 1 · Raccogli', 'Ogni commesso annota le domande a cui non sapeva rispondere da solo (modulo A).'],
            ['Settimana 2 · Scrivi', 'Il titolare scrive la risposta giusta alle prime venti (modulo B).'],
            ['Settimana 3 · Usa', 'Le risposte diventano il manuale di chi arriva e la base di un assistente AI (prompt a pagina 4).'] ] }
        ],
        [
          { type: 'table', kicker: 'Modulo A · Settimana 1', title: 'Le domande senza risposta', intro: 'Tienilo vicino alla cassa. Una riga per ogni domanda a cui hai dovuto chiedere aiuto o non hai saputo rispondere.', cols: ['Giorno', 'Domanda del cliente (con le sue parole)', 'Cosa ho risposto', 'Chi mi ha aiutato'], rows: 14 }
        ],
        [
          { type: 'table', kicker: 'Modulo B · Settimana 2', title: 'Le risposte del titolare', intro: 'Una riga per domanda. Scrivi come la spiegheresti tu a un cliente, in parole semplici.', cols: ['Domanda', 'La risposta giusta', 'Prodotti collegati', 'Quando chiamare il titolare'], rows: 9 }
        ],
        [
          { type: 'prompts', kicker: 'Settimana 3 · Usa l’AI', title: 'Otto prompt sicuri per il banco', intro: 'Da usare con un assistente come ChatGPT, Gemini o Copilot. Incolla prima le risposte del modulo B, così l’AI usa le tue parole e non quelle di internet.', items: [
            'Ecco le risposte del nostro negozio alle domande frequenti: [incolla]. Rispondi solo usando queste informazioni. Se la risposta non c’è, dimmi “chiedi al titolare”.',
            'Riscrivi questa risposta in tre frasi semplici, come la direbbe un commesso al banco: [risposta].',
            'Un cliente chiede [domanda]. Quali due domande gli faccio per capire cosa gli serve davvero?',
            'Spiega la differenza tra [prodotto A] e [prodotto B] a un cliente che non è esperto, senza termini tecnici.',
            'Prepara la bozza di un messaggio WhatsApp di ringraziamento dopo l’acquisto di [prodotto], tono cordiale, massimo 300 caratteri.',
            'Scrivi un promemoria gentile per il cliente: [controllo/manutenzione/ritiro] il [data].',
            'Trasforma queste 20 risposte in una scheda di formazione di una pagina per un commesso nuovo.',
            'Leggi queste recensioni: [incolla]. Quali domande o dubbi dei clienti ritornano più spesso?' ] },
          { type: 'checklist', kicker: 'Le regole', title: 'L’AI aiuta, decide una persona', groups: [['', [
            'Ogni risultato dell’AI passa da una persona che lo controlla prima di arrivare al cliente.',
            'Nei tool pubblici non inserisco nomi, telefoni, email o dati sanitari dei clienti.',
            'Se l’AI non è sicura o la risposta non è nel modulo B, chiamo il titolare.',
            'Ogni commesso ha ricevuto una formazione base sull’AI: l’AI Act lo chiede a chi la usa in azienda dal febbraio 2025.' ]]] }
        ]
      ],
      sources: [
        ['IHL Group, Empowering the frontline, 2 maggio 2026', 'https://www.ihlservices.com/news/analyst-corner/2026/05/empowering-the-frontline-how-retailers-are-rethinking-store-execution-from-the-associate-up/'],
        ['Salesforce, State of Commerce, comunicato del 29 luglio 2026', 'https://www.salesforce.com/it/news/press-releases/2026/07/29/lultimo-state-of-commerce-di-salesforce-fotografa-un-nuovo-inizio-del-percorso-dacquisto-in-italia-guidato-dallai/'] ],
      note: 'Questo kit non è una consulenza legale.'
    },
    {
      slug: 'MiRT-5-idee-flagship-Milano',
      keyword: 'FLAGSHIP',
      kicker: 'Dal campo a Milano',
      title: '5 idee dai flagship di Milano da copiare in piccolo',
      sub: 'Cosa fanno i grandi brand nei loro negozi del 2026 e la versione per un negozio specializzato, con il piano dei primi 30 giorni.',
      pages: [
        [
          { type: 'text', kicker: 'Perché guardare i flagship', title: 'Velocità o scoperta: il negozio deve scegliere', body: [
            'Oltre il 40% di Gen Z e millennial dice che l’esperienza in negozio lo rende più propenso a comprare, mentre il 37% dei consumatori mette al primo posto la comodità (ICSC e McKinsey, 2026).',
            'I flagship scelgono la scoperta e la rendono visibile. Per questo sono un buon laboratorio da osservare. Non servono 200 metri quadri e un architetto per copiarne l’idea: per ognuno dei cinque casi trovi una versione da negozio specializzato, da provare con poco.' ] },
          { type: 'ideas', items: [
            ['01', 'Far toccare', 'L’Ottocento, viale Piave', 'Una materioteca: chi entra tocca essenze di legno, blocchi grezzi e sezioni dei mobili.', 'Un angolo campionario dove il cliente tocca e confronta, con la scheda di ogni materiale.', 'Arredo, tessuti, ottica, calzature, biciclette'],
            ['02', 'Creare un appuntamento', 'Hoka, Brera', 'Un run club settimanale che prepara i runner alle gare cittadine.', 'Un appuntamento fisso, sempre lo stesso giorno: un’uscita, un corso, una degustazione, un laboratorio.', 'Sport, enoteche, librerie, ferramenta, giardinaggio'] ] }
        ],
        [
          { type: 'ideas', items: [
            ['03', 'Personalizzare davanti al cliente', 'Liu Jo Circle, corso Vittorio Emanuele', 'Un angolo dove si personalizzano i jeans con cristalli, ricami e laser, a partire da una consulenza.', 'Un servizio su misura con una persona dedicata e un nome riconoscibile: l’incisione, l’orlo, la montatura, la regolazione.', 'Abbigliamento, gioielleria, ottica, pelletteria'],
            ['04', 'Dare un motivo per tornare', 'Pop Mart, via Dante', 'Negozi pensati come esperienze dedicate ai propri personaggi da collezione.', 'Un calendario delle novità comunicato in anticipo, con un’uscita o un’edizione limitata al mese.', 'Giocattoli, libri, profumi, vino, cartoleria'],
            ['05', 'Diventare una destinazione', 'Ralph Lauren, via della Spiga', 'Il primo negozio dedicato alla casa, accanto al flagship, al bar e alla boutique bambino.', 'Allargare di un passo, verso una categoria vicina che i tuoi clienti già cercano.', 'La libreria con il caffè, la bici con l’officina, l’enoteca con le serate'] ] }
        ],
        [
          { type: 'table', kicker: 'Il tuo piano', title: 'I primi 30 giorni', intro: 'Scegli una sola idea, quella più vicina a quello che già fai. Fissa una data entro gennaio.', cols: ['Settimana', 'Cosa faccio', 'Chi se ne occupa', 'Fatto'], prefill: [
            ['1', 'Scelgo l’idea e la data. Preparo lo spazio o il servizio.', '', ''],
            ['2', 'Lo dico ai clienti migliori, di persona o su WhatsApp. Lo metto su Instagram e sulla scheda Google.', '', ''],
            ['3', 'Prima edizione. Annoto chi viene e cosa chiede.', '', ''],
            ['4', 'Conto chi è tornato e chi ha comprato. Decido se renderla fissa.', '', ''] ] },
          { type: 'table', title: 'Come misuro', cols: ['Indicatore', 'Prima', 'Dopo 30 giorni'], prefill: [
            ['Clienti presenti all’iniziativa', '–', ''], ['Clienti tornati entro un mese', '', ''], ['Nuovi contatti (WhatsApp, email)', '', ''], ['Recensioni nuove', '', ''] ] }
        ],
        [
          { type: 'text', kicker: 'Dove entra l’AI', title: 'Dietro le quinte, non nelle installazioni', body: [
            'Il lavoro che i flagship fanno con un team intero, un negozio specializzato lo può fare con una persona e un assistente AI: gestire le prenotazioni dell’appuntamento fisso e i promemoria ai clienti, preparare le schede dei materiali, scrivere la bozza del calendario delle novità. Ogni testo passa da una persona prima di uscire.' ] },
          { type: 'prompts', kicker: 'Tre prompt per partire', title: 'Da copiare e adattare', items: [
            'Sono un [tipo di negozio] a [quartiere]. Proponimi 5 idee di appuntamento mensile in negozio per i miei clienti, con costo basso e durata massima di un’ora.',
            'Scrivi la scheda di questo materiale per un cliente non esperto, in 5 righe: [nome, origine, caratteristiche, cura].',
            'Prepara un calendario delle novità per i prossimi 3 mesi con queste uscite: [elenco]. Per ognuna, un messaggio WhatsApp di massimo 200 caratteri.' ] }
        ]
      ],
      sources: [
        ['ICSC e McKinsey, Shopping in the Age of AI, aprile 2026', 'https://www.businesswire.com/news/home/20260424983250/en/ICSC-McKinsey-Company-Release-Shopping-in-the-Age-of-AI-Redefining-Stores-for-a-New-Era-Report'],
        ['Design Diffusion, il flagship L’Ottocento, 23 marzo 2026', 'https://designdiffusion.com/2026/03/23/l-ottocento-flagship-store-milano-porta-venezia-2026/'],
        ['The Running Club, Hoka apre a Milano, 17 aprile 2026', 'https://www.therunningclub.it/2026/04/17/hoka-apre-a-milano-il-suo-primo-flagship-store-in-italia/'],
        ['Beyond the Magazine, Liu Jo Circle, 1 ottobre 2026', 'https://www.beyondthemagazine.it/moda/liu-jo-circle/'],
        ['ItaliaOggi, Pop Mart fa il bis a Milano, 7 settembre 2026', 'https://www.italiaoggi.it/marketing-e-media/marketing/pop-mart-fa-il-bis-a-milano-in-via-dante-in-attesa-del-grande-flagship-in-san-babila-csemve7v'],
        ['MF Milano Finanza, Ralph Lauren primo home store, 18 aprile 2026', 'https://www.milanofinanza.it/news/ralph-lauren-primo-home-store-a-milano-2701492'] ]
    }
  ],

  en: [
    {
      slug: 'MiRT-guide-store-visible-to-AI',
      keyword: 'AI',
      kicker: 'MiRT practical guide',
      title: 'Does your store exist for AI?',
      sub: 'A 20-point checklist and the three-assistant test, so you get recommended when customers ask AI where to buy.',
      pages: [
        [
          { type: 'text', kicker: 'Why this guide', title: 'Customers don’t search the way they used to', body: [
            'When a customer asks an AI assistant “where can I find an optician near Porta Venezia that’s open on Saturdays?”, the answer names two or three stores, not ten. The assistant builds it from your Google profile, your website, your reviews and articles about you.',
            'If that information is vague or out of date, it will recommend someone else. Specialist stores have exactly the expertise a good answer needs, but they often never write it down.' ] },
          { type: 'facts', items: [
            ['-15%', 'product discovery through traditional search in Italy, in under a year (Salesforce, 2026)'],
            ['+38%', 'discovery through new channels such as AI assistants, over the same period (Salesforce, 2026)'],
            ['34%', 'of Italians used an AI assistant for shopping in the past year; 52% of Gen Z (Adyen, 2026)'],
            ['12%', 'of shoppers ask an AI assistant for advice right in the aisle (Salesforce, 2026)'] ] },
          { type: 'text', kicker: 'How to use it', title: 'One hour today, ten minutes a month', body: [
            'Tick off the 20 checklist points: the empty boxes are your to-do list. Then run the three-assistant test and repeat it every month. Almost all of it is free and needs no technical skills.' ] }
        ],
        [
          { type: 'checklist', kicker: 'Checklist · 1 of 2', title: 'Google profile and website', groups: [
            ['Your Google profile', [
              'The main category is precise (“optician”, “niche perfumery”, “hardware store”), not generic.',
              'I’ve added secondary categories that describe what else I do.',
              'Opening hours are correct, including holidays and December.',
              'There are recent photos of the window, interior, products and people.',
              'The description mentions services, brands and neighbourhood.',
              'I answer the questions customers ask in the Q&A section.' ]],
            ['Your website', [
              'I have a page listing services, brands and specialities.',
              'The neighbourhood and nearby landmarks are written out in full.',
              'There’s a section with the questions customers really ask, in their own words.',
              'Address, phone and hours are in text, not only in an image.',
              'My main products are online, even without e-commerce.' ]] ] }
        ],
        [
          { type: 'checklist', kicker: 'Checklist · 2 of 2', title: 'Reviews and consistency', groups: [
            ['Reviews', [
              'I ask happy customers for a review, in person or by message.',
              'I reply to every review within a few days, negative ones included.',
              'My replies name the service (“thanks for choosing our frame adjustment”).',
              'Recent reviews outnumber those older than a year.' ]],
            ['Consistency', [
              'Name, address and phone are identical on the website, Google, Instagram, Facebook and directories.',
              'Opening hours are the same on every channel.',
              'My Instagram and Facebook bios say what I sell and where.',
              'The website link works from every profile.',
              'I show in-store products with Google Merchant Center (optional, but useful).' ]] ] },
          { type: 'text', kicker: 'Your score', title: 'How many did you tick?', body: [
            '16–20: you’re readable, now measure with the test. 10–15: the basics are there, fill the gaps this month. Under 10: start with your Google profile, it’s the source assistants read most for local stores.' ] }
        ],
        [
          { type: 'prompts', kicker: 'The three-assistant test', title: 'Ask AI who it recommends', intro: 'Ask ChatGPT, Gemini and Google’s AI Mode these questions. Replace the parts in brackets.', items: [
            'Where can I buy [your product] near [your neighbourhood] in Milan?',
            'What’s the best [type of store] in [neighbourhood] for [a specific need, e.g. progressive lenses]?',
            'What do you know about [your store name] in [city]? What services does it offer and what are its hours?' ] },
          { type: 'table', title: 'Log the results every month', cols: ['Date', 'Assistant', 'Who gets mentioned', 'Why (what it reads)', 'Am I there?'], rows: 6 }
        ],
        [
          { type: 'steps', kicker: 'What to do on Monday', title: 'Six moves, almost all free', items: [
            ['Fix your Google profile', 'Precise category, correct hours, recent photos, a description with services and brands.'],
            ['Write down your expertise', 'A website page with services, brands, specialities, neighbourhood and customer questions.'],
            ['Look after reviews', 'Ask happy customers and reply to all of them, naming the service.'],
            ['Make it consistent', 'Same name, address, phone and hours on every channel.'],
            ['Show what you stock', 'Put your main products online, even if you don’t sell online.'],
            ['Run the test', 'The three-assistant test, once a month.'] ] },
          { type: 'text', kicker: 'And AI?', title: 'Retail first, then AI', body: [
            'None of the six moves needs artificial intelligence: they’re store basics, written down well. AI comes next and saves time: it helps write descriptions, drafts review replies (which a person then checks) and tracks every month what assistants say about you and your competitors.' ] }
        ]
      ],
      sources: [
        ['Salesforce, State of Commerce, press release, 29 July 2026 (Italian)', 'https://www.salesforce.com/it/news/press-releases/2026/07/29/lultimo-state-of-commerce-di-salesforce-fotografa-un-nuovo-inizio-del-percorso-dacquisto-in-italia-guidato-dallai/'],
        ['Adyen, research on Italian consumers and retailers, 8 July 2026 (Italian)', 'https://www.adyen.com/it_IT/press-and-media/e-se-l-ai-comprasse-al-posto-tuo-oltre-il-40-degli-italiani-dice-si-ricerca-adyen'] ]
    },
    {
      slug: 'MiRT-augmented-sales-associate-kit',
      keyword: 'STAFF',
      kicker: 'MiRT practical kit',
      title: 'The augmented sales associate kit',
      sub: 'Forms to collect customer questions, write down the owner’s answers and use AI at the counter without losing control.',
      pages: [
        [
          { type: 'text', kicker: 'Why this kit', title: 'Customers walk in with a phone in hand', body: [
            'The store still matters, and the sales associate matters even more. But customers arrive informed: your staff need to know at least as much as their phone.',
            'In a specialist store the expertise is already there, in the owner and the long-serving staff. The problem is that it doesn’t scale. On a Saturday afternoon there’s one owner and ten customers. This kit helps you write that expertise down so everyone can use it, with or without AI.' ] },
          { type: 'facts', items: [
            ['87%', 'of retail revenue is still tied to physical stores (IHL Group, 2026)'],
            ['79%', 'of Italian shoppers use their smartphone while shopping (Salesforce, 2026)'],
            ['2,300+', 'Ace Hardware stores where staff have an AI assistant for products and procedures'],
            ['45%', 'of retailers rank tools for store staff among their main tech investments for 2026 (IHL Group)'] ] },
          { type: 'steps', kicker: 'The 3-week method', title: 'From notebook to assistant', items: [
            ['Week 1 · Collect', 'Every associate notes the questions they couldn’t answer alone (form A).'],
            ['Week 2 · Write', 'The owner writes the right answer to the first twenty (form B).'],
            ['Week 3 · Use', 'The answers become the training manual for new staff and the base for an AI assistant (prompts on page 4).'] ] }
        ],
        [
          { type: 'table', kicker: 'Form A · Week 1', title: 'Questions without an answer', intro: 'Keep it by the till. One row for every question you had to ask for help with or couldn’t answer.', cols: ['Day', 'Customer question (in their words)', 'What I answered', 'Who helped me'], rows: 14 }
        ],
        [
          { type: 'table', kicker: 'Form B · Week 2', title: 'The owner’s answers', intro: 'One row per question. Write it the way you’d explain it to a customer, in plain words.', cols: ['Question', 'The right answer', 'Related products', 'When to call the owner'], rows: 9 }
        ],
        [
          { type: 'prompts', kicker: 'Week 3 · Use AI', title: 'Eight safe prompts for the counter', intro: 'For an assistant such as ChatGPT, Gemini or Copilot. Paste in your form B answers first, so the AI uses your words, not the internet’s.', items: [
            'Here are our store’s answers to frequent questions: [paste]. Answer only using this information. If the answer isn’t there, say “ask the owner”.',
            'Rewrite this answer in three simple sentences, the way an associate would say it at the counter: [answer].',
            'A customer asks [question]. Which two questions should I ask to understand what they really need?',
            'Explain the difference between [product A] and [product B] to a non-expert customer, without jargon.',
            'Draft a WhatsApp thank-you message after the purchase of [product], friendly tone, max 300 characters.',
            'Write a friendly reminder for the customer: [check-up/service/pick-up] on [date].',
            'Turn these 20 answers into a one-page training sheet for a new associate.',
            'Read these reviews: [paste]. Which customer questions or doubts come up most often?' ] },
          { type: 'checklist', kicker: 'The rules', title: 'AI helps, a person decides', groups: [['', [
            'Every AI output is checked by a person before it reaches a customer.',
            'I never enter customer names, phone numbers, emails or health data into public tools.',
            'If the AI isn’t sure or the answer isn’t in form B, I call the owner.',
            'Every associate has had basic AI training: since February 2025 the EU AI Act requires it of companies that use AI.' ]]] }
        ]
      ],
      sources: [
        ['IHL Group, Empowering the frontline, 2 May 2026', 'https://www.ihlservices.com/news/analyst-corner/2026/05/empowering-the-frontline-how-retailers-are-rethinking-store-execution-from-the-associate-up/'],
        ['Salesforce, State of Commerce, press release, 29 July 2026 (Italian)', 'https://www.salesforce.com/it/news/press-releases/2026/07/29/lultimo-state-of-commerce-di-salesforce-fotografa-un-nuovo-inizio-del-percorso-dacquisto-in-italia-guidato-dallai/'] ],
      note: 'This kit is not legal advice.'
    },
    {
      slug: 'MiRT-5-ideas-Milan-flagships',
      keyword: 'FLAGSHIP',
      kicker: 'From the field in Milan',
      title: '5 ideas from Milan’s flagships to copy on a small scale',
      sub: 'What big brands are doing in their 2026 stores, the version for a specialist store, and a plan for the first 30 days.',
      pages: [
        [
          { type: 'text', kicker: 'Why look at flagships', title: 'Speed or discovery: a store has to choose', body: [
            'Over 40% of Gen Z and millennials say in-store experiences make them more likely to buy from a retailer, while 37% of consumers put convenience first (ICSC and McKinsey, 2026).',
            'Flagships choose discovery and make it visible. That makes them a good lab to watch. You don’t need 200 square metres and an architect to borrow the idea: for each of the five cases there’s a specialist-store version you can try on a small budget.' ] },
          { type: 'ideas', items: [
            ['01', 'Let people touch', 'L’Ottocento, viale Piave', 'A materials library: visitors touch wood species, raw blocks and furniture sections.', 'A sample corner where customers touch and compare, with a card for each material.', 'Furniture, fabrics, eyewear, footwear, bikes'],
            ['02', 'Create a fixed appointment', 'Hoka, Brera', 'A weekly run club that trains runners for the city races.', 'A fixed appointment, always on the same day: an outing, a class, a tasting, a workshop.', 'Sport, wine shops, bookshops, hardware, gardening'] ] }
        ],
        [
          { type: 'ideas', items: [
            ['03', 'Customise in front of the customer', 'Liu Jo Circle, corso Vittorio Emanuele', 'A corner where jeans are customised with crystals, embroidery and laser, starting from a consultation.', 'A made-to-measure service with a dedicated person and a recognisable name: engraving, hemming, frame fitting, adjustment.', 'Clothing, jewellery, eyewear, leather goods'],
            ['04', 'Give a reason to come back', 'Pop Mart, via Dante', 'Stores designed as experiences around its collectible characters.', 'A release calendar announced in advance, with one launch or limited edition a month.', 'Toys, books, perfume, wine, stationery'],
            ['05', 'Become a destination', 'Ralph Lauren, via della Spiga', 'Its first home-only store, next to the flagship, the bar and the kids’ boutique.', 'Expand one step into a nearby category your customers already look for.', 'Bookshop with café, bike shop with workshop, wine shop with evenings'] ] }
        ],
        [
          { type: 'table', kicker: 'Your plan', title: 'The first 30 days', intro: 'Pick one idea only, the one closest to what you already do. Set a date before the end of January.', cols: ['Week', 'What I do', 'Who owns it', 'Done'], prefill: [
            ['1', 'Choose the idea and the date. Prepare the space or the service.', '', ''],
            ['2', 'Tell your best customers, in person or on WhatsApp. Post it on Instagram and your Google profile.', '', ''],
            ['3', 'First edition. Note who comes and what they ask.', '', ''],
            ['4', 'Count who came back and who bought. Decide whether to make it permanent.', '', ''] ] },
          { type: 'table', title: 'How I measure it', cols: ['Indicator', 'Before', 'After 30 days'], prefill: [
            ['Customers at the event', '–', ''], ['Customers back within a month', '', ''], ['New contacts (WhatsApp, email)', '', ''], ['New reviews', '', ''] ] }
        ],
        [
          { type: 'text', kicker: 'Where AI fits', title: 'Behind the scenes, not in the installations', body: [
            'What flagships do with a whole team, a specialist store can do with one person and an AI assistant: managing bookings and reminders for the fixed appointment, preparing material cards, drafting the release calendar. Every text is checked by a person before it goes out.' ] },
          { type: 'prompts', kicker: 'Three prompts to start', title: 'Copy and adapt', items: [
            'I run a [type of store] in [neighbourhood]. Suggest 5 ideas for a monthly in-store appointment for my customers, low cost and one hour max.',
            'Write a card for this material for a non-expert customer, in 5 lines: [name, origin, features, care].',
            'Prepare a release calendar for the next 3 months with these launches: [list]. For each, a WhatsApp message of max 200 characters.' ] }
        ]
      ],
      sources: [
        ['ICSC and McKinsey, Shopping in the Age of AI, April 2026', 'https://www.businesswire.com/news/home/20260424983250/en/ICSC-McKinsey-Company-Release-Shopping-in-the-Age-of-AI-Redefining-Stores-for-a-New-Era-Report'],
        ['Design Diffusion, L’Ottocento flagship, 23 March 2026', 'https://designdiffusion.com/2026/03/23/l-ottocento-flagship-store-milano-porta-venezia-2026/'],
        ['The Running Club, Hoka opens in Milan, 17 April 2026', 'https://www.therunningclub.it/2026/04/17/hoka-apre-a-milano-il-suo-primo-flagship-store-in-italia/'],
        ['Beyond the Magazine, Liu Jo Circle, 1 October 2026', 'https://www.beyondthemagazine.it/moda/liu-jo-circle/'],
        ['ItaliaOggi, Pop Mart’s second Milan store, 7 September 2026', 'https://www.italiaoggi.it/marketing-e-media/marketing/pop-mart-fa-il-bis-a-milano-in-via-dante-in-attesa-del-grande-flagship-in-san-babila-csemve7v'],
        ['MF Milano Finanza, Ralph Lauren’s first home store, 18 April 2026', 'https://www.milanofinanza.it/news/ralph-lauren-primo-home-store-a-milano-2701492'] ]
    }
  ]
};

export const ui = {
  it: {
    endKick: 'Il passo successivo', endTitle: 'Vuoi capire da dove partire nel tuo negozio?',
    endText: 'Prenota la <b>Diagnosi MiRT</b>: 30 minuti in videochiamata, gratis. Prima guardiamo il tuo negozio da fuori (scheda Google, recensioni, sito, cosa dicono gli assistenti AI); in chiamata ti indichiamo i tre punti dove l’AI ti fa guadagnare tempo o clienti.',
    endBtn: 'Prenota la Diagnosi →', endUrl: 'https://www.milanoretailtour.com/contatti/?diagnosi',
    more: 'Vuoi tutti i trend? Scrivi <b>RADAR</b> sotto un nostro post e ti mandiamo il MiRT Radar 2027: 10 trend del retail specializzato, con la prima mossa per ognuno.',
    sources: 'Fonti', signature: 'Contenuto scritto con l’ausilio dell’AI con la supervisione di Gianluca Falduto.',
    contacts: 'Milano Retail Tour · info@milanoretailtour.com · +39 02 97376045 · Corso S. Gottardo 18, Milano',
    free: 'Gratuito · da usare e condividere'
  },
  en: {
    endKick: 'Next step', endTitle: 'Want to know where to start in your store?',
    endText: 'Book the free <b>MiRT Diagnosis</b>: a 30-minute video call. First we look at your store from the outside (Google profile, reviews, website, what AI assistants say); on the call we show you the three places where AI saves you time or wins you customers.',
    endBtn: 'Book the Diagnosis →', endUrl: 'https://www.milanoretailtour.com/en/contact-us/?diagnosi',
    more: 'Want all the trends? Comment <b>RADAR</b> under one of our posts and we’ll send you the MiRT Radar 2027 (in Italian): 10 specialist retail trends, with the first move for each.',
    sources: 'Sources', signature: 'Written with the help of AI under the supervision of Gianluca Falduto.',
    contacts: 'Milano Retail Tour · info@milanoretailtour.com · +39 02 97376045 · Corso S. Gottardo 18, Milan',
    free: 'Free · use it and share it'
  }
};
