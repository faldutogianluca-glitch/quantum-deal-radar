import * as cheerio from "cheerio";

/**
 * Ispezione di una pagina gia' catturata.
 *
 * Individuato il blocco che rappresenta una scheda, restano da trovare i
 * selettori dei singoli campi. Questo modulo lavora sul file salvato da
 * `cattura`, quindi la calibrazione non costa altre richieste al sito.
 */

export interface CampoInterno {
  selettore: string;
  /** Su quante schede quel selettore trova qualcosa: se non e' su tutte, il campo e' opzionale. */
  presenteIn: number;
  /** Valori trovati nelle prime schede: servono a capire cos'e' quel campo. */
  esempi: string[];
}

export interface EsitoIspezione {
  occorrenze: number;
  /** HTML della prima scheda, per leggerne la struttura. */
  primoElemento: string;
  campi: CampoInterno[];
  /** Attributi href/src trovati: candidati per il campo url e immagine. */
  collegamenti: CampoInterno[];
}

const normalizza = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * Elenca le classi interne a una scheda con i valori che contengono, cosi' si
 * riconosce a colpo d'occhio quale porta il titolo, quale il prezzo e via
 * dicendo. Un campo presente su tutte le schede e' affidabile; uno presente
 * solo su alcune va trattato come opzionale.
 */
export function ispezionaSchede(html: string, selettore: string, esempi = 3): EsitoIspezione {
  const $ = cheerio.load(html);
  const schede = $(selettore);

  const perClasse = new Map<string, { presenteIn: number; valori: string[] }>();
  const perLink = new Map<string, { presenteIn: number; valori: string[] }>();

  schede.each((_, scheda) => {
    const visteQui = new Set<string>();
    const linkVisti = new Set<string>();

    $(scheda)
      .find("*")
      .each((__, el) => {
        for (const c of ($(el).attr("class") ?? "").split(/\s+/).filter(Boolean)) {
          if (c.length < 2) continue;
          const testo = normalizza($(el).text());
          if (!testo) continue;
          const voce = perClasse.get(c) ?? { presenteIn: 0, valori: [] };
          if (!visteQui.has(c)) {
            voce.presenteIn++;
            visteQui.add(c);
            if (voce.valori.length < esempi) voce.valori.push(testo.slice(0, 90));
          }
          perClasse.set(c, voce);
        }

        for (const attr of ["href", "src"] as const) {
          const v = $(el).attr(attr);
          if (!v) continue;
          const tag = (el as { tagName?: string }).tagName ?? "?";
          const chiave = `${tag}::attr(${attr})`;
          const voce = perLink.get(chiave) ?? { presenteIn: 0, valori: [] };
          if (!linkVisti.has(chiave)) {
            voce.presenteIn++;
            linkVisti.add(chiave);
            if (voce.valori.length < esempi) voce.valori.push(v.slice(0, 90));
          }
          perLink.set(chiave, voce);
        }
      });
  });

  const ordina = (m: Map<string, { presenteIn: number; valori: string[] }>, prefisso: string) =>
    [...m.entries()]
      .map(([k, v]) => ({
        selettore: prefisso ? `${prefisso}${k}` : k,
        presenteIn: v.presenteIn,
        esempi: v.valori,
      }))
      // prima i campi presenti su piu' schede: sono quelli su cui contare
      .sort((a, b) => b.presenteIn - a.presenteIn);

  return {
    occorrenze: schede.length,
    primoElemento: schede.length ? normalizza($.html(schede.first()) ?? "") : "",
    campi: ordina(perClasse, ".").slice(0, 30),
    collegamenti: ordina(perLink, "").slice(0, 8),
  };
}
