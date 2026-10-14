/*
 * Invio di messaggi WhatsApp tramite la Cloud API ufficiale di Meta.
 *
 * PERCHE' QUESTA E NON UNA LIBRERIA
 *
 * Su GitHub le librerie piu' diffuse (Baileys, whatsapp-web.js, e i gateway
 * costruiti sopra di esse) funzionano fingendosi WhatsApp Web con le
 * credenziali di un account personale. Violano le condizioni d'uso, e il
 * blocco del numero e' definitivo e senza appello. Per Quantum RE quel numero
 * e' lo stesso con cui si parla con agenti, servicer e curatori: perderlo non
 * e' un guasto tecnico, e' un danno commerciale.
 *
 * La Cloud API e' il canale autorizzato. Si paga a conversazione, non ha
 * rischio di blocco, e non richiede nessuna dipendenza: una POST con fetch,
 * che Node ha nativamente dalla 18.
 *
 * LA FINESTRA DI 24 ORE
 *
 * Meta consente testo libero solo entro 24 ore dall'ultimo messaggio scritto
 * dall'altra persona. Fuori da quella finestra passa solo un *template*
 * approvato in anticipo. Per gli alert personali la finestra si riapre
 * scrivendo al proprio numero business, ma e' un appoggio fragile: per un
 * invio che deve partire da solo ogni mattina serve un template. Entrambe le
 * forme sono supportate qui, e l'errore 131047 viene tradotto invece di
 * essere restituito grezzo, perche' e' quello che capita per primo a chiunque.
 */

/** Limite del corpo di un messaggio di testo imposto da WhatsApp. */
export const MAX_CARATTERI = 4096;

export interface ConfigWhatsApp {
  /** Token di accesso dell'app Meta. */
  token: string;
  /** Phone Number ID del mittente (non il numero: l'ID numerico del pannello). */
  phoneId: string;
  /** Destinatario in formato E.164 senza '+', es. 393401234567. */
  a: string;
  /** Nome di un template approvato. Se assente si invia testo libero. */
  template?: string;
  /** Lingua del template, es. "it". */
  lingua: string;
  /** Versione della Graph API. */
  versione: string;
}

/** Config assente o incompleta: dice *quale* variabile manca, non solo che manca qualcosa. */
export interface ConfigMancante {
  ok: false;
  mancanti: string[];
  spiegazione: string;
}

export interface ConfigPresente {
  ok: true;
  config: ConfigWhatsApp;
}

const RICHIESTE = [
  ["QDR_WHATSAPP_TOKEN", "token di accesso dell'app Meta"],
  ["QDR_WHATSAPP_PHONE_ID", "Phone Number ID del mittente"],
  ["QDR_WHATSAPP_A", "numero destinatario in E.164 senza '+' (es. 393401234567)"],
] as const;

/**
 * Legge la configurazione dall'ambiente.
 *
 * Le credenziali stanno nell'ambiente e non nel config delle fonti di
 * proposito: un token della Cloud API da' accesso in scrittura al numero
 * aziendale, e i file dentro sites/ finiscono su git.
 */
export function configurazioneWhatsApp(env: NodeJS.ProcessEnv = process.env): ConfigPresente | ConfigMancante {
  const mancanti = RICHIESTE.filter(([nome]) => !env[nome]?.trim()).map(([nome, cosa]) => `${nome} (${cosa})`);
  if (mancanti.length > 0) {
    return {
      ok: false,
      mancanti,
      spiegazione:
        "Credenziali WhatsApp non configurate. Si ottengono dal pannello\n" +
        "developers.facebook.com -> la tua app -> WhatsApp -> API Setup.",
    };
  }
  const a = env.QDR_WHATSAPP_A!.trim().replace(/[^0-9]/g, "");
  return {
    ok: true,
    config: {
      token: env.QDR_WHATSAPP_TOKEN!.trim(),
      phoneId: env.QDR_WHATSAPP_PHONE_ID!.trim().replace(/[^0-9]/g, ""),
      a,
      template: env.QDR_WHATSAPP_TEMPLATE?.trim() || undefined,
      lingua: env.QDR_WHATSAPP_LINGUA?.trim() || "it",
      versione: env.QDR_WHATSAPP_VERSIONE?.trim() || "v21.0",
    },
  };
}

export interface EsitoInvio {
  inviato: boolean;
  /** Identificativo del messaggio presso Meta, utile per rintracciarlo nei log. */
  wamid?: string;
  errore?: string;
}

/**
 * Traduce gli errori della Cloud API in qualcosa di azionabile.
 *
 * Meta restituisce un codice numerico e un messaggio spesso generico. Questi
 * quattro coprono quasi tutto quello che capita davvero, e ognuno ha una causa
 * diversa: confonderli porta a cercare il guasto dalla parte sbagliata.
 */
export function spiegaErrore(codice: number | undefined, messaggio: string): string {
  switch (codice) {
    case 131047:
      return (
        `${messaggio}\n\n` +
        "Finestra di 24 ore chiusa: fuori da quella finestra Meta accetta solo\n" +
        "un template approvato. Due vie: scrivi un messaggio qualsiasi al tuo\n" +
        "numero business (riapre la finestra per 24 ore, utile per provare), o\n" +
        "fai approvare un template e impostalo in QDR_WHATSAPP_TEMPLATE."
      );
    case 190:
      return (
        `${messaggio}\n\n` +
        "Token scaduto o revocato. I token temporanei del pannello durano 24 ore:\n" +
        "per un invio automatico serve un token permanente di System User."
      );
    case 132001:
      return (
        `${messaggio}\n\n` +
        "Template inesistente o non approvato in questa lingua. Verifica nome e\n" +
        "lingua esatti in WhatsApp Manager -> Modelli di messaggio."
      );
    case 131026:
      return (
        `${messaggio}\n\n` +
        "Numero non raggiungibile: non ha WhatsApp, oppure non ha mai acconsentito\n" +
        "a ricevere messaggi da questo numero business."
      );
    default:
      return messaggio;
  }
}

async function invia(cfg: ConfigWhatsApp, corpo: Record<string, unknown>): Promise<EsitoInvio> {
  const url = `https://graph.facebook.com/${cfg.versione}/${cfg.phoneId}/messages`;
  let risposta: Response;
  try {
    risposta = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", to: cfg.a, ...corpo }),
    });
  } catch (err) {
    return { inviato: false, errore: `rete non raggiungibile: ${(err as Error).message}` };
  }

  const testo = await risposta.text();
  let dati: {
    messages?: { id?: string }[];
    error?: { message?: string; code?: number; error_data?: { details?: string } };
  };
  try {
    dati = JSON.parse(testo) as typeof dati;
  } catch {
    // una risposta non-JSON significa quasi sempre un proxy o una pagina di
    // errore davanti all'API: mostrarla com'e' e' piu' utile che inventarsi
    // una spiegazione
    return { inviato: false, errore: `risposta non interpretabile (HTTP ${risposta.status}): ${testo.slice(0, 300)}` };
  }

  if (!risposta.ok || dati.error) {
    const dettaglio = dati.error?.error_data?.details;
    const base = [dati.error?.message, dettaglio].filter(Boolean).join(" - ") || `HTTP ${risposta.status}`;
    return { inviato: false, errore: spiegaErrore(dati.error?.code, base) };
  }

  return { inviato: true, wamid: dati.messages?.[0]?.id };
}

/** Testo libero. Funziona solo dentro la finestra di 24 ore. */
export function inviaTesto(cfg: ConfigWhatsApp, testo: string): Promise<EsitoInvio> {
  return invia(cfg, {
    type: "text",
    // preview_url disattivata: il digest contiene molti link e l'anteprima del
    // primo renderebbe il messaggio molto piu' alto senza aggiungere nulla
    text: { preview_url: false, body: testo.slice(0, MAX_CARATTERI) },
  });
}

/**
 * Template approvato, con i parametri posizionali del corpo.
 *
 * E' la forma che serve per un invio automatico e per qualunque contatto a
 * freddo: Meta accetta messaggi non richiesti solo cosi'.
 */
export function inviaTemplate(cfg: ConfigWhatsApp, parametri: string[]): Promise<EsitoInvio> {
  return invia(cfg, {
    type: "template",
    template: {
      name: cfg.template,
      language: { code: cfg.lingua },
      components:
        parametri.length > 0
          ? [{ type: "body", parameters: parametri.map((p) => ({ type: "text", text: p })) }]
          : [],
    },
  });
}
