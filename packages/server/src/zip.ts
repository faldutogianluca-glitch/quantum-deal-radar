import { inflateRawSync } from "node:zlib";

/**
 * Lettura minima di un archivio zip, senza dipendenze: le forniture
 * dell'Agenzia delle Entrate (quotazioni e perimetri OMI) arrivano zippate, e
 * chiedere a chi le scarica di estrarle a mano e' un passaggio in cui si
 * sbaglia file.
 *
 * Si legge la directory centrale, che porta dimensioni e posizioni affidabili
 * anche quando l'intestazione locale non le ha (bit 3, dati in coda). Metodi
 * supportati: 0 (non compresso) e 8 (deflate), gli unici che si incontrano.
 */

export interface VoceZip {
  nome: string;
  dati: Buffer;
}

const FIRMA_FINE = 0x06054b50;
const FIRMA_CENTRALE = 0x02014b50;
const FIRMA_LOCALE = 0x04034b50;

export function eZip(dati: Uint8Array): boolean {
  return dati.length > 4 && dati[0] === 0x50 && dati[1] === 0x4b && dati[2] === 0x03 && dati[3] === 0x04;
}

export function leggiZip(dati: Uint8Array): VoceZip[] {
  const buf = Buffer.from(dati.buffer, dati.byteOffset, dati.byteLength);
  // il record di fine directory sta negli ultimi 22 byte, piu' un commento di al massimo 64 KB
  let fine = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === FIRMA_FINE) {
      fine = i;
      break;
    }
  }
  if (fine < 0) throw new Error("archivio zip non valido: manca la directory centrale");
  const voci = buf.readUInt16LE(fine + 10);
  let pos = buf.readUInt32LE(fine + 16);
  if (voci === 0xffff || pos === 0xffffffff) throw new Error("archivio zip64 non supportato: estrai i file e importali sciolti");
  if (pos >= buf.length) throw new Error("archivio zip non valido: directory centrale fuori dal file");
  const out: VoceZip[] = [];
  for (let n = 0; n < voci; n++) {
    if (buf.readUInt32LE(pos) !== FIRMA_CENTRALE) throw new Error("archivio zip non valido: directory centrale corrotta");
    const flag = buf.readUInt16LE(pos + 8);
    const metodo = buf.readUInt16LE(pos + 10);
    const compressa = buf.readUInt32LE(pos + 20);
    const lNome = buf.readUInt16LE(pos + 28);
    const lExtra = buf.readUInt16LE(pos + 30);
    const lCommento = buf.readUInt16LE(pos + 32);
    const locale = buf.readUInt32LE(pos + 42);
    // bit 11: nome in UTF-8; altrimenti CP437, che per i nomi di queste forniture coincide con l'ASCII
    const nome = buf.toString(flag & 0x800 ? "utf8" : "latin1", pos + 46, pos + 46 + lNome);
    pos += 46 + lNome + lExtra + lCommento;
    if (nome.endsWith("/")) continue;
    if (buf.readUInt32LE(locale) !== FIRMA_LOCALE) throw new Error(`archivio zip non valido: ${nome}`);
    const inizio = locale + 30 + buf.readUInt16LE(locale + 26) + buf.readUInt16LE(locale + 28);
    const grezzi = buf.subarray(inizio, inizio + compressa);
    if (metodo === 0) out.push({ nome, dati: Buffer.from(grezzi) });
    else if (metodo === 8) out.push({ nome, dati: inflateRawSync(grezzi) });
    else throw new Error(`${nome}: compressione ${metodo} non supportata`);
  }
  return out;
}
