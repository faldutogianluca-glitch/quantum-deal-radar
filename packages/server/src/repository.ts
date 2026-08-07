import { chiaveGeofisica, chiaveGiudiziaria } from "@qdr/core";
import type { ImmobileNorm, Valutazione } from "@qdr/core";
import type { ImmobileGrezzo } from "@qdr/scrapers";

import { db } from "./db.js";

export interface ImmobileRow {
  id: number;
  chiave_dedup: string;
  fonte: string;
  id_esterno: string;
  url: string | null;
  titolo: string | null;
  immagine_url: string | null;
  tribunale: string | null;
  anno_rge: number | null;
  numero_rge: number | null;
  numero_lotto: string | null;
  indirizzo_raw: string | null;
  indirizzo_norm: string | null;
  civico: string | null;
  comune: string | null;
  comune_cod: string | null;
  lat: number | null;
  lon: number | null;
  precisione_geo: string | null;
  livello_zona: string | null;
  mq: number | null;
  locali: number | null;
  zona_omi: string | null;
  tipologia_omi: string | null;
  tipo_vendita: string | null;
  prezzo: number | null;
  tipo_prezzo: string | null;
  valore_perizia: number | null;
  n_esperimenti_deserti: number | null;
  data_asta: string | null;
  termine_offerte: string | null;
  stato_occupazionale: string | null;
  conformita_urb: string | null;
  vincolo_culturale: number | null;
  sottotipo_asset: string | null;
  fonti_json: string | null;
  note_merge_json: string | null;
  valore_centrale: number | null;
  divergenza: number | null;
  sconto_su_valore: number | null;
  praticabile: number | null;
  flags_json: string | null;
  first_seen_at: string;
  scraped_at: string;
}

/** Chiave stabile usata per l'upsert: la stessa identita' che deduplica() usa per fondere i record. */
export function chiaveDedup(i: ImmobileNorm): string {
  return (
    chiaveGiudiziaria(i) ?? chiaveGeofisica(i) ?? `FONTE|${i.fonte}|${i.idEsterno}`
  );
}

export function rowToImmobileNorm(r: ImmobileRow): ImmobileGrezzo {
  return {
    fonte: r.fonte,
    idEsterno: r.id_esterno,
    url: r.url,
    titolo: r.titolo,
    immagineUrl: r.immagine_url,
    tribunale: r.tribunale,
    annoRge: r.anno_rge,
    numeroRge: r.numero_rge,
    numeroLotto: r.numero_lotto,
    indirizzoRaw: r.indirizzo_raw,
    indirizzoNorm: r.indirizzo_norm,
    civico: r.civico,
    comune: r.comune,
    comuneCod: r.comune_cod,
    lat: r.lat,
    lon: r.lon,
    precisioneGeo: r.precisione_geo,
    livelloZona: r.livello_zona,
    mq: r.mq,
    locali: r.locali,
    zonaOmi: r.zona_omi,
    tipologiaOmi: r.tipologia_omi ?? undefined,
    tipoVendita: r.tipo_vendita,
    prezzo: r.prezzo,
    tipoPrezzo: (r.tipo_prezzo as ImmobileNorm["tipoPrezzo"]) ?? null,
    valorePerizia: r.valore_perizia,
    nEsperimentiDeserti: r.n_esperimenti_deserti ?? undefined,
    dataAsta: r.data_asta,
    termineOfferte: r.termine_offerte,
    statoOccupazionale: r.stato_occupazionale,
    conformitaUrb: (r.conformita_urb as ImmobileNorm["conformitaUrb"]) ?? undefined,
    vincoloCulturale: r.vincolo_culturale === null ? null : Boolean(r.vincolo_culturale),
    sottotipoAsset: r.sottotipo_asset,
    fonti: r.fonti_json ? JSON.parse(r.fonti_json) : undefined,
    noteMerge: r.note_merge_json ? JSON.parse(r.note_merge_json) : undefined,
  };
}

export function listAllAsImmobileNorm(): ImmobileGrezzo[] {
  return listAllRows().map(rowToImmobileNorm);
}

/** Righe grezze con il loro id: serve a chi deve riscrivere la stessa riga (vedi enrich). */
export function listAllRows(): ImmobileRow[] {
  return db.prepare("SELECT * FROM immobili").all() as ImmobileRow[];
}

const UPSERT_SQL = `
INSERT INTO immobili (
  chiave_dedup, fonte, id_esterno, url, titolo, immagine_url,
  tribunale, anno_rge, numero_rge, numero_lotto,
  indirizzo_raw, indirizzo_norm, civico, comune, comune_cod,
  lat, lon, precisione_geo, livello_zona,
  mq, locali, zona_omi, tipologia_omi,
  tipo_vendita, prezzo, tipo_prezzo, valore_perizia, n_esperimenti_deserti,
  data_asta, termine_offerte,
  stato_occupazionale, conformita_urb, vincolo_culturale, sottotipo_asset,
  fonti_json, note_merge_json,
  first_seen_at, scraped_at
) VALUES (
  @chiave_dedup, @fonte, @id_esterno, @url, @titolo, @immagine_url,
  @tribunale, @anno_rge, @numero_rge, @numero_lotto,
  @indirizzo_raw, @indirizzo_norm, @civico, @comune, @comune_cod,
  @lat, @lon, @precisione_geo, @livello_zona,
  @mq, @locali, @zona_omi, @tipologia_omi,
  @tipo_vendita, @prezzo, @tipo_prezzo, @valore_perizia, @n_esperimenti_deserti,
  @data_asta, @termine_offerte,
  @stato_occupazionale, @conformita_urb, @vincolo_culturale, @sottotipo_asset,
  @fonti_json, @note_merge_json,
  @first_seen_at, @scraped_at
)
ON CONFLICT(chiave_dedup) DO UPDATE SET
  fonte = excluded.fonte, id_esterno = excluded.id_esterno, url = excluded.url,
  titolo = excluded.titolo, immagine_url = excluded.immagine_url,
  tribunale = excluded.tribunale, anno_rge = excluded.anno_rge, numero_rge = excluded.numero_rge,
  numero_lotto = excluded.numero_lotto,
  indirizzo_raw = excluded.indirizzo_raw, indirizzo_norm = excluded.indirizzo_norm,
  civico = excluded.civico, comune = excluded.comune, comune_cod = excluded.comune_cod,
  lat = excluded.lat, lon = excluded.lon,
  precisione_geo = excluded.precisione_geo, livello_zona = excluded.livello_zona,
  mq = excluded.mq, locali = excluded.locali, zona_omi = excluded.zona_omi, tipologia_omi = excluded.tipologia_omi,
  tipo_vendita = excluded.tipo_vendita, prezzo = excluded.prezzo, tipo_prezzo = excluded.tipo_prezzo,
  valore_perizia = excluded.valore_perizia, n_esperimenti_deserti = excluded.n_esperimenti_deserti,
  data_asta = excluded.data_asta, termine_offerte = excluded.termine_offerte,
  stato_occupazionale = excluded.stato_occupazionale, conformita_urb = excluded.conformita_urb,
  vincolo_culturale = excluded.vincolo_culturale, sottotipo_asset = excluded.sottotipo_asset,
  fonti_json = excluded.fonti_json, note_merge_json = excluded.note_merge_json,
  scraped_at = excluded.scraped_at
`;

/** Sostituisce l'intero contenuto della tabella con l'esito gia' deduplicato di una pipeline run.
 *  first_seen_at si preserva per le chiavi gia' note, leggendole prima dell'upsert. */
export function salvaImmobiliDeduplicati(items: ImmobileGrezzo[]): { nuovi: number; aggiornati: number } {
  const now = new Date().toISOString();
  const trovaFirstSeen = db.prepare("SELECT first_seen_at FROM immobili WHERE chiave_dedup = ?");
  const upsert = db.prepare(UPSERT_SQL);

  let nuovi = 0;
  let aggiornati = 0;

  const transazione = db.transaction((records: ImmobileGrezzo[]) => {
    for (const i of records) {
      const chiave = chiaveDedup(i);
      const esistente = trovaFirstSeen.get(chiave) as { first_seen_at: string } | undefined;
      if (esistente) aggiornati++;
      else nuovi++;

      upsert.run({
        chiave_dedup: chiave,
        fonte: i.fonte,
        id_esterno: i.idEsterno,
        url: i.url ?? null,
        titolo: i.titolo ?? null,
        immagine_url: i.immagineUrl ?? null,
        tribunale: i.tribunale ?? null,
        anno_rge: i.annoRge ?? null,
        numero_rge: i.numeroRge ?? null,
        numero_lotto: i.numeroLotto ?? null,
        indirizzo_raw: i.indirizzoRaw ?? null,
        indirizzo_norm: i.indirizzoNorm ?? null,
        civico: i.civico ?? null,
        comune: i.comune ?? null,
        comune_cod: i.comuneCod ?? null,
        lat: i.lat ?? null,
        lon: i.lon ?? null,
        precisione_geo: i.precisioneGeo ?? null,
        livello_zona: i.livelloZona ?? null,
        mq: i.mq ?? null,
        locali: i.locali ?? null,
        zona_omi: i.zonaOmi ?? null,
        tipologia_omi: i.tipologiaOmi ?? null,
        tipo_vendita: i.tipoVendita ?? null,
        prezzo: i.prezzo ?? null,
        tipo_prezzo: i.tipoPrezzo ?? null,
        valore_perizia: i.valorePerizia ?? null,
        n_esperimenti_deserti: i.nEsperimentiDeserti ?? null,
        data_asta: i.dataAsta ?? null,
        termine_offerte: i.termineOfferte ?? null,
        stato_occupazionale: i.statoOccupazionale ?? null,
        conformita_urb: i.conformitaUrb ?? null,
        vincolo_culturale: i.vincoloCulturale === undefined || i.vincoloCulturale === null ? null : Number(i.vincoloCulturale),
        sottotipo_asset: i.sottotipoAsset ?? null,
        fonti_json: i.fonti ? JSON.stringify(i.fonti) : null,
        note_merge_json: i.noteMerge ? JSON.stringify(i.noteMerge) : null,
        first_seen_at: esistente?.first_seen_at ?? now,
        scraped_at: now,
      });
    }
  });
  transazione(items);

  return { nuovi, aggiornati };
}

/* Gli aggiornamenti di arricchimento agganciano la riga per `id`, non per chiave_dedup:
 * la chiave e' derivata da campi mutabili (indirizzo, mq, locali), quindi ricalcolarla
 * dalla riga letta puo' dare un valore diverso da quello memorizzato e far cadere
 * l'UPDATE su zero righe in silenzio. L'id e' stabile per costruzione.
 * Entrambe ritornano true se hanno effettivamente scritto, cosi' il chiamante puo'
 * contare le scritture riuscite invece dei tentativi. */

export function salvaArricchimentoGeo(
  id: number,
  esito: { zonaOmi: string | null; lat?: number; lon?: number; precisioneGeo: string; livello: string },
): boolean {
  const info = db
    .prepare(
      `UPDATE immobili SET zona_omi = ?, lat = ?, lon = ?, precisione_geo = ?, livello_zona = ?
       WHERE id = ?`,
    )
    .run(esito.zonaOmi, esito.lat ?? null, esito.lon ?? null, esito.precisioneGeo, esito.livello, id);
  return info.changes > 0;
}

export function salvaValutazione(id: number, v: Valutazione): boolean {
  const info = db
    .prepare(
      `UPDATE immobili SET valore_centrale = ?, divergenza = ?, sconto_su_valore = ?, praticabile = ?, flags_json = ?
       WHERE id = ?`,
    )
    .run(v.valoreCentrale, v.divergenza, v.scontoSuValore, Number(v.praticabile), JSON.stringify(v.flags), id);
  return info.changes > 0;
}

export interface FiltriListing {
  fonte?: string;
  comune?: string;
  prezzoMin?: number;
  prezzoMax?: number;
  soloPraticabili?: boolean;
  limit?: number;
}

export function listImmobili(f: FiltriListing = {}): ImmobileRow[] {
  const clausole: string[] = [];
  const params: Record<string, unknown> = {};

  if (f.fonte) { clausole.push("fonte = @fonte"); params.fonte = f.fonte; }
  if (f.comune) { clausole.push("comune LIKE @comune"); params.comune = `%${f.comune}%`; }
  if (f.prezzoMin !== undefined) { clausole.push("prezzo >= @prezzoMin"); params.prezzoMin = f.prezzoMin; }
  if (f.prezzoMax !== undefined) { clausole.push("prezzo <= @prezzoMax"); params.prezzoMax = f.prezzoMax; }
  if (f.soloPraticabili) { clausole.push("(praticabile IS NULL OR praticabile = 1)"); }

  const where = clausole.length ? `WHERE ${clausole.join(" AND ")}` : "";
  const limit = Math.min(f.limit ?? 200, 500);

  return db
    .prepare(`SELECT * FROM immobili ${where} ORDER BY scraped_at DESC LIMIT @limit`)
    .all({ ...params, limit }) as ImmobileRow[];
}

export function getImmobile(id: number): ImmobileRow | undefined {
  return db.prepare("SELECT * FROM immobili WHERE id = ?").get(id) as ImmobileRow | undefined;
}

export function listFonti(): string[] {
  const rows = db.prepare("SELECT DISTINCT fonte FROM immobili ORDER BY fonte").all() as { fonte: string }[];
  return rows.map((r) => r.fonte);
}
