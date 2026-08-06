import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  bboxDi, puntoInAnello, puntoInPoligono, puntoInZona, costruisciIndice,
  trovaZona, daGeoJson, type ZonaOmi, type Anello,
} from "./geo.js";
import { risolviZona, applicaZona, aggregaPerComune, ZONA_COMUNE } from "./zoneOmi.js";
import { cacheMemoria, conCache, almeno, type Geocoder, type RisultatoGeocoding } from "./geocode.js";
import { valuta, type QuotazioneOmi } from "./valutazione.js";
import type { ImmobileNorm } from "./dedup.js";

// quadrato 9.18-9.20 lon, 45.46-45.48 lat (circa centro Milano)
const quadrato = (o: number, s: number, lato: number): Anello =>
  [[o, s], [o + lato, s], [o + lato, s + lato], [o, s + lato], [o, s]];

const zona = (comuneCod: string, z: string, o: number, s: number, lato: number): ZonaOmi => {
  const geom = [[quadrato(o, s, lato)]];
  return { comuneCod, zona: z, geom, bbox: bboxDi(geom) };
};

describe("geometria", () => {
  const B7 = zona("F205", "B7", 9.18, 45.46, 0.02);

  test("punto interno ed esterno", () => {
    assert.equal(puntoInZona({ lat: 45.47, lon: 9.19 }, B7), true);
    assert.equal(puntoInZona({ lat: 45.50, lon: 9.19 }, B7), false);
  });

  test("il bbox prefiltra prima del ray casting", () => {
    assert.equal(puntoInZona({ lat: 0, lon: 0 }, B7), false);
  });

  test("punto sul confine conta come dentro", () => {
    assert.equal(puntoInAnello({ lat: 45.46, lon: 9.19 }, quadrato(9.18, 45.46, 0.02)), true);
    assert.equal(puntoInAnello({ lat: 45.46, lon: 9.18 }, quadrato(9.18, 45.46, 0.02)), true);
  });

  test("il buco esclude", () => {
    const conBuco = [quadrato(9.18, 45.46, 0.04), quadrato(9.19, 45.47, 0.01)];
    assert.equal(puntoInPoligono({ lat: 45.465, lon: 9.185 }, conBuco), true);
    assert.equal(puntoInPoligono({ lat: 45.475, lon: 9.195 }, conBuco), false);
  });

  test("indice: trova la zona giusta fra molte", () => {
    const zone = [
      zona("F205", "B7", 9.18, 45.46, 0.02),
      zona("F205", "D3", 9.22, 45.50, 0.02),
      zona("I690", "C1", 9.24, 45.53, 0.02),
    ];
    const idx = costruisciIndice(zone);
    assert.equal(trovaZona(idx, { lat: 45.51, lon: 9.23 })?.zona, "D3");
    assert.equal(trovaZona(idx, { lat: 45.47, lon: 9.19 })?.zona, "B7");
    assert.equal(trovaZona(idx, { lat: 44.0, lon: 8.0 }), null);
  });

  test("il filtro per comune evita la zona del comune contiguo", () => {
    const idx = costruisciIndice([
      zona("F205", "B7", 9.18, 45.46, 0.02),
      zona("I690", "SOVRAP", 9.18, 45.46, 0.02),
    ]);
    assert.equal(trovaZona(idx, { lat: 45.47, lon: 9.19 }, "I690")?.zona, "SOVRAP");
  });

  test("GeoJSON: importa e riferisce gli scarti", () => {
    const r = daGeoJson({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { comune_amm: "F205", zona: "B7" },
          geometry: { type: "Polygon", coordinates: [quadrato(9.18, 45.46, 0.02)] } },
        { type: "Feature", properties: { COMUNE_AMM: "F205", ZONA: "D3" },
          geometry: { type: "MultiPolygon", coordinates: [[quadrato(9.22, 45.50, 0.02)]] } },
        { type: "Feature", properties: { zona: "X" },
          geometry: { type: "Polygon", coordinates: [quadrato(0, 0, 1)] } },
        { type: "Feature", properties: { comune_amm: "F205", zona: "Y" },
          geometry: { type: "LineString", coordinates: [] } },
      ],
    });
    assert.equal(r.zone.length, 2);
    assert.equal(r.scartate, 2);
    assert.equal(r.motivi.length, 2);
  });
});

// geocoder finto, deterministico
const geoFinto = (mappa: Record<string, RisultatoGeocoding>): Geocoder => ({
  async geocodifica(q) {
    for (const [k, v] of Object.entries(mappa)) if (q.toUpperCase().includes(k)) return v;
    return null;
  },
});

describe("risoluzione zona OMI", () => {
  const idx = costruisciIndice([
    zona("F205", "B7", 9.18, 45.46, 0.02),
    zona("F205", "D3", 9.22, 45.50, 0.02),
  ]);
  const imm = (o: Partial<ImmobileNorm>): ImmobileNorm =>
    ({ fonte: "pvp", idEsterno: "1", comune: "Milano", comuneCod: "F205", ...o });

  test("indirizzo preciso risolve la zona", async () => {
    const g = geoFinto({ "MONZA": { lat: 45.47, lon: 9.19, precisione: "civico", etichetta: "", fonte: "t" } });
    const e = await risolviZona(imm({ indirizzoRaw: "V.le Monza 12" }), idx, g);
    assert.equal(e.zonaOmi, "B7");
    assert.equal(e.livello, "zona");
  });

  test("geocoding impreciso NON assegna la zona", async () => {
    const g = geoFinto({ "MONZA": { lat: 45.47, lon: 9.19, precisione: "comune", etichetta: "", fonte: "t" } });
    const e = await risolviZona(imm({ indirizzoRaw: "V.le Monza 12" }), idx, g);
    assert.equal(e.zonaOmi, ZONA_COMUNE);
    assert.equal(e.livello, "comune");
    assert.match(e.motivo!, /impreciso/);
  });

  test("geocoding fallito ripiega sul comune", async () => {
    const e = await risolviZona(imm({ indirizzoRaw: "Via Inesistente 1" }), idx, geoFinto({}));
    assert.equal(e.livello, "comune");
    assert.match(e.motivo!, /geocoding fallito/);
  });

  test("punto fuori dai perimetri noti ripiega sul comune", async () => {
    const g = geoFinto({ "TAL": { lat: 44.0, lon: 8.0, precisione: "civico", etichetta: "", fonte: "t" } });
    const e = await risolviZona(imm({ indirizzoRaw: "Via Tal 1" }), idx, g);
    assert.equal(e.livello, "comune");
    assert.match(e.motivo!, /fuori da ogni perimetro/);
  });

  test("zona gia' nota non viene rigeocodificata", async () => {
    let chiamate = 0;
    const g: Geocoder = { async geocodifica() { chiamate++; return null; } };
    const e = await risolviZona(imm({ zonaOmi: "B7", indirizzoRaw: "Via Tal 1" }), idx, g);
    assert.equal(e.zonaOmi, "B7");
    assert.equal(chiamate, 0);
  });

  test("la cache evita richieste ripetute", async () => {
    let chiamate = 0;
    const base: Geocoder = { async geocodifica() { chiamate++; return { lat: 45.47, lon: 9.19, precisione: "civico", etichetta: "", fonte: "t" }; } };
    const g = conCache(base, cacheMemoria());
    await g.geocodifica("VIA TAL 1, MILANO");
    await g.geocodifica("via tal 1, milano");
    assert.equal(chiamate, 1);
  });

  test("anche i fallimenti si memorizzano", async () => {
    let chiamate = 0;
    const base: Geocoder = { async geocodifica() { chiamate++; return null; } };
    const g = conCache(base, cacheMemoria());
    await g.geocodifica("X");
    await g.geocodifica("X");
    assert.equal(chiamate, 1);
  });

  test("soglie di precisione", () => {
    assert.equal(almeno("civico", "strada"), true);
    assert.equal(almeno("strada", "strada"), true);
    assert.equal(almeno("localita", "strada"), false);
  });
});

describe("aggregato comunale", () => {
  const q = new Map<string, QuotazioneOmi>([
    ["F205|B7|Abitazioni civili", { vendMin: 3100, vendMax: 3800, semestre: "2026-1" }],
    ["F205|D3|Abitazioni civili", { vendMin: 2200, vendMax: 2700, semestre: "2026-1" }],
    ["F205|B7|Uffici", { vendMin: 2600, vendMax: 3300, semestre: "2026-1" }],
  ]);

  test("min dei minimi e max dei massimi, non la media", () => {
    const agg = aggregaPerComune(q);
    const c = agg.get(`F205|${ZONA_COMUNE}|Abitazioni civili`)!;
    assert.equal(c.vendMin, 2200);
    assert.equal(c.vendMax, 3800);
    assert.equal(agg.get(`F205|${ZONA_COMUNE}|Uffici`)!.vendMin, 2600);
  });

  test("le quotazioni originali restano", () => {
    assert.ok(aggregaPerComune(q).get("F205|B7|Abitazioni civili"));
  });
});

describe("integrazione con la valutazione", () => {
  const quotazioni = aggregaPerComune(new Map<string, QuotazioneOmi>([
    ["F205|B7|Abitazioni civili", { vendMin: 3100, vendMax: 3800, semestre: "2026-1" }],
    ["F205|D3|Abitazioni civili", { vendMin: 2200, vendMax: 2700, semestre: "2026-1" }],
  ]));
  const oggi = new Date(Date.UTC(2026, 7, 5));
  const base: ImmobileNorm = {
    fonte: "pvp", idEsterno: "1", comune: "Milano", comuneCod: "F205",
    mq: 100, prezzo: 200000, tipoPrezzo: "base_asta", valorePerizia: 330000,
  };

  test("prima della risoluzione: nessuna stima OMI", () => {
    const v = valuta(base, { quotazioni, oggi });
    assert.equal(v.stime.filter((s) => s.metodo.startsWith("omi")).length, 0);
    assert.ok(v.flags.some((f) => f.tipo === "stima_singola"));
  });

  test("dopo la risoluzione di zona: OMI entra e la stima si incrocia", () => {
    const v = valuta({ ...base, zonaOmi: "B7", livelloZona: "zona" }, { quotazioni, oggi });
    assert.equal(v.stime.filter((s) => s.metodo.startsWith("omi")).length, 2);
    assert.ok(!v.flags.some((f) => f.tipo === "stima_singola"));
    assert.ok(v.valoreCentrale && v.valoreCentrale > 0);
  });

  test("ripiego comunale: stima presente ma segnalata e con meno peso", () => {
    const conZona = valuta({ ...base, zonaOmi: "B7", livelloZona: "zona" }, { quotazioni, oggi });
    const conComune = valuta(
      applicaZona(base, { zonaOmi: ZONA_COMUNE, livello: "comune", precisioneGeo: "comune" }),
      { quotazioni, oggi },
    );
    assert.ok(conComune.flags.some((f) => f.tipo === "zona_omi_non_risolta"));
    const confZona = conZona.stime.find((s) => s.metodo === "omi_min")!.confidenza;
    const confComune = conComune.stime.find((s) => s.metodo === "omi_min")!.confidenza;
    assert.ok(confComune < confZona, "il ripiego deve pesare meno nella media");
    assert.match(conComune.stime.find((s) => s.metodo === "omi_min")!.nota, /aggregato comunale/);
  });
});
