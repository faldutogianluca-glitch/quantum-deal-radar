/**
 * Lettura di file CSV, per le fonti che non hanno un catalogo pubblico.
 *
 * BPER Real Estate e Banco BPM/Phoenix non pubblicano un elenco consultabile:
 * i portafogli arrivano per email, feed o data room. Non c'e' niente da
 * scrapare — serve un percorso di importazione.
 *
 * Il parser e' scritto qui invece di aggiungere una dipendenza perche' il
 * formato che arriva davvero e' sempre lo stesso — un export di Excel italiano
 * — e i suoi tre tranelli si affrontano meglio sapendo quali sono che con una
 * libreria generica da configurare.
 */

export type RigaCsv = Record<string, string>;

/**
 * Indovina il separatore.
 *
 * Excel in configurazione italiana esporta con il punto e virgola, perche' la
 * virgola e' gia' il separatore decimale. Un parser che assume la virgola su
 * quei file legge una colonna sola e non se ne accorge: sembra funzionare, e i
 * dati sono spazzatura.
 */
export function indovinaSeparatore(prigaRiga: string): string {
  const candidati = [";", ",", "\t", "|"];
  let migliore = ";";
  let massimo = -1;
  for (const c of candidati) {
    // si conta fuori dalle virgolette: un separatore dentro un campo non conta
    let n = 0;
    let dentro = false;
    for (let i = 0; i < prigaRiga.length; i++) {
      const ch = prigaRiga[i];
      if (ch === '"') dentro = !dentro;
      else if (ch === c && !dentro) n++;
    }
    if (n > massimo) {
      massimo = n;
      migliore = c;
    }
  }
  return massimo > 0 ? migliore : ";";
}

/**
 * Divide il testo in righe di campi.
 *
 * Gestisce le virgolette secondo RFC 4180: un campo puo' contenere il
 * separatore, un a-capo e virgolette raddoppiate. Un indirizzo come
 * `"Via Roma 3, int. 2"` e' un caso normale, non un'eccezione.
 */
function dividi(testo: string, separatore: string): string[][] {
  const righe: string[][] = [];
  let campo = "";
  let riga: string[] = [];
  let dentroVirgolette = false;

  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i]!;

    if (dentroVirgolette) {
      if (ch === '"') {
        // due virgolette di fila sono una virgoletta letterale
        if (testo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroVirgolette = false;
        }
      } else {
        campo += ch;
      }
      continue;
    }

    if (ch === '"') dentroVirgolette = true;
    else if (ch === separatore) {
      riga.push(campo);
      campo = "";
    } else if (ch === "\n") {
      riga.push(campo);
      righe.push(riga);
      riga = [];
      campo = "";
    } else if (ch !== "\r") {
      campo += ch;
    }
  }

  if (campo !== "" || riga.length > 0) {
    riga.push(campo);
    righe.push(riga);
  }
  return righe;
}

export interface EsitoCsv {
  righe: RigaCsv[];
  intestazioni: string[];
  separatore: string;
  /** Righe con un numero di campi diverso dall'intestazione: quasi sempre un file rotto. */
  righeIrregolari: number;
}

export function parseCsv(contenuto: string): EsitoCsv {
  // Excel antepone un BOM: senza toglierlo la prima intestazione diventa
  // "﻿Comune" e nessuna mappatura di colonna la trova piu'
  const testo = contenuto.replace(/^﻿/, "");
  const primaRiga = testo.split("\n", 1)[0] ?? "";
  const separatore = indovinaSeparatore(primaRiga);

  const grezze = dividi(testo, separatore).filter((r) => r.some((c) => c.trim() !== ""));
  if (grezze.length === 0) {
    return { righe: [], intestazioni: [], separatore, righeIrregolari: 0 };
  }

  const intestazioni = grezze[0]!.map((h) => h.trim());
  const righe: RigaCsv[] = [];
  let righeIrregolari = 0;

  for (const grezza of grezze.slice(1)) {
    if (grezza.length !== intestazioni.length) righeIrregolari++;
    const riga: RigaCsv = {};
    intestazioni.forEach((nome, i) => {
      riga[nome] = (grezza[i] ?? "").trim();
    });
    righe.push(riga);
  }

  return { righe, intestazioni, separatore, righeIrregolari };
}

/**
 * Trova la colonna che corrisponde a un nome, ignorando maiuscole, accenti e
 * spazi. Chi prepara il file scrive "Comune", "COMUNE" o "comune " senza
 * pensarci, e far fallire l'importazione per questo sarebbe gratuito.
 */
export function trovaColonna(intestazioni: string[], voluta: string): string | null {
  const semplifica = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const bersaglio = semplifica(voluta);
  return intestazioni.find((h) => semplifica(h) === bersaglio) ?? null;
}
