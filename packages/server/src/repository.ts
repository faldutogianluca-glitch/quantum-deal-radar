import { chiavi, chiaveGeofisica, chiaveGiudiziaria } from "@qdr/core";
import type { ImmobileNorm, Valutazione } from "@qdr/core";
import type { ImmobileGrezzo } from "@qdr/scrapers";

import { db } from "./db.js";
import type { PrezzoMaxQre } from "./qre.js";

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
  qre_valore_mq: number | null;
  qre_valore_fonte: string | null;
  qre_pmax_obiettivo: number | null;
  qre_pmax_tetto: number | null;
  qre_prezzo_ingresso: number | null;
  qre_prezzo_atteso: number | null;
  qre_vincolo: string | null;
  qre_esito: string | null;
  qre_motivo: string | null;
  qre_dettaglio_json: string | null;
  first_seen_at: string;
  scraped_at: string;
  /* Calcolate dallo storico, presenti solo nelle letture che le richiedono. */
  prezzo_iniziale?: number | null;
  n_rilevazioni_prezzo?: number;
  ultimo_cambio_prezzo_il?: string | null;
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
  return TUTTE_LE_RIGHE.all() as unknown as ImmobileRow[];
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
  tribunale = excluded.tribunale,
  -- i campi del dettaglio: un'esecuzione che non lo ha riaperto (tetto ai dettagli,
  -- servizio giu') non deve cancellare cio' che si era letto prima
  anno_rge = COALESCE(excluded.anno_rge, anno_rge), numero_rge = COALESCE(excluded.numero_rge, numero_rge),
  numero_lotto = excluded.numero_lotto,
  indirizzo_raw = excluded.indirizzo_raw, indirizzo_norm = excluded.indirizzo_norm,
  civico = excluded.civico, comune = excluded.comune, comune_cod = excluded.comune_cod,
  lat = excluded.lat, lon = excluded.lon,
  precisione_geo = excluded.precisione_geo, livello_zona = excluded.livello_zona,
  mq = excluded.mq, locali = excluded.locali, zona_omi = excluded.zona_omi, tipologia_omi = excluded.tipologia_omi,
  tipo_vendita = COALESCE(excluded.tipo_vendita, tipo_vendita), prezzo = excluded.prezzo, tipo_prezzo = excluded.tipo_prezzo,
  valore_perizia = excluded.valore_perizia, n_esperimenti_deserti = COALESCE(excluded.n_esperimenti_deserti, n_esperimenti_deserti),
  data_asta = excluded.data_asta, termine_offerte = COALESCE(excluded.termine_offerte, termine_offerte),
  stato_occupazionale = excluded.stato_occupazionale, conformita_urb = excluded.conformita_urb,
  vincolo_culturale = excluded.vincolo_culturale, sottotipo_asset = excluded.sottotipo_asset,
  fonti_json = excluded.fonti_json, note_merge_json = excluded.note_merge_json,
  scraped_at = excluded.scraped_at
`;

/* Statement preparati una volta sola a livello di modulo: prepararli a ogni chiamata
 * (o peggio, a ogni riga di un ciclo) ricompila l'SQL inutilmente. */
const TROVA_PER_CHIAVE = db.prepare(
  "SELECT id, first_seen_at, fonte, id_esterno FROM immobili WHERE chiave_dedup = ?",
);
const TROVA_PER_ORIGINE = db.prepare(
  "SELECT id, first_seen_at FROM immobili WHERE fonte = ? AND id_esterno = ?",
);
const RIALLINEA_CHIAVE = db.prepare("UPDATE immobili SET chiave_dedup = ? WHERE id = ?");
const TROVA_PER_ID = db.prepare("SELECT * FROM immobili WHERE id = ?");
const TUTTE_LE_RIGHE = db.prepare("SELECT * FROM immobili");
const UPSERT = db.prepare(UPSERT_SQL);
const ELIMINA_RIGA = db.prepare("DELETE FROM immobili WHERE id = ?");
const TROVA_ID_PER_CHIAVE = db.prepare("SELECT id FROM immobili WHERE chiave_dedup = ?");
const ULTIMO_PREZZO = db.prepare(
  "SELECT prezzo FROM storico_prezzi WHERE immobile_id = ? ORDER BY rilevato_il DESC, id DESC LIMIT 1",
);
const REGISTRA_PREZZO = db.prepare(
  "INSERT INTO storico_prezzi (immobile_id, prezzo, tipo_prezzo, rilevato_il) VALUES (?, ?, ?, ?)",
);

/**
 * Annota il prezzo solo quando cambia.
 *
 * Registrarlo a ogni ciclo gonfierebbe la tabella di righe identiche e
 * renderebbe illeggibile la sequenza dei ribassi, che e' l'informazione utile:
 * quante volte e' calato, di quanto, e da quanto tempo e' fermo.
 */
function annotaPrezzo(immobileId: number, prezzo: number | null | undefined, tipo: string | null, quando: string): void {
  if (prezzo === null || prezzo === undefined) return;
  const ultimo = ULTIMO_PREZZO.get(immobileId) as { prezzo: number } | undefined;
  if (ultimo && ultimo.prezzo === prezzo) return;
  REGISTRA_PREZZO.run(immobileId, prezzo, tipo, quando);
}

interface RigaEsistente {
  id: number;
  first_seen_at: string;
  fonte?: string;
  id_esterno?: string;
}

/** Un'altra riga dello stesso portale con un altro codice e' un altro immobile (vedi deduplica). */
const altroAnnuncioStessaFonte = (r: RigaEsistente | undefined, i: ImmobileGrezzo): boolean =>
  !!r && r.fonte === i.fonte && r.id_esterno !== i.idEsterno;

/**
 * La chiave con cui la riga si salva. Di norma quella della deduplica; ma due
 * annunci dello stesso portale con la stessa chiave geofisica (box gemelli allo
 * stesso civico) sono beni diversi, e salvarli sotto la stessa chiave farebbe
 * sovrascrivere l'uno con l'altro, scambiando il prezzo del secondo per un
 * ribasso del primo. In quel caso vale l'identita' dell'annuncio.
 */
function chiaveArchivio(i: ImmobileGrezzo): string {
  const k = chiaveDedup(i);
  return altroAnnuncioStessaFonte(TROVA_PER_CHIAVE.get(k) as RigaEsistente | undefined, i)
    ? `FONTE|${i.fonte}|${i.idEsterno}`
    : k;
}

/**
 * Righe che rappresentano gia' questo bene, sotto qualunque identita'.
 *
 * Serve perche' un immobile puo' essere gia' in tabella sotto una chiave diversa
 * da quella che produce ora:
 *  - deduplica() fonde un pre-asta (chiave geofisica) con l'asta che compare dopo
 *    con l'RGE: il record fuso ha la chiave giudiziaria, e la riga del pre-asta
 *    resterebbe orfana come duplicato;
 *  - la chiave geofisica cambia se il portale corregge metratura o indirizzo.
 *
 * Si cercano quindi tutte le chiavi che il record esprime, piu' l'identita'
 * stabile dell'annuncio (fonte + id esterno).
 */
function righeGiaPresenti(i: ImmobileGrezzo): RigaEsistente[] {
  const candidate = new Map<number, RigaEsistente>();

  for (const k of [...chiavi(i), chiaveDedup(i)]) {
    const r = TROVA_PER_CHIAVE.get(k) as RigaEsistente | undefined;
    if (r && !altroAnnuncioStessaFonte(r, i)) candidate.set(r.id, r);
  }
  const perOrigine = TROVA_PER_ORIGINE.get(i.fonte, i.idEsterno) as RigaEsistente | undefined;
  if (perOrigine) candidate.set(perOrigine.id, perOrigine);

  return [...candidate.values()];
}

/** Sostituisce l'intero contenuto della tabella con l'esito gia' deduplicato di una pipeline run.
 *  Le righe che rappresentano lo stesso bene sotto identita' diverse vengono fuse in una
 *  sola, conservando la prima data di rilevazione fra tutte. */
export function salvaImmobiliDeduplicati(items: ImmobileGrezzo[]): {
  nuovi: number;
  aggiornati: number;
  assorbiti: number;
} {
  const now = new Date().toISOString();

  let nuovi = 0;
  let aggiornati = 0;
  let assorbiti = 0;

  // node:sqlite non offre un helper equivalente a db.transaction() di
  // better-sqlite3: la transazione si delimita a mano, con rollback esplicito
  // perche' un salvataggio interrotto a meta' lascerebbe righe incoerenti.
  const transazione = (records: ImmobileGrezzo[]): void => {
    for (const i of records) {
      const chiave = chiaveArchivio(i);
      const presenti = righeGiaPresenti(i);

      let esistente: RigaEsistente | undefined;
      if (presenti.length > 0) {
        // Sopravvive la riga vista per prima, cosi' first_seen_at resta il piu' antico;
        // le altre rappresentano lo stesso bene e vengono eliminate invece di restare
        // come duplicati.
        presenti.sort((a, b) => a.first_seen_at.localeCompare(b.first_seen_at));
        esistente = presenti[0];
        for (const doppione of presenti.slice(1)) {
          ELIMINA_RIGA.run(doppione.id);
          assorbiti++;
        }
        // la riga sopravvissuta puo' avere una chiave diversa da quella attuale
        RIALLINEA_CHIAVE.run(chiave, esistente!.id);
      }

      if (esistente) aggiornati++;
      else nuovi++;

      UPSERT.run({
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

      // l'id serve per lo storico: per le righe nuove va riletto dopo l'upsert
      const id = esistente?.id ?? (TROVA_ID_PER_CHIAVE.get(chiave) as { id: number } | undefined)?.id;
      if (id !== undefined) annotaPrezzo(id, i.prezzo, i.tipoPrezzo ?? null, now);
    }
  };

  db.exec("BEGIN");
  try {
    transazione(items);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { nuovi, aggiornati, assorbiti };
}

/* Gli aggiornamenti di arricchimento agganciano la riga per `id`, non per chiave_dedup:
 * la chiave e' derivata da campi mutabili (indirizzo, mq, locali), quindi ricalcolarla
 * dalla riga letta puo' dare un valore diverso da quello memorizzato e far cadere
 * l'UPDATE su zero righe in silenzio. L'id e' stabile per costruzione.
 * Entrambe ritornano true se hanno effettivamente scritto, cosi' il chiamante puo'
 * contare le scritture riuscite invece dei tentativi. */

/* Le coordinate si sovrascrivono solo con coordinate nuove. Un immobile con la zona
 * gia' risolta non viene rigeocodificato, quindi l'esito non porta lat/lon: scrivere
 * NULL le cancellerebbe a ogni enrich successivo, e con loro la ricerca dei
 * comparabili per distanza. */
const AGGIORNA_GEO = db.prepare(
  `UPDATE immobili SET zona_omi = ?, lat = COALESCE(?, lat), lon = COALESCE(?, lon), precisione_geo = ?, livello_zona = ?,
     comune_cod = COALESCE(?, comune_cod), tipologia_omi = COALESCE(?, tipologia_omi)
   WHERE id = ?`,
);
const AGGIORNA_VALUTAZIONE = db.prepare(
  `UPDATE immobili SET valore_centrale = ?, divergenza = ?, sconto_su_valore = ?, praticabile = ?, flags_json = ?
   WHERE id = ?`,
);

const AGGIORNA_QRE = db.prepare(
  `UPDATE immobili SET qre_valore_mq = ?, qre_valore_fonte = ?, qre_pmax_obiettivo = ?, qre_pmax_tetto = ?, qre_prezzo_ingresso = ?,
     qre_prezzo_atteso = ?, qre_vincolo = ?, qre_esito = ?, qre_motivo = ?, qre_dettaglio_json = ?
   WHERE id = ?`,
);

export function salvaArricchimentoGeo(
  id: number,
  esito: { zonaOmi: string | null; lat?: number; lon?: number; precisioneGeo: string; livello: string },
  comuneCod: string | null = null,
  tipologiaOmi: string | null = null,
): boolean {
  const info = AGGIORNA_GEO.run(
    esito.zonaOmi, esito.lat ?? null, esito.lon ?? null, esito.precisioneGeo, esito.livello, comuneCod, tipologiaOmi, id,
  );
  return info.changes > 0;
}

export function salvaValutazione(id: number, v: Valutazione): boolean {
  const info = AGGIORNA_VALUTAZIONE.run(
    v.valoreCentrale, v.divergenza, v.scontoSuValore, Number(v.praticabile), JSON.stringify(v.flags), id,
  );
  return info.changes > 0;
}

export function salvaPrezzoMaxQre(id: number, q: PrezzoMaxQre): boolean {
  const info = AGGIORNA_QRE.run(
    q.valoreMq, q.valoreFonte, q.pmaxObiettivo, q.pmaxTetto, q.prezzoIngresso, q.prezzoAtteso, q.vincolo, q.esito, q.motivo,
    JSON.stringify(q.dettaglio), id,
  );
  return info.changes > 0;
}

export interface FiltriListing {
  fonte?: string;
  comune?: string;
  prezzoMin?: number;
  prezzoMax?: number;
  soloPraticabili?: boolean;
  /** Solo immobili il cui prezzo attuale e' sceso rispetto alla prima rilevazione. */
  soloRibassati?: boolean;
  /** Solo immobili che passano il Gate 0 QRE (esito "passa" o "al_limite"). */
  soloQre?: boolean;
  /** "recenti" (default), "ribasso" (calo maggiore prima), "anzianita" (in radar da
   *  piu' tempo), "deserti" (piu' aste andate deserte, quindi venditore piu' motivato),
   *  "margine_qre" (piu' spazio fra prezzo atteso di aggiudicazione e offerta massima QRE prima). */
  ordine?: "recenti" | "ribasso" | "anzianita" | "deserti" | "margine_qre";
  limit?: number;
}

/* Colonne calcolate dallo storico. Sono in una sottoquery correlata invece che
 * in una JOIN aggregata perche' il listato e' limitato a poche centinaia di righe
 * e cosi' la query resta leggibile. */
const COLONNE_STORICO = `
  (SELECT s.prezzo FROM storico_prezzi s WHERE s.immobile_id = i.id
     ORDER BY s.rilevato_il ASC, s.id ASC LIMIT 1) AS prezzo_iniziale,
  (SELECT count(*) FROM storico_prezzi s WHERE s.immobile_id = i.id) AS n_rilevazioni_prezzo,
  (SELECT s.rilevato_il FROM storico_prezzi s WHERE s.immobile_id = i.id
     ORDER BY s.rilevato_il DESC, s.id DESC LIMIT 1) AS ultimo_cambio_prezzo_il`;

export function listImmobili(f: FiltriListing = {}): ImmobileRow[] {
  const clausole: string[] = [];
  const params: Record<string, unknown> = {};

  if (f.fonte) { clausole.push("i.fonte = @fonte"); params.fonte = f.fonte; }
  if (f.comune) { clausole.push("i.comune LIKE @comune"); params.comune = `%${f.comune}%`; }
  if (f.prezzoMin !== undefined) { clausole.push("i.prezzo >= @prezzoMin"); params.prezzoMin = f.prezzoMin; }
  if (f.prezzoMax !== undefined) { clausole.push("i.prezzo <= @prezzoMax"); params.prezzoMax = f.prezzoMax; }
  if (f.soloQre) { clausole.push("i.qre_esito IN ('passa', 'al_limite')"); }
  if (f.soloPraticabili) { clausole.push("(i.praticabile IS NULL OR i.praticabile = 1)"); }
  // Il filtro che serve a chi aspetta il ribasso: solo cio' che e' gia' calato.
  if (f.soloRibassati) {
    clausole.push(`i.prezzo < (SELECT s.prezzo FROM storico_prezzi s WHERE s.immobile_id = i.id
                                 ORDER BY s.rilevato_il ASC, s.id ASC LIMIT 1)`);
  }

  const where = clausole.length ? `WHERE ${clausole.join(" AND ")}` : "";
  // LIMIT negativo in SQLite significa "nessun limite": va escluso, altrimenti
  // ?limit=-1 restituirebbe l'intera tabella.
  const richiesto = Number.isFinite(f.limit) ? Math.floor(f.limit as number) : 200;
  const limit = Math.min(Math.max(richiesto, 1), 500);

  const ordine =
    f.ordine === "ribasso"
      ? `(SELECT s.prezzo FROM storico_prezzi s WHERE s.immobile_id = i.id
            ORDER BY s.rilevato_il ASC, s.id ASC LIMIT 1) - i.prezzo DESC`
      : f.ordine === "anzianita"
        ? "i.first_seen_at ASC"
        : f.ordine === "deserti"
          ? "COALESCE(i.n_esperimenti_deserti, 0) DESC, i.first_seen_at ASC"
          : f.ordine === "margine_qre"
            // margine di sicurezza: offerta massima sul prezzo atteso di aggiudicazione,
            // non sul prezzo base. Chi non ha i dati per il calcolo va in fondo.
            ? "i.qre_pmax_obiettivo IS NULL OR i.qre_prezzo_atteso IS NULL, i.qre_pmax_obiettivo / i.qre_prezzo_atteso DESC"
            : "i.scraped_at DESC";

  return db
    .prepare(`SELECT i.*, ${COLONNE_STORICO} FROM immobili i ${where} ORDER BY ${ordine} LIMIT @limit`)
    .all({ ...params, limit }) as unknown as ImmobileRow[];
}

export interface VariazionePrezzo {
  prezzo: number;
  tipo_prezzo: string | null;
  rilevato_il: string;
}

/** Sequenza completa dei prezzi rilevati, dal piu' vecchio. */
export function storicoPrezzi(immobileId: number): VariazionePrezzo[] {
  return db
    .prepare(
      `SELECT prezzo, tipo_prezzo, rilevato_il FROM storico_prezzi
       WHERE immobile_id = ? ORDER BY rilevato_il ASC, id ASC`,
    )
    .all(immobileId) as unknown as VariazionePrezzo[];
}

export interface Ribasso {
  immobile: ImmobileRow;
  prezzoPrima: number;
  prezzoDopo: number;
  /** Quota di calo, 0.30 = trenta per cento in meno. */
  calo: number;
  quando: string;
}

export interface Novita {
  /** Finestra osservata, in giorni. */
  giorni: number;
  nuovi: ImmobileRow[];
  ribassati: Ribasso[];
  /** Prezzi saliti: raro, e dice che quel venditore non ha fretta. */
  rincarati: Ribasso[];
}

/**
 * Cos'e' cambiato nell'ultima finestra di tempo.
 *
 * Aspettare che un venditore abbassi il prezzo funziona solo se qualcuno se ne
 * accorge il giorno in cui succede: un ribasso notato tre settimane dopo e' un
 * ribasso su cui qualcun altro ha gia' fatto un'offerta. La dashboard mostra lo
 * stato; questo mostra il *movimento*, che e' un'altra cosa.
 */
export function novita(giorni = 7): Novita {
  const soglia = new Date(Date.now() - giorni * 86_400_000).toISOString();

  const nuovi = db
    .prepare(`SELECT * FROM immobili WHERE first_seen_at >= ? ORDER BY first_seen_at DESC`)
    .all(soglia) as unknown as ImmobileRow[];

  // Ogni riga di storico si confronta con quella immediatamente precedente
  // dello stesso immobile: e' li' che sta la variazione, non nel primo prezzo
  // mai visto, che non e' un movimento ma l'inizio dell'osservazione.
  const variazioni = db
    .prepare(
      `SELECT s.immobile_id, s.prezzo AS dopo, s.rilevato_il,
              (SELECT p.prezzo FROM storico_prezzi p
                WHERE p.immobile_id = s.immobile_id
                  AND (p.rilevato_il < s.rilevato_il OR (p.rilevato_il = s.rilevato_il AND p.id < s.id))
                ORDER BY p.rilevato_il DESC, p.id DESC LIMIT 1) AS prima
         FROM storico_prezzi s
        WHERE s.rilevato_il >= ?
        ORDER BY s.rilevato_il DESC`,
    )
    .all(soglia) as unknown as { immobile_id: number; dopo: number; prima: number | null; rilevato_il: string }[];

  const ribassati: Ribasso[] = [];
  const rincarati: Ribasso[] = [];
  for (const v of variazioni) {
    if (v.prima === null || v.prima <= 0 || v.dopo === v.prima) continue;
    const immobile = TROVA_PER_ID.get(v.immobile_id) as ImmobileRow | undefined;
    if (!immobile) continue;
    const voce: Ribasso = {
      immobile,
      prezzoPrima: v.prima,
      prezzoDopo: v.dopo,
      calo: (v.prima - v.dopo) / v.prima,
      quando: v.rilevato_il,
    };
    if (v.dopo < v.prima) ribassati.push(voce);
    else rincarati.push(voce);
  }

  // il calo piu' grosso per primo: e' quello su cui conviene muoversi
  ribassati.sort((a, b) => b.calo - a.calo);

  return { giorni, nuovi, ribassati, rincarati };
}

/** L'id della riga che rappresenta un annuncio, cercato per la sua identita' stabile. */
export function idPerOrigine(fonte: string, idEsterno: string): number | undefined {
  return (TROVA_PER_ORIGINE.get(fonte, idEsterno) as RigaEsistente | undefined)?.id;
}

/** Tutte le variazioni di prezzo: per il controllo di qualita' (controllo.ts). */
export function tuttoLoStorico(): { immobile_id: number; prezzo: number; rilevato_il: string }[] {
  return db.prepare("SELECT immobile_id, prezzo, rilevato_il FROM storico_prezzi").all() as unknown as {
    immobile_id: number; prezzo: number; rilevato_il: string;
  }[];
}

export function getImmobile(id: number): ImmobileRow | undefined {
  return TROVA_PER_ID.get(id) as ImmobileRow | undefined;
}

export function listFonti(): string[] {
  const rows = db.prepare("SELECT DISTINCT fonte FROM immobili ORDER BY fonte").all() as { fonte: string }[];
  return rows.map((r) => r.fonte);
}

/*
 * Registro delle notifiche gia' inviate.
 *
 * Serve a rendere l'invio *idempotente*: due esecuzioni ravvicinate sulla
 * stessa finestra non devono produrre due messaggi uguali.
 */

/** Quali, fra le chiavi date, risultano gia' notificate. */
export function giaNotificati(chiavi: string[]): Set<string> {
  const visti = new Set<string>();
  if (chiavi.length === 0) return visti;

  // SQLite ha un tetto al numero di parametri di una query: si procede a
  // blocchi invece di costruire un IN lungo quanto il digest
  const BLOCCO = 400;
  for (let i = 0; i < chiavi.length; i += BLOCCO) {
    const fetta = chiavi.slice(i, i + BLOCCO);
    const segnaposti = fetta.map(() => "?").join(",");
    const righe = db
      .prepare(`SELECT chiave FROM notifiche_inviate WHERE chiave IN (${segnaposti})`)
      .all(...fetta) as unknown as { chiave: string }[];
    for (const r of righe) visti.add(r.chiave);
  }
  return visti;
}

/**
 * Registra le chiavi come notificate.
 *
 * Va chiamata *dopo* un invio riuscito, mai prima: segnare in anticipo
 * significherebbe perdere per sempre un ribasso il cui messaggio non e'
 * partito. Meglio il rischio di un doppione che quello di un silenzio.
 */
export function segnaNotificati(chiavi: string[], canale: string): number {
  if (chiavi.length === 0) return 0;
  const quando = new Date().toISOString();
  const ins = db.prepare(
    "INSERT OR IGNORE INTO notifiche_inviate (chiave, canale, inviato_il) VALUES (?, ?, ?)",
  );
  let scritte = 0;
  db.exec("BEGIN");
  try {
    for (const c of chiavi) scritte += ins.run(c, canale, quando).changes > 0 ? 1 : 0;
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return scritte;
}
