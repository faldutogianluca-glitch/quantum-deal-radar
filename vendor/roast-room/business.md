# Contesto del business

Il Presidente legge questo file prima di ogni consiglio (passo 1 di `SKILL.md`) e lo usa per riempire il brief: chiede al founder solo quello che qui manca. Contiene solo informazioni che Quantum Re già comunica all'esterno (buy box, impegni di servizio). I numeri riservati (cassa, fatturato, investitori, soglie interne del metodo, storico delle aste) stanno in `business.private.md`, che è in `.gitignore`: questo repository è pubblico.

Ultimo aggiornamento: 14 ottobre 2026.

## Chi è il founder

Gianluca Falduto, Founder & CEO di Quantum Re S.r.l. (Milano). Lavora molto con l'automazione e l'AI: le decisioni sui processi e sugli strumenti contano quanto quelle sui singoli deal.

## Quantum Re S.r.l.

- **Cosa fa:** investe in aste giudiziarie, immobili distressed e crediti NPL/UTP con sottostante immobiliare, anche in club deal con soci.
- **Dove:** Milano e provincia, Lombardia. Fuori Lombardia non compra.
- **Ticket:** 200.000 – 1.200.000 € per operazione.
- **Cosa compra:** palazzine cielo-terra, uffici A/10 convertibili, immobili da frazionare o con cambio di destinazione d'uso in residenziale, immobili ipotecati, occupati o con abusi sanabili; crediti single name con sottostante immobiliare.
- **Due binari:**
  - **A. Club deal (prioritario):** almeno 200 mq, frazionabile o convertibile.
  - **B. Unità singola:** 60–150 mq.
- **Cosa non compra:** vincoli di Soprintendenza non risolvibili, ubicazioni marginali, strutture con costi di recupero superiori al valore.
- **Impegno verso le controparti (SLA):** risposta entro 48 ore, offerta vincolante entro 7–10 giorni dai documenti, nessuna rinegoziazione dopo la LOI salvo fatti nuovi documentati, provvigione piena agli agenti, riservatezza.
- **Fonti di deal:** agenti immobiliari, servicer NPL/UTP, asset manager e SGR, curatori e delegati alle vendite, notai e commercialisti, proprietari diretti. Leva verso gli agenti: mandato di rivendita delle unità dopo il frazionamento.
- **Pipeline:** HubSpot, pipeline "Deal immobiliari QRE" (Segnalato → Screening QRE → WATCH → GO – Due diligence → Offerta presentata → Acquisito / SCARTA-Perso).
- **Comunicazione:** newsletter "Immobili in Movimento", firma "Quantum Re – Osservatorio Real Estate".

## Quantum Deal Radar (prodotto interno)

App che monitora gli immobili distressed (aste giudiziarie, vendite REOCO) sui portali italiani: scraping a moduli, deduplica tra fonti, zona OMI, triangolazione del valore (OMI, perizia, comparabili), storico dei prezzi e ribassi, digest su WhatsApp. Repository: `faldutogianluca-glitch/quantum-deal-radar`. Serve ad alimentare il sourcing di Quantum Re; le decisioni su di esso sono decisioni di prodotto interno (tempo del founder, costi, priorità), non di vendita a terzi, salvo che il founder dica il contrario.

## Strumenti già in uso

Claude Code con skill dedicate (screening dei deal, analisi delle perizie, intake delle segnalazioni, outreach ai partner, revisione del funnel), HubSpot come CRM, LinkedIn per la visibilità del founder.

## Come usare questo contesto nel consiglio

- Una decisione su un immobile o un'asta: il Veterano ha peso 3; chiedi sempre prezzo base, offerta minima, mq dalla perizia, stato occupativo, conformità, lavori, valore di uscita e tempi.
- Una decisione su club deal o raccolta: peso alto a Buffett e al Veterano; chiedi soci, impegni firmati, leva, scadenza del saldo prezzo.
- Una decisione su Deal Radar, automazioni o marketing: il Veterano pesa 1 salvo impatti diretti sul sourcing.
